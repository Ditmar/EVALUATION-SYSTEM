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

`number` es correcto si `|respuesta - expected| <= tolerance`. `multiple-choice`
es todo-o-nada: el conjunto respondido debe coincidir exactamente con
`correct`. `code` nunca se ejecuta ni se autocalifica.

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
