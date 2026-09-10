# Article Markdown Specification v0.1

Formato de autoría para artículos del blog (`/home`). Este documento es la
única referencia que un generador (humano o agente) necesita para producir un
`.md` válido — no requiere conocer React, Prisma, ni el renderer.

## Frontmatter (YAML, obligatorio)

```yaml
---
title: Introducción a los árboles AVL
excerpt: Cómo mantener un árbol binario de búsqueda balanceado en O(log n).
tags: [estructuras-de-datos, algoritmos]
---
```

`title` y `excerpt` son obligatorios (`excerpt` es el resumen que aparece en
las tarjetas de `/home`, 1-2 oraciones). `tags` es opcional (lista de
strings; se muestran como categorías/etiquetas). El slug público (la URL
`/home/<slug>`) no va en el frontmatter — se define aparte al guardar el
artículo, editable pero autogenerado desde `title` por defecto.

## Contenido

Markdown estándar: `#`/`##`/... headings (los `##`/`###` de nivel superior
alimentan el índice de contenidos lateral), párrafos, **negrita**/*itálica*,
~~tachado~~, listas, tablas (GFM), imágenes `![alt](url)`, bloques
` ```lenguaje `, citas `>`, enlaces. No se soporta HTML embebido, footnotes ni
definiciones de referencia — producen un error de parseo explícito.

Los bloques de código declaran el lenguaje (` ```python `, ` ```java `, etc.)
para el resaltado de sintaxis en la vista pública.

## Diagramas (Mermaid)

Un bloque de código con lenguaje `mermaid` se renderiza como un diagrama SVG
en vez de código resaltado — soporta cualquier tipo de diagrama de Mermaid
(flowchart, sequenceDiagram, classDiagram, stateDiagram, erDiagram, gantt,
etc.):

```md
​```mermaid
flowchart TD
    A[Inicio] --> B{¿Balanceado?}
    B -- Sí --> C[Fin]
    B -- No --> D[Rotar]
    D --> B
​```
```

Un error de sintaxis en el diagrama se muestra como un aviso en rojo en el
lugar del diagrama, sin romper el resto del artículo.

## Ecuaciones (LaTeX)

Vía `$...$` (inline) y `$$...$$` (bloque), igual que `remark-math`. También se
acepta la sintaxis `\( ... \)` / `\[ ... \]`, convertida automáticamente antes
del parseo (ver `lib/laboratory/convert-latex-delimiters.ts`, reutilizado tal
cual). El contenido de un bloque de código nunca se interpreta como LaTeX.

## Ejemplo completo

```md
---
title: Introducción a los árboles AVL
excerpt: Cómo mantener un árbol binario de búsqueda balanceado en O(log n).
tags: [estructuras-de-datos, algoritmos]
---

Un árbol AVL es un árbol binario de búsqueda que se autobalancea limitando la
diferencia de alturas entre subárboles a $|h_L - h_R| \leq 1$.

## Factor de balance

$$
FB(n) = h(n.izquierda) - h(n.derecha)
$$

## Rotación simple a la derecha

\`\`\`python
def rotar_derecha(n):
    pivote = n.izquierda
    n.izquierda = pivote.derecha
    pivote.derecha = n
    return pivote
\`\`\`

| Caso       | Condición        | Rotación         |
|------------|-------------------|------------------|
| Izquierda  | FB > 1, hijo FB ≥ 0 | Simple derecha  |
| Derecha    | FB < -1, hijo FB ≤ 0 | Simple izquierda|
```
