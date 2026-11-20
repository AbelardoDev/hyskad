# Runbook de despliegue de HYSKAD

Producción corre en un VPS Ubuntu con Docker Compose. Hay cuatro contenedores:

- **`proxy`**: Nginx con el build de Angular, HTTPS y proxy de `/api`.
- **`backend`**: Spring Boot.
- **`mysql`**: MySQL 8.4, sin puertos publicados.
- **`certbot`**: renueva el certificado.

Las imágenes se publican en GitHub Container Registry (`ghcr.io/abelardodev/hyskad-backend` y `hyskad-proxy`) y se despliegan con el workflow `Deploy`.

```
/opt/hyskad/
├── docker-compose.yml      ← infra/docker-compose.prod.yml (lo copia el pipeline)
├── .env                    ← secretos y configuración (chmod 600; nunca en el repositorio)
├── desplegar.sh  backup-db.sh  restore-db.sh  init-letsencrypt.sh
├── .version-anterior       ← la usa el rollback
└── backups/                ← hyskad-AAAAMMDD-HHMMSS.sql.gz y backup.log
```

Todos los comandos de este documento se corren como `deploy` dentro de `/opt/hyskad`, salvo que se indique otra cosa.

---

## 1. Primer despliegue (desde cero)

### 1.1 Requisitos

- Un VPS Ubuntu 22.04 o posterior con al menos 2 GB de RAM (1 GB funciona con los ajustes de memoria de §9) y acceso SSH con llave.
- Un subdominio (p. ej. `hyskad.tudominio.com`) con un registro **A** hacia la IP del VPS. Para comprobarlo: `dig +short hyskad.tudominio.com` debe devolver **la IP del VPS**.
- Si el DNS está en Cloudflare, el registro va en **"DNS only" (nube gris)**. Con el proxy de Cloudflare (nube naranja), Nginx vería la IP de Cloudflare en todas las peticiones: el rate limit del login quedaría compartido entre todos los usuarios y la auditoría registraría IPs de Cloudflare.
- Los puertos 80 y 443 libres. Si el servidor ya tiene otro proxy (Nginx Proxy Manager, Caddy, Apache…), ver §10.
- Una cuenta SMTP para los correos (Brevo, Gmail con contraseña de aplicación, etc.).

### 1.2 Preparar el servidor

Desde tu equipo. `<puerto>` es el puerto de SSH del servidor (22 si no lo cambiaste):

```bash
scp -P <puerto> infra/scripts/setup-vps.sh <usuario>@<ip>:/tmp/
ssh -t -p <puerto> <usuario>@<ip> 'sudo SSH_PORT=<puerto> bash /tmp/setup-vps.sh base'
```

`SSH_PORT` debe ser el puerto en el que escucha `sshd`: es el único que el script abre en `ufw` y el que vigila `fail2ban`. Si `sshd` no escucha ahí, el script se detiene antes de activar el firewall.

El script hace esto:
- Pone la zona horaria America/Bogota.
- Instala Docker (si no está), `ufw` (solo `SSH_PORT`, 80 y 443), `fail2ban` y las actualizaciones automáticas.
- Crea el usuario `deploy` con tus mismas llaves SSH.
- Crea `/opt/hyskad` y programa el backup diario a las 2:00.

**Antes de seguir**, comprueba desde otra terminal que entras con la llave:

```bash
ssh -p <puerto> deploy@<ip>
```

Solo si entras, desactiva el ingreso con contraseña y el de root. No cierres la sesión actual hasta comprobar otra vez que `deploy` entra:

```bash
ssh -t -p <puerto> <usuario>@<ip> 'sudo SSH_PORT=<puerto> bash /tmp/setup-vps.sh endurecer-ssh'
```

### 1.3 Archivos en `/opt/hyskad`

Desde tu equipo, en la raíz del repositorio:

