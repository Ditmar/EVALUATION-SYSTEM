# Spec: IDE embebido con ejecución en Piston (`type="ide"`)

| Campo        | Valor                                                       |
|--------------|-------------------------------------------------------------|
| Estado       | Implementado (v1) — ver §14 "Decisiones de implementación"  |
| Fecha        | 2026-11-27                                                  |
| Alcance      | Laboratorios (Markdown) y Exámenes (JSON)                   |
| Lenguajes v1 | Python, Java, TypeScript                                    |
| Depende de   | Piston self-hosted (`ghcr.io/engineer-man/piston`)          |

---

## 1. Objetivo

Hoy una pregunta `code` es un editor CodeMirror que guarda texto: el código
**nunca se ejecuta** (ver `lib/laboratory/laboratory-spec.md`, "`code` nunca se
ejecuta ni se autocalifica"). El estudiante escribe "a ciegas" y el docente
califica leyendo.

Este spec agrega un nuevo tipo de respuesta, **`ide`**, que convierte la
pregunta en un mini IDE:

- editor de código con **uno o varios archivos** (pestañas);
- botón **Run** (y `Ctrl/Cmd + Enter`);
- **consola** para ver stdout, stderr, errores de compilación, código de
  salida y tiempo;
- campo de **stdin** opcional;
- ejecución real en un sandbox **Piston** alojado por nosotros, siempre a
  través del backend, nunca directo desde el navegador.

Se declara como cualquier otra pregunta, **con un placeholder `{{answer}}`**:

```md
{{answer
  id="fibonacci"
  type="ide"
  language="python"
  points="10"
  evaluator="manual"
  placeholder="Implemente fib(n) y muestre los 10 primeros términos"
}}
```

### 1.1 Fuera de alcance (v1)

- Autocalificación con casos de prueba (diseñada en §11 como fase 2, no
  bloquea v1).
- Entrada interactiva (stdin en vivo mientras corre el programa): Piston
  ejecuta en lote, el stdin se manda completo antes de correr.
- Dependencias externas (pip, Maven, npm). Solo biblioteca estándar.
- Acceso a red desde el código del estudiante (deshabilitado en Piston).
- Lenguajes distintos de Python / Java / TypeScript (la arquitectura los
  admite agregando una entrada a un mapa; ver §6.2).
- Migrar los exámenes de JSON a Markdown.

---

## 2. Contexto actual (lo que ya existe y se reutiliza)

| Pieza | Archivo | Rol en este spec |
|-------|---------|------------------|
| Editor CodeMirror 6 | `components/CodeEditor.tsx` | Base del IDE (ver §3) |
| Respuesta `code` de laboratorio | `components/laboratory/answers/CodeAnswer.tsx` | Patrón de borrador local + autosave con debounce, que se copia |
| Registro de tipos | `components/laboratory/answers/registry.ts` | Se agrega `ide: IdeAnswer` |
| Parser de placeholders | `lib/laboratory/parse-placeholder.ts` | Nuevo `case "ide"` |
| Bloques `{{rubric}}...{{/rubric}}` | `lib/laboratory/extract-rubrics.ts` | Mismo patrón para `{{files}}` (§4.3) |
| Tipos del laboratorio | `lib/laboratory/types.ts` | `IdeQuestion`, `IdeAnswerValue` |
| Pregunta `code` de examen | `lib/validation/exam-schema.ts`, `components/student/CodeQuestion.tsx` | Nuevo tipo `"ide"` en el JSON |
| Autosave del examen | `app/api/public/exams/[token]/answers/[questionId]/route.ts` | Se extiende con `codeFiles` |
| Autosave del laboratorio | `app/api/student/laboratories/[labId]/submission/answers/route.ts` | `AnswerValueSchema` acepta el objeto de archivos |
| Rate limit por identidad | `lib/rate-limit-guard.ts` (`checkRateLimitByKey`) | Se reutiliza para limitar ejecuciones |
| Evaluación con IA | `lib/ai/prompt.ts` | Recibe todos los archivos y la última corrida |

Hay **dos sistemas de evaluación** distintos y el IDE debe funcionar en ambos:

1. **Laboratorios**: Markdown con placeholders `{{answer}}`; respuestas en
   `LaboratorySubmission.answers` (JSON). Aquí está el placeholder "de toda la
   vida" (y también los `.md` llamados "examen", como
   `examen_apocalipsis_zombi.md`, que en realidad son laboratorios).
2. **Exámenes**: importados como JSON (`examples/exam-sample.json`) a las
   tablas `Question` y `Answer` de Prisma, con anti-trampa (foco, IP,
   capturas).

---

## 3. Decisión: ¿sirve el editor actual o hace falta uno mejor?

### 3.1 Evaluación

