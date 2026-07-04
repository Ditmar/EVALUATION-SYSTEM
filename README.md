# Sistema de Evaluación

MVP de una plataforma web de exámenes en línea: el docente importa un examen mediante un archivo/objeto JSON, publica una URL pública, y los estudiantes rinden el examen sin necesidad de cuenta. Incluye control de tiempo, penalidades por actividad sospechosa (cambio de pestaña, pérdida de foco), auto-calificación de preguntas objetivas, evaluación asistida por IA (opcional) para preguntas de código, y un panel de supervisión en vivo para el docente.

## Stack

- **Next.js 14 (App Router) + TypeScript + React** — frontend y backend en una sola app.
- **PostgreSQL + Prisma** — base de datos y ORM.
- **Tailwind CSS** — estilos.
- **CodeMirror 6** (`@uiw/react-codemirror`) — editor con resaltado de sintaxis para JavaScript, TypeScript y Java.
- **jose + bcryptjs** — sesión docente por cookie httpOnly firmada + contraseñas hasheadas.
- **Anthropic SDK** (opcional) — evaluación asistida por IA de preguntas de código.
- **Docker Compose** — entorno de desarrollo local reproducible.
- **Vitest** — pruebas unitarias de la lógica pura (validación, calificación, penalidades, IP predominante).

## Arquitectura (resumen)

```
app/
  admin/            páginas del docente (login, dashboard, importar examen, detalle, calificación)
  exam/[token]/      páginas públicas del estudiante (registro, examen)
  api/admin/*         endpoints protegidos por sesión docente
  api/public/*         endpoints públicos (rate-limited) para el flujo del estudiante
components/
  ui/                primitivos (Button, Input, Modal, Toast, ...)
  admin/             componentes del panel docente
  student/           componentes del flujo de examen del estudiante
lib/
  validation/        esquemas Zod (contrato JSON del examen, registro, actividad)
  grading/           calificación automática y agregación de puntajes (funciones puras)
  auth/              sesión docente (JWT) y sesión de intento del estudiante (JWT por cookie)
  ai/                proveedor de IA desacoplado (interfaz + implementación Anthropic)
  penalties.ts       lógica de penalidades (función pura)
  ip-utils.ts         extracción de IP + cálculo de IP predominante (funciones puras)
prisma/
  schema.prisma       modelo de datos
  seed.ts             crea el docente inicial desde variables de entorno
tests/                pruebas unitarias (Vitest) de toda la lógica pura anterior
docker/               Dockerfile + entrypoint.sh
```

No hay microservicios ni colas: es una sola aplicación Next.js con Postgres, pensada para ser simple de levantar y entender.

## Puesta en marcha (Docker, recomendado)

1. Copia el archivo de variables de entorno y ajusta lo que necesites (como mínimo, cambia `JWT_SECRET` y `SEED_TEACHER_PASSWORD`):

   ```bash
   cp .env.example .env
   ```

2. Levanta todo (Postgres + la app). El propio contenedor `web` aplica las migraciones y crea el docente inicial al arrancar:

   ```bash
   docker compose up --build
   ```

3. Abre `http://localhost:3000/admin/login` e ingresa con `SEED_TEACHER_EMAIL` / `SEED_TEACHER_PASSWORD` (los valores por defecto de `.env.example`).

> Nota: si el puerto `5432` ya está ocupado en tu máquina por otro Postgres, el `docker-compose.yml` de este proyecto expone Postgres en `5433` en el host (el contenedor `web` igual se conecta a `postgres:5432` internamente, así que esto no afecta el funcionamiento). Ajusta el mapeo de puertos si lo prefieres distinto.

## Puesta en marcha (desarrollo local sin Docker para la app)

Útil si quieres correr `npm run dev` con hot-reload y sólo usar Docker para la base de datos.

```bash
cp .env.example .env
docker compose up -d postgres      # sólo la base de datos
npm install
npm run prisma:migrate             # aplica/crea migraciones
npm run prisma:seed                # crea el docente inicial
npm run dev                        # http://localhost:3000
```

## Comandos útiles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con hot-reload |
| `npm run build` / `npm run start` | Build y arranque en modo producción |
| `npm run prisma:migrate` | Crea/aplica una migración en desarrollo |
| `npm run prisma:deploy` | Aplica migraciones existentes (usado en el contenedor) |
| `npm run prisma:seed` | Crea o actualiza el docente inicial desde el entorno |
| `npm test` | Corre toda la suite de Vitest |

## Flujo del docente

