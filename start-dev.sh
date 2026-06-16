#!/usr/bin/env bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

COMPOSE_FILE="docker-compose.dev.yml"

# Base ports — override by exporting these before running if you want a different
# starting point. We walk upward from each until a free HOST port is found.
FRONTEND_BASE_PORT="${FRONTEND_HOST_PORT:-8080}"
BACKEND_BASE_PORT="${BACKEND_HOST_PORT:-4000}"
POSTGRES_BASE_PORT="${POSTGRES_HOST_PORT:-5432}"

# Make sure Docker is actually running before we go further.
if ! docker info >/dev/null 2>&1; then
  echo -e "${RED}Docker isn't running. Start Docker Desktop and try again.${NC}"
  exit 1
fi

# Dynamic HOST port selection — LOCAL DEV ONLY.
# Another project's container may already publish 8080/4000/5432, so we move to
# the next free port (8080→8081→…). This logic lives only here; container-internal
# ports stay fixed and Railway never runs this script, so deploys are unaffected.
port_in_use() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

find_free_port() {
  local port="$1"
  while port_in_use "$port"; do
    port=$((port + 1))
  done
  printf '%s' "$port"
}

FRONTEND_HOST_PORT="$(find_free_port "$FRONTEND_BASE_PORT")"
BACKEND_HOST_PORT="$(find_free_port "$BACKEND_BASE_PORT")"
POSTGRES_HOST_PORT="$(find_free_port "$POSTGRES_BASE_PORT")"
export FRONTEND_HOST_PORT BACKEND_HOST_PORT POSTGRES_HOST_PORT

echo ""
echo -e "${GREEN}╔══════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Solairus — Docker Dev Mode     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Frontend${NC} → http://localhost:${FRONTEND_HOST_PORT}"
echo -e "  ${CYAN}Backend${NC}  → http://localhost:${BACKEND_HOST_PORT}"
echo -e "  ${CYAN}Postgres${NC} → postgres://postgres:postgres@localhost:${POSTGRES_HOST_PORT}/solairus"
echo ""
if [ "$FRONTEND_HOST_PORT" != "$FRONTEND_BASE_PORT" ] \
  || [ "$BACKEND_HOST_PORT" != "$BACKEND_BASE_PORT" ] \
  || [ "$POSTGRES_HOST_PORT" != "$POSTGRES_BASE_PORT" ]; then
  echo -e "${YELLOW}(a default port was busy — switched to the next free one)${NC}"
  echo ""
fi
echo -e "  Hot reload is on for both services (source is mounted)."
echo -e "  Migrations run automatically on backend start."
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services.${NC}"
echo ""

# `docker compose up` already stops containers on Ctrl+C; this just prints a note.
cleanup() {
  echo ""
  echo -e "${YELLOW}Stopping containers… (use 'docker compose -f ${COMPOSE_FILE} down -v' to also drop volumes)${NC}"
}
trap cleanup INT TERM

# Build + run in the foreground so logs stream and Ctrl+C tears down cleanly.
docker compose -f "$COMPOSE_FILE" up --build
