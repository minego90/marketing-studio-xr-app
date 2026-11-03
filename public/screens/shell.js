// Cromo común de los paneles: fondo, cabecera, pasos y barra de Luma.
import { button, hit, T, txt, wrapText, icon, chip, chipWidth, rr, measure, luma, progressBar, aurora, sparkle, background, glass, ui } from '../ui.js';
import { state } from '../store.js';
import { getLang } from '../i18n.js';
import { kit3d, k3on } from '../ui-kit.js';
import { coachAdvice, PAGE_STEP, AGENT_PIPELINE } from '../studio-domain.js';

export const W = 1400,
  H = 1060;
const STEPS = [
  ['capture', 'Fotos', 'camera'],
  ['strategy', 'Idea', 'compass'],
  ['gallery', 'Imágenes', 'image'],
  ['publish', 'Publicar', 'send'],
  ['ads', 'Pauta', 'megaphone'],
  ['data', 'Datos', 'layers']
];

export function frameStart(g) {
  g.clearRect(0, 0, W, H);
  kit3d.target = g.canvas;
  kit3d.slabs.length = 0;
  kit3d.fox = null;
  if (k3on(g)) return; // cristal 3D: el lienzo queda transparente (el fondo es 3D)
  g.save();
  rr(g, 0, 0, W, H, 40);
  g.clip();
  background(g, W, H);
}
export function frameEnd(g) {
  if (k3on(g)) return;
  g.restore();
  rr(g, 1, 1, W - 2, H - 2, 40);
  g.strokeStyle = 'rgba(255,255,255,0.16)';
  g.lineWidth = 2;
  g.stroke();
}

export function drawHeader(g) {
  const gr = aurora(g, 40, 24, 92, 70);
  g.beginPath();
  g.arc(66, 47, 20, 0, Math.PI * 2);
  g.fillStyle = gr;
  g.fill();
  sparkle(g, 66, 47, 24, T.ink);
  const o = { size: 32, weight: 800, family: 'display', spacing: -0.8 };
  txt(g, 'aumentados', 100, 58, o);
  const wmw = measure(g, 'aumentados', o);
  txt(g, 'STUDIO XR', 100 + wmw + 16, 54, { size: 14, weight: 700, color: T.faint, spacing: 2.2 });
  const guard = state.config?.adsGuard;
  const guardLabel = guard?.mode === 'remote-paused' ? 'Pauta: solo PAUSED' : 'Pauta: borrador local';
  const modeLabel = state.mode === 'demo' ? 'MODO DEMO · volver a real' : 'Modo real · activar DEMO';
  let x = 1278;
  x -= chipWidth(g, modeLabel, { dot: true });
  chip(g, x, 28, modeLabel, { color: state.mode === 'demo' ? T.amber : T.mint, dot: true });
  hit('mode:toggle', state.mode === 'demo' ? 'Volver al modo real' : 'Activar modo demo', x - 4, 22, chipWidth(g, modeLabel, { dot: true }) + 8, 50);
  x -= chipWidth(g, guardLabel, { ic: 'shield' }) + 10;
  chip(g, x, 28, guardLabel, { color: T.mint, ic: 'shield' });
  hit('drag', 'Mover panel', 560, 0, x - 580, 92, { drag: true });
  button('recenter', '', 1296, 14, 64, 64, { ic: 'target', small: true, ghost: true, aria: 'Recentrar paneles' });
  button('lang:toggle', getLang() === 'en' ? 'ES' : 'EN', 704, 22, 80, 52, { small: true, ghost: true, aria: 'Language / Idioma' });
  if (state.page === 'guide') button('nav:capture', 'Avanzado', 520, 22, 170, 52, { small: true, ghost: true });
  else button('nav:guide', '← Guía', 520, 22, 170, 52, { small: true });
}

export function drawStepper(g) {
  const cur = PAGE_STEP[state.page] ?? -1;
  const w = 180,
    gap = 2,
    y = 108,
    h = 60;
  STEPS.forEach(([id, label, ic], i) => {
    const x = 28 + i * (w + gap);
    const active = i === cur,
      done = i < cur;
    button('nav:' + id, label, x, y, w, h, { active, ic: done ? 'check' : ic, primary: false, small: true });
    txt(g, String(i + 1), x + w - 14, y + 16, { size: 12, weight: 800, color: active ? T.amber : T.faint, align: 'center' });
  });
  button('nav:rec', 'Grabar', 1120, y, 150, h, { ic: 'film', ghost: true, small: true, active: state.page === 'rec' });
  button('nav:settings', '', 1274, y, 90, h, { ic: 'sliders', ghost: true, small: true, active: state.page === 'settings', aria: 'Ajustes' });
}

export function drawLumaBar(g) {
  const advice = coachAdvice(state);
  const x = 26,
    y = 962,
    w = 1348,
    h = 78;
  glass(g, x, y, w, h, 28, { strong: true });
  const t = ui.now;
  luma(g, 76, y + h / 2, 22, { mood: advice.mood, t, look: { x: Math.sin(t * 0.7) * 0.6, y: 0 } });
  const name = (AGENT_PIPELINE.find(a => a.id === advice.agent)?.name || 'Luma').toUpperCase();
  txt(g, name === 'LUMA' ? 'LUMA' : 'LUMA · ' + name, 128, y + 30, { size: 14, weight: 800, color: T.amber, spacing: 2 });
  wrapText(g, advice.text, 128, y + 54, 920, { size: 19, weight: 500, color: T.text, line: 24, maxLines: 1 });
  if (state.notice && state.notice !== advice.text) txt(g, state.notice, 128, y + 72, { size: 14, color: T.faint, maxWidth: 920 });
  button('coach-next', advice.action ? advice.label : 'Luma · guía', 1076, y + 9, 282, 60, { primary: !!advice.action, disabled: !advice.action, small: true, trailing: advice.action ? 'arrow-right' : null });
  if (state.busy || state.agents?.running) progressBar(g, 40, y - 12, 1320, 6, Math.max(0.04, (state.job?.progress || 8) / 100));
}
