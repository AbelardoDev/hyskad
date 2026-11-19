#!/usr/bin/env bash
# Backup de la base de datos de producción (F13, RNF Disponibilidad, CP-66).
# Cron diario a las 2:00 (hora del servidor, America/Bogota), instalado por setup-vps.sh:
#   0 2 * * * /opt/hyskad/backup-db.sh >> /opt/hyskad/backups/backup.log 2>&1
# También lo corre el pipeline antes de cada despliegue.
#
# Deja /opt/hyskad/backups/hyskad-AAAAMMDD-HHMMSS.sql.gz, verifica que el archivo sea válido y
# borra los de más de RETENCION_DIAS (30 por defecto). RPO ≤ 24 h.
set -euo pipefail
cd "$(dirname "$0")"

DESTINO="${DESTINO:-$(pwd)/backups}"
RETENCION_DIAS="${RETENCION_DIAS:-30}"
mkdir -p "$DESTINO"
chmod 700 "$DESTINO"

marca=$(date +%Y%m%d-%H%M%S)
archivo="$DESTINO/hyskad-$marca.sql.gz"
parcial="$archivo.parcial"
inicio=$(date +%s)

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }
fallo() { rm -f "$parcial"; log "ERROR: $*"; exit 1; }
trap 'fallo "backup interrumpido (línea $LINENO)"' ERR

# La contraseña se lee dentro del contenedor: no aparece en la línea de comandos ni en el log
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -u root --single-transaction --routines --triggers --events --set-gtid-purged=OFF --databases hyskad' \
  | gzip -9 > "$parcial"

gzip -t "$parcial" || fallo "el archivo comprimido está dañado"
zcat "$parcial" | tail -n 1 | grep -q "Dump completed" || fallo "el volcado no terminó (falta 'Dump completed')"

mv "$parcial" "$archivo"
chmod 600 "$archivo"
trap - ERR

borrados=$(find "$DESTINO" -name 'hyskad-*.sql.gz' -mtime +"$RETENCION_DIAS" -print -delete | wc -l)
log "OK $(basename "$archivo") $(du -h "$archivo" | cut -f1) en $(( $(date +%s) - inicio )) s; borrados $borrados de más de $RETENCION_DIAS días"
