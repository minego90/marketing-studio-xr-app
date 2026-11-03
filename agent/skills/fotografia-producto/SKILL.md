---
name: fotografia-producto
description: Dirigir la captura de producto con visor Quest o teléfono (4 vistas), evaluar calidad de foto y dar correcciones concretas. Úsalo antes y durante la toma de fotos de una campaña.
---
# Fotografía de producto para campañas (visor Quest 3 / teléfono / PC)

## Protocolo de cuatro vistas (siempre el mismo objeto, mismo encuadre y luz)
1. **Frente**: producto completo, etiqueta/logo legible, centrado, 60–75 % de la altura del cuadro, aire alrededor.
2. **Derecha**: gira el producto (o camina alrededor) 90°; misma distancia; muestra volumen y costado.
3. **Izquierda**: 90° al lado opuesto; la misma luz.
4. **Atrás**: parte posterior completa; sin dedos sobre etiquetas ni reflejos fuertes.
Estas vistas se envían a la IA como *referencias de geometría*: si cambian la distancia o la luz entre vistas, la IA deforma el producto.

## Luz
- Luz suave y frontal-lateral (ventana grande o lámpara difusa a ~45°). Evita luz cenital dura y contraluz de ventana.
- Superficies brillantes (vidrio, metal): luz grande y lejana; aleja el flash; busca reflejos que no tapen la marca.
- Una sola temperatura de color por escena (no mezcles bombilla cálida con luz de día).
- Fondo liso y limpio (pared, cartulina, mesa despejada). El contraste producto/fondo vale más que un fondo "bonito".

## Encuadre y cámara
- Cámara a la altura del centro del producto; evita ángulos que alarguen el objeto (la IA copia la deformación).
- Deja 10–15 % de margen en cada borde: se necesitará recortar a 4:5, 9:16 y 1:1.
- En Quest la cámara está en las gafas, no en la mano: acércate/aléjate tú, mantén la cabeza quieta 2 s al disparar (usa la cuenta 3-2-1).
- Evita el movimiento: si la imagen sale movida, apoya los codos o el producto sobre una mesa.

## Umbrales que usa el Revisor automático (foto-QA)
| Señal | Aviso si | Corrección |
|---|---|---|
| Luminosidad media | < 55 ó > 205 (de 255) | Más luz / menos luz directa |
| Contraste (desv. estándar de luma) | < 28 | Fondo más distinto del producto |
| Nitidez (varianza del Laplaciano, gris 256 px) | < 60 | Quieto 2 s, más luz, limpia el lente |
| Zonas quemadas (>250) | > 6 % de píxeles | Aleja la luz, quita reflejo |
| Producto en cuadro (caja de bordes) | < 22 % ó > 92 % del área | Acércate / aléjate |
| Descentrado | centro del producto a > 22 % del centro | Reencuadra |

## Errores típicos que arruinan la campaña
Producto cortado, etiqueta ilegible, dedos sobre el logo, mezcla de luces, fondo desordenado, vistas con distancias distintas, foto con filtro del teléfono activado.

## Cómo explicar al usuario
Una sola corrección por mensaje, concreta y amable ("Acércate un paso: el producto ocupa poco cuadro"). Nunca digas "mala foto"; di qué cambiar.
