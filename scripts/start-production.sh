#!/bin/sh
set -eu

secrets_dir=${SECRETS_DIRECTORY:-/run/secrets}
postgres_password=$(cat "$secrets_dir/postgres_password")
export AUTH_SECRET=$(cat "$secrets_dir/auth_secret")
export DATABASE_URL="postgresql://postgres:${postgres_password}@db:5432/seanblog_frame?schema=public"

if [ ! -s ./themes/default/theme.css ]; then
  mkdir -p ./themes/default
  cp ./theme-seed/default/theme.css ./themes/default/theme.css
fi

npx prisma migrate deploy
node scripts/initialize-admin.mjs
node scripts/initialize-content.mjs
exec node server.js
