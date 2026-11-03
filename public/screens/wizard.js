// Flujo lineal minimalista: Fotos → Idea → Imágenes → Publicar → Pauta → Datos (+ Grabar).
// Cada pantalla tiene UN botón principal abajo que siempre avanza al siguiente paso.
import { button, hit, tile, field, picture, ui } from '../ui.js';
import { T, txt, wrapText, glass, inset, chip, icon, ring, progressBar, luma, rr } from '../ui-kit.js';
import { state, photoSlots, selectedAssets, headlineFor, campaignImage, getImage } from '../store.js';
import { CAPTURE_TIPS } from '../studio-domain.js';
import { upcoming, shortDate } from '../calendar.js';

const X = 40,
  W = 1320;
const title = (g, t, sub) => {
  txt(g, t, X, 250, { size: 42, weight: 700, family: 'display', spacing: -1 });
  if (sub) txt(g, sub, X, 288, { size: 21, color: T.muted, maxWidth: W });
};
const primary = (id, label, o = {}) => button(id, label, X, 866, W, 84, { primary: true, trailing: o.noArrow ? null : 'arrow-right', ...o });
const radio = (g, cx, cy, on) => {
  g.beginPath();
  g.arc(cx, cy, 15, 0, Math.PI * 2);
  g.strokeStyle = on ? T.amber : T.faint;
  g.lineWidth = 3;
  g.stroke();
  if (on) {
    g.beginPath();
    g.arc(cx, cy, 8, 0, Math.PI * 2);
    g.fillStyle = T.amber;
    g.fill();
  }
};
function row(g, id, x, y, w, h, head, sub, on, o = {}) {
  tile(id, head, x, y, w, h, { active: on, r: 24, disabled: o.disabled });
  radio(g, x + 40, y + h / 2, on);
  txt(g, head, x + 76, y + h / 2 - (sub ? 8 : -2), { size: 23, weight: 650, maxWidth: w - 110, color: o.disabled ? T.faint : T.text });
  if (sub) txt(g, sub, x + 76, y + h / 2 + 22, { size: 17, color: T.muted, maxWidth: w - 110 });
}
const money = (n, cur) => (cur === 'USD' ? 'US$ ' + n : '$ ' + Math.round(n).toLocaleString('es-CO'));

// ───────────────────────── 1 · Fotos ─────────────────────────
export function drawFotos(g) {
  const saved = photoSlots.filter(([s]) => state.photos[s]).length;
  title(g, saved === 4 ? '¡Listo! Tienes las 4 fotos.' : 'Toma 4 fotos de tu producto', 'Frente, derecha, izquierda y atrás. Después la IA las analiza.');
  photoSlots.forEach(([slot, label], i) => {
    const x = X + i * 336,
      y = 322,
      p = state.photos[slot],
      cur = state.captureSlot === slot;
    tile('slot:' + slot, label, x, y, 312, 388, { active: cur && !p, r: 28, disabled: !!state.captureBusy });
    picture(p?.url, x + 12, y + 12, 288, 296, { fit: 'contain', r: 20 });
    if (p && !state.captureBusy && !state.pendingCapture) button('photo:del:' + slot, '✕', x + 246, y + 20, 54, 54, { small: true, aria: 'Quitar foto ' + label.toLowerCase() });
    if (!p) txt(g, String(i + 1), x + 156, y + 176, { size: 96, weight: 800, color: 'rgba(255,255,255,0.10)', align: 'center', family: 'display' });
    txt(g, label, x + 20, y + 346, { size: 25, weight: 700 });
    txt(g, p ? 'Lista' : cur ? 'Toca «Tomar foto»' : 'Pendiente', x + 292, y + 346, { size: 18, weight: 700, color: p ? T.mint : cur ? T.amber : T.faint, align: 'right' });
  });
  if (state.pendingCapture) {
    txt(g, 'Revisa la toma: ¿la guardamos?', X, 760, { size: 24, weight: 650, color: T.amber });
    button('capture-retake', 'Repetir', X, 866, 400, 84, { disabled: state.busy });
    button('capture-save', state.busy ? 'Guardando…' : 'Guardar esta toma', 460, 866, 900, 84, { primary: true, disabled: state.busy });
    return;
  }
  const cur = photoSlots.find(([s]) => s === state.captureSlot) || photoSlots[0];
  if (saved < 4) wrapText(g, 'Consejo · ' + CAPTURE_TIPS[cur[0]], X, 756, 1000, { size: 21, color: T.muted, line: 30, maxLines: 2 });
  else txt(g, 'Toca una foto para repetirla, o la ✕ para quitarla.', X, 756, { size: 21, color: T.muted });
  if (saved < 4) {
    button('example:all', 'Usar fotos de ejemplo', 1040, 770, 320, 60, { small: true, ghost: true });
    if (saved > 0) button('photos:done', `Continuar con ${saved}`, 700, 770, 320, 60, { small: true, ghost: true });
  } else {
    button('photos:clear', 'Empezar de nuevo', 1040, 770, 320, 60, { small: true, disabled: !!state.captureBusy });
    button('camera-hud', state.hudVisible ? 'Cerrar cámara' : 'Repetir una foto', 700, 770, 320, 60, { small: true, disabled: !!state.captureBusy });
  }
  if (saved === 4 && !state.hudVisible) primary('photos:done', 'Analizar mis fotos con IA');
  else primary('camera-hud', state.hudVisible ? 'Cerrar cámara' : `Tomar foto · ${cur[1]}`, { noArrow: true, disabled: !!state.captureBusy });
}

