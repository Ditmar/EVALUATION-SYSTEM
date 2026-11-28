# Guía: desplegar en Railway con ejecución de código (Piston)

Esta guía es para quien despliega EVALUATION-SYSTEM en Railway y quiere que
funcionen las preguntas `type="ide"` (botón **Run** y consola). Para el diseño
de la funcionalidad ver [docs/specs/piston-code-runner.md](../specs/piston-code-runner.md).

## Lo primero: Piston no corre dentro de Railway

Piston aísla cada ejecución con `isolate`, que necesita cgroups y un contenedor
**privilegiado** (`privileged: true`). Railway no permite contenedores
privilegiados en ningún plan; a Judge0, otro sandbox de código, le pasa lo
mismo. Si despliegas la imagen de Piston en Railway, arranca pero falla al
ejecutar.

Por eso la arquitectura recomendada es:

```
Navegador ──► App Next.js (Railway) ──HTTPS + Bearer token──► Caddy ──► Piston (VPS)
                    │
                    └──► Postgres (Railway)
```

- La **app y Postgres** quedan en Railway, como hoy.
- **Piston** corre en un VPS pequeño con Docker (Hetzner, DigitalOcean, Contabo,
  una VM de la universidad, etc.), detrás de **Caddy**, que pone HTTPS automático
  y exige un token. Piston no tiene autenticación propia: sin el proxy,
  cualquiera podría usar el servidor para ejecutar código.

> No uses la API pública `emkc.org`: desde 2025 pide autorización previa y,
> además, enviaría el código de tus estudiantes a un tercero.

---

## Parte 1: el servidor de Piston (VPS)

### Requisitos

| Recurso | Mínimo | Recomendado para un curso de ~40 estudiantes |
|---------|--------|-----------------------------------------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2 GB | 4 GB |
| Disco | 10 GB | 20 GB (los paquetes ocupan ~2.5 GB: Python 1.1 GB, Java y TypeScript el resto) |
| SO | Linux con Docker y cgroups v2 (Ubuntu 22.04/24.04, Debian 12) | — |
| Red | Puertos 80 y 443 abiertos, y un (sub)dominio apuntando a la IP | — |

### Atajo: `setup.sh`

Con la carpeta `docker/piston-vps` copiada al VPS, `bash setup.sh` hace los
pasos 2 a 7 de abajo: instala Docker si falta, crea `.env` (propone
`piston.<ip>.sslip.io` si no tienes dominio, genera el token y ajusta la
concurrencia a los vCPU), levanta todo, instala los lenguajes uno por uno,
prueba por HTTPS e imprime las variables para Railway.

### Pasos (a mano)

1. **DNS**: crea un registro `A` `piston.tu-dominio.com` → IP del VPS.

2. **Instala Docker** en el VPS (por ejemplo
   `curl -fsSL https://get.docker.com | sh`).

3. **Copia la carpeta** [docker/piston-vps/](../../docker/piston-vps/) del repo
   al VPS (o clona el repo) y entra a ella:

   ```bash
   cd docker/piston-vps
   cp .env.example .env
   ```

4. **Genera el token** y escribe `.env`:

   ```bash
   openssl rand -hex 32
   ```

   ```env
   PISTON_DOMAIN=piston.tu-dominio.com
   PISTON_AUTH_TOKEN=<el token generado>
   ```

5. **Levanta** Piston y Caddy:

   ```bash
   docker compose up -d
   ```

   Caddy obtiene el certificado HTTPS solo (tarda unos segundos la primera vez).

6. **Instala los lenguajes** (una sola vez; quedan guardados en el volumen
   `piston_packages`). Desde el VPS, contra el puerto local:

   ```bash
   PISTON_URL=http://127.0.0.1:2000 node ../../scripts/piston-install.mjs
   ```

   Si el VPS no tiene Node, usa curl:

   ```bash
   for p in python:3.12.0 java:15.0.2 typescript:5.0.3; do
     curl -s -X POST http://127.0.0.1:2000/api/v2/packages \
       -H 'Content-Type: application/json' \
       -d "{\"language\":\"${p%%:*}\",\"version\":\"${p##*:}\"}"; echo
   done
   ```

   Son varios cientos de MB: puede tardar de 5 a 20 minutos según la conexión.

7. **Verifica** desde tu computadora:

   ```bash
   # Sin token → 401
   curl -i https://piston.tu-dominio.com/api/v2/runtimes

   # Con token → lista de runtimes
   curl -s https://piston.tu-dominio.com/api/v2/runtimes \
     -H "Authorization: Bearer <token>"

   # Ejecución de prueba
   curl -s https://piston.tu-dominio.com/api/v2/execute \
     -H "Authorization: Bearer <token>" -H 'Content-Type: application/json' \
     -d '{"language":"python","version":"3.12.0","files":[{"name":"main.py","content":"print(2+2)"}]}'
   ```

   La última debe devolver `"stdout":"4\n"`.

### Qué protege el proxy

- Sin `Authorization: Bearer <token>` correcto → `401`.
- Solo deja pasar `/api/v2/execute` y `/api/v2/runtimes`. La instalación de
  paquetes (`/api/v2/packages`) solo es posible por SSH en `127.0.0.1:2000`.
- Limita el cuerpo de cada petición a 2 MB.
- El código del estudiante corre sin red (`PISTON_DISABLE_NETWORKING=true`), con
  límites de tiempo, memoria, procesos y tamaño de salida.

---

