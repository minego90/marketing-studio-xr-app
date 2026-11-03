import { tr } from './i18n.js';
// Sistema de diseño «Aurora» para los paneles de Marketing Studio XR.
// Todo se dibuja en Canvas 2D (mismos píxeles en PC y en realidad mixta). Sin dependencias.
// Reglas: objetivos táctiles ≥ 60 px, texto ≥ 20 px, contraste AA, una sola fuente (Inter / Inter Display).

export const FONT = {
  display: '"Inter Display","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
  body: '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif'
};

export const T = {
  bg: '#070a12',
  surface: '#12151b',
  raised: '#181c24',
  inset: '#0d0f14',
  line: 'rgba(255,255,255,0.10)',
  lineStrong: 'rgba(255,255,255,0.24)',
  text: '#f5f7fb',
  muted: '#b4bccb',
  faint: '#8089a0',
  violet: '#a9c7ff',
  rose: '#f2b4c2',
  amber: '#f1dcae',
  mint: '#92e8c8',
  warn: '#f1dcae',
  danger: '#ff9d9d',
  ink: '#0b0d12'
};

// Cristal 3D: cuando está activo (solo dentro del visor, pantalla «guía»), los fondos de cristal no se dibujan en el lienzo:
// se anotan aquí y xr.js los convierte en láminas de cristal 3D reales detrás del texto y los iconos.
export const kit3d = { enabled: false, guide: false, slabs: [], target: null, fox: null };
export const k3on = g => kit3d.enabled && kit3d.guide && g.canvas === kit3d.target;
const k3level = (x, y, w, h) => kit3d.slabs.reduce((n, s) => n + (s.x <= x + 1 && s.y <= y + 1 && s.x + s.w >= x + w - 1 && s.y + s.h >= y + h - 1 && !s.button ? 1 : 0), 0);

export const font = (weight, size, family = 'body') => `${weight} ${size}px ${FONT[family] || FONT.body}`;

export function rr(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}

export function aurora(g, x0, y0, x1, y1, alpha = 1) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  gr.addColorStop(0, '#ffffff' + a);
  gr.addColorStop(1, '#d9e2f0' + a);
  return gr;
}

// ───────── Texto ─────────
export function txt(g, s, x, y, o = {}) {
  const { size = 24, weight = 500, color = T.text, family = 'body', align = 'left', spacing = 0, maxWidth } = o;
  g.font = font(weight, size, family);
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'alphabetic';
  if ('letterSpacing' in g) g.letterSpacing = spacing ? spacing + 'px' : '0px';
  let str = tr(String(s ?? ''));
  if (maxWidth && g.measureText(str).width > maxWidth) {
    while (str.length > 1 && g.measureText(str + '…').width > maxWidth) str = str.slice(0, -1);
    str = str.trimEnd() + '…';
  }
  g.fillText(str, x, y);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.textAlign = 'left';
  return str;
}

export function measure(g, s, o = {}) {
  g.font = font(o.weight || 500, o.size || 24, o.family || 'body');
  if ('letterSpacing' in g) g.letterSpacing = o.spacing ? o.spacing + 'px' : '0px';
  const w = g.measureText(tr(String(s ?? ''))).width;
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  return w;
}

export function wrapText(g, s, x, y, maxWidth, o = {}) {
  const { size = 24, weight = 400, color = T.muted, line = Math.round(size * 1.45), maxLines = 5, family = 'body' } = o;
  g.font = font(weight, size, family);
  g.fillStyle = color;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  const words = tr(String(s ?? '')).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  let shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let last = shown[maxLines - 1];
    while (last.length > 1 && g.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
    shown[maxLines - 1] = last.trimEnd() + '…';
  }
  shown.forEach((l, i) => g.fillText(l, x, y + i * line));
  return { lines: shown.length, height: shown.length * line };
}