1. Inicia sesión en `/admin/login`.
2. En `/admin/exams/new`, pega el JSON del examen (hay un botón "Cargar ejemplo"), valida y previsualiza, y guarda.
3. En el detalle del examen (`/admin/exams/[id]`) puedes publicar/despublicar, copiar la URL pública, ver en vivo quién está rindiendo (con alerta si alguien está en una IP distinta a la predominante del grupo), ver los intentos finalizados, calificar manualmente las preguntas de código (con evaluación asistida por IA opcional) y exportar los resultados a CSV.

## Flujo del estudiante

1. Abre la URL pública del examen (`/exam/[token]`). Ve los datos del examen, las instrucciones y el aviso de monitoreo, y completa nombres, apellidos, CI y correo, aceptando los términos.
2. Al iniciar, se crea su intento en el servidor (hora de inicio real) y pasa a la pantalla de preguntas, con un cronómetro sticky, guardado automático de respuestas, indicador de respondidas/pendientes, y un editor con resaltado de sintaxis para las preguntas de código.
3. Puede finalizar manualmente (con confirmación) o el examen se envía automáticamente al llegar el tiempo a cero, o si acumula demasiadas incidencias de supervisión (ver abajo).

Recargar la página no reinicia el cronómetro (se calcula desde la hora de inicio guardada en el servidor) ni permite editar los datos personales; el mismo navegador retoma el mismo intento mediante una cookie firmada.

## Contrato JSON del examen

El docente importa un examen pegando un JSON con esta forma. `settings` es opcional (se aplican los valores por defecto indicados). Los campos de estado (token público, publicado/despublicado, fechas reales de apertura/cierre, IDs internos) **no** van en el JSON: los genera y administra el sistema.

```json
{
  "metadata": {
    "title": "Primer Parcial de Programación II",
    "career": "Ingeniería de Sistemas",
    "academicTerm": "Gestión 2026",
    "subject": "Programación II",
    "examDate": "2026-07-10",
    "durationMinutes": 90,
    "instructions": "Lea cuidadosamente cada pregunta antes de responder.",
    "evaluationType": "Examen parcial"
  },
  "settings": {
    "maxPenalties": 3,
    "onMaxPenalties": "auto_submit",
    "trackFocusEvents": true,
    "monitorExternalIps": true,
    "differentIpPolicy": "warn_only",
    "allowAiCodeEvaluation": true
  },
  "questions": [
    {
      "id": "q1",
      "type": "single_choice",
      "statement": "¿Cuál es la complejidad temporal de una búsqueda binaria?",
      "points": 10,
      "options": [
        { "id": "a", "text": "O(n)" },
        { "id": "b", "text": "O(log n)" },
        { "id": "c", "text": "O(n²)" },
        { "id": "d", "text": "O(1)" }
      ],
      "correctAnswer": "b"
    },
    {
      "id": "q2",
      "type": "multiple_choice",
      "statement": "Seleccione las estructuras de datos lineales.",
      "points": 15,
      "options": [
        { "id": "a", "text": "Pila" },
        { "id": "b", "text": "Cola" },
        { "id": "c", "text": "Árbol binario" },
        { "id": "d", "text": "Lista enlazada" }
      ],
      "correctAnswers": ["a", "b", "d"]
    },
    {
      "id": "q3",
      "type": "code",
      "statement": "Implemente una función recursiva para calcular el factorial de un número.",
      "points": 25,
      "language": "javascript",
      "expectedSolution": "function factorial(n) { ... }",
      "rubric": "Debe usar recursividad, manejar el caso base y devolver el valor correcto.",
      "enableAiEvaluation": true
    }
  ]
}
```

Este mismo JSON está disponible en [`examples/exam-sample.json`](examples/exam-sample.json) y también se puede cargar directamente desde la interfaz (botón "Cargar ejemplo" en Nuevo examen).

### Campos

**`metadata`**: `title`, `career`, `academicTerm`, `subject`, `examDate` (`YYYY-MM-DD`), `durationMinutes` (minutos, entero positivo), `instructions`, `evaluationType`. Todos obligatorios.

**`settings`** (todos opcionales, con los valores por defecto mostrados):
- `maxPenalties` (default `3`): incidencias de supervisión permitidas antes de actuar.
- `onMaxPenalties` (default `"auto_submit"`): `"auto_submit"` | `"warn_only"` | `"lock_exam"` — qué pasa al llegar al máximo.
- `trackFocusEvents` (default `true`): activa el monitoreo de cambio de pestaña/foco.
- `monitorExternalIps` (default `true`): activa el análisis de IP en el panel docente.
- `differentIpPolicy` (default `"off"`): `"off"` | `"warn_only"` | `"block"` (este último **reservado en el esquema pero no aplicado** en este MVP — nunca bloquea).
- `allowAiCodeEvaluation` (default `true`): habilita el botón de evaluación con IA a nivel de examen (además debe habilitarse por pregunta).

