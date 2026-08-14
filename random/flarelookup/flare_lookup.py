"""
flare_lookup.py — Flare Threat Intel API client library.

A framework-agnostic port of the flare-lookup-cli tool
(https://github.com/l0lsec/flare-lookup-cli), stripped of its CLI
(typer/rich) so it can be imported directly by a Django view (or any
other Python code) and called like a function, returning plain
JSON-serializable dicts instead of printing to a terminal.

Only dependency: `requests`.

    pip install requests

--------------------------------------------------------------------
Quick start
--------------------------------------------------------------------

    from flare_lookup import FlareClient, FlareAPIError

    client = FlareClient(api_key="...")            # or set FLARE_API_KEY env var
    try:
        result = client.lookup("domain", "example.com")
    except FlareAPIError as exc:
        ...  # exc.status_code / str(exc)

`result` is a plain dict, ready for `JsonResponse(result)` in Django:

    {
        "indicator_type": "domain",
        "value": "example.com",
        "events": {
            "count": 12,
            "items": [ ... raw Flare event objects ... ],
            "truncated": false
        },
        "credentials": {
            "count": 340,
            "items": [ ... raw Flare credential objects ... ],
            "truncated": true
        }
    }

`lookup()` accepts "domain", "email", "keyword", or "auth_domain" —
these are exactly the four query types Flare's *credentials* global
search endpoint natively supports (per the original CLI and the Flare
API docs: https://api.docs.flare.io/api-reference/v4/endpoints/credentials-global-search).
There is deliberately no "ip"/"url" indicator type: Flare's credentials
search has no free-text or IP concept, and since the point of this
module is finding leaked credentials for a company (by its domain,
its employees' emails, a known username, or its auth/login domain),
those four map onto real, meaningful searches — "ip"/"url" would not.

  domain      -> the company's email/identity domain, e.g. "example.com"
  email       -> a specific person's email address
  keyword     -> the username portion of an identity (no @domain)
  auth_domain -> the domain credentials were used to log into
                 (e.g. an SSO/portal hostname), which can differ
                 from the identity's email domain

--------------------------------------------------------------------
Django integration sketch (not included in this module on purpose)
--------------------------------------------------------------------

    # views.py
    from django.conf import settings
    from django.http import JsonResponse
    from flare_lookup import FlareClient, FlareAPIError

    def flare_lookup_view(request):
        indicator_type = request.GET["type"]    # "domain" | "email" | "keyword" | "auth_domain"
        value = request.GET["value"]
        client = FlareClient(api_key=settings.FLARE_API_KEY)
        try:
            return JsonResponse(client.lookup(indicator_type, value))
        except FlareAPIError as exc:
            return JsonResponse({"error": str(exc)}, status=exc.status_code or 502)

Because Flare pagination can run long, consider calling `lookup()`
from a Celery task / background thread for large result sets rather
than directly in the request-response cycle. `max_pages` (below) is
the knob to keep synchronous calls fast; defaults are conservative
for exactly that reason.
"""

from __future__ import annotations

import csv
import json
import logging
import os
import time
from typing import Any, Iterator

import requests

logger = logging.getLogger("flare_lookup")

BASE_URL = "https://api.flare.io"
DEFAULT_EVENT_PAGE_SIZE = 10        # API max for events
DEFAULT_CRED_PAGE_SIZE = 10_000     # API max for credentials
MAX_CRED_PAGE_SIZE = 10_000

# Keep synchronous "click a button" lookups fast by default. Pass
# max_pages=None (or a bigger number) explicitly for exhaustive pulls,
# ideally from a background task.
DEFAULT_EVENT_MAX_PAGES = 5         # 5 * 10  =  50 events
DEFAULT_CRED_MAX_PAGES = 1          # 1 * 10k = 10,000 credentials

VALID_INDICATOR_TYPES = {"domain", "email", "keyword", "auth_domain"}