// ───────────────────────── 2 · Idea ─────────────────────────
export function ideaOptions() {
  const plan = state.strategyPlan,
    out = [];
  (plan?.concepts || []).slice(0, 2).forEach((c, i) => out.push({ id: 'luma:' + i, head: 'Idea de Luma', sub: c, theme: c.slice(0, 120) }));
  upcoming(new Date(), 3).forEach((d, i) =>
    out.push({ id: 'date:' + i, head: `${d.label} · ${shortDate(d.date)}${d.days === 0 ? ' · hoy' : d.days === 1 ? ' · mañana' : ' · en ' + d.days + ' días'}`, sub: d.idea, theme: d.label, extra: d.idea })
  );
  out.push({ id: 'own', head: 'Escribir mi propia idea', sub: state.ideaOwn || 'Toca para escribirla', theme: state.ideaOwn || '' });
  return out;
}
export function drawIdea(g) {
  const plan = state.strategyPlan;
  if (!plan) {
    title(g, 'Luma analiza tus fotos', 'Entiende qué es el producto y propone de qué hacer la publicación.');
    photoSlots.forEach(([s], i) => picture(state.photos[s]?.url, X + i * 336, 330, 312, 312, { fit: 'contain', r: 24 }));
    wrapText(g, state.busy ? 'Mirando tus fotos…' : 'Solo toma unos segundos. Después eliges de qué quieres la publicación.', X, 700, 1100, { size: 26, color: T.text, line: 36, maxLines: 2 });
    if (state.busy) progressBar(g, X, 760, W, 8, Math.max(0.06, (state.job?.progress || 10) / 100));
    primary('idea:analyze', state.busy ? 'Analizando…' : 'Analizar mis fotos con IA', { disabled: state.busy || !photoSlots.some(([s]) => state.photos[s]) });
    return;
  }
  if (state.imgChoice) {
    title(g, '¿Cómo creamos tus imágenes?', 'Esto se decide antes de crear. Nada se gasta hasta que elijas «con IA».');
    photoSlots.forEach(([s], i) => picture(state.photos[s]?.url, X + i * 120, 322, 108, 108, { fit: 'contain', r: 14 }));
    txt(g, 'IDEA ELEGIDA', X + 520, 340, { size: 15, weight: 800, color: T.amber, spacing: 1.6 });
    wrapText(g, state.strategyTheme || '', X + 520, 372, 580, { size: 26, weight: 650, color: T.text, line: 34, maxLines: 3 });
    txt(g, 'La IA recibe tus 4 fotos y esta idea. Usa créditos de tu cuenta; las imágenes quedan guardadas para elegirlas.', X, 480, { size: 20, color: T.muted, maxWidth: 1100 });
    button('img:go:ai', 'Crear con IA · usa créditos', X, 540, 1100, 96, { primary: true });
    button('img:go:local', 'Crear local · gratis (composición con tus fotos)', X, 656, 1100, 84);
    button('img:go:cancel', '← Volver a elegir la idea', X, 760, 520, 64, { small: true, ghost: true });
    return;
  }
  title(g, '¿De qué quieres la publicación?', 'Elige una idea. Si ninguna te convence, escribe la tuya.');
  glass(g, X, 322, 420, 520, 30);
  txt(g, 'LUMA VE EN TUS FOTOS', X + 28, 366, { size: 15, weight: 800, color: T.amber, spacing: 1.6 });
  wrapText(g, plan.seen || plan.summary, X + 28, 410, 364, { size: 21, color: T.text, line: 30, maxLines: 9 });
  photoSlots.forEach(([s], i) => picture(state.photos[s]?.url, X + 28 + (i % 2) * 190, 640 + Math.floor(i / 2) * 100, 174, 90, { fit: 'cover', r: 16 }));
  const opts = ideaOptions(),
    pick = state.ideaPick || opts[0]?.id;
  opts.forEach((o, i) => {
    const y = 322 + i * 86;
    row(g, o.id === 'own' ? 'idea:own' : 'idea:pick:' + o.id, 490, y, 870, 78, o.head, o.sub, pick === o.id);
  });
}

