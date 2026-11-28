---
id: prog-ide-demo-01
title: Laboratorio de programación con IDE ejecutable
subject: Programación II
version: 1
duration: 90
points: 40
status: draft
---

# Laboratorio: IDE ejecutable

Cada pregunta de este laboratorio tiene un pequeño IDE. Escriba su código,
presione **Run** (o `Ctrl + Enter`) y revise la consola. Lo que quede en el
editor al enviar es su respuesta.

## 1. Fibonacci (Python, un archivo)

Escriba un programa que lea un entero `n` desde la entrada estándar y muestre
los `n` primeros términos de la sucesión de Fibonacci separados por espacios.
La pestaña **Entrada (stdin)** ya trae `10`; puede cambiarla para probar.

{{answer
  id="fibonacci"
  type="ide"
  language="python"
  points="10"
  stdin="10"
  evaluator="manual"
}}

{{files for="fibonacci"}}
```python file="main.py"
n = int(input())
# TODO: muestre los n primeros términos de Fibonacci
```
{{/files}}

{{rubric for="fibonacci"}}
- Lee n desde stdin.
- Imprime exactamente n términos empezando en 0.
- Maneja n = 0 y n = 1.
{{/rubric}}

## 2. Inventario (Java, varios archivos)

Complete la clase `Inventario` para que `Main` muestre el valor total del
inventario. `Producto` ya está implementado y es de solo lectura. Puede crear
más archivos si lo necesita.

{{answer
  id="inventario"
  type="ide"
  language="java"
  mode="multi"
  entry="Main.java"
  points="20"
  run-limit="40"
  evaluator="ai"
}}

{{files for="inventario"}}
```java file="Main.java"
public class Main {
    public static void main(String[] args) {
        Inventario inv = new Inventario();
        inv.agregar(new Producto("Teclado", 120.5, 3));
        inv.agregar(new Producto("Mouse", 45.0, 10));
        System.out.println("Total: " + inv.total());
    }
}
```

```java file="Inventario.java"
import java.util.ArrayList;
import java.util.List;

public class Inventario {
    private final List<Producto> productos = new ArrayList<>();

    public void agregar(Producto p) {
        // TODO
    }

    public double total() {
        // TODO: suma de precio * cantidad
        return 0;
    }
}
```

```java file="Producto.java" readonly="true"
public class Producto {
    private final String nombre;
    private final double precio;
    private final int cantidad;

    public Producto(String nombre, double precio, int cantidad) {
        this.nombre = nombre;
        this.precio = precio;
        this.cantidad = cantidad;
    }

    public String nombre() { return nombre; }
    public double precio() { return precio; }
    public int cantidad() { return cantidad; }
}
```
{{/files}}

{{rubric for="inventario"}}
- `agregar` guarda el producto en la lista.
- `total` suma precio × cantidad de todos los productos (811.5 con los datos de Main).
- No modifica `Producto`.
{{/rubric}}

## 3. Palíndromos (TypeScript, varios archivos)

Implemente `esPalindromo` en `utils.ts` (ignorando mayúsculas y espacios) y
úsela desde `main.ts` para mostrar si cada palabra es palíndromo.

{{answer
  id="palindromos"
  type="ide"
  language="typescript"
  mode="multi"
  allow-new-files="false"
  points="10"
}}

{{files for="palindromos"}}
```typescript file="main.ts"
import { esPalindromo } from "./utils";

const palabras = ["Anita lava la tina", "TypeScript", "reconocer"];
for (const p of palabras) {
  console.log(`${p}: ${esPalindromo(p)}`);
}
```

```typescript file="utils.ts"
export function esPalindromo(texto: string): boolean {
  // TODO
  return false;
}
```
{{/files}}