// ───────── Superficies ─────────
export function glass(g, x, y, w, h, r = 28, o = {}) {
  // Cristal oscuro «Noche»: cuerpo translúcido, bisel interior, borde prismático y destello superior.
  const { tint = null, stroke = true, glow = null, strong = false, alpha = 1 } = o;
  if (k3on(g)) {
    kit3d.slabs.push({ x, y, w, h, r, kind: 'glass', strong, tint, hover: o.hover || 0, level: k3level(x, y, w, h) });
    return;
  }
  g.save();
  g.globalAlpha *= alpha;
  if (glow || strong) {
    g.shadowColor = glow || 'rgba(0,0,0,0.45)';
    g.shadowBlur = glow ? 36 : 26;
    g.shadowOffsetY = 10;
  }
  rr(g, x, y, w, h, r);
  const fill = g.createLinearGradient(x, y, x + w * 0.25, y + h);
  fill.addColorStop(0, strong ? 'rgba(255,255,255,0.17)' : 'rgba(255,255,255,0.115)');
  fill.addColorStop(0.55, strong ? 'rgba(190,215,255,0.085)' : 'rgba(190,215,255,0.05)');
  fill.addColorStop(1, strong ? 'rgba(255,255,255,0.075)' : 'rgba(255,255,255,0.035)');
  g.fillStyle = fill;
  g.fill();
  g.shadowColor = 'transparent';
  g.shadowBlur = 0;
  g.shadowOffsetY = 0;
  if (tint) {
    rr(g, x, y, w, h, r);
    g.fillStyle = tint;
    g.fill();
  }
  if (stroke) {
    const rr2 = Math.max(4, r - 1);
    // bisel interior (grosor del cristal)
    rr(g, x + 3, y + 3, w - 6, h - 6, Math.max(2, rr2 - 3));
    const bev = g.createLinearGradient(x, y, x + w, y + h);
    bev.addColorStop(0, 'rgba(255,255,255,0.34)');
    bev.addColorStop(0.35, 'rgba(255,255,255,0.04)');
    bev.addColorStop(0.7, 'rgba(120,190,255,0.06)');
    bev.addColorStop(1, 'rgba(160,220,255,0.28)');
    g.strokeStyle = bev;
    g.lineWidth = 1.6;
    g.stroke();
    // borde exterior prismático (dispersión)
    rr(g, x + 0.5, y + 0.5, w - 1, h - 1, r);
    if (typeof stroke === 'string') {
      g.strokeStyle = stroke;
      g.lineWidth = 2;
    } else {
      const rim = g.createLinearGradient(x, y, x + w, y + h);
      rim.addColorStop(0, strong ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.46)');
      rim.addColorStop(0.3, 'rgba(150,205,255,0.20)');
      rim.addColorStop(0.55, 'rgba(255,170,225,0.16)');
      rim.addColorStop(0.8, 'rgba(255,225,160,0.20)');
      rim.addColorStop(1, 'rgba(255,255,255,0.40)');
      g.strokeStyle = rim;
      g.lineWidth = 1.6;
    }
    g.stroke();
    // destello superior
    if (w > 90 && h > 50) {
      g.beginPath();
      g.moveTo(x + r * 0.9, y + 2.5);
      g.lineTo(x + w - r * 0.9, y + 2.5);
      const sp = g.createLinearGradient(x, 0, x + w, 0);
      sp.addColorStop(0, 'rgba(255,255,255,0)');
      sp.addColorStop(0.3, 'rgba(255,255,255,0.55)');
      sp.addColorStop(0.7, 'rgba(255,255,255,0.22)');
      sp.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = sp;
      g.lineWidth = 1.4;
      g.stroke();
    }
  }
  g.restore();
}

export function inset(g, x, y, w, h, r = 20, o = {}) {
  const { focus = false } = o;
  rr(g, x, y, w, h, r);
  g.fillStyle = 'rgba(8,7,14,0.62)';
  g.fill();
  rr(g, x + 0.5, y + 0.5, w - 1, h - 1, r);
  g.strokeStyle = focus ? T.violet : 'rgba(255,255,255,0.11)';
  g.lineWidth = focus ? 2.5 : 1.5;
  g.stroke();
}