// ───────────────────────── 3 · Imágenes ─────────────────────────
export function drawImagenes(g) {
  const assets = state.campaign?.result?.assets || [];
  const ai = state.mode === 'live' && state.imageSource === 'ai';
  if (!assets.length || state.busy) {
    title(g, 'Creando tus imágenes', ai ? 'La IA está componiendo cada pieza a partir de tus fotos.' : 'Componiendo las piezas con tus fotos (sin gasto de créditos).');
    ring(g, 700, 520, 86, Math.max(0.05, (state.job?.progress || 8) / 100), { label: Math.round(state.job?.progress || 8) + '%', width: 14, size: 34, color: T.amber });
    txt(g, state.job?.stage || 'Preparando…', 700, 680, { size: 24, color: T.muted, align: 'center' });
    if (!state.busy && !assets.length) primary('nav:strategy', 'Volver a elegir la idea');
    return;
  }
  title(g, 'Elige las imágenes para publicar', `${state.selected.length} de ${assets.length} seleccionadas · toca una para quitarla o ponerla`);
  assets.slice(0, 4).forEach((a, i) => {
    const x = X + i * 336,
      y = 322,
      on = state.selected.includes(a.id);
    tile('select:' + a.id, a.title || 'Imagen ' + (i + 1), x, y, 312, 420, { active: on, r: 26 });
    const im = getImage(a.url);
    if (im?.complete && im.naturalWidth) campaignImage(g, im, headlineFor(a), x + 10, y + 10, 292, 365);
    else picture(a.url, x + 10, y + 10, 292, 365, { r: 18 });
    txt(g, a.title?.slice(0, 22) || 'Propuesta ' + (i + 1), x + 20, y + 402, { size: 20, weight: 650 });
    g.beginPath();
    g.arc(x + 276, y + 44, 20, 0, Math.PI * 2);
    g.fillStyle = on ? T.amber : 'rgba(0,0,0,0.55)';
    g.fill();
    g.strokeStyle = on ? T.amber : 'rgba(255,255,255,0.5)';
    g.lineWidth = 2;
    g.stroke();
    if (on) icon(g, 'check', x + 276, y + 44, 26, T.ink, 3);
  });
  chip(g, X, 772, ai ? 'Imágenes con IA · usa créditos' : state.mode === 'demo' ? 'Modo demo · imágenes locales · $0' : 'Imágenes locales de prueba · $0', { color: ai ? T.amber : T.mint, h: 40, size: 17 });
  if (state.mode === 'live') button('img:source', ai ? 'Cambiar a imágenes locales ($0)' : 'Cambiar a imágenes con IA (gasta)', 800, 764, 560, 56, { small: true, ghost: true });
  button('nav:strategy', 'Cambiar idea', X, 866, 300, 84, {});
  button('nav:publish', 'Siguiente · publicar', 360, 866, 1000, 84, { primary: true, trailing: 'arrow-right', disabled: !state.selected.length });
}

