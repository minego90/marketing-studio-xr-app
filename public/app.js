import { VERSION } from './version.js';
import { renderCameraHud } from './camera-hud.js';
import {
  STRATEGY_DEFAULTS,
  OBJECTIVES,
  PHOTO_SLOTS,
  CAPTURE_TIPS,
  normalizeStrategy,
  campaignBrief,
  coachAdvice,
  AGENT_PIPELINE
} from './studio-domain.js';
import { state, photoSlots, imageCache, getImage, notice, say, xrlog, selectedAssets, videoAssets, currentAsset, headlineFor, campaignImage } from './store.js';
import { ui, begin, setUiHover, button as uiButton, hit as uiHit, field as uiField, picture, T, glass, inset, txt, wrapText, chip, chipWidth, rr, luma, progressBar, icon, background } from './ui.js';
import { kit3d } from './ui-kit.js';
import { setLangAndDom, getLang } from './i18n.js';
import { composeSheet, SHEET_LAYOUTS } from './sheet.js';
import { frameStart, frameEnd, drawHeader, drawStepper, drawLumaBar } from './screens/shell.js';
import { drawExpress } from './screens/express.js';
import { drawResults, drawXrPage, drawReviewPage } from './screens/results.js';
import { drawFeed, feedFilm } from './screens/feed.js';
import { drawGuide, stepId, GUIDE_STEPS, singleKind, isVideoKind } from './screens/guide.js';
import { drawFotos, drawIdea, drawImagenes, drawPublicar, drawPauta, drawDatos, drawGrabar, ideaOptions, budgetStep, adsUseVideo } from './screens/wizard.js';
export { state };
const $ = s => document.querySelector(s);
const board = $('#board'),
  preview = $('#preview'),
  ctx = board.getContext('2d'),
  pc = preview.getContext('2d');
const camera = $('#camera'),
  film = $('#film'),
  cameraHud = $('#cameraHud');
let hudHits = [];
// Alias de color: las páginas heredadas siguen usando C.* pero con la paleta Aurora.
const C = { bg: T.bg, card: T.raised, line: T.line, text: T.text, muted: T.muted, amber: T.amber, purple: T.violet, green: T.mint };
function strategyInput() {
  return normalizeStrategy(
    Object.fromEntries(Object.keys(STRATEGY_DEFAULTS).map(k => [k, state['strategy' + k[0].toUpperCase() + k.slice(1)]]))
  );
}
function applyStrategy(saved) {
  if (saved?.brief) for (const [k, v] of Object.entries(saved.brief)) state['strategy' + k[0].toUpperCase() + k.slice(1)] = v;
  if (saved?.plan) {
    state.strategyPlan = saved.plan;
    if (state.strategyPlan.shotList?.length === 3)
      state.strategyPlan.shotList = [
        state.strategyPlan.shotList[0],
        state.strategyPlan.shotList[1],
        CAPTURE_TIPS.left,
        state.strategyPlan.shotList[2]
      ];
    state.strategyStage = 'review';
  }
}
function navigateTo(page) {
  state.page = page;
  state.guided = page === 'guide';
  state.pageEntered = performance.now();
  state.confirm = false;
  state.keyboard = null;
  if (page === 'publish') state.index = 0;
}
let captureSequence = 0;
let lastHudShutterAt = -Infinity;
let stream = null,
  cameraRequest = null,
  previewHits = [],
  requestGeneration = 0,
  record = null,
  lastAction = 0,
  downloadURL = null;

