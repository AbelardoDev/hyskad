#!/usr/bin/env bash
# Obtiene el primer certificado de Let's Encrypt (F13). Se corre una sola vez en el VPS, desde
# /opt/hyskad, con el .env completo y el registro A del dominio ya apuntando al servidor.
#   ./init-letsencrypt.sh            certificado real
#   ./init-letsencrypt.sh --staging  certificado de prueba (no cuenta para los límites de Let's Encrypt)
#   ./init-letsencrypt.sh --forzar   reemplaza un certificado existente
#
# Nginx no arranca sin certificado, así que primero se crea uno provisional autofirmado, se levanta
# el proxy, se borra el provisional, certbot obtiene el real por webroot y se recarga Nginx.
set -euo pipefail
cd "$(dirname "$0")"

staging=""
forzar=false
for arg in "$@"; do
  case "$arg" in
    --staging) staging="--staging" ;;
    --forzar) forzar=true ;;
    *) echo "Opción desconocida: $arg" >&2; exit 2 ;;
  esac
done

[ -f .env ] || { echo "Falta .env en $(pwd)" >&2; exit 1; }
DOMINIO=$(grep -E '^DOMINIO=' .env | cut -d= -f2-)
EMAIL=$(grep -E '^LETSENCRYPT_EMAIL=' .env | cut -d= -f2-)
[ -n "$DOMINIO" ] || { echo "Defina DOMINIO en .env" >&2; exit 1; }
[ -n "$EMAIL" ] || { echo "Defina LETSENCRYPT_EMAIL en .env" >&2; exit 1; }

compose() { docker compose "$@"; }
vivo="/etc/letsencrypt/live/$DOMINIO"

if compose run --rm --no-deps --entrypoint test certbot -s "$vivo/fullchain.pem" 2>/dev/null && ! $forzar; then
  echo "Ya existe un certificado para $DOMINIO (use --forzar para reemplazarlo)."
  exit 0
fi

echo "==> Certificado provisional para $DOMINIO"
compose run --rm --no-deps --entrypoint sh certbot -c "
  mkdir -p '$vivo' &&
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout '$vivo/privkey.pem' -out '$vivo/fullchain.pem' -subj '/CN=localhost' 2>/dev/null"

echo "==> Arrancando el proxy (y con él backend y MySQL)"
compose up -d proxy

echo "==> Borrando el certificado provisional"
compose run --rm --no-deps --entrypoint sh certbot -c "
  rm -rf '$vivo' '/etc/letsencrypt/archive/$DOMINIO' '/etc/letsencrypt/renewal/$DOMINIO.conf'"

echo "==> Pidiendo el certificado a Let's Encrypt ${staging:+(staging)}"
compose run --rm --no-deps --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot -d "$DOMINIO" \
  --email "$EMAIL" --agree-tos --no-eff-email --non-interactive $staging

echo "==> Recargando Nginx y arrancando la renovación automática"
compose exec proxy nginx -s reload
compose up -d

echo "Listo: https://$DOMINIO"
