"""
Thin wrapper around the Plaid Python SDK.

Everything here talks to Plaid, never to a bank directly. The bank-auth step
(username/password/MFA) happens entirely inside Plaid Link, in the mobile
app's webview — this backend receives only a `public_token` (exchanged for a
long-lived `access_token`) and never sees a bank credential.

Docs: https://plaid.com/docs/api/
"""
from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import json

import jwt as pyjwt
import plaid
from django.conf import settings
from django.core.cache import cache
from plaid.api import plaid_api
from plaid.model.country_code import CountryCode
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.products import Products
from plaid.model.statements_list_request import StatementsListRequest
from plaid.model.statements_download_request import StatementsDownloadRequest
from plaid.model.webhook_verification_key_get_request import WebhookVerificationKeyGetRequest

_ENV_HOSTS = {
    "sandbox": plaid.Environment.Sandbox,
    "development": plaid.Environment.Development,
    "production": plaid.Environment.Production,
}


def _client() -> plaid_api.PlaidApi:
    configuration = plaid.Configuration(
        host=_ENV_HOSTS[settings.PLAID_ENV],
        api_key={
            "clientId": settings.PLAID_CLIENT_ID,
            "secret": settings.PLAID_SECRET,
        },
    )
    return plaid_api.PlaidApi(plaid.ApiClient(configuration))


def create_link_token(*, user_id: str, organization_name: str) -> str:
    """Create a short-lived link_token the mobile app uses to open Plaid Link."""
    request = LinkTokenCreateRequest(
        user=LinkTokenCreateRequestUser(client_user_id=user_id),
        client_name=organization_name or "Bank Statement Sync",
        products=[Products("transactions"), Products("statements")],
        country_codes=[CountryCode("US")],
        language="en",
        webhook=settings.PLAID_WEBHOOK_URL or None,
    )
    response = _client().link_token_create(request)
    return response.link_token


def exchange_public_token(public_token: str) -> dict:
    """Exchange a Link public_token for a persistent access_token + item_id."""
    request = ItemPublicTokenExchangeRequest(public_token=public_token)
    response = _client().item_public_token_exchange(request)
    return {"access_token": response.access_token, "item_id": response.item_id}


def get_accounts(access_token: str) -> list[dict]:
    from plaid.model.accounts_get_request import AccountsGetRequest

    response = _client().accounts_get(AccountsGetRequest(access_token=access_token))
    return [account.to_dict() for account in response.accounts]


def list_available_statements(access_token: str, lookback_days: int | None = None) -> list[dict]:
    """
    List statements Plaid has available for this item.

    `lookback_days` defaults to settings.STATEMENT_SYNC_LOOKBACK_DAYS (45) so a
    routine sync only looks at recently-issued statements rather than a full
    history re-scan every run.
    """
    lookback_days = lookback_days or settings.STATEMENT_SYNC_LOOKBACK_DAYS
    request = StatementsListRequest(access_token=access_token)
    response = _client().statements_list(request)
    cutoff = dt.date.today() - dt.timedelta(days=lookback_days)
    statements = []
    for account in response.accounts:
        for statement in account.statements:
            if statement.end_date and statement.end_date < cutoff:
                continue
            statements.append(
                {
                    "account_id": account.account_id,
                    "statement_id": statement.statement_id,
                    "start_date": statement.start_date,
                    "end_date": statement.end_date,
                }
            )
    return statements


def download_statement_pdf(access_token: str, statement_id: str) -> bytes:
    request = StatementsDownloadRequest(access_token=access_token, statement_id=statement_id)
    response = _client().statements_download(request)
    # The generated client exposes the raw response body for binary endpoints.
    return response.read()


_WEBHOOK_KEY_CACHE_PREFIX = "plaid_webhook_key:"
_WEBHOOK_KEY_CACHE_TTL = 60 * 60 * 24  # Plaid recommends caching a verification key up to 24h
_WEBHOOK_MAX_AGE_SECONDS = 300  # Plaid's own recommended replay window


def _get_webhook_verification_key(key_id: str) -> dict | None:
    cache_key = f"{_WEBHOOK_KEY_CACHE_PREFIX}{key_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    response = _client().webhook_verification_key_get(WebhookVerificationKeyGetRequest(key_id=key_id))
    key = response.key.to_dict()
    cache.set(cache_key, key, _WEBHOOK_KEY_CACHE_TTL)
    return key


def verify_webhook(raw_body: bytes, signed_jwt: str | None) -> bool:
    """
    Verify a Plaid webhook's `Plaid-Verification` header JWT against the raw
    request body, per
    https://plaid.com/docs/api/webhooks/webhook-verification/

    Never raises — any malformed/untrusted input just returns False, which
    the caller should treat as "reject this webhook".
    """
    if not signed_jwt:
        return False
    try:
        header = pyjwt.get_unverified_header(signed_jwt)
    except pyjwt.InvalidTokenError:
        return False

    key_id = header.get("kid")
    if not key_id:
        return False

    key_dict = _get_webhook_verification_key(key_id)
    if not key_dict or key_dict.get("expired_at"):
        return False

    try:
        public_key = pyjwt.algorithms.ECAlgorithm.from_jwk(json.dumps(key_dict))
        claims = pyjwt.decode(signed_jwt, key=public_key, algorithms=["ES256"])
    except pyjwt.InvalidTokenError:
        return False

    issued_at = claims.get("iat", 0)
    now = dt.datetime.now(dt.timezone.utc).timestamp()
    if issued_at < now - _WEBHOOK_MAX_AGE_SECONDS:
        return False

    body_hash = hashlib.sha256(raw_body).hexdigest()
    return hmac.compare_digest(body_hash, claims.get("request_body_sha256", ""))
