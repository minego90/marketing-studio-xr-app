// Idioma de la interfaz (ES / EN). Todo el texto del estudio está escrito en español; en modo inglés se traduce
// al dibujarlo (diccionario exacto → plantillas con {} → prefijos → frases separadas). Lo que no se reconoce queda
// en español y se anota en globalThis.__i18nMissing para ampliar el diccionario.
import { EN } from './i18n-en.js';

let lang = 'es';
try {
  const q = new URLSearchParams(location.search).get('lang');
  lang = q === 'en' || q === 'es' ? q : localStorage.getItem('lang') === 'en' ? 'en' : 'es';
  if (q === 'en' || q === 'es') localStorage.setItem('lang', q);
} catch {}

const cache = new Map();
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const entries = Object.entries(EN);
const patterns = entries
  .filter(([k]) => k.includes('{}'))
  .map(([k, v]) => [new RegExp('^' + k.split('{}').map(esc).join('(.*?)') + '$', 's'), v, k])
  .sort((a, b) => b[2].length - a[2].length);
const frags = entries
  .filter(([k]) => !k.includes('{}') && /(\s|·|:)$/.test(k) && k.trim().length >= 3)
  .sort((a, b) => b[0].length - a[0].length);
const tails = entries.filter(([k]) => !k.includes('{}') && /^\s/.test(k) && k.trim().length >= 3).sort((a, b) => b[0].length - a[0].length);
const lowerMap = new Map(entries.filter(([k]) => !k.includes('{}')).map(([k, v]) => [k.toLowerCase(), v]));
const MON = { ene: 'Jan', feb: 'Feb', mar: 'Mar', abr: 'Apr', may: 'May', jun: 'Jun', jul: 'Jul', ago: 'Aug', sep: 'Sep', oct: 'Oct', nov: 'Nov', dic: 'Dec' };
const SPANISH = /[áéíóúñ¿¡]|\b(el|la|los|las|de|del|para|con|sin|una|que|tu|tus|por|al|se|es|en|no|si|y)\b/i;

export const getLang = () => lang;
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'es';
  cache.clear();
  try {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
  } catch {}
}
export const toggleLang = () => setLang(lang === 'en' ? 'es' : 'en');

function t1(s, depth = 0) {
  if (!s) return s;
  if (Object.prototype.hasOwnProperty.call(EN, s)) return EN[s];
  const lead = /^\s*/.exec(s)[0],
    trail = /\s*$/.exec(s)[0],
    core = s.trim();
  if (core !== s && core) return lead + t1(core, depth) + trail;
  if (depth > 4) return s;
  for (const [re, v] of patterns) {
    const m = re.exec(s);
    if (m) {
      let i = 0;
      return v.replace(/\{\}/g, () => t1(m[++i] ?? '', depth + 1));
    }
  }
  // fechas y plazos: «27 nov · en 24días» → «Nov 27 · in 24 days»
  if (/\d/.test(s)) {
    const r = s
      .replace(/\b(\d{1,2}) (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\b/g, (_, d, m) => MON[m] + ' ' + d)
      .replace(/\ben (\d+) ?días\b/g, 'in $1 days')
      .replace(/\b(\d+) ?días\b/g, '$1 days')
      .replace(/\b1 days\b/g, '1 day');
    if (r !== s) return t1(r, depth + 1);
  }
  for (const [k, v] of frags) if (s.startsWith(k) && s.length > k.length) return v + t1(s.slice(k.length), depth + 1);
  for (const [k, v] of tails) if (s.endsWith(k) && s.length > k.length) return t1(s.slice(0, -k.length), depth + 1) + v;
  // mayúsculas / minúsculas distintas a la clave original
  const low = lowerMap.get(s.toLowerCase());
  if (low !== undefined) return s === s.toUpperCase() && s !== s.toLowerCase() ? low.toUpperCase() : low;
  // símbolos iniciales (○ ● ✓ ▶ …)
  const sym = /^([^A-Za-zÁÉÍÓÚÑáéíóúñ0-9¿¡]+)(.+)$/s.exec(s);
  if (sym && sym[2].trim().length > 2) {
    const r = t1(sym[2], depth + 1);
    if (r !== sym[2]) return sym[1] + r;
  }
  for (const sep of [' · ', '. ', ' — ', ': ', '? ', '! ']) {
    if (s.includes(sep)) {
      const parts = s.split(sep);
      const out = parts.map(p => t1(p, depth + 1));
      if (out.some((p, i) => p !== parts[i])) return out.join(sep);
    }
  }
  return s;
}

export function tr(s) {
  if (lang !== 'en' || typeof s !== 'string' || s.length < 2) return s;
  let r = cache.get(s);
  if (r === undefined) {
    r = t1(s);
    if (cache.size > 4000) cache.clear();
    cache.set(s, r);
    if (r === s && SPANISH.test(s) && /[A-Za-záéíóúñ]{3}/.test(s)) {
      const m = (globalThis.__i18nMissing ||= new Set());
      if (m.size < 600) m.add(s);
    }
  }
  return r;
}

// Red de seguridad: todo texto dibujado directamente en cualquier lienzo (oficina 3D, muñeca, etc.).
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.__i18n) {
  const P = CanvasRenderingContext2D.prototype;
  const ft = P.fillText,
    st = P.strokeText,
    mt = P.measureText;
  P.fillText = function (t, ...a) {
    return ft.call(this, typeof t === 'string' ? tr(t) : t, ...a);
  };
  P.strokeText = function (t, ...a) {
    return st.call(this, typeof t === 'string' ? tr(t) : t, ...a);
  };
  P.measureText = function (t) {
    return mt.call(this, typeof t === 'string' ? tr(t) : t);
  };
  P.__i18n = true;
}

