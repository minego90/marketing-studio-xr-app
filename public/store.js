// Estado compartido de la aplicación y utilidades puras de acceso (sin dibujo ni red).
import { STRATEGY_DEFAULTS, PHOTO_SLOTS } from './studio-domain.js';
import { orchestra } from './orchestra.js';
// Mensaje de un personaje, solo por una acción real; el orquestador los muestra de a uno.
export const say = (who, text, opts) => orchestra.say(who, text, opts);
export const $ = s => document.querySelector(s);
export const photoSlots = PHOTO_SLOTS;
export const state = {
  page: 'guide',
  gStep: 0,
  gKind: null,
  feed: [],
  feedOpen: null,
  feedPage: 0,
  mode: 'demo',
  photo: null,
  photos: { front: null, right: null, left: null, back: null },
  captureSlot: 'front',
  videoSheet: null,
  videoSheetKey: '',
  videoSheetLayout: 0,
  videoPromptView: false,
  videoWatch: false,
  recOrient: 'horizontal', // formato del video grabado: 'vertical' (9:16, historias/reels) u 'horizontal'
  brief:
    'Crea una campaña de Halloween para este producto. Una dirección creativa premium, cinematográfica y original. Sin precios ni descuentos.',
  caption: '',
  campaign: null,
  selected: [],
  headlines: {},
  index: 0,
  format: 'carousel',
  orientation: 'vertical',
  duration: 5,
  style: 'halloween',
  videoPrompt: 'Revela el producto con iluminación ámbar, niebla suave y un movimiento de cámara cinematográfico.',
  video: null,
  videoJob: null,
  job: null,
  busy: false,
  notice: 'Tu estudio está listo. Inicia la cámara o prueba con el producto de ejemplo.',
  confirm: false,
  keyboard: null,
  recording: false,
  config: {},
  connections: null,
  publishReceipt: null,
  adsStage: 'setup',
  adsCountry: 'CO',
  adsCity: 'Bogotá',
  adsRadius: 25,
  adsGoal: 'profile',
  adsReviewTab: 'idea',
  adsBudget: '',
  adsCurrency: 'COP',
  adsDays: '3',
  adsCta: 'LEARN_MORE',
  adsAudience: '',
  adsTheme: 'Halloween',
  adsPlan: null,
  adsPush: null
};
Object.assign(state, {
  page: 'guide',
  strategyStage: 'brief',
  strategyReviewTab: 'idea',
  strategyPlan: null,
  pendingCapture: null,
  captureCountdown: 0,
  captureBusy: false,
  captureTimer: 3,
  videoSelected: [],
  videoPlan: null,
  ideaPick: null,
  ideaOwn: '',
  imageSource: 'local',
  imgChoice: false,
  adsWiz: 0,
  adsBudgetN: 20000,
  adsDone: null,
  data: null,
  dataError: '',
  rec: {},
  videoHookIndex: 0,
  hudVisible: false,
  hudPinned: false,
  hudReviewSlot: null,
  hudReplaceSlot: null,
  assistantVisible: true,
  reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false,
  pageEntered: performance.now()
});
Object.assign(state, {
  // Flujo Express: los agentes de Luma trabajan en cadena y cada paso informa su estado.
  agents: { running: false, steps: [], startedAt: 0, finishedAt: 0 },
  confirmAutopilot: false,
  review: null,
  photoQA: {},
  xr: { title: '', cta: 'Visitar perfil', autoRotate: true, exported: null, checks: null },
  guard: null,
  askAnswer: null,
  lastActionAt: 0
});
for (const [k, v] of Object.entries(STRATEGY_DEFAULTS)) state['strategy' + k[0].toUpperCase() + k.slice(1)] = v;
export const imageCache = new Map();
export function getImage(url) {
  if (!url) return null;
  if (!imageCache.has(url)) {
    const im = new Image();
    im.onload = () => {};
    im.onerror = () => {
      im.failed = true;
    };
    im.src = url;
    imageCache.set(url, im);
  }
  return imageCache.get(url);
}
export function xrlog(ev, msg = '') {
  // Registro hacia el servidor (data/xr-perf.log) para ver qué pasa de verdad dentro del visor.
  try {
    fetch('/api/xr-stats' + location.search, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: new Date().toISOString(), ev, msg: String(msg).slice(0, 150), page: state.page }), keepalive: true }).catch(() => {});
  } catch {}
}
export function notice(t) {
  state.uiTouch = performance.now();
  if (/^⚠|^No se pudo|^Cámara pendiente|^La cámara/.test(String(t))) xrlog('notice', t);
  if (/^⚠/.test(String(t))) say('luma', String(t).replace(/^⚠\s*/, '').slice(0, 90), { priority: true });
  state.notice = t;
  $('#notice').textContent = t;
}
export function selectedAssets() {
  const assets = state.campaign?.result?.assets || [];
  return state.selected.map(id => assets.find(a => a.id === id)).filter(Boolean);
}
export function videoAssets() {
  return state.videoSelected.map(id => state.campaign?.result?.assets.find(a => a.id === id)).filter(Boolean);
}
export function currentAsset() {
  const a = state.campaign?.result?.assets || [];
  return a[state.index % Math.max(1, a.length)];
}
export function headlineFor(a) {
  return (state.headlines[a.id] ?? a.headline ?? state.campaign?.result?.title ?? 'Una noche fuera de lo común').trim().slice(0, 72);
}
export function campaignImage(g, im, headline, x, y, w, h) {
  const s = Math.min(w / im.width, h / im.height),
    iw = im.width * s,
    ih = im.height * s,
    ix = x + (w - iw) / 2,
    iy = y + (h - ih) / 2;
  g.drawImage(im, ix, iy, iw, ih);
  // El texto de la publicación YA viene integrado en la imagen (lo crea la IA de imagen): no se superpone ninguna tipografía.
  return;
  // eslint-disable-next-line no-unreachable
  if (!headline) return;
  g.save();
  g.beginPath();
  g.rect(ix, iy, iw, ih);
  g.clip();
  const shade = g.createLinearGradient(0, iy, 0, iy + ih * 0.46);
  shade.addColorStop(0, '#100b1acc');
  shade.addColorStop(1, '#100b1a00');
  g.fillStyle = shade;
  g.fillRect(ix, iy, iw, ih * 0.46);
  const pad = iw * 0.065,
    max = iw - 2 * pad;
  let size = Math.min(58, Math.max(17, iw * 0.09));
  g.font = `800 ${size}px "Inter Display","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
  const words = headline.toLocaleUpperCase('es').split(/\s+/);
  let lines = [],
    line = '';
  for (const word of words) {
    const candidate = line ? line + ' ' + word : word;
    if (g.measureText(candidate).width > max && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  while ((lines.length > 3 || lines.some(l => g.measureText(l).width > max)) && size > 15) {
    size -= 2;
    g.font = `800 ${size}px "Inter Display","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
    lines = [];
    line = '';
    for (const word of words) {
      const candidate = line ? line + ' ' + word : word;
      if (g.measureText(candidate).width > max && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    if (line) lines.push(line);
  }
  g.fillStyle = '#fff8ef';
  g.shadowColor = '#100b1a';
  g.shadowBlur = size * 0.18;
  g.textBaseline = 'top';
  lines.slice(0, 3).forEach((l, i) => g.fillText(l, ix + pad, iy + ih * 0.065 + i * size * 1.1, max));
  g.restore();
}