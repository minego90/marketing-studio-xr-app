// Guía paso a paso: una instrucción por pantalla y un solo botón grande («Siguiente»).
// Por debajo usa las mismas acciones del modo avanzado; aquí solo se simplifica el recorrido.
import { button, hit, tile, picture, ui } from '../ui.js';
import { kit3d, k3on, T, txt, wrapText, glass, chip, icon, glowIcon, ring, progressBar, rr } from '../ui-kit.js';
import { state, photoSlots, selectedAssets } from '../store.js';
import { ideaOptions } from './wizard.js';
import { drawFoxPhotographer2D } from '../lab/pixelpeople.js';

const X = 40,
  W = 1320;

// Orden del recorrido. Cada id es un paso; las fases agrupan los pasos para el indicador de arriba.
export const GUIDE_STEPS = ['start', 'place', 'shot0', 'shot1', 'shot2', 'shot3', 'what', 'idea', 'make', 'pick', 'final'];
export const GUIDE_PHASES = [
  ['Fotos', ['start', 'place', 'shot0', 'shot1', 'shot2', 'shot3']],
  ['Idea', ['what', 'idea']],
  ['Crear', ['make', 'pick']],
  ['Publicar', ['final']]
];
export const KINDS = [
  ['carousel', 'Imágenes · carrusel', 'Varias imágenes en una sola publicación', 'image'],
  ['story', 'Historia con imagen', 'Una imagen vertical que dura 24 horas', 'compass'],
  ['reel', 'Reel con video', 'Video corto con música y sonido', 'film'],
  ['storyvideo', 'Historia con video', 'Video vertical que dura 24 horas', 'send']
];
export const kindLabel = k => KINDS.find(x => x[0] === k)?.[1] || 'Publicación';
export const isVideoKind = k => k === 'reel' || k === 'storyvideo';
export const singleKind = k => k !== 'carousel';

const SHOT_TEXT = {
  front: ['Muestra el frente', 'Pon el producto de frente, mirando a la cámara, y toca «Tomar foto».'],
  right: ['Gíralo a la derecha', 'Gira el objeto para que se vea su lado derecho. Luego toca «Tomar foto».'],
  left: ['Ahora a la izquierda', 'Gíralo hacia el otro lado para mostrar su lado izquierdo.'],
  back: ['Muestra la parte de atrás', 'Dale la vuelta completa: la cámara debe ver la parte trasera.']
};

export const stepId = () => GUIDE_STEPS[Math.max(0, Math.min(GUIDE_STEPS.length - 1, state.gStep || 0))];
const photosDone = () => photoSlots.filter(([s]) => state.photos[s]).length;

function phases(g) {
  const cur = stepId();
  const w = 316;
  GUIDE_PHASES.forEach(([label, ids], i) => {
    const x = X + i * (w + 18),
      active = ids.includes(cur),
      done = GUIDE_STEPS.indexOf(ids[ids.length - 1]) < GUIDE_STEPS.indexOf(cur);
    rr(g, x, 112, w, 8, 4);
    g.fillStyle = done ? T.mint : active ? T.amber : 'rgba(255,255,255,0.12)';
    g.fill();
    txt(g, `${i + 1} · ${label}`, x, 148, { size: 18, weight: 700, color: active ? T.amber : done ? T.mint : T.faint, spacing: 0.6 });
  });
}
function heading(g, t, sub) {
  txt(g, t, X, 250, { size: 52, weight: 750, family: 'display', spacing: -1.4, maxWidth: W });
  if (sub) wrapText(g, sub, X, 296, 1180, { size: 27, color: T.muted, line: 36, maxLines: 2 });
}
function thumbs(g, x, y, activeSlot) {
  photoSlots.forEach(([s, label], i) => {
    const yy = y + i * 118;
    const p = state.photos[s],
      cur = s === activeSlot;
    glass(g, x, yy, 300, 104, 22, { strong: cur, tint: cur ? 'rgba(241,220,174,0.10)' : null });
    picture(p?.url, x + 10, yy + 10, 84, 84, { fit: 'cover', r: 14 });
    txt(g, label, x + 112, yy + 48, { size: 23, weight: 650, color: p || cur ? T.text : T.faint });
    txt(g, p ? 'Lista' : cur ? 'Ahora' : 'Pendiente', x + 112, yy + 78, { size: 17, weight: 700, color: p ? T.mint : cur ? T.amber : T.faint });
    if (p) icon(g, 'check', x + 268, yy + 52, 28, T.mint, 3);
  });
}
function bigIcon(g, name, cx, cy, color = T.amber) {
  glass(g, cx - 130, cy - 130, 260, 260, 76, { strong: true, tint: 'rgba(241,220,174,0.07)' });
  glowIcon(g, name, cx, cy, 120, color, 2);
}