// ───────── Traducción del DOM (menú lateral, avisos, lista de accesibilidad…) ─────────
const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
const origText = new WeakMap(),
  shownText = new WeakMap();
function doText(n) {
  const cur = n.nodeValue;
  if (shownText.get(n) !== cur) origText.set(n, cur); // el programa escribió un texto nuevo
  const o = origText.get(n) ?? cur;
  const v = lang === 'en' ? tr(o) : o;
  if (v !== cur) n.nodeValue = v;
  shownText.set(n, v);
}
function doAttrs(el) {
  for (const a of ATTRS) {
    if (!el.hasAttribute?.(a)) continue;
    const k = 'i18n' + a.replace('-', '');
    const cur = el.getAttribute(a);
    if (el.dataset[k + 'Shown'] !== cur) el.dataset[k] = cur;
    const o = el.dataset[k] ?? cur;
    const v = lang === 'en' ? tr(o) : o;
    if (v !== cur) el.setAttribute(a, v);
    el.dataset[k + 'Shown'] = v;
  }
}
export function translateDom(root = document.body) {
  if (!root) return;
  if (root.nodeType === 3) return doText(root);
  if (root.nodeType !== 1 || /^(SCRIPT|STYLE|CANVAS)$/.test(root.tagName)) return;
  doAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = w.nextNode())) {
    if (n.nodeType === 3) {
      if (n.parentNode && !/^(SCRIPT|STYLE)$/.test(n.parentNode.tagName) && n.nodeValue.trim()) doText(n);
    } else doAttrs(n);
  }
}
if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined' && typeof NodeFilter !== 'undefined') {
  let queued = false;
  const pending = new Set();
  const flush = () => {
    queued = false;
    for (const n of pending) if (n.isConnected !== false) translateDom(n);
    pending.clear();
  };
  const start = () => {
    translateDom(document.body);
    new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'characterData') pending.add(m.target);
        else if (m.type === 'attributes') pending.add(m.target);
        else m.addedNodes.forEach(n => pending.add(n));
      }
      if (!queued) {
        queued = true;
        requestAnimationFrame(flush);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}
const _set = setLang;
export function setLangAndDom(l) {
  _set(l);
  translateDom(document.body);
  try {
    document.title = lang === 'en' ? 'Aumentados · Marketing Studio XR' : document.title;
  } catch {}
}
