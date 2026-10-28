#!/bin/sh
# Полная проверка проекта: то же, что делает CI (.github/workflows/ci.yml).
# Всё запускается в отдельном docker compose проекте «geroi-ci» на порту 8090,
# поэтому рабочий стенд на :8080 и его база не затрагиваются. В конце стенд удаляется.
#
#   sh scripts/ci.sh            # всё: типы, тесты API, тесты детектора, e2e
#   sh scripts/ci.sh e2e        # только сквозные тесты
set -eu
cd "$(dirname "$0")/.."

PROJECT=geroi-ci
export WEB_PORT="${WEB_PORT:-8090}"
COMPOSE="docker compose -p $PROJECT"
ONLY="${1:-all}"

cleanup() {
  echo "→ Убираем стенд $PROJECT"
  $COMPOSE --profile test down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

step() { printf '\n==== %s ====\n' "$1"; }

if [ "$ONLY" = all ]; then
  step "Проверка типов"
  npm run typecheck --silent

  step "Тесты фронтенда"
  npm test -w @heroes/web --silent

  step "Тесты API"
  $COMPOSE --profile test run --build --rm api-test

  step "Тесты сервиса подсчёта"
  $COMPOSE build detector
  $COMPOSE run --rm --no-deps detector pytest -q
fi

step "Сквозные тесты (Playwright) на http://localhost:$WEB_PORT"
$COMPOSE up -d --build db detector api web
printf 'Ждём, пока поднимется API'
i=0
until curl -sf "http://localhost:$WEB_PORT/api/health" >/dev/null; do
  i=$((i + 1))
  if [ $i -gt 90 ]; then echo; $COMPOSE logs api | tail -40; exit 1; fi
  printf '.'; sleep 2
done
echo
# Браузер: установленный Google Chrome, иначе Chromium от Playwright (скачивается один раз)
if [ -z "${PW_CHANNEL:-}" ]; then
  if [ -d "/Applications/Google Chrome.app" ] || command -v google-chrome >/dev/null 2>&1; then
    export PW_CHANNEL=chrome
  else
    npx playwright install chromium
  fi
fi
E2E_BASE_URL="http://localhost:$WEB_PORT" npm run e2e --silent

step "Всё зелёное"
