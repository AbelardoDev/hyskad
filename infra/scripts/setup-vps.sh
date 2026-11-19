#!/usr/bin/env bash
# Prepara un VPS Ubuntu (22.04 o posterior) para HYSKAD (F13). Se corre como root (o con sudo).
#
#   sudo SSH_PORT=2222 ./setup-vps.sh base
#       Zona horaria America/Bogota, actualizaciones automáticas, ufw (solo SSH_PORT, 80 y 443),
#       fail2ban para SSH, Docker Engine + Compose desde el repositorio oficial, usuario "deploy"
#       (grupo docker, con las llaves SSH autorizadas del usuario que lo ejecuta), /opt/hyskad y
#       el cron del backup diario. No toca la configuración de SSH.
#
#   sudo ./setup-vps.sh endurecer-ssh
#       Desactiva el ingreso por contraseña y el de root. Correrlo SOLO después de comprobar, desde
#       otra terminal, que "ssh deploy@<servidor>" entra con la llave; si no, se pierde el acceso.
#
# SSH_PORT es el puerto en el que escucha sshd (22 si se omite). Si no coincide, ufw y fail2ban
# protegen otro puerto y el firewall deja fuera la sesión SSH.
set -euo pipefail

SSH_PORT="${SSH_PORT:-22}"
case "$SSH_PORT" in ''|*[!0-9]*) echo "SSH_PORT inválido: $SSH_PORT" >&2; exit 2 ;; esac

[ "$(id -u)" -eq 0 ] || { echo "Ejecútelo como root (sudo)." >&2; exit 1; }
paso() { echo; echo "==> $*"; }

base() {
  export DEBIAN_FRONTEND=noninteractive

  paso "Zona horaria America/Bogota (el cron del backup corre a las 2:00 hora Colombia)"
  timedatectl set-timezone America/Bogota

  paso "Paquetes y actualizaciones de seguridad automáticas"
  apt-get update -q
  apt-get upgrade -y -q
  apt-get install -y -q ca-certificates curl gnupg ufw fail2ban unattended-upgrades
  dpkg-reconfigure -f noninteractive unattended-upgrades

  paso "Firewall: solo SSH ($SSH_PORT), HTTP y HTTPS"
  if ! ss -tln | grep -qE "[:.]$SSH_PORT[[:space:]]"; then
    echo "sshd no escucha en el puerto $SSH_PORT; se cancela para no cortar el acceso." >&2
    exit 1
  fi
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow "$SSH_PORT/tcp"
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable

  paso "fail2ban para SSH"
  cat > /etc/fail2ban/jail.d/sshd.local <<EOF
[sshd]
enabled = true
port = $SSH_PORT
maxretry = 5
findtime = 10m
bantime = 1h
EOF
  systemctl enable --now fail2ban
  systemctl restart fail2ban

  paso "Docker Engine y el plugin Compose (repositorio oficial)"
  if ! command -v docker >/dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    . /etc/os-release
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -q
    apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi
  systemctl enable --now docker
  # Docker publica puertos saltándose ufw; en el compose solo el proxy publica 80 y 443.

  paso "Usuario deploy con las llaves SSH de ${SUDO_USER:-root}"
  if ! id deploy >/dev/null 2>&1; then
    adduser --disabled-password --gecos "" deploy
  fi
  usermod -aG docker deploy
  origen="/root/.ssh/authorized_keys"
  if [ -n "${SUDO_USER:-}" ] && [ -f "/home/$SUDO_USER/.ssh/authorized_keys" ]; then
    origen="/home/$SUDO_USER/.ssh/authorized_keys"
  fi
  install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
  if [ -f "$origen" ]; then
    cat "$origen" >> /home/deploy/.ssh/authorized_keys
    sort -u -o /home/deploy/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
  fi
  chown deploy:deploy /home/deploy/.ssh/authorized_keys 2>/dev/null || true
  chmod 600 /home/deploy/.ssh/authorized_keys 2>/dev/null || true

  paso "Estructura /opt/hyskad"
  install -d -m 750 -o deploy -g deploy /opt/hyskad /opt/hyskad/backups

  paso "Cron del backup diario (2:00)"
  echo "0 2 * * * deploy /opt/hyskad/backup-db.sh >> /opt/hyskad/backups/backup.log 2>&1" > /etc/cron.d/hyskad-backup
  chmod 644 /etc/cron.d/hyskad-backup

  echo
  echo "Listo. Siguiente paso: desde otra terminal compruebe 'ssh -p $SSH_PORT deploy@<servidor>' y siga docs/DEPLOY.md."
  echo "Cuando entre con la llave, puede correr: sudo $0 endurecer-ssh"
}

endurecer_ssh() {
  [ -s /home/deploy/.ssh/authorized_keys ] || { echo "deploy no tiene llaves autorizadas; no se cambia SSH." >&2; exit 1; }
  paso "SSH solo con llave y sin root"
  cat > /etc/ssh/sshd_config.d/10-hyskad.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
EOF
  sshd -t
  systemctl reload ssh || systemctl reload sshd
  echo "Hecho. No cierre esta sesión hasta comprobar en otra terminal que 'ssh -p $SSH_PORT deploy@<servidor>' entra."
}

case "${1:-}" in
  base) base ;;
  endurecer-ssh) endurecer_ssh ;;
  *) echo "Uso: sudo $0 base | endurecer-ssh" >&2; exit 2 ;;
esac
