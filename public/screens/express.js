// Paso 3 · Crear: Luma coordina a su equipo de agentes en una sola pulsación.
import { button, hit, tile, T, glass, inset, txt, wrapText, icon, chip, rr, luma, ring, progressBar, picture, eyebrow, ui, dot } from '../ui.js';
import { state, photoSlots } from '../store.js';
import { AGENT_PIPELINE, OBJECTIVES } from '../studio-domain.js';

const STATUS = {
  pending: ['Pendiente', T.faint],
  running: ['Trabajando', T.amber],
  done: ['Listo', T.mint],
  skipped: ['Omitido', T.faint],
  error: ['Revisar', T.danger]
};

export function drawExpress(g) {
  txt(g, 'Un toque, un equipo.', 40, 238, { size: 40, weight: 700, family: 'display', spacing: -1 });
  txt(g, 'Tus agentes preparan imágenes, copy, pauta (solo borrador), video y anuncio XR. Tú apruebas.', 40, 276, { size: 21, color: T.muted });

  // Columna izquierda · el encargo
  glass(g, 40, 306, 420, 548, 32);
  eyebrow(g, 'Tu encargo', 68, 352);
  wrapText(g, state.strategyProduct || 'Producto por definir', 68, 392, 364, { size: 26, weight: 650, color: T.text, line: 32, maxLines: 2, family: 'display' });
  txt(g, state.strategyTheme || 'Temática', 68, 466, { size: 20, color: T.violet, weight: 600, maxWidth: 364 });
  txt(g, OBJECTIVES[state.strategyObjective] || '', 68, 498, { size: 18, color: T.muted, maxWidth: 364 });
  const got = photoSlots.filter(([k]) => state.photos[k]).length;
  photoSlots.forEach(([slot, label], i) => {
    const x = 68 + (i % 2) * 188,
      y = 530 + Math.floor(i / 2) * 156;
    picture(state.photos[slot]?.url, x, y, 176, 116, { r: 20 });
    txt(g, label, x + 4, y + 138, { size: 16, color: state.photos[slot] ? T.text : T.faint, weight: 600 });
    const qa = state.photoQA?.[slot];
    if (qa) chip(g, x + 8, y + 8, qa.score + '', { color: qa.verdict === 'buena' ? T.mint : qa.verdict === 'mejorable' ? T.warn : T.danger, h: 30, size: 15 });
  });
  hit('nav:capture', 'Cambiar fotos', 40, 306, 420, 548);
  txt(g, got + '/4 vistas', 392, 352, { size: 18, color: got === 4 ? T.mint : T.warn, weight: 700, align: 'right' });

  // Columna derecha · línea de agentes
  glass(g, 484, 306, 876, 548, 32, { strong: true });
  const steps = state.agents?.steps?.length ? state.agents.steps : AGENT_PIPELINE.map(a => ({ agent: a.id, status: 'pending' }));
  const doneN = steps.filter(s => ['done', 'skipped', 'error'].includes(s.status)).length;
  ring(g, 560, 376, 38, doneN / steps.length, { label: Math.round((doneN / steps.length) * 100) + '%', width: 9, size: 21, color: doneN === steps.length ? T.mint : T.amber });
  txt(g, state.agents?.running ? 'Tu equipo está trabajando' : doneN === steps.length && doneN ? 'Campaña lista' : 'Equipo de Luma', 630, 372, { size: 28, weight: 700, family: 'display', spacing: -0.5 });
  txt(g, state.mode === 'demo' ? 'Modo demo · composiciones locales · cuesta $0' : 'Modo real · pedirá confirmación antes de gastar', 630, 404, { size: 18, color: T.muted });
  AGENT_PIPELINE.forEach((a, i) => {
    const s = steps.find(x => x.agent === a.id) || { status: 'pending' };
    const col = i % 2,
      row = Math.floor(i / 2);
    const x = 510 + col * 422,
      y = 438 + row * 100;
    const [lab, c] = STATUS[s.status] || STATUS.pending;
    glass(g, x, y, 404, 88, 26, { tint: s.status === 'running' ? 'rgba(241,220,174,0.10)' : null });
    rr(g, x + 16, y + 15, 58, 58, 20);
    g.fillStyle = s.status === 'done' ? 'rgba(127,233,191,0.16)' : s.status === 'running' ? 'rgba(241,220,174,0.18)' : 'rgba(255,255,255,0.06)';
    g.fill();
    icon(g, s.status === 'done' ? 'check' : a.icon, x + 45, y + 44, 30, c === T.faint ? T.muted : c, 2.2);
    txt(g, a.name, x + 90, y + 38, { size: 21, weight: 650 });
    txt(g, s.note || a.label, x + 90, y + 64, { size: 16, color: T.muted, maxWidth: 232 });
    txt(g, lab, x + 386, y + 38, { size: 14, weight: 800, color: c, align: 'right', spacing: 1.2 });
    if (s.status === 'running') progressBar(g, x + 90, y + 74, 200, 5, ((ui.now * 0.6) % 1) * 0.9 + 0.1);
  });

  // Barra de acción
  const finished = !!(state.agents?.steps?.length && doneN === steps.length);
  if (state.confirmAutopilot && !state.agents?.running) {
    txt(g, state.mode === 'demo' ? 'Modo demo · costo $0 · nada se publica ni se activa.' : 'Modo real: se usan tus APIs y la pauta queda en PAUSED.', 40, 884, { size: 19, color: T.amber, weight: 600, maxWidth: 560 });
    button('autopilot:cancel', 'Cancelar', 640, 866, 220, 76, {});
    button('autopilot:go', 'Sí, crear todo', 880, 866, 480, 76, { primary: true, ic: 'wand' });
  } else if (finished) {
    button('agents:reset', 'Repetir', 40, 866, 220, 76, { ic: 'refresh' });
    button('nav:results', 'Ver resultados', 640, 866, 720, 76, { primary: true, trailing: 'arrow-right' });
  } else {
    button('nav:capture', 'Fotos', 40, 866, 220, 76, { ic: 'camera', disabled: !!state.agents?.running });
    button('autopilot', state.agents?.running ? 'Trabajando…' : state.mode === 'demo' ? 'Crear todo · $0' : 'Crear todo', 640, 866, 720, 76, { primary: true, ic: 'wand', disabled: !!state.agents?.running });
  }
}
