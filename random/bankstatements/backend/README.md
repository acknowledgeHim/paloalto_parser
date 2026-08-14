# Backend — Django API

Django + DRF API that:

- Issues JWTs for the mobile app to authenticate
- Creates Plaid `link_token`s and exchanges `public_token`s (bank auth happens
  entirely inside Plaid Link — this backend never receives a bank
  username/password)
- Syncs statements automatically via Plaid's Statements product (Celery task,
  scheduled + webhook-triggered)
- Accepts manually-uploaded check images (`POST /api/check-images/`) — this is
  the only path check images enter the system; see the root README for why.

## First-time setup

Everything Django-related — installing dependencies, running migrations,
collecting static files, the app server, Celery — runs **inside Docker**.
You don't need Python or a virtualenv on your host at all, just Docker.

`docker-compose up` brings up five containers: `db` (MySQL), `redis`, `web`
(Django under **gunicorn**), `celery-worker` (runs the actual sync jobs —
`banking/tasks.py`), and `celery-beat` (schedules them; see `docker-compose.yml`
for why beat is its own process rather than bundled into the worker). A
`docker-compose.override.yml` is auto-loaded on top of that and swaps `web`
back to Django's autoreloading dev server, so local edits show up without a
rebuild — see that file if you want the gunicorn-only stack instead.

```bash
cd backend
cp .env.example .env
# Fill in:
#   - a real DJANGO_SECRET_KEY
#   - a real FIELD_ENCRYPTION_KEY (generate one without installing anything
#     locally — run it inside a throwaway container):
docker run --rm python:3.12-slim python -c "import secrets,base64; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
#   - PLAID_CLIENT_ID / PLAID_SECRET from https://dashboard.plaid.com
#     (sign up, stay in "sandbox" mode — it's free and uses fake test banks)
#   - optionally DJANGO_SUPERUSER_USERNAME/EMAIL/PASSWORD to get an admin
#     account created automatically on first boot

docker-compose up --build
```

That's it — migrations, `collectstatic`, and (if you set the env vars) the
superuser are all applied automatically by `docker-entrypoint.sh` before the
server starts. For any one-off management command afterwards:

```bash
docker-compose exec web python manage.py <command>   # e.g. createsuperuser, shell
docker-compose exec web python manage.py test        # run the test suite
```

Django admin: http://localhost:8000/admin/
API root: http://localhost:8000/api/

## Testing the Plaid flow before touching a real bank

Plaid Sandbox gives you fake institutions with fake logins (e.g. username
`user_good` / password `pass_good`) so you can exercise the entire
Link → exchange → account sync → statement sync pipeline with zero risk before
ever pointing this at a real credit union. Do this first:

1. `POST /api/plaid/link-token/` with a JWT + `organization_id`
2. Feed the returned `link_token` into Plaid Link (sandbox mode) from the
   mobile app, or Plaid's [Link Sandbox testing docs] to get a `public_token`
   without the app at all
3. `POST /api/plaid/exchange/` with that `public_token`
4. Check `GET /api/accounts/?organization_id=...` and, once `celery-worker`
   has run the sync task, `GET /api/statements/?account_id=...`

[Link Sandbox testing docs]: https://plaid.com/docs/sandbox/

## Scheduling the periodic sync

`django-celery-beat` is installed so you can schedule `banking.tasks.sync_all_items`
from the Django admin (Periodic Tasks) once containers are running — e.g.
every 6 hours — rather than hardcoding a schedule in code.

## Notes on what's *not* here

- No code anywhere logs into a bank's website directly or stores a bank
  password. The only secret persisted is a Plaid `access_token`
  (`banking.models.PlaidItem.access_token`), encrypted at rest.
- Check images are received only via authenticated multipart upload from a
  human, never scraped. If a specific institution turns out to expose an
  official document/treasury API for check images, that would be a new
  `banking/<bank>_client.py`-style adapter added deliberately for that one
  institution — not a generic scraper.
