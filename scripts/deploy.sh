#!/usr/bin/env bash
# Production update: backup DB -> pull -> install -> migrate -> build -> reload.
# Run on the server as the site user, from the project directory:  bash scripts/deploy.sh [branch]
set -euo pipefail

BRANCH="${1:-main}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
cd "$APP_DIR"

[ -f .env ] || { echo "✖ .env missing in $APP_DIR"; exit 1; }
# shellcheck disable=SC1091
set -a; . ./.env; set +a

echo "▶ 1/6 Database backup"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
node -e '
  const u = new URL(process.env.DATABASE_URL);
  console.log([u.hostname, u.port || "3306", decodeURIComponent(u.username), decodeURIComponent(u.password), u.pathname.slice(1)].join("\n"))
' | {
  read -r DB_HOST; read -r DB_PORT; read -r DB_USER; read -r DB_PASS; read -r DB_NAME
  MYSQL_PWD="$DB_PASS" mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" --single-transaction --routines --no-tablespaces "$DB_NAME" \
    | gzip > "$BACKUP_DIR/texonpos-$STAMP.sql.gz"
}
echo "  saved $BACKUP_DIR/texonpos-$STAMP.sql.gz"
ls -1t "$BACKUP_DIR"/texonpos-*.sql.gz | tail -n +15 | xargs -r rm -f   # keep the latest 14

echo "▶ 2/6 Pull $BRANCH"
PREV="$(git rev-parse --short HEAD)"
git fetch --prune origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
echo "  $PREV -> $(git rev-parse --short HEAD)"

echo "▶ 3/6 Install dependencies"
yarn install --frozen-lockfile

echo "▶ 4/6 Apply database migrations"
npx prisma migrate status || true
yarn db:deploy

echo "▶ 5/6 Build"
yarn build

echo "▶ 6/6 Reload app"
pm2 reload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs
pm2 save

sleep 3
if curl -fsS "http://127.0.0.1:3000/api/health" >/dev/null; then
  echo "✔ Deployed $(git rev-parse --short HEAD) — health check OK"
else
  echo "✖ Health check failed. Logs: pm2 logs texonpos --lines 100"
  echo "  Roll back code: git checkout $PREV && yarn install --frozen-lockfile && yarn build && pm2 reload texonpos"
  exit 1
fi
