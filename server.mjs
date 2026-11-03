import { spawn } from 'node:child_process';
import { directVideo, localVideoIdeas } from './lib/video-director.mjs';
import { KLING_MODEL, klingInput, submitKling, readKlingTask } from './lib/kling.mjs';
import { falModel, falInput, submitFal, readFal } from './lib/fal.mjs';
import { planAds, localAdsPlan } from './lib/ads-planner.mjs';
import http from 'node:http';
import { readFile, writeFile, mkdir, readdir, appendFile, stat } from 'node:fs/promises';
import { readFileSync, openSync } from 'node:fs';
import { resolve, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import * as P from './lib/providers.mjs';
import * as A from './lib/ads.mjs';
import * as S from './lib/strategy.mjs';
import * as I from './lib/insights.mjs';
import { loadAgentKit, reviewCampaign, askLuma } from './lib/agent.mjs';
import { promoteCard, adsManagerCsv, exportReadme } from './lib/ads-export.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
try {
  process.loadEnvFile(resolve(root, '.env'));
} catch {}
const env = process.env,
  port = Number(env.PORT || 8844),
  dataDir = resolve(root, env.DATA_DIR || 'data'),
  mediaDir = resolve(dataDir, 'media');
await mkdir(mediaDir, { recursive: true });
await mkdir(resolve(dataDir, 'jobs'), { recursive: true });
let access = env.APP_ACCESS_CODE;
if (!access) {
  try {
    access = await readFile(resolve(dataDir, 'access-code'), 'utf8');
  } catch {
    access = randomUUID();
    await writeFile(resolve(dataDir, 'access-code'), access, { mode: 0o600 });
  }
}
const jobs = new Map();
for (const f of await readdir(resolve(dataDir, 'jobs'))) {
  if (!f.endsWith('.json')) continue;
  try {
    const j = JSON.parse(await readFile(resolve(dataDir, 'jobs', f), 'utf8'));
    if (['running', 'queued'].includes(j.status)) {
      j.status = 'interrupted';
      j.error = 'El servidor se reinició durante este trabajo. No se reintentó automáticamente.';
    }
    jobs.set(j.id, j);
  } catch {}
}
const active = new Set();
const capturesFile = resolve(dataDir, 'captures.json');
let captures = { front: null, right: null, left: null, back: null, side: null, web: null };
const strategyFile = resolve(dataDir, 'strategy.json');
let strategy = { brief: S.normalizeStrategy({}), plan: null };
try {
  strategy = JSON.parse(await readFile(strategyFile, 'utf8'));
  strategy.brief = S.normalizeStrategy(strategy.brief);
} catch {}
try {
  captures = { ...captures, ...JSON.parse(await readFile(capturesFile, 'utf8')) };
} catch {}
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.csv': 'text/csv; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ico': 'image/x-icon'
};
function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
async function body(req) {
  const chunks = [];
  let n = 0;
  for await (const c of req) {
    n += c.length;
    if (n > 32_000_000) throw new P.ProviderError('Solicitud demasiado grande.', 413);
    chunks.push(c);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || '{}');
  } catch {
    throw new P.ProviderError('JSON inválido.', 400);
  }
}
function sig(file) {
  return createHmac('sha256', access).update(file).digest('hex');
}
function mediaURL(file) {
  return `/media/${file}`;
}
function productPhotos() {
  return { front: captures.front, right: captures.right || captures.side || null, left: captures.left || null, back: captures.back };
}
function requirePaidEnabled() {
  if (env.ENABLE_PAID_APIS !== 'true')
    throw new P.ProviderError(
      'Las APIs con costo están bloqueadas. Sigue en Demo; para activarlas cambia ENABLE_PAID_APIS=true en .env y reinicia.',
      409
    );
}
// Base pública HTTPS que Meta puede descargar. Prioridad: la dirección con la que te están llamando ahora (túnel vivo),
// luego data/tunnel.url (la escribe el lanzador) y por último PUBLIC_BASE_URL del .env (puede quedar obsoleto).
let liveBase = null;
function noteHost(req) {
  const h = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (/^[a-z0-9-]+\.trycloudflare\.com$/i.test(h)) liveBase = 'https://' + h;
}
function publicBase() {
  if (liveBase) return liveBase;
  try {
    const u = readFileSync(resolve(root, 'data', 'tunnel.url'), 'utf8').trim();
    if (/^https:\/\//.test(u)) return u;
  } catch {}
  return env.PUBLIC_BASE_URL?.startsWith('https://') ? env.PUBLIC_BASE_URL : null;
}
function publicURL(file) {
  const base = publicBase();
  if (!base)
    throw new P.ProviderError(
      'Instagram necesita un enlace HTTPS público que Meta pueda descargar. Abre la app desde el link del túnel (no desde localhost) y vuelve a intentar.',
      409
    );
  return `${base.replace(/\/$/, '')}/media/${file}?sig=${sig(file)}`;
}
// Comprueba, antes de gastar una llamada a Instagram, que el archivo público realmente se descarga como imagen o video.
async function assertPublicMedia(file, kind) {
  const u = publicURL(file);
  let r;
  try {
    r = await fetch(u, { method: 'GET', signal: AbortSignal.timeout(15000), headers: { Range: 'bytes=0-64' } });
  } catch (e) {
    throw new P.ProviderError('Instagram no podrá descargar tus archivos: el enlace público no responde (' + e.message + '). Reinicia el túnel y vuelve a abrir la app desde el link nuevo.', 409);
  }
  const ct = r.headers.get('content-type') || '';
  if (!(r.ok || r.status === 206) || !new RegExp('^' + kind + '/').test(ct))
    throw new P.ProviderError(`Instagram no podrá descargar el archivo (HTTP ${r.status}, tipo ${ct || 'desconocido'}). Revisa el link del túnel.`, 409);
}
function getJob(id) {
  const j = jobs.get(id);
  if (!j) throw new P.ProviderError('Trabajo no encontrado.', 404);
  return j;
}
function cleanJob(j) {
  return { ...j };
}
async function persist(j) {
  j.updatedAt = new Date().toISOString();
  await writeFile(resolve(dataDir, 'jobs', `${j.id}.json`), JSON.stringify(j, null, 2));
}
async function job(type, run) {
  if (active.size >= 2) throw new P.ProviderError('Hay dos trabajos en curso. Espera a que terminen.', 429);
  const j = {
    id: randomUUID(),
    type,
    status: 'queued',
    progress: 0,
    stage: 'Preparando',
    createdAt: new Date().toISOString(),
    result: null
  };
  jobs.set(j.id, j);
  active.add(j.id);
  await persist(j);
  setImmediate(async () => {
    try {
      j.status = 'running';
      await persist(j);
      await run(j);
      if (j.status !== 'cancelled') {
        j.status = 'completed';
        j.progress = 100;
        j.stage = 'Listo';
      }
    } catch (e) {
      if (j.status !== 'cancelled') {
        j.status = 'failed';
        j.error = e.message;
        j.stage = 'Requiere atención';
      }
    } finally {
      active.delete(j.id);
      await persist(j);
    }
  });
  return j;
}
async function step(j, label, progress) {
  if (j.status === 'cancelled') throw new Error('Cancelado');
  j.stage = label;
  j.progress = progress;
  await persist(j);
}
// Proveedor de video: fal (saldo que no vence) si hay FAL_KEY, salvo que VIDEO_PROVIDER=kling.
function videoProvider() {
  return env.VIDEO_PROVIDER === 'kling' ? 'kling' : env.FAL_KEY ? 'fal' : 'kling';
}
// Tope de seguridad: máximo de videos pagados por 24 h (por defecto 10; el entorno solo puede bajarlo).
const VIDEO_DAILY_CAP = 10;
async function videoLedger(add) {
  const f = resolve(dataDir, 'video-ledger.json');
  let list = [];
  try {
    list = JSON.parse(await readFile(f, 'utf8')).entries || [];
  } catch {}
  const since = Date.now() - 86400000;
  list = list.filter(e => Date.parse(e.at) > since);
  const cap = Math.min(VIDEO_DAILY_CAP, Number(env.VIDEO_MAX_PER_DAY) > 0 ? Number(env.VIDEO_MAX_PER_DAY) : VIDEO_DAILY_CAP);
  if (!add) {
    if (list.length >= cap) throw new P.ProviderError(`Tope de seguridad: ya se enviaron ${list.length} videos de pago en las últimas 24 h (máximo ${cap}).`, 429);
    return;
  }
  list.push({ at: new Date().toISOString(), ...add });
  await writeFile(f, JSON.stringify({ entries: list }, null, 1));
}
// Modelo de video en fal: Seedance 2.5 480p por defecto (FAL_VIDEO_MODEL=flux o kling, o model en la petición, para los otros) (una imagen, más barato); FAL_VIDEO_MODEL=kling o model:'kling' en la petición usa Kling 4.0 con hoja.
const falChoice = b => falModel(b?.model || env.FAL_VIDEO_MODEL || 'seedance');
function config() {
  return {
    meta: !!env.MODEL_API_KEY,
    higgsfield: !!env.HF_API_KEY,
    kling: !!env.KLING_API_KEY,
    fal: !!env.FAL_KEY,
    videoReady: videoProvider() === 'fal' ? !!env.FAL_KEY : !!env.KLING_API_KEY,
    video: videoProvider() === 'fal' ? { provider: 'fal', model: falChoice().name, short: falChoice().short, mode: falChoice().mode, sheet: falChoice().sheet, resolution: falChoice().resolution, aspectRatio: falChoice().aspectRatio } : { provider: 'kling', model: KLING_MODEL.name, short: 'Kling 4.0', mode: KLING_MODEL.mode, sheet: true, resolution: '720p', aspectRatio: '9:16' },
    instagram: !!(env.IG_USER_ID && env.IG_ACCESS_TOKEN),
    ads: A.adsReady(env),
    adsWriteEnabled: env.ENABLE_META_ADS_WRITE === 'true',
    adsGuard: A.adsGuardReport(env),
    paidEnabled: env.ENABLE_PAID_APIS === 'true',
    publicMedia: !!publicBase(),
    styles: P.VIDEO_STYLES,
    models: { spark: env.META_SPARK_MODEL || 'muse-spark-1.3', image: env.META_IMAGE_MODEL || 'muse-image-1.0' },
    presetsNote:
      'Estilos propios; no son presets oficiales de Trends. Genjutsu y otros workflows requieren contratos y medios específicos.',
    apiKeys: {
      meta: 'https://dev.meta.ai/',
      higgsfield: 'https://open.higgsfield.ai/api-keys',
      kling: 'https://kling.ai/dev/api-key',
      instagram: 'https://developers.facebook.com/apps/',
      ads: 'https://developers.facebook.com/docs/marketing-apis/overview/authentication'
    }
  };
}
let instagramHealth = { checkedAt: 0, result: null };
let adsHealth = { checkedAt: 0, result: null };
async function checkInstagram() {
  if (!env.IG_ACCESS_TOKEN || !env.IG_USER_ID)
    return { configured: false, valid: false, message: 'Faltan IG_ACCESS_TOKEN o IG_USER_ID en .env.' };
  if (instagramHealth.result && Date.now() - instagramHealth.checkedAt < 120000) return instagramHealth.result;
  let result;
  try {
    const a = await P.instagram(env, `${env.IG_USER_ID}?fields=id,username`);
    result = {
      configured: true,
      valid: !!a.id,
      username: a.username || '',
      message: a.id ? 'Conexión de Instagram verificada.' : 'Instagram no devolvió el ID de cuenta.'
    };
  } catch (e) {
    result = {
      configured: true,
      valid: false,
      message: /expired|expirad|code 190/i.test(e.message)
        ? 'El token de Instagram venció. Genera uno nuevo y actualiza IG_ACCESS_TOKEN en .env.'
        : `Instagram rechazó la conexión: ${e.message}`
    };
  }
  instagramHealth = { checkedAt: Date.now(), result };
  return result;
}
async function checkAds() {
  const missing = ['ADS_ACCESS_TOKEN', 'ADS_ACCOUNT_ID', 'ADS_PAGE_ID', 'ADS_IG_ACTOR_ID'].filter(key => !env[key]);
  if (missing.length) return { configured: false, valid: false, message: `Falta ${missing.join(', ')} en .env.` };
  if (adsHealth.result && Date.now() - adsHealth.checkedAt < 120000) return adsHealth.result;
  let result;
  try {
    const account = await A.accountInfo(env);
    result = {
      configured: true,
      valid: account.account_status === 1,
      name: account.name || '',
      currency: account.currency || '',
      message:
        account.account_status === 1
          ? `Meta Ads verificado: ${account.name || env.ADS_ACCOUNT_ID} (${account.currency || 'moneda sin identificar'}).`
          : 'La cuenta publicitaria no está activa.'
    };
  } catch (e) {
    result = { configured: true, valid: false, message: `Meta Ads rechazó la conexión: ${e.message}` };
  }
  adsHealth = { checkedAt: Date.now(), result };
  return result;
}
function strategyHook(v) {
  const plan = jobs.get(v.videoPlanId);
  const h = plan?.result?.hooks?.find(x => x.id === v.hookId);
  return h?.title ? String(h.title).slice(0, 160) : '';
}
function selectedCampaign(b) {
  const c = getJob(b.campaignId);
  if (c.type !== 'campaign' || c.status !== 'completed') throw new P.ProviderError('Primero termina una campaña.', 409);
  const ids = Array.isArray(b.selected) ? [...new Set(b.selected)] : [];
  if (!ids.length || ids.length > 4) throw new P.ProviderError('Selecciona de una a cuatro imágenes.', 400);
  const selected = ids.map(id => c.result.assets.find(a => a.id === id)).map(a => (a ? { ...a } : null));
  if (selected.some(a => !a)) throw new P.ProviderError('Una imagen seleccionada no pertenece a la campaña.', 400);
  return { campaign: c, selected };
}

async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  noteHost(req);
  const local =
    ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) &&
    /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(req.headers.host || '') &&
    !req.headers['x-forwarded-host'] &&
    !req.headers['x-forwarded-for'] &&
    !req.headers['cf-connecting-ip'];
  const cookie = (req.headers.cookie || '').split(';').some(s => s.trim() === `xr_access=${access}`);
  const signed = url.pathname.startsWith('/media/') && url.searchParams.get('sig') === sig(basename(url.pathname));
  const accessQuery = url.searchParams.get('access') === access;
  let sameOriginReferrer = false;
  try {
    const ref = new URL(req.headers.referer || '');
    sameOriginReferrer =
      ref.host === (req.headers['x-forwarded-host'] || req.headers.host) &&
      ref.pathname === '/' &&
      ref.searchParams.get('access') === access;
  } catch {}
  if (accessQuery) {
    const secure = req.headers['x-forwarded-proto'] === 'https';
    res.setHeader(
      'Set-Cookie',
      `xr_access=${access}; HttpOnly; ${secure ? 'SameSite=None; Secure' : 'SameSite=Lax'}; Path=/; Max-Age=604800`
    );
  }
  if (!local && !cookie && !signed && !accessQuery && !sameOriginReferrer) {
    res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Aumentados XR</h1><p>Abre el enlace completo de acceso mostrado por tu servidor local.</p>');
    return;
  }
  if (req.method === 'POST' && req.headers.origin) {
    const origin = new URL(req.headers.origin).host;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (origin !== host) throw new P.ProviderError('Origen no autorizado.', 403);
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), xr-spatial-tracking=(self)');
  if (url.pathname === '/api/build') return send(res, 200, await buildInfo());
  if (url.pathname === '/api/config') return send(res, 200, config());
  if (url.pathname === '/api/connections' && req.method === 'GET') {
    const [instagram, ads] = await Promise.all([checkInstagram(), checkAds()]);
    return send(res, 200, { instagram, ads });
  }
  if (url.pathname === '/api/strategy' && req.method === 'GET') return send(res, 200, strategy);
  if (url.pathname === '/api/strategy' && req.method === 'POST') {
    const b = await body(req),
      brief = S.normalizeStrategy(b.brief);
    const photos = {};
    if (b.photos && typeof b.photos === 'object' && !Array.isArray(b.photos))
      for (const slot of ['front', 'right', 'left', 'back']) if (b.photos[slot]) { await P.fileData(b.photos[slot], mediaDir); photos[slot] = b.photos[slot]; }
    if (b.mode === 'local') {
      strategy = { brief, plan: S.localStrategy(brief) };
      await writeFile(strategyFile, JSON.stringify(strategy, null, 2), { mode: 0o600 });
      return send(res, 200, strategy);
    }
    if (b.mode !== 'live' || b.confirmAnalysis !== true)
      throw new P.ProviderError('Confirma el análisis con Muse Spark desde Estrategia.', 400);
    requirePaidEnabled();
    const j = await job('strategy', async j => {
      j.mode = 'live';
      await step(j, 'Luma · Muse Spark preparando estrategia', 20);
      const plan = await S.analyzeStrategy(env, brief, photos, mediaDir);
      strategy = { brief, plan };
      await writeFile(strategyFile, JSON.stringify(strategy, null, 2), { mode: 0o600 });
      j.result = strategy;
      await persist(j);
    });
    return send(res, 202, cleanJob(j));
  }
  if (url.pathname === '/api/photos' && req.method === 'GET') return send(res, 200, productPhotos());
  if (url.pathname === '/api/photos' && req.method === 'POST') {
    const b = await body(req);
    if (!['front', 'right', 'left', 'back', 'side'].includes(b.slot)) throw new P.ProviderError('Vista de foto inválida.', 400);
    if (b.slot === 'side') b.slot = 'right';
    if (b.remove === true) {
      captures[b.slot] = null;
      if (b.slot === 'right') captures.side = null;
      await writeFile(capturesFile, JSON.stringify(captures, null, 2), { mode: 0o600 });
      return send(res, 200, productPhotos());
    }
    if (typeof b.file !== 'string') throw new P.ProviderError('Archivo de foto inválido.', 400);
    await P.fileData(b.file, mediaDir);
    captures[b.slot] = { file: b.file, url: mediaURL(b.file), savedAt: new Date().toISOString() };
    await writeFile(capturesFile, JSON.stringify(captures, null, 2), { mode: 0o600 });
    return send(res, 200, productPhotos());
  }
  if (url.pathname === '/api/jobs' && req.method === 'GET')
    return send(
      res,
      200,
      [...jobs.values()]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 30)
        .map(cleanJob)
    );
  // Parrilla: lo que ya se publicó de verdad (imagen o video, formato y enlace), de lo más nuevo a lo más viejo.
  if (url.pathname === '/api/feed' && req.method === 'GET') {
    const all = [...jobs.values()];
    const items = all
      .filter(j => j.type === 'publish' && j.status === 'completed' && j.result && !j.result.simulated && (j.result.verified || j.result.id))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 24)
      .map(j => {
        const c = jobs.get(j.campaignId);
        const reel = j.result.format === 'reel' || j.media?.kind === 'video';
        let thumb = j.media?.thumb ? mediaURL(j.media.thumb) : c?.result?.assets?.[0]?.url || '';
        let video = j.media?.kind === 'video' ? mediaURL(j.media.file) : null;
        if (!j.media && reel) {
          const v = all.filter(x => x.type === 'video' && x.status === 'completed' && x.result?.url && String(x.createdAt) <= String(j.createdAt)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
          video = v?.result?.url || null;
        }
        return { id: j.id, format: j.result.format, isVideo: !!video || reel, createdAt: j.createdAt, permalink: j.result.permalink || '', thumb, video, caption: j.caption || '' };
      });
    return send(res, 200, items);
  }
  if (url.pathname.startsWith('/api/jobs/') && req.method === 'GET') return send(res, 200, cleanJob(getJob(url.pathname.split('/').pop())));
  if (url.pathname === '/api/upload' && req.method === 'POST') {
    const b = await body(req);
    const file = await P.saveDataImage(b.image, mediaDir);
    return send(res, 200, { file, url: mediaURL(file) });
  }
  if (url.pathname === '/api/transcribe' && req.method === 'POST') {
    requirePaidEnabled();
    const b = await body(req);
    if (typeof b.audio !== 'string' || !/^data:audio\/wav;base64,/.test(b.audio)) throw new P.ProviderError('Audio inválido.', 400);
    return send(res, 200, { text: await P.transcribe(env, Buffer.from(b.audio.split(',')[1], 'base64')) });
  }
  if (url.pathname === '/api/ads/plan' && req.method === 'POST') {
    const b = await body(req),
      { campaign, selected } = selectedCampaign(b),
      brief = A.validateAdsBrief({ ...b, destination: '', goal: ['auto', 'profile', 'awareness'].includes(b.goal) ? b.goal : 'auto' });
    if (campaign.mode === 'live') {
      requirePaidEnabled();
      if (!env.MODEL_API_KEY) throw new P.ProviderError('Falta MODEL_API_KEY; no se ejecutó ninguna llamada.', 409);
      const acc = await checkAds().catch(() => null);
      if (acc?.valid && acc.currency && acc.currency !== brief.currency)
        throw new P.ProviderError(`Tu cuenta de Meta Ads usa ${acc.currency}; la pauta está en ${brief.currency}. Cambia la moneda a ${acc.currency} y prepara la propuesta de nuevo.`, 400);
    }
    // Solo se promueve una publicación existente si es EXACTAMENTE la misma pieza de la pauta (mismo video, o mismas imágenes).
    // Si no coincide, se sube lo que el usuario eligió: así nunca se cuela un video cuando se pidieron imágenes (ni al revés).
    const videoFile = b.videoJobId ? getJob(b.videoJobId)?.result?.file : null;
    const publication = [...jobs.values()]
      .filter(
        j =>
          j.type === 'publish' &&
          j.campaignId === campaign.id &&
          j.status === 'completed' &&
          j.result?.verified &&
          j.result?.format !== 'story' &&
          (b.videoJobId
            ? j.media?.kind === 'video' && j.media?.file === videoFile
            : j.media?.kind !== 'video' && j.media?.thumb === selected[0]?.file && Number(j.media?.count || 1) === selected.length)
      )
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    const profile = /^[a-zA-Z0-9_.]{1,30}$/.test(b.profileUsername || '') ? b.profileUsername : null;
    const context = {
      product: campaign.result.product,
      title: campaign.result.title,
      caption: String(b.caption ?? campaign.result.caption ?? '').slice(0, 2200),
      brief: campaign.result.brief,
      theme: String(b.campaignTheme || campaign.result.title || '').slice(0, 250),
      profile,
      publication: publication?.result?.permalink || null,
      strategy: strategy.brief
    };
    let assets = selected.map(a => ({
      ...a,
      headline: String((b.headlines || []).find(x => x.assetId === a.id)?.headline || a.headline || a.title || '').slice(0, 72)
    }));
    // Pauta con VIDEO: la pieza es el video ya creado (Reel/Historia 9:16), no las imágenes.
    if (b.videoJobId) {
      const v = getJob(b.videoJobId);
      if (v.type !== 'video' || v.status !== 'completed' || !v.result?.file) throw new P.ProviderError('Primero crea o graba el video de la pauta.', 409);
      const hook = strategyHook(v);
      context.pieceType = 'video';
      context.videoNote = `Video vertical 9:16 de ${v.result.duration || v.settings?.duration || '5'} s${hook ? ' · idea: ' + hook : ''}.`;
      assets = [
        {
          id: 'video',
          kind: 'video',
          title: hook || 'Video de la campaña',
          headline: String((b.headlines || [])[0]?.headline || hook || campaign.result.title || 'Video').slice(0, 72),
          url: v.result.url,
          file: v.result.file,
          duration: Number(v.result.duration || v.settings?.duration || 5)
        }
      ];
    }
    const j = await job('ads-plan', async j => {
      j.mode = campaign.mode;
      j.campaignId = campaign.id;
      await step(
        j,
        campaign.mode === 'demo' ? 'Luma preparando guía local de pauta' : 'Luma analizando publicación e imágenes con Muse Spark',
        15
      );
      const recommendation =
        campaign.mode === 'demo' ? localAdsPlan(brief, context, assets) : await planAds(env, brief, context, assets, mediaDir);
      j.result = {
        brief,
        recommendation,
        caption: context.caption,
        sourceContext: { profile, publication: context.publication, mediaId: publication?.result?.id || null, theme: context.theme },
        assets: assets.map(a => ({ id: a.id, title: a.title, headline: a.headline, url: a.url, file: a.file, ...(a.kind ? { kind: a.kind, duration: a.duration } : {}) })),
        pieceType: assets[0]?.kind === 'video' ? 'video' : 'images',
        thumb: selected[0]?.file || null,
        campaignId: campaign.id,
        createdAt: new Date().toISOString(),
        remote: null
      };
      await persist(j);
    });
    return send(res, 202, cleanJob(j));
  }

  if (url.pathname === '/api/agent/kit' && req.method === 'GET') {
    const kit = await loadAgentKit();
    return send(res, 200, {
      principles: kit.roles.principles,
      roles: kit.roles.roles,
      pipeline: kit.roles.pipeline,
      skills: Object.values(kit.skills).map(({ id, name, description }) => ({ id, name, description }))
    });
  }
  if (url.pathname === '/api/agent/review' && req.method === 'POST') {
    const b = await body(req);
    const ads = b.planId
      ? (() => {
          const p = getJob(b.planId);
          return p.type === 'ads-plan' && p.result ? p.result : null;
        })()
      : null;
    return send(
      res,
      200,
      reviewCampaign({
        caption: String(b.caption || '').slice(0, 4000),
        headlines: Array.isArray(b.headlines) ? b.headlines.slice(0, 8).map(x => String(x).slice(0, 200)) : [],
        mode: b.mode === 'live' ? 'live' : 'demo',
        ads,
        hasVideo: !!b.hasVideo,
        photos: b.photos && typeof b.photos === 'object' ? b.photos : null,
        assetCount: Number(b.assetCount) || 0
      })
    );
  }
  if (url.pathname === '/api/agent/ask' && req.method === 'POST') {
    const b = await body(req);
    return send(res, 200, await askLuma(b.question, b.page));
  }
  if (url.pathname === '/api/monitor' && req.method === 'GET') {
    const list = [...jobs.values()];
    const byType = {};
    for (const j of list) byType[j.type] = (byType[j.type] || 0) + 1;
    const real = list.filter(j => j.mode && j.mode !== 'demo').length;
    return send(res, 200, {
      now: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / 1048576),
      jobs: { total: list.length, byType, failed: list.filter(j => j.status === 'failed').length, running: list.filter(j => ['queued', 'running'].includes(j.status)).length },
      spend: { realApiJobs: real, paidApisEnabled: env.ENABLE_PAID_APIS === 'true', estimatedUsd: 0 },
      guard: A.adsGuardReport(env),
      latestCaption: [...list].reverse().find(j => j.type === 'campaign' && j.result?.caption)?.result?.caption || ''
    });
  }
  if (url.pathname === '/api/xr-stats' && req.method === 'POST') {
    const b = await body(req);
    const line = JSON.stringify(Object.fromEntries(Object.entries(b || {}).slice(0, 24).map(([k, v]) => [k, typeof v === 'number' || typeof v === 'boolean' ? v : String(v).slice(0, 160)])));
    const file = resolve(dataDir, 'xr-perf.log');
    const big = await stat(file).then(s => s.size > 2e6, () => false);
    if (!big) await appendFile(file, line + '\n').catch(() => {});
    return send(res, 200, { ok: true });
  }
  if (url.pathname === '/api/insights' && req.method === 'GET') return send(res, 200, await I.insights(env));
  if (url.pathname === '/api/admin/restart' && req.method === 'POST') {
    // Reinicio propio: sincronizas archivos nuevos y el servidor vuelve a arrancar solo (mismo puerto, mismo túnel).
    send(res, 200, { ok: true, message: 'Reiniciando…' });
    setTimeout(() => {
      server.close();
      try {
        const log = openSync(resolve(root, 'data', 'server.log'), 'a');
        spawn(process.execPath, process.argv.slice(1), { cwd: process.cwd(), detached: true, stdio: ['ignore', log, log], env: process.env }).unref();
      } catch {}
      setTimeout(() => process.exit(0), 300);
    }, 400);
    return;
  }
  if (url.pathname === '/api/ads-results' && req.method === 'GET') {
    const ids = [...jobs.values()].filter(j => j.type === 'ads-push' && j.status === 'completed' && j.result?.remote?.campaign).map(j => j.result.remote.campaign);
    return send(res, 200, await I.adsResults(env, ids));
  }
  if (url.pathname === '/api/insights-history' && req.method === 'GET') {
    const raw = await readFile(resolve(dataDir, 'insights-history.jsonl'), 'utf8').catch(() => '');
    return send(res, 200, { points: raw.trim().split('\n').filter(Boolean).slice(-200).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) });
  }
  if (url.pathname === '/api/discovery' && req.method === 'GET') return send(res, 200, await I.discovery(env, url.searchParams.get('u')));
  if (url.pathname === '/api/publish-limit' && req.method === 'GET') return send(res, 200, await I.publishingLimit(env));
  if (url.pathname === '/api/xr-ad/bundle' && req.method === 'GET') {
    const ph = productPhotos();
    const faces = ['front', 'right', 'back', 'left'].filter(k => ph[k]).map(k => ({ slot: k, url: ph[k].url }));
    return send(res, 200, {
      title: 'Una vista real desde cada lado',
      sub: 'Gira el prisma: cada cara es una foto real de tu producto. Sin IA y sin costo.',
      cta: { label: 'Visitar perfil', url: '' },
      faces,
      generatedWith: 'local',
      cost: 0
    });
  }
  if (url.pathname === '/api/ads/export' && req.method === 'GET') {
    const p = getJob(url.searchParams.get('planId') || '');
    if (p.type !== 'ads-plan' || p.status !== 'completed') throw new P.ProviderError('Primero prepara una propuesta de pauta.', 409);
    const format = url.searchParams.get('format') || 'card';
    if (format === 'csv') {
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="pauta-ads-manager-borrador.csv"',
        'Cache-Control': 'no-store'
      });
      return res.end(adsManagerCsv(p.result, { pageId: env.ADS_PAGE_ID || '', instagramId: env.ADS_IG_ACTOR_ID || '' }));
    }
    if (format === 'readme') {
      res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(exportReadme());
    }
    return send(res, 200, { card: promoteCard(p.result), guard: A.adsGuardReport(env), sent: false });
  }
  if (url.pathname === '/api/ads/push' && req.method === 'POST') {
    if (env.ENABLE_META_ADS_WRITE !== 'true')
      throw new P.ProviderError(
        'El envío de pauta a Meta está deshabilitado. El borrador permanece local; no se crea un anuncio para revisión.',
        409
      );
    const b = await body(req);
    if (b.confirm !== true || !b.intentId || !/^[\w-]{20,80}$/.test(b.intentId))
      throw new P.ProviderError('Confirma la creación pausada con un identificador único.', 400);
    const prior = [...jobs.values()].find(j => j.type === 'ads-push' && j.intentId === b.intentId);
    if (prior) return send(res, 200, cleanJob(prior));
    const source = getJob(b.planId);
    if (source.type !== 'ads-plan' || source.status !== 'completed')
      throw new P.ProviderError('Primero revisa una propuesta de pauta completa.', 409);
    if (source.mode === 'demo')
      throw new P.ProviderError('La demostración guarda la propuesta solo en este servidor. Cambia a modo real para Ads Manager.', 409);
    requirePaidEnabled();
    if (!A.adsReady(env))
      throw new P.ProviderError('Faltan las credenciales de Meta Marketing API; la propuesta local sigue guardada.', 409);
    const files = [];
    for (const a of source.result.assets) {
      if (a.kind === 'video') {
        await assertPublicMedia(a.file, 'video');
        files.push({ ...a, publicUrl: publicURL(a.file), thumbFile: source.result.thumb });
        continue;
      }
      const p = (b.preparedImages || []).find(x => x.assetId === a.id);
      if (!p || !/^[-\w]+\.jpg$/.test(p.file)) throw new P.ProviderError('Falta el JPEG final con titular para una pieza.', 400);
      await P.fileData(p.file, mediaDir);
      files.push({ ...a, file: p.file, headline: String(p.headline || a.headline).slice(0, 72) });
    }
    const j = await job('ads-push', async j => {
      j.mode = 'live';
      j.intentId = b.intentId;
      j.planId = source.id;
      j.remoteIds = { campaign: null, adset: null, ads: [], creatives: [], imageHashes: [] };
      await persist(j);
      const remote = await A.pushPausedAds(env, source.result, files, mediaDir, async (stage, progress, ids) => {
        j.remoteIds = structuredClone(ids);
        await step(j, stage, progress);
      });
      j.result = { remote, message: 'Campaña, conjunto y anuncios creados en Meta Ads con estado PAUSED. Revisa antes de activar.' };
      source.result.remote = remote;
      await persist(source);
    });
    j.intentId = b.intentId;
    await persist(j);
    return send(res, 202, cleanJob(j));
  }
  if (url.pathname === '/api/campaign' && req.method === 'POST') {
    const b = await body(req);
    if (!['demo', 'live'].includes(b.mode)) throw new P.ProviderError('Modo inválido.', 400);
    await P.fileData(b.photo, mediaDir);
    if (b.photos) {
      if (typeof b.photos !== 'object' || Array.isArray(b.photos)) throw new P.ProviderError('Fotos inválidas.', 400);
      for (const slot of ['front', 'right', 'left', 'side', 'back']) if (b.photos[slot]) await P.fileData(b.photos[slot], mediaDir);
    }
    if (!b.brief || b.brief.length > 4000) throw new P.ProviderError('Escribe un encargo de hasta 4000 caracteres.', 400);
    const localAssets = b.mode === 'demo' || (b.mode === 'live' && b.localAssets === true);
    if (b.mode === 'live' && !localAssets) {
      requirePaidEnabled();
      if (!env.MODEL_API_KEY) throw new P.ProviderError('Falta MODEL_API_KEY; no se ejecutó ninguna llamada.', 409);
    }
    if (localAssets && (!Array.isArray(b.demoAssets) || b.demoAssets.length !== 4))
      throw new P.ProviderError('Faltan las cuatro composiciones de demostración.', 400);
    const j = await job('campaign', async j => {
      j.mode = b.mode;
      await step(j, localAssets ? 'Preparando composiciones locales (sin IA, $0)' : 'Analizando fotos del producto', 10);
      let plan;
      if (localAssets) {
        const theme = String(b.theme || 'Halloween').replace(/[#\n]/g, ' ').trim().slice(0, 80) || 'Halloween';
        const tag = '#' + theme.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '');
        plan = {
          title: theme,
          product: String(b.product || 'Tu producto fotografiado').slice(0, 200),
          summary: `Composiciones locales para «${theme}». La fotografía se integra en cuatro piezas gráficas; no son resultados de Muse Image.`,
          caption: `${theme}: una forma distinta de ver lo cotidiano. Descubre nuestra propuesta. ${tag} #AumentadosCo`,
          videoPrompt: `Revelado cinematográfico del producto para «${theme}», luz suave y movimiento de cámara lento.`,
          sources: [],
          concepts: ['El protagonista', 'Noche violeta', 'Edición de medianoche', 'Un toque de magia'].map(title => ({
            title,
            caption: `${title} · ${theme}. ${tag} #AumentadosCo`
          }))
        };
      } else plan = await P.analyzeCampaign(env, b, mediaDir);
      j.result = { ...plan, assets: [], photo: b.photo, photos: b.photos || { front: b.photo }, brief: b.brief, mode: b.mode, localAssets };
      await persist(j);
      for (let i = 0; i < 4; i++) {
        await step(j, `${localAssets ? 'Componiendo pieza' : 'Generando con Muse Image'} ${i + 1}/4`, 25 + i * 17);
        const a =
          localAssets
            ? { file: await P.saveDataImage(b.demoAssets[i], mediaDir) }
            : await P.generateImage(env, b.photo, plan.concepts[i], mediaDir, b.photos);
        j.result.assets.push({
          id: randomUUID(),
          ...a,
          url: mediaURL(a.file),
          title: plan.concepts[i].title,
          headline: plan.concepts[i].headline || plan.title,
          caption: plan.concepts[i].caption
        });
        await persist(j);
      }
      if (b.mode === 'live' && !localAssets) {
        await step(j, 'Revisando identidad del producto en las cuatro imágenes', 95);
        const reviews = await P.reviewImages(env, b.photo, j.result.assets, mediaDir);
        j.result.assets.forEach((a, i) => (a.review = reviews[i]));
        await persist(j);
      }
    });
    return send(res, 202, cleanJob(j));
  }
  if (url.pathname === '/api/video/plan' && req.method === 'POST') {
    const b = await body(req),
      { campaign, selected } = selectedCampaign(b);
    if (![5, 10].includes(b.duration)) throw new P.ProviderError('Elige video de 5 o 10 segundos.', 400);
    if (campaign.mode === 'live') requirePaidEnabled();
    const context = {
      campaign: campaign.result,
      assets: selected,
      caption: String(b.caption ?? campaign.result.caption ?? '').slice(0, 2200),
      instruction: String(b.instruction || '').slice(0, 2500),
      duration: b.duration,
      sheet: b.sheet === true && (videoProvider() !== 'fal' || falChoice(b).sheet)
    };
    const j = await job('video-plan', async j => {
      j.mode = campaign.mode;
      j.campaignId = campaign.id;
      await step(
        j,
        campaign.mode === 'demo' ? 'Luma preparando hooks de demostración' : 'Luma analizando campaña y buscando referencias de hooks',
        15
      );
      const plan = campaign.mode === 'demo' ? localVideoIdeas(context) : await directVideo(env, context, mediaDir);
      j.result = {
        ...plan,
        campaignId: campaign.id,
        selected: selected.map(a => a.id),
        duration: b.duration,
        sheet: context.sheet,
        orientation: 'vertical',
        resolution: '720p',
        createdAt: new Date().toISOString()
      };
    });
    return send(res, 202, cleanJob(j));
  }
  if (url.pathname === '/api/video' && req.method === 'POST') {
    requirePaidEnabled();
    const b = await body(req),
      { campaign, selected } = selectedCampaign(b);
    if (campaign.mode === 'demo') throw new P.ProviderError('El modo Demo crea animación local; no envía nada a Kling.', 409);
    const vp = videoProvider();
    if (vp === 'fal' ? !env.FAL_KEY : !env.KLING_API_KEY) throw new P.ProviderError(vp === 'fal' ? 'Falta FAL_KEY.' : 'Falta KLING_API_KEY.', 409);
    await videoLedger();
    const plan = getJob(b.videoPlanId);
    if (
      plan.type !== 'video-plan' ||
      plan.status !== 'completed' ||
      plan.campaignId !== campaign.id ||
      plan.mode !== 'live' ||
      plan.result.duration !== b.duration ||
      JSON.stringify(plan.result.selected) !== JSON.stringify(selected.map(a => a.id))
    )
      throw new P.ProviderError('Analiza primero estas imágenes y duración con Luma; revisa una propuesta antes de generar.', 409);
    const hook = plan.result.hooks.find(h => h.id === b.hookId);
    if (!hook) throw new P.ProviderError('Elige una propuesta de video de Luma.', 400);
    const settings = { ...b, prompt: hook.prompt, style: 'reveal' };
    const refs = [];
    const fm = falChoice(b);
    const useSheet = !!plan.result.sheet && (vp !== 'fal' || fm.sheet);
    if (useSheet) {
      if (!/^[-\w]+\.(jpg|jpeg|png)$/.test(b.sheetFile || '')) throw new P.ProviderError('Falta la hoja de referencia del producto.', 400);
      await P.fileData(b.sheetFile, mediaDir);
      refs.push(publicURL(b.sheetFile));
    }
    for (const a of selected) {
      const p = (b.preparedImages || []).find(x => x.assetId === a.id);
      if (!p || !/^[-\w]+\.(jpg|jpeg|png)$/.test(p.file))
        throw new P.ProviderError('Falta preparar una referencia JPEG/PNG para Kling.', 400);
      await P.fileData(p.file, mediaDir);
      refs.push(publicURL(p.file));
    }
    if (vp === 'fal') falInput(settings, refs, { sheet: useSheet, model: fm });
    else klingInput(settings, refs, 'validation', { sheet: useSheet });
    const j = await job('video', async j => {
      j.mode = 'live';
      j.provider = vp;
      j.externalTaskId = j.id;
      j.videoPlanId = plan.id;
      j.hookId = hook.id;
      j.settings = {
        duration: b.duration,
        orientation: 'vertical',
        style: 'reveal',
        model: vp === 'fal' ? fm.name : 'Kling 4.0',
        videoMode: vp === 'fal' ? fm.mode : 'Omni Reference',
        resolution: '720p',
        sheet: useSheet
      };
      await persist(j);
      const label = vp === 'fal' ? 'fal · ' + fm.short : 'Kling 4.0 Omni';
      await step(j, `Enviando referencias a ${label} · 720p vertical`, 10);
      let task;
      if (vp === 'fal') {
        task = await submitFal(env, falInput(settings, refs, { sheet: useSheet, model: fm }), fm.endpoint);
        j.providerId = task.id;
        j.statusUrl = task.statusUrl;
        j.responseUrl = task.responseUrl;
      } else {
        task = await submitKling(env, klingInput(settings, refs, j.externalTaskId, { sheet: useSheet }));
        j.providerId = task.id;
      }
      await videoLedger({ provider: vp, job: j.id, duration: b.duration });
      await persist(j);
      for (let i = 0; i < 180; i++) {
        await new Promise(r => setTimeout(r, 4000));
        const r = vp === 'fal' ? await readFal(env, task) : await readKlingTask(env, j.providerId);
        if (r.status === 'succeeded') {
          await step(j, `Guardando el video de ${label} en el servidor`, 95);
          const rr = await fetch(r.url, { signal: AbortSignal.timeout(120000) });
          if (!rr.ok) throw new P.ProviderError('No se pudo descargar el video. Conserva el ID antes de repetir: ' + j.providerId);
          const bytes = Buffer.from(await rr.arrayBuffer());
          if (bytes.length < 32 || bytes.length > 150_000_000) throw new P.ProviderError('El proveedor devolvió un archivo de tamaño inválido.');
          const file = randomUUID() + '.mp4';
          await writeFile(resolve(mediaDir, file), bytes);
          j.result = {
            file,
            url: mediaURL(file),
            caption: hook.copy || b.caption || campaign.result.caption,
            ...j.settings,
            billing: r.billing,
            mode: 'live',
            provider: vp
          };
          return;
        }
        await step(j, label + ' · ' + r.status, Math.min(90, 20 + i));
      }
      throw new P.ProviderError('El video sigue pendiente en el proveedor. Conserva su ID (' + j.providerId + '); no se reintentó.');
    });
    return send(res, 202, cleanJob(j));
  }
  if (url.pathname === '/api/cancel' && req.method === 'POST') {
    const b = await body(req),
      j = getJob(b.id);
    if (!['queued', 'running'].includes(j.status)) throw new P.ProviderError('El trabajo ya terminó.', 409);
    if (j.type === 'video' && ['kling', 'fal'].includes(j.provider) && j.providerId)
      throw new P.ProviderError(
        'El proveedor ya recibió la tarea; esta integración no tiene cancelación remota verificada. El proceso sigue y conserva su ID.',
        409
      );
    if (j.type === 'video' && j.providerId) await P.higgsRequest(env, `/requests/${encodeURIComponent(j.providerId)}/cancel`, {});
    if (j.type === 'campaign' && j.mode === 'live')
      throw new P.ProviderError('La llamada de Meta en curso no se cancela desde este demo. Espera el resultado.', 409);
    j.status = 'cancelled';
    j.stage = 'Cancelado';
    await persist(j);
    return send(res, 200, j);
  }
  if (url.pathname === '/api/record' && req.method === 'POST') {
    // Video grabado con la cámara del casco/navegador: se guarda y se convierte a MP4 H.264/AAC (lo que Instagram exige).
    const chunks = [];
    let n = 0;
    for await (const c of req) {
      n += c.length;
      if (n > 120_000_000) throw new P.ProviderError('El video es demasiado grande (máximo 120 MB).', 413);
      chunks.push(c);
    }
    if (n < 2000) throw new P.ProviderError('La grabación está vacía. Graba al menos un segundo.', 400);
    const type = String(req.headers['content-type'] || '');
    const id = randomUUID(),
      raw = resolve(mediaDir, id + (type.includes('mp4') ? '.src.mp4' : '.src.webm'));
    await writeFile(raw, Buffer.concat(chunks));
    const file = id + '.mp4';
    await new Promise((ok, fail) => {
      const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-vf', req.headers['x-orientation'] === 'vertical' ? 'crop=trunc(min(iw\\,ih*9/16)/2)*2:trunc(ih/2)*2,scale=w=1080:h=1920:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30' : 'scale=w=1920:h=1080:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', resolve(mediaDir, file)]);
      let err = '';
      ff.stderr.on('data', d => (err += d));
      ff.on('error', e => fail(new P.ProviderError('No se pudo convertir el video (ffmpeg no está disponible): ' + e.message)));
      ff.on('close', code => (code === 0 ? ok() : fail(new P.ProviderError('No se pudo convertir el video: ' + err.slice(0, 200)))));
    });
    const j = { id, type: 'video', status: 'completed', progress: 100, stage: 'Listo', createdAt: new Date().toISOString(), mode: 'live', provider: 'recording', result: { file, url: mediaURL(file), recorded: true } };
    jobs.set(id, j);
    await persist(j);
    return send(res, 200, { id, file, url: mediaURL(file) });
  }
  if (url.pathname === '/api/publish-video' && req.method === 'POST') {
    const b = await body(req);
    if (b.confirm !== true || !/^[\w-]{20,80}$/.test(b.intentId || '')) throw new P.ProviderError('Confirma la publicación.', 400);
    if (!['story', 'reel'].includes(b.format)) throw new P.ProviderError('Elige historia o reel.', 400);
    const prior = [...jobs.values()].find(j => j.type === 'publish' && j.intentId === b.intentId);
    if (prior) return send(res, 200, prior);
    const video = getJob(b.videoId);
    if (video.type !== 'video' || video.status !== 'completed' || !video.result?.file) throw new P.ProviderError('Primero graba un video.', 409);
    const caption = String(b.caption || '').slice(0, 2200);
    requirePaidEnabled();
    const connection = await checkInstagram();
    if (!connection.valid) throw new P.ProviderError(connection.message, 409);
    await assertPublicMedia(video.result.file, 'video');
    const j = await job('publish', async j => {
      j.mode = 'live';
      j.intentId = b.intentId;
      await step(j, 'Preparando contenedor en Instagram', 15);
      const container = await P.instagram(env, `${env.IG_USER_ID}/media`, b.format === 'reel' ? { media_type: 'REELS', video_url: publicURL(video.result.file), caption } : { media_type: 'STORIES', video_url: publicURL(video.result.file) });
      if (!container.id) throw new P.ProviderError('Instagram no devolvió ID de contenedor.');
      j.containerId = container.id;
      await persist(j);
      await P.waitInstagram(env, container.id);
      await step(j, 'Publicando en Instagram', 85);
      j.publicationAttempted = true;
      await persist(j);
      const pub = await P.instagram(env, `${env.IG_USER_ID}/media_publish`, { creation_id: container.id });
      if (!pub.id) throw new P.ProviderError('Respuesta ambigua al publicar. Revisa Instagram antes de repetir.');
      j.result = { id: pub.id, simulated: false, format: b.format, verified: false, message: 'Instagram aceptó la publicación; verificando enlace…' };
      await persist(j);
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const media = await P.instagram(env, `${pub.id}?fields=id,permalink,media_type,timestamp`);
          if (media.id === pub.id && /^https:\/\//.test(media.permalink || '')) {
            j.result = { ...j.result, verified: true, permalink: media.permalink, message: 'Publicado y verificado en Instagram' };
            break;
          }
        } catch {}
        if (attempt < 2) await new Promise(r => setTimeout(r, 1200));
      }
      if (!j.result.verified) j.result.message = 'Instagram devolvió ID de publicación. Revisa el perfil: no se pudo verificar el enlace todavía.';
    });
    j.intentId = b.intentId;
    await persist(j);
    return send(res, 202, j);
  }
  if (url.pathname === '/api/publish' && req.method === 'POST') {
    const b = await body(req);
    if (b.confirm !== true) throw new P.ProviderError('Confirma la publicación desde la vista previa.', 400);
    if (!/^[\w-]{20,80}$/.test(b.intentId || '')) throw new P.ProviderError('Falta un identificador único de publicación.', 400);
    if (!['carousel', 'story', 'reel'].includes(b.format)) throw new P.ProviderError('Formato no válido.', 400);
    const asVideo = b.format === 'reel' || (b.format === 'story' && b.asVideo === true); // la historia también puede ser el video con sonido
    const { campaign, selected } = selectedCampaign(b);
    const caption = String(b.caption || '').slice(0, 2200);
    const prior = [...jobs.values()].find(j => j.type === 'publish' && j.intentId === b.intentId);
    if (prior) return send(res, 200, prior);
    if (campaign.mode === 'demo')
      return send(res, 200, {
        status: 'completed',
        result: { simulated: true, message: 'Publicación simulada. No se envió nada a Instagram.', format: b.format }
      });
    requirePaidEnabled();
    const connection = await checkInstagram();
    if (!connection.valid) throw new P.ProviderError(connection.message, 409);
    // Instagram image containers require JPEG. The client rasterizes source WebP/PNG
    // into an explicit 4:5 or 9:16 JPEG before the publication confirmation is sent.
    if (!asVideo) {
      for (const a of selected) {
        const prepared = (b.preparedImages || []).find(p => p.assetId === a.id);
        if (!prepared || !/^[-\w]+\.jpg$/.test(prepared.file))
          throw new P.ProviderError('Falta preparar una imagen JPEG para Instagram.', 400);
        await P.fileData(prepared.file, mediaDir);
        a.file = prepared.file;
      }
    }
    let video;
    if (asVideo) {
      video = getJob(b.videoId);
      if (video.type !== 'video' || video.status !== 'completed' || !video.result?.file)
        throw new P.ProviderError('Primero termina un video real.', 409);
    }
    if (!env.IG_ACCESS_TOKEN || !env.IG_USER_ID) throw new P.ProviderError('Falta conectar Instagram en .env.', 409);
    selected.forEach(a => publicURL(a.file));
    if (asVideo) await assertPublicMedia(video.result.file, 'video');
    else await assertPublicMedia(selected[0].file, 'image');
    const j = await job('publish', async j => {
      j.mode = 'live';
      j.intentId = b.intentId;
      j.campaignId = campaign.id;
      j.caption = caption.slice(0, 300);
      j.media = { kind: asVideo ? 'video' : 'image', file: asVideo ? video.result.file : selected[0].file, thumb: selected[0].file, count: b.format === 'carousel' ? selected.length : 1 };
      await step(j, 'Preparando contenedor en Instagram', 15);
      let container;
      if (b.format === 'carousel' && selected.length > 1) {
        const children = [];
        for (const a of selected) {
          const child = await P.instagram(env, `${env.IG_USER_ID}/media`, { image_url: publicURL(a.file), is_carousel_item: 'true' });
          if (!child.id) throw new P.ProviderError('Instagram no devolvió ID de imagen.');
          await P.waitInstagram(env, child.id);
          children.push(child.id);
        }
        container = await P.instagram(env, `${env.IG_USER_ID}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption });
      } else {
        container = await P.instagram(
          env,
          `${env.IG_USER_ID}/media`,
          b.format === 'reel'
            ? { media_type: 'REELS', video_url: publicURL(video.result.file), caption }
            : b.format === 'story'
              ? asVideo
                ? { media_type: 'STORIES', video_url: publicURL(video.result.file) }
                : { media_type: 'STORIES', image_url: publicURL(selected[0].file) }
              : { image_url: publicURL(selected[0].file), caption }
        );
      }
      if (!container.id) throw new P.ProviderError('Instagram no devolvió ID de contenedor.');
      j.containerId = container.id;
      await persist(j);
      await P.waitInstagram(env, container.id);
      await step(j, 'Publicando en Instagram', 85);
      j.publicationAttempted = true;
      await persist(j);
      const pub = await P.instagram(env, `${env.IG_USER_ID}/media_publish`, { creation_id: container.id });
      if (!pub.id) throw new P.ProviderError('Respuesta ambigua al publicar. Revisa Instagram antes de repetir.');
      j.result = {
        id: pub.id,
        simulated: false,
        format: b.format,
        verified: false,
        message: 'Instagram aceptó la publicación; verificando enlace…'
      };
      await persist(j);
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const media = await P.instagram(env, `${pub.id}?fields=id,permalink,media_type,timestamp`);
          if (media.id === pub.id && /^https:\/\//.test(media.permalink || '')) {
            j.result = { ...j.result, verified: true, permalink: media.permalink, message: 'Publicado y verificado en Instagram' };
            break;
          }
        } catch {}
        if (attempt < 2) await new Promise(r => setTimeout(r, 1200));
      }
      if (!j.result.verified)
        j.result.message = 'Instagram devolvió ID de publicación. Revisa el perfil: no se pudo verificar el enlace todavía.';
    });
    j.intentId = b.intentId;
    await persist(j);
    return send(res, 202, j);
  }
  if (url.pathname.startsWith('/api/')) throw new P.ProviderError('Endpoint no encontrado.', 404);
  if (req.method !== 'GET') throw new P.ProviderError('Método no permitido.', 405);
  let file;
  if (url.pathname.startsWith('/media/')) {
    const name = basename(url.pathname);
    if (!/^[\w-]+\.(png|jpg|webp|mp4|webm)$/.test(name)) throw new P.ProviderError('Archivo inválido.', 400);
    file = resolve(mediaDir, name);
  } else {
    const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
    file = resolve(root, 'public', relative);
    if (!file.startsWith(resolve(root, 'public') + '/')) throw new P.ProviderError('Ruta inválida.', 403);
  }
  try {
    const bytes = await readFile(file);
    if (/\/(xr|app|lab\/office3d|lab\/lab)\.js$|\/index\.html$|\/lab\.html$|\/$/.test(url.pathname))
      appendFile(resolve(dataDir, 'access.log'), `${new Date().toISOString()} ${url.pathname} ${(req.headers['user-agent'] || '').slice(0, 90)}\n`).catch(() => {});
    const range = req.headers.range;
    if (range && /\.(mp4|webm)$/.test(file)) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      if (match) {
        const start = Number(match[1]),
          end = match[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
        if (start > end || start >= bytes.length) {
          res.writeHead(416, { 'Content-Range': `bytes */${bytes.length}` });
          res.end();
          return;
        }
        res.writeHead(206, {
          'Content-Type': mime[extname(file)],
          'Content-Range': `bytes ${start}-${end}/${bytes.length}`,
          'Content-Length': end - start + 1,
          'Accept-Ranges': 'bytes'
        });
        res.end(bytes.subarray(start, end + 1));
        return;
      }
    }
    res.writeHead(200, {
      'Content-Type': mime[extname(file)] || 'application/octet-stream',
      'Cache-Control': url.pathname.startsWith('/vendor/') ? 'public,max-age=604800' : 'no-cache',
      'Accept-Ranges': 'bytes'
    });
    res.end(bytes);
  } catch {
    throw new P.ProviderError('Archivo no encontrado.', 404);
  }
}
const BUILD_LABEL = 'v3-oficina-xr4';
const BUILD_FILES = ['xr.js', 'app.js', 'index.html', 'lab/office3d.js', 'lab/lab.js', 'lab/pixelpeople.js', 'lab/brain.js', 'lab/assets/oficina_bake.glb', 'lab/assets/dia.jpg'];
async function buildInfo() {
  const parts = [];
  for (const f of BUILD_FILES) {
    try {
      const st = await stat(resolve(root, 'public', f));
      parts.push(f + ':' + st.size);
    } catch {
      parts.push(f + ':missing');
    }
  }
  const { createHash } = await import('node:crypto');
  return { label: BUILD_LABEL, hash: createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 7), files: parts.length, startedAt: new Date(startedAtMs).toISOString() };
}
const startedAtMs = Date.now();
const server = http.createServer((req, res) =>
  P.langStore.run({ lang: req.headers['x-lang'] === 'en' ? 'en' : 'es' }, () => route(req, res)).catch(e => {
    if (!res.headersSent) send(res, e.status || 500, { error: e.message });
    else res.end();
  })
);
server.requestTimeout = 300000;
server.listen(port, env.HOST || '0.0.0.0', () => {
  console.log(`Aumentados XR: http://localhost:${port}/?access=${access}`);
  console.log(`Quest por USB: adb reverse tcp:${port} tcp:${port} → http://localhost:${port}/?access=${access}`);
  for (const list of Object.values(networkInterfaces()))
    for (const a of list || [])
      if (a.family === 'IPv4' && !a.internal) console.log(`LAN (HTTP sin WebXR): http://${a.address}:${port}/?access=${access}`);
  console.log('Modo demo por defecto. Credenciales solo en .env.');
});

// Agente de eficiencia (solo lectura, $0): cada 5 min guarda el pulso de Instagram para ver la evolución;
// una vez al día guarda el análisis de qué formato rinde mejor (carrusel, foto, reel, historia).
async function analystTick() {
  try {
    const d = await I.insights(env);
    if (d.mode !== 'live') return;
    await appendFile(resolve(dataDir, 'insights-history.jsonl'), JSON.stringify({ t: Date.now(), ...d.summary, best: d.analysis?.best }) + '\n');
    const f = resolve(dataDir, 'analyst-daily.json');
    const last = await stat(f).then(x => x.mtimeMs, () => 0);
    if (Date.now() - last > 864e5) await writeFile(f, JSON.stringify({ at: new Date().toISOString(), analysis: d.analysis }, null, 2), { mode: 0o600 });
  } catch {}
}
setInterval(analystTick, 300000).unref();
setTimeout(analystTick, 15000).unref();