**`questions[]`**: cada una necesita `id` (único dentro del examen), `type`, `statement`, `points` (> 0).
- `single_choice`: `options` (≥2, `{id, text}`), `correctAnswer` (debe existir en `options`).
- `multiple_choice`: `options` (≥2), `correctAnswers` (array, todos deben existir en `options`). La calificación es **todo o nada**: sólo se otorga el puntaje completo si el conjunto seleccionado coincide exactamente con el correcto — no hay puntaje parcial en este MVP.
- `code`: `language` (`"javascript"` | `"typescript"` | `"java"`), `expectedSolution` (opcional, sólo referencia para el docente), `rubric` (opcional), `enableAiEvaluation` (booleano). Las preguntas de código **nunca se ejecutan ni se autocalifican**: quedan pendientes de revisión manual, con evaluación por IA opcional como sugerencia.

## Evaluación y calificación

- `single_choice` / `multiple_choice` se califican automáticamente al guardar cada respuesta.
- `code` queda "pendiente de revisión" hasta que el docente asigna un puntaje manual. Si el examen y la pregunta tienen la evaluación con IA habilitada, el docente puede pedir una sugerencia (puntaje + justificación breve) desde el panel de calificación; la sugerencia se guarda como un registro aparte (`AiEvaluation`) y **nunca se aplica sola** como nota final — el docente debe aceptarla, editarla o ignorarla.
- El puntaje total de un intento es la suma de: nota manual si existe, si no la nota automática, si no 0 (pendiente).

## Control de actividad (idle / posible fraude)

Mientras el estudiante rinde el examen, el navegador reporta al servidor:
- Cambio de pestaña (`visibilitychange` → oculto).
- Pérdida de foco de la ventana (`blur`, evitando contar dos veces el mismo cambio de pestaña).
- Salida de pantalla completa (`fullscreenchange`), si el estudiante llegó a usarla.
- Un latido periódico (`heartbeat`) y un intento de aviso al cerrar/recargar (`beforeunload`, mejor esfuerzo vía `sendBeacon`).

Sólo cambio de pestaña, pérdida de foco y salida de pantalla completa cuentan como **penalidad**; el latido y la reconexión son puramente informativos. Cada vez que se registra una penalidad, el estudiante ve cuántas lleva y cuántas le quedan antes de que actúe la política configurada (`onMaxPenalties`). Al llegar al máximo:
- `auto_submit`: el intento se envía tal como está.
- `lock_exam`: el intento se marca como `LOCKED`, se congelan las respuestas y se calcula la nota automática de lo ya respondido, quedando visible para el docente como bloqueado (no como un envío limpio).
- `warn_only`: sigue advirtiendo, sin bloquear ni enviar.

Estos eventos se muestran al docente como **"alertas de supervisión"**, explícitamente no como prueba definitiva de fraude.

## Seguimiento de IP

Se guarda la IP observada en cada intento (primer salto de `X-Forwarded-For` si `TRUST_PROXY=true`, si no la dirección que expone el runtime de Next.js). En el panel docente, si `monitorExternalIps` y `differentIpPolicy` distinto de `off` están activos, se calcula la IP predominante entre los estudiantes que están rindiendo y se marca a quienes estén en una IP distinta con un mensaje como:

> "Juan Pérez está realizando el examen desde una IP distinta a la predominante del laboratorio."

Esto es sólo informativo: nunca bloquea al estudiante automáticamente. `differentIpPolicy: "block"` está reservado en el esquema para el futuro, pero no tiene efecto en este MVP.

### Sobre proxies confiables

`X-Forwarded-For` puede ser falsificado por el propio cliente si no hay un proxy de por medio que lo sobrescriba. Sólo activa `TRUST_PROXY=true` si la aplicación corre detrás de un proxy inverso de confianza (nginx, Caddy, un load balancer) configurado para fijar ese encabezado con la IP real; si no, deja `TRUST_PROXY=false` y ten en cuenta que la IP observada dependerá de lo que el runtime de Node/Next exponga como dirección remota (ver limitaciones).

## Seguridad implementada