// ───────────────────────── 4 · Publicar ─────────────────────────
export function drawPublicar(g) {
  const username = state.connections?.instagram?.username || 'danielmurcia.ia',
    assets = selectedAssets(),
    blocked = state.mode === 'live' && !state.connections?.instagram?.valid,
    r = state.publishReceipt;
  if (r) {
    title(g, r.simulated ? 'Publicación simulada' : r.verified ? '¡Publicado en Instagram!' : 'Instagram recibió tu publicación', r.simulated ? 'Modo demo: no se envió nada a Instagram.' : '@' + username);
    glass(g, X, 322, W, 300, 30, { strong: true });
    icon(g, r.verified || r.simulated ? 'check' : 'clock', X + 80, 410, 64, r.verified ? T.mint : T.amber, 4);
    wrapText(g, r.message || '', X + 160, 396, 1100, { size: 26, color: T.text, line: 36, maxLines: 3 });
    if (r.id) txt(g, 'ID ' + r.id, X + 160, 520, { size: 18, color: T.faint });
    if (r.permalink) button('open-publication', 'Ver la publicación real', X + 160, 548, 480, 56, { small: true });
    button('new-publication', 'Publicar otra vez', 680, 548, 380, 56, { small: true, ghost: true });
    primary('nav:ads', 'Siguiente · crear la pauta');
    return;
  }
  if (!assets.length) {
    title(g, 'Primero elige imágenes', '');
    primary('nav:gallery', 'Elegir imágenes');
    return;
  }
  if (state.confirm) {
    title(g, state.mode === 'demo' ? 'Confirma la simulación' : 'Confirma: se publicará de verdad', `@${username} · ${state.format === 'story' ? 'Historia · imagen' : state.format === 'storyvideo' ? 'Historia · video con sonido' : state.format === 'reel' ? 'Reel' : 'Post / carrusel'} · ${state.format === 'story' ? '1 imagen' : state.format === 'storyvideo' || state.format === 'reel' ? 'tu video' : assets.length + ' imagen(es)'}`);
    glass(g, X, 322, W, 400, 30, { strong: true });
    assets.slice(0, state.format === 'story' || state.format === 'storyvideo' ? 1 : 4).forEach((a, i) => picture(a.url, X + 24 + i * 150, 346, 136, 170, { fit: 'cover', r: 16 }));
    wrapText(g, state.caption || 'Sin texto.', X + 24, 570, 1270, { size: 24, color: T.text, line: 34, maxLines: 4 });
    if (blocked) txt(g, state.connections?.instagram?.message || '', X, 760, { size: 19, color: T.amber, maxWidth: W });
    button('cancel-publish', 'Volver', X, 866, 300, 84, {});
    button('publish', state.busy ? 'Publicando…' : state.mode === 'demo' ? 'Confirmar simulación' : 'Sí, publicar ahora', 360, 866, 1000, 84, { primary: true, disabled: state.busy || blocked });
    return;
  }
  title(g, 'Revisa y publica', `Cuenta @${username} · elige el formato y confirma el texto.`);
  const vf = state.format === 'reel' || state.format === 'storyvideo';
  button('tab:images', '🖼 Imágenes · carrusel', 800, 200, 270, 52, { small: true, active: !vf });
  button('tab:video', state.video ? '🎬 Video ●' : '🎬 Video', 1085, 200, 270, 52, { small: true, active: vf });
  (vf ? [['storyvideo', 'Historia · video'], ['reel', 'Reel']] : [['carousel', 'Post / carrusel'], ['story', 'Historia · imagen']]).forEach(([f, label], i) =>
    button('format:' + f, label, X + i * 670, 316, 650, 62, { active: state.format === f, small: true })
  );
  assets.slice(0, 4).forEach((a, i) => {
    const used = (state.format !== 'story' && state.format !== 'storyvideo') || i === 0;
    picture(a.url, X + i * 156, 402, 142, 178, { fit: 'cover', r: 16 });
    if (!used) {
      rr(g, X + i * 156, 402, 142, 178, 16);
      g.fillStyle = 'rgba(8,7,14,0.6)';
      g.fill();
    }
  });
  glass(g, 690, 402, 670, 178, 26);
  const vfNow = state.format === 'reel' || state.format === 'storyvideo';
  txt(g, vfNow ? (state.video ? 'Video listo' : 'Aún no hay video') : '¿Quieres publicar un video?', 718, 446, { size: 24, weight: 700, color: vfNow && state.video ? T.mint : T.text });
  txt(g, vfNow ? (state.video ? 'Se publicará tu video con su sonido.' : 'Créalo en la pestaña Video.') : 'Se crea en la pestaña «Video» (arriba a la derecha).', 718, 480, { size: 17, color: T.muted, maxWidth: 620 });
  button('tab:video', state.video ? '▶ Ver mi video' : 'Ir a Video', 718, 502, 280, 56, { small: true });
  field('caption', 'TEXTO DE LA PUBLICACIÓN', state.caption, X, 646, W, 150);
  txt(g, state.caption.length + ' / 2200', 1360, 826, { size: 16, color: T.faint, align: 'right' });
  if (blocked) txt(g, state.connections.instagram.message.slice(0, 100), X, 826, { size: 18, color: T.amber });
  primary('confirm-publish', 'Revisar y publicar', { disabled: state.busy || blocked });
}