```bash
scp -P <puerto> infra/docker-compose.prod.yml deploy@<ip>:/opt/hyskad/docker-compose.yml
scp -P <puerto> infra/scripts/{desplegar,backup-db,restore-db,init-letsencrypt}.sh deploy@<ip>:/opt/hyskad/
scp -P <puerto> infra/.env.prod.example deploy@<ip>:/opt/hyskad/.env
ssh -p <puerto> deploy@<ip> 'chmod 750 /opt/hyskad/*.sh && chmod 600 /opt/hyskad/.env'
```

Completa `/opt/hyskad/.env` en el servidor (`nano /opt/hyskad/.env`). Las instrucciones de cada variable están dentro del archivo. Genera las contraseñas y el secreto con `openssl rand -base64 24` y `openssl rand -base64 48`. Define `ADMIN_EMAIL` y `ADMIN_PASSWORD` para el primer administrador (§6).

### 1.4 Imágenes

El primer `docker compose` necesita las imágenes publicadas. Configura el repositorio de GitHub una sola vez:

1. **Settings → Environments → New environment `produccion`.** Opcional: exigir aprobación manual.
2. **Settings → Secrets and variables → Actions:**
   - Secretos:
     - `VPS_HOST`: IP del VPS (no el dominio).
     - `VPS_PORT`: puerto de SSH; si se omite, 22.
     - `VPS_USER`: `deploy`.
     - `VPS_SSH_KEY`: llave **privada** de un par dedicado al despliegue. Su llave pública va en `/home/deploy/.ssh/authorized_keys`.
     - `VPS_KNOWN_HOSTS`: salida de `ssh-keyscan -p <puerto> -t ed25519 <ip>` (con un puerto distinto de 22 la línea empieza por `[<ip>]:<puerto>`). Compárala con la huella que muestra el servidor (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`).
   - Variable: `DOMINIO`, p. ej. `hyskad.tudominio.com`.

Para generar la llave del despliegue (sin frase de paso, solo para el pipeline):

```bash
ssh-keygen -t ed25519 -f hyskad-deploy -C "github-actions hyskad" -N ""
ssh-copy-id -p <puerto> -i hyskad-deploy.pub deploy@<ip>
# El contenido de hyskad-deploy va en VPS_SSH_KEY; después borra ese archivo de tu equipo
```

### 1.5 Primer certificado y arranque

El primer tag publica las imágenes y despliega. El certificado todavía no existe, así que el proxy no arranca hasta obtenerlo. Por eso, la primera vez:

```bash
# 1. Publica las imágenes: en tu equipo, sobre main con el CI en verde
git tag v1.0.0 && git push origin v1.0.0
#    El job "desplegar" de esta primera corrida falla porque el proxy no tiene certificado; es lo esperado.
#    Espera a que la corrida termine (incluida su reversión) antes del paso 2: si corren a la vez,
#    el pipeline recrea los contenedores en mitad de init-letsencrypt.sh y deja HYSKAD_VERSION=latest.

# 2. En el servidor
cd /opt/hyskad
echo "<token-con-read:packages>" | docker login ghcr.io -u <usuario-github> --password-stdin   # solo si los paquetes son privados
sed -i 's/^HYSKAD_VERSION=.*/HYSKAD_VERSION=v1.0.0/' .env
docker compose pull
./init-letsencrypt.sh --staging   # prueba sin gastar el límite de Let's Encrypt
./init-letsencrypt.sh --forzar    # certificado real
docker logout ghcr.io
```

Comprueba que la app funciona:
- `https://<dominio>` muestra el login con un candado válido.
- `curl -s -o /dev/null -w '%{http_code}\n' https://<dominio>/api/v1/auth/me` responde `401`.

Desde aquí, cada tag despliega solo (§2). Para que el primer despliegue quede registrado por el pipeline, vuelve a correr el workflow a mano: **Actions → Deploy → Run workflow → `v1.0.0`**.

---

## 2. Despliegues siguientes

```bash
git checkout main && git pull
git tag v1.1.0 && git push origin v1.1.0
```

El workflow **Deploy** hace lo siguiente:
1. Exige que el commit tenga el CI en verde.
2. Construye y publica las dos imágenes con el tag y con `latest`.
3. Copia el compose y los scripts al servidor.
4. Ejecuta `desplegar.sh v1.1.0`, que hace un backup, actualiza `HYSKAD_VERSION`, corre `pull` y `up -d`, y espera a que el backend esté `healthy`. Flyway aplica las migraciones al arrancar.
5. Verifica desde fuera que `/` responda 200 y `/api/v1/auth/me` responda 401.

Si el backend no queda sano, `desplegar.sh` vuelve solo a la versión anterior. Si falla la verificación externa, lo hace el workflow.

Para desplegar a mano (o volver a desplegar un tag ya publicado):

```bash
cd /opt/hyskad && ./desplegar.sh v1.1.0
```

## 3. Rollback

```bash
cd /opt/hyskad && ./desplegar.sh --revertir      # a la versión previa al último despliegue
# o a una versión concreta:
./desplegar.sh v1.0.0
```

Las migraciones de Flyway **no se deshacen**. Si la versión nueva cambió el esquema de forma incompatible, la anterior no arrancará con la base migrada (Flyway `validate`). En ese caso, restaura el backup que se hizo justo antes del despliegue (§5.2; es el más reciente en `backups/`) y luego despliega la versión anterior.

## 4. Operación diaria

| Tarea | Comando |
|---|---|
| Estado de los contenedores | `docker compose ps` |
| Logs del backend (JSON ECS) | `docker compose logs -f --tail 200 backend` |
| Logs de Nginx | `docker compose logs -f --tail 200 proxy` |
| Buscar una petición por su id | `docker compose logs backend \| grep '<X-Request-Id>'` |
| Reiniciar un servicio | `docker compose restart backend` |
| Reiniciar todo | `docker compose down && docker compose up -d` (los datos quedan en los volúmenes) |
| Espacio en disco | `df -h /` y `docker system df` |
| Limpiar imágenes viejas | `docker image prune -f --filter until=168h` |

Los logs rotan solos: 5 archivos de 10 MB por contenedor.

### Certificado

`certbot` intenta renovar cada 12 horas (renueva cuando faltan menos de 30 días) y el proxy recarga Nginx cada 6 horas. Para comprobarlo o forzarlo:

```bash
docker compose run --rm --entrypoint certbot certbot certificates
docker compose run --rm --entrypoint certbot certbot renew --webroot -w /var/www/certbot --force-renewal
docker compose exec proxy nginx -s reload
```

## 5. Backups y restauración (RNF Disponibilidad: RPO ≤ 24 h, RTO ≤ 4 h)

### 5.1 Backup

Se ejecuta solo todos los días a las 2:00 (`/etc/cron.d/hyskad-backup`) y antes de cada despliegue:
- Usa `mysqldump --single-transaction --routines --triggers --events`, comprimido con gzip.
- Verifica la integridad del archivo y borra los backups de más de 30 días.
- El resultado queda en `backups/backup.log`.

```bash
./backup-db.sh                        # backup manual
tail backups/backup.log               # último resultado ("OK ..." o "ERROR ...")
ls -lh backups/
```

### 5.2 Restauración

Para restaurar en producción: detiene el backend, reemplaza la base y vuelve a arrancar. Pide escribir `RESTAURAR`.

```bash
./restore-db.sh backups/hyskad-20261201-020000.sql.gz
```

Para probar un backup sin tocar producción, restáuralo en una base limpia aparte y bórrala después:

```bash
./restore-db.sh backups/hyskad-20261201-020000.sql.gz --en hyskad_prueba
docker compose exec mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root -e "DROP DATABASE hyskad_prueba"'
```

Los tiempos medidos están en `docs/test-reports/INFORME-PRUEBAS.md` (CP-66).

### 5.3 Copia fuera del VPS (recomendado)

Un backup que vive solo en el VPS se pierde con el VPS. Una opción es sincronizarlos con Google Drive usando `rclone`:

```bash
sudo apt-get install -y rclone
rclone config                 # crea un remoto "gdrive" (tipo drive); como deploy
# Agrega al final de /etc/cron.d/hyskad-backup (como root):
# 30 2 * * * deploy rclone copy /opt/hyskad/backups gdrive:hyskad-backups --include 'hyskad-*.sql.gz' --max-age 48h
```

## 6. Primer administrador

Si no hay ningún administrador, el backend crea uno al arrancar con `ADMIN_EMAIL` y `ADMIN_PASSWORD` del `.env` (RN-46), y la contraseña debe cambiarse en el primer ingreso. Después:

```bash
sed -i 's/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=/' .env
docker compose up -d backend
```

Si las variables faltan o la contraseña no cumple la política (mínimo 8 caracteres, con letras y números), el log del backend dice que no se creó.

## 7. Rotar `JWT_SECRET`

Rotarlo invalida todos los access tokens. Los refresh tokens están en la base y siguen siendo válidos, así que los usuarios recuperan la sesión solos al recargar.

```bash
nuevo=$(openssl rand -base64 48)
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$nuevo|" .env
docker compose up -d backend
```

Si sospechas que robaron sesiones, después de rotarlo cierra todas: desactiva y vuelve a activar a los usuarios afectados desde **Usuarios**, porque cambiar el acceso de un usuario revoca sus refresh tokens.

## 8. Diagnóstico de problemas comunes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `proxy` reinicia en bucle con `cannot load certificate` | No hay certificado todavía | `./init-letsencrypt.sh` (§1.5) |
| `init-letsencrypt.sh` falla en el reto | El registro A no apunta al VPS, el puerto 80 está cerrado u otro proxy lo ocupa | `dig +short <dominio>` (debe dar la IP del VPS, no la de Cloudflare); `sudo ufw status`; `sudo ss -tlnp \| grep -E ':(80\|443) '`; el proveedor del VPS puede tener su propio firewall |
| `proxy` no arranca: `port is already allocated` | Otro contenedor o servicio tiene el 80 o el 443 | §10 |
| 502 Bad Gateway | El backend no está sano | `docker compose ps`; `docker compose logs --tail 200 backend` |
| El backend no arranca: `Defina … en .env` | Falta una variable obligatoria | Completar `.env` (ver `infra/.env.prod.example`) |
| El backend no arranca: error de Flyway `validate` | La base tiene un esquema de otra versión | Ver §3 (rollback con migraciones) |
| No llegan los correos | Credenciales SMTP o remitente no verificado | `docker compose logs backend \| grep -i mail`; revisar `MAIL_*` y el remitente en el proveedor |
| Las notificaciones llegan tarde | Algo intermedio guarda en búfer el stream SSE | El bloque `/api/v1/notificaciones/stream` de `infra/nginx/prod.conf.template` debe tener `proxy_buffering off`; un CDN o proxy delante del VPS debe respetarlo |
| Todos reciben 429 en el login | El rate limit ve una sola IP | Si el dominio pasa por Cloudflare, ponerlo en "DNS only" (§1.1). Nginx debe enviar `X-Forwarded-For $remote_addr` y el backend usa `forward-headers-strategy: framework` (perfil `prod`) |
| Error de CSP en la consola del navegador | Un script en línea nuevo en `index.html` | La imagen calcula los hashes al construirse; reconstruir y publicar. Nunca relajar la CSP con `unsafe-inline` para scripts |
| Disco lleno | Imágenes viejas o backups | `docker image prune -f`; revisar `backups/` |

## 9. Memoria

Los valores por defecto del `.env` son para 2 GB de RAM:

| Variable | 1 GB | 2 GB | 4 GB |
|---|---|---|---|
| `BACKEND_MEM` | 512m | 768m | 1536m |
| `MYSQL_MEM` | 384m | 768m | 1536m |
| `MYSQL_BUFFER_POOL` | 128M | 256M | 1G |
| `PROXY_MEM` | 96m | 128m | 128m |

La JVM usa el 70 % del límite del contenedor como heap (`-XX:MaxRAMPercentage=70`). Con 1 GB conviene además agregar swap:

```bash
sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 10. Servidor con otros servicios

HYSKAD necesita los puertos 80 y 443 para él solo (su Nginx termina el HTTPS y renueva el certificado). Si el servidor ya tiene otro proxy, hay que bajarlo antes del primer despliegue. Ejemplo con Nginx Proxy Manager en `/opt/nginx-proxy-manager`:

```bash
# 1. Respaldo de la configuración y los certificados (sirve para migrar los otros sitios después)
sudo tar -czf /root/npm-respaldo-$(date +%Y%m%d).tar.gz -C /opt nginx-proxy-manager
# 2. Anotar qué dominio iba a qué contenedor
sudo grep -h -E 'server_name|set \$server|set \$port' /opt/nginx-proxy-manager/data/nginx/proxy_host/*.conf
# 3. Bajarlo (los volúmenes y la carpeta quedan; "docker compose up -d" lo devuelve)
cd /opt/nginx-proxy-manager && sudo docker compose down
```

Los sitios que dependían de ese proxy quedan fuera de línea hasta migrarlos.

### 10.1 Servir otros sitios desde el proxy de HYSKAD

Los otros sitios no son parte de HYSKAD, así que su configuración vive **solo en el servidor** y no en el repositorio. Son dos archivos en `/opt/hyskad`:

- `sitios.conf`: bloques `server` de Nginx para esos dominios.
  - Puerto 80: el reto ACME y un 301 a HTTPS.
  - Puerto 443: `proxy_pass` a cada contenedor, elegido con un `map $host`. Se usa `resolver 127.0.0.11` y el destino va en una variable. Así Nginx resuelve el contenedor en cada petición: si un sitio está caído responde 502, pero el proxy (y HYSKAD) sigue arrancando.
- `docker-compose.override.yml`: monta `sitios.conf` en `/etc/nginx/conf.d/` del proxy y une el proxy a la red Docker de esos contenedores (`external: true`). Compose lo combina solo con `docker-compose.yml`, así que `desplegar.sh` y el pipeline lo respetan sin cambios. El pipeline solo reemplaza `docker-compose.yml`.

```yaml
services:
  proxy:
    volumes:
      - ./sitios.conf:/etc/nginx/conf.d/sitios.conf:ro
    networks: [publica, interna, sitios]
networks:
  sitios:
    name: proxy          # la red donde están los contenedores de los sitios
    external: true
```

Pasos, en este orden. Si `sitios.conf` apunta a un certificado que no existe, Nginx no arranca:

```bash
cd /opt/hyskad
# 1. Certificado con todos los dominios. El server del puerto 80 de HYSKAD ya atiende el reto ACME
#    de cualquier host. Probar primero con --dry-run.
docker compose run --rm --no-deps --entrypoint certbot certbot certonly --webroot -w /var/www/certbot \
  --cert-name sitios -d dominio1 -d dominio2 ... --email <correo> --agree-tos --no-eff-email --non-interactive
# 2. Validar sin tocar el proxy en marcha
docker compose -f docker-compose.yml -f override.nuevo.yml run --rm --no-deps -T proxy nginx -t
# 3. Aplicar (el proxy se recrea; HYSKAD queda unos segundos sin servicio)
mv override.nuevo.yml docker-compose.override.yml && docker compose up -d proxy
```

El contenedor certbot renueva este certificado junto con el de HYSKAD, y el proxy recarga cada 6 horas. Para agregar un dominio después:
1. Agrégalo al `map` y a los dos `server_name` de `sitios.conf`.
2. Vuelve a emitir el certificado con todos los dominios y `--expand`.
3. Ejecuta `docker compose exec proxy nginx -s reload`.

Con DNS a través del proxy de Cloudflare (nube naranja), el modo SSL debe ser **Full (strict)**. El reto HTTP-01 pasa por Cloudflare sin problema. Si la red externa desaparece, el proxy no arranca: para volver a la configuración de solo HYSKAD, renombra `docker-compose.override.yml` y ejecuta `docker compose up -d proxy`.