let bgCache = null;
export function background(g, w, h, make = () => (typeof document !== 'undefined' ? document.createElement('canvas') : null)) {
  if (!bgCache || bgCache.w !== w || bgCache.h !== h) {
    const c = make();
    if (c && c.getContext) {
      c.width = w;
      c.height = h;
      const q = c.getContext('2d');
      q.fillStyle = T.bg;
      q.fillRect(0, 0, w, h);
      const blob = (cx, cy, r, col, a) => {
        const gr = q.createRadialGradient(cx, cy, 0, cx, cy, r);
        gr.addColorStop(0, col + Math.round(a * 255).toString(16).padStart(2, '0'));
        gr.addColorStop(1, col + '00');
        q.fillStyle = gr;
        q.fillRect(0, 0, w, h);
      };
      blob(w * 0.12, h * 0.1, w * 0.7, '#3a5f9a', 0.42);
      blob(w * 0.95, h * 0.95, w * 0.6, '#6a4a8a', 0.34);
      blob(w * 0.62, h * 0.25, w * 0.4, '#2f7d78', 0.26);
      bgCache = { w, h, c };
    } else bgCache = { w, h, c: null };
  }
  if (bgCache.c) g.drawImage(bgCache.c, 0, 0);
  else {
    g.fillStyle = T.bg;
    g.fillRect(0, 0, w, h);
  }
}

