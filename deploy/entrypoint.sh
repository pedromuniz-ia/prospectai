#!/bin/sh
set -e

# Only run migrations if we are in the APP container (not worker)
# and if /data is writable.
if [ "$RUN_MIGRATIONS" = "true" ]; then
  if [ -d /data ] && [ ! -w /data ]; then
    echo "Warning: /data is not writable by current user ($(id)), skipping migrations"
  else
    echo "Running database migrations..."
    # Use 'push' instead of 'migrate' — it's idempotent
    npx drizzle-kit push --force 2>&1 || echo "Warning: migrations failed, continuing anyway"
  fi
else
  echo "Skipping migrations (not an app container)"
fi

echo "Starting application..."
exec "$@"