| Criterio | CodeMirror 6 (actual) | Monaco (VS Code) |
|----------|-----------------------|------------------|
| Peso en el bundle | ~150–300 KB según extensiones | ~2–5 MB + web workers |
| Móvil / táctil | Bueno (ya hay vista móvil, commit `11c08ad`) | Pobre; Microsoft no lo soporta en móvil |
| SSR / Next 14 | Ya integrado (`"use client"`) | Requiere `dynamic(..., { ssr: false })` y configurar los workers |
| Varios archivos | Sí: un `EditorState` por archivo | Sí: modelos nativos |
| IntelliSense TS | No (y en un examen es una **ventaja**) | Sí, completo; en un examen **da pistas** |
| Rendimiento con varias instancias | Ya resuelto (caché de extensiones, `memo`) | Cada instancia es pesada |
| Costo de migrar | Cero | Reescribir el editor, el grader y la vista previa |

### 3.2 Decisión

**Se mantiene CodeMirror 6** y se mejora. Monaco aporta sobre todo
IntelliSense, que en una evaluación no queremos, y cuesta mucho peso, soporte
móvil y trabajo de integración.

Mejoras al `CodeEditor` actual (todas son paquetes oficiales de CM6, sin
cambiar la API del componente):

1. **Gramáticas de primera clase** en lugar de los modos legacy:
   - `@codemirror/lang-java` reemplaza a `clike` + `JAVA_KEYWORDS`;
   - `@codemirror/lang-python` reemplaza al modo legacy de Python;
   - TypeScript ya usa `@codemirror/lang-javascript` con `typescript: true`.

   Con esto la indentación, el plegado y la coincidencia de llaves son más
   precisos. Los demás lenguajes siguen con sus modos legacy.
2. **Atajo de teclado** `Mod-Enter` para el Run, pasado como prop
   `onRun?: () => void` (con `Prec.highest` para que gane sobre el keymap por
   defecto).
3. **Tab indenta** (`indentWithTab`) solo dentro del IDE; `Esc` y luego `Tab`
   sale del editor (accesibilidad; documentarlo en la UI).
4. **Autocompletado desactivado por defecto**
   (`basicSetup.autocompletion = false`); se puede activar con el atributo
   `autocomplete="true"`.
5. Prop nueva `extraExtensions` opcional; se cachea igual que
   `extensionsFor` para no romper la optimización de latencia del commit
   `faf582a`.

**Si más adelante se quisiera Monaco** (p. ej. un curso que necesita
IntelliSense), el diseño lo permite: el componente `IdeWorkspace` (§7) solo
depende de la interfaz `value / onChange / language / onRun` del editor.

---

## 4. Autoría: el placeholder `type="ide"`

### 4.1 Atributos

Además de los comunes (`id`, `points`, `required`, `placeholder`, `evaluator`):

| Atributo | Obligatorio | Default | Descripción |
|----------|-------------|---------|-------------|
| `language` | sí | — | `python` \| `java` \| `typescript` (alias: `py`, `ts`) |
| `mode` | no | `single` | `single`: un solo archivo principal. `multi`: varios archivos con pestañas |
| `entry` | no | según lenguaje (§6.2) | Nombre del archivo principal que se ejecuta |
| `allow-new-files` | no | `true` si `mode="multi"` | El estudiante puede crear, renombrar y borrar archivos (salvo `entry` y los de solo lectura) |
| `max-files` | no | `10` | Máximo de archivos (techo duro del servidor: 20) |
| `stdin` | no | vacío | Entrada estándar por defecto, precargada en la pestaña "Entrada" de la consola |
| `stdin-editable` | no | `true` | Si el estudiante puede modificar el stdin |
| `run` | no | `true` | `false` muestra el IDE sin botón Run (útil para un "examen en papel" con editor bonito) |
| `run-limit` | no | sin límite | Máximo de ejecuciones por pregunta y estudiante (contadas en el servidor) |
| `autocomplete` | no | `false` | Activa el autocompletado de CodeMirror |
| `height` | no | `360` | Altura del editor en px |

`evaluator`: `manual` (default) o `ai`. `automatic` solo se acepta cuando se
implemente la fase 2 (§11); en v1 da error de parseo.

### 4.2 Modo `single` (un solo archivo)

```md
Escriba un programa que lea `n` y muestre los `n` primeros números de Fibonacci.

{{answer
  id="fib"
  type="ide"
  language="python"
  points="10"
  stdin="10"
}}
```

El estudiante ve un editor con `main.py` vacío (o con el código de §4.3), el
botón Run y la consola. La respuesta guardada es ese archivo.

### 4.3 Archivos iniciales: bloque `{{files}}`

Los atributos no admiten código multilínea, así que los archivos iniciales se
declaran en un bloque aparte, con el mismo patrón que `{{rubric}}`. El parser
lo extrae **antes** de procesar el Markdown y no se renderiza en línea.

````md
{{answer
  id="inventario"
  type="ide"
  language="java"
  mode="multi"
  entry="Main.java"
  points="15"
}}

{{files for="inventario"}}
```java file="Main.java"
public class Main {
    public static void main(String[] args) {
        Inventario inv = new Inventario();
        // TODO: agregue 3 productos y muestre el total
    }
}
```

```java file="Inventario.java"
public class Inventario {
    // TODO: implemente agregar() y total()
}
```

```java file="Producto.java" readonly="true"
public class Producto { /* nombre, precio, cantidad + getters */ }
```
{{/files}}
````

Reglas:

