#!/usr/bin/env bash
# Despliega una versión en el VPS (F13). Lo corre el pipeline por SSH; también sirve a mano.
#   ./desplegar.sh v1.2.0        backup, cambia HYSKAD_VERSION, pull, up y espera al backend sano
#   ./desplegar.sh --revertir    vuelve a la versión anterior al último despliegue
# Si el backend no queda "healthy" en 4 minutos, revierte solo y termina con error.
set -euo pipefail
cd "$(dirname "$0")"

ESPERA_MAX=240
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

version_actual() { grep -E '^HYSKAD_VERSION=' .env | cut -d= -f2- || true; }
fijar_version() {
  if grep -qE '^HYSKAD_VERSION=' .env; then
    sed -i "s/^HYSKAD_VERSION=.*/HYSKAD_VERSION=$1/" .env
  else
    echo "HYSKAD_VERSION=$1" >> .env
  fi
}

esperar_backend() {
  local id estado t=0
  id=$(docker compose ps -q backend)
  while [ $t -lt $ESPERA_MAX ]; do
    estado=$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null || echo "sin-contenedor")
    [ "$estado" = "healthy" ] && { log "backend healthy en ${t} s"; return 0; }
    [ "$estado" = "unhealthy" ] && break
    sleep 5; t=$((t + 5))
  done
  log "el backend no quedó healthy (estado: ${estado:-?})"
  docker compose logs --tail 80 backend || true
  return 1
}

subir() {
  docker compose pull --quiet
  docker compose up -d --remove-orphans
  esperar_backend
}

if [ "${1:-}" = "--revertir" ]; then
  anterior=$(cat .version-anterior 2>/dev/null || true)
  [ -n "$anterior" ] || { log "no hay versión anterior registrada"; exit 1; }
  log "revirtiendo a $anterior"
  fijar_version "$anterior"
  subir
  exit $?
fi

nueva="${1:?Uso: $0 <versión> | --revertir}"
[[ "$nueva" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$|^latest$ ]] || { log "versión inválida: $nueva"; exit 2; }

actual=$(version_actual)
log "desplegando $nueva (actual: ${actual:-ninguna})"

# Backup antes de las migraciones de Flyway (solo si la base ya está corriendo)
if [ -n "$(docker compose ps -q mysql 2>/dev/null)" ]; then
  mkdir -p backups
  ./backup-db.sh | tee -a backups/backup.log
fi

echo "${actual:-latest}" > .version-anterior
fijar_version "$nueva"

if ! subir; then
  if [ -n "$actual" ] && [ "$actual" != "$nueva" ]; then
    log "falló el despliegue; revirtiendo a $actual"
    fijar_version "$actual"
    subir || log "ATENCIÓN: también falló la reversión"
  fi
  exit 1
fi
docker image prune -f --filter "until=168h" >/dev/null
log "desplegada $nueva"
