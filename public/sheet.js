// Hoja de referencia del producto: las 4 vistas (frente, derecha, izquierda, atrás) en UNA sola imagen sobre fondo blanco.
// Sirve como referencia de identidad para la IA de video (el producto no cambia al verse desde varios ángulos).
export const SHEET_LAYOUTS = ['grid', 'row', 'wide'];
export const SHEET_LABELS = { front: 'FRENTE', right: 'DERECHA', left: 'IZQUIERDA', back: 'ATRÁS' };
export function sheetSize(layout) {
  return layout === 'row' ? [2048, 640] : layout === 'wide' ? [1600, 1000] : [1400, 1400];
}
// Posiciones de cada celda [x, y, w, h] según el diseño.
export function sheetCells(layout, n) {
  const [W, H] = sheetSize(layout),
    m = 36,
    gap = 24;
  if (layout === 'row') {
    const w = (W - 2 * m - gap * (n - 1)) / n;
    return Array.from({ length: n }, (_, i) => [m + i * (w + gap), m, w, H - 2 * m]);
  }
  const cols = layout === 'wide' ? 2 : 2,
    rows = Math.ceil(n / cols),
    w = (W - 2 * m - gap * (cols - 1)) / cols,
    h = (H - 2 * m - gap * (rows - 1)) / rows;
  return Array.from({ length: n }, (_, i) => [m + (i % cols) * (w + gap), m + Math.floor(i / cols) * (h + gap), w, h]);
}
// slots: [['front', imageElement], ...]; devuelve un canvas o null si no hay imágenes listas.
export function composeSheet(slots, layout = 'grid', makeCanvas = () => document.createElement('canvas')) {
  const ready = slots.filter(([, im]) => im && im.complete !== false && (im.naturalWidth || im.width));
  if (!ready.length) return null;
  const [W, H] = sheetSize(layout),
    c = makeCanvas();
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  const cells = sheetCells(layout, ready.length);
  ready.forEach(([key, im], i) => {
    const [x, y, w, h] = cells[i],
      iw = im.naturalWidth || im.width,
      ih = im.naturalHeight || im.height,
      pad = 38,
      s = Math.min(w / iw, (h - pad) / ih),
      dw = iw * s,
      dh = ih * s;
    g.drawImage(im, x + (w - dw) / 2, y + (h - pad - dh) / 2, dw, dh);
    g.fillStyle = '#6b6678';
    g.font = '600 26px sans-serif';
    g.textAlign = 'center';
    g.fillText(SHEET_LABELS[key] || '', x + w / 2, y + h - 8);
  });
  return c;
}
