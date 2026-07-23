#!/bin/sh
set -eu

secrets_dir=${SECRETS_DIRECTORY:-/run/secrets}
postgres_password=$(cat "$secrets_dir/postgres_password")
export AUTH_SECRET=$(cat "$secrets_dir/auth_secret")
export DATABASE_URL="postgresql://postgres:${postgres_password}@db:5432/seanblog_frame?schema=public"

npx prisma migrate deploy
node scripts/initialize-admin.mjs
exec node server.js