// ───────── Iconos (rejilla 24×24, trazo redondeado) ─────────
const circle = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const ICONS = {
  check: ['M5 12.8l4.4 4.4L19 7.6'],
  'arrow-right': ['M5 12h14M13.5 6l6 6-6 6'],
  'arrow-left': ['M19 12H5M10.5 6l-6 6 6 6'],
  plus: ['M12 5v14M5 12h14'],
  x: ['M6.5 6.5l11 11M17.5 6.5l-11 11'],
  camera: ['M4 8.5h3l1.6-2.5h6.8L17 8.5h3V19H4z', circle(12, 13.2, 3.3)],
  image: ['M4 5.5h16v13H4z', 'M4 16l4.5-4.5 3.8 3.8 2.7-2.7L20 16.5', circle(8.5, 9.5, 1.4)],
  megaphone: ['M4 10v4h3.2l6.8 4V6L7.2 10z', 'M17 9.2a4.2 4.2 0 0 1 0 5.6'],
  film: ['M4 6h16v12H4z', 'M10 9.4v5.2l4.6-2.6z'],
  send: ['M20.5 4L3.5 10.8l6.3 2.4 2.4 6.3z', 'M9.8 13.2L20.5 4'],
  shield: ['M12 3l7 3v5.2c0 4.4-2.9 7.9-7 9.8-4.1-1.9-7-5.4-7-9.8V6z', 'M8.8 12l2.2 2.2 4.4-4.4'],
  cube: ['M12 3l8 4.5v9L12 21l-8-4.5v-9z', 'M12 12l8-4.5M12 12v9M12 12L4 7.5'],
  mic: ['M12 3.5a3 3 0 0 1 3 3V12a3 3 0 0 1-6 0V6.5a3 3 0 0 1 3-3z', 'M6 11.5a6 6 0 0 0 12 0M12 17.5V21'],
  sliders: ['M4 7h9M17 7h3M4 17h3M11 17h9', circle(15, 7, 2), circle(9, 17, 2)],
  upload: ['M12 16V5M7.5 9l4.5-4.5L16.5 9M5 19h14'],
  download: ['M12 5v11M7.5 12l4.5 4.5 4.5-4.5M5 19h14'],
  eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', circle(12, 12, 2.8)],
  lock: ['M6.5 11h11v8.5h-11z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
  refresh: ['M20 12a8 8 0 1 1-2.6-5.9', 'M20 4v4.6h-4.6'],
  compass: [circle(12, 12, 8.5), 'M15.6 8.4l-2 5.2-5.2 2 2-5.2z'],
  palette: ['M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 2-.9 1.6-2-.5-1.3.4-2.7 1.8-2.7H17a3.5 3.5 0 0 0 3.5-3.5C20.5 7 16.8 3.5 12 3.5z', circle(8, 11, 0.8), circle(11.5, 7.8, 0.8), circle(16, 9.2, 0.8)],
  pen: ['M4.5 19.5l.9-3.9L16.3 4.7a2.1 2.1 0 0 1 3 3L8.4 18.6z', 'M14.5 6.5l3 3'],
  layers: ['M12 4l9 4.8-9 4.8-9-4.8z', 'M3.5 12.8l8.5 4.6 8.5-4.6'],
  info: [circle(12, 12, 8.5), 'M12 11v5M12 7.8v.2'],
  clock: [circle(12, 12, 8.5), 'M12 7.5V12l3 2'],
  target: [circle(12, 12, 8.5), circle(12, 12, 4), 'M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3'],
  link: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
  heart: ['M12 20s-7.5-4.6-7.5-10.2A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 2.2C19.5 15.4 12 20 12 20z'],
  comment: ['M5 5h14v11H10.5L6 19.5V16H5z'],
  bookmark: ['M7 4h10v16l-5-3.8L7 20z'],
  list: ['M8 6.5h12M8 12h12M8 17.5h12', circle(4.5, 6.5, 0.6), circle(4.5, 12, 0.6), circle(4.5, 17.5, 0.6)],
  grip: [circle(9, 6, 1), circle(15, 6, 1), circle(9, 12, 1), circle(15, 12, 1), circle(9, 18, 1), circle(15, 18, 1)],
  wand: ['M4.5 19.5l11-11', 'M14 5l1.5-1.5M18.5 9.5L20 8M19 4.5v2M20 5.5h-2M8 4v2M9 5H7'],
  ruler: ['M3.5 15.5l12-12 5 5-12 12z', 'M7.5 11.5l2 2M10.5 8.5l2 2M13.5 5.5l2 2'],
  home: ['M4 11l8-6.5 8 6.5', 'M6 10v9h12v-9']
};
const FILLED = new Set(['grip']);
const path2d = new Map();
export function icon(g, name, cx, cy, size = 28, color = T.text, lw = 2) {
  const defs = ICONS[name];
  if (!defs || typeof Path2D === 'undefined') return;
  g.save();
  g.translate(cx - size / 2, cy - size / 2);
  g.scale(size / 24, size / 24);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = lw * (24 / size) * (size >= 40 ? 0.75 : 1) * 0.9 + 0.35;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const d of defs) {
    let p = path2d.get(d);
    if (!p) path2d.set(d, (p = new Path2D(d)));
    if (FILLED.has(name)) g.fill(p);
    else g.stroke(p);
  }
  g.restore();
}
export function glowIcon(g, name, cx, cy, size, color = T.text, lw = 2) {
  // icono con resplandor suave, como si la luz atravesara el cristal
  g.save();
  g.shadowColor = color;
  g.shadowBlur = size * 0.45;
  icon(g, name, cx, cy, size, color, lw);
  g.restore();
  icon(g, name, cx, cy, size, color, lw);
}
export const hasIcon = name => name in ICONS;
export function sparkle(g, cx, cy, size, color) {
  g.save();
  g.translate(cx, cy);
  g.fillStyle = color;
  g.beginPath();
  const s = size / 2;
  g.moveTo(0, -s);
  g.quadraticCurveTo(s * 0.12, -s * 0.12, s, 0);
  g.quadraticCurveTo(s * 0.12, s * 0.12, 0, s);
  g.quadraticCurveTo(-s * 0.12, s * 0.12, -s, 0);
  g.quadraticCurveTo(-s * 0.12, -s * 0.12, 0, -s);
  g.fill();
  g.restore();
}

