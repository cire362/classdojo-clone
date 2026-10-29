#!/bin/sh
# Новая миграция Prisma из изменений schema.prisma: разница между базой рабочего стенда
# (с уже применёнными миграциями) и схемой. База наружу не открыта, поэтому diff считается
# в контейнере API со смонтированной папкой prisma.
#
#   sh scripts/new-migration.sh parents   → apps/api/prisma/migrations/<время>_parents/migration.sql
set -eu
cd "$(dirname "$0")/.."
NAME="${1:?Укажите имя миграции, например: sh scripts/new-migration.sh parents}"
DIR="apps/api/prisma/migrations/$(date +%Y%m%d%H%M%S)_$NAME"
SQL=$(docker compose run --rm -T --no-deps -v "$PWD/apps/api/prisma:/app/apps/api/prisma" api \
  npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script 2>/dev/null)
if ! printf '%s' "$SQL" | grep -q '[A-Z]'; then echo "Изменений в схеме нет"; exit 1; fi
mkdir -p "$DIR"
printf '%s\n' "$SQL" | sed '/^Loaded Prisma config/d' > "$DIR/migration.sql"
echo "Создано: $DIR/migration.sql"
