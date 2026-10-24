#!/bin/sh
# OpenMusic self-hosted update (docs/08_SELF_HOSTING.md §9): backup, new images, restart.
#   ./update.sh          prebuilt images from GHCR (docker compose pull)
#   ./update.sh --build  build the images on this machine from the current checkout (git pull first)
set -eu
cd "$(dirname "$0")"

echo "== 1/4 backup of the database"
docker compose --profile backup run --rm backup now

echo "== 2/4 new images"
if [ "${1:-}" = "--build" ]; then
  docker compose build
else
  docker compose pull
fi

echo "== 3/4 restart (migrations run when the API starts)"
docker compose up -d --remove-orphans
# Restart the backup profile too if it was running.
if [ -n "$(docker compose --profile backup ps -q backup 2>/dev/null)" ]; then
  docker compose --profile backup up -d backup
fi

echo "== 4/4 cleanup of old image layers"
docker image prune -f >/dev/null

docker compose ps
