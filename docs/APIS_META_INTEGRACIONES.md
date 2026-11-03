# Marketing Studio XR — Mapa de APIs de Meta e integraciones posibles

Fecha: 28 oct 2026. Reglas de oro: nada de gasto, todo lo que escriba o cueste va apagado por defecto, anuncios siempre en PAUSA.

## 1. Qué hace cada API y en qué estamos

| API | Qué hace | Estado en el estudio |
|---|---|---|
| **Marketing API** (v25 vigente; v23 murió el 9 jun 2026) | Crea/gestiona campañas, conjuntos, creativos y anuncios; audiencias, reglas, Insights (métricas), Advantage+, Lead Ads, A/B tests | Adaptador en PAUSA (`lib/ads.mjs`, Graph **v24.0**), escritura bloqueada con `ENABLE_META_ADS_WRITE=false` |
| **Instagram Graph API** | Publica carrusel, historia, Reel; lee comentarios, menciones, insights, Business Discovery; webhooks | Publicación con Facebook Login (@danielmurcia.ia) |
| **Meta Ads MCP** (`mcp.facebook.com/ads`, beta abierta desde 29 abr 2026) | Servidor MCP oficial: reportes, creación/gestión de anuncios, catálogos, señales/datasets, A/B y lift, historial de actividad, búsqueda en Help Center. Nuevo = siempre pausado | No usado |
| **Ads CLI** | Línea de comandos con setup, creativos, datasets, catálogos e insights | No usado |
| **Conversions API / Signals Gateway** | Envía eventos de servidor a Meta (conversiones, leads) | No usado |
| **Catálogo / Commerce** | Productos, feeds, inventario, anuncios de catálogo | No usado (solo si hay producto físico) |
| **Meta Model API** (Muse Spark 1.3, Muse Image 1.0, Muse Voice, SAM 3.1) | Modelos propios de Meta con API compatible con OpenAI | Spark, Image y Voice (adaptador); SAM no |
| **Quest Passthrough Camera API** | Acceso a la cámara del casco | Solo apps nativas; en web no hay acceso crudo, se mantiene `getUserMedia` |
| **WhatsApp Business / Messenger / Threads** | Mensajería y publicación | No usado |

## 2. Qué más podemos integrar (priorizado)

**A. Gratis y sin riesgo (solo lectura)**
1. **Insights → trabajador de Analítica real.** Leer rendimiento de publicaciones y anuncios y que el personaje de la oficina avise ("tu Reel superó X"). Cuidado: Meta retiró algunas métricas en 2026, validar cuáles devuelve v25.
2. **Comentarios y menciones por webhook (Instagram) → eventos de la oficina** (`studio-event`). Un personaje avisa "nuevo comentario" y propone respuesta (tú apruebas, nunca se envía solo).
3. **Meta Ads MCP en modo solo lectura** (OAuth con scope de lectura): reportes, historial de actividad y A/B. Encaja con nuestra regla: lo creado nace pausado. Es beta con despliegue por fases; si responde `is_ads_mcp_enabled: false`, la cuenta aún no está habilitada.
4. **Business Discovery / búsqueda de hashtags** para investigar competencia y tendencias dentro de Estrategia.
5. **Chequeo de límite de publicación** antes de publicar (evita errores a mitad del flujo).

**B. Con Muse (de pago por token, opt-in)**
6. **Crítica visual de la foto con Muse Spark** (ve imágenes/video/documentos, ventana de 1M tokens): "esta foto está oscura, repite". Precio: modo estándar $1.25/$4.25 por M tokens (entrada/salida); modo *contributor* $0.10/$0.20 pero Meta usa tus datos para entrenar. No hay capa gratuita documentada, así que queda apagado hasta que lo decidas.
7. **Spark como orquestador con function calling** (herramientas: tomar foto, redactar, publicar en borrador, pauta pausada) y **búsqueda con grounding** para investigar tendencias.
8. **SAM 3.1** para recortes de producto/persona en el taller XR (verificar disponibilidad y precio antes).

**C. Más adelante / opcional**
9. **WhatsApp click-to-chat** como llamada a la acción de la pauta (solo como borrador).
10. **Conversions API + Lead Ads** si hay sitio o formulario; requiere píxel y gasto real, queda fuera por ahora.
11. **Threads** para republicar el mismo contenido (no lo investigué a fondo, verificar).
12. **Catálogo**, solo si el usuario vende productos.

## 3. Ajustes técnicos urgentes
- **Subir el adaptador de Graph v24.0 a v25** (v23 ya murió; revisar la fecha de retiro de v24).
- Meta bloqueó las campañas Advantage+ **heredadas** el 19 may 2026: confirmar que el adaptador PAUSADO usa la estructura nueva.
- Mantener `ENABLE_META_ADS_WRITE=false` y añadir `ENABLE_MUSE_PAID=false` para las funciones de pago.

## 4. Propuesta para el hackathon
La narrativa más fuerte: **un agente de marketing en realidad mixta** que (1) captura, (2) critica y redacta con Muse, (3) publica, (4) deja la pauta en pausa, y (5) **te avisa en la oficina 3D** con métricas reales leídas por Insights/MCP. Lo nuevo de mayor impacto y cero costo: puntos 1, 2 y 3.

## Fuentes
- [Ads MCP overview (Meta)](https://developers.facebook.com/documentation/ads-commerce/ads-ai-connectors/ads-mcp-server/ads-mcp-server-overview)
- [Índice docs Ads & Commerce (Meta)](https://developers.facebook.com/documentation/ads-commerce/llms.txt)
- [Guía del Ads MCP (PaidSync, terceros)](https://paidsync.ai/blog/official-meta-ads-mcp-guide)
- [Muse Spark](https://dev.meta.ai/models/muse-spark) · [Precios](https://dev.meta.ai/docs/pricing-rate-limits)
- [Marketing API Q2 2026 (Kitchn)](https://kitchn.io/blog/meta-marketing-api-q2-2026-update)
- [Referencia Instagram API](https://gist.github.com/jameschapman2c/65eff9f54a2d350b17a6ce5127b9fe42)
- [Passthrough Camera API (Quest)](https://developers.meta.com/horizon/documentation/android-apps/passthrough-camera)