## Parte 2: la app en Railway

### Variables de entorno del servicio web

Además de las que ya usa la app (`DATABASE_URL`, `JWT_SECRET`, `AI_*`, `R2_*`…),
agrega estas en **Service → Variables**:

| Variable | Obligatoria | Valor | Para qué |
|----------|-------------|-------|----------|
| `PISTON_URL` | **sí** | `https://piston.tu-dominio.com` | Dónde está Piston (sin `/` final) |
| `PISTON_AUTH_TOKEN` | **sí** con el proxy | el mismo token del `.env` del VPS | Se envía como `Authorization: Bearer …` |
| `PISTON_PYTHON_VERSION` | no | `3.12.0` | Versión fijada; debe estar instalada |
| `PISTON_JAVA_VERSION` | no | `15.0.2` | Ídem |
| `PISTON_TYPESCRIPT_VERSION` | no | `5.0.3` | Ídem |
| `CODE_RUN_TIMEOUT_MS` | no | `3000` | Tiempo máximo de ejecución (Java suma hasta 7 s para compilar) |
| `CODE_COMPILE_TIMEOUT_MS` | no | `10000` | Tiempo máximo de compilación |
| `CODE_RUN_MEMORY_MB` | no | `256` | Memoria por ejecución |
| `CODE_RUN_MAX_FILE_KB` | no | `64` | Tamaño máximo por archivo |
| `CODE_RUN_MAX_TOTAL_KB` | no | `256` | Tamaño total de los archivos |
| `CODE_RUN_MAX_STDIN_KB` | no | `16` | Tamaño máximo del stdin |
| `CODE_RUN_MAX_OUTPUT_KB` | no | `64` | Salida máxima devuelta (por stream) |
| `CODE_RUN_RATE_PER_MIN` | no | `10` | Ejecuciones por minuto por intento/entrega |
| `CODE_RUN_MAX_CONCURRENCY` | no | `4` | Ejecuciones simultáneas en toda la app |

Notas:

- Si subes `CODE_RUN_TIMEOUT_MS` o `CODE_COMPILE_TIMEOUT_MS`, sube también
  `PISTON_RUN_TIMEOUT` / `PISTON_COMPILE_TIMEOUT` en el VPS: son los **máximos**
  que Piston acepta, y rechaza las peticiones que piden más.
- `CODE_RUN_MAX_CONCURRENCY` en la app y `PISTON_MAX_CONCURRENT_JOBS` en el VPS
  conviene que coincidan con los vCPU del VPS.
- El rate limit y el semáforo de concurrencia están **en memoria**. Si escalas el
  servicio web a varias réplicas en Railway, cada réplica tendrá los suyos (el
  `run-limit` por pregunta sí se cuenta en Postgres y vale para todas).

### Migración de base de datos

Esta funcionalidad agrega la migración `20261128005550_add_code_ide` (tipo
`CODE_IDE`, columnas `ideConfig` / `codeFiles` y la tabla `code_runs`). El
`entrypoint.sh` del contenedor ya ejecuta `prisma migrate deploy` al arrancar,
así que se aplica sola en el siguiente despliegue.

### Verificar desde la app

Con sesión de docente, abre:

```
https://<tu-app>.up.railway.app/api/admin/code-runner/health
```

Debe responder `{"ok": true, "reachable": true, "languages": [...]}` con
`"installed": true` en los tres lenguajes. Si `reachable` es `false`, revisa
`PISTON_URL` y el token; si un lenguaje sale `installed: false`, instálalo en el
VPS (paso 6) o ajusta la variable de versión.

Por último, importa [examples/laboratory-ide-sample.md](../../examples/laboratory-ide-sample.md):
la vista previa del docente ya muestra el IDE con **Run** habilitado.

---

## Desarrollo local (sin Railway)

El `docker-compose.yml` del repo ya incluye el servicio `piston`, con el puerto
publicado solo en `127.0.0.1:2000`:

```bash
docker compose up -d postgres piston
npm run piston:install          # usa PISTON_URL=http://localhost:2000 por defecto
npm run dev                     # con PISTON_URL=http://localhost:2000 en .env
```

En Windows o macOS, Docker Desktop corre una VM Linux con cgroups v2, y Piston
funciona en modo privilegiado sin pasos extra. Si `npm run piston:install` falla
con `SELF_SIGNED_CERT_IN_CHAIN`, una VPN o un antivirus está interceptando HTTPS:
desactívalo mientras se descargan los paquetes.

## Problemas frecuentes

| Síntoma | Causa probable |
|---------|----------------|
| La consola dice "El servidor de ejecución no está disponible" | `PISTON_URL` incorrecto, VPS caído o token distinto en ambos lados (mira los logs de Railway: `[code-runner] Piston respondió 401`) |
| `runtime is unknown` en los logs | La versión fijada no está instalada en Piston |
| Java siempre da "Tiempo límite excedido" | VPS con poca CPU: la JVM más la compilación pasan del límite. Sube `CODE_COMPILE_TIMEOUT_MS` (y `PISTON_RUN_TIMEOUT` en el VPS) o usa un VPS con más CPU |
| "Servidor de ejecución ocupado" en clase | Sube `CODE_RUN_MAX_CONCURRENCY` y `PISTON_MAX_CONCURRENT_JOBS` (y los vCPU del VPS) |
| Piston no arranca en el VPS (`cgroup` en los logs) | El kernel no tiene cgroups v2 o falta `privileged: true` |