- Validación estricta del JSON de importación y del registro del estudiante con Zod.
- Rutas `/admin/*` protegidas por middleware (sesión JWT en cookie httpOnly); `/api/admin/*` protegidas explícitamente en cada handler.
- Contraseñas con `bcrypt`; sesión docente y sesión de intento del estudiante como JWT firmados en cookies httpOnly (`secure` configurable con `COOKIE_SECURE`).
- Tokens de URL pública generados con `crypto.randomBytes` (24 bytes, base64url) — no predecibles.
- Un intento por CI por examen (restricción única en base de datos) + cookie de intento con verificación de que corresponde al examen correcto.
- Envío del examen protegido por bloqueo de estado (no se puede seguir respondiendo tras `SUBMITTED`/`EXPIRED`/`LOCKED`) y es idempotente ante reintentos.
- Las respuestas correctas, la solución esperada y la rúbrica **nunca** se envían al navegador del estudiante antes de calificar.
- Rate limiting en memoria sobre los endpoints públicos (`register`, `answers`, `activity`, `submit`).
- React escapa por defecto todo el contenido; no se usa `dangerouslySetInnerHTML` en ningún dato provisto por estudiantes o docentes.
- La clave de IA (`AI_API_KEY`) sólo se lee en el servidor; nunca se expone al cliente.

## Limitaciones conocidas del MVP

- **Sin WebSockets**: el panel docente "en vivo" hace *polling* cada ~5s en vez de usar conexiones en tiempo real. Suficiente para el tamaño de un curso, no para monitoreo instantáneo a gran escala.
- **Expiración de intentos "perezosa"**: un intento `IN_PROGRESS` vencido sólo se finaliza cuando algo lo consulta (el panel docente, el propio estudiante al abrir `/attempt`, o un envío). No hay un cron/worker en segundo plano. En el uso normal el propio estudiante dispara el auto-envío al llegar el cronómetro a cero, y el docente lo ve finalizado la próxima vez que abre el panel.
- **Rate limiting en memoria de un solo proceso**: se reinicia si el contenedor se reinicia y no coordina entre réplicas — válido para un único contenedor, no para escalado horizontal.
- **Detección de cambio de pestaña/foco no es infalible**: son señales de mejor esfuerzo del navegador (`visibilitychange`/`blur`/`fullscreenchange`), no una prueba definitiva; pueden evadirse y también producir falsos positivos (un alt-tab legítimo). Por eso se presentan como "alertas de supervisión".
- **La IP observada puede ser compartida o falsificable**: sin un proxy confiable configurado (`TRUST_PROXY=true` + encabezado `X-Forwarded-For` fijado por ese proxy), no hay forma de verificar la IP real del estudiante; además, un laboratorio entero detrás de NAT comparte la misma IP pública legítimamente. La alerta de "IP distinta" es sólo un indicio para que el docente investigue, nunca una prueba.
- **Sin ejecución de código**: las preguntas de código nunca se compilan ni se corren; se califican manualmente o con una sugerencia de IA no vinculante. La arquitectura (proveedor de IA desacoplado, tipo de pregunta `code` con `language`) está pensada para poder añadir ejecución en sandbox más adelante sin rediseñar el resto del sistema.
- **Un solo intento por CI por examen**: no hay una UI para "reiniciar" el intento de un estudiante; requiere borrar el registro directamente en la base de datos si de verdad hace falta un reintento.
- **`differentIpPolicy: "block"`** está en el esquema pero no tiene ningún efecto todavía — sólo `off` y `warn_only` están implementados.

## Pruebas

```bash
npm test
```

Cubre, sobre funciones puras en `lib/` (sin necesidad de base de datos):
- **Validación del contrato JSON** (`tests/validation/exam-schema.test.ts`): examen válido, `settings` por defecto, fechas mal formadas, referencias de `correctAnswer`/`correctAnswers` a opciones inexistentes, ids de pregunta duplicados, idioma de código inválido.
- **Validación del registro del estudiante** (`tests/validation/student-schema.test.ts`).
- **Calificación automática** (`tests/grading/auto-grade.test.ts`): opción única, opción múltiple todo-o-nada, y que `toStudentQuestion` efectivamente retire las claves de respuesta.
- **Lógica de penalidades** (`tests/penalties.test.ts`): qué cuenta como penalidad, comportamiento en `warn_only`/`lock_exam`/`auto_submit` al llegar al umbral.
- **IP predominante** (`tests/ip-utils.test.ts`): extracción de IP según `trustProxy`, cálculo de moda con empates, conjunto vacío/único.
- **Tokens, CSV y rate limiting** (`tests/tokens.test.ts`, `tests/csv.test.ts`, `tests/rate-limit.test.ts`).
