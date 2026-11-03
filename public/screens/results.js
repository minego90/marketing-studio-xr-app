// Paso 4 · Resultados: centro de piezas, anuncio XR y revisión.
import { button, hit, tile, T, glass, inset, txt, wrapText, icon, chip, rr, luma, ring, progressBar, picture, eyebrow, ui } from '../ui.js';
import { state, photoSlots, selectedAssets } from '../store.js';

function counts() {
  const assets = state.campaign?.result?.assets || [];
  return { images: assets.length, selected: state.selected.length, ads: state.adsPlan ? 1 : 0, video: state.video ? 1 : 0, hooks: state.videoPlan ? 1 : 0, photos: photoSlots.filter(([k]) => state.photos[k]).length };
}

export function drawResults(g) {
  const c = counts();
  txt(g, 'Tu campaña, lista para revisar.', 40, 238, { size: 40, weight: 700, family: 'display', spacing: -1 });
  txt(g, 'Cada pieza se abre en su propio panel. Nada se publica ni se activa sin tu confirmación.', 40, 276, { size: 21, color: T.muted });
  const tiles = [
    ['nav:gallery', 'Imágenes', c.images ? c.images + ' propuestas' : 'Aún sin crear', 'image', c.images ? T.mint : T.faint],
    ['nav:publish', 'Publicar', 'Carrusel · historia · reel', 'send', T.violet],
    ['nav:ads', 'Pauta', state.adsPlan ? 'Borrador listo · PAUSED' : 'Solo como borrador', 'megaphone', state.adsPlan ? T.mint : T.amber],
    ['nav:video', 'Video', state.video ? 'Video listo' : c.hooks ? '3 hooks listos' : 'Hooks y animación', 'film', state.video ? T.mint : T.amber],
    ['nav:xr', 'Anuncio XR', '4 vistas en un prisma', 'cube', T.rose],
    ['nav:review', 'Revisor', state.review ? 'Puntaje ' + state.review.score + '/100' : 'Revisión con IA', 'check', state.review ? (state.review.verdict === 'listo' ? T.mint : T.warn) : T.faint]
  ];
  tiles.forEach(([id, title, sub, ic, col], i) => {
    const x = 40 + (i % 3) * 444,
      y = 314 + Math.floor(i / 3) * 250;
    const hv = tile(id, title, x, y, 428, 230, {});
    rr(g, x + 28, y + 30, 72, 72, 24);
    g.fillStyle = col + '26';
    g.fill();
    icon(g, ic, x + 64, y + 66, 38, col, 2.2);
    txt(g, title, x + 28, y + 148, { size: 31, weight: 700, family: 'display', spacing: -0.5 });
    txt(g, sub, x + 28, y + 182, { size: 19, color: T.muted, maxWidth: 340 });
    icon(g, 'arrow-right', x + 392, y + 62, 28, hv > 0.3 ? T.amber : T.faint, 2.2);
  });
  // franja de imágenes
  const assets = state.campaign?.result?.assets || [];
  if (assets.length) assets.slice(0, 4).forEach((a, i) => picture(a.url, 40 + i * 120, 826, 108, 108, { r: 22 }));
  txt(g, assets.length ? 'Miniaturas de tu campaña' : 'Cuando crees la campaña verás aquí las miniaturas.', assets.length ? 540 : 40, 884, { size: 19, color: T.faint });
}

