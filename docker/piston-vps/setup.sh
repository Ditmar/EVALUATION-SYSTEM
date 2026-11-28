#!/usr/bin/env bash
# Instalación de Piston en un VPS (Ubuntu/Debian). Idempotente: se puede
# volver a correr sin romper nada. Uso, dentro de esta carpeta:
#
#   bash setup.sh
#
# Ver docs/deploy/railway-piston.md.
set -euo pipefail
cd "$(dirname "$0")"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# 1. Docker
if ! command -v docker >/dev/null 2>&1; then
  say "Instalando Docker"
  curl -fsSL https://get.docker.com | sh
fi

# 2. .env (dominio, token, concurrencia)
if [ ! -f .env ]; then
  IP=$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')
  DEFAULT_DOMAIN="piston.$(echo "$IP" | tr '.' '-').sslip.io"
  read -r -p "Dominio para Piston [${DEFAULT_DOMAIN}]: " DOMAIN
  DOMAIN=${DOMAIN:-$DEFAULT_DOMAIN}
  CPUS=$(nproc)
  JOBS=$(( CPUS * 2 > 4 ? 4 : CPUS * 2 ))
  cat > .env <<EOF
PISTON_DOMAIN=${DOMAIN}
PISTON_AUTH_TOKEN=$(openssl rand -hex 32)
PISTON_MAX_CONCURRENT_JOBS=${JOBS}
EOF
  chmod 600 .env
  say ".env creado (dominio ${DOMAIN}, ${JOBS} ejecuciones simultáneas para ${CPUS} vCPU)"
else
  say "Usando el .env existente"
fi
set -a; . ./.env; set +a

# 3. Levantar Piston + Caddy
say "Levantando Piston y Caddy"
docker compose up -d

say "Esperando a Piston"
for _ in $(seq 1 60); do
  curl -fsS http://127.0.0.1:2000/api/v2/runtimes >/dev/null 2>&1 && break
  sleep 2
done

# 4. Lenguajes, uno por uno (en paralelo se corrompen las descargas)
for p in python:3.12.0 java:15.0.2 typescript:5.0.3; do
  lang=${p%%:*}; ver=${p##*:}
  if curl -fsS http://127.0.0.1:2000/api/v2/runtimes | grep -q "\"language\":\"${lang}\",\"version\":\"${ver}\""; then
    say "${lang} ${ver} ya instalado"
    continue
  fi
  say "Instalando ${lang} ${ver} (puede tardar varios minutos)"
  curl -sS -X POST http://127.0.0.1:2000/api/v2/packages \
    -H 'Content-Type: application/json' \
    -d "{\"language\":\"${lang}\",\"version\":\"${ver}\"}"
  echo
done

# 5. Prueba a través de Caddy (HTTPS + token)
say "Probando https://${PISTON_DOMAIN} (el certificado puede tardar unos segundos la primera vez)"
OK=""
for _ in $(seq 1 30); do
  OUT=$(curl -fsS "https://${PISTON_DOMAIN}/api/v2/execute" \
    -H "Authorization: Bearer ${PISTON_AUTH_TOKEN}" -H 'Content-Type: application/json' \
    -d '{"language":"python","version":"3.12.0","files":[{"name":"main.py","content":"print(2+2)"}]}' 2>/dev/null || true)
  if echo "$OUT" | grep -q '"stdout":"4\\n"'; then OK=1; break; fi
  sleep 3
done
if [ -n "$OK" ]; then
  say "Piston responde por HTTPS ✔"
else
  say "No se pudo verificar por HTTPS: revisa el DNS, el firewall (80/443) y 'docker compose logs caddy'"
fi

cat <<EOF

────────────────────────────────────────────────────────────
Variables para Railway (servicio web → Variables):

PISTON_URL=https://${PISTON_DOMAIN}
PISTON_AUTH_TOKEN=${PISTON_AUTH_TOKEN}
CODE_RUN_MAX_CONCURRENCY=${PISTON_MAX_CONCURRENT_JOBS}
────────────────────────────────────────────────────────────
EOF
