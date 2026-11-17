#!/usr/bin/env bash
# F12 (OWASP A09): falla si un log del backend contiene datos sensibles. El CI lo corre sobre el log de
# la corrida E2E completa; sirve para cualquier log: bash infra/scripts/revisar-logs.sh backend.log
set -euo pipefail

LOG="${1:?Uso: revisar-logs.sh <archivo de log>}"
[ -f "$LOG" ] || { echo "No existe $LOG"; exit 2; }

declare -A PATRONES=(
  ["token JWT"]='eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}'
  ["cabecera Authorization"]='Bearer [A-Za-z0-9._-]{20,}'
  ["hash BCrypt"]='\$2[aby]\$1[0-9]\$[./A-Za-z0-9]{20,}'
  ["cookie de refresh"]='hk_refresh=[A-Za-z0-9_-]{10,}'
  ["contraseña en JSON"]='"(password|passwordActual|passwordNueva)"[[:space:]]*:[[:space:]]*"[^"]+'
  ["contraseñas de prueba"]='Clave2026e2e|Hyskad2026'
  ["token de recuperación"]='/restablecer\?token=[A-Za-z0-9_-]{10,}'
  ["correo electrónico"]='[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}'
)

encontrados=0
for nombre in "${!PATRONES[@]}"; do
  n=$(grep -cE "${PATRONES[$nombre]}" "$LOG" || true)
  if [ "$n" -gt 0 ]; then
    echo "✗ $nombre: $n línea(s)"
    grep -nE "${PATRONES[$nombre]}" "$LOG" | head -3 | cut -c1-200
    encontrados=$((encontrados + n))
  else
    echo "✓ sin $nombre"
  fi
done

lineas=$(wc -l < "$LOG")
if [ "$encontrados" -gt 0 ]; then
  echo "Se encontraron $encontrados línea(s) con datos sensibles en $lineas líneas de log."
  exit 1
fi
echo "Sin datos sensibles en $lineas líneas de log."
