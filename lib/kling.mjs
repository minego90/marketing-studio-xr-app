import { ProviderError, request, VIDEO_STYLES } from './providers.mjs';
export const KLING_BASE = 'https://api-singapore.klingai.com';
export const KLING_MODEL = {
  name: 'Kling 4.0',
  mode: 'Omni Reference',
  path: '/omni-video/kling-4.0',
  resolution: '720p',
  aspectRatio: '9:16'
};
export function klingInput({ duration, orientation, prompt, style }, images, externalId, { sheet = false } = {}) {
  if (![5, 10].includes(duration) || orientation !== 'vertical')
    throw new ProviderError('Kling está configurado en vertical 9:16, con 5 o 10 segundos.', 400);
  if (
    !Array.isArray(images) ||
    images.length < 1 ||
    images.length > 4 ||
    images.some(u => typeof u !== 'string' || !u.startsWith('https://'))
  )
    throw new ProviderError('Kling necesita de una a cuatro referencias JPEG/PNG con URL HTTPS pública.', 400);
  const preset = VIDEO_STYLES.find(s => s.id === style);
  if (!preset) throw new ProviderError('Elige un estilo disponible.', 400);
  if (!externalId || !/^[\w-]{1,80}$/.test(externalId)) throw new ProviderError('Falta el identificador de video.', 400);
  return {
    contents: [
      {
        type: 'prompt',
        text: `Create a professional vertical 9:16 advertising video, ${duration} seconds. ${preset.prompt} ${String(prompt || '').slice(0, 2000)} ${sheet && images.length > 1 ? '@image_1 is a four-view product reference sheet (front, right, left, back) on white: use it ONLY for the real identity of the product. @image_2 is the approved publication design: use it for scene, style, composition and palette; the video starts from it. ' : ''}Use ${images.map((_, i) => '@image_' + (i + 1)).join(', ')} as references to the SAME product and campaign. Preserve exact product proportions, brand, label and materials. References are not a mandatory sequence of keyframes. Subtle intentional movement, controlled lighting, no product morphing, no invented text, no superimposed titles.`
      },
      ...images.map((url, i) => ({ type: 'refer_image', url, id: 'image_' + (i + 1) }))
    ],
    settings: { resolution: '720p', duration, aspect_ratio: '9:16' },
    options: { external_task_id: externalId }
  };
}
export async function klingRequest(env, path, body = null) {
  if (!env.KLING_API_KEY) throw new ProviderError('Configura KLING_API_KEY del panel oficial de Kling en el servidor.', 409);
  if (!path.startsWith('/')) throw new ProviderError('Ruta de Kling no válida.');
  const r = await request(KLING_BASE + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + env.KLING_API_KEY, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (r.code !== 0)
    throw new ProviderError(
      'Kling rechazó la solicitud: ' +
        String(r.message || r.msg || r.code)
          .replaceAll(env.KLING_API_KEY, '[redactado]')
          .slice(0, 240)
    );
  return r;
}
export async function submitKling(env, input) {
  const r = await klingRequest(env, KLING_MODEL.path, input);
  if (!r.data?.id) throw new ProviderError('Kling no devolvió un ID de tarea. Consulta el ID externo antes de repetir.');
  return { id: String(r.data.id), status: r.data.status };
}
export async function readKlingTask(env, id) {
  const r = await klingRequest(env, '/tasks?task_ids=' + encodeURIComponent(id));
  const list = Array.isArray(r.data) ? r.data : [];
  const task = list.find(t => String(t.id) === String(id));
  if (!task) throw new ProviderError('Kling todavía no devolvió la tarea solicitada; conserva el ID antes de repetir.');
  if (!['submitted', 'processing', 'succeeded', 'failed'].includes(task.status))
    throw new ProviderError('Estado de Kling desconocido: ' + task.status);
  if (task.status === 'failed')
    throw new ProviderError('Kling no completó el video: ' + String(task.message || 'solicitud fallida').slice(0, 220));
  const url = task.outputs?.find(o => o.type === 'video')?.url;
  if (task.status === 'succeeded' && (!url || !url.startsWith('https://')))
    throw new ProviderError('Kling terminó sin una URL de video HTTPS válida.');
  return { status: task.status, url, billing: task.billing || null };
}
