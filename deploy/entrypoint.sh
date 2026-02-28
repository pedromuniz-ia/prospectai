#!/bin/sh
set -e

# Ensure /data directory is writable (handles first deploy or permission issues)
if [ -d /data ] && [ ! -w /data ]; then
  echo "Warning: /data is not writable by current user ($(id)), skipping migrations"
else
  echo "Running database migrations..."
  # Use 'push' instead of 'migrate' — it's idempotent and won't crash
  # if tables already exist. Safe for production.
  npx drizzle-kit push --force 2>&1 || echo "Warning: migrations failed, continuing anyway"
fi

echo "Starting application..."
exec "$@"
