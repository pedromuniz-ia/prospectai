#!/bin/sh
set -e

echo "Running database migrations..."
npx drizzle-kit migrate 2>&1 || echo "Warning: migrations failed, continuing anyway"

echo "Starting application..."
exec "$@"