export function drawGuide(g) {
  const id = stepId();
  phases(g);
  if (kit3d.enabled) button('guide:glass', state.glass3d === false ? 'Vista 3D' : 'Vista 2D', 1180, 190, 180, 52, { small: true, ghost: true });
  const back = () => button('guide:back', 'Atrás', X, 866, 300, 84, { disabled: !!state.busy || !!state.captureBusy });
  const next = (label, o = {}) => button('guide:next', label, 360, 866, 1000, 84, { primary: true, trailing: o.noArrow ? null : 'arrow-right', ...o });
  const small = (bid, label, x, y, w) => button(bid, label, x, y, w, 60, { small: true, ghost: true });

  if (id === 'start') {
    heading(g, 'Vamos a crear tu publicación', 'Yo te voy diciendo qué hacer. Tú solo tocas «Siguiente».');
    glass(g, X, 330, W, 390, 34, { strong: true });
    // el zorro fotógrafo de la oficina: en el visor es un modelo 3D (glass3d.js); en pantalla normal, un sprite animado
    if (k3on(g)) kit3d.fox = { x: 215, y: 525 };
    else drawFoxPhotographer2D(g, 112, 420, 9, ui.now);
    [
      ['1', 'Tomas 4 fotos de tu producto', 'camera'],
      ['2', 'Eliges qué quieres publicar', 'compass'],
      ['3', 'La IA crea las imágenes o el video', 'wand'],
      ['4', 'Revisas y publicas', 'send']
    ].forEach(([n, t, ic], i) => {
      const y = 362 + i * 84;
      icon(g, ic, 480, y + 30, 40, T.violet, 2);
      txt(g, t, 540, y + 40, { size: 30, weight: 600, maxWidth: 780 });
    });
    next('Empezar');
    small('nav:feed', 'Mis publicaciones', 700, 750, 320);
    small('guide:advanced', 'Modo avanzado', 1040, 750, 320);
    return;
  }
  if (id === 'place') {
    const have = photosDone();
    if (have > 0) {
      heading(g, have === 4 ? 'Ya tienes las 4 fotos' : `Ya tienes ${have} ${have === 1 ? 'foto' : 'fotos'}`, '¿Quieres usarlas o empezar de cero?');
      glass(g, X, 340, W, 330, 34, { strong: true });
      photoSlots.forEach(([s], i) => picture(state.photos[s]?.url, X + 30 + i * 316, 360, 292, 290, { fit: 'contain', r: 22 }));
      back();
      button('guide:keep', have === 4 ? 'Usar las que ya tengo' : 'Seguir con las que tengo', 360, 700, 1000, 100, { primary: true, trailing: 'arrow-right' });
      button('guide:wipe', 'Borrar todo y tomar de nuevo', 360, 826, 1000, 84, {});
      return;
    }
    heading(g, 'Pon tu producto frente a ti', 'Sostenlo con la mano a la altura del pecho, con buena luz y sin nada detrás que distraiga.');
    glass(g, X, 360, W, 430, 34, { strong: true });
    bigIcon(g, 'cube', 360, 575);
    wrapText(g, 'Cuando lo tengas listo, toca «Siguiente»: se abrirá la cámara y te voy guiando foto por foto.', 600, 520, 700, { size: 30, color: T.text, line: 42, maxLines: 4 });
    back();
    next('Siguiente · abrir cámara');
    small('guide:example', 'Usar fotos de ejemplo', 1040, 790, 320);
    return;
  }
  if (id.startsWith('shot')) {
    const i = +id.slice(4),
      [slot, label] = photoSlots[i],
      p = state.photos[slot],
      [t, d] = SHOT_TEXT[slot];
    heading(g, `Foto ${i + 1} de 4 · ${label}`, d);
    glass(g, X, 340, 940, 490, 34, { strong: true });
    if (p) {
      picture(p.url, X + 20, 360, 900, 450, { fit: 'contain', r: 24 });
      chip(g, X + 40, 380, '✓ Foto guardada', { color: T.mint, h: 40, size: 18 });
    } else {
      bigIcon(g, i === 0 ? 'camera' : 'refresh', 510, 560);
      txt(g, t, 510, 735, { size: 34, weight: 700, align: 'center', maxWidth: 880 });
      if (state.captureCountdown) txt(g, String(state.captureCountdown), 510, 590, { size: 150, weight: 800, family: 'display', color: T.amber, align: 'center' });
    }
    thumbs(g, 1000, 340, slot);
    if (state.captureBusy && !state.pendingCapture) txt(g, 'Mantén el producto quieto…', X, 850, { size: 22, color: T.amber, weight: 650 });
    back();
    if (p) {
      next(i === 3 ? 'Listo · siguiente' : 'Siguiente');
      small('guide:shoot', 'Repetir esta foto', 1000, 790, 360);
    } else next(state.captureBusy ? 'Tomando…' : 'Toca para tomar la foto', { noArrow: true, disabled: !!state.captureBusy || !!state.busy });
    return;
  }
  if (id === 'what') {
    heading(g, '¿Qué quieres publicar?', 'Elige una opción y toca «Siguiente».');
    KINDS.forEach(([k, h, sub, ic], i) => {
      const x = X + (i % 2) * 668,
        y = 340 + Math.floor(i / 2) * 250,
        on = state.gKind === k;
      tile('guide:kind:' + k, h, x, y, 652, 232, { active: on, r: 30 });
      glass(g, x + 38, y + 68, 100, 100, 28, { strong: true, tint: on ? 'rgba(241,220,174,0.14)' : null });
      glowIcon(g, ic, x + 88, y + 118, 52, on ? T.amber : T.violet, 2);
      txt(g, h, x + 170, y + 104, { size: 32, weight: 700, maxWidth: 460 });
      wrapText(g, sub, x + 170, y + 148, 440, { size: 22, color: T.muted, line: 30, maxLines: 2 });
      if (on) icon(g, 'check', x + 604, y + 46, 34, T.amber, 3);
    });
    back();
    next('Siguiente', { disabled: !state.gKind });
    return;
  }
  if (id === 'idea') {
    if (!state.strategyPlan) {
      heading(g, 'Estoy mirando tus fotos', 'En unos segundos te propongo de qué hacer la publicación.');
      photoSlots.forEach(([s], i) => picture(state.photos[s]?.url, X + i * 336, 340, 312, 312, { fit: 'contain', r: 24 }));
      if (state.busy) progressBar(g, X, 700, W, 8, Math.max(0.06, (state.job?.progress || 10) / 100));
      txt(g, state.busy ? state.job?.stage || 'Analizando…' : 'No pude analizar las fotos. Toca «Reintentar».', X, 760, { size: 24, color: T.muted });
      back();
      next(state.busy ? 'Analizando…' : 'Reintentar', { disabled: !!state.busy, noArrow: true });
      return;
    }
    heading(g, '¿De qué quieres la publicación?', 'Elige una idea. Si ninguna te convence, escribe la tuya.');
    const opts = ideaOptions(),
      pick = state.ideaPick || opts[0]?.id;
    opts.slice(0, 5).forEach((o, i) => {
      const y = 340 + i * 98,
        on = pick === o.id;
      tile(o.id === 'own' ? 'idea:own' : 'idea:pick:' + o.id, o.head, X, y, W, 88, { active: on, r: 26 });
      txt(g, o.head, X + 40, y + 36, { size: 24, weight: 700, maxWidth: 1200, color: T.text });
      txt(g, (o.sub || '').slice(0, 110), X + 40, y + 68, { size: 18, color: T.muted, maxWidth: 1200 });
      if (on) icon(g, 'check', X + 1270, y + 44, 30, T.amber, 3);
    });
    back();
    next('Siguiente · crear', { disabled: !!state.busy });
    return;
  }
  if (id === 'make') {
    const assets = state.campaign?.result?.assets || [];
    if (state.imgChoice) {
      heading(g, '¿Cómo creamos las imágenes?', 'Con IA usa créditos de tu cuenta. La opción local es gratis.');
      button('guide:ai', 'Con IA · usa créditos', X, 360, W, 110, { primary: true });
      button('guide:local', 'Gratis · composición con tus fotos', X, 500, W, 100, {});
      back();
      return;
    }
    if (!state.busy && !assets.length) {
      heading(g, 'No se pudieron crear las imágenes', state.notice || 'Intenta de nuevo.');
      back();
      next('Reintentar', { noArrow: true });
      return;
    }
    heading(g, 'Creando tus imágenes', 'Esto toma un momento. No cierres esta pantalla.');
    ring(g, 700, 540, 96, Math.max(0.05, (state.job?.progress || 8) / 100), { label: Math.round(state.job?.progress || 8) + '%', width: 15, size: 38, color: T.amber });
    txt(g, state.job?.stage || 'Preparando…', 700, 710, { size: 24, color: T.muted, align: 'center' });
    return;
  }
  if (id === 'pick') {
    const assets = state.campaign?.result?.assets || [];
    const one = singleKind(state.gKind);
    heading(g, one ? 'Elige la imagen principal' : 'Elige las imágenes', one ? 'Toca la que más te guste.' : 'Toca para quitar o poner. Se publican las marcadas.');
    assets.slice(0, 4).forEach((a, i) => {
      const x = X + i * 336,
        on = state.selected.includes(a.id);
      tile('guide:pick:' + a.id, a.title || 'Imagen ' + (i + 1), x, 340, 312, 440, { active: on, r: 26 });
      picture(a.url, x + 10, 350, 292, 380, { fit: 'cover', r: 18 });
      txt(g, on ? '✓ Elegida' : 'Tocar para elegir', x + 156, 764, { size: 20, weight: 700, color: on ? T.amber : T.faint, align: 'center' });
    });
    back();
    next('Siguiente', { disabled: !state.selected.length });
    return;
  }
  if (id === 'final') {
    const assets = selectedAssets();
    const vid = isVideoKind(state.gKind);
    heading(g, vid ? 'Ahora creamos tu video' : 'Todo listo para publicar', vid ? `Con tu imagen creamos un ${state.gKind === 'reel' ? 'Reel' : 'video para Historia'} con música y sonido.` : `${kindLabel(state.gKind)} · ${assets.length} imagen(es). Revisa y confirma.`);
    assets.slice(0, 4).forEach((a, i) => picture(a.url, X + i * 336, 340, 312, 400, { fit: 'cover', r: 24 }));
    if (!vid) wrapText(g, state.caption || '', X, 770, W, { size: 20, color: T.muted, line: 28, maxLines: 2 });
    back();
    next(vid ? 'Siguiente · crear video' : 'Siguiente · revisar y publicar');
    return;
  }
}