- Cada bloque de código cercado (```` ``` ````) dentro de `{{files}}` es un
  archivo. Su *info string* lleva `file="Nombre.ext"` (obligatorio) y
  opcionalmente `readonly="true"`.
- `for` debe apuntar a una pregunta `type="ide"` existente.
- Si no hay `{{files}}`, se crea un archivo `entry` vacío.
- Si hay `{{files}}` pero ninguno se llama como `entry`, es error de parseo.
- En `mode="single"` solo se permite un archivo **editable**; puede haber
  más de solo lectura (p. ej. un `Utils.java` dado), que se ven como pestañas
  bloqueadas.
- Los archivos `readonly` **no se guardan en la respuesta del estudiante**:
  el servidor siempre usa la versión del enunciado al ejecutar y al
  calificar, para que no se puedan modificar desde el cliente.

### 4.4 Validaciones del nombre de archivo (parser y servidor)

- Regex: `^[A-Za-z_][A-Za-z0-9_.-]{0,63}$`. Sin `/`, sin `..`, sin rutas.
- La extensión debe corresponder al lenguaje (`.py`; `.java`; `.ts`). Se
  permiten además `.txt`, `.csv`, `.json` como archivos de datos que el
  programa puede leer.
- Java: si el archivo declara `public class X`, debe llamarse `X.java`. Se
  avisa como **warning**, no como error (el compilador lo reportará igual).
- Nombres únicos sin distinguir mayúsculas de minúsculas.

### 4.5 Exámenes (JSON)

Equivalente en `exam-schema.ts`, como un tipo nuevo de la unión
discriminada:

```json
{
  "id": "q4",
  "type": "ide",
  "statement": "Implemente la clase Inventario...",
  "points": 15,
  "language": "java",
  "mode": "multi",
  "entry": "Main.java",
  "allowNewFiles": true,
  "maxFiles": 10,
  "stdin": "",
  "runLimit": 30,
  "files": [
    { "name": "Main.java", "content": "public class Main { ... }" },
    { "name": "Producto.java", "content": "public class Producto { ... }", "readonly": true }
  ],
  "expectedSolution": "...",
  "rubric": "...",
  "enableAiEvaluation": true
}
```

Mismas reglas que §4.3 y §4.4, validadas con Zod.

---

## 5. Experiencia del estudiante (UI)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ☰ Archivos   │ Main.java ▶ │ Inventario.java ● │ Producto.java 🔒 │ + │
├──────────────┼───────────────────────────────────────────────────────┤
│ ▶ Main.java  │  1  public class Main {                               │
│   Inventario │  2      public static void main(String[] args) {      │
│ 🔒 Producto  │  3          Inventario inv = new Inventario();        │
│              │  4          ...                                       │
│ [+ Archivo]  │                                                       │
├──────────────┴───────────────────────────────────────────────────────┤
│ [▶ Run  Ctrl+Enter]  Java 15.0.2          Guardado ✓   ejecuciones 4/30 │
├──────────────────────────────────────────────────────────────────────┤
│ Salida │ Entrada (stdin) │                                 [Limpiar]   │
│ $ javac *.java && java Main                                           │
│ Total: 1520.5                                                         │
│ Exception in thread "main" java.lang.NullPointerException   (rojo)    │
│ ── exit 1 · 412 ms ───────────────────────────────────────────────── │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.1 Editor y archivos

- `mode="single"`: sin barra lateral; solo pestañas si hay archivos de solo
  lectura.
- `mode="multi"`: barra lateral plegable con la lista de archivos (en móvil,
  un `<select>` en lugar de la barra lateral).
- `▶` marca el archivo `entry`: no se puede borrar ni renombrar.
- `🔒` marca los archivos de solo lectura.
- `●` marca cambios aún no guardados (se borra cuando el autosave confirma).
- Crear / renombrar / borrar: con un popover sencillo; se validan las reglas
  de §4.4 en el cliente y luego en el servidor.
- Un `EditorState` por archivo, para que cada pestaña conserve su propio
  deshacer/rehacer y su cursor al cambiar de pestaña.
- Botón "Restaurar plantilla" con confirmación: vuelve a los archivos
  iniciales.

### 5.2 Run

- Deshabilitado mientras corre (spinner) y cuando el intento/entrega ya no
  está en curso.
- Antes de ejecutar **se fuerza el guardado** (flush del debounce), así lo que
  corre es lo que queda guardado.
- El cliente manda los archivos editables y el stdin; **nunca** manda el
  lenguaje, la versión, los límites ni el `entry` (el servidor los toma de la
  pregunta).
- Si existe `run-limit`, se muestra "ejecuciones N/M"; al llegar al límite el
  botón se deshabilita con un mensaje.
- Timeout del lado cliente de 30 s (`AbortController`) con el mensaje "El
  servidor de ejecución no respondió".

### 5.3 Consola

- Pestañas **Salida** y **Entrada (stdin)**.
- Muestra, en este orden: la línea de comando informativa, la salida de
  compilación (si hay, en ámbar), stdout (normal), stderr (rojo) y una línea de
  estado: `exit <code> · <ms> ms`.
- Estados especiales con mensajes claros en español:
  - `SIGKILL` por tiempo → "Tiempo límite excedido (3 s). ¿Hay un bucle
    infinito?"
  - memoria → "Memoria límite excedida (256 MB)"
  - compilación fallida → "Error de compilación" y no se muestra la etapa de
    ejecución
  - salida truncada → "… salida truncada (máx. 64 KB)"
- Solo texto: se renderiza en `<pre>` con texto escapado, **nunca** como HTML.
  Los códigos ANSI se eliminan.
- Altura ajustable (arrastrar), con mínimo de 120 px. "Limpiar" vacía la vista
  (no borra el historial del servidor).
- La consola guarda la última corrida en `sessionStorage`, para que un
  refresco no la pierda.

### 5.4 Interacción con el anti-trampa del examen

- Ejecutar no abre ventanas ni saca de pantalla completa: no genera eventos
  `TAB_HIDDEN`, `WINDOW_BLUR` ni `FULLSCREEN_EXIT`.
- Las capturas de pantalla (`requireScreenCapture`) siguen funcionando igual.
- Copiar y pegar en el IDE funciona igual que en el resto del examen; si
  conviene registrarlo es una pregunta abierta (§13).
- El IDE no usa diálogos nativos (`window.confirm`/`prompt`): un diálogo nativo
  quita el foco de la ventana y el monitor lo contaría como incidencia. Borrar
  un archivo o restaurar la plantilla se confirma con un segundo clic.

---

## 6. Backend

### 6.1 Arquitectura

```
Navegador (IdeWorkspace)
   │  POST /api/.../run   { questionId, files[], stdin }
   ▼
Route handler Next.js  ── auth (sesión de intento o de estudiante)
   │                   ── ¿intento/entrega en curso? ¿no vencido?
   │                   ── ¿pregunta type=ide? ¿run habilitado?
   │                   ── validar archivos (§4.4, límites §6.4)
   │                   ── rate limit + run-limit + semáforo de concurrencia
   ▼
lib/code-runner/piston-client.ts ── arma el payload desde la pregunta
   │  POST http://piston:2000/api/v2/execute   (red interna de Docker)
   ▼
Piston (isolate sandbox, sin red)
   │
   ▼
Normalizar resultado → guardar CodeRun (§8.3) → responder al cliente
```

Rutas nuevas:

| Ruta | Auth | Uso |
|------|------|-----|
| `POST /api/public/exams/[token]/run` | sesión de intento (`getAttemptSessionFromRequest`) | Estudiante en examen |
| `POST /api/student/laboratories/[labId]/run` | `requireStudentSession` | Estudiante en laboratorio |
| `POST /api/admin/code-runner/run` | `requireAdminSession` | Vista previa al importar y re-ejecución en la vista de calificación |
| `GET /api/admin/code-runner/health` | admin | Estado de Piston y runtimes instalados |

### 6.2 Mapa de lenguajes

`lib/code-runner/languages.ts`, la **única** fuente de verdad:

```ts
export const IDE_LANGUAGES = {
  python:     { piston: "python",     version: env("PISTON_PYTHON_VERSION", "3.12.0"), entry: "main.py",   exts: [".py"] },
  java:       { piston: "java",       version: env("PISTON_JAVA_VERSION",   "15.0.2"), entry: "Main.java", exts: [".java"] },
  typescript: { piston: "typescript", version: env("PISTON_TS_VERSION",     "5.0.3"),  entry: "main.ts",   exts: [".ts"] },
} as const;
```

- Las versiones se **fijan** (no `*`) para que la misma entrega dé el mismo
  resultado durante todo el semestre.
- Al arrancar (o en `/health`) se compara contra `GET /api/v2/runtimes` y se
  registra un error si falta alguno.
- Agregar un lenguaje = una entrada aquí + el paquete instalado en Piston +
  la gramática en `CodeEditor`.

### 6.3 Cómo se arma la ejecución

Payload a Piston:

```json
{
  "language": "java",
  "version": "15.0.2",
  "files": [
    { "name": "Main.java", "content": "..." },
    { "name": "Inventario.java", "content": "..." },
    { "name": "Producto.java", "content": "..." }
  ],
  "stdin": "10",
  "args": [],
  "compile_timeout": 10000,
  "run_timeout": 3000,
  "compile_memory_limit": 268435456,
  "run_memory_limit": 268435456
}
```

- **El archivo `entry` va siempre primero**: Piston ejecuta el primer archivo
  de `files`.
- Los archivos `readonly` se toman del enunciado (snapshot del laboratorio o
  `Question.ideConfig`), no del cliente.
- Python multiarchivo funciona directamente: Piston escribe todos los
  archivos en el mismo directorio, así que `import utils` funciona.
- **Java y TypeScript multiarchivo deben verificarse en la fase 0** (§12):
  - el paquete oficial `java` de Piston ejecuta en *single-file source mode*
    (`java Main.java`), que **no** ve las otras clases. Opciones, en orden de
    preferencia:
    1. un paquete JDK ≥ 22, cuyo lanzador de código fuente admite varios
       archivos (JEP 458), si lo hay o se puede construir;
    2. un **paquete propio** `java-multi` (Piston admite paquetes propios) con
       `compile: javac -d out *.java` y `run: java -cp out <MainClass>`;
    3. como último recurso, concatenar las clases no públicas en un solo
       archivo (frágil; no recomendado).
  - el paquete `typescript` compila con `tsc`; hay que confirmar que compila
    todos los `.ts` y que los `import` relativos (`./inventario`) resuelven.
    Alternativa: el paquete `deno`, que ejecuta TS directamente y resuelve
    imports relativos.

### 6.4 Límites (servidor, no configurables por el cliente)

| Límite | Default | Variable de entorno |
|--------|---------|---------------------|
| Tiempo de ejecución | 3 s | `CODE_RUN_TIMEOUT_MS` |
| Tiempo de compilación | 10 s | `CODE_COMPILE_TIMEOUT_MS` |
| Memoria | 256 MB | `CODE_RUN_MEMORY_MB` |
| Tamaño por archivo | 64 KB | `CODE_RUN_MAX_FILE_KB` |
| Tamaño total de archivos | 256 KB | `CODE_RUN_MAX_TOTAL_KB` |
| Cantidad de archivos | `max-files` de la pregunta, techo 20 | — |
| stdin | 16 KB | `CODE_RUN_MAX_STDIN_KB` |
| Salida devuelta al cliente | 64 KB por stream | `CODE_RUN_MAX_OUTPUT_KB` |
| Ejecuciones por minuto | 10 por intento/entrega | `CODE_RUN_RATE_PER_MIN` |
| Ejecuciones simultáneas (toda la app) | 4 | `CODE_RUN_MAX_CONCURRENCY` |

- El rate limit usa `checkRateLimitByKey` con claves como `attempt:<id>` o
  `submission:<id>`, **no** por IP, por la misma razón que el autosave: un
  aula entera detrás de un NAT.
- La concurrencia se controla con un semáforo en memoria: si no hay cupo se
  espera hasta 10 s y luego se responde `503` con "Servidor de ejecución
  ocupado, intente de nuevo". Esto es suficiente para un solo contenedor,
  igual que `RateLimiter`; en un despliegue con varias instancias habría que
  llevarlo a Postgres o Redis.
- `run-limit` se cuenta con `CodeRun` en la base de datos (persistente,
  sobrevive a reinicios).

### 6.5 Respuesta normalizada

```ts
type RunResult = {
  status: "ok" | "runtime_error" | "compile_error" | "timeout" | "memory" | "unavailable";
  language: string;      // "java"
  version: string;       // "15.0.2"
  compile?: { output: string; code: number | null };
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null; // "SIGKILL"
  durationMs: number;    // medido en el servidor
  truncated: boolean;
  runsUsed?: number;     // si hay run-limit
  runsLimit?: number;
};
```

Errores HTTP: `400` archivos inválidos, `401` sin sesión, `403` pregunta sin
Run, `409` intento finalizado o vencido, `429` rate limit o `run-limit`,
`503` Piston caído u ocupado. Los mensajes van en español y **nunca exponen**
la URL interna de Piston.

### 6.6 Despliegue de Piston

`docker-compose.yml`:

```yaml
  piston:
    image: ghcr.io/engineer-man/piston
    restart: unless-stopped
    privileged: true          # isolate lo necesita (cgroups); ver §9
    volumes:
      - piston_packages:/piston/packages
    environment:
      PISTON_DISABLE_NETWORKING: "true"
      PISTON_RUN_TIMEOUT: "3000"
      PISTON_COMPILE_TIMEOUT: "10000"
      PISTON_OUTPUT_MAX_SIZE: "65536"
      PISTON_MAX_PROCESS_COUNT: "64"
      PISTON_MAX_OPEN_FILES: "256"
      PISTON_MAX_FILE_SIZE: "10000000"
      PISTON_MAX_CONCURRENT_JOBS: "4"
    # SIN "ports:": solo se accede desde la red interna (web → piston:2000)
```

- `web` recibe `PISTON_URL=http://piston:2000`.
- Script `docker/piston-install.sh`, que se corre una sola vez, para instalar
  los paquetes con las versiones fijadas de §6.2 (`POST /api/v2/packages`).
  Queda documentado en el README.
- **No se usa la API pública de emkc.org**: desde 2025 requiere que te
  autoricen, y además mandaría el código de los estudiantes a un tercero.

`.env.example`: se agregan `PISTON_URL`, las versiones y los límites de §6.4.

---

## 7. Componentes del frontend

```
components/ide/
  IdeWorkspace.tsx      ← orquesta archivos + editor + consola; sin conocer examen/lab
  IdeFileTabs.tsx       ← pestañas + barra lateral (mode=multi)
  IdeConsole.tsx        ← Salida / Entrada, estados, truncado
  useIdeFiles.ts        ← estado de archivos, dirty, flush del debounce
  useCodeRun.ts         ← POST run, AbortController, último resultado
components/laboratory/answers/IdeAnswer.tsx   ← adaptador para el registry
components/student/IdeQuestion.tsx            ← adaptador para QuestionList del examen
components/admin/IdeAnswerViewer.tsx          ← solo lectura + Run para el docente
```

`IdeWorkspace` recibe la configuración y dos callbacks:

```ts
interface IdeWorkspaceProps {
  config: StudentSafeIdeConfig;            // language, mode, entry, archivos, flags
  value: IdeAnswerValue | undefined;       // archivos editables guardados
  onChange: (v: IdeAnswerValue) => void;   // autosave (con debounce de 300 ms, como CodeAnswer)
  runEndpoint?: string;                    // sin endpoint → no hay Run (preview estático)
  disabled?: boolean;
}
```

Así el mismo componente sirve en el laboratorio, en el examen, en la vista
previa del docente y en la vista de calificación; cambia solo el endpoint.

---

## 8. Modelo de datos

### 8.1 Laboratorios (`lib/laboratory/types.ts`)

```ts
export const IDE_LANGUAGES_LIST = ["python", "java", "typescript"] as const;
export type IdeLanguage = (typeof IDE_LANGUAGES_LIST)[number];

export interface IdeFile { name: string; content: string; readonly?: boolean }

export interface IdeQuestion extends Omit<BaseQuestion, "evaluator"> {
  type: "ide";
  language: IdeLanguage;
  mode: "single" | "multi";
  entry: string;
  starterFiles: IdeFile[];
  allowNewFiles: boolean;
  maxFiles: number;
  stdin: string;
  stdinEditable: boolean;
  runEnabled: boolean;
  runLimit?: number;
  autocomplete: boolean;
  height: number;
  evaluator: "manual" | "ai";   // "automatic" en la fase 2
}

/** Lo que se guarda en answers[questionId] para una pregunta ide. */
export interface IdeAnswerValue { files: { name: string; content: string }[]; stdin?: string }

export type AnswerValue = string | number | boolean | string[] | IdeAnswerValue;
```

- `QUESTION_TYPES` suma `"ide"`; `answerRegistry` suma `ide: IdeAnswer`.
- `AnswerValueSchema` en la ruta de autosave del laboratorio se amplía con un
  `z.object({ files: z.array(...).max(20), stdin: z.string().max(...) })`
  validado contra §4.4.
- `stripAnswerKey`: los archivos iniciales **no** son secretos y se envían;
  los de la fase 2 (tests ocultos) sí se quitarán.
- El laboratorio ya guarda `markdownSnapshot`, así que los archivos de solo
  lectura y la configuración quedan congelados por entrega sin cambios
  adicionales.

### 8.2 Exámenes (Prisma)

```prisma
enum QuestionType {
  SINGLE_CHOICE
  MULTIPLE_CHOICE
  CODE
  CODE_IDE          // nuevo
}

model Question {
  // ...
  // Config del IDE (mode, entry, starterFiles, límites...). Solo para CODE_IDE.
  ideConfig Json?
}

model Answer {
  // ...
  // Archivos editables del estudiante para CODE_IDE: [{ name, content }].
  // codeAnswer se sigue llenando con el archivo entry, así la exportación
  // CSV y las vistas viejas siguen funcionando.
  codeFiles Json?
}
```

`AnswerSubmitSchema` (`lib/validation/activity-schema.ts`) suma la variante
`{ codeFiles: [...], stdin?: string }`.

### 8.3 Historial de ejecuciones (nuevo)

```prisma
enum CodeRunContext { EXAM LAB ADMIN }

model CodeRun {
  id           String         @id @default(cuid())
  context      CodeRunContext
  attemptId    String?        // ExamAttempt (EXAM)
  submissionId String?        // LaboratorySubmission (LAB)
  userId       String?        // docente (ADMIN)
  questionId   String         // Question.id o id de la pregunta del Markdown
  language     String
  version      String
  filesHash    String         // sha256 de los archivos; para deduplicar y auditar
  status       String         // ok | runtime_error | compile_error | timeout | memory | unavailable
  exitCode     Int?
  stdout       String  @db.Text   // truncado a CODE_RUN_MAX_OUTPUT_KB
  stderr       String  @db.Text
  compileOut   String? @db.Text
  durationMs   Int
  createdAt    DateTime @default(now())

  @@index([attemptId, questionId])
  @@index([submissionId, questionId])
  @@map("code_runs")
}
```

Sirve para:

- contar `run-limit` de forma persistente;
- mostrarle al docente **cuántas veces corrió y con qué resultado** (evidencia
  del proceso, útil contra respuestas pegadas sin probar);
- darle a la IA la última corrida como contexto.

No se guarda el código completo de cada corrida (solo su hash), para no
inflar la base; la respuesta guardada es la fuente de verdad. Si el docente
lo pide, una opción futura es guardar un snapshot por corrida.

Retención: se borran las corridas de más de 180 días (tarea de limpieza o
`DELETE` manual documentado).

---

## 9. Seguridad

| Riesgo | Mitigación |
|--------|-----------|
| Código malicioso (fork bomb, `rm -rf`, minería) | Sandbox `isolate` de Piston; límites de procesos, archivos, memoria y tiempo (§6.4, §6.6) |
| Acceso a red desde el código | `PISTON_DISABLE_NETWORKING=true` |
| Piston expuesto a internet | Sin `ports:`; solo red interna de Docker; el navegador nunca conoce `PISTON_URL` |
| `privileged: true` | Piston corre en su propio contenedor, sin volúmenes de la app ni secretos (`.env` no se monta ahí). Documentar el riesgo; si el host lo permite, evaluar alojarlo en una VM separada |
| Abuso como cómputo gratis | Auth obligatoria, solo durante un intento/entrega en curso y solo para preguntas `ide` con Run habilitado; rate limit; `run-limit` |
| El cliente cambia el lenguaje o los límites | El servidor ignora todo menos `questionId`, archivos editables y stdin |
| El cliente reemplaza archivos de solo lectura | El servidor los toma siempre del enunciado |
| Path traversal en nombres | Regex de §4.4 en el parser, en el autosave y en el run |
| XSS por la salida del programa | Se renderiza como texto en `<pre>`, se eliminan los ANSI, nunca `dangerouslySetInnerHTML` |
| Salida gigante | `PISTON_OUTPUT_MAX_SIZE` + truncado en el servidor + `truncated: true` |
| Denegación de servicio por concurrencia | Semáforo global + `PISTON_MAX_CONCURRENT_JOBS` |

---

## 10. Calificación y vista del docente

- **Vista de calificación** (`AttemptGradingView`, `LaboratoryGradingView`):
  `IdeAnswerViewer` muestra los archivos en pestañas de solo lectura, el stdin
  usado, un botón **Run** que re-ejecuta con `context=ADMIN` y un resumen de
  las corridas del estudiante: "12 ejecuciones · última: exit 0 · 3 errores
  de compilación".
- **Vista previa al importar** (`ExamPreview`, `LaboratoryPreview`): el IDE
  aparece con los archivos iniciales y Run habilitado vía la ruta admin, para
  que el docente pruebe la plantilla antes de publicar.
- **Evaluación con IA** (`evaluator="ai"` / `enableAiEvaluation`):
  `buildEvaluationPrompt` recibe los archivos concatenados con encabezado
  (`// ===== Main.java =====`) y la última corrida
  (`exit`, primeros 2 KB de stdout y stderr). Se le indica que la salida es
  evidencia, no una prueba de corrección.
- **Exportación CSV**: sin cambios de columnas; `codeAnswer` sigue teniendo
  el archivo `entry`.
- `evaluate()` del engine: `ide` cae en manual o IA igual que `code` (no
  entra a `AUTOMATIC_EVALUATORS` en v1).

---

## 11. Fase 2 (diseñada, no incluida en v1): casos de prueba

Para poder autocalificar más adelante sin rediseñar:

````md
{{tests for="fib" mode="stdout"}}
```test name="n=1" points="1"
stdin: 1
expected: 0
```
```test name="n=10" points="2" hidden="true"
stdin: 10
expected: 0 1 1 2 3 5 8 13 21 34
```
{{/tests}}
````

- El servidor corre cada caso en Piston al enviar (o con un botón "Probar" que
  solo muestra los casos visibles).
- `hidden="true"` se quita en `stripAnswerKey`.
- La comparación normaliza espacios y saltos de línea finales.
- Habilita `evaluator="automatic"` (puntaje parcial = suma de los casos que
  pasan) y se registra en `AUTOMATIC_EVALUATORS` como evaluador **asíncrono**
  (hoy el engine es síncrono; la fase 2 debe agregar un paso asíncrono en
  `finalizeSubmission` y en `attempt-finalize`).

---

## 12. Plan de implementación

| Fase | Entregable | Criterio de salida |
|------|-----------|--------------------|
| **0. Spike Piston** (½–1 día) | Piston en `docker-compose`, paquetes instalados, script de prueba | Python, Java y TS corren en un archivo; **decidido cómo se corre Java y TS con varios archivos** (§6.3); latencias medidas con 30 corridas simultáneas |
| **1. Backend** | `lib/code-runner/*`, ruta `/run` de laboratorio, `CodeRun`, límites | Tests con `fetch` de Piston simulado; ejecuciones reales vía `curl` |
| **2. Editor + IDE** | Mejoras a `CodeEditor` (§3.2), `components/ide/*`, `IdeAnswer`, parser de `type="ide"` y `{{files}}` | Laboratorio de ejemplo `examples/laboratory-ide-sample.md` funciona de punta a punta, en desktop y móvil |
| **3. Exámenes** | Migración Prisma, `exam-schema`, `IdeQuestion`, ruta `/run` de examen, autosave con `codeFiles` | Examen JSON de ejemplo con pregunta `ide`; Run se bloquea al vencer el tiempo |
| **4. Docente** | `IdeAnswerViewer`, previews con Run, historial de corridas, prompt de IA | El docente re-ejecuta una entrega y ve el historial |
| **5. Docs** | `laboratory-spec.md` (tabla de tipos + sección `ide` + `{{files}}`), README (Piston), `.env.example` | Un agente puede generar un `.md` con `ide` leyendo solo el spec |

### 12.1 Tests (vitest)

- `tests/laboratory/parse-placeholder-ide.test.ts`: defaults por lenguaje,
  `entry` inexistente, `mode="single"` con dos archivos editables, nombres
  inválidos, `evaluator="automatic"` rechazado.
- `tests/laboratory/extract-files.test.ts`: bloques `{{files}}`, info strings,
  `readonly`, `for` inexistente o de otro tipo.
- `tests/code-runner/piston-client.test.ts`: el `entry` va primero, los
  readonly se toman del enunciado, se ignoran los campos extra del cliente,
  timeouts y `SIGKILL` → `timeout`, truncado, Piston caído → `unavailable`.
- `tests/code-runner/limits.test.ts`: tamaño, cantidad, stdin, `run-limit`.
- `tests/validation/exam-schema.test.ts`: casos del nuevo tipo `"ide"`.

---

## 13. Preguntas abiertas

1. **Java multiarchivo**: ¿paquete propio `java-multi` (control total, hay que
   mantenerlo) o JDK ≥ 22 (estándar, depende de que exista el paquete)? Se
   decide en la fase 0.
2. **Copiar/pegar en el IDE durante exámenes**: ¿bloquearlo, registrarlo como
   evento de actividad (`OTHER` con detalle "paste de N caracteres") o dejarlo
   libre? Recomendación: registrarlo sin bloquear.
3. **¿Las corridas cuentan como "actividad"** para el heartbeat del examen?
   Recomendación: no; ya hay autosave.
4. **Hosting de Piston**: ¿mismo servidor que la app o una VM aparte, por
   `privileged`? Depende de la infraestructura actual.
5. **Versión de Python**: confirmar qué versión usa el curso (3.10 vs 3.12)
   para fijarla en `PISTON_PYTHON_VERSION`.
6. **`run-limit` por defecto en exámenes**: ¿sin límite (solo rate limit) o un
   default como 50 para frenar el "prueba y error" a ciegas?

---

## 14. Decisiones de implementación (fase 0 y v1)

Lo verificado en el spike con Piston local (`ghcr.io/engineer-man/piston`) y lo
que cambió respecto del borrador:

1. **Java con varios archivos: lanzador generado** (resuelve §6.3 y la pregunta
   abierta 1). El índice oficial de paquetes de Piston solo tiene Java
   `15.0.2`, que ejecuta el primer archivo en *single-file source mode*. En vez
   de mantener un paquete propio, `lib/code-runner/java-launcher.ts` antepone
   `IdeLauncher__.java`: compila todos los `.java` del estudiante en el mismo
   proceso con `javax.tools.ToolProvider`, carga la clase `entry` (respetando un
   `package`) e invoca su `main`. Los errores de `javac` salen entre marcadores
   con exit `97` y se muestran como "Error de compilación". El stack trace de
   las excepciones se limpia de los frames del lanzador. Por eso Java recibe
   hasta `min(CODE_COMPILE_TIMEOUT_MS, 7000)` ms extra de `run_timeout`.
2. **Python**: `3.12.0`. Varios archivos con `import` funcionan directamente.
2b. **TypeScript: también con lanzador** (`lib/code-runner/ts-launcher.ts`). El
   paquete `typescript 5.0.3` de Piston agrega `.ts` a cada nombre
   (`main.ts.ts`, lo que rompe `import "./utils"`) y corre `tsc *.ts` sin
   opciones (target ES5: sin `Map`/`Set`/`includes` ni spread de strings). Se
   envía un solo archivo `main` que embebe los archivos del estudiante; al
   ejecutarse, los compila con la API de TypeScript que trae el paquete (ES2022,
   CommonJS, source maps), reporta los diagnósticos con el mismo protocolo de
   compilación que Java (exit 97 + marcadores) y ejecuta el `entry`. Las trazas
   apuntan a `main.ts:línea`. `process`/`require` se declaran como `any` porque
   el paquete no incluye `@types/node`. Verificado en vivo: imports entre
   archivos, stdin, errores de tipo, módulo inexistente, excepción,
   `process.exit` y timeout.
3. **Detección de límites** (validado en vivo): el tiempo excedido llega con
   `status: "TO"` y `SIGKILL`; el exceso de memoria llega como `code 137`
   (`status: "RE"`) con `memory` en el límite, no como `SIGKILL`. Ambos casos se
   clasifican como `timeout` y `memory`. La red está bloqueada en el sandbox.
4. **UI**: en lugar de barra lateral + pestañas se usan **solo pestañas**
   (desplazables en horizontal), que sirven igual en escritorio y en móvil.
   Doble clic renombra y `×` borra (con un segundo clic de confirmación).
   Cada archivo mantiene su propio editor montado (deshacer y cursor por
   archivo).
5. **Ruta admin única** `POST /api/admin/code-runner/run`: recibe la config de la
   pregunta en el cuerpo (el docente es de confianza; la config se vuelve a
   normalizar). Sirve para las vistas previas de importación (el examen o
   laboratorio aún no existe en la BD) y para la re-ejecución en las vistas de
   calificación.
6. **Railway no permite contenedores privilegiados**, así que Piston no puede
   correr ahí. Piston va en un VPS detrás de Caddy (HTTPS + `Bearer` token, solo
   `/execute` y `/runtimes`), y la app envía `PISTON_AUTH_TOKEN`. Guía:
   [docs/deploy/railway-piston.md](../deploy/railway-piston.md).
7. Paquetes en disco: Python ~1.1 GB descomprimido; reservar ~3 GB para los
   tres lenguajes.

