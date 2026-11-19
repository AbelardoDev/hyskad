#!/bin/sh
# Lo ejecuta la imagen oficial de nginx antes de arrancar (/docker-entrypoint.d). Recarga Nginx cada
# 6 horas para tomar el certificado que renueva el contenedor certbot, sin reiniciar el servicio.
set -eu
(
  while :; do
    sleep 6h
    nginx -s reload 2>/dev/null || true
  done
) &
