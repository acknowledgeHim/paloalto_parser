# flare_lookup

A framework-agnostic Python client for the [Flare](https://api.docs.flare.io/)
threat-intel API, ported from the standalone
[flare-lookup-cli](https://github.com/l0lsec/flare-lookup-cli) tool. All
`typer`/`rich` CLI code has been stripped out — this is just a class
(`FlareClient`) you `import` and call, returning plain JSON-serializable
dicts. `flare_lookup.py` itself has no Django dependency; see
"Django integration" below for the view/urls/template wiring.

Purpose: automate looking for **leaked credentials tied to a company** —
by its email/identity domain, a specific employee's email, a known
username, or the domain credentials were used to log into.

## Install

```bash
pip install -r requirements.txt   # just `requests`
```

Copy `flare_lookup.py` into your Django project (e.g. as an app module or
a `libs/` package) and import it from your view.

## Usage

```python
from flare_lookup import FlareClient, FlareAPIError

client = FlareClient(api_key="...")   # or set FLARE_API_KEY env var

try:
    result = client.lookup("domain", "example.com")
except FlareAPIError as exc:
    ...  # exc.status_code, str(exc)
```

`indicator_type` is one of `"domain"`, `"email"`, `"keyword"`,
`"auth_domain"` — the four buttons in your Django UI. `result` looks like:

```json
{
  "indicator_type": "domain",
  "value": "example.com",
  "events": {"count": 12, "items": [...], "truncated": false},
  "credentials": {"count": 340, "items": [...], "truncated": true}
}
```

## Django integration

### API key: yes, put it in `settings.py`

Don't hardcode the key — load it from an environment variable in
`settings.py`, the same way you'd handle `SECRET_KEY` or a DB password.
`FlareClient` will happily take it either as a constructor argument or
via the `FLARE_API_KEY` env var directly; going through `settings.py` is
the standard Django way and lets you keep per-environment `.env` files:

```python
# settings.py
import os

FLARE_API_KEY = os.environ["FLARE_API_KEY"]   # set in your .env / secrets manager
```

```bash
# .env (don't commit this)
FLARE_API_KEY=your-flare-api-key-here
```

### View

One endpoint, driven by a `type` + `value` query param — this is what
your button/form posts to:

```python
# views.py
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from flare_lookup import FlareClient, FlareAPIError

@require_GET
def flare_lookup_view(request):
    indicator_type = request.GET.get("type", "")
    value = request.GET.get("value", "")
    if indicator_type not in {"domain", "email", "keyword", "auth_domain"}:
        return JsonResponse({"error": "invalid type"}, status=400)
    if not value:
        return JsonResponse({"error": "value is required"}, status=400)

    client = FlareClient(api_key=settings.FLARE_API_KEY)
    try:
        return JsonResponse(client.lookup(indicator_type, value))
    except FlareAPIError as exc:
        return JsonResponse({"error": str(exc)}, status=exc.status_code or 502)
```

```python
# urls.py
from django.urls import path
from . import views

urlpatterns = [
    path("flare-lookup/", views.flare_lookup_view, name="flare_lookup"),
]
```

### Template / button

The four buttons just need to set `type` and call the endpoint — e.g.
with a small fetch call:

```html
<select id="flare-type">
  <option value="domain">Domain</option>
  <option value="email">Email</option>
  <option value="keyword">Username</option>
  <option value="auth_domain">Auth Domain</option>
</select>
<input id="flare-value" placeholder="example.com">
<button onclick="runFlareLookup()">Search Flare</button>
<pre id="flare-results"></pre>

<script>
async function runFlareLookup() {
  const type = document.getElementById("flare-type").value;
  const value = document.getElementById("flare-value").value;
  const resp = await fetch(`/flare-lookup/?type=${encodeURIComponent(type)}&value=${encodeURIComponent(value)}`);
  document.getElementById("flare-results").textContent = JSON.stringify(await resp.json(), null, 2);
}
</script>
```

Swap the `<pre>` dump for however you actually want to render
`events`/`credentials` in your UI — the endpoint above is the only piece
that's Flare-specific; everything else is plain Django.

### Don't block the request on big pulls

`client.lookup()` defaults to small page caps precisely so the view above
stays synchronous-request-friendly (see "Keeping the Django
request/response cycle fast" below). If you later want exhaustive pulls,
move the call into a Celery task / background thread and have the view
kick off the job instead of calling `lookup()` inline.

## Why these four, and not IP/URL

The original CLI (and Flare's API itself) never supported "ip" or "url" as
query types — that was a wrong assumption in an earlier draft of this
module. Flare's credentials global search endpoint natively supports
exactly four query types, and this client mirrors them 1:1:

| indicator_type | meaning | credentials search | events search |
|---|---|---|---|
| `domain` | company's email/identity domain (e.g. `example.com`) | `query_type=domain` | `query_type=domain` |
| `email` | a specific person's email address | `query_type=email` | `query_type=email` |
| `keyword` | username portion of an identity (no `@domain`) | `query_type=keyword` | `query_type=keyword` |
| `auth_domain` | domain the credential was used to log into (e.g. an SSO/portal hostname, can differ from the email domain) | `query_type=auth_domain` | approximated as `query_type=domain` (events has no `auth_domain` type) |

There's no free-text or IP concept anywhere in the Flare credentials API,
so an "ip"/"url" button wouldn't return anything meaningful for a
credentials hunt — `lookup()` rejects anything outside these four with a
`FlareAPIError`.

## Keeping the Django request/response cycle fast

Flare pagination can run long (events cap at 10/page; credentials at
10,000/page but with unbounded `next` cursors). `lookup()` defaults to
`event_max_pages=5` (≤50 events) and `cred_max_pages=1` (≤10,000
credentials) to stay responsive for a synchronous "click a button" flow.
When a page is truncated, the corresponding `truncated` field is `true` so
you can surface "more results available" in the UI.

For exhaustive pulls, pass `event_max_pages=None` / `cred_max_pages=None`
and run the call from a background task (Celery, `django-rq`, a thread) —
not directly inside the request handler.

## Lower-level calls

If you need more control than `lookup()` gives you (e.g. custom filters,
date ranges, severity, event types, or the `secret` credentials query type
that isn't exposed as a lookup button), call `search_events()` /
`search_credentials()` directly — they mirror the original CLI's options
almost 1:1:

```python
client.search_events(
    "domain", domain="example.com",
    event_types=["paste", "stealer_log"], severity="high",
    created_after="2025-01-01T00:00:00Z",
    max_pages=None,
)

client.search_credentials(
    "email", email="a@b.com",
    imported_after="2025-01-01T00:00:00Z",
    max_pages=None,
)

# secret isn't one of the four lookup() buttons, but is still available:
client.search_credentials("secret", secret="hunter2", max_pages=None)
```

Both return `{"count", "items", "truncated"}`.

## Optional export helpers

`to_json()`, `to_jsonl()`, `credentials_to_csv()`, and `events_to_csv()`
are ported straight from the original CLI's export logic, as plain
string-returning functions, in case you want a "download results" button
alongside the JSON API response.
