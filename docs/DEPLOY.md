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

- Un VPS Ubuntu 22.04 o 24.04 con al menos 2 GB de RAM (1 GB funciona con los ajustes de memoria de §9) y acceso SSH con llave.
- Un subdominio (p. ej. `hyskad.tudominio.com`) con un registro **A** hacia la IP del VPS. Para comprobarlo: `dig +short hyskad.tudominio.com`.
- Una cuenta SMTP para los correos (Brevo, Gmail con contraseña de aplicación, etc.).

### 1.2 Preparar el servidor

Desde tu equipo:

```bash
scp infra/scripts/setup-vps.sh <usuario>@<ip>:/tmp/
ssh <usuario>@<ip> 'sudo bash /tmp/setup-vps.sh base'
```

El script hace esto:
- Pone la zona horaria America/Bogota.
- Instala Docker, `ufw` (solo 22, 80 y 443), `fail2ban` y las actualizaciones automáticas.
- Crea el usuario `deploy` con tus mismas llaves SSH.
- Crea `/opt/hyskad` y programa el backup diario a las 2:00.

**Antes de seguir**, comprueba desde otra terminal que entras con la llave:

```bash
ssh deploy@<ip>
```

Solo si entras, desactiva el ingreso con contraseña y el de root. No cierres la sesión actual hasta comprobar otra vez que `deploy` entra:

```bash
ssh <usuario>@<ip> 'sudo bash /tmp/setup-vps.sh endurecer-ssh'
```

### 1.3 Archivos en `/opt/hyskad`

Desde tu equipo, en la raíz del repositorio:

```bash
scp infra/docker-compose.prod.yml deploy@<ip>:/opt/hyskad/docker-compose.yml
scp infra/scripts/{desplegar,backup-db,restore-db,init-letsencrypt}.sh deploy@<ip>:/opt/hyskad/
scp infra/.env.prod.example deploy@<ip>:/opt/hyskad/.env
ssh deploy@<ip> 'chmod 750 /opt/hyskad/*.sh && chmod 600 /opt/hyskad/.env'
```

Completa `/opt/hyskad/.env` en el servidor (`nano /opt/hyskad/.env`). Las instrucciones de cada variable están dentro del archivo. Genera las contraseñas y el secreto con `openssl rand -base64 24` y `openssl rand -base64 48`. Define `ADMIN_EMAIL` y `ADMIN_PASSWORD` para el primer administrador (§6).

### 1.4 Imágenes

El primer `docker compose` necesita las imágenes publicadas. Configura el repositorio de GitHub una sola vez:

1. **Settings → Environments → New environment `produccion`.** Opcional: exigir aprobación manual.
2. **Settings → Secrets and variables → Actions:**
   - Secretos:
     - `VPS_HOST`: IP o host del VPS.
     - `VPS_USER`: `deploy`.
     - `VPS_SSH_KEY`: llave **privada** de un par dedicado al despliegue. Su llave pública va en `/home/deploy/.ssh/authorized_keys`.
     - `VPS_KNOWN_HOSTS`: salida de `ssh-keyscan -t ed25519 <ip>`. Compárala con la huella que muestra el servidor (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`).
   - Variable: `DOMINIO`, p. ej. `hyskad.tudominio.com`.

Para generar la llave del despliegue (sin frase de paso, solo para el pipeline):

```bash
ssh-keygen -t ed25519 -f hyskad-deploy -C "github-actions hyskad" -N ""
ssh-copy-id -i hyskad-deploy.pub deploy@<ip>
# El contenido de hyskad-deploy va en VPS_SSH_KEY; después borra ese archivo de tu equipo
```

### 1.5 Primer certificado y arranque

El primer tag publica las imágenes y despliega. El certificado todavía no existe, así que el proxy no arranca hasta obtenerlo. Por eso, la primera vez:

```bash
# 1. Publica las imágenes: en tu equipo, sobre main con el CI en verde
git tag v1.0.0 && git push origin v1.0.0
#    El job "desplegar" de esta primera corrida falla porque el proxy no tiene certificado; es lo esperado.

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
| `init-letsencrypt.sh` falla en el reto | El registro A no apunta al VPS o el puerto 80 está cerrado | `dig +short <dominio>`; `sudo ufw status`; el proveedor del VPS puede tener su propio firewall |
| 502 Bad Gateway | El backend no está sano | `docker compose ps`; `docker compose logs --tail 200 backend` |
| El backend no arranca: `Defina … en .env` | Falta una variable obligatoria | Completar `.env` (ver `infra/.env.prod.example`) |
| El backend no arranca: error de Flyway `validate` | La base tiene un esquema de otra versión | Ver §3 (rollback con migraciones) |
| No llegan los correos | Credenciales SMTP o remitente no verificado | `docker compose logs backend \| grep -i mail`; revisar `MAIL_*` y el remitente en el proveedor |
| Las notificaciones llegan tarde | Algo intermedio guarda en búfer el stream SSE | El bloque `/api/v1/notificaciones/stream` de `infra/nginx/prod.conf.template` debe tener `proxy_buffering off`; un CDN o proxy delante del VPS debe respetarlo |
| Todos reciben 429 en el login | El rate limit ve una sola IP | Nginx debe enviar `X-Forwarded-For $remote_addr` y el backend usa `forward-headers-strategy: framework` (perfil `prod`) |
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