function drawLuma(g, x, y, size = 22) {
  luma(g, x, y, size * 0.8, { mood: 'idle', t: performance.now() / 1000 });
}
function box(x, y, w, h, fill, r = 20, stroke) {
  if (h <= 8) {
    // pista / barra de progreso
    if (fill === C.purple) progressBar(ctx, x, y, w, h, w / 1348);
    else rr(ctx, x, y, w, h, h / 2), (ctx.fillStyle = 'rgba(255,255,255,0.08)'), ctx.fill();
    return;
  }
  const dark = ['#100f17', '#211d2b', '#17151fe0'].includes(fill);
  if (dark) {
    inset(ctx, x, y, w, h, r, { focus: stroke === C.purple || stroke === C.amber });
    return;
  }
  const hot = stroke === C.amber || stroke === C.purple || fill === '#493957';
  glass(ctx, x, y, w, h, Math.min(r + 6, 34), { strong: hot, tint: hot ? 'rgba(157,140,255,0.10)' : null });
  if (hot) {
    rr(ctx, x + 1, y + 1, w - 2, h - 2, Math.min(r + 6, 34));
    ctx.strokeStyle = stroke === C.amber ? 'rgba(241,220,174,0.85)' : 'rgba(169,199,255,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
function text(t, x, y, size = 24, color = C.text, weight = 500) {
  txt(ctx, t, x, y, { size, color, weight: weight >= 700 ? 700 : weight >= 600 ? 650 : weight, family: size >= 34 ? 'display' : 'body' });
}
function wrap(t, x, y, maxWidth, size = 24, color = C.muted, line = 34, maxLines = 5) {
  wrapText(ctx, t, x, y, maxWidth, { size, color, line, maxLines });
}
function image(url, x, y, w, h, fit = 'cover') {
  picture(url, x, y, w, h, { fit, r: 18 });
}
function button(id, label, x, y, w, h = 74, { active = false, primary = false, disabled = false, small = false, ic = null, ghost = false } = {}) {
  uiButton(id, label, x, y, w, h, { active, primary, disabled, small, ic, ghost });
}
function field(id, label, value, x, y, w, h = 95) {
  uiField(id, label, value, x, y, w, h);
}
function syncFields() {
  for (const key of Object.keys(STRATEGY_DEFAULTS)) {
    const id = 'strategy' + key[0].toUpperCase() + key.slice(1),
      el = $('#' + id);
    if (el && document.activeElement !== el) el.value = state[id];
  }
  for (const step of document.querySelectorAll('[data-step]')) step.classList.toggle('current', step.dataset.step === state.page);
  for (const key of ['brief', 'caption']) if (document.activeElement !== $('#' + key)) $('#' + key).value = state[key];
  $('#modeLabel').textContent = state.mode === 'demo' ? 'DEMO INTERACTIVO' : 'APIs REALES';
  $('#modeDescription').textContent =
    state.mode === 'demo'
      ? 'Composiciones locales sin IA. Publicar solo simula el envío.'
      : 'Las acciones de creación usan tus APIs configuradas. Publicación con confirmación.';
}

function badge(label, x, y, color = C.purple) {
  chip(ctx, x, y - 27, label, { color, h: 38, size: 17 });
}

export function draw() {
  kit3d.guide = state.page === 'guide' && state.glass3d !== false && !state.keyboard;
  begin(ctx);
  frameStart(ctx);
  drawHeader(ctx);
  if (state.page !== 'guide') drawStepper(ctx);
  ctx.save();
  if (!state.reducedMotion) ctx.globalAlpha = Math.min(1, 0.45 + (performance.now() - state.pageEntered) / 220);
  if (state.keyboard) drawKeyboard();
  else {
    switch (state.page) {
      case 'guide':
        drawGuide(ctx);
        break;
      case 'feed':
        drawFeed(ctx);
        break;
      case 'capture':
        drawFotos(ctx);
        break;
      case 'strategy':
        drawIdea(ctx);
        break;
      case 'brief':
      case 'gallery':
        drawImagenes(ctx);
        break;
      case 'publish':
        drawPublicar(ctx);
        break;
      case 'ads':
        drawPauta(ctx);
        break;
      case 'data':
        drawDatos(ctx);
        break;
      case 'rec':
        drawGrabar(ctx, camera, !!stream);
        break;
      case 'video':
        drawVideo();
        break;
      case 'settings':
        drawSettings();
        break;
    }
  }
  ctx.restore();
  if (state.page !== 'guide') drawLumaBar(ctx);
  frameEnd(ctx);
  drawPreview();
  if (state.hudVisible) hudHits = renderCameraHud(cameraHud, camera, state, getImage);
  else hudHits = [];
  $('#cameraHudBackdrop').hidden = !state.hudVisible;
  syncFields();
  syncAccessible();
}
function heading(title, sub) {
  text(title, 38, 235, 39, C.text, 650);
  text(sub, 38, 274, 22, C.muted);
}
function drawStrategy() {
  const nPhotos = photoSlots.filter(([k]) => state.photos[k]).length;
  heading('Ahora, la idea de campaña.', nPhotos ? `Luma ya vio tus ${nPhotos} foto(s): con ellas propone la campaña. Tú decides si te gusta.` : 'Primero toma las fotos del producto: así Luma sabe qué es y propone mejor.');
  if (!nPhotos && state.strategyStage === 'brief') button('nav:capture', '← Primero toma las fotos del producto', 40, 295, 700, 48, { small: true, primary: true });
  if (state.strategyStage === 'brief') {
    field('strategyProduct', '¿QUÉ PRODUCTO O NEGOCIO VAMOS A MOSTRAR?', state.strategyProduct, 40, 348, 1315, 84);
    field('strategyTheme', 'TEMÁTICA O MOMENTO DE LA CAMPAÑA', state.strategyTheme, 40, 481, 1315, 78);
    field('strategyAudience', '¿A QUIÉN QUIERES LLEGAR?', state.strategyAudience, 40, 610, 1315, 106);
    text('EL RESULTADO QUE BUSCAS', 45, 759, 20, C.amber, 700);
    Object.entries(OBJECTIVES).forEach(([id, label], i) =>
      button('strategy-goal:' + id, label, 40 + i * 443, 779, 425, 62, { active: state.strategyObjective === id, small: true })
    );
    button('strategy:data', 'Siguiente · datos y enfoque →', 635, 870, 720, 75, { primary: true });
  } else if (state.strategyStage === 'data') {
    field('strategyPositioning', '¿QUÉ DIFERENCIA TU PRODUCTO O MARCA?', state.strategyPositioning, 40, 350, 1315, 145);
    text('DATOS PREVIOS · OPCIONALES · USA EL MISMO PERIODO', 45, 552, 21, C.purple, 700);
    field('strategyMetricsImpressions', 'IMPRESIONES', state.strategyMetricsImpressions, 40, 603, 420, 80);
    field('strategyMetricsVisits', 'VISITAS AL PERFIL', state.strategyMetricsVisits, 483, 603, 420, 80);
    field('strategyMetricsFollows', 'SEGUIDORES OBTENIDOS', state.strategyMetricsFollows, 926, 603, 429, 80);
    wrap(
      'Si todavía no tienes métricas, deja los campos vacíos. La guía local no consulta tu cuenta ni inventa resultados.',
      45,
      730,
      1260,
      24,
      C.muted,
      35,
      2
    );
    button('strategy:back', '← Tu campaña', 40, 862, 300, 80);
    button('strategy:local', 'Preparar guía local', 360, 862, 465, 80, { primary: true, disabled: state.busy });
    button('strategy:analyze', 'Analizar con Muse Spark', 845, 862, 510, 80, {
      disabled: state.busy || !state.config.meta || !state.config.paidEnabled || !state.strategyProduct
    });
    text('Muse Spark usa tu API al pulsar. Puedes empezar con la guía local.', 46, 827, 20, C.amber);
  } else {
    const plan = state.strategyPlan;
    if (!plan) {
      state.strategyStage = 'brief';
      return;
    }
    button('strategy-tab:idea', 'Concepto', 40, 319, 420, 62, { active: state.strategyReviewTab === 'idea', small: true });
    button('strategy-tab:shots', 'Escenas de imagen', 483, 319, 420, 62, { active: state.strategyReviewTab === 'shots', small: true });
    button('strategy-tab:data', 'Datos y medición', 926, 319, 429, 62, { active: state.strategyReviewTab === 'data', small: true });
    box(40, 405, 1315, 382, C.card, 24, C.line);
    text(plan.provider === 'muse-spark' ? 'MUSE SPARK · ESTRATEGIA' : 'GUÍA LOCAL · BASADA EN TU ENCARGO', 65, 447, 20, C.purple, 700);
    if (state.strategyReviewTab === 'idea') {
      wrap(plan.summary, 65, 495, 1250, 29, C.text, 40, 3);
      plan.concepts.forEach((idea, i) => wrap(`${i + 1}. ${idea}`, 65, 634 + i * 45, 1230, 22, C.muted, 28, 1));
    }
    if (state.strategyReviewTab === 'shots') {
      plan.shotList.forEach((shot, i) => {
        text(photoSlots[i][1].toUpperCase(), 65, 492 + i * 70, 19, C.amber, 700);
        wrap(shot, 65, 522 + i * 70, 1240, 21, C.text, 28, 2);
      });
    }
    if (state.strategyReviewTab === 'data') {
      wrap(plan.diagnosis, 65, 495, 1240, 25, C.text, 35, 4);
      text(('MEDIREMOS: ' + plan.kpis.join(' · ')).slice(0, 101), 65, 680, 21, C.green);
      wrap(
        plan.metrics?.source || 'Datos proporcionados por ti; no conectados automáticamente a Instagram.',
        65,
        727,
        1210,
        20,
        C.muted,
        28,
        2
      );
    }
    text('La idea es una hipótesis creativa; revisa lo que sabes de tu marca.', 45, 829, 21, C.muted);
    button('strategy:edit', 'Editar estrategia', 40, 862, 430, 80);
    button('strategy:continue', 'Me gusta · crear las imágenes →', 495, 862, 860, 80, { primary: true });
  }
}
function drawCapture() {
  const saved = photoSlots.filter(([slot]) => state.photos[slot]).length,
    pending = state.pendingCapture;
  heading(
    pending ? '¿Guardamos esta toma?' : 'Tu producto, desde cuatro miradas.',
    pending
      ? 'Revisa la nitidez y la forma. La foto se guarda cuando tú la aceptas.'
      : 'Frente, derecha, izquierda y atrás. Luma te guía; tú eliges la mejor toma.'
  );
  box(38, 303, 850, 428, '#100f17', 24, C.line);
  if (pending) {
    image(pending.url, 40, 305, 846, 424, 'contain');
    badge('REVISIÓN · ' + photoSlots.find(([slot]) => slot === pending.slot)[1].toUpperCase(), 64, 348, C.amber);
  } else if (stream && camera.readyState >= 2) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(40, 305, 846, 424, 22);
    ctx.clip();
    const s = Math.min(846 / camera.videoWidth, 424 / camera.videoHeight);
    ctx.drawImage(
      camera,
      40 + (846 - camera.videoWidth * s) / 2,
      305 + (424 - camera.videoHeight * s) / 2,
      camera.videoWidth * s,
      camera.videoHeight * s
    );
    ctx.restore();
    badge('CÁMARA EN DIRECTO', 64, 348, C.green);
  } else {
    const showing = state.photos[state.captureSlot] || state.photo;
    if (showing) {
      image(showing.url, 40, 305, 846, 424, 'contain');
      badge('FOTO GUARDADA', 64, 348, C.green);
    } else {
      drawLuma(ctx, 460, 465, 60);
      text('Enciende la cámara para empezar', 215, 610, 28, C.text);
      text('También puedes subir una foto desde escritorio', 190, 653, 22, C.muted);
    }
  }
  if (!pending) {
    ctx.strokeStyle = '#ffffff90';
    ctx.lineWidth = 3;
    for (const [x, y, sx, sy] of [
      [90, 385, 1, 1],
      [835, 385, -1, 1],
      [90, 688, 1, -1],
      [835, 688, -1, -1]
    ]) {
      ctx.beginPath();
      ctx.moveTo(x + sx * 35, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + sy * 35);
      ctx.stroke();
    }
  }
  if (state.captureCountdown) {
    box(385, 440, 150, 150, '#17151fe0', 75, C.amber);
    text(state.captureCountdown, 432, 544, 74, C.amber, 800);
  }
  photoSlots.forEach(([slot, label], i) => {
    const x = 38 + i * 216,
      p = state.photos[slot];
    box(
      x,
      746,
      200,
      100,
      state.captureSlot === slot ? '#40314e' : C.card,
      14,
      p ? C.green : state.captureSlot === slot ? C.purple : C.line
    );
    if (p) image(p.url, x + 7, 754, 61, 84, 'contain');
    else text('○', x + 31, 809, 38, C.muted);
    text(label, x + 77, 785, 20, C.text, 650);
    text(p ? '✓ Guardada' : 'Pendiente', x + 77, 816, 16, p ? C.green : C.muted);
    ui.hits.push({
      id: 'slot:' + slot,
      label: label + (p ? ' · guardada' : ''),
      x,
      y: 746,
      w: 200,
      h: 100,
      disabled: !!pending || state.captureBusy
    });
  });
  drawLuma(ctx, 948, 340, 23);
  text('LUMA · GUÍA DE TOMA', 989, 348, 19, C.purple, 700);
  if (pending) wrap(CAPTURE_TIPS[pending.slot], 925, 395, 410, 25, C.text, 35, 4);
  else if (saved === 4) wrap('¡Tienes las 4 vistas! Cierra la cámara si sigue abierta y pulsa «Continuar» para seguir con la dirección creativa.', 925, 395, 410, 25, C.green, 35, 5);
  else
    wrap(
      `Cómo tomar la foto: 1) Pulsa «Abrir cámara» (botón violeta). 2) Aparece una cámara frente a ti: apunta al producto. ${CAPTURE_TIPS[state.captureSlot]} 3) Pellizca «● Tomar foto» dentro de esa cámara.`,
      925, 390, 410, 22, C.text, 30, 7
    );
  if (pending) {
    button('capture-save', state.busy ? 'Guardando…' : '✓ Guardar esta toma', 916, 586, 440, 86, { primary: true, disabled: state.busy });
    button('capture-retake', '↻ Repetir foto', 916, 689, 440, 82, { disabled: state.busy });
    text('No se envía a la IA al guardar.', 928, 820, 19, C.muted);
  } else {
    button('camera-hud', state.hudVisible ? '✕  Cerrar cámara' : '▣  1 · Abrir cámara para tomar fotos', 916, 573, 440, 74, { primary: !state.hudVisible, disabled: state.captureBusy });
    button('capture-timer', state.captureTimer ? 'Temporizador · 3 segundos' : 'Temporizador · sin espera', 916, 662, 440, 74, {
      active: !!state.captureTimer,
      small: true,
      disabled: state.captureBusy
    });
    button('camera', stream ? 'Cambiar cámara' : 'Iniciar cámara', 916, 751, 440, 74, { small: true, disabled: state.captureBusy });
  }
  button(
    pending ? 'capture' : 'camera-hud',
    pending ? 'Toma lista para revisar' : state.captureBusy ? 'Guardando tu foto…' : state.hudVisible ? '✕  Cerrar cámara' : '▣  Abrir cámara y tomar fotos',
    38,
    863,
    570,
    80,
    { primary: true, disabled: !!pending || state.captureBusy }
  );
  text(saved + '/4 vistas guardadas', 638, 910, 20, C.green);
  button('nav:strategy', 'Continuar · proponer campaña →', 916, 863, 440, 80, {
    primary: !!state.photo,
    disabled: !state.photo || !!pending || state.captureBusy
  });
}
function drawBrief() {
  heading('Dale una dirección creativa.', 'Tus vistas guardadas acompañan el encargo. Tú decides el universo.');
  if (state.photo) image(state.photo.url, 38, 315, 290, 380, 'contain');
  else button('nav:capture', 'Tomar foto primero', 38, 335, 340, 100, { primary: true });
  text((state.strategyTheme || 'TU CAMPAÑA').toUpperCase().slice(0, 24), 38, 736, 19, C.amber, 700);
  wrap('Premium. Cinematográfico. Una campaña coherente en todos tus formatos.', 38, 776, 290, 25, C.muted, 38, 4);
  text(`${photoSlots.filter(([s]) => state.photos[s]).length}/4 vistas del producto guardadas`, 38, 919, 19, C.green);
  field('brief', '¿QUÉ QUIERES CREAR?', state.brief, 370, 345, 985, 285);
  button('theme:halloween', 'Halloween', 370, 697, 280, 70, { active: true });
  button('theme:premium', 'Más premium', 665, 697, 295, 70);
  button('record:brief', state.recording ? '■  Terminar dictado' : '🎙  Hablar con Muse Voice', 975, 697, 380, 70, {
    active: state.recording
  });
  text('Dicta, revisa el texto arriba y después pulsa Crear campaña.', 380, 805, 21, C.muted);
  button('generate', state.busy ? 'Creando campaña…' : '✦  Crear propuestas de campaña', 660, 855, 695, 90, {
    primary: true,
    disabled: state.busy || !state.photo
  });
}
function drawGallery() {
  const assets = state.campaign?.result?.assets || [];
  heading('Una campaña. Distintas miradas.', `${assets.length} propuestas · ${state.selected.length} seleccionadas para publicar`);
  if (!assets.length) {
    wrap(
      state.busy
        ? 'Tu campaña se está preparando. Puedes seguir viendo el progreso aquí.'
        : 'Crea tu primera campaña para ver las propuestas y escoger tus favoritas.',
      55,
      400,
      1150,
      32,
      C.muted,
      48,
      4
    );
    button('nav:brief', 'Ir a dirección creativa →', 55, 655, 620, 90, { primary: true });
    return;
  }
  const count = Math.min(3, assets.length);
  for (let col = 0; col < count; col++) {
    const index = (state.index + col) % assets.length,
      a = assets[index],
      x = 38 + col * 449,
      caution = state.mode === 'live' && a.review?.approved === false;
    box(x, 306, 430, 540, C.card, 22, state.selected.includes(a.id) ? C.amber : C.line);
    const im = getImage(a.url);
    if (im?.complete && im.naturalWidth) campaignImage(ctx, im, headlineFor(a), x + 10, 320, 410, 380);
    else image(a.url, x + 10, 320, 410, 380);
    text(a.title?.slice(0, 24) || `Propuesta ${index + 1}`, x + 22, 746, 25, C.text, 600);
    if (state.mode === 'live')
      text(caution ? '⚠ IA: ' + a.review.note.slice(0, 32) : '✓ IA: sin cambios detectados', x + 22, 710, 17, caution ? C.amber : C.green);
    button('select:' + a.id, state.selected.includes(a.id) ? '✓  Seleccionada' : '+  Seleccionar', x + 14, 765, 402, 73, {
      active: state.selected.includes(a.id),
      small: true
    });
    ui.hits.push({ id: 'focus:' + index, label: 'Ver propuesta ' + (index + 1), x: x + 10, y: 320, w: 410, h: 380 });
  }
  button('prev', '←', 38, 864, 92, 78);
  button('next', '→', 145, 864, 92, 78);
  text(`${(state.index % assets.length) + 1} / ${assets.length}`, 260, 914, 25, C.muted);
  button('select-all', 'Elegir todas', 410, 864, 210, 78, { small: true });
  button('nav:publish', 'Revisar publicación →', 640, 864, 716, 78, { primary: true, disabled: !state.selected.length });
}
function drawPublish() {
  const username = state.connections?.instagram?.username || 'danielmurcia.ia',
    assets = selectedAssets(),
    blocked = state.mode === 'live' && !state.connections?.instagram?.valid;
  heading('Tu última mirada antes de publicar.', 'Cuenta: @' + username + ' · Revisa imagen, orden y texto antes de confirmar.');
  if (state.publishReceipt) {
    const receipt = state.publishReceipt;
    box(38, 325, 1318, 535, C.card, 24, C.line);
    drawLuma(ctx, 100, 401, 30);
    text(
      receipt.simulated ? 'SIMULACIÓN COMPLETADA' : receipt.verified ? 'PUBLICADO Y VERIFICADO' : 'INSTAGRAM DEVOLVIÓ UN ID',
      153,
      410,
      33,
      receipt.verified ? C.green : C.amber,
      700
    );
    wrap(receipt.message, 68, 480, 1220, 29, C.text, 41, 3);
    if (receipt.id) text('ID: ' + receipt.id, 68, 610, 21, C.muted);
    if (receipt.permalink) button('open-publication', '↗ Ver publicación real', 68, 715, 540, 80, { primary: true });
    button('nav:ads', 'Siguiente paso: preparar la pauta →', 68, 640, 1242, 62, { primary: !receipt.permalink });
    button('new-publication', 'Preparar otra publicación', 680, 715, 630, 80);
    return;
  }
  if (!assets.length) {
    wrap('Elige tus imágenes favoritas para preparar la publicación.', 55, 405, 1100, 32, C.muted);
    button('nav:gallery', 'Elegir imágenes →', 55, 560, 650, 88, { primary: true });
    return;
  }
  if (state.confirm) {
    box(40, 320, 1315, 495, C.card, 24, C.line);
    text(state.mode === 'demo' ? 'CONFIRMAR SIMULACIÓN' : 'CONFIRMAR PUBLICACIÓN REAL', 65, 375, 27, C.amber, 750);
    text('@' + username, 65, 431, 34, C.text, 700);
    text(
      (state.format === 'story'
        ? 'Historia · primera imagen'
        : state.format === 'storyvideo'
          ? 'Historia · video con sonido'
          : state.format === 'reel'
          ? 'Reel · video seleccionado'
          : 'Carrusel / post · ' + assets.length + ' imagen(es)') +
        ' · ' +
        (state.mode === 'demo' ? 'sin envío a Instagram' : 'se enviará a Instagram'),
      65,
      481,
      23,
      C.purple
    );
    wrap(state.caption || 'Sin texto de publicación.', 65, 552, 1230, 27, C.text, 38, 5);
    wrap(
      blocked
        ? state.connections?.instagram?.message
        : 'Revisa la vista previa de la derecha. Después confirma una sola vez; verás el progreso y el recibo devuelto por Instagram.',
      65,
      755,
      1220,
      21,
      blocked ? C.amber : C.muted,
      29,
      2
    );
    button('cancel-publish', '← Volver a revisar', 40, 864, 435, 80);
    button(
      'publish',
      state.busy ? 'Enviando…' : state.mode === 'demo' ? 'Confirmar simulación' : 'Sí, publicar en Instagram',
      500,
      864,
      855,
      80,
      { primary: true, disabled: state.busy || blocked }
    );
    return;
  }
  button('format:carousel', 'Carrusel / post', 40, 320, 270, 66, { active: state.format === 'carousel' });
  button('format:story', 'Historia · imagen', 330, 320, 300, 66, { active: state.format === 'story' });
  button('format:storyvideo', 'Historia · video', 650, 320, 340, 66, { active: state.format === 'storyvideo', disabled: !state.video });
  button('format:reel', 'Reel', 1010, 320, 345, 66, { active: state.format === 'reel', disabled: !state.video });
  const idx = state.index % assets.length,
    shown = assets[idx];
  assets.forEach((asset, i) => {
    const x = 40 + i * 140;
    box(x, 411, 127, 138, i === idx ? '#493957' : C.card, 15, i === idx ? C.amber : C.line);
    image(asset.url, x + 6, 417, 115, 98, 'contain');
    text(String(i + 1), x + 15, 538, 20, C.text, 700);
    ui.hits.push({ id: 'publish-focus:' + i, label: 'Ver imagen ' + (i + 1), x, y: 411, w: 127, h: 138 });
  });
  text('ORDEN DEL CARRUSEL', 655, 437, 21, C.purple, 700);
  text('Imagen ' + (idx + 1) + ' de ' + assets.length + ' · tú decides el orden', 655, 474, 23, C.text);
  button('publish-move:left', '← Mover antes', 655, 498, 330, 53, { small: true, disabled: idx === 0 });
  button('publish-move:right', 'Mover después →', 1002, 498, 353, 53, { small: true, disabled: idx === assets.length - 1 });
  field('headline', 'TITULAR DEL ANUNCIO (el texto de la imagen lo crea la IA)', headlineFor(shown), 40, 606, 1315, 75);
  field('caption', 'COPY DE LA PUBLICACIÓN', state.caption, 40, 737, 1315, 105);
  text(state.caption.length + '/2200 caracteres', 1080, 860, 17, C.muted);
  if (blocked) text('⚠ ' + state.connections.instagram.message.slice(0, 83), 45, 860, 18, C.amber);
  button('nav:gallery', '← Elegir otras imágenes', 40, 878, 440, 65, { small: true });
  button('confirm-publish', state.mode === 'demo' ? 'Revisar simulación →' : 'Revisar y publicar en Instagram →', 505, 878, 850, 65, {
    primary: true,
    disabled: state.busy || blocked
  });
}
function drawAds() {
  heading('Luma prepara tu pauta.', 'Tu publicación y tus imágenes son el punto de partida. El resultado queda como borrador local.');
  const assets = selectedAssets();
  if (!assets.length) {
    wrap('Elige las imágenes de la publicación para que Luma prepare la pauta.', 48, 385, 1150, 31, C.muted);
    button('nav:gallery', 'Elegir imágenes →', 48, 535, 620, 88, { primary: true });
    return;
  }
  if (state.adsStage !== 'review' || !state.adsPlan?.result) {
    text('TU PUBLICACIÓN · ' + assets.length + ' IMAGEN(ES)', 42, 325, 22, C.purple, 700);
    assets.slice(0, 4).forEach((a, i) => image(a.url, 40 + i * 145, 345, 132, 150));
    wrap(state.caption || state.campaign?.result?.caption || 'Luma usará el texto de tu campaña.', 655, 366, 680, 23, C.text, 31, 4);
    button('nav:gallery', 'Cambiar imágenes', 40, 505, 570, 53, { small: true });
    field('adsCity', '¿DÓNDE MOSTRARLA?', state.adsCity, 40, 620, 635, 80);
    field('adsBudget', 'TOPE DIARIO OPCIONAL · ' + state.adsCurrency, state.adsBudget, 715, 620, 640, 80);
    text('Si dejas el tope vacío, Luma propondrá un presupuesto para revisar.', 45, 743, 21, C.muted);
    button('ads-goal:auto', 'Que Luma proponga', 40, 775, 425, 60, { active: state.adsGoal === 'auto', small: true });
    button('ads-goal:profile', 'Crecer en Instagram', 485, 775, 425, 60, { active: state.adsGoal === 'profile', small: true });
    button('ads-goal:awareness', 'Dar a conocer', 930, 775, 425, 60, { active: state.adsGoal === 'awareness', small: true });
    button(
      'ads:plan',
      state.busy ? 'Preparando…' : state.mode === 'demo' ? 'Preparar guía demo con Luma' : 'Analizar publicación y proponer pauta',
      40,
      860,
      1315,
      86,
      { primary: true, disabled: state.busy }
    );
  } else {
    const r = state.adsPlan.result,
      q = r.recommendation,
      local = q.provider === 'local-demo' || state.adsPlan.mode === 'demo',
      goal = q.goal || 'profile',
      amount = q.suggestedDailyBudget ?? r.brief.dailyBudget,
      days = q.days || r.brief.days || 3;
    text(local ? '● GUÍA DEMO · BORRADOR LOCAL' : '● PROPUESTA DE LUMA · BORRADOR LOCAL', 43, 325, 22, C.amber, 700);
    wrap(
      `${goal === 'awareness' ? 'Dar a conocer' : 'Visitas al perfil e invitación a seguir'} · ${r.brief.city} · ${amount == null ? 'Presupuesto por proponer' : amount + ' ' + r.brief.currency + '/día'} · ${days} días · ${r.assets.length} pieza(s)`,
      45,
      374,
      1280,
      25,
      C.text,
      35,
      2
    );
    const tabs = [
      ['idea', 'Estrategia'],
      ['audience', 'Público y medios'],
      ['budget', 'Presupuesto'],
      ['creative', 'Piezas y copy']
    ];
    tabs.forEach(([id, label], i) =>
      button('ads-tab:' + id, label, 40 + i * 333, 440, 315, 61, { active: state.adsReviewTab === id, small: true })
    );
    box(40, 524, 1315, 306, C.card, 20, C.line);
    const tab = state.adsReviewTab || 'idea';
    let title, lines;
    if (tab === 'audience') {
      title = 'PÚBLICO Y UBICACIONES PROPUESTAS';
      lines = [q.audience, q.placements];
    } else if (tab === 'budget') {
      title = 'PROPUESTA PARA REVISAR · SIN GASTO ACTIVADO';
      lines = [
        q.budgetReasoning || 'Revisa y aprueba el presupuesto antes de hacer cualquier envío.',
        q.schedule || 'Confirma las fechas antes de activar.',
        amount == null
          ? 'Presupuesto pendiente de análisis real.'
          : `Total estimativo: ${q.totalBudget ?? amount * days} ${r.brief.currency}. No es un mínimo validado de Meta.`
      ];
    } else if (tab === 'creative') {
      title = 'APLICACIÓN A TUS IMÁGENES';
      lines = [q.creativePlan?.map((a, i) => `${i + 1}. ${a.angle}`).join(' ') || 'Revisar las imágenes elegidas.', q.copy];
    } else {
      title = 'DIRECCIÓN DE LUMA';
      lines = [q.reasoning, q.testPlan, 'Indicadores: ' + (q.kpis || ['Visitas al perfil', 'Seguidores obtenidos']).join(' · ')];
    }
    text(title, 65, 569, 22, C.purple, 700);
    let y = 609;
    for (const line of lines) {
      wrap(line, 65, y, 1210, 21, C.text, 29, tab === 'creative' ? 3 : 2);
      y += tab === 'creative' ? 103 : 82;
    }
    text(
      local ? 'Demo: sin análisis visual de IA.' : 'Analizado con tus imágenes y texto; sin investigación web ni métricas reales.',
      45,
      851,
      18,
      C.muted
    );
    button('ads:back', 'Ajustar propuesta ←', 40, 875, 550, 65, { small: true });
    button('ads:export', 'Descargar borrador', 615, 875, 740, 65, { primary: true });
  }
}
// Hoja de referencia del producto (4 vistas sobre fondo blanco), lista para el modo video.
const isVideoFormat = () => state.format === 'reel' || state.format === 'storyvideo';
const sheetOn = () => state.config?.video?.sheet === true; // FLUX 3 Max parte de una sola imagen: sin hoja de producto
const videoModelName = () => state.config?.video?.short || 'Seedance 2.5';
function ensureVideoSheet() {
  if (!sheetOn()) return null;
  const slots = photoSlots.filter(([s]) => state.photos[s]?.url).map(([s]) => [s, getImage(state.photos[s].url)]);
  const layout = SHEET_LAYOUTS[(state.videoSheetLayout || 0) % SHEET_LAYOUTS.length];
  const key = layout + '|' + slots.map(([s]) => s + state.photos[s].url).join(',');
  if (state.videoSheetKey === key && state.videoSheet) return state.videoSheet;
  const c = composeSheet(slots, layout);
  if (c && slots.every(([, im]) => im?.complete && im.naturalWidth)) {
    state.videoSheet = c;
    state.videoSheetKey = key;
  } else if (!c) state.videoSheet = null;
  return state.videoSheet;
}
// ───────── Pestaña «Video» de Publicar: 4 pasos, uno por pantalla, con UN botón grande ─────────
function videoTabs() {
  button('tab:images', '🖼 Imágenes', 800, 200, 270, 52, { small: true });
  button('tab:video', '🎬 Video', 1085, 200, 270, 52, { small: true, active: true });
}
function videoSteps(n) {
  ['1 · Imagen', '2 · Hook', '3 · Crear', '4 · Ver y publicar'].forEach((t, i) => {
    const x = 40 + i * 330,
      on = i + 1 === n,
      done = i + 1 < n;
    box(x, 290, 318, 36, on ? 'rgba(255,207,122,0.16)' : C.card, 18, on ? C.amber : C.line);
    text((done ? '✓ ' : '') + t, x + 20, 315, 19, on ? C.amber : done ? C.green : C.muted, on ? 700 : 500);
  });
}
const videoCost = () => {
  const d = state.duration || 5;
  const sh = state.config?.video?.short;
  const per = state.config?.video?.provider === 'fal' && sh === 'Seedance 2.5' ? 0.2205 : state.config?.video?.provider === 'fal' && sh === 'FLUX 3 Max' ? (Date.now() < Date.parse('2026-11-08') ? 0.0425 : 0.17) : 0.157;
  return `≈ US$${(per * d).toFixed(2)}`;
};
// Pantalla grande para ver el video creado, con reproducir/pausar, sonido y publicar.
function drawVideoWatch() {
  heading('Video · paso 4 de 4', 'Mira tu video. Si te gusta, elige dónde publicarlo.');
  videoTabs();
  videoSteps(4);
  const W = 288,
    H = 512,
    x = 70,
    y = 350;
  rr(ctx, x - 6, y - 6, W + 12, H + 12, 22);
  ctx.fillStyle = '#05040a';
  ctx.fill();
  if (film.readyState >= 2 && film.videoWidth) {
    const s = Math.min(W / film.videoWidth, H / film.videoHeight);
    ctx.drawImage(film, x + (W - film.videoWidth * s) / 2, y + (H - film.videoHeight * s) / 2, film.videoWidth * s, film.videoHeight * s);
  } else wrap('Cargando el video…', x + 60, y + 240, 200, 26, C.muted, 34, 2);
  const hook = state.videoPlan?.result?.hooks?.[state.videoHookIndex];
  text(`${state.video?.model || videoModelName()} · ${state.video?.duration || state.duration} s · 9:16 · con sonido`, 440, 380, 21, C.amber, 700);
  wrap(hook?.title || 'Video de la campaña', 440, 428, 880, 34, C.text, 42, 2);
  button('play-video', film.paused ? '▶ Reproducir' : '⏸ Pausar', 440, 490, 270, 62, { disabled: !state.video });
  button('video:sound', film.muted ? '🔇 Activar sonido' : '🔊 Sonido activo', 730, 490, 290, 62, { small: true, disabled: !state.video });
  text('PUBLICAR ESTE VIDEO COMO', 440, 610, 20, C.purple, 700);
  button('video:publish', 'Reel →', 440, 630, 270, 84, { primary: true, disabled: !state.video });
  button('video:publish-story', 'Historia →', 730, 630, 290, 84, { primary: true, disabled: !state.video });
  text('Nada se publica hasta que confirmes en la siguiente pantalla.', 440, 748, 19, C.muted);
  button('watch:back', '← Crear otro video', 440, 790, 280, 56, { small: true });
  text('El video queda guardado aunque recargues.', 740, 826, 19, C.muted);
}
function drawVideo() {
  if (state.videoWatch && state.video) return drawVideoWatch();
  ensureVideoSheet();
  const all = state.campaign?.result?.assets || [],
    chosen = videoAssets(),
    plan = state.videoPlan?.result,
    creating = !!plan && state.busy;
  const stage = !plan ? 1 : creating ? 3 : 2;
  heading(
    stage === 1 ? 'Video · paso 1 de 4' : stage === 2 ? 'Video · paso 2 de 4' : 'Video · paso 3 de 4',
    stage === 1 ? 'Elige la imagen que quieres animar y cuánto dura.' : stage === 2 ? 'Elige uno de los 3 hooks que propuso Luma.' : 'Creando tu video con sonido. No cierres esta pantalla.'
  );
  videoTabs();
  if (!all.length) {
    wrap('Crea primero una campaña de imágenes.', 45, 380, 1200, 32, C.muted);
    button('nav:brief', 'Ir a Dirección →', 45, 530, 650, 85, { primary: true });
    return;
  }
  videoSteps(stage);
  if (stage === 1) {
    all.slice(0, 4).forEach((a, i) => {
      const x = 40 + i * 332;
      image(a.url, x, 345, 318, 190, 'contain');
      button('video-select:' + a.id, (state.videoSelected.includes(a.id) ? '✓ ' : '○ ') + (a.title || 'Imagen ' + (i + 1)).slice(0, 18), x, 545, 318, 52, {
        active: state.videoSelected.includes(a.id),
        small: true,
        disabled: state.busy
      });
    });
    button('duration:5', '5 segundos', 40, 602, 255, 52, { active: state.duration === 5, small: true, disabled: state.busy });
    button('duration:10', '10 segundos', 315, 602, 255, 52, { active: state.duration === 10, small: true, disabled: state.busy });
    if (state.video) button('video:watch', '▶ Ver mi video', 1065, 602, 290, 52, { small: true });
    field('videoPrompt', 'TU IDEA PARA EL VIDEO (OPCIONAL) · LUMA LA MEJORA', state.videoPrompt, 40, 705, 1315, 135);
    button('video:plan', state.mode === 'demo' ? 'Proponer hooks demo →' : 'Buscar hooks con Luma →', 40, 866, 1315, 84, {
      primary: true,
      disabled: state.busy || !chosen.length
    });
    return;
  }
  plan.hooks.forEach((h, i) =>
    button('video-hook:' + i, h.title.slice(0, 28), 40 + i * 443, 345, 425, 62, {
      active: state.videoHookIndex === i,
      small: true,
      disabled: state.busy
    })
  );
  const hook = plan.hooks[state.videoHookIndex];
  box(40, 425, 1315, 300, C.card, 18, C.line);
  let shots = null;
  if (state.videoPromptView) {
    try {
      shots = JSON.parse(hook.prompt).shots;
    } catch {}
  }
  if (shots) shots.slice(0, 5).forEach((sh, i) => wrap(`${sh.time} · ${sh.action} · ${sh.framing ? sh.framing + ' · ' : ''}${sh.camera} · ${sh.lens} · ${sh.lighting}${sh.sound ? ' · 🔊 ' + sh.sound : ''}`, 65, 465 + i * 50, 1260, 19, C.text, 26, 2));
  else {
    wrap(hook.hook, 65, 470, 1260, 25, C.text, 34, 3);
    wrap(hook.storyboard, 65, 590, 1260, 21, C.muted, 30, 4);
  }
  button('video:promptview', state.videoPromptView ? 'Ver la idea' : 'Ver plan por segundos', 40, 740, 330, 52, { small: true });
  const source = plan.sources?.find(s => hook.sourceUrls.includes(s.url));
  if (source) button('video-source', '↗ Referencia del hook', 385, 740, 330, 52, { small: true });
  button('video:replan', '← Cambiar imagen o idea', 1025, 740, 330, 52, { small: true, disabled: state.busy });
  text(`${state.duration} s · ${state.config?.video?.resolution || '720p'} vertical · con sonido · costo aprox. ${videoCost()}`, 40, 835, 21, C.amber, 700);
  button('generate-video', state.busy ? 'Creando tu video… (1 a 3 minutos)' : state.mode === 'demo' ? 'Crear animación demo →' : 'Crear video con ' + videoModelName() + ' →', 40, 866, 1315, 84, {
    primary: true,
    disabled: state.busy || !chosen.length
  });
}
function drawSettings() {
  heading('Un estudio que funciona a tu ritmo.', 'Primero prueba las manos, cámara y menús. Conecta las APIs después.');
  button('mode:toggle', state.mode === 'demo' ? 'Salir del modo demo · usar APIs reales' : 'Activar modo demo (sin APIs, sin gasto)', 38, 325, 1318, 85, {
    active: state.mode === 'demo',
    disabled: state.mode === 'demo' && (!state.config.paidEnabled || !state.config.meta)
  });
  const services = [
    ['Meta · Spark / Image / Voice', state.config.meta, 'Clave guardada'],
    ['Meta Ads · borrador local', state.config.ads, !state.config.adsWriteEnabled ? 'Envío a Meta deshabilitado' : 'Conexión disponible'],
    [state.config.video?.provider === 'fal' ? 'Video · ' + videoModelName() + ' vía fal · ' + (state.config.video.resolution || '720p') : 'Video · Kling 4 · 720p', state.config.videoReady ?? state.config.kling, 'Clave guardada'],
    ['Instagram · publicación', state.connections?.instagram?.valid, 'Conexión verificada'],
    ['Medios públicos HTTPS', state.config.publicMedia, 'Origen configurado']
  ];
  services.forEach(([label, ok, ready], i) => {
    box(38, 435 + i * 74, 1318, 65, C.card, 14);
    text(label, 63, 477 + i * 74, 25);
    text(
      ok
        ? '● ' + ready
        : '○ ' +
            (label.startsWith('Instagram') && state.connections?.instagram?.configured ? 'Token vencido o inválido' : 'Revisar conexión'),
      900,
      477 + i * 74,
      20,
      ok ? C.green : C.amber
    );
  });
  button('toggle-assistant', state.assistantVisible ? 'Luma 3D · visible' : 'Luma 3D · oculta', 40, 819, 425, 48, {
    small: true,
    active: state.assistantVisible
  });
  button('toggle-motion', state.reducedMotion ? 'Movimiento reducido' : 'Animaciones suaves', 485, 819, 425, 48, {
    small: true,
    active: state.reducedMotion
  });
  text(
    state.xrStats
      ? state.xrStats.fps + ' fps · ' + state.xrStats.drawCalls + ' llamadas'
      : 'Pinza en cabecera para mover. Toca con el índice.',
    935,
    850,
    18,
    C.muted
  );
  button('recenter', '⌖  Recentrar paneles', 38, 881, 420, 65, { small: true });
  button('refresh-config', 'Actualizar conexiones', 475, 881, 445, 65, { small: true });
  button('exit-xr', 'Salir de AR', 938, 881, 418, 65, { small: true });
}
function drawKeyboard() {
  const k = state.keyboard;
  text('Escribe sin salir de realidad mixta', 38, 235, 37, C.text, 650);
  text(k.label, 38, 285, 23, C.purple);
  box(38, 310, 1318, 160, '#211d2b', 18, C.purple);
  wrap(k.value + (Math.floor(Date.now() / 500) % 2 ? '│' : ''), 60, 352, 1265, 28, C.text, 39, 3);
  const rows = ['1234567890', 'qwertyuiop', 'asdfghjklñ', 'zxcvbnm.,:'];
  rows.forEach((row, r) =>
    [...row].forEach((ch, i) => button('key:' + ch, k.shift ? ch.toUpperCase() : ch, 40 + i * 132, 500 + r * 87, 120, 74, { small: true }))
  );
  button('key:shift', '⇧', 38, 861, 148, 78, { active: k.shift });
  button('key:/', '/', 198, 861, 110, 78);
  button('key:-', '-', 320, 861, 110, 78);
  button('key:space', 'Espacio', 442, 861, 340, 78);
  button('key:back', 'Borrar', 794, 861, 205, 78, { small: true });
  button('key:done', 'Guardar ✓', 1011, 861, 345, 78, { primary: true });
}

function drawPreview() {
  const save = ctx; // separate context through a dedicated renderer
  pc.clearRect(0, 0, 900, 1100);
  pc.save();
  rr(pc, 0, 0, 900, 1100, 40);
  pc.clip();
  background(pc, 900, 1100);
  previewHits = [];
  const t = (s, x, y, size = 26, color = C.text) => txt(pc, s, x, y, { size, color, weight: size >= 40 ? 700 : 500 });
  glass(pc, 20, 16, 860, 56, 28, { strong: true });
  pc.beginPath();
  pc.arc(52, 44, 6, 0, Math.PI * 2);
  pc.fillStyle = T.mint;
  pc.fill();
  txt(pc, 'VISTA PREVIA', 72, 51, { size: 16, weight: 800, color: T.amber, spacing: 2.4 });
  icon(pc, 'grip', 836, 44, 26, T.faint, 2);
  previewBody(t);
  pc.restore();
  rr(pc, 1, 1, 898, 1098, 40);
  pc.strokeStyle = 'rgba(255,255,255,0.14)';
  pc.lineWidth = 2;
  pc.stroke();
}
function previewBody(t) {
  previewHits.push({ id: 'drag', x: 0, y: 0, w: 900, h: 84, drag: true, label: 'Mover vista previa' });
  if (state.page === 'strategy') {
    drawLuma(pc, 450, 300, 75);
    t('LUMA', 381, 425, 43, C.purple);
    t('TU ASESORA DE CAMPAÑA', 224, 477, 24, C.muted);
    const lines = [
      state.strategyProduct || 'Tu producto o negocio',
      state.strategyTheme || 'Tu temática',
      OBJECTIVES[state.strategyObjective],
      state.strategyPlan ? 'Estrategia guardada' : 'Preparando la dirección'
    ];
    lines.forEach((line, i) => t(line.slice(0, 46), 48, 590 + i * 79, i === 0 ? 31 : 25, i === 3 ? C.green : C.text));
    t('Datos del cliente + dirección creativa.', 48, 1000, 23, C.muted);
    t('Sin búsquedas ni métricas inventadas.', 48, 1040, 23, C.muted);
    return;
  }
  t('@' + (state.connections?.instagram?.username || 'danielmurcia.ia'), 35, 140, 28);
  chip(pc, 770, 112, state.mode === 'demo' ? 'DEMO' : 'BORRADOR', { color: T.amber, h: 34, size: 15 });
  photoSlots.forEach(([slot, label], i) => {
    const x = 25 + i * 216,
      p = state.photos[slot];
    glass(pc, x, 162, 204, 86, 20, { strong: !!p });
    if (p) {
      const im = getImage(p.url);
      if (im?.complete && im.naturalWidth) {
        const s = Math.min(76 / im.width, 76 / im.height);
        pc.drawImage(im, x + 5 + (76 - im.width * s) / 2, 167 + (76 - im.height * s) / 2, im.width * s, im.height * s);
      }
    }
    t(label, x + 91, 196, 21, C.text);
    t(p ? '✓ Guardada' : 'Pendiente', x + 91, 225, 18, p ? C.green : C.muted);
  });
  const assets = selectedAssets(),
    a = state.page === 'capture' ? null : assets[state.index % Math.max(1, assets.length)] || currentAsset();
  inset(pc, 25, 260, 850, 565, 22);
  const drawMedia = (media, w, h) => {
    const s = Math.min(850 / w, 565 / h);
    pc.drawImage(media, 25 + (850 - w * s) / 2, 260 + (565 - h * s) / 2, w * s, h * s);
  };
  if (state.video && (state.page === 'video' || (state.page === 'publish' && isVideoFormat())) && film.readyState >= 2)
    drawMedia(film, film.videoWidth, film.videoHeight);
  else if (a) {
    const im = getImage(a.url);
    if (im?.complete && im.naturalWidth) campaignImage(pc, im, headlineFor(a), 25, 260, 850, 565);
  } else if (state.pendingCapture || state.photo) {
    const im = getImage(state.pendingCapture?.url || state.photo.url);
    if (im?.complete && im.naturalWidth) drawMedia(im, im.width, im.height);
  } else {
    t('Tu campaña, aquí.', 245, 470, 38);
    t('Captura el primer producto.', 220, 520, 25, C.muted);
  }
  t('♡    ◇    ➤', 38, 880, 40);
  t(assets.length > 1 ? `${(state.index % assets.length) + 1} / ${assets.length}` : '', 728, 880, 24, C.muted);
  pc.font = '24px -apple-system,BlinkMacSystemFont,sans-serif';
  pc.fillStyle = '#c3b9d0';
  let line = '',
    n = 0;
  for (const word of (state.caption || 'Aquí verás el copy de tu campaña.').split(/\s+/)) {
    if (pc.measureText(line + word).width > 810 && line) {
      pc.fillText(line, 38, 930 + n * 35);
      n++;
      line = '';
      if (n >= 3) break;
    }
    line += word + ' ';
  }
  if (n < 3) pc.fillText(line, 38, 930 + n * 35);
  t(state.video?.demo ? 'ANIMACIÓN DEMO · SIN GENERACIÓN IA' : 'VISTA APROXIMADA · NO ES INSTAGRAM', 38, 1075, 18, C.muted);
  if (state.video) {
    previewHits.push({ id: 'play-video', label: 'Reproducir o pausar video', x: 25, y: 260, w: 850, h: 565 });
  }
}
let accessibleKey = '';
function syncAccessible() {
  const buttons = [...ui.hits, ...(state.hudVisible ? hudHits : [])].filter(h => h.id !== 'drag');
  const signature = buttons.map(h => `${h.id}:${h.label}:${h.disabled}`).join('|');
  if (signature === accessibleKey) return;
  accessibleKey = signature;
  const container = $('#accessibleActions');
  container.replaceChildren();
  for (const h of buttons) {
    const b = document.createElement('button');
    b.textContent = h.label;
    b.disabled = !!h.disabled;
    b.className = h.nav ? 'nav' + (h.id === 'nav:' + state.page ? ' active' : '') : '';
    if (h.nav) b.setAttribute('aria-pressed', String(h.id === 'nav:' + state.page));
    b.onclick = () => action(h.id);
    container.append(b);
  }
}
export function hitAt(panel, x, y) {
  return (panel === 'camera' ? hudHits : panel === 'preview' ? previewHits : ui.hits).findLast(
    h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h
  );
}
let lastHoverId = null;
export function setHover(id) {
  if (id !== lastHoverId) {
    lastHoverId = id;
    state.uiTouch = performance.now();
  }
  setUiHover(id);
}
for (const [canvas, name] of [
  [board, 'main'],
  [preview, 'preview'],
  [cameraHud, 'camera']
]) {
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    const hv = hitAt(name, ((e.clientX - r.left) * canvas.width) / r.width, ((e.clientY - r.top) * canvas.height) / r.height)?.id;
    setUiHover(hv);
    canvas.style.cursor = hv ? 'pointer' : 'default';
  });
  canvas.addEventListener('pointerleave', () => setUiHover(null));
  canvas.addEventListener('pointerdown', e => {
    const r = canvas.getBoundingClientRect(),
      h = hitAt(name, ((e.clientX - r.left) * canvas.width) / r.width, ((e.clientY - r.top) * canvas.height) / r.height);
    if (h && !h.disabled && !h.drag) action(h.id);
  });
}
async function api(path, data) {
  const r = await fetch('/api/' + path, {
    headers: { 'X-Lang': getLang(), ...(data ? { 'Content-Type': 'application/json' } : {}) },
    ...(data ? { method: 'POST', body: JSON.stringify(data) } : {})
  });
  const j = await r.json();
  if (!r.ok) throw Error(j.error || `HTTP ${r.status}`);
  return j;
}
async function pollJob(j) {
  state.job = j;
  while (['queued', 'running'].includes(j.status)) {
    await new Promise(r => setTimeout(r, 900));
    j = await api('jobs/' + j.id);
    state.job = j;
    notice(`${j.stage}${j.progress ? ' · ' + j.progress + '%' : ''}`);
    if (j.type === 'campaign' && j.result) {
      state.campaign = j;
      for (const a of j.result.assets) getImage(a.url);
    }
  }
  if (j.status !== 'completed') throw Error(j.error || j.stage || 'Trabajo interrumpido');
  return j;
}
// La moneda de la pauta SIEMPRE es la de la cuenta publicitaria de Meta (evita rechazos COP vs USD).
async function syncAdsCurrency() {
  if (state.mode !== 'live') return false;
  try {
    state.connections = await api('connections');
  } catch {
    return false;
  }
  const acc = String(state.connections?.ads?.currency || '').toUpperCase();
  if (!['COP', 'USD'].includes(acc)) return false;
  state.adsAccountCurrency = acc;
  if (state.adsCurrency !== acc) {
    state.adsCurrency = acc;
    state.adsBudgetN = acc === 'USD' ? 5 : 20000;
    state.adsPlan = null;
    return true;
  }
  return false;
}

