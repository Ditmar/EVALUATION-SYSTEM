# Laboratory Markdown Specification v0.1

Formato de autoría para laboratorios. Este documento es la única referencia
que un generador (humano o agente) necesita para producir un `.md` válido —
no requiere conocer React, Prisma, ni el renderer.

## Frontmatter (YAML, obligatorio)

```yaml
---
id: graph-dijkstra-01     # obligatorio, único por docente
title: Laboratorio de Dijkstra   # obligatorio
subject: Investigacion Operativa II   # opcional, informativo
version: 1                # opcional, default 1
duration: 120              # opcional, minutos
points: 30                 # opcional; si se define, se compara contra la suma de puntos de las preguntas (warning si no coincide, no bloquea)
status: draft               # opcional: draft | published | archived, default draft
---
```

## Contenido

Markdown normal: `#`/`##` headings, párrafos, **negrita**/*itálica*, listas,
tablas (GFM), imágenes `![alt](url)`, bloques ```code```, citas `>`. No se
soporta: HTML embebido, footnotes, definiciones de referencia, tachado
(`~~texto~~`) — cualquiera de estos produce un error de parseo explícito, no
un renderizado silencioso incorrecto. Fórmulas matemáticas (LaTeX) no se
renderizan en v0.1; usa código inline o bloques de código para expresarlas.

## Placeholder `{{answer}}`

```md
{{answer
  id="q1"
  type="text"
  points="5"
  required="true"
  placeholder="Explique su respuesta..."
  evaluator="manual"
}}
```

Funciona igual dentro de una celda de tabla Markdown.

Atributos comunes: `id` (obligatorio, único), `type` (obligatorio), `points`
(obligatorio, número >= 0), `required` (default `true`), `placeholder`,
`evaluator` (`automatic|manual|ai`; si se omite, se infiere `automatic` cuando
hay una regla determinística —`correct`/`expected`+`tolerance`—, si no
`manual`).

### Tipos soportados

| `type`            | Atributos propios                          | Valor de la respuesta |
|-------------------|---------------------------------------------|------------------------|
| `text`             | `correct`                                    | `string`                |
| `textarea`         | —                                             | `string`                |
| `number`           | `expected`, `tolerance`                      | `number`                |
| `boolean`          | `correct` (`"true"`/`"false"`)               | `boolean`               |
| `single-choice`    | `options="A\|B\|C"`, `correct`                | `string`                |
| `multiple-choice`  | `options="A\|B\|C"`, `correct="A\|C"`         | `string[]`              |
| `select`           | `options="A\|B\|C"`, `correct`                | `string`                |
| `code`             | `language` (java, python, javascript, ...)  | `string`                |
| `image`            | `max-size` (MB, default `1`), `formats="png\|jpg\|gif\|webp"` (default: todos) | `string` (clave del archivo en R2) |
| `ide`              | `language` (`python\|java\|typescript`), `mode`, `entry`, ... (ver abajo) | `{ files: [{name, content}], stdin? }` |

`code` es un editor sin ejecución; `ide` es un mini IDE que **sí** ejecuta el
código (ver sección `ide`).

`number` es correcto si `|respuesta - expected| <= tolerance`. `multiple-choice`
es todo-o-nada: el conjunto respondido debe coincidir exactamente con
`correct`. `code` nunca se ejecuta ni se autocalifica.

`image` permite al estudiante subir una imagen (JPG, PNG, GIF o WEBP; SVG no
se acepta). `max-size` es el peso máximo en MB (mayor a 0, máximo 10); si el
archivo lo supera se rechaza en el navegador y también en el servidor. El
formato se verifica por el contenido del archivo, no por su extensión. Solo
admite `evaluator="manual"`.

```md
{{answer
  id="captura-grafo"
  type="image"
  points="5"
  max-size="1"
  formats="png|jpg"
}}
```

### `type="ide"`: IDE ejecutable

El estudiante tiene un editor con pestañas de archivos, un botón **Run**
(`Ctrl + Enter`) y una consola con salida, errores, código de salida y tiempo.
El código corre en un sandbox (Piston) sin red y con límites de tiempo y
memoria.

```md
{{answer
  id="fib"
  type="ide"
  language="python"
  points="10"
  stdin="10"
}}
```

| Atributo | Default | Descripción |
|----------|---------|-------------|
| `language` | obligatorio | `python` (`py`), `java`, `typescript` (`ts`) |
| `mode` | `single` | `single`: un archivo editable. `multi`: varios archivos con pestañas |
| `entry` | `main.py` / `Main.java` / `main.ts` | Archivo que se ejecuta |
| `allow-new-files` | `true` si `mode="multi"` | El estudiante puede crear, renombrar y borrar archivos (salvo `entry` y los readonly) |
| `max-files` | `10` | Máximo de archivos, contando los readonly (techo: 20) |
| `stdin` | vacío | Entrada estándar por defecto. `
` en el valor es un salto de línea |
| `stdin-editable` | `true` | Si el estudiante puede cambiar el stdin |
| `run` | `true` | `false` muestra el IDE sin botón Run |
| `run-limit` | sin límite | Máximo de ejecuciones por estudiante en esa pregunta |
| `autocomplete` | `false` | Autocompletado del editor |
| `height` | `360` | Alto del editor en px (160–1200) |

`evaluator`: `manual` (default) o `ai`. La IA recibe todos los archivos y el
historial de ejecuciones del estudiante. `automatic` aún no está soportado.

Nombres de archivo: letras, números, `_`, `-` y `.`, sin carpetas, con la
extensión del lenguaje (`.py`, `.java`, `.ts`) o `.txt`/`.csv`/`.json` para
archivos de datos. Solo biblioteca estándar: no hay pip/Maven/npm ni red.

#### Archivos iniciales: `{{files}}`

````md
{{files for="inventario"}}
```java file="Main.java"
public class Main { ... }
```

```java file="Producto.java" readonly="true"
public class Producto { /* ... */ }
```
{{/files}}
````

- Cada bloque de código cercado es un archivo; `file="..."` es obligatorio y
  `readonly="true"` lo deja de solo lectura (el servidor siempre usa la versión
  del enunciado, aunque el cliente envíe otra).
- `for` debe apuntar a una pregunta `type="ide"`, y entre los archivos tiene que
  estar `entry` (editable).
- En `mode="single"` solo puede haber un archivo editable (los readonly se
  muestran como pestañas bloqueadas).
- Java: si un archivo declara `public class X`, debería llamarse `X.java`
  (advertencia, no error). El runtime es **Java 15**: no hay `record`,
  `sealed` ni pattern matching en `switch` (son preview o posteriores).

Ejemplo completo con los tres lenguajes: `examples/laboratory-ide-sample.md`.

## Placeholder `{{rubric}}`

```md
{{rubric for="dijkstra-analysis"}}
La respuesta debe mencionar:
- pesos de las aristas;
- selección del nodo con menor distancia.
{{/rubric}}
```

`for` debe apuntar al `id` de una pregunta existente. El contenido es interno
— nunca se envía al estudiante — y sirve como contexto para el evaluador de
IA y como referencia para el docente al calificar manualmente.

## Ejemplo completo

Ver `examples/laboratory-dijkstra-sample.md` en la raíz del repo.
