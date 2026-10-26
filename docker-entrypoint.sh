#!/bin/sh
set -eu

if [ -z "${STAFF_KEY:-}" ] || [ "$STAFF_KEY" = "demo-staff" ] || [ "$STAFF_KEY" = "change-this-before-deploying" ]; then
  echo "Set a private STAFF_KEY in Coolify runtime environment variables." >&2
  exit 1
fi
case "${APP_URL:-}" in
  https://*|http://*) ;;
  *) echo "Set APP_URL to the public application URL, e.g. https://formula.example.com (without a trailing slash)." >&2; exit 1 ;;
esac
if [ ! -w /data ]; then
  echo "/data must be writable by UID/GID 1000:1000. Use a named Docker volume or adjust the bind-mount ownership." >&2
  exit 1
fi

# Ensure the SQLite file exists before Prisma schema initialization.
touch /data/demo.db
# Suitable for this demo's additive schema setup. Deliberately do not pass
# --accept-data-loss; a destructive schema change must be handled manually.
./node_modules/.bin/prisma db push --skip-generate
# Idempotent: initializes the catalog without overwriting it. Includes the
# original fictional customer when the database has no customers.
node prisma/seed.js
exec "$@"
