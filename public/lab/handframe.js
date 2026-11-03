// Marco con las manos: del par de manos (pulgar + índice) sale un rectángulo de encuadre.
// Lógica pura, sin DOM ni three.js, para probarla sin gafas.
const ok = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);

/** left/right: { thumb:{x,y}, index:{x,y} } en cualquier unidad. Devuelve el rectángulo que contiene las 4 puntas. */
export function frameFromHands(left, right) {
  const pts = [left?.thumb, left?.index, right?.thumb, right?.index];
  if (!pts.every(ok)) return null;
  const xs = pts.map(p => p.x),
    ys = pts.map(p => p.y);
  const x = Math.min(...xs),
    y = Math.min(...ys),
    w = Math.max(...xs) - x,
    h = Math.max(...ys) - y;
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, aspect: w / h };
}

/** Ajusta el rectángulo a una proporción (p. ej. 4/5 de feed, 9/16 de historia) sin salirse de él. */
export function fitAspect(r, aspect) {
  if (!r) return null;
  let w = r.w,
    h = r.h;
  if (w / h > aspect) w = h * aspect;
  else h = w / aspect;
  return { x: r.cx - w / 2, y: r.cy - h / 2, w, h, cx: r.cx, cy: r.cy, aspect };
}

export function nearestFormat(aspect) {
  const f = [
    ['Feed 4:5', 4 / 5],
    ['Historia/Reel 9:16', 9 / 16],
    ['Cuadrado 1:1', 1],
    ['Horizontal 16:9', 16 / 9]
  ];
  return f.reduce((a, b) => (Math.abs(Math.log(b[1] / aspect)) < Math.abs(Math.log(a[1] / aspect)) ? b : a));
}

/** Detector de «quieto»: dispara cuando el centro y el tamaño no cambian más que `tol` durante `ms`. */
export function createSteady({ ms = 1000, tol = 0.025 } = {}) {
  let anchor = null,
    since = 0;
  return {
    update(r, now) {
      if (!r) {
        anchor = null;
        return { steady: false, progress: 0 };
      }
      const moved = !anchor || Math.hypot(r.cx - anchor.cx, r.cy - anchor.cy) > tol || Math.abs(r.w - anchor.w) > tol * 1.5 || Math.abs(r.h - anchor.h) > tol * 1.5;
      if (moved) {
        anchor = r;
        since = now;
        return { steady: false, progress: 0 };
      }
      const progress = Math.min(1, (now - since) / ms);
      return { steady: progress >= 1, progress };
    },
    reset() {
      anchor = null;
    }
  };
}
