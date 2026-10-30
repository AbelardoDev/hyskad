# F13 — Despliegue en el VPS

**Rama:** `feature/f13-despliegue`
**Requisitos:** IC1, IC7 · RNF Despliegue, Disponibilidad (backups, RTO ≤ 4 h, RPO ≤ 24 h), Portabilidad, Seguridad, Observabilidad
**Lee antes:** `CLAUDE.md`, `docs/ARCHITECTURE.md` §1, §9 y §10

> **Antes de empezar (manual):** crea en tu proveedor de DNS un registro `A` del dominio o subdominio que usarás (p. ej. `hyskad.tudominio.com`) apuntando a la IP del VPS, y ten a mano usuario y acceso SSH del VPS. No pegues contraseñas en el chat: Claude Code usará tu llave SSH.

## Prompt

Ejecuta la fase F13 de HYSKAD: despliegue reproducible y automatizado en mi VPS Ubuntu con Docker Compose, Nginx y HTTPS. Pregúntame primero el dominio, la IP/host del VPS y el usuario SSH. Muéstrame un plan corto y espera mi OK. **Antes de ejecutar cualquier comando en el VPS, muéstramelo y espera confirmación.**

### 1. Imágenes
- `backend/Dockerfile` multi-etapa: build con Maven (caché de dependencias en capa propia) → runtime `eclipse-temurin:25-jre` (o la variante mínima disponible), jar en capas, usuario no root, `HEALTHCHECK` contra `/actuator/health`, opciones de JVM pensadas para un VPS pequeño (`-XX:MaxRAMPercentage=70`).
- `frontend/Dockerfile` multi-etapa: build de Angular en Node 24 → `nginx` (alpine) con el build y la configuración de Nginx. Esta imagen **es** el proxy de la app.
- `.dockerignore` en ambos.

### 2. Nginx (`infra/nginx/`)
- Puerto 80: solo `/.well-known/acme-challenge/` y redirección 301 a HTTPS.
- Puerto 443 (HTTP/2): certificados de Let's Encrypt; TLS 1.2/1.3; cabeceras `Strict-Transport-Security`, `Content-Security-Policy` (ajustada a lo que la app realmente usa: `self`, fuentes locales, sin inline scripts salvo el script anti-parpadeo del tema con su hash), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: DENY`.
- `/` sirve la SPA con `try_files $uri /index.html`; `index.html` sin caché; assets con hash con caché de 1 año; gzip (y brotli si la imagen lo trae).
- `/api/` → `backend:8080` con `X-Forwarded-For/Proto/Host`, `client_max_body_size 5m`.
- `/api/v1/notificaciones/stream` con `proxy_buffering off`, `proxy_cache off`, `proxy_read_timeout 1h`, `proxy_http_version 1.1`, `Connection ''`.
- `/api/docs` y `/actuator` bloqueados desde fuera.
- En el backend: `server.forward-headers-strategy=framework` para que el rate limit y la auditoría usen la IP real.

### 3. Compose de producción (`infra/docker-compose.prod.yml`)
- Servicios: `proxy` (imagen frontend+nginx, puertos 80 y 443), `backend`, `mysql:8.4` (volumen con nombre, **sin puertos publicados**, healthcheck, `--character-set-server=utf8mb4`), `certbot` (renovación con webroot).
- Red interna; solo `proxy` publica puertos. `restart: unless-stopped`. Límites de memoria razonables para el VPS. Logs con rotación (`json-file`, `max-size`, `max-file`).
- Variables desde `/opt/hyskad/.env` en el servidor (nunca en el repo); `infra/.env.prod.example` documentado.
- Script `infra/scripts/init-letsencrypt.sh` para obtener el primer certificado.

### 4. Preparación del VPS (`infra/scripts/setup-vps.sh` + `docs/DEPLOY.md`)
- Usuario `deploy` con llave SSH y en el grupo `docker`; SSH sin contraseña ni root login (pídeme confirmación antes de cambiar esto, para no dejarme fuera).
- `ufw` permitiendo solo 22, 80 y 443; `fail2ban` para SSH; `unattended-upgrades`.
- Docker Engine + plugin Compose desde el repositorio oficial.
- Estructura `/opt/hyskad/` (compose, `.env`, backups).

### 5. CI/CD (`.github/workflows/deploy.yml`)
- Disparo: tag `v*` o manual (`workflow_dispatch`). Requiere que el CI esté en verde.
- Construye y publica las imágenes en GitHub Container Registry con tag de versión y `latest`.
- Se conecta por SSH (secretos `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`), hace `docker compose pull && docker compose up -d`, espera a que el healthcheck del contenedor `backend` esté en `healthy` y, desde fuera, verifica que `https://<dominio>/` responda 200 y `https://<dominio>/api/v1/auth/me` responda 401 (prueba que Nginx enruta al backend). Si falla, vuelve a la versión anterior.
- Las migraciones Flyway corren al arrancar el backend; antes de desplegar se hace un backup automático.

### 6. Backups (RNF Disponibilidad, CP-66)
- `infra/scripts/backup-db.sh`: `mysqldump --single-transaction --routines --triggers` comprimido con fecha, en `/opt/hyskad/backups`, borra los de más de 30 días, registra resultado. Cron diario a las 2:00 a. m. hora Colombia.
- `infra/scripts/restore-db.sh` con confirmación explícita.
- Recomendación (opcional) para copiar los backups fuera del VPS (por ejemplo con `rclone` a Google Drive) documentada en `DEPLOY.md`.
- Prueba de restauración en una BD limpia documentada con tiempos (para el RTO).

### 7. Runbook (`docs/DEPLOY.md`)
- Primer despliegue paso a paso, despliegues siguientes (`git tag v1.0.0 && git push --tags`), rollback, ver logs, reiniciar servicios, renovar certificado, backup/restauración, rotar `JWT_SECRET`, crear el primer admin, y diagnóstico de problemas comunes.

### Pruebas obligatorias
CP-62, CP-63, CP-66, CP-67:
- Cabeceras verificadas con `curl -I` y anotadas en el informe.
- `nmap` (o `nc`) desde fuera confirma que solo 22/80/443 están abiertos.
- Despliegue desde cero siguiendo solo `DEPLOY.md`.
- Smoke test E2E de Playwright contra producción (login y dashboard) con un usuario de prueba que luego se desactiva.

### Criterios de aceptación
- [ ] `https://<dominio>` carga con candado válido y calificación A en SSL Labs (si no, documenta por qué).
- [ ] El flujo completo funciona en producción, incluidos correos reales y notificaciones en tiempo real.
- [ ] Backup diario programado y una restauración probada.
- [ ] `INFORME-PRUEBAS.md` actualizado con los casos de esta fase. `PROGRESS.md` con todo ✅. PR, CI verde, merge y tag `v1.0.0`.
