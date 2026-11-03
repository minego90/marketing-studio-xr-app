// Video con Kling 4.0 a través de fal.ai (cola REST). El saldo de fal no vence.
// La clave FAL_KEY solo se lee del entorno del servidor; nunca se escribe en respuestas, registros ni en el navegador.
import { ProviderError, request, VIDEO_STYLES } from './providers.mjs';
export const FAL_QUEUE = 'https://queue.fal.run';
export const FAL_MODEL = { id: 'kling', name: 'Kling 4.0 (fal)', short: 'Kling 4.0', mode: 'Reference to video', endpoint: 'kling/v4/reference-to-video', resolution: '720p', aspectRatio: '9:16', sheet: true };
// FLUX 3 Max image-to-video: una sola imagen de partida (sin hoja de producto). Más barato; por defecto.
export const FLUX_MODEL = { id: 'flux', name: 'FLUX 3 Max (fal)', short: 'FLUX 3 Max', mode: 'Image to video', endpoint: 'blackforestlabs/flux-3-max/image-to-video', resolution: '720p', aspectRatio: '9:16', sheet: false };
// Seedance 2.5 image-to-video a 480p: una sola imagen, duración como TEXTO («5», «10»), relación de aspecto tomada de la imagen. Por defecto.
export const SEEDANCE_MODEL = { id: 'seedance', name: 'Seedance 2.5 480p (fal)', short: 'Seedance 2.5', mode: 'Image to video', endpoint: 'bytedance/seedance-2.5/image-to-video', resolution: '480p', aspectRatio: 'auto', sheet: false };
export const falModel = id => (id === 'kling' ? FAL_MODEL : id === 'flux' ? FLUX_MODEL : SEEDANCE_MODEL);
const toFalRefs = (t, flux = false) => String(t).replace(/@image_(\d+)/gi, flux ? 'la imagen' : '@Image$1'); // Kling nombra las referencias @Image1…; FLUX parte de una sola imagen
// Convierte el plan por segundos (JSON) en texto de dirección para el modelo; si no es JSON, usa el texto tal cual.
export function promptFromPlan(text, { flux = false } = {}) {
  let o;
  try {
    o = JSON.parse(text);
  } catch {
    return toFalRefs(String(text || ''), flux).slice(0, 2400);
  }
  if (!Array.isArray(o.shots)) return toFalRefs(String(text || ''), flux).slice(0, 2400);
  const refs = flux
    ? ''
    : Object.entries(o.references || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join('. ');
  const shots = o.shots
    .map((s, i) => `PLANO ${i + 1} (${s.time}): ${s.framing ? s.framing + ', ' : ''}lente ${s.lens}, ${s.camera}. Acción: ${s.action}. Luz: ${s.lighting}.${s.transition && !/ninguna/i.test(s.transition) ? ' Corte: ' + s.transition + '.' : ''}${s.sound ? ' Audio: ' + s.sound + '.' : ''}`)
    .join(' ');
  const look = o.look ? `Look único: ${o.look}.` : '';
  const rules = 'Fotorrealista, como grabado con cámara real, textura natural, grano fino de película; sin aspecto de pintura ni ilustración; un solo movimiento de cámara por plano; el producto idéntico en cada corte; sin objetos que aparezcan o desaparezcan.';
  const a = o.audio && typeof o.audio === 'object' ? o.audio : null;
  const audio = a ? `Audio: música ${a.music || 'instrumental moderna'}. Efectos: ${a.sfx || 'sincronizados con la acción'}. ${a.voice || 'Sin voz hablada ni diálogo.'}` : '';
  return toFalRefs(`${o.concept || ''} ${look} ${refs ? 'Referencias → ' + refs + '.' : ''} ${shots} ${audio} ${o.product_consistency || ''} ${rules} Evitar: ${(o.avoid || []).join(', ')}.`.replace(/\s+/g, ' ').trim(), flux).slice(0, 2400);
}
export function falInput({ duration, orientation, prompt, style }, images, { sheet = false, model = FAL_MODEL } = {}) {
  if (![5, 10].includes(duration) || orientation !== 'vertical') throw new ProviderError('El video es vertical 9:16, de 5 o 10 segundos.', 400);
  if (model.id === 'seedance') {
    if (!Array.isArray(images) || images.length !== 1 || typeof images[0] !== 'string' || !images[0].startsWith('https://'))
      throw new ProviderError('Seedance 2.5 parte de una sola imagen con URL HTTPS pública.', 400);
    const pre = VIDEO_STYLES.find(x => x.id === style);
    if (!pre) throw new ProviderError('Elige un estilo disponible.', 400);
    return {
      prompt: `Video publicitario vertical de ${duration} segundos que parte de esta imagen como primer cuadro. ${pre.prompt} ${promptFromPlan(prompt, { flux: true })} Con música de fondo y efectos de sonido sincronizados, sin voz hablada. Sin texto ni tipografía añadida, sin deformar el producto.`.slice(0, 4000),
      image_url: images[0],
      duration: String(duration),
      resolution: '480p',
      aspect_ratio: 'auto',
      generate_audio: true
    };
  }
  if (model.id === 'flux') {
    if (!Array.isArray(images) || images.length !== 1 || typeof images[0] !== 'string' || !images[0].startsWith('https://'))
      throw new ProviderError('FLUX 3 Max parte de una sola imagen con URL HTTPS pública.', 400);
    const pre = VIDEO_STYLES.find(x => x.id === style);
    if (!pre) throw new ProviderError('Elige un estilo disponible.', 400);
    return {
      prompt: `Video publicitario vertical 9:16 de ${duration} segundos que parte de esta imagen como primer cuadro. ${pre.prompt} ${promptFromPlan(prompt, { flux: true })} Con música de fondo y efectos de sonido sincronizados, sin voz hablada. Sin texto ni tipografía añadida, sin deformar el producto.`.slice(0, 4000),
      image_url: images[0],
      duration,
      resolution: '720p',
      aspect_ratio: '9:16',
      generate_audio: true
    };
  }
  if (!Array.isArray(images) || images.length < 1 || images.length > 10 || images.some(u => typeof u !== 'string' || !u.startsWith('https://')))
    throw new ProviderError('El video necesita de 1 a 10 referencias con URL HTTPS pública.', 400);
  const preset = VIDEO_STYLES.find(s => s.id === style);
  if (!preset) throw new ProviderError('Elige un estilo disponible.', 400);
  const roles =
    sheet && images.length > 1
      ? '@Image1 es una hoja de producto con 4 vistas sobre fondo blanco: úsala solo para la identidad real del producto (forma, etiqueta, materiales, proporciones). @Image2 es la publicación aprobada: define escena, estilo y composición; el video parte de ella. '
      : '';
  return {
    prompt: `Video publicitario vertical 9:16 de ${duration} segundos. ${roles}${preset.prompt} ${promptFromPlan(prompt)} Sin texto ni tipografía añadida, sin deformar el producto.`.slice(0, 4000),
    image_urls: images,
    duration,
    resolution: '720p',
    aspect_ratio: '9:16'
  };
}
const headers = env => ({ Authorization: 'Key ' + env.FAL_KEY, 'Content-Type': 'application/json' });
const clean = (env, e) => {
  if (e instanceof ProviderError && env.FAL_KEY) e.message = e.message.replaceAll(env.FAL_KEY, '[redactado]');
  return e;
};
export async function submitFal(env, input, endpoint = FAL_MODEL.endpoint) {
  if (!env.FAL_KEY) throw new ProviderError('Falta FAL_KEY en la configuración privada del servidor.', 409);
  try {
    const r = await request(`${FAL_QUEUE}/${endpoint}`, { method: 'POST', headers: headers(env), body: JSON.stringify(input) });
    if (!r.request_id || !String(r.status_url || '').startsWith('https://queue.fal.run/') || !String(r.response_url || '').startsWith('https://queue.fal.run/'))
      throw new ProviderError('fal no devolvió un identificador de tarea válido. Revisa fal.ai/dashboard antes de repetir (podría haberse cobrado).');
    return { id: String(r.request_id), statusUrl: r.status_url, responseUrl: r.response_url };
  } catch (e) {
    throw clean(env, e);
  }
}
export async function readFal(env, { statusUrl, responseUrl }) {
  try {
    const st = await request(statusUrl, { headers: headers(env) });
    const status = String(st.status || '').toUpperCase();
    if (!['IN_QUEUE', 'IN_PROGRESS', 'COMPLETED'].includes(status)) throw new ProviderError('Estado de fal desconocido: ' + status);
    if (status !== 'COMPLETED') return { status: status === 'IN_QUEUE' ? 'en cola' : 'procesando', queue: st.queue_position ?? null };
    const out = await request(responseUrl, { headers: headers(env) });
    const url = out.video?.url;
    if (!url || !url.startsWith('https://')) throw new ProviderError('fal terminó sin una URL de video HTTPS válida.');
    return { status: 'succeeded', url };
  } catch (e) {
    throw clean(env, e);
  }
}
