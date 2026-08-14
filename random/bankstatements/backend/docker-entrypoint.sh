#!/bin/sh
set -e

echo "Waiting for MySQL at ${MYSQL_HOST:-db}:${MYSQL_PORT:-3306}..."
python - <<'PYEOF'
import os
import socket
import time

host = os.environ.get("MYSQL_HOST", "db")
port = int(os.environ.get("MYSQL_PORT", "3306"))

for _ in range(60):
    try:
        with socket.create_connection((host, port), timeout=2):
            break
    except OSError:
        time.sleep(1)
else:
    raise SystemExit(f"MySQL never became reachable at {host}:{port}")
PYEOF
echo "MySQL is reachable."

# Only one service (web, by default) should run migrations/collectstatic on
# boot — celery's compose entry sets RUN_MIGRATIONS=false so two containers
# don't race to apply migrations against the same database at once.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    python manage.py migrate --noinput

    # Optional: create a superuser on first boot if all three env vars are set.
    # Safe to leave unset — this is skipped silently otherwise.
    if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_EMAIL" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
        python manage.py createsuperuser --noinput || true
    fi

    python manage.py collectstatic --noinput
fi

exec "$@"