async function run(task) {
  if (state.busy) return;
  state.busy = true;
  try {
    await task();
  } catch (e) {
    notice('⚠ ' + e.message);
  } finally {
    state.busy = false;
    state.job = null;
  }
}
async function startCamera({ switchDevice = false } = {}) {
  if (cameraRequest) return cameraRequest;
  if (stream && !switchDevice) return;
  cameraRequest = (async () => {
    if (!navigator.mediaDevices?.getUserMedia) throw Error('Cámara no disponible. Abre HTTPS o localhost del visor mediante USB.');
    if (stream && switchDevice) {
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
      const current = stream.getVideoTracks()[0].getSettings().deviceId;
      const idx = devices.findIndex(d => d.deviceId === current);
      if (devices.length > 1) {
        const next = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: devices[(idx + 1) % devices.length].deviceId } },
          audio: false
        });
        stream.getTracks().forEach(t => t.stop());
        stream = next;
      }
    }
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 } },
          audio: false
        });
      } catch (e) {
        if (e.name === 'NotAllowedError' || e.name === 'SecurityError') throw e;
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
    }
    camera.srcObject = stream;
    await camera.play();
    xrlog('camera-ok', stream.getVideoTracks()[0]?.label || 'video');
    notice(
      `Cámara activa · ${stream.getVideoTracks()[0].label || 'video disponible'}. Elige Frente, Derecha, Izquierda o Atrás y toma la foto.`
    );
  })();
  try {
    return await cameraRequest;
  } finally {
    cameraRequest = null;
  }
}
async function savePhoto(data, slot = state.captureSlot) {
  const p = await api('upload', { image: data });
  const saved = await api('photos', { slot, file: p.file });
  state.photos = { front: saved.front, right: saved.right || saved.side || null, left: saved.left || null, back: saved.back };
  state.photo = state.photos.front || state.photos.right || state.photos.left || state.photos.back;
  state.strategyPlan = null;
  state.ideaPick = null;
  const label = photoSlots.find(([s]) => s === slot)?.[1] || 'Producto';
  { const n = Object.values(state.photos).filter(Boolean).length; if (n < 4) say('estudio', `Foto guardada · ${n}/4`); }
  emit('photo_saved', { n: Object.values(state.photos).filter(Boolean).length });
  notice(`✓ Foto ${label.toLowerCase()} guardada en el servidor. La ves abajo y en el panel de vista previa.`);
  const next = photoSlots.find(([s]) => !state.photos[s]);
  if (next) state.captureSlot = next[0];
  getImage(p.url);
}
async function prepareCapture({ autoSave = false, timer = state.captureTimer } = {}) {
  if (state.captureBusy || state.pendingCapture) return;
  if (!stream || camera.readyState < 2) throw Error('Inicia la cámara y espera a ver la imagen.');
  const sequence = ++captureSequence,
    slot = state.captureSlot;
  state.captureBusy = true;
  try {
    for (let n = timer; n > 0; n--) {
      state.captureCountdown = n;
      await new Promise(r => setTimeout(r, 1000));
      if (sequence !== captureSequence) return;
    }
    if (sequence !== captureSequence) return;
    if (!stream || stream.getVideoTracks()[0]?.readyState === 'ended' || camera.readyState < 2 || !camera.videoWidth || !camera.videoHeight)
      throw Error('La cámara perdió la imagen. Vuelve a iniciar la cámara.');
    const c = document.createElement('canvas'),
      scale = Math.min(1, 1400 / camera.videoWidth);
    c.width = Math.round(camera.videoWidth * scale);
    c.height = Math.round(camera.videoHeight * scale);
    c.getContext('2d').drawImage(camera, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', 0.9);
    if (autoSave) {
      await savePhoto(url, slot);
      state.hudReplaceSlot = null;
      state.hudReviewSlot = null;
      return;
    }
    state.pendingCapture = { url, slot, width: c.width, height: c.height };
    getImage(url);
    notice('Toma preparada. Revisa la foto y pulsa Guardar esta toma o Repetir.');
  } finally {
    if (sequence === captureSequence) {
      state.captureBusy = false;
      state.captureCountdown = 0;
    }
  }
}
function exampleProduct() {
  const c = document.createElement('canvas');
  c.width = 800;
  c.height = 1000;
  const c2 = c.getContext('2d');
  const g = c2.createLinearGradient(0, 0, 800, 1000);
  g.addColorStop(0, '#ede7df');
  g.addColorStop(1, '#b0a2ac');
  c2.fillStyle = g;
  c2.fillRect(0, 0, 800, 1000);
  c2.fillStyle = '#0002';
  c2.beginPath();
  c2.ellipse(405, 875, 180, 35, 0, 0, Math.PI * 2);
  c2.fill();
  c2.fillStyle = '#392737';
  c2.beginPath();
  c2.roundRect(285, 280, 230, 560, [40, 40, 65, 65]);
  c2.fill();
  const bg = c2.createLinearGradient(285, 0, 515, 0);
  bg.addColorStop(0, '#503148');
  bg.addColorStop(0.45, '#805067');
  bg.addColorStop(1, '#281c2c');
  c2.fillStyle = bg;
  c2.fill();
  c2.fillStyle = '#bd9e76';
  c2.fillRect(335, 175, 130, 110);
  c2.fillStyle = '#e9d9bb';
  c2.fillRect(309, 440, 182, 245);
  c2.fillStyle = '#3b2738';
  c2.textAlign = 'center';
  c2.font = '50px Georgia';
  c2.fillText('NOCHE', 400, 520);
  c2.font = '17px sans-serif';
  c2.fillText('BOTANICAL STUDIO', 400, 555);
  c2.beginPath();
  c2.arc(400, 605, 20, 0, Math.PI * 2);
  c2.strokeStyle = '#ac8960';
  c2.stroke();
  c2.font = '16px sans-serif';
  c2.fillText('PRODUCTO DE EJEMPLO', 400, 940);
  return c.toDataURL('image/jpeg', 0.9);
}
async function demoArtwork(photo, i, theme = 'Tu campaña', live = false) {
  const im = getImage(photo.url);
  if (!im.complete)
    await new Promise((r, e) => {
      im.onload = r;
      im.onerror = e;
    });
  const c = document.createElement('canvas');
  c.width = 800;
  c.height = 1000;
  const q = c.getContext('2d'),
    pal = [
      ['#201326', '#754035'],
      ['#201336', '#624090'],
      ['#0c2225', '#406c65'],
      ['#3a1d24', '#bd7947']
    ][i];
  const g = q.createRadialGradient(420, 400, 5, 400, 500, 700);
  g.addColorStop(0, pal[1]);
  g.addColorStop(1, pal[0]);
  q.fillStyle = g;
  q.fillRect(0, 0, 800, 1000);
  q.fillStyle = '#ffc08b10';
  for (let j = 0; j < 7; j++) {
    q.beginPath();
    q.ellipse(50 + j * 135, 800 + (j % 2) * 35, 270, 140, -0.2, 0, Math.PI * 2);
    q.fill();
  }
  q.strokeStyle = '#ffe5c044';
  q.lineWidth = 2;
  q.beginPath();
  q.arc(400, 435, 275, 0, Math.PI * 2);
  q.stroke();
  q.save();
  q.translate(400, 510);
  q.rotate((i - 1.5) * 0.035);
  q.shadowColor = '#0008';
  q.shadowBlur = 40;
  const s = Math.min(500 / im.width, 580 / im.height);
  q.drawImage(im, (-im.width * s) / 2, (-im.height * s) / 2, im.width * s, im.height * s);
  q.restore();
  q.fillStyle = '#f6e5cb';
  q.font = '16px sans-serif';
  q.font = '58px Georgia';
  q.fillText(['Fuera de lo común.', 'Una noche distinta.', 'Entre luz y sombra.', 'Un toque de magia.'][i], 48, 858);
  q.font = '20px sans-serif';
  q.fillStyle = '#e1c6b3';
  q.fillText('Tu producto. Otra atmósfera.', 50, 904);
  q.fillStyle = '#ffd1a0';
  q.font = '17px sans-serif';
  q.fillText(('AUMENTADOS · ' + theme).toUpperCase().slice(0, 48), 50, 972);
  if (!live) {
    q.fillStyle = '#0009';
    q.fillRect(0, 984, 800, 16);
  }
  return c.toDataURL('image/jpeg', 0.88);
}


const sleep = ms => new Promise(r => setTimeout(r, ms));
async function runAgents() {
  if (state.agents.running) return;
  state.confirmAutopilot = false;
  state.agents = { running: true, startedAt: Date.now(), finishedAt: 0, steps: AGENT_PIPELINE.map(a => ({ agent: a.id, status: 'pending' })) };
  const step = async (agent, fn) => {
    const s = state.agents.steps.find(x => x.agent === agent);
    s.status = 'running';
    try {
      const note = await fn();
      s.status = note === false ? 'skipped' : 'done';
      if (typeof note === 'string') s.note = note;
    } catch (e) {
      s.status = 'error';
      s.note = e.message.slice(0, 60);
    }
    await sleep(state.reducedMotion ? 0 : 280);
  };
  try {
    await step('estratega', async () => {
      if (!state.strategyPlan) {
        const r = await api('strategy', { brief: strategyInput(), mode: 'local', confirmAnalysis: false });
        applyStrategy(r.id ? (await pollJob(r)).result : r);
      }
      state.brief = campaignBrief(strategyInput(), state.strategyPlan);
      return 'Guía local lista';
    });
    await step('director-arte', async () => {
      state.photo = state.photo || photoSlots.map(([k]) => state.photos[k]).find(Boolean);
      await action('generate');
      navigateTo('express');
      if (!state.campaign?.result?.assets?.length) throw Error('Sin imágenes');
      state.selected = state.campaign.result.assets.slice(0, 4).map(a => a.id);
      return state.campaign.result.assets.length + ' propuestas';
    });
    await step('copywriter', async () => {
      if (!state.caption) throw Error('Sin copy');
      return 'Copy + ' + state.selected.length + ' titulares';
    });
    await step('media-buyer', async () => {
      await action('ads:plan');
      if (!state.adsPlan) throw Error('Sin propuesta');
      state.adsStage = 'review';
      return 'Borrador local · PAUSED';
    });
    await step('director-video', async () => {
      state.videoSelected = state.selected.slice(0, 1);
      await action('video:plan');
      if (!state.videoPlan) throw Error('Sin hooks');
      return '3 hooks listos';
    });
    await step('xr-designer', async () => {
      const n = photoSlots.filter(([k]) => state.photos[k]).length;
      if (!n) throw Error('Sin fotos');
      state.xr.checks = null;
      return n + (n === 1 ? ' vista' : ' vistas') + ' en el prisma';
    });
    await step('guardian', async () => {
      await action('refresh-config');
      const gd = state.config?.adsGuard;
      return gd ? (gd.mode === 'remote-paused' ? 'Solo PAUSED verificado' : 'Borrador local · $0') : 'Guardián activo';
    });
    await step('revisor', async () => {
      await action('open:review');
      return state.review ? 'Puntaje ' + state.review.score + '/100' : false;
    });
  } finally {
    state.agents.running = false;
    state.agents.finishedAt = Date.now();
    notice('Tu equipo terminó. Revisa los resultados; nada se publicó ni se activó.');
  }
}

const emit = (type, data = {}) => {
  try {
    window.dispatchEvent(new CustomEvent('studio-event', { detail: { type, data } }));
  } catch {}
};

// ───────── Datos (solo lectura) ─────────
async function refreshFeed() {
  try {
    state.feed = await api('feed');
  } catch {
    state.feed = state.feed || [];
  }
}
let dataTimer = null;
async function refreshData(manual = false) {
  try {
    const [insights, ads] = await Promise.all([api('insights'), api('ads-results').catch(() => null)]);
    state.data = { insights, ads, at: new Date().toISOString() };
    state.dataError = '';
    if (manual) notice(insights.mode === 'live' ? 'Datos actualizados desde Instagram.' : 'Datos de ejemplo: conecta Instagram para ver los reales.');
  } catch (e) {
    state.dataError = 'No se pudieron leer los datos: ' + e.message;
    if (manual) throw e;
  }
}
if (typeof window !== 'undefined')
  dataTimer = setInterval(() => {
    if (state.page === 'data' && !document.hidden) refreshData().catch(() => {});
  }, 180000);
dataTimer?.unref?.();

// ───────── Grabar (cámara del casco → historia o reel) ─────────
let recorder = null,
  recChunks = [];
async function recStart() {
  state.rec = { ...(state.rec || {}), err: '' };
  if (!stream) {
    await startCamera();
    notice('Cámara lista. Toca «Grabar» para empezar.');
    return;
  }
  if (typeof MediaRecorder === 'undefined') throw Error('Este navegador no puede grabar video.');
  const tracks = [...stream.getVideoTracks()];
  try {
    const a = await navigator.mediaDevices.getUserMedia({ audio: true });
    tracks.push(...a.getAudioTracks());
  } catch {
    notice('Sin micrófono: el video saldrá sin sonido.');
  }
  const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const mimeType = types.find(t => MediaRecorder.isTypeSupported(t));
  recChunks = [];
  recorder = new MediaRecorder(new MediaStream(tracks), mimeType ? { mimeType } : undefined);
  recorder.ondataavailable = e => e.data.size && recChunks.push(e.data);
  recorder.onstop = () => tracks.filter(t => t.kind === 'audio').forEach(t => t.stop());
  recorder.start(1000);
  state.rec = { on: true, t0: Date.now(), orient: state.recOrient };
  clearTimeout(recStart.t);
  recStart.t = setTimeout(() => state.rec?.on && recStop().catch(e => notice(e.message)), 60000);
}
async function recStop() {
  if (!recorder || recorder.state === 'inactive') return;
  clearTimeout(recStart.t);
  const done = new Promise(r => recorder.addEventListener('stop', r, { once: true }));
  recorder.stop();
  await done;
  const type = recorder.mimeType || 'video/webm';
  const blob = new Blob(recChunks, { type });
  state.rec = { on: false, busy: true };
  await run(async () => {
    notice('Preparando tu video (conversión a MP4)…');
    const r = await fetch('/api/record', { method: 'POST', headers: { 'Content-Type': type, 'x-orientation': state.recOrient || 'vertical' }, body: blob });
    const j = await r.json();
    if (!r.ok) throw Error(j.error || 'No se pudo guardar el video.');
    const el = document.createElement('video');
    el.src = j.url;
    el.muted = true;
    el.loop = true;
    el.playsInline = true;
    await el.play().catch(() => {});
    state.rec = { url: j.url, id: j.id, el };
    state.caption = state.caption || '';
    state.publishReceipt = null;
    notice('Video listo. Elige cómo publicarlo.');
  });
}
async function recPublish(format) {
  const R = state.rec;
  if (!R?.id) throw Error('Primero graba un video.');
  if (state.mode !== 'live') {
    state.publishReceipt = { simulated: true, message: 'Simulación: en modo real se publicaría como ' + (format === 'reel' ? 'reel' : 'historia') + '.' };
    notice(state.publishReceipt.message);
    return;
  }
  await run(async () => {
    state.connections = await api('connections');
    if (!state.connections.instagram.valid) throw Error(state.connections.instagram.message);
    const r = await api('publish-video', { confirm: true, intentId: crypto.randomUUID(), videoId: R.id, format, caption: state.caption });
    const done = r.id ? await pollJob(r) : r;
    state.publishReceipt = done.result;
    refreshFeed().catch(() => {});
    emit('published', { simulated: false });
    notice(done.result.message);
  });
}

async function guideAction(id) {
  const idx = () => GUIDE_STEPS.indexOf(stepId());
  const go = i => {
    state.gStep = Math.max(0, Math.min(GUIDE_STEPS.length - 1, i));
    state.pageEntered = performance.now();
  };
  const hasAssets = () => !!state.campaign?.result?.assets?.length;
  const afterMake = () => {
    if (state.imgChoice || !hasAssets()) return;
    if (singleKind(state.gKind)) state.selected = state.selected.slice(0, 1);
    go(GUIDE_STEPS.indexOf('pick'));
  };
  const shoot = async () => {
    const slot = photoSlots[idx() - 2]?.[0];
    if (!slot) return;
    if (!state.hudVisible) {
      await action('camera-hud');
      await new Promise(r => setTimeout(r, 400));
    }
    state.captureSlot = slot;
    state.hudReplaceSlot = state.photos[slot] ? slot : null;
    return await action('hud-shutter');
  };
  if (id === 'guide:glass') {
    state.glass3d = state.glass3d === false;
    return;
  }
  if (id === 'guide:advanced') return await action('nav:capture');
  if (id.startsWith('guide:kind:')) {
    state.gKind = id.slice(11);
    state.format = state.gKind;
    return;
  }
  if (id.startsWith('guide:pick:')) {
    const k = id.slice(11);
    state.selected = singleKind(state.gKind) ? [k] : state.selected.includes(k) ? state.selected.filter(x => x !== k) : [...state.selected, k];
    state.confirm = false;
    return;
  }
  if (id === 'guide:example') {
    await action('example:all');
    await action('hud-close');
    state.strategyPlan = null;
    state.ideaPick = null;
    return go(GUIDE_STEPS.indexOf('what'));
  }
  if (id === 'guide:keep') {
    if (photoSlots.every(([s]) => state.photos[s])) return go(GUIDE_STEPS.indexOf('what'));
    state.strategyPlan = null;
    state.ideaPick = null;
    if (!state.hudVisible) await action('camera-hud');
    state.hudChoice = false;
    return go(2 + photoSlots.findIndex(([s]) => !state.photos[s]));
  }
  if (id === 'guide:wipe') {
    await action('photos:clear');
    state.strategyPlan = null;
    state.ideaPick = null;
    await action('camera-hud');
    state.hudChoice = false;
    return go(2);
  }
  if (id === 'guide:shoot') return await shoot();
  if (id === 'guide:ai' || id === 'guide:local') {
    await action(id === 'guide:ai' ? 'img:go:ai' : 'img:go:local');
    return afterMake();
  }
  const sid = stepId();
  if (id === 'guide:back') {
    if (state.busy || state.captureBusy) return;
    if (sid === 'shot0') await action('hud-close');
    if (sid === 'what') await action('hud-close');
    if (sid === 'make') state.imgChoice = false;
    return go(idx() - 1);
  }
  // guide:next
  if (sid === 'start') return go(1);
  if (sid === 'place') {
    state.strategyPlan = null;
    state.ideaPick = null;
    if (!state.hudVisible) await action('camera-hud');
    return go(2);
  }
  if (sid.startsWith('shot')) {
    const i = +sid.slice(4);
    if (!state.photos[photoSlots[i][0]]) return await shoot();
    if (i === 3) {
      await action('hud-close');
      return go(GUIDE_STEPS.indexOf('what'));
    }
    return go(idx() + 1);
  }
  if (sid === 'what') {
    if (!state.gKind) throw Error('Elige qué quieres publicar.');
    go(idx() + 1);
    if (!state.strategyPlan) await action('idea:analyze');
    return;
  }
  if (sid === 'idea') {
    if (state.busy) return;
    if (!state.strategyPlan) return await action('idea:analyze');
    go(GUIDE_STEPS.indexOf('make'));
    await action('idea:create');
    return afterMake();
  }
  if (sid === 'make') {
    if (state.busy) return;
    await action('idea:create');
    return afterMake();
  }
  if (sid === 'pick') {
    if (!state.selected.length) throw Error('Elige al menos una imagen.');
    if (singleKind(state.gKind)) state.selected = state.selected.slice(0, 1);
    return go(idx() + 1);
  }
  if (sid === 'final') {
    state.format = state.gKind;
    if (isVideoKind(state.gKind)) {
      state.videoSelected = state.selected.slice(0, 1);
      return await action('tab:video');
    }
    await action('nav:publish');
    return await action('confirm-publish');
  }
}

export async function action(id) {
  if (id === 'drag') return;
  state.uiTouch = performance.now();
  if (/^(camera-hud|hud-|photo|slot:|nav:|example|idea:|ads:|rec:|data:)/.test(id)) xrlog('action', id);
  try {
    if (state.busy && /^(orientation:|duration:|style:|mode:)/.test(id))
      throw Error('Espera a que termine el trabajo para cambiar estas opciones.');
    if (id.startsWith('guide:')) return await guideAction(id);
    if (id.startsWith('nav:')) {
      state.imgChoice = false;
      if (state.captureBusy) {
        captureSequence++;
        state.captureBusy = false;
        state.captureCountdown = 0;
      }
      let page = id.split(':')[1];
      if (page === 'results' || page === 'review' || page === 'xr') page = 'data';
      if (page === 'express') page = 'strategy';
      if (page === 'brief') page = 'gallery';
      if (page === 'data') refreshData().catch(() => {});
      if (page === 'feed') {
        state.feedOpen = null;
        refreshFeed().catch(() => {});
      }
      if (page !== 'feed') feedFilm.pause?.();
      if (page === 'ads' && !state.selected.length && state.campaign?.result?.assets)
        state.selected = state.campaign.result.assets.slice(0, 4).map(a => a.id);
      if (page === 'video') {
        state.orientation = 'vertical';
        if (!videoAssets().length)
          state.videoSelected = (state.selected.length ? state.selected : state.campaign?.result?.assets.map(a => a.id) || []).slice(0, 1);
      }
      navigateTo(page);
      return;
    }
    if (id === 'photos:done') {
      captureSequence++;
      state.captureBusy = false;
      state.captureCountdown = 0;
      state.hudVisible = false;
      state.hudReviewSlot = null;
      state.hudReplaceSlot = null;
      if (!photoSlots.some(([k]) => state.photos[k])) throw Error('Toma al menos una foto.');
      navigateTo('strategy');
      if (!state.strategyPlan) return await action('idea:analyze');
      return;
    }
    if (id === 'example:all') {
      for (const [slot] of photoSlots) await savePhoto(exampleProduct(), slot);
      return;
    }
    if (id === 'idea:analyze')
      return await run(async () => {
        const live = state.mode === 'live' && !!state.config.paidEnabled && !!state.config.meta;
        state.strategyProduct = '';
        say('redaccion', 'Mirando tus fotos…');
        notice(live ? 'Luma está mirando tus fotos con Muse Spark…' : 'Modo demo: guía local sin IA.');
        const response = await api('strategy', { brief: strategyInput(), mode: live ? 'live' : 'local', confirmAnalysis: live, photos: Object.fromEntries(photoSlots.filter(([s]) => state.photos[s]).map(([s]) => [s, state.photos[s].file])) });
        const saved = response.id ? (await pollJob(response)).result : response;
        applyStrategy(saved);
        if (!state.strategyPlan.seen) state.strategyPlan.seen = 'Modo demo: no se analizan las fotos con IA. Usa «Escribir mi propia idea» para describir el producto.';
        state.ideaPick = null;
        emit('idea_ready');
        notice(live ? 'Listo. Elige de qué quieres la publicación.' : 'Guía local lista. Elige de qué quieres la publicación.');
      });
    if (id.startsWith('idea:pick:')) {
      state.ideaPick = id.slice('idea:pick:'.length);
      return;
    }
    if (id === 'idea:own') {
      state.ideaPick = 'own';
      return await action('edit:ideaOwn');
    }
    if (id === 'idea:create') {
      if (!state.strategyPlan) throw Error('Primero analiza las fotos.');
      const opts = ideaOptions(),
        pick = opts.find(o => o.id === (state.ideaPick || opts[0].id)) || opts[0];
      if (pick.id === 'own' && !String(state.ideaOwn || '').trim()) return await action('idea:own');
      state.strategyTheme = pick.theme.slice(0, 120);
      const input = { ...strategyInput(), theme: state.strategyTheme };
      state.brief = campaignBrief(input, state.strategyPlan, [pick.sub].filter(Boolean).join('. '));
      state.adsTheme = state.strategyTheme;
      // En modo real se elige ANTES de crear: IA (gasta créditos) o local (gratis).
      if (state.mode === 'live' && state.config.paidEnabled) {
        state.imgChoice = true;
        notice('Elige cómo crear las imágenes: con IA (usa créditos) o local (gratis).');
        return;
      }
      return await action('generate');
    }
    if (id === 'img:go:cancel') {
      state.imgChoice = false;
      return;
    }
    if (id === 'img:go:ai' || id === 'img:go:local') {
      state.imageSource = id.endsWith('ai') ? 'ai' : 'local';
      state.imgChoice = false;
      return await action('generate');
    }
    if (id === 'img:source') {
      state.imageSource = state.imageSource === 'ai' ? 'local' : 'ai';
      notice(state.imageSource === 'ai' ? 'Las próximas imágenes se crearán con IA y usan créditos.' : 'Las próximas imágenes serán locales: $0.');
      return;
    }
    if (id === 'lang:toggle') {
      setLangAndDom(getLang() === 'en' ? 'es' : 'en');
      notice(getLang() === 'en' ? 'Language: English.' : 'Idioma: español.');
      return;
    }
    if (id === 'ads:next') {
      state.adsWiz = Math.min(3, (state.adsWiz || 0) + 1);
      if (state.adsWiz >= 2 && (await syncAdsCurrency())) notice('La cuenta de Meta Ads usa ' + state.adsCurrency + ': ajusté el presupuesto a esa moneda. Revísalo.');
      return;
    }
    if (id === 'ads:prev') {
      state.adsWiz = Math.max(0, (state.adsWiz || 0) - 1);
      return;
    }
    if (id === 'ads:again') {
      state.adsDone = null;
      state.adsPlan = null;
      state.adsWiz = 0;
      return;
    }
    if (id === 'ads:open') {
      const u = state.adsDone?.remote?.url;
      if (u) window.open(u, '_blank', 'noopener,noreferrer');
      return;
    }
    if (id.startsWith('ads-piece:')) {
      state.adsPiece = id.split(':')[1];
      state.adsPlan = null;
      return;
    }
    if (id.startsWith('ads:budget:')) {
      const st = budgetStep(state.adsCurrency);
      state.adsBudgetN = Math.max(st, (state.adsBudgetN || st * 4) + (id.endsWith('+') ? st : -st));
      state.adsPlan = null;
      return;
    }
    if (id.startsWith('ads:days:')) {
      state.adsDays = String(Math.min(30, Math.max(1, Number(state.adsDays || 3) + (id.endsWith('+') ? 1 : -1))));
      state.adsPlan = null;
      return;
    }
    if (id === 'ads:plan2')
      return await run(async () => {
        const vid = adsUseVideo();
        if (!selectedAssets().length) throw Error('Elige imágenes para la pauta.');
        if (await syncAdsCurrency()) {
          state.adsWiz = 2;
          throw Error('Tu cuenta de Meta Ads usa ' + state.adsCurrency + '. Ajusté la moneda y el presupuesto: revísalos y vuelve a pulsar «Preparar propuesta».');
        }
        notice(state.mode === 'demo' ? 'Luma prepara una guía local…' : 'Luma revisa tus imágenes y el texto con Muse Spark…');
        const j = await api('ads/plan', {
          campaignId: state.campaign.id,
          selected: state.selected,
          ...(vid ? { videoJobId: state.videoJob } : {}),
          country: state.adsCountry || 'CO',
          city: state.adsCity,
          radius: state.adsRadius || 25,
          goal: ['auto', 'profile', 'awareness'].includes(state.adsGoal) ? state.adsGoal : 'profile',
          dailyBudget: state.adsBudgetN,
          currency: state.adsCurrency || 'COP',
          days: Number(state.adsDays || 3),
          cta: 'VIEW_INSTAGRAM_PROFILE',
          caption: state.caption,
          headlines: (vid ? selectedAssets().slice(0, 1) : selectedAssets()).map(a => ({ assetId: a.id, headline: headlineFor(a) })),
          profileUsername: state.connections?.instagram?.username || '',
          audience: state.adsAudience || state.strategyAudience,
          campaignTheme: state.strategyTheme || state.campaign.result.title
        });
        state.adsPlan = await pollJob(j);
        state.adsPush = null;
        notice('Propuesta lista. Si te gusta, crea el borrador (queda en pausa).');
      });
    if (id === 'ads:csv')
      return await run(async () => {
        if (!state.adsPlan?.result) throw Error('Primero prepara la propuesta.');
        const r = await fetch('/api/ads/export?format=csv&planId=' + encodeURIComponent(state.adsPlan.id));
        if (!r.ok) throw Error('No se pudo preparar el CSV del borrador.');
        const u = URL.createObjectURL(await r.blob());
        const el = document.createElement('a');
        el.href = u;
        el.download = 'pauta-ads-manager-borrador.csv';
        el.click();
        setTimeout(() => URL.revokeObjectURL(u), 5000);
        notice('CSV descargado. Nada se envió ni se activó.');
      });
    if (id === 'ads:send')
      return await run(async () => {
        if (!state.adsPlan?.result) throw Error('Primero prepara la propuesta.');
        {
          // La propuesta debe corresponder a la pieza elegida AHORA (video o esas mismas imágenes); si no, se rehace.
          const planned = (state.adsPlan.result.assets || []).map(a => a.id).sort().join(',');
          const wantVideo = adsUseVideo();
          const now = wantVideo ? 'video' : selectedAssets().map(a => a.id).sort().join(',');
          if ((state.adsPlan.result.pieceType === 'video') !== wantVideo || planned !== now) {
            state.adsPlan = null;
            state.adsWiz = 3;
            throw Error('Cambiaste la pieza (video o imágenes). Vuelve a pulsar «Preparar propuesta con Luma» para que coincida.');
          }
        }
        if (state.mode === 'demo') {
          state.adsDone = { remote: null };
          notice('Borrador guardado en modo demo. Cambia a modo real para crearlo en Meta.');
          return;
        }
        if (await syncAdsCurrency()) {
          state.adsWiz = 2;
          throw Error('Tu cuenta de Meta Ads usa ' + state.adsCurrency + '. Ajusté la moneda y el presupuesto: revísalos y prepara la propuesta de nuevo.');
        }
        if (state.adsPlan.result.brief?.currency && state.adsAccountCurrency && state.adsPlan.result.brief.currency !== state.adsAccountCurrency) {
          state.adsPlan = null;
          state.adsWiz = 2;
          throw Error('La propuesta está en otra moneda que tu cuenta (' + state.adsAccountCurrency + '). Prepárala de nuevo.');
        }
        if (!state.config.adsWriteEnabled) throw Error('El envío a Meta está deshabilitado en el servidor (ENABLE_META_ADS_WRITE).');
        if (!state.config.ads) throw Error('Faltan las credenciales de Meta Ads en el servidor.');
        const preparedImages = [];
        for (const a of state.adsPlan.result.assets) {
          if (a.kind === 'video') continue;
          const im = getImage(a.url);
          if (!im.complete)
            await new Promise((r, e) => {
              im.onload = r;
              im.onerror = e;
            });
          const c = document.createElement('canvas');
          c.width = 1080;
          c.height = 1350;
          const q = c.getContext('2d');
          q.fillStyle = '#17151f';
          q.fillRect(0, 0, 1080, 1350);
          const headline = headlineFor(a);
          campaignImage(q, im, headline, 0, 0, 1080, 1350);
          const saved = await api('upload', { image: c.toDataURL('image/jpeg', 0.94) });
          preparedImages.push({ assetId: a.id, file: saved.file, headline });
        }
        notice('Creando el borrador en Meta (todo en PAUSA)…');
        say('pauta', 'Creando el borrador en PAUSA…');
        const j = await api('ads/push', { confirm: true, intentId: crypto.randomUUID(), planId: state.adsPlan.id, preparedImages });
        try {
          state.adsPush = await pollJob(j);
        } catch (e) {
          state.adsPush = state.job;
          throw Error('Meta no completó la pauta: ' + e.message);
        }
        state.adsDone = { remote: state.adsPush.result.remote };
        notice('Borrador creado en Meta. Está en PAUSA: revísalo en Ads Manager.');
      });
    if (id === 'data:refresh') return await refreshData(true);
    if (id === 'rec:start') return await recStart();
    if (id === 'rec:stop') return await recStop();
    if (id === 'rec:orient') {
      state.recOrient = state.recOrient === 'vertical' ? 'horizontal' : 'vertical';
      notice('Grabarás en formato ' + (state.recOrient === 'vertical' ? 'vertical (9:16)' : 'horizontal') + '.');
      return;
    }
    if (id === 'rec:retake') {
      if (state.rec?.url) URL.revokeObjectURL(state.rec.url);
      state.rec = {};
      state.publishReceipt = null;
      return;
    }
    if (id === 'rec:story' || id === 'rec:reel') return await recPublish(id.endsWith('reel') ? 'reel' : 'story');
    if (id === 'coach-next') {
      const advice = coachAdvice(state);
      if (advice.action) return await action(advice.action);
      return;
    }
    if (id === 'camera-hud') {
      if (state.hudVisible) return await action('hud-close');
      // El panel de la cámara se abre SIEMPRE y al instante; la cámara se conecta en segundo plano (antes, si el permiso
      // quedaba esperando, no pasaba nada y no había ningún mensaje).
      state.hudVisible = true;
      state.hudChoice = state.page !== 'guide' && photoSlots.some(([s]) => state.photos[s]);
      const camTimer = setTimeout(() => {
        if (!stream) notice('La cámara aún no responde. Si el visor pidió permiso, acéptalo; si lo negaste, actívalo en Ajustes del navegador → Permisos del sitio → Cámara.');
      }, 6000);
      startCamera()
        .catch(e => {
          const denied = e?.name === 'NotAllowedError' || e?.name === 'SecurityError' || /denied/i.test(e?.message || '');
          xrlog('camera-error', (e?.name || '') + ' ' + (e?.message || ''));
          notice(denied ? 'La cámara no tiene permiso. Actívalo en Ajustes del navegador → Permisos del sitio → Cámara y toca de nuevo.' : 'La cámara no abrió: ' + (e?.message || 'error'));
        })
        .finally(() => clearTimeout(camTimer));
      state.hudReviewSlot = null;
      // Con las 4 fotos listas, el disparo reemplaza la vista elegida (antes no hacía nada).
      state.hudReplaceSlot = photoSlots.every(([s]) => state.photos[s]) ? state.captureSlot : null;
      state.hudPinned = true;
      notice('Cámara frente a ti. Agárrala con pinza para moverla y girarla. Elige conteo o foto inmediata antes de disparar.');
      return;
    }
    if (id === 'hud-keep') {
      state.hudChoice = false;
      if (photoSlots.every(([s]) => state.photos[s])) {
        state.hudReplaceSlot = null;
        notice('Usaremos tus 4 fotos. Toca «Analizar mis fotos con IA».');
        return await action('hud-close');
      }
      state.captureSlot = photoSlots.find(([s]) => !state.photos[s])[0];
      state.hudReplaceSlot = null;
      return;
    }
    if (id === 'hud-clearall') {
      await action('photos:clear');
      state.hudChoice = false;
      state.hudReplaceSlot = null;
      return await action('camera-hud');
    }
    if (id === 'hud-close') {
      state.hudChoice = false;
      captureSequence++;
      state.captureBusy = false;
      state.captureCountdown = 0;
      state.hudVisible = false;
      state.hudReviewSlot = null;
      return;
    }
    if (id === 'hud-continue') {
      captureSequence++;
      state.captureBusy = false;
      state.captureCountdown = 0;
      state.hudVisible = false;
      state.hudReviewSlot = null;
      state.hudReplaceSlot = null;
      navigateTo('strategy');
      notice('Cámara cerrada. Ahora Luma propone la campaña viendo tus fotos.');
      return;
    }
    if (id === 'hud-recenter') {
      window.dispatchEvent(new Event('xr-camera-recenter'));
      return;
    }
    if (id === 'hud-live') {
      state.hudReviewSlot = null;
      state.hudReplaceSlot = null;
      return;
    }
    if (id.startsWith('hud-view:')) {
      if (state.captureBusy || state.busy) return;
      const slot = id.split(':')[1];
      if (!photoSlots.some(([s]) => s === slot)) return;
      state.captureSlot = slot;
      state.hudReviewSlot = state.photos[slot] ? slot : null;
      state.hudReplaceSlot = null;
      return;
    }
    if (id.startsWith('hud-delete:'))
      return await run(async () => {
        if (state.captureBusy) return;
        const slot = id.split(':')[1];
        const saved = await api('photos', { slot, remove: true });
        state.photos = { front: saved.front, right: saved.right || null, left: saved.left || null, back: saved.back };
        state.photo = state.photos.front || state.photos.right || state.photos.left || state.photos.back;
        state.captureSlot = slot;
        state.hudReviewSlot = null;
        state.hudReplaceSlot = null;
        notice(
          'Vista ' +
            photoSlots.find(([s]) => s === slot)[1].toLowerCase() +
            ' liberada. Pulsa Tomar foto para repetirla con cuenta regresiva.'
        );
      });
    if (id === 'hud-retake') {
      if (state.hudReviewSlot) {
        state.captureSlot = state.hudReviewSlot;
        state.hudReplaceSlot = state.hudReviewSlot;
        state.hudReviewSlot = null;
      }
      return;
    }
    if (id === 'hud-shutter') {
      if (
        !state.hudVisible ||
        state.captureBusy ||
        state.busy ||
        state.hudReviewSlot ||
        state.pendingCapture ||
        performance.now() - lastHudShutterAt < 900
      )
        return;
      const slot = state.hudReplaceSlot || photoSlots.find(([s]) => !state.photos[s])?.[0];
      if (!slot) {
        notice('Las cuatro fotos están listas. Abre una miniatura para repetirla o usa × para liberar su lugar.');
        return;
      }
      state.captureSlot = slot;
      lastHudShutterAt = performance.now();
      return await prepareCapture({ autoSave: true, timer: state.captureTimer });
    }
    if (id === 'strategy:data') {
      state.strategyStage = 'data';
      return;
    }
    if (id === 'strategy:back' || id === 'strategy:edit') {
      state.strategyStage = 'brief';
      return;
    }
    if (id.startsWith('strategy-goal:')) {
      state.strategyObjective = id.split(':')[1];
      state.strategyPlan = null;
      return;
    }
    if (id.startsWith('strategy-tab:')) {
      state.strategyReviewTab = id.split(':')[1];
      return;
    }
    if (id === 'strategy:local' || id === 'strategy:analyze')
      return await run(async () => {
        const live = id === 'strategy:analyze';
        const response = await api('strategy', { brief: strategyInput(), mode: live ? 'live' : 'local', confirmAnalysis: live, photos: Object.fromEntries(photoSlots.filter(([s]) => state.photos[s]).map(([s]) => [s, state.photos[s].file])) });
        const saved = response.id ? (await pollJob(response)).result : response;
        applyStrategy(saved);
        emit('idea_ready');
        notice(
          live
            ? 'Luma preparó la estrategia con Muse Spark. Revisa la propuesta.'
            : 'Guía local guardada. No se hizo ninguna llamada a la IA.'
        );
      });
    if (id === 'strategy:continue') {
      if (!state.strategyPlan) throw Error('Prepara primero la guía de campaña.');
      const input = strategyInput();
      state.brief = campaignBrief(input, state.strategyPlan);
      state.adsAudience = input.audience;
      state.adsTheme = input.theme;
      navigateTo('brief');
      notice('Idea aprobada. Ahora creamos las imágenes de la campaña a partir de tus fotos.');
      return;
    }
    if (id === 'capture-timer') {
      if (state.captureBusy) return;
      state.captureTimer = state.captureTimer ? 0 : 3;
      return;
    }
    if (id === 'capture-retake') {
      if (state.pendingCapture) imageCache.delete(state.pendingCapture.url);
      state.pendingCapture = null;
      notice('Reencuadra el producto. La toma anterior no se guardó.');
      return;
    }
    if (id === 'capture-save')
      return await run(async () => {
        const pending = state.pendingCapture;
        if (!pending) throw Error('Toma una foto primero.');
        await savePhoto(pending.url, pending.slot);
        imageCache.delete(pending.url);
        state.pendingCapture = null;
      });
    if (id === 'toggle-assistant') {
      state.assistantVisible = !state.assistantVisible;
      notice(state.assistantVisible ? 'Luma vuelve a acompañarte.' : 'Asistente 3D oculto; las funciones del estudio siguen disponibles.');
      return;
    }
    if (id === 'toggle-motion') {
      state.reducedMotion = !state.reducedMotion;
      notice(state.reducedMotion ? 'Movimiento reducido activado.' : 'Animaciones suaves activadas.');
      return;
    }
    if (id.startsWith('slot:')) {
      if (state.pendingCapture || state.captureBusy) return;
      state.captureSlot = id.split(':')[1];
      notice(
        `Vista ${photoSlots.find(([s]) => s === state.captureSlot)[1].toLowerCase()} seleccionada. Toma una foto para guardarla o reemplazarla.`
      );
      if (state.photos[state.captureSlot] && !state.hudVisible) {
        await action('camera-hud');
        state.hudChoice = false;
        return;
      }
      if (state.photos[state.captureSlot] && state.hudVisible) state.hudReplaceSlot = state.captureSlot;
      return;
    }
    if (id.startsWith('photo:del:'))
      return await action('hud-delete:' + id.split(':')[2]);
    if (id === 'photos:clear')
      return await run(async () => {
        if (state.captureBusy) return;
        let saved;
        for (const [slot] of photoSlots) saved = await api('photos', { slot, remove: true });
        state.photos = { front: saved.front, right: saved.right || null, left: saved.left || null, back: saved.back };
        state.photo = null;
        state.captureSlot = 'front';
        state.hudVisible = false;
        state.hudReplaceSlot = null;
        state.strategyPlan = null;
        state.ideaPick = null;
        notice('Fotos quitadas. Toma las 4 de nuevo.');
      });
    if (id.startsWith('edit:')) {
      const key = id.split(':')[1],
        asset = key === 'headline' ? selectedAssets()[state.index % selectedAssets().length] : null;
      state.keyboard = {
        key,
        assetId: asset?.id,
        label: {
          strategyProduct: 'Producto o negocio',
          strategyTheme: 'Temática de campaña',
          strategyAudience: 'Público de la campaña',
          strategyPositioning: 'Qué diferencia tu marca',
          strategyMetricsImpressions: 'Impresiones del periodo',
          strategyMetricsVisits: 'Visitas al perfil del periodo',
          strategyMetricsFollows: 'Seguidores obtenidos en el periodo',
          brief: 'Encargo creativo',
          caption: 'Texto de publicación',
          headline: 'Titular sobre esta imagen',
          videoPrompt: 'Dirección del video',
          adsCity: 'Ciudad',
          adsCountry: 'País',
          adsBudget: 'Tope diario opcional',
          adsDays: 'Duración en días',
          adsTheme: 'Temática de pauta',
          adsAudience: 'Público deseado',
          ideaOwn: 'Tu idea para la publicación'
        }[key],
        value: asset ? headlineFor(asset) : state[key],
        shift: false
      };
      return;
    }
    if (id.startsWith('key:')) {
      const k = state.keyboard;
      if (!k) return;
      const key = id.slice(4);
      if (key === 'done') {
        if (k.key === 'headline') state.headlines[k.assetId] = k.value.trim().slice(0, 72);
        else state[k.key] = k.value.slice(0, k.key === 'caption' ? 2200 : 4000);
        if (k.key.startsWith('strategy')) state.strategyPlan = null;
        if (k.key.startsWith('ads')) state.adsPlan = null;
        state.confirm = false;
        state.keyboard = null;
      } else if (key === 'back') k.value = k.value.slice(0, -1);
      else if (key === 'space') k.value += ' ';
      else if (key === 'shift') k.shift = !k.shift;
      else if (k.value.length < (k.key === 'headline' ? 72 : 4000)) k.value += k.shift ? key.toUpperCase() : key;
      return;
    }
    if (id === 'mode:toggle') return await action(state.mode === 'demo' ? 'mode:live' : 'mode:demo');
    if (id.startsWith('mode:')) {
      const mode = id.split(':')[1];
      if (mode === 'live' && !state.config.paidEnabled)
        throw Error('Las APIs con costo están bloqueadas en el servidor mientras probamos el Demo.');
      if (mode === 'live' && !state.config.meta) throw Error('Primero añade MODEL_API_KEY a .env y reinicia el servidor.');
      if (state.busy) throw Error('Espera a que termine el trabajo actual.');
      if (state.campaign && state.mode !== mode) {
        state.campaign = null;
        state.selected = [];
        state.video = null;
        film.removeAttribute('src');
      }
      state.mode = mode;
      notice(
        mode === 'demo'
          ? 'Modo demo. Ninguna generación ni publicación real.'
          : 'Modo real. Crear campaña llamará a Meta con tus credenciales.'
      );
      return;
    }
    if (id.startsWith('select:')) {
      const key = id.slice(7);
      state.selected = state.selected.includes(key) ? state.selected.filter(x => x !== key) : [...state.selected, key];
      state.confirm = false;
      return;
    }
    if (id.startsWith('focus:')) {
      state.index = +id.split(':')[1];
      return;
    }
    if (id === 'select-all') {
      state.selected = state.campaign.result.assets.map(a => a.id);
      return;
    }
    if (id === 'preview-prev' || id === 'preview-next') {
      const n = selectedAssets().length;
      if (n) state.index = (state.index + (id === 'preview-next' ? 1 : -1) + n) % n;
      return;
    }
    if (id === 'prev' || id === 'next') {
      const n = state.campaign?.result?.assets.length || 1;
      state.index = (state.index + (id === 'next' ? 1 : -1) + n) % n;
      return;
    }
    if (id.startsWith('publish-focus:')) {
      state.index = Number(id.split(':')[1]);
      return;
    }
    if (id.startsWith('publish-move:')) {
      const index = state.index % state.selected.length,
        next = index + (id.endsWith('left') ? -1 : 1);
      if (next >= 0 && next < state.selected.length) {
        [state.selected[index], state.selected[next]] = [state.selected[next], state.selected[index]];
        state.index = next;
        state.confirm = false;
      }
      return;
    }
    if (id.startsWith('format:')) {
      state.format = id.split(':')[1];
      state.confirm = false;
      return;
    }
    if (id.startsWith('ads-currency:')) {
      const cur = id.split(':')[1];
      if (cur !== state.adsCurrency) state.adsBudgetN = cur === 'USD' ? 5 : 20000;
      state.adsCurrency = cur;
      state.adsPlan = null;
      return;
    }
    if (id.startsWith('ads-radius:')) {
      state.adsRadius = Number(id.split(':')[1]);
      return;
    }
    if (id.startsWith('ads-goal:')) {
      state.adsGoal = id.split(':')[1];
      return;
    }
    if (id.startsWith('ads-cta:')) {
      state.adsCta = id.split(':')[1];
      return;
    }
    if (id.startsWith('ads-tab:')) {
      state.adsReviewTab = id.split(':')[1];
      return;
    }
    if (id === 'ads:next') {
      state.adsStage = 'setup';
      return;
    }
    if (id.startsWith('ads-source:')) {
      const s = state.adsPlan?.result?.recommendation?.sources?.[Number(id.split(':')[1])];
      if (s?.url) window.open(s.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (id === 'ads:back') {
      state.adsStage = 'setup';
      return;
    }
    if (id === 'ads:review') {
      state.adsStage = 'review';
      return;
    }
    if (id === 'open-publication') {
      if (state.publishReceipt?.permalink) window.open(state.publishReceipt.permalink, '_blank', 'noopener,noreferrer');
      return;
    }
    if (id === 'new-publication') {
      state.publishReceipt = null;
      state.confirm = false;
      return;
    }
    if (id === 'ads:preview') {
      if (!state.config.adsWriteEnabled) throw Error('El envío a Meta está deshabilitado. Tu borrador queda local.');
      if (!state.adsPlan?.result) throw Error('Crea y revisa la propuesta local primero.');
      state.adsStage = 'remote-confirm';
      return;
    }
    if (id === 'ads:export') {
      if (!state.adsPlan?.result) throw Error('Prepara una propuesta primero.');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(state.adsPlan.result, null, 2)], { type: 'application/json' }));
      a.download = 'pauta-luma-borrador.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      notice('Borrador descargado. No se envió ni activó ningún anuncio.');
      return;
    }
    if (id === 'ads:plan')
      return await run(async () => {
        if (!selectedAssets().length) throw Error('Elige imágenes para la pauta.');
        notice(
          state.mode === 'demo' ? 'Luma preparando una guía local de prueba…' : 'Luma analizará tus imágenes y el copy con Muse Spark…'
        );
        const j = await api('ads/plan', {
          campaignId: state.campaign.id,
          selected: state.selected,
          country: state.adsCountry || 'CO',
          city: state.adsCity,
          radius: state.adsRadius || 25,
          goal: ['auto', 'profile', 'awareness'].includes(state.adsGoal) ? state.adsGoal : 'auto',
          dailyBudget: state.adsBudget,
          currency: state.adsCurrency || 'COP',
          days: 3,
          cta: 'VIEW_INSTAGRAM_PROFILE',
          caption: state.caption,
          headlines: selectedAssets().map(a => ({ assetId: a.id, headline: headlineFor(a) })),
          profileUsername: state.connections?.instagram?.username || '',
          audience: state.strategyAudience,
          campaignTheme: state.strategyTheme || state.campaign.result.title
        });
        state.adsPlan = await pollJob(j);
        state.adsPush = null;
        state.adsStage = 'review';
        state.adsReviewTab = 'idea';
        notice(
          state.mode === 'demo'
            ? 'Guía demo guardada sin IA ni anuncios en Meta.'
            : 'Luma guardó la propuesta. Revisa estrategia, público, presupuesto y piezas. No se creó ningún anuncio.'
        );
      });
    if (id === 'ads:confirm')
      return await run(async () => {
        if (state.adsStage !== 'remote-confirm') throw Error('Revisa primero la propuesta de pauta.');
        if (!state.config.ads) throw Error('Configura Meta Marketing API en .env.');
        const preparedImages = [];
        for (const a of state.adsPlan.result.assets) {
          const im = getImage(a.url);
          if (!im.complete)
            await new Promise((r, e) => {
              im.onload = r;
              im.onerror = e;
            });
          if (!im.naturalWidth) throw Error('No se pudo leer una imagen.');
          const c = document.createElement('canvas');
          c.width = 1080;
          c.height = 1350;
          const q = c.getContext('2d');
          q.fillStyle = '#17151f';
          q.fillRect(0, 0, 1080, 1350);
          const headline = headlineFor(a);
          campaignImage(q, im, headline, 0, 0, 1080, 1350);
          const saved = await api('upload', { image: c.toDataURL('image/jpeg', 0.94) });
          preparedImages.push({ assetId: a.id, file: saved.file, headline });
        }
        say('pauta', 'Creando el borrador en PAUSA…');
        const j = await api('ads/push', { confirm: true, intentId: crypto.randomUUID(), planId: state.adsPlan.id, preparedImages });
        try {
          state.adsPush = await pollJob(j);
        } catch (e) {
          state.adsPush = state.job;
          state.adsStage = 'review';
          throw Error('Meta no completó la pauta. Revisa los ID de campaña, conjunto y anuncios guardados antes de repetir. ' + e.message);
        }
        state.adsPlan.result.remote = state.adsPush.result.remote;
        state.adsStage = 'review';
        notice('Meta Ads guardó campaña, conjunto y anuncios pausados. Revisa en Ads Manager antes de activar.');
      });
    if (id === 'strategy:express') {
      if (!state.strategyPlan) {
        await action('strategy:local');
        if (!state.strategyPlan) return;
      }
      return await action('strategy:continue');
    }
    if (id === 'autopilot') {
      if (!photoSlots.some(([k]) => state.photos[k])) throw Error('Guarda al menos una foto antes de crear.');
      state.confirmAutopilot = true;
      notice('Confirma para que mi equipo trabaje. Nada se publica ni se activa.');
      return;
    }
    if (id === 'autopilot:cancel') {
      state.confirmAutopilot = false;
      return;
    }
    if (id === 'agents:reset') {
      state.agents = { running: false, steps: [], startedAt: 0, finishedAt: 0 };
      state.confirmAutopilot = false;
      return;
    }
    if (id === 'autopilot:go') return await runAgents();
    if (id === 'open:review')
      return await run(async () => {
        const assets = state.campaign?.result?.assets || [];
        state.review = await api('agent/review', {
          caption: state.caption,
          headlines: selectedAssets().length ? selectedAssets().map(headlineFor) : assets.map(headlineFor),
          mode: state.mode,
          planId: state.adsPlan?.id,
          hasVideo: !!state.video,
          photos: photoSlots.filter(([k]) => state.photos[k]).length,
          assetCount: assets.length,
          aiGenerated: state.mode !== 'demo'
        });
        notice(`Revisión ${state.review.score}/100 · ${state.review.verdict}. Gratis, sin llamadas a la IA.`);
      });
    if (id === 'xr:rotate') {
      state.xr.autoRotate = !state.xr.autoRotate;
      return;
    }
    if (id === 'xr:open') {
      window.open('/xr-ad.html', '_blank');
      notice('Abrí el anuncio XR en otra pestaña. Funciona en escritorio y, en las gafas, con «Entrar en AR».');
      return;
    }
    if (id === 'xr:export') {
      const a = document.createElement('a');
      a.href = '/api/xr-ad/bundle';
      a.download = 'anuncio-xr-aumentados.json';
      a.click();
      notice('Paquete del anuncio XR descargado. No usa IA ni cuesta nada.');
      return;
    }
    if (id.startsWith('orientation:')) {
      state.orientation = 'vertical';
      return;
    }
    if (id.startsWith('duration:')) {
      state.duration = +id.split(':')[1];
      state.videoPlan = null;
      state.video = null;
      return;
    }
    if (id.startsWith('style:')) {
      state.style = id.split(':')[1];
      return;
    }
    if (id === 'theme:halloween') {
      state.brief =
        'Crea una campaña de Halloween para este producto. Imágenes cinematográficas coherentes: producto protagonista, lifestyle y set editorial. Sin precios ni descuentos.';
      return;
    }
    if (id === 'theme:premium') {
      state.brief += ' Dirección premium: materiales cuidados, luz cinematográfica y composición editorial.';
      return;
    }
    if (id === 'recenter') {
      window.dispatchEvent(new Event('xr-recenter'));
      notice('Paneles recentrados. Puedes mover cada cabecera con pinza.');
      return;
    }
    if (id === 'exit-xr') {
      window.dispatchEvent(new Event('xr-exit'));
      return;
    }
    if (id === 'camera') return await startCamera({ switchDevice: !!stream });
    if (id === 'stop-camera') {
      if (state.captureBusy) {
        captureSequence++;
        state.captureBusy = false;
        state.captureCountdown = 0;
        notice('Cuenta atrás cancelada. Puedes volver a encuadrar.');
        return;
      }
      stream?.getTracks().forEach(t => t.stop());
      stream = null;
      camera.srcObject = null;
      notice('Cámara detenida. Tus fotos siguen guardadas.');
      return;
    }
    if (id === 'example') return await savePhoto(exampleProduct(), 'front');
    if (id === 'capture') return await prepareCapture();
    if (id === 'generate')
      return await run(async () => {
        if (!state.photo) throw Error('Captura un producto primero.');
        const generation = ++requestGeneration;
        state.selected = [];
        state.videoSelected = [];
        state.videoPlan = null;
        state.headlines = {};
        state.video = null;
        state.campaign = null;
        state.publishReceipt = null;
        say('taller', 'Creando tus imágenes…');
        notice(state.mode === 'demo' ? 'Preparando composiciones gráficas de demostración…' : 'Enviando tus vistas y encargo a Meta…');
        const localAssets = state.mode === 'live' && state.imageSource !== 'ai';
        const demoAssets = state.mode === 'demo' || localAssets ? await Promise.all([0, 1, 2, 3].map(i => demoArtwork(state.photo, i, state.strategyTheme || 'Tu campaña', localAssets))) : undefined;
        const j = await api('campaign', {
          mode: state.mode,
          localAssets,
          theme: state.strategyTheme || '',
          product: state.strategyPlan?.seen || state.strategyProduct || '',
          photo: state.photo.file,
          photos: Object.fromEntries(photoSlots.filter(([s]) => state.photos[s]).map(([s]) => [s, state.photos[s].file])),
          brief: state.brief,
          demoAssets
        });
        state.page = state.page === 'guide' ? 'guide' : 'gallery';
        const done = await pollJob(j);
        if (generation !== requestGeneration) return;
        state.campaign = done;
        state.selected = done.result.assets.map(a => a.id);
        state.caption = done.result.caption;
        state.videoPrompt = done.result.videoPrompt || state.videoPrompt;
        state.index = 0;
        notice(
          state.mode === 'demo'
            ? '4 composiciones demo listas. Elige tus favoritas.'
            : 'Campaña generada. Revisa identidad del producto, titulares y copy antes de publicar.'
        );
      });
    if (id.startsWith('record:')) {
      if (state.recording) return await stopRecording();
      return await startRecording(id.split(':')[1]);
    }
    if (id.startsWith('video-select:')) {
      if (state.busy) return;
      const key = id.slice(13);
      state.videoSelected = [key]; // una sola publicación: de esa se crea el video
      state.videoWatch = false;
      state.videoPlan = null;
      return;
    }
    if (id === 'sheet:redo') {
      state.videoSheetLayout = ((state.videoSheetLayout || 0) + 1) % SHEET_LAYOUTS.length;
      state.videoSheet = null;
      ensureVideoSheet();
      notice('Hoja de producto recreada (diseño ' + (state.videoSheetLayout + 1) + ' de ' + SHEET_LAYOUTS.length + ').');
      return;
    }
    if (id === 'video:promptview') {
      state.videoPromptView = !state.videoPromptView;
      return;
    }
    if (id === 'video:replan') {
      state.videoWatch = false;
      state.videoPlan = null;
      return;
    }
    if (id.startsWith('video-hook:')) {
      state.videoHookIndex = Number(id.split(':')[1]);
      return;
    }
    if (id === 'video-source') {
      const r = state.videoPlan?.result,
        h = r?.hooks[state.videoHookIndex],
        source = r?.sources.find(s => h.sourceUrls.includes(s.url));
      if (source) window.open(source.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (id === 'video:plan')
      return await run(async () => {
        if (!videoAssets().length) throw Error('Elige cuál de las imágenes quieres animar.');
        const j = await api('video/plan', {
          campaignId: state.campaign.id,
          selected: videoAssets().map(a => a.id),
          duration: state.duration,
          caption: state.caption,
          instruction: state.videoPrompt,
          sheet: sheetOn() && !!ensureVideoSheet()
        });
        state.videoPlan = await pollJob(j);
        state.videoHookIndex = 0;
        notice(
          state.mode === 'demo'
            ? 'Tres ideas demo listas, sin investigación web.'
            : 'Luma preparó tres hooks con fuentes. Revisa uno antes de generar el video.'
        );
      });
    if (id === 'video:publish') {
      if (!state.video) throw Error('Primero termina y revisa el video.');
      state.videoWatch = false;
      state.selected = videoAssets().map(a => a.id);
      state.format = 'reel';
      state.caption = state.video.caption || state.videoPlan?.result?.hooks[state.videoHookIndex]?.copy || state.caption;
      navigateTo('publish');
      return;
    }
    if (id === 'generate-video')
      return await run(async () => {
        if (!state.videoPlan?.result) throw Error('Pide a Luma las propuestas y elige una antes de crear el video.');
        if (!videoAssets().length) throw Error('Selecciona imágenes primero.');
        state.video = null;
        state.orientation = 'vertical';
        if (state.mode === 'demo') {
          notice('Grabando animación local de prueba, sin generar con IA…');
          await demoVideo();
          notice('Video demo listo; no se envió nada al proveedor de video.');
        } else {
          if (!(state.config.videoReady ?? state.config.kling)) throw Error('Falta la clave del proveedor de video (FAL_KEY o KLING_API_KEY) en el servidor.');
          const preparedImages = [];
          for (const a of videoAssets()) {
            const im = getImage(a.url);
            if (!im.complete)
              await new Promise((r, e) => {
                im.onload = r;
                im.onerror = e;
              });
            if (im.naturalWidth < 300 || im.naturalHeight < 300) throw Error('El modelo de video necesita imágenes de al menos 300 píxeles por lado.');
            const ratio = im.naturalWidth / im.naturalHeight;
            if (ratio < 0.4 || ratio > 2.5) throw Error('La proporción de esta referencia no es compatible con el modelo de video.');
            const c = document.createElement('canvas'),
              scale = Math.min(1, 1400 / Math.max(im.naturalWidth, im.naturalHeight));
            c.width = Math.round(im.naturalWidth * scale);
            c.height = Math.round(im.naturalHeight * scale);
            c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
            const saved = await api('upload', { image: c.toDataURL('image/jpeg', 0.92) });
            preparedImages.push({ assetId: a.id, file: saved.file });
          }
          let sheetFile = '';
          if (state.videoPlan.result.sheet && sheetOn()) {
            const sc = ensureVideoSheet();
            if (!sc) throw Error('La hoja del producto no está lista. Toma las 4 fotos o toca «Crear hoja de nuevo».');
            sheetFile = (await api('upload', { image: sc.toDataURL('image/jpeg', 0.92) })).file;
          }
          const j = await api('video', {
            campaignId: state.campaign.id,
            sheetFile,
            selected: videoAssets().map(a => a.id),
            videoPlanId: state.videoPlan.id,
            hookId: state.videoPlan.result.hooks[state.videoHookIndex].id,
            preparedImages,
            duration: state.duration,
            orientation: 'vertical',
            style: state.style,
            prompt: state.videoPrompt,
            caption: state.caption
          });
          const done = await pollJob(j);
          state.video = done.result;
          state.videoJob = done.id;
          film.src = done.result.url;
          film.load();
          await film.play().catch(() => {});
          // Video listo: pasamos directo a Publicar con el Reel ya armado (no hay que pulsar nada más).
          state.selected = videoAssets().map(a => a.id);
          state.format = 'reel';
          state.caption = done.result.caption || state.videoPlan?.result?.hooks[state.videoHookIndex]?.copy || state.caption;
          state.videoWatch = true;
          film.currentTime = 0;
          notice('Video de ' + videoModelName() + ' listo con sonido. Míralo aquí; si te gusta, pulsa «Revisar y publicar».');
        }
      });
    if (id.startsWith('feed:')) {
      const items = state.feed || [];
      if (id.startsWith('feed:open:')) {
        const it = items.find(x => x.id === id.slice(10));
        state.feedOpen = it?.id || null;
        feedFilm.pause?.();
        if (it?.video) {
          feedFilm.src = it.video;
          feedFilm.load();
          feedFilm.currentTime = 0;
          feedFilm.play().catch(() => {});
        }
        return;
      }
      if (id === 'feed:close') {
        feedFilm.pause?.();
        state.feedOpen = null;
        return;
      }
      if (id === 'feed:prev' || id === 'feed:next') {
        state.feedPage = Math.max(0, (state.feedPage || 0) + (id === 'feed:next' ? 1 : -1));
        return;
      }
      if (id === 'feed:play') {
        if (feedFilm.paused) await feedFilm.play().catch(e => notice('No se pudo reproducir: ' + e.message));
        else feedFilm.pause?.();
        return;
      }
      if (id === 'feed:sound') {
        feedFilm.muted = !feedFilm.muted;
        if (!feedFilm.muted && feedFilm.paused) await feedFilm.play().catch(() => {});
        return;
      }
      if (id === 'feed:ig') {
        const u = items.find(x => x.id === state.feedOpen)?.permalink;
        if (u) window.open(u, '_blank', 'noopener,noreferrer');
        return;
      }
      return;
    }
    if (id === 'play-video') {
      if (!state.video) throw Error('Primero crea un video.');
      if (film.paused) await film.play().catch(e => notice('⚠ No se pudo reproducir: ' + e.message));
      else film.pause();
      return;
    }
    if (id === 'tab:images') {
      if (isVideoFormat()) state.format = 'carousel';
      state.confirm = false;
      navigateTo('publish');
      return;
    }
    if (id === 'tab:video') {
      state.videoWatch = !!state.video;
      state.confirm = false;
      navigateTo('video');
      return;
    }
    if (id === 'video:publish-story') {
      if (!state.video) throw Error('Primero termina el video.');
      state.videoWatch = false;
      state.selected = videoAssets().map(a => a.id);
      state.format = 'storyvideo';
      state.caption = state.video.caption || state.videoPlan?.result?.hooks[state.videoHookIndex]?.copy || state.caption;
      navigateTo('publish');
      return;
    }
    if (id === 'video:watch') {
      if (!state.video) throw Error('Todavía no hay video creado.');
      state.videoWatch = true;
      if (state.page !== 'video') navigateTo('video');
      film.currentTime = 0;
      await film.play().catch(() => {});
      return;
    }
    if (id === 'watch:back') {
      state.videoWatch = false;
      return;
    }
    if (id === 'video:sound') {
      film.muted = !film.muted;
      if (!film.muted && film.paused) await film.play().catch(() => {});
      notice(film.muted ? 'Video sin sonido en la vista previa. El archivo conserva su audio.' : 'Sonido encendido en la vista previa.');
      return;
    }
    if (id === 'confirm-publish') {
      if (isVideoFormat() && !state.video) throw Error('Crea un video primero.');
      if (state.mode === 'live') {
        state.connections = await api('connections');
        if (!state.connections.instagram.valid) throw Error(state.connections.instagram.message);
      }
      state.confirm = true;
      notice(
        state.mode === 'demo'
          ? 'Confirmar simulará la publicación; nada se enviará a Instagram.'
          : 'Revisa la imagen/video y el texto. «Sí, publicar en Instagram» enviará la publicación real.'
      );
      return;
    }
    if (id === 'cancel-publish') {
      state.confirm = false;
      return;
    }
    if (id === 'publish')
      return await run(async () => {
        if (!state.confirm) throw Error('Abre la confirmación de publicación primero.');
        if (state.mode === 'live') {
          state.connections = await api('connections');
          if (!state.connections.instagram.valid) throw Error(state.connections.instagram.message);
        }
        state.confirm = false;
        const preparedImages = [];
        if (state.mode === 'live' && !isVideoFormat()) {
          notice('Preparando JPEG con los titulares en el formato de publicación…');
          for (const a of selectedAssets()) {
            const im = getImage(a.url);
            if (!im.complete)
              await new Promise((r, e) => {
                im.onload = r;
                im.onerror = e;
              });
            if (!im.naturalWidth) throw Error('No se pudo leer una imagen seleccionada.');
            const c = document.createElement('canvas');
            c.width = 1080;
            c.height = state.format === 'story' ? 1920 : 1350;
            const q = c.getContext('2d');
            q.fillStyle = '#17151f';
            q.fillRect(0, 0, c.width, c.height);
            campaignImage(q, im, headlineFor(a), 0, 0, c.width, c.height);
            const p = await api('upload', { image: c.toDataURL('image/jpeg', 0.94) });
            preparedImages.push({ assetId: a.id, file: p.file });
          }
        }
        say('revision', 'Publicando…');
        const r = await api('publish', {
          confirm: true,
          intentId: crypto.randomUUID(),
          campaignId: state.campaign.id,
          selected: state.selected,
          format: state.format === 'storyvideo' ? 'story' : state.format,
          asVideo: state.format === 'storyvideo',
          videoId: state.videoJob,
          caption: state.caption,
          preparedImages
        });
        const done = r.id ? await pollJob(r) : r;
        state.publishReceipt = done.result;
        refreshFeed().catch(() => {});
        emit('published', { simulated: !!done.result?.simulated });
        notice(done.result.message + (done.result.id ? ' · ID ' + done.result.id : ''));
      });
    if (id === 'refresh-config') {
      state.config = await api('config');
      state.connections = await api('connections');
      notice(state.connections.instagram.message + ' ' + state.connections.ads.message);
      return;
    }
  } catch (e) {
    notice('⚠ ' + e.message);
  }
}

async function startRecording(key) {
  if (!state.config.meta || !state.config.paidEnabled)
    throw Error('Dictado con Meta está bloqueado durante el Demo. Puedes escribir con el teclado virtual sin salir de AR.');
  const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ac = new AudioContext(),
    source = ac.createMediaStreamSource(audio),
    processor = ac.createScriptProcessor(4096, 1, 1),
    silence = ac.createGain();
  silence.gain.value = 0;
  const chunks = [];
  processor.onaudioprocess = e => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  source.connect(processor);
  processor.connect(silence);
  silence.connect(ac.destination);
  record = { audio, ac, source, processor, silence, chunks, key, timer: setTimeout(() => stopRecording(), 45000) };
  say('luma', 'Te escucho…');
  state.recording = true;
  notice('Escuchando. Pulsa Terminar dictado cuando acabes.');
}
function voiceWav(chunks, sourceRate) {
  const input = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    input.set(c, offset);
    offset += c.length;
  }
  const rate = 24000,
    count = Math.floor((input.length * rate) / sourceRate),
    buf = new ArrayBuffer(44 + count * 2),
    v = new DataView(buf);
  const str = (o, t) => [...t].forEach((s, i) => v.setUint8(o + i, s.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + count * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const at = (i * sourceRate) / rate,
      low = Math.floor(at),
      f = at - low,
      sample = input[low] * (1 - f) + (input[Math.min(low + 1, input.length - 1)] || 0) * f;
    v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}
async function stopRecording() {
  if (!record) return;
  const r = record;
  record = null;
  clearTimeout(r.timer);
  say('luma', 'Listo, transcribiendo…');
  state.recording = false;
  r.processor.disconnect();
  r.source.disconnect();
  r.audio.getTracks().forEach(t => t.stop());
  const sr = r.ac.sampleRate;
  await r.ac.close();
  const length = r.chunks.reduce((n, c) => n + c.length, 0);
  if (length < sr / 4) {
    notice('Grabación demasiado corta. Intenta hablar durante al menos un segundo.');
    return;
  }
  notice('Transcribiendo con Muse Voice…');
  try {
    const data = await blobData(voiceWav(r.chunks, sr));
    const result = await api('transcribe', { audio: data });
    const spoken = String(result.text || '').trim();
    if (!spoken) throw Error('No se detectaron palabras.');
    const current = state[r.key].trim(),
      defaultBrief =
        'Crea una campaña de Halloween para este producto. Una dirección creativa premium, cinematográfica y original. Sin precios ni descuentos.';
    state[r.key] = current === defaultBrief ? spoken : current ? current + ' ' + spoken : spoken;
    notice('Muse Voice escribió tu instrucción. Revísala arriba antes de crear la campaña.');
  } catch (e) {
    notice('⚠ ' + e.message);
  }
}
const blobData = blob =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
async function demoVideo() {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream)
    throw Error('Este navegador no permite grabar el demo local. La generación real usa Kling.');
  const c = document.createElement('canvas');
  c.width = state.orientation === 'vertical' ? 540 : 960;
  c.height = state.orientation === 'vertical' ? 960 : 540;
  const q = c.getContext('2d'),
    assets = videoAssets(),
    ims = await Promise.all(
      assets.map(async a => {
        const im = getImage(a.url);
        if (!im.complete) await new Promise(r => (im.onload = r));
        return im;
      })
    );
  const stream = c.captureStream(24),
    type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t));
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 3_000_000 }),
    chunks = [];
  const result = new Promise((resolve, reject) => {
    recorder.ondataavailable = e => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => resolve(new Blob(chunks, { type }));
    recorder.onerror = reject;
  });
  recorder.start();
  const started = performance.now();
  await new Promise(resolve => {
    function tick() {
      const seconds = (performance.now() - started) / 1000,
        im = ims[Math.min(ims.length - 1, Math.floor((seconds / state.duration) * ims.length))],
        s = Math.max(c.width / im.width, c.height / im.height) * (1 + 0.045 * Math.sin(seconds * 0.7));
      q.fillStyle = '#17121e';
      q.fillRect(0, 0, c.width, c.height);
      q.drawImage(im, (c.width - im.width * s) / 2, (c.height - im.height * s) / 2, im.width * s, im.height * s);
      q.fillStyle = '#000a';
      q.fillRect(0, c.height - 50, c.width, 50);
      q.fillStyle = '#ffd1a0';
      q.font = '16px sans-serif';
      q.fillText('ANIMACIÓN DEMO · SIN GENERACIÓN IA', 20, c.height - 20);
      if (seconds >= state.duration) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    }
    tick();
  });
  recorder.stop();
  const blob = await result;
  stream.getTracks().forEach(t => t.stop());
  if (downloadURL) URL.revokeObjectURL(downloadURL);
  downloadURL = URL.createObjectURL(blob);
  state.video = { url: downloadURL, demo: true, duration: state.duration, orientation: state.orientation };
  film.src = downloadURL;
  await film.play();
}