// ───────────────────────── 5 · Pauta ─────────────────────────
export const adsUseVideo = () => !!state.video && !!state.videoJob && state.adsPiece === 'video';
export const ADS_STEPS = ['Objetivo', 'Público', 'Presupuesto', 'Revisar'];
export const budgetStep = cur => (cur === 'USD' ? 1 : 5000);
export function drawPauta(g) {
  const assets = selectedAssets();
  const wiz = state.adsWiz || 0;
  if (!assets.length) {
    title(g, 'Primero crea y publica tu contenido', '');
    primary('nav:gallery', 'Elegir imágenes');
    return;
  }
  const done = state.adsDone;
  if (done) {
    title(g, done.remote ? 'Borrador creado en Meta' : 'Borrador de pauta guardado', done.remote ? 'Está en PAUSA: no gasta nada hasta que tú lo actives.' : done.video ? 'CSV descargado: impórtalo en Ads Manager y sube tu video. No se activó nada.' : 'Modo demo: guardado solo en este servidor.');
    glass(g, X, 322, W, 400, 30, { strong: true });
    icon(g, 'check', X + 80, 410, 64, T.mint, 4);
    txt(g, done.remote ? 'Estado en Meta: ' + (done.remote.status || 'PAUSED') + ' · verificado' : 'Sin conexión con Meta Ads', X + 160, 410, { size: 28, weight: 700, color: T.mint });
    const L = [`Objetivo: ${state.adsGoal === 'awareness' ? 'Dar a conocer' : state.adsGoal === 'profile' ? 'Visitar tu perfil' : 'Elegido por Luma'}`, `Público: ${state.adsCity} · radio ${state.adsRadius} km`, `Presupuesto: ${money(state.adsBudgetN, state.adsCurrency)} por día · ${state.adsDays} días`];
    if (done.remote?.campaign) L.push('Campaña ' + done.remote.campaign + ' · ' + (done.remote.ads?.length || 0) + ' anuncio(s)');
    L.forEach((t, i) => txt(g, t, X + 160, 470 + i * 40, { size: 21, color: T.text, maxWidth: 1100 }));
    if (done.remote) button('ads:open', 'Abrir Ads Manager y revisar el borrador', X + 160, 640, 640, 60, { small: true });
    button('ads:again', 'Hacer otra pauta', 830, 640, 300, 60, { small: true, ghost: true });
    primary('nav:data', 'Siguiente · ver resultados');
    return;
  }
  title(g, ['¿Qué quieres que hagan las personas?', '¿Quién quieres que vea tu anuncio?', '¿Cuánto y por cuántos días?', 'Revisa y crea el borrador'][wiz], 'Paso ' + (wiz + 1) + ' de 4 · como en Instagram. Nada se activa desde aquí.');
  ADS_STEPS.forEach((s, i) => {
    const w = 316,
      x = X + i * (w + 18);
    rr(g, x, 306, w, 8, 4);
    g.fillStyle = i < wiz ? T.mint : i === wiz ? T.amber : 'rgba(255,255,255,0.12)';
    g.fill();
  });
  if (wiz === 0) {
    [['profile', 'Visitar tu perfil', 'Ideal para aumentar el reconocimiento de marca y los seguidores.'], ['awareness', 'Dar a conocer tu marca', 'Llega a más personas que aún no te conocen.'], ['auto', 'Que Luma elija', 'La IA decide según tu publicación y tus imágenes.']].forEach(([id, h, s], i) =>
      row(g, 'ads-goal:' + id, X, 340 + i * 112, W, 98, h, s, state.adsGoal === id)
    );
    if (state.video && state.videoJob) {
      txt(g, 'PIEZA DE LA PAUTA', X, 706, { size: 17, weight: 650, color: T.muted, spacing: 1.2 });
      button('ads-piece:video', '🎬 Mi video', X, 722, 650, 70, { small: true, active: adsUseVideo() });
      button('ads-piece:images', '🖼 Mis imágenes', X + 670, 722, 650, 70, { small: true, active: !adsUseVideo() });
    }
  } else if (wiz === 1) {
    field('adsCity', 'CIUDAD', state.adsCity, X, 372, 640, 84);
    txt(g, 'RADIO ALREDEDOR', 720, 358, { size: 17, weight: 650, color: T.muted, spacing: 1.2 });
    [17, 25, 40, 80].forEach((km, i) => button('ads-radius:' + km, km + ' km', 720 + i * 162, 372, 150, 84, { active: state.adsRadius === km, small: true }));
    field('adsAudience', 'PÚBLICO (LUMA LO SUGIERE · PUEDES EDITARLO)', state.adsAudience || state.strategyAudience, X, 524, W, 170);
    txt(g, (adsUseVideo() ? 'Edad 18–65 · Reels y Stories · Meta optimiza dentro de este público.' : 'Edad 18–65 · solo Instagram Feed · Meta optimiza dentro de este público.'), X, 740, { size: 20, color: T.muted });
  } else if (wiz === 2) {
    const cur = state.adsCurrency;
    txt(g, 'PRESUPUESTO DIARIO', X, 350, { size: 17, weight: 650, color: T.muted, spacing: 1.2 });
    button('ads:budget:-', '−', X, 372, 120, 96, { small: true });
    inset(g, 180, 372, 520, 96, 24, {});
    txt(g, money(state.adsBudgetN, cur), 440, 436, { size: 40, weight: 700, align: 'center', family: 'display' });
    button('ads:budget:+', '+', 720, 372, 120, 96, { small: true });
    ['COP', 'USD'].filter(c => !state.adsAccountCurrency || c === state.adsAccountCurrency).forEach((c, i) => button('ads-currency:' + c, c, 880 + i * 245, 372, 230, 96, { active: cur === c, small: true }));
    txt(g, 'DURACIÓN', X, 530, { size: 17, weight: 650, color: T.muted, spacing: 1.2 });
    button('ads:days:-', '−', X, 552, 120, 96, { small: true });
    inset(g, 180, 552, 520, 96, 24, {});
    txt(g, state.adsDays + (Number(state.adsDays) === 1 ? ' día' : ' días'), 440, 616, { size: 40, weight: 700, align: 'center', family: 'display' });
    button('ads:days:+', '+', 720, 552, 120, 96, { small: true });
    txt(g, 'Total estimado: ' + money(state.adsBudgetN * Number(state.adsDays), cur), X, 720, { size: 28, weight: 650, color: T.amber });
    txt(g, 'Meta cobra solo si tú activas el anuncio. Aquí queda en pausa.', X, 760, { size: 19, color: T.muted });
  } else {
    glass(g, X, 322, W, 400, 30);
    (adsUseVideo() ? assets.slice(0, 1) : assets.slice(0, 4)).forEach((a, i) => picture(a.url, X + 24 + i * 120, 346, 108, 136, { fit: 'cover', r: 14 }));
    if (!adsUseVideo()) txt(g, '🖼 ' + assets.length + (assets.length === 1 ? ' IMAGEN' : ' IMÁGENES') + ' · Feed y Stories', X + 24, 508, { size: 17, weight: 700, color: T.amber });
    if (adsUseVideo()) txt(g, '🎬 VIDEO · ' + (state.video?.duration || state.duration || 5) + ' s · 9:16 · Reels y Stories', X + 24, 508, { size: 17, weight: 700, color: T.amber });
    const goal = state.adsGoal === 'awareness' ? 'Dar a conocer' : state.adsGoal === 'profile' ? 'Visitar tu perfil' : 'Que Luma elija';
    [['Objetivo', goal], ['Público', `${state.adsCity} · ${state.adsRadius} km`], ['Presupuesto', `${money(state.adsBudgetN, state.adsCurrency)} / día × ${state.adsDays} días`], ['Estado final', 'PAUSA · tú lo activas en Ads Manager']].forEach(([k, v], i) => {
      txt(g, k.toUpperCase(), 560, 372 + i * 52, { size: 15, weight: 800, color: T.faint, spacing: 1.4 });
      txt(g, v, 760, 372 + i * 52, { size: 22, weight: 600, maxWidth: 560 });
    });
    const q = state.adsPlan?.result?.recommendation;
    if (q) wrapText(g, 'Luma: ' + (q.reasoning || ''), X + 24, 640, 1270, { size: 19, color: T.muted, line: 27, maxLines: 4 });
    else wrapText(g, (adsUseVideo() ? 'Luma revisará la idea de tu video y el texto antes de crear el borrador.' : 'Luma revisará tus imágenes y el texto antes de crear el borrador.'), X + 24, 640, 1270, { size: 19, color: T.muted, line: 27, maxLines: 2 });
  }
  if (wiz === 3 && state.adsPlan?.result) button('ads:csv', 'Descargar CSV para Ads Manager', X + 800, 780, 520, 60, { small: true, ghost: true });
  if (wiz > 0) button('ads:prev', 'Atrás', X, 866, 300, 84, { disabled: state.busy });
  const bx = wiz > 0 ? 360 : X,
    bw = wiz > 0 ? 1000 : W;
  if (wiz < 3) button('ads:next', 'Siguiente', bx, 866, bw, 84, { primary: true, trailing: 'arrow-right' });
  else if (!state.adsPlan?.result) button('ads:plan2', state.busy ? 'Luma está preparando…' : 'Preparar propuesta con Luma', bx, 866, bw, 84, { primary: true, disabled: state.busy });
  else button('ads:send', state.busy ? 'Creando en Meta…' : state.mode === 'demo' ? 'Guardar borrador (demo)' : 'Crear borrador en Meta · queda en PAUSA', bx, 866, bw, 84, { primary: true, disabled: state.busy });
}

