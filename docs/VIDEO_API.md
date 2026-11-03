# Contratos de video consultados

Kling oficial, autenticación Bearer y host https://api-singapore.klingai.com:
https://kling.ai/document-api/api/get-started/authentication

Contrato 4.0 Omni: https://kling.ai/document-api/api/video/4-0/video-omni. La página es una SPA; los campos se verificaron leyendo los módulos públicos oficiales referenciados por su loader:
- https://s15-kling.klingai.com/kos/s101/nlav112918/api-doc/assets/api-CgBCRRHC.js
- https://s15-kling.klingai.com/kos/s101/nlav112918/api-doc/assets/kling-4-params-Crel4J22.js
- https://s15-kling.klingai.com/kos/s101/nlav112918/api-doc/assets/query-task-endpoints-BaBh8lnN.js
- https://s15-kling.klingai.com/kos/s101/nlav112918/api-doc/assets/api-BcxxZVwD.js

POST /omni-video/kling-4.0; contents con prompt y refer_image/url/id; settings resolution 720p o1080p, aspect_ratio explícito, duration; options.external_task_id. Consulta GET /tasks?task_ids=ID con data[]/id/status/outputs[type=video].url. Autenticación validada solo con consulta gratuita GET /account/costs. No prueba acceso al modelo ni generación final.

Referencia de producto: https://kling.ai/quickstart/kling-4-model-user-guide
Meta: https://dev.meta.ai/docs/models y https://ai.meta.com/blog/introducing-muse-image-muse-video-msl . El catálogo consultado no ofrece generación de Muse Video; no confundir comprensión de video con generación.
