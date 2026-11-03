---
name: anuncios-webxr
description: Diseñar y probar anuncios y experiencias en WebXR (Quest Browser): formatos espaciales, confort, tamaños mínimos, interacción por manos y checklist de calidad. Úsalo para el módulo «Anuncio XR».
---
# Anuncios y experiencias WebXR

## Formatos que ya soporta el proyecto
1. **Prisma de producto (4 vistas)**: las fotos frente/derecha/atrás/izquierda forman un objeto de 4 caras que se gira con la mano o el ratón. Costo de IA = 0.
2. **Colocar en tu mesa (AR hit-test)**: el prisma se ancla sobre una superficie real (`immersive-ar` + `hit-test`).
3. **Marco espacial de Feed/Story/Reel**: vista previa de cómo se vería la pieza flotando.
Posibles extensiones (verifica soporte en Quest Browser): anclas, detección de planos, profundidad, seguimiento de manos.

## Confort y ergonomía
- Distancia de contenido principal: 0,8–2 m. Nunca pegado a la cabeza (head-locked) salvo indicadores pequeños.
- Texto: altura de letra ≥ 1,5–2° de ángulo visual para títulos (≈ 3,5 cm a 1 m), ≥ 0,9° para cuerpo.
- Zonas táctiles ≥ 4 cm (a 1 m) con 1 cm de separación; retroalimentación visual al apuntar y al pulsar.
- Sin parpadeos rápidos ni giros automáticos bruscos; usa curvas suaves (≤ 30°/s en rotación automática).
- Contraste ≥ 4,5:1 (texto sobre fondo de paso: añade panel semitransparente).

## Rendimiento
72/90 fps; ≤ 100 k triángulos; ≤ 100 llamadas de dibujo; texturas ≤ 2048 px (comprimidas si es posible); sin sombras en tiempo real; luces baratas (`MeshBasicMaterial`/unlit).

## Privacidad y transparencia
- La cámara de paso solo se usa con permiso del usuario; no se envían imágenes sin confirmación.
- Rotula como **Publicidad** toda pieza comercial; no simules contenido orgánico.

## Checklist de revisión (Revisor XR)
- [ ] Prisma con las 4 caras cargadas (si falta una, usa la más cercana y avisa)
- [ ] Titular visible a 1 m
- [ ] CTA ≥ 4 cm y separado
- [ ] Rotación automática lenta y pausa al tocar
- [ ] Fallback de escritorio (órbita con ratón) funcionando
- [ ] Etiqueta «Publicidad»
