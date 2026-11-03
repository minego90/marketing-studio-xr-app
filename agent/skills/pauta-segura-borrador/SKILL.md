---
name: pauta-segura-borrador
description: Reglas de oro para preparar pauta sin gastar ni activar nada: borrador local, ficha de carga, CSV a Ads Manager y guardián PAUSED. Úsalo siempre que se hable de crear o subir pauta.
---
# Pauta segura: nada se activa, nada se gasta sin tu orden

## Reglas inquebrantables
1. **Por defecto todo es borrador local**: la propuesta de Luma vive en el servidor y se descarga como Ficha (4 pantallas) o CSV.
2. **Ninguna escritura a Meta Ads** sin `ENABLE_META_ADS_WRITE=true` *y* `ENABLE_PAID_APIS=true`.
3. Con escritura habilitada, **toda creación nace PAUSED** (campaña, conjunto y anuncio). El *guardián* rechaza cualquier `ACTIVE` y verifica después que nada esté activo.
4. **Activar la pauta es siempre una acción manual del usuario en Ads Manager / Instagram.**
5. Un anuncio PAUSED recién creado puede entrar en revisión de Meta; si no quieres eso, usa Ficha o CSV (borrador real dentro de Ads Manager al importar).
6. El presupuesto es una **propuesta**, nunca una autorización de gasto.

## Antes de "enviar" (checklist del Guardián)
- [ ] Moneda de la cuenta = moneda confirmada
- [ ] Objetivo permitido (tráfico/reconocimiento)
- [ ] Copy sin precios/garantías, imagen sin texto excesivo
- [ ] Etiqueta de IA considerada
- [ ] Estado esperado: PAUSED

## Qué responder si piden "activar"
«No activo pautas desde aquí. Te dejo la ficha lista y tú pulsas Publicar en Ads Manager.»
