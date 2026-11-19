#!/usr/bin/env bash
# Restaura un backup de backup-db.sh (F13, CP-66). Pide confirmación escrita.
#   ./restore-db.sh backups/hyskad-20261201-020000.sql.gz
#       Reemplaza la base de producción "hyskad": detiene el backend, borra la base, la recrea
#       desde el backup y vuelve a arrancar el backend (Flyway valida el esquema al arrancar).
#   ./restore-db.sh backups/hyskad-20261201-020000.sql.gz --en hyskad_prueba
#       Restaura en otra base (limpia) sin tocar producción: para la prueba de restauración (RTO).
set -euo pipefail
cd "$(dirname "$0")"

archivo="${1:-}"
destino="hyskad"
if [ "${2:-}" = "--en" ]; then
  destino="${3:?Indique el nombre de la base después de --en}"
fi
[ -n "$archivo" ] && [ -f "$archivo" ] || { echo "Uso: $0 <backup.sql.gz> [--en <base>]" >&2; exit 2; }
[[ "$destino" =~ ^[a-z_][a-z0-9_]*$ ]] || { echo "Nombre de base inválido: $destino" >&2; exit 2; }
gzip -t "$archivo" || { echo "El backup está dañado: $archivo" >&2; exit 1; }

echo "Se restaurará $(basename "$archivo") en la base \"$destino\"."
if [ "$destino" = "hyskad" ]; then
  echo "ATENCIÓN: se borrarán los datos actuales de producción y el sistema quedará fuera de servicio unos minutos."
fi
read -r -p "Escriba RESTAURAR para continuar: " respuesta
[ "$respuesta" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }

inicio=$(date +%s)
mysql_root() {
  docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -u root "$@"' -- "$@"
}

if [ "$destino" = "hyskad" ]; then
  echo "==> Deteniendo el backend"
  docker compose stop backend
  mysql_root -e "DROP DATABASE IF EXISTS hyskad; CREATE DATABASE hyskad CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
  echo "==> Restaurando"
  zcat "$archivo" | mysql_root
  # El usuario de la aplicación conserva sus permisos (se otorgan sobre hyskad.*)
  echo "==> Arrancando el backend"
  docker compose start backend
else
  mysql_root -e "DROP DATABASE IF EXISTS \`$destino\`; CREATE DATABASE \`$destino\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
  echo "==> Restaurando en $destino"
  # El backup trae "CREATE DATABASE hyskad; USE hyskad": se redirige a la base de destino
  zcat "$archivo" | sed -e '/^CREATE DATABASE/d' -e "s/^USE \`hyskad\`;/USE \`$destino\`;/" | mysql_root
fi

echo "Restauración terminada en $(( $(date +%s) - inicio )) s."
mysql_root -N -e "SELECT CONCAT('Tablas: ', COUNT(*)) FROM information_schema.tables WHERE table_schema = '$destino';
                  SELECT CONCAT('Migraciones Flyway: ', COUNT(*)) FROM \`$destino\`.flyway_schema_history WHERE success = 1;"