// ───────── Botones ─────────
// variant: primary (degradado aurora) · secondary (cristal) · ghost (solo texto) · danger
export function drawButton(g, b) {
  const { x, y, w, h, label = '', ic = null, trailing = null, variant = 'secondary', active = false, disabled = false, hover = 0, small = false, press = 0 } = b;
  const r = Math.min(h / 2, h >= 70 ? 26 : 20);
  const size = small ? 21 : h >= 78 ? 27 : 24;
  g.save();
  g.globalAlpha *= disabled ? 0.4 : 1;
  const k3 = k3on(g) && (variant === 'primary' || variant === 'secondary');
  if (k3) kit3d.slabs.push({ x, y, w, h, r, kind: variant === 'primary' ? 'pearl' : 'glass', strong: active, active, hover, disabled, press, button: true, level: k3level(x, y, w, h) + 1 });
  if (k3) {
    // el cuerpo del botón es 3D; aquí solo se dibujan texto e iconos
  } else if (variant === 'primary' && !disabled) {
    g.save();
    g.shadowColor = 'rgba(0,0,0,' + (0.35 + hover * 0.15) + ')';
    g.shadowBlur = 22 + hover * 10;
    g.shadowOffsetY = 8;
    rr(g, x, y, w, h, r);
    g.fillStyle = aurora(g, x, y, x + w, y + h);
    g.fill();
    g.restore();
    rr(g, x, y, w, h, r);
    const sheen = g.createLinearGradient(0, y, 0, y + h);
    sheen.addColorStop(0, 'rgba(255,255,255,0.55)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.0)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.06)');
    g.fillStyle = sheen;
    g.fill();
    rr(g, x + 0.5, y + 0.5, w - 1, h - 1, r);
    const prim = g.createLinearGradient(x, y, x + w, y + h);
    prim.addColorStop(0, 'rgba(255,255,255,0.9)');
    prim.addColorStop(0.35, 'rgba(150,205,255,0.55)');
    prim.addColorStop(0.65, 'rgba(255,170,225,0.45)');
    prim.addColorStop(1, 'rgba(255,225,160,0.7)');
    g.strokeStyle = prim;
    g.lineWidth = 2;
    g.stroke();
  } else if (variant === 'primary') {
    rr(g, x, y, w, h, r);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fill();
  } else if (variant === 'ghost') {
    if (hover > 0.01) {
      rr(g, x, y, w, h, r);
      g.fillStyle = 'rgba(255,255,255,' + 0.06 * hover + ')';
      g.fill();
    }
  } else if (variant === 'danger') {
    rr(g, x, y, w, h, r);
    g.fillStyle = 'rgba(255,143,143,' + (0.1 + hover * 0.1) + ')';
    g.fill();
    rr(g, x + 0.5, y + 0.5, w - 1, h - 1, r);
    g.strokeStyle = 'rgba(255,143,143,0.55)';
    g.lineWidth = 1.5;
    g.stroke();
  } else {
    glass(g, x, y, w, h, r, { strong: hover > 0.5 || active });
    if (active) {
      rr(g, x, y, w, h, r);
      const tint = g.createLinearGradient(x, y, x + w, y + h);
      tint.addColorStop(0, 'rgba(255,255,255,0.16)');
      tint.addColorStop(1, 'rgba(169,199,255,0.14)');
      g.fillStyle = tint;
      g.fill();
      rr(g, x + 1, y + 1, w - 2, h - 2, r);
      g.strokeStyle = aurora(g, x, y, x + w, y + h, 0.95);
      g.lineWidth = 2.2;
      g.stroke();
    } else if (hover > 0.01) {
      rr(g, x + 0.5, y + 0.5, w - 1, h - 1, r);
      g.strokeStyle = 'rgba(255,255,255,' + 0.7 * hover + ')';
      g.lineWidth = 2;
      g.stroke();
    }
  }
  const col = variant === 'primary' && !disabled ? T.ink : variant === 'danger' ? T.danger : active ? T.text : T.text;
  const weight = variant === 'primary' ? 700 : 600;
  const pad = small ? 20 : 26;
  const iconSize = small ? 24 : 30;
  g.font = font(weight, size);
  const tw = label ? g.measureText(label).width : 0;
  const hasIc = ic && hasIcon(ic);
  let hasTr = trailing && hasIcon(trailing);
  if (hasTr && tw + 2 * pad + (hasIc ? iconSize + 14 : 0) + iconSize + 12 > w) hasTr = false;
  const total = (hasIc ? iconSize + (label ? 14 : 0) : 0) + tw + (hasTr ? iconSize + 12 : 0);
  const fit = tw > w - 2 * pad - (hasIc ? iconSize + 14 : 0) - (hasTr ? iconSize + 12 : 0);
  let x0 = fit ? x + pad : x + (w - total) / 2;
  if (variant === 'ghost' || (b.align === 'left')) x0 = x + pad;
  const cy = y + h / 2;
  if (hasIc) {
    icon(g, ic, x0 + iconSize / 2, cy, iconSize, col, 2.1);
    x0 += iconSize + (label ? 14 : 0);
  }
  if (label) {
    const maxW = w - (x0 - x) - pad - (hasTr ? iconSize + 12 : 0);
    txt(g, label, x0, cy + size * 0.36, { size, weight, color: col, maxWidth: Math.max(30, maxW) });
    x0 += Math.min(tw, maxW);
  }
  if (hasTr) icon(g, trailing, x0 + 12 + iconSize / 2, cy, iconSize, col, 2.1);
  g.restore();
}

