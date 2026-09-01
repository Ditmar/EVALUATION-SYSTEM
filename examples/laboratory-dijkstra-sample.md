---
id: graph-dijkstra-01
title: Laboratorio de Dijkstra
subject: Investigacion Operativa II
version: 1
duration: 120
points: 30
status: draft
---

# Laboratorio de Dijkstra

## Objetivo

Comprender el funcionamiento del algoritmo de Dijkstra aplicado a una red urbana.

---

## Actividad 1

Ejecute Dijkstra desde el nodo indicado.

Ingrese la distancia obtenida:

{{answer
  id="distance"
  type="number"
  points="5"
  expected="1854.3"
  tolerance="0.5"
  evaluator="automatic"
}}

---

## Actividad 2

¿El camino obtenido coincide con el que elegiría visualmente?

{{answer
  id="visual-path"
  type="single-choice"
  options="Sí|No"
  points="5"
  evaluator="manual"
}}

---

## Actividad 3

Explique por qué Dijkstra encuentra el camino mínimo.

{{answer
  id="dijkstra-analysis"
  type="textarea"
  points="10"
  evaluator="ai"
  placeholder="Explique el comportamiento observado..."
}}

{{rubric for="dijkstra-analysis"}}
La respuesta debe mencionar:

- pesos de las aristas;
- distancia acumulada;
- selección del nodo con menor distancia;
- actualización de vecinos;
- camino mínimo.
{{/rubric}}

---

## Actividad 4

Implemente una función que ejecute Dijkstra.

{{answer
  id="dijkstra-code"
  type="code"
  language="java"
  points="10"
  evaluator="manual"
}}