export function drawXrPage(g) {
  txt(g, 'Anuncio XR', 40, 238, { size: 40, weight: 700, family: 'display', spacing: -1 });
  txt(g, 'Tus cuatro vistas forman un prisma que gira con la mano. No usa IA ni cuesta nada.', 40, 276, { size: 21, color: T.muted });
  glass(g, 40, 306, 700, 548, 32, { strong: true });
  const t = ui.now;
  const rot = state.xr.autoRotate ? t * 0.7 : 0.35;
  const cx = 390,
    cy = 580,
    R = 150,
    H = 280;
  const have = photoSlots.map(([k]) => state.photos[k]).find(Boolean);
  g.save();
  // sombra de apoyo
  g.beginPath();
  g.ellipse(cx, cy + H / 2 + 26, 190, 26, 0, 0, Math.PI * 2);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fill();
  const faces = photoSlots.map(([slot, label], i) => {
    const a0 = rot + (i * Math.PI) / 2,
      a1 = a0 + Math.PI / 2;
    return { slot, label, x0: cx + R * Math.sin(a0), x1: cx + R * Math.sin(a1), depth: Math.cos(a0 + Math.PI / 4) };
  });
  for (const f of faces.filter(f => f.depth > 0).sort((a, b) => a.depth - b.depth)) {
    const x = Math.min(f.x0, f.x1),
      w = Math.max(6, Math.abs(f.x1 - f.x0));
    picture((state.photos[f.slot] || have)?.url, x, cy - H / 2, w, H, { r: 8, border: false });
    g.fillStyle = 'rgba(8,6,16,' + (0.55 - 0.5 * f.depth) + ')';
    g.fillRect(x, cy - H / 2, w, H);
    rr(g, x + 0.5, cy - H / 2 + 0.5, w - 1, H - 1, 8);
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 1.5;
    g.stroke();
    if (w > 70) txt(g, f.label.toUpperCase(), x + w / 2, cy + H / 2 + 62, { size: 14, weight: 800, color: T.muted, align: 'center', spacing: 2 });
  }
  g.restore();
  txt(g, 'Vista previa de escritorio', 70, 350, { size: 15, weight: 700, color: T.faint, spacing: 2 });
  // checklist
  glass(g, 764, 306, 596, 548, 32);
  eyebrow(g, 'Lista de confort XR', 794, 350);
  const checks = state.xr.checks || [
    ['Distancia 0,8–2 m', true],
    ['Texto ≥ 1,5° (legible)', true],
    ['Botones ≥ 4 cm', true],
    ['72–90 fps, ≤ 100 k triángulos', true],
    ['Sin IA ni gasto', true]
  ];
  checks.forEach(([label, ok], i) => {
    const y = 380 + i * 64;
    rr(g, 794, y, 540, 52, 18);
    g.fillStyle = 'rgba(255,255,255,0.04)';
    g.fill();
    icon(g, ok ? 'check' : 'info', 824, y + 26, 26, ok ? T.mint : T.warn, 2.4);
    txt(g, label, 856, y + 33, { size: 20, color: T.text });
  });
  button('xr:rotate', state.xr.autoRotate ? 'Girar: sí' : 'Girar: no', 794, 712, 250, 66, { small: true, ic: 'refresh' });
  button('xr:export', 'Exportar paquete', 1060, 712, 274, 66, { small: true, ic: 'download' });
  button('nav:results', '← Resultados', 40, 872, 300, 76, {});
  button('xr:open', 'Abrir experiencia XR', 640, 872, 720, 76, { primary: true, ic: 'cube' });
}

export function drawReviewPage(g) {
  txt(g, 'Revisor', 40, 238, { size: 40, weight: 700, family: 'display', spacing: -1 });
  txt(g, 'Una revisión local y gratuita contra las reglas de fotografía, copy y pauta segura.', 40, 276, { size: 21, color: T.muted });
  glass(g, 40, 306, 420, 548, 32, { strong: true });
  const r = state.review;
  ring(g, 250, 506, 110, r ? r.score / 100 : 0.02, { label: r ? String(r.score) : '–', width: 18, size: 76, color: !r ? T.faint : r.verdict === 'listo' ? T.mint : r.verdict === 'revisar' ? T.warn : T.danger });
  txt(g, r ? { listo: 'Listo para publicar', revisar: 'Revisar detalles', corregir: 'Corregir antes de publicar' }[r.verdict] : 'Sin revisar todavía', 250, 690, { size: 24, weight: 700, align: 'center', family: 'display' });
  txt(g, 'Gratis · se ejecuta en tu servidor', 250, 724, { size: 16, align: 'center', color: T.faint });
  glass(g, 484, 306, 876, 548, 32);
  eyebrow(g, 'Hallazgos', 514, 350);
  const fs = r?.findings || [];
  if (!fs.length) txt(g, r ? 'Sin hallazgos: todo en orden.' : 'Pulsa «Revisar» para que mi equipo audite la campaña.', 514, 410, { size: 22, color: T.muted });
  fs.slice(0, 5).forEach((f, i) => {
    const y = 372 + i * 90,
      col = f.severity === 'error' ? T.danger : f.severity === 'warn' ? T.warn : T.mint;
    rr(g, 514, y, 816, 78, 22);
    g.fillStyle = 'rgba(255,255,255,0.04)';
    g.fill();
    rr(g, 514, y + 16, 6, 46, 3);
    g.fillStyle = col;
    g.fill();
    wrapText(g, f.message, 540, y + 32, 770, { size: 19, weight: 600, color: T.text, line: 24, maxLines: 1 });
    wrapText(g, f.fix || '', 540, y + 60, 770, { size: 16, color: T.muted, line: 20, maxLines: 1 });
  });
  button('nav:results', '← Resultados', 40, 872, 300, 76, {});
  button('open:review', r ? 'Revisar de nuevo' : 'Revisar ahora', 640, 872, 720, 76, { primary: true, ic: 'check', disabled: state.busy });
}