// ───────────────────────── 6 · Datos ─────────────────────────
const ago = t => {
  if (!t) return '';
  const m = Math.round((Date.now() - new Date(t)) / 60000);
  return m < 1 ? 'hace un momento' : m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`;
};
const fmt = n => (n == null ? '—' : Number(n).toLocaleString('es-CO'));
export function drawDatos(g) {
  const d = state.data?.insights,
    ads = state.data?.ads;
  title(g, 'Cómo le va a tu contenido', d ? (d.mode === 'live' ? 'Datos reales de Instagram · se actualizan solos cada pocos minutos' : 'Datos de ejemplo: conecta Instagram para ver los reales') : 'Cargando datos…');
  if (!d) {
    txt(g, state.dataError || 'Un momento…', X, 400, { size: 24, color: T.muted });
    button('data:refresh', 'Reintentar', X, 866, 400, 84, {});
    return;
  }
  const S = d.summary,
    tiles = [['Alcance', S.reach], ['Vistas', S.views], ['Me gusta', S.likes], ['Comentarios', S.comments], ['Guardados', S.saves], ['Compartidos', S.shares]];
  tiles.forEach(([k, v], i) => {
    const x = X + i * 222;
    glass(g, x, 316, 208, 108, 24);
    txt(g, fmt(v), x + 104, 372, { size: 36, weight: 750, align: 'center', family: 'display' });
    txt(g, k.toUpperCase(), x + 104, 404, { size: 13, weight: 800, color: T.faint, align: 'center', spacing: 1.4 });
  });
  // Formatos
  glass(g, X, 440, 640, 330, 28);
  txt(g, '¿QUÉ FORMATO FUNCIONA MEJOR?', X + 26, 480, { size: 15, weight: 800, color: T.amber, spacing: 1.6 });
  const rows = d.analysis?.rows || [],
    max = Math.max(1, ...rows.map(r => r.rate || 0));
  rows.slice(0, 4).forEach((r, i) => {
    const y = 504 + i * 52;
    txt(g, r.label, X + 26, y + 26, { size: 20, weight: 650 });
    progressBar(g, X + 150, y + 14, 330, 12, (r.rate || 0) / max, { color: i === 0 ? T.mint : T.violet });
    txt(g, r.rate == null ? 's/d' : r.rate + '', X + 500, y + 26, { size: 20, weight: 700, color: i === 0 ? T.mint : T.text });
    txt(g, r.posts + ' pub.', X + 612, y + 26, { size: 15, color: T.faint, align: 'right' });
  });
  wrapText(g, d.analysis?.note || '', X + 26, 722, 590, { size: 16, color: T.muted, line: 22, maxLines: 2 });
  // Publicaciones
  glass(g, 700, 440, 660, 330, 28);
  txt(g, 'ÚLTIMAS PUBLICACIONES', 726, 480, { size: 15, weight: 800, color: T.amber, spacing: 1.6 });
  (d.media || []).slice(0, 5).forEach((m, i) => {
    const y = 500 + i * 52;
    chip(g, 726, y + 6, { reel: 'Reel', carousel: 'Carrusel', photo: 'Foto', story: 'Historia' }[m.kind] || 'Foto', { color: T.violet, h: 30, size: 14 });
    txt(g, (m.caption || '').slice(0, 26) || '(sin texto)', 846, y + 26, { size: 18, maxWidth: 250 });
    txt(g, `♥ ${fmt(m.like_count)}  💬 ${fmt(m.comments_count)}  👁 ${fmt(m.views ?? m.reach)}`, 1340, y + 26, { size: 16, color: T.muted, align: 'right' });
  });
  // Pauta
  glass(g, X, 786, W, 64, 22);
  const c = ads?.campaigns?.[0];
  txt(g, 'PAUTA', X + 26, 825, { size: 15, weight: 800, color: T.amber, spacing: 1.6 });
  if (!c) txt(g, 'Aún no hay pautas creadas desde el estudio.', X + 120, 825, { size: 19, color: T.muted });
  else if (c.error) txt(g, 'No se pudo leer: ' + c.error, X + 120, 825, { size: 17, color: T.warn, maxWidth: 1150 });
  else txt(g, `${c.status === 'PAUSED' ? 'En pausa' : c.status} · impresiones ${fmt(c.impressions)} · alcance ${fmt(c.reach)} · clics ${fmt(c.clicks)} · gasto ${c.spend}`, X + 120, 825, { size: 19, maxWidth: 1180 });
  txt(g, 'Actualizado ' + ago(d.updatedAt || state.data.at), 1360, 273, { size: 16, color: T.faint, align: 'right' });
  button('data:refresh', 'Actualizar ahora', X, 866, 420, 84, { disabled: state.busy });
  button('nav:capture', 'Nueva campaña', 480, 866, 880, 84, { primary: true, trailing: 'arrow-right' });
}

// ───────────────────────── Grabar ─────────────────────────
export function drawGrabar(g, camera, streamOn) {
  const R = state.rec || {};
  title(g, R.url ? 'Revisa tu video' : 'Graba un video', R.url ? 'Si te gusta, publícalo como historia o reel.' : 'Usa la cámara del casco, como en las gafas Ray-Ban de Meta.');
  glass(g, X, 316, 640, 500, 28);
  if (R.url && R.el && R.el.readyState >= 2) {
    const v = R.el,
      s = Math.min(616 / v.videoWidth, 476 / v.videoHeight);
    g.save();
    rr(g, X + 12, 328, 616, 476, 20);
    g.clip();
    g.drawImage(v, X + 12 + (616 - v.videoWidth * s) / 2, 328 + (476 - v.videoHeight * s) / 2, v.videoWidth * s, v.videoHeight * s);
    g.restore();
  } else if (R.on) {
    // Durante la grabación NO se dibuja el video en el panel (compite con el codificador y deja el video entrecortado).
    const sec = Math.floor((Date.now() - R.t0) / 1000);
    g.save();
    rr(g, X + 12, 328, 616, 476, 20);
    g.fillStyle = '#120d1c';
    g.fill();
    g.restore();
    g.strokeStyle = T.danger;
    g.lineWidth = 5;
    [[X + 40, 356, 1, 1], [X + 600, 356, -1, 1], [X + 40, 776, 1, -1], [X + 600, 776, -1, -1]].forEach(([x, y, dx, dy]) => {
      g.beginPath();
      g.moveTo(x, y + 60 * dy);
      g.lineTo(x, y);
      g.lineTo(x + 60 * dx, y);
      g.stroke();
    });
    g.beginPath();
    g.arc(X + 320, 520, sec % 2 ? 22 : 18, 0, 7);
    g.fillStyle = T.danger;
    g.fill();
    txt(g, 'GRABANDO ' + sec + ' s', X + 320, 600, { size: 34, weight: 800, color: T.danger, align: 'center' });
    txt(g, 'Lo que ves en el marco rojo es lo que se graba', X + 320, 650, { size: 20, color: T.muted, align: 'center' });
  } else if (streamOn && camera.readyState >= 2) {
    const s = Math.min(616 / camera.videoWidth, 476 / camera.videoHeight);
    g.save();
    rr(g, X + 12, 328, 616, 476, 20);
    g.clip();
    g.drawImage(camera, X + 12 + (616 - camera.videoWidth * s) / 2, 328 + (476 - camera.videoHeight * s) / 2, camera.videoWidth * s, camera.videoHeight * s);
    g.restore();
    if (R.on) {
      g.beginPath();
      g.arc(X + 50, 366, 10, 0, 7);
      g.fillStyle = T.danger;
      g.fill();
      txt(g, '● GRABANDO ' + Math.floor((Date.now() - R.t0) / 1000) + ' s', X + 70, 372, { size: 18, weight: 800, color: T.danger });
    }
  } else {
    luma(g, X + 320, 520, 60, { mood: 'idle', t: ui.now });
    txt(g, 'Enciende la cámara para empezar', X + 320, 650, { size: 24, color: T.muted, align: 'center' });
  }
  if (R.url) {
    txt(g, 'PUBLICAR COMO', 720, 350, { size: 15, weight: 800, color: T.amber, spacing: 1.6 });
    button('rec:story', state.busy ? 'Publicando…' : 'Historia', 720, 372, 640, 84, { primary: true, disabled: state.busy });
    button('rec:reel', 'Reel (con texto)', 720, 472, 640, 84, { disabled: state.busy });
    if (R.id) field('caption', 'TEXTO DEL REEL', state.caption, 720, 620, 640, 130);
    button('rec:retake', 'Grabar otra vez', 720, 770, 640, 60, { small: true, ghost: true });
    if (state.publishReceipt) txt(g, state.publishReceipt.message || '', 720, 580, { size: 18, color: T.mint, maxWidth: 640 });
  } else {
    wrapText(g, R.on ? 'Habla o muestra tu producto. Toca «Detener» al terminar (máximo 60 s).' : 'Toca «Grabar», muestra tu producto o habla a la cámara y detén cuando termines. Luego eliges historia o reel.', 720, 360, 640, { size: 24, color: T.text, line: 34, maxLines: 4 });
    if (R.err) txt(g, R.err, 720, 560, { size: 18, color: T.warn, maxWidth: 640 });
  }
  if (!R.url && !R.on) button('rec:orient', state.recOrient === 'vertical' ? 'Formato: Vertical 9:16 · cambiar' : 'Formato: Horizontal · cambiar', 720, 560, 640, 64, { small: true });
  if (!R.url) primary(R.on ? 'rec:stop' : 'rec:start', R.on ? 'Detener grabación' : streamOn ? 'Grabar' : 'Encender cámara y grabar', { noArrow: true });
}