for (const key of Object.keys(STRATEGY_DEFAULTS)) {
  const id = 'strategy' + key[0].toUpperCase() + key.slice(1);
  $('#' + id)?.addEventListener('input', e => {
    state[id] = e.target.value;
    state.strategyPlan = null;
  });
}
$('#prepareStrategy').onclick = () => action('strategy:local');
$('#askSpark').onclick = () => action('strategy:analyze');
for (const key of ['brief', 'caption'])
  $('#' + key).addEventListener('input', e => {
    state[key] = e.target.value.slice(0, key === 'caption' ? 2200 : 4000);
    state.confirm = false;
  });
$('#uploadPhoto').onclick = () => $('#file').click();
$('#file').onchange = async e => {
  try {
    if (e.target.files[0]) await savePhoto(await blobData(e.target.files[0]));
  } catch (err) {
    notice(err.message);
  }
  e.target.value = '';
};
$('#download').onclick = () => {
  if (!state.campaign) return notice('Primero crea una campaña.');
  const data = {
    ...state.campaign.result,
    assets: state.campaign.result.assets.map(a => ({ ...a, headline: headlineFor(a) })),
    selected: state.selected,
    caption: state.caption,
    video: state.video
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = 'campana-aumentados.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};
$('#recenter').onclick = () => action('recenter');
window.addEventListener('beforeunload', () => {
  captureSequence++;
  stream?.getTracks().forEach(t => t.stop());
});
{
  const bv = document.querySelector('#buildVersion');
  if (bv) bv.textContent = VERSION;
}
try {
  state.config = await api('config');
  // Por defecto el estudio trabaja en modo REAL; el demo se activa con el botón de la barra superior (o queda activo si el servidor no tiene APIs).
  state.mode = state.config.paidEnabled && state.config.meta ? 'live' : 'demo';
  state.connections = await api('connections');
  $('#connection').textContent = '● Servidor local conectado';
  applyStrategy(await api('strategy'));
  const saved = await api('photos');
  state.photos = { front: saved.front, right: saved.right || saved.side || null, left: saved.left || null, back: saved.back };
  state.photo = saved.front || saved.right || saved.side || saved.left || saved.back;
  const history = await api('jobs');
  const recent = history.find(j => j.type === 'campaign' && j.status === 'completed' && j.mode === state.mode);
  if (recent) {
    state.campaign = recent;
    if (!state.photo) state.photo = { file: recent.result.photo, url: '/media/' + recent.result.photo };
    state.brief = recent.result.brief;
    state.caption = recent.result.caption;
    state.videoPrompt = recent.result.videoPrompt;
    const published = history.find(j => j.type === 'publish' && j.status === 'completed' && j.campaignId === recent.id);
    if (published) state.publishReceipt = published.result;
    refreshFeed().catch(() => {});
    // El video ya generado de esta campaña vuelve al recargar la página (no hay que pagarlo otra vez).
    const byNew = (a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
    const plans = history.filter(j => j.type === 'video-plan' && j.status === 'completed' && j.campaignId === recent.id && j.mode === 'live');
    const savedVideo = history
      .filter(j => j.type === 'video' && j.status === 'completed' && j.result?.url && j.provider !== 'recording' && plans.some(p => p.id === j.videoPlanId))
      .sort(byNew)[0];
    if (savedVideo) {
      const plan = plans.find(p => p.id === savedVideo.videoPlanId);
      state.video = savedVideo.result;
      state.videoJob = savedVideo.id;
      state.videoPlan = plan;
      state.videoHookIndex = Math.max(0, plan.result.hooks.findIndex(h => h.id === savedVideo.hookId));
      state.videoSelected = plan.result.selected || [];
      state.format = 'reel'; // el video ya está hecho: Publicar abre directo en Reel
      if ([5, 10].includes(savedVideo.settings?.duration)) state.duration = savedVideo.settings.duration;
      film.src = savedVideo.result.url;
      film.load();
      film.play().catch(() => {});
    }
    const ads = history.find(j => j.type === 'ads-plan' && j.status === 'completed' && j.campaignId === recent.id);
    if (ads) {
      state.adsPlan = ads.result.recommendation?.provider ? ads : null;
      state.selected = ads.result.assets.map(a => a.id);
      state.adsStage = state.adsPlan ? 'review' : 'setup';
      const b = ads.result.brief;
      state.adsCountry = b.country;
      state.adsCity = b.city;
      state.adsRadius = b.radius || 10;
      state.adsGoal = b.goal || 'auto';
      state.adsBudget = b.dailyBudget == null ? '' : String(b.dailyBudget);
      if (b.dailyBudget) state.adsBudgetN = b.dailyBudget;
      state.adsCurrency = b.currency;
      state.adsDays = String(b.days);
      state.adsCta = b.cta;
      state.adsAudience = b.audience;
      state.adsTheme = b.campaignTheme;
      state.adsPush = history.find(j => j.type === 'ads-push' && j.planId === ads.id) || null;
    }
    notice(
      state.mode === 'live' && !state.connections.instagram.valid
        ? state.connections.instagram.message
        : 'Tus fotos, campaña y propuesta de pauta guardadas están disponibles.'
    );
  } else if (state.photo) notice('Tus vistas guardadas volvieron a cargarse. Puedes continuar la campaña.');
} catch (e) {
  notice('No se pudo conectar al servidor: ' + e.message);
}
notice(state.notice);
draw();
let lastDesktopDraw = 0;
function renderDesktop(time = 0) {
  if (!document.body.classList.contains('xr-active') && time - lastDesktopDraw >= 33) {
    draw();
    lastDesktopDraw = time;
  }
  requestAnimationFrame(renderDesktop);
}
requestAnimationFrame(renderDesktop);
window.addEventListener('error', e => xrlog('js-error', (e.message || '') + ' @' + (e.filename || '').split('/').pop() + ':' + (e.lineno || '')));
window.addEventListener('unhandledrejection', e => xrlog('js-reject', e.reason?.message || e.reason));
startCamera().catch(e =>
  notice(
    `Cámara pendiente: ${e.name === 'NotAllowedError' ? 'permite la cámara para este sitio en Quest Browser.' : e.message} Pulsa Iniciar cámara para volver a intentar.`
  )
);
try {
  const { initXR } = await import('./xr.js');
  await initXR({ board, preview, cameraHud, state, draw, action, hitAt, setHover, notice, ensureCamera: () => startCamera() });
} catch (e) {
  $('#enterXR').disabled = true;
  notice('Vista de escritorio lista. El motor XR no pudo cargar: ' + e.message);
}

// Gancho de inspección para pruebas visuales (no cambia el comportamiento).
if (typeof window !== 'undefined') window.__studio = { state, action, draw, hitAt, hits: () => ui.hits.slice() };