// ───────── Componentes ─────────
export function chip(g, x, y, label, o = {}) {
  const { color = T.violet, ic = null, size = 19, weight = 650, h = 38, bg = null, dot = false } = o;
  g.font = font(weight, size);
  const tw = g.measureText(label).width;
  const pad = 16;
  const iw = ic ? 22 : dot ? 14 : 0;
  const w = tw + pad * 2 + iw + (ic || dot ? 6 : 0);
  rr(g, x, y, w, h, h / 2);
  g.fillStyle = bg || 'rgba(255,255,255,0.07)';
  g.fill();
  rr(g, x + 0.5, y + 0.5, w - 1, h - 1, h / 2);
  g.strokeStyle = color + '55';
  g.lineWidth = 1.2;
  g.stroke();
  let cx = x + pad;
  if (ic) {
    icon(g, ic, cx + 10, y + h / 2, 22, color, 2);
    cx += iw + 6;
  } else if (dot) {
    g.beginPath();
    g.arc(cx + 5, y + h / 2, 5, 0, Math.PI * 2);
    g.fillStyle = color;
    g.fill();
    cx += iw + 6;
  }
  txt(g, label, cx, y + h / 2 + size * 0.35, { size, weight, color });
  return w;
}

export function chipWidth(g, label, o = {}) {
  const { size = 19, weight = 650, ic = null, dot = false } = o;
  g.font = font(weight, size);
  return g.measureText(label).width + 32 + (ic ? 22 : dot ? 14 : 0) + (ic || dot ? 6 : 0);
}

export function eyebrow(g, s, x, y, color = T.amber) {
  txt(g, String(s).toUpperCase(), x, y, { size: 17, weight: 700, color, spacing: 2.4 });
}

export function ring(g, cx, cy, r, value, o = {}) {
  const { color = T.mint, track = 'rgba(255,255,255,0.1)', width = 10, label = '', size = 0 } = o;
  g.save();
  g.lineCap = 'round';
  g.lineWidth = width;
  g.strokeStyle = track;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = color;
  g.beginPath();
  g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, Math.min(1, value)));
  g.stroke();
  g.restore();
  if (label !== '') txt(g, label, cx, cy + (size || r * 0.5) * 0.36, { size: size || r * 0.6, weight: 800, family: 'display', align: 'center', color: T.text });
}

export function progressBar(g, x, y, w, h, value, o = {}) {
  rr(g, x, y, w, h, h / 2);
  g.fillStyle = 'rgba(255,255,255,0.1)';
  g.fill();
  const fw = Math.max(h, w * Math.max(0, Math.min(1, value)));
  rr(g, x, y, fw, h, h / 2);
  g.fillStyle = o.color || aurora(g, x, y, x + w, y);
  g.fill();
}

export function dot(g, x, y, r, color) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
}