class FlareAPIError(Exception):
    """Raised for any Flare API/auth/network failure or bad input."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class FlareClient:
    """Stateful client: holds an API key, lazily fetches/caches a Bearer
    token, and exposes search + a unified `lookup()` convenience method.

    One instance is safe to reuse across multiple lookups (the token is
    cached and only refreshed on expiry/401), but is not thread-safe —
    create one instance per request/thread, or add your own locking.
    """

    def __init__(
        self,
        api_key: str | None = None,
        tenant: str | None = None,
        timeout: int = 30,
    ):
        self.api_key = api_key or os.environ.get("FLARE_API_KEY")
        if not self.api_key:
            raise FlareAPIError(
                "No Flare API key provided. Pass api_key=... or set FLARE_API_KEY."
            )
        self.tenant = tenant
        self.timeout = timeout
        self._session: requests.Session | None = None

    # -- auth -----------------------------------------------------------

    def _fetch_token(self) -> str:
        """Exchange the API key for a short-lived Bearer token."""
        url = f"{BASE_URL}/tokens/generate"
        headers = {"Authorization": self.api_key}
        params = {"tenant": self.tenant} if self.tenant else {}
        logger.debug("POST /tokens/generate tenant=%r", self.tenant)
        try:
            r = requests.post(url, headers=headers, params=params, timeout=self.timeout)
        except requests.RequestException as exc:
            raise FlareAPIError(f"Token request failed: {exc}") from exc
        if not r.ok:
            raise FlareAPIError(
                f"Token request failed: {r.status_code} {r.reason}", status_code=r.status_code
            )
        data = r.json()
        token = data.get("token")
        if not token:
            raise FlareAPIError("Token response missing 'token' field.")
        return token

    def _new_session(self) -> requests.Session:
        token = self._fetch_token()
        s = requests.Session()
        s.headers["Authorization"] = f"Bearer {token}"
        s.headers["Content-Type"] = "application/json"
        return s

    @property
    def session(self) -> requests.Session:
        if self._session is None:
            self._session = self._new_session()
        return self._session

    def refresh_token(self) -> None:
        """Force-discard the cached session/token so the next request re-auths."""
        self._session = None

    # -- low-level request helper (retry on 429, refresh once on 401) ---

    def _post(self, url: str, payload: dict[str, Any]) -> dict[str, Any]:
        last_response: requests.Response | None = None
        reauthed = False
        for attempt in range(4):
            if attempt > 0:
                backoff = 2 ** attempt
                logger.debug("retry %d/4 after %ds backoff", attempt + 1, backoff)
                time.sleep(backoff)
            try:
                r = self.session.post(url, json=payload, timeout=60)
            except requests.RequestException as exc:
                raise FlareAPIError(f"Request to {url} failed: {exc}") from exc
            last_response = r
            if r.status_code == 401 and not reauthed:
                logger.debug("401 received, refreshing token once")
                self.refresh_token()
                reauthed = True
                continue
            if r.status_code == 429:
                logger.debug("429 Too Many Requests (attempt %d/4)", attempt + 1)
                continue
            if not r.ok:
                raise FlareAPIError(
                    f"Flare API error: {r.status_code} {r.reason} — {r.text[:500]}",
                    status_code=r.status_code,
                )
            return r.json()
        assert last_response is not None
        raise FlareAPIError(
            f"Flare API error after retries: {last_response.status_code} {last_response.reason}",
            status_code=last_response.status_code,
        )

    # -----------------------------------------------------------------
    # Events global search — POST /firework/v4/events/global/_search
    # -----------------------------------------------------------------

    @staticmethod
    def build_events_query(
        query_type: str,
        keyword: str | None = None,
        domain: str | None = None,
        email: str | None = None,
        query_string: str | None = None,
        username: str | None = None,
    ) -> dict[str, Any]:
        if query_type == "keyword" and keyword:
            return {"type": "keyword", "keyword": keyword}
        if query_type == "domain" and domain:
            return {"type": "domain", "fqdn": domain}
        if query_type == "email" and email:
            return {"type": "email", "email": email}
        if query_type == "query_string" and query_string:
            return {"type": "query_string", "query_string": query_string}
        if query_type == "username" and username:
            return {"type": "username", "username": username}
        raise FlareAPIError(
            f"Missing value for events query type '{query_type}'. "
            "Provide keyword, domain, email, query_string, or username as appropriate."
        )

    def _search_events_page(
        self,
        query: dict[str, Any],
        size: int = DEFAULT_EVENT_PAGE_SIZE,
        from_: str | None = None,
        order: str = "desc",
        event_types: list[str] | None = None,
        severity: str | list[str] | None = None,
        estimated_created_at_gte: str | None = None,
        estimated_created_at_lte: str | None = None,
    ) -> tuple[list[dict], str | None]:
        url = f"{BASE_URL}/firework/v4/events/global/_search"
        payload: dict[str, Any] = {
            "query": query,
            "size": min(size, DEFAULT_EVENT_PAGE_SIZE),
            "order": order,
        }
        if from_:
            payload["from"] = from_
        filters: dict[str, Any] = {}
        if event_types:
            filters["type"] = event_types
        if severity is not None:
            filters["severity"] = severity
        if estimated_created_at_gte is not None or estimated_created_at_lte is not None:
            filters["estimated_created_at"] = {
                **({"gte": estimated_created_at_gte} if estimated_created_at_gte else {}),
                **({"lte": estimated_created_at_lte} if estimated_created_at_lte else {}),
            }
        if filters:
            payload["filters"] = filters

        data = self._post(url, payload)
        items = data.get("items") or []
        next_cursor = data.get("next")
        return items, next_cursor

    def iter_events(
        self,
        query: dict[str, Any],
        size: int = DEFAULT_EVENT_PAGE_SIZE,
        order: str = "desc",
        event_types: list[str] | None = None,
        severity: str | list[str] | None = None,
        estimated_created_at_gte: str | None = None,
        estimated_created_at_lte: str | None = None,
        max_pages: int | None = DEFAULT_EVENT_MAX_PAGES,
    ) -> Iterator[tuple[int, list[dict], str | None]]:
        """Yield (page_index, items, next_cursor) tuples, paginating via `next`."""
        from_ = None
        page = 0
        while True:
            if max_pages is not None and page >= max_pages:
                break
            page += 1
            items, next_cursor = self._search_events_page(
                query,
                size=size,
                from_=from_,
                order=order,
                event_types=event_types,
                severity=severity,
                estimated_created_at_gte=estimated_created_at_gte,
                estimated_created_at_lte=estimated_created_at_lte,
            )
            yield page, items, next_cursor
            if not next_cursor:
                break
            from_ = next_cursor
            time.sleep(1)  # rate limit: avoid 429 from Flare API

    def search_events(
        self,
        query_type: str,
        *,
        keyword: str | None = None,
        domain: str | None = None,
        email: str | None = None,
        query_string: str | None = None,
        username: str | None = None,
        size: int = DEFAULT_EVENT_PAGE_SIZE,
        order: str = "desc",
        event_types: list[str] | None = None,
        severity: str | list[str] | None = None,
        created_after: str | None = None,
        created_before: str | None = None,
        max_pages: int | None = DEFAULT_EVENT_MAX_PAGES,
    ) -> dict[str, Any]:
        """Run an events global search to completion (or `max_pages`) and
        return {"count", "items", "truncated"}."""
        query = self.build_events_query(
            query_type, keyword=keyword, domain=domain, email=email,
            query_string=query_string, username=username,
        )
        collected: list[dict] = []
        truncated = False
        for _page, items, next_cursor in self.iter_events(
            query, size=size, order=order, event_types=event_types, severity=severity,
            estimated_created_at_gte=created_after, estimated_created_at_lte=created_before,
            max_pages=max_pages,
        ):
            collected.extend(items)
            if next_cursor and max_pages is not None:
                truncated = True
        return {"count": len(collected), "items": collected, "truncated": truncated}

    # -----------------------------------------------------------------
    # Credentials global search — POST /firework/v4/credentials/global/_search
    # -----------------------------------------------------------------

    @staticmethod
    def build_credentials_query(
        query_type: str,
        domain: str | None = None,
        email: str | None = None,
        keyword: str | None = None,
        secret: str | None = None,
        auth_domain: str | None = None,
    ) -> dict[str, Any]:
        if query_type == "domain" and domain:
            return {"type": "domain", "fqdn": domain}
        if query_type == "email" and email:
            return {"type": "email", "email": email}
        if query_type == "keyword" and keyword:
            return {"type": "keyword", "keyword": keyword}
        if query_type == "secret" and secret:
            return {"type": "secret", "secret": secret}
        if query_type == "auth_domain" and auth_domain:
            return {"type": "auth_domain", "fqdn": auth_domain}
        raise FlareAPIError(
            f"Missing value for credentials query type '{query_type}'. "
            "Provide domain, email, keyword, secret, or auth_domain as appropriate."
        )

    def _search_credentials_page(
        self,
        query: dict[str, Any],
        size: int = DEFAULT_CRED_PAGE_SIZE,
        from_: str | None = None,
        order: str = "desc",
        imported_at_gte: str | None = None,
        imported_at_lte: str | None = None,
    ) -> tuple[list[dict], str | None]:
        url = f"{BASE_URL}/firework/v4/credentials/global/_search"
        payload: dict[str, Any] = {
            "query": query,
            "size": min(size, MAX_CRED_PAGE_SIZE),
            "order": order,
        }
        if from_:
            payload["from"] = from_
        if imported_at_gte is not None or imported_at_lte is not None:
            payload["filters"] = {
                "imported_at": {
                    **({"gte": imported_at_gte} if imported_at_gte else {}),
                    **({"lte": imported_at_lte} if imported_at_lte else {}),
                }
            }

        data = self._post(url, payload)
        items = data.get("items") or []
        next_cursor = data.get("next")
        return items, next_cursor

    def iter_credentials(
        self,
        query: dict[str, Any],
        size: int = DEFAULT_CRED_PAGE_SIZE,
        order: str = "desc",
        imported_at_gte: str | None = None,
        imported_at_lte: str | None = None,
        max_pages: int | None = DEFAULT_CRED_MAX_PAGES,
    ) -> Iterator[tuple[int, list[dict], str | None]]:
        from_ = None
        page = 0
        while True:
            if max_pages is not None and page >= max_pages:
                break
            page += 1
            items, next_cursor = self._search_credentials_page(
                query, size=size, from_=from_, order=order,
                imported_at_gte=imported_at_gte, imported_at_lte=imported_at_lte,
            )
            yield page, items, next_cursor
            if not next_cursor:
                break
            from_ = next_cursor
            time.sleep(1)  # rate limit: avoid 429 from Flare API

    def search_credentials(
        self,
        query_type: str,
        *,
        domain: str | None = None,
        email: str | None = None,
        keyword: str | None = None,
        secret: str | None = None,
        auth_domain: str | None = None,
        size: int = DEFAULT_CRED_PAGE_SIZE,
        order: str = "desc",
        imported_after: str | None = None,
        imported_before: str | None = None,
        max_pages: int | None = DEFAULT_CRED_MAX_PAGES,
    ) -> dict[str, Any]:
        """Run a credentials global search to completion (or `max_pages`) and
        return {"count", "items", "truncated"}."""
        query = self.build_credentials_query(
            query_type, domain=domain, email=email, keyword=keyword,
            secret=secret, auth_domain=auth_domain,
        )
        collected: list[dict] = []
        truncated = False
        for _page, items, next_cursor in self.iter_credentials(
            query, size=size, order=order,
            imported_at_gte=imported_after, imported_at_lte=imported_before,
            max_pages=max_pages,
        ):
            collected.extend(items)
            if next_cursor and max_pages is not None:
                truncated = True
        return {"count": len(collected), "items": collected, "truncated": truncated}

    # -----------------------------------------------------------------
    # Unified lookup — the one method your Django view needs to call
    # -----------------------------------------------------------------

    def lookup(
        self,
        indicator_type: str,
        value: str,
        *,
        search_events: bool = True,
        search_credentials: bool = True,
        event_max_pages: int | None = DEFAULT_EVENT_MAX_PAGES,
        cred_max_pages: int | None = DEFAULT_CRED_MAX_PAGES,
    ) -> dict[str, Any]:
        """Look up a single indicator across Flare events + credentials.

        indicator_type: one of "domain", "email", "keyword", "auth_domain"
            — exactly the query types Flare's credentials global search
            natively supports. See the module docstring for what each
            means in a "find leaked creds for my company" workflow.
        value: the indicator itself, e.g. "example.com", "user@example.com",
               "jsmith", "login.example.com".

        Indicator type mapping
        -----------------------------------------------------------
        Credentials search: query_type == indicator_type, 1:1 — Flare
        supports all four natively there.

        Events search has no "auth_domain" query type, so auth_domain
        is approximated there as a plain domain (fqdn) search on the
        same value; domain/email/keyword map 1:1 as well.

        Returns a JSON-serializable dict:
            {
              "indicator_type": ..., "value": ...,
              "events": {"count", "items", "truncated"},
              "credentials": {"count", "items", "truncated"},
            }
        Either "events" or "credentials" is omitted if its
        corresponding search_events/search_credentials flag is False.
        A sub-search that raises FlareAPIError is captured per-branch
        as {"count": 0, "items": [], "truncated": False, "error": "..."}
        rather than aborting the whole lookup.
        """
        indicator_type = indicator_type.strip().lower()
        if indicator_type not in VALID_INDICATOR_TYPES:
            raise FlareAPIError(
                f"Unknown indicator_type {indicator_type!r}; expected one of {sorted(VALID_INDICATOR_TYPES)}."
            )
        value = value.strip()
        if not value:
            raise FlareAPIError("value must not be empty.")

        result: dict[str, Any] = {"indicator_type": indicator_type, "value": value}

        if search_events:
            result["events"] = self._lookup_events_for_indicator(
                indicator_type, value, max_pages=event_max_pages
            )
        if search_credentials:
            result["credentials"] = self._lookup_credentials_for_indicator(
                indicator_type, value, max_pages=cred_max_pages
            )
        return result

    def _lookup_events_for_indicator(
        self, indicator_type: str, value: str, *, max_pages: int | None
    ) -> dict[str, Any]:
        # Events has no auth_domain query type; approximate it as a
        # plain domain search on the same value.
        events_query_type = "domain" if indicator_type == "auth_domain" else indicator_type
        kwarg_name = "domain" if indicator_type == "auth_domain" else indicator_type
        try:
            return self.search_events(
                events_query_type, max_pages=max_pages, **{kwarg_name: value}
            )
        except FlareAPIError as exc:
            return {"count": 0, "items": [], "truncated": False, "error": str(exc)}

    def _lookup_credentials_for_indicator(
        self, indicator_type: str, value: str, *, max_pages: int | None
    ) -> dict[str, Any]:
        # Credentials search supports domain/email/keyword/auth_domain
        # natively, 1:1 with indicator_type.
        try:
            return self.search_credentials(
                indicator_type, max_pages=max_pages, **{indicator_type: value}
            )
        except FlareAPIError as exc:
            return {"count": 0, "items": [], "truncated": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# Optional export helpers (ported as plain functions; useful if your Django
# app offers a "download results" button in addition to the JSON response)
# ---------------------------------------------------------------------------

def to_json(items: list[dict]) -> str:
    """Serialize a list of result items to a formatted JSON string."""
    return json.dumps(items, indent=2, default=str)


def to_jsonl(items: list[dict]) -> str:
    """Serialize a list of result items to newline-delimited JSON."""
    return "\n".join(json.dumps(item, default=str) for item in items)


def credential_to_csv_row(c: dict) -> dict[str, str]:
    """Flatten one credential record for CSV export."""
    source = c.get("source") or {}
    return {
        "imported_at": (c.get("imported_at") or ""),
        "indicator_of_identity": (c.get("identity_name") or ""),
        "domain": (c.get("domain") or ""),
        "hash": (c.get("hash") or ""),
        "hash_type": (c.get("hash_type") or ""),
        "source": (source.get("name") or c.get("source_id") or ""),
        "source_id": (c.get("source_id") or ""),
        "id": str(c.get("id") or ""),
    }


def event_to_csv_row(ev: dict) -> dict[str, str]:
    """Flatten one event record for CSV export."""
    meta = ev.get("metadata") or {}
    return {
        "uid": meta.get("uid", ""),
        "type": meta.get("type", ""),
        "estimated_created_at": meta.get("estimated_created_at", ""),
        "matched_at": meta.get("matched_at", ""),
        "severity": meta.get("severity", ""),
    }


def credentials_to_csv(items: list[dict]) -> str:
    """Serialize credential records to a CSV string."""
    fieldnames = ["imported_at", "indicator_of_identity", "domain", "hash", "hash_type",
                  "source", "source_id", "id"]
    return _rows_to_csv(fieldnames, (credential_to_csv_row(c) for c in items))


def events_to_csv(items: list[dict]) -> str:
    """Serialize event records to a CSV string."""
    fieldnames = ["uid", "type", "estimated_created_at", "matched_at", "severity"]
    return _rows_to_csv(fieldnames, (event_to_csv_row(e) for e in items))


def _rows_to_csv(fieldnames: list[str], rows: Iterator[dict[str, str]]) -> str:
    import io
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fieldnames)
    w.writeheader()
    w.writerows(rows)
    return buf.getvalue()
