// Runtime de interfaz: registro de zonas táctiles, animación de hover y componentes ligados al lienzo activo.
import { T, drawButton, glass, inset, txt, wrapText, icon, chip, chipWidth, eyebrow, rr, font, measure, luma, ring, progressBar, dot, sparkle, aurora, background } from './ui-kit.js';
import { state, getImage } from './store.js';

export const ui = { g: null, hits: [], hover: null, amounts: new Map(), now: 0 };

export function begin(g) {
  ui.g = g;
  ui.hits = [];
  ui.now = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
}
export function setUiHover(id) {
  ui.hover = id;
}
export const hits = () => ui.hits;

function ease(id, target) {
  const a = ui.amounts.get(id) ?? 0;
  const n = a + (target - a) * 0.34;
  ui.amounts.set(id, Math.abs(n - target) < 0.01 ? target : n);
  return n;
}

// Botón estándar. Opciones: primary, ghost, danger, active, disabled, small, ic, trailing, align.
export function button(id, label, x, y, w, h = 72, o = {}) {
  const hover = ease(id, ui.hover === id && !o.disabled ? 1 : 0);
  const variant = o.primary ? 'primary' : o.ghost ? 'ghost' : o.danger ? 'danger' : 'secondary';
  drawButton(ui.g, { x, y, w, h, label, ic: o.ic, trailing: o.trailing, variant, active: !!o.active, disabled: !!o.disabled, hover, small: !!o.small, align: o.align });
  ui.hits.push({ id, label: o.aria || label, x, y, w, h, disabled: !!o.disabled, nav: id.startsWith('nav:') });
}

// Zona táctil sin dibujo propio (tarjetas, miniaturas…).
export function hit(id, label, x, y, w, h, extra = {}) {
  ui.hits.push({ id, label, x, y, w, h, ...extra });
}

// Tarjeta táctil de cristal con hover.
export function tile(id, label, x, y, w, h, o = {}) {
  const hover = ease('tile:' + id, ui.hover === id && !o.disabled ? 1 : 0);
  glass(ui.g, x, y, w, h, o.r ?? 28, { strong: hover > 0.5 || o.active, tint: o.active ? 'rgba(255,255,255,0.10)' : null, hover });
  if (hover > 0.01 || o.active) {
    rr(ui.g, x + 1, y + 1, w - 2, h - 2, o.r ?? 28);
    ui.g.strokeStyle = o.active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,' + 0.6 * hover + ')';
    ui.g.lineWidth = 2;
    ui.g.stroke();
  }
  ui.hits.push({ id, label, x, y, w, h, disabled: !!o.disabled });
  return hover;
}

export function field(id, label, value, x, y, w, h = 84, o = {}) {
  const g = ui.g;
  txt(g, label, x + 4, y - 14, { size: 17, weight: 650, color: T.muted, spacing: 1.2 });
  const focus = state.keyboard?.key === id;
  const hover = ease('field:' + id, ui.hover === 'edit:' + id ? 1 : 0);
  inset(g, x, y, w, h, 22, { focus: focus || hover > 0.5 });
  const lines = Math.max(1, Math.min(7, Math.floor((h - 22) / 34)));
  if (value) wrapText(g, value, x + 26, y + 18 + 25, w - 52, { size: 24, weight: 500, color: T.text, line: 34, maxLines: lines });
  else txt(g, o.placeholder || 'Toca para escribir…', x + 26, y + 18 + 25, { size: 24, color: T.faint });
  icon(g, 'pen', x + w - 36, y + 30, 22, hover > 0.5 ? T.amber : T.faint, 2);
  ui.hits.push({ id: 'edit:' + id, label: 'Editar ' + label.toLowerCase(), x, y, w, h });
}

// Imagen recortada con esquinas redondeadas; sin imagen dibuja un marcador sutil.
export function picture(url, x, y, w, h, o = {}) {
  const g = ui.g,
    r = o.r ?? 20,
    fit = o.fit || 'cover';
  const im = url ? getImage(url) : null;
  g.save();
  rr(g, x, y, w, h, r);
  g.clip();
  g.fillStyle = 'rgba(8,7,14,0.75)';
  g.fillRect(x, y, w, h);
  if (im?.complete && im.naturalWidth) {
    const s = fit === 'contain' ? Math.min(w / im.width, h / im.height) : Math.max(w / im.width, h / im.height);
    g.drawImage(im, x + (w - im.width * s) / 2, y + (h - im.height * s) / 2, im.width * s, im.height * s);
  } else {
    const k = (Math.sin(ui.now * 2) + 1) / 2;
    g.fillStyle = 'rgba(255,255,255,' + (0.03 + k * 0.03) + ')';
    g.fillRect(x, y, w, h);
    icon(g, 'image', x + w / 2, y + h / 2, Math.min(44, w * 0.3, h * 0.3), T.faint, 2);
  }
  g.restore();
  if (o.border !== false) {
    rr(g, x + 0.5, y + 0.5, w - 1, h - 1, r);
    g.strokeStyle = o.stroke || 'rgba(255,255,255,0.12)';
    g.lineWidth = o.stroke ? 3 : 1.5;
    g.stroke();
  }
}

export { T, glass, inset, txt, wrapText, icon, chip, chipWidth, eyebrow, rr, font, measure, luma, ring, progressBar, dot, sparkle, aurora, background };