// ───────── Luma 2D ─────────
// mood: idle | thinking | success | review | alert. look: -1..1 hacia dónde mira.
export function luma(g, cx, cy, size = 30, o = {}) {
  const { mood = 'idle', t = 0, look = { x: 0, y: 0 }, glow = true } = o;
  const s = size;
  g.save();
  g.translate(cx, cy + Math.sin(t * 1.6) * s * 0.05);
  if (glow) {
    const halo = g.createRadialGradient(0, 0, s * 0.6, 0, 0, s * 2.1);
    const c = mood === 'alert' ? '241,220,174' : mood === 'success' ? '146,232,200' : '169,199,255';
    halo.addColorStop(0, `rgba(${c},0.38)`);
    halo.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = halo;
    g.beginPath();
    g.arc(0, 0, s * 2.1, 0, Math.PI * 2);
    g.fill();
  }
  // órbita
  g.save();
  g.rotate(-0.38);
  g.scale(1, 0.28);
  g.beginPath();
  g.arc(0, 0, s * 1.38, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(241,220,174,0.55)';
  g.lineWidth = Math.max(2, s * 0.07);
  g.stroke();
  g.restore();
  // cuerpo (esfera)
  const body = g.createRadialGradient(-s * 0.35, -s * 0.45, s * 0.1, 0, 0, s * 1.1);
  body.addColorStop(0, '#d9cfff');
  body.addColorStop(0.45, '#9d8cff');
  body.addColorStop(1, '#4f3fbf');
  g.beginPath();
  g.arc(0, 0, s, 0, Math.PI * 2);
  g.fillStyle = body;
  g.fill();
  // visor
  const vw = s * 1.5,
    vh = s * 0.88;
  rr(g, -vw / 2, -vh / 2 + s * 0.04, vw, vh, vh * 0.48);
  const vis = g.createLinearGradient(0, -vh / 2, 0, vh / 2);
  vis.addColorStop(0, '#1b1530');
  vis.addColorStop(1, '#0d0a18');
  g.fillStyle = vis;
  g.fill();
  // ojos
  const blink = mood === 'idle' && Math.sin(t * 0.9) > 0.985 ? 0.12 : 1;
  const ex = s * 0.3,
    ey = s * 0.04,
    lx = look.x * s * 0.1,
    ly = look.y * s * 0.07;
  g.fillStyle = mood === 'alert' ? T.warn : T.mint;
  g.strokeStyle = g.fillStyle;
  g.lineWidth = s * 0.13;
  g.lineCap = 'round';
  for (const dx of [-1, 1]) {
    const x = dx * ex + lx;
    if (mood === 'success') {
      g.beginPath();
      g.arc(x, ey + s * 0.08, s * 0.14, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    } else if (mood === 'thinking') {
      const k = (Math.sin(t * 4 + dx) + 1) / 2;
      g.beginPath();
      g.arc(x + (k - 0.5) * s * 0.12, ey + ly, s * 0.1, 0, Math.PI * 2);
      g.fill();
    } else {
      g.beginPath();
      g.ellipse(x, ey + ly, s * 0.095, s * (mood === 'review' && dx > 0 ? 0.13 : 0.175) * blink, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  // brillo
  g.beginPath();
  g.ellipse(-s * 0.38, -s * 0.62, s * 0.32, s * 0.13, -0.5, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.fill();
  // satélite en órbita
  const a = t * (mood === 'thinking' ? 3.2 : 0.9);
  const ox = Math.cos(a) * s * 1.38,
    oy = Math.sin(a) * s * 1.38 * 0.28;
  g.save();
  g.rotate(-0.38);
  g.beginPath();
  g.arc(ox, oy, s * 0.1, 0, Math.PI * 2);
  g.fillStyle = T.amber;
  g.fill();
  g.restore();
  if (mood === 'success') sparkle(g, s * 1.1, -s * 0.9, s * 0.5, T.amber);
  g.restore();
}

// Anillo de pasos (stepper) y tarjetas de miniatura
export function thumbFrame(g, x, y, w, h, r = 18) {
  rr(g, x, y, w, h, r);
  g.fillStyle = 'rgba(8,7,14,0.7)';
  g.fill();
}
