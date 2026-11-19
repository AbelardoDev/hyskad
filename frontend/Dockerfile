# syntax=docker/dockerfile:1
# Imagen del frontend de HYSKAD (F13): el build de Angular servido por Nginx, que además es el
# proxy de la app (HTTPS, /api y SSE). Necesita infra/nginx, así que se construye desde la raíz:
#   docker build -f frontend/Dockerfile -t hyskad-proxy .

# --- 1. Compilación -------------------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /build

COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build \
    && node scripts/csp-hashes.mjs dist/frontend/browser/index.html > csp-hashes.conf

# --- 2. Nginx -------------------------------------------------------------------------------
FROM nginx:1.28-alpine

RUN rm /etc/nginx/conf.d/default.conf \
    && mkdir -p /etc/nginx/snippets /var/www/certbot

COPY infra/nginx/prod.conf.template /etc/nginx/templates/hyskad.conf.template
COPY infra/nginx/seguridad.conf infra/nginx/proxy.conf /etc/nginx/snippets/
COPY --chmod=755 infra/nginx/40-recargar-certificados.sh /docker-entrypoint.d/
COPY --from=build /build/csp-hashes.conf /etc/nginx/snippets/
COPY --from=build /build/dist/frontend/browser/ /usr/share/nginx/html/

# Solo sustituye ${DOMINIO} en la plantilla; las variables de Nginx ($host, $uri…) quedan intactas
ENV NGINX_ENVSUBST_FILTER=^DOMINIO$

EXPOSE 80 443

# El puerto 80 responde 404 en la carpeta del reto ACME (y 301 en lo demás): prueba que Nginx atiende
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/.well-known/acme-challenge/salud 2>&1 | grep -q "404" || exit 1
