// Parrilla: todo lo que ya se publicó (carrusel, historia, reel). Se toca una pieza para verla grande.
import { getLang } from '../i18n.js';
import { button, tile, picture } from '../ui.js';
import { T, txt, wrapText, glass, chip, rr } from '../ui-kit.js';
import { state } from '../store.js';

const X = 40,
  W = 1320;
export const feedFilm = document.createElement('video');
feedFilm.playsInline = true;
feedFilm.loop = true;
feedFilm.muted = true;
feedFilm.preload = 'auto';
export const PER_PAGE = 4;
export const fmtLabel = f => (f.format === 'reel' ? 'Reel' : f.format === 'story' ? (f.isVideo ? 'Historia · video' : 'Historia') : 'Publicación');
const dateLabel = iso => {
  try {
    return new Date(iso).toLocaleDateString(getLang() === 'en' ? 'en-US' : 'es-CO', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
};

export function drawFeed(g) {
  const items = state.feed || [];
  txt(g, 'Mis publicaciones', X, 250, { size: 52, weight: 750, family: 'display', spacing: -1.4 });
  if (!items.length) {
    txt(g, 'Aún no hay nada publicado de verdad. Cuando publiques, aparecerá aquí y en la TV de la oficina.', X, 296, { size: 26, color: T.muted, maxWidth: W });
    button('nav:guide', 'Crear algo con la guía', X, 866, W, 84, { primary: true, trailing: 'arrow-right' });
    return;
  }
  const open = state.feedOpen && items.find(i => i.id === state.feedOpen);
  if (open) {
    txt(g, `${fmtLabel(open)} · ${dateLabel(open.createdAt)}`, X, 296, { size: 26, color: T.amber, weight: 650 });
    const w = 410,
      h = 640,
      x = X,
      y = 318;
    rr(g, x - 6, y - 6, w + 12, h + 12, 28);
    g.fillStyle = '#05040a';
    g.fill();
    if (open.video && feedFilm.readyState >= 2 && feedFilm.videoWidth) {
      const s = Math.min(w / feedFilm.videoWidth, h / feedFilm.videoHeight);
      g.drawImage(feedFilm, x + (w - feedFilm.videoWidth * s) / 2, y + (h - feedFilm.videoHeight * s) / 2, feedFilm.videoWidth * s, feedFilm.videoHeight * s);
    } else picture(open.thumb, x, y, w, h, { fit: 'contain', r: 22 });
    glass(g, 500, 318, 860, 420, 30, { strong: true });
    txt(g, 'TEXTO PUBLICADO', 530, 364, { size: 15, weight: 800, color: T.amber, spacing: 1.6 });
    wrapText(g, open.caption || 'Sin texto guardado.', 530, 408, 800, { size: 24, color: T.text, line: 34, maxLines: 8 });
    if (open.video) {
      button('feed:play', feedFilm.paused ? '▶ Reproducir' : '⏸ Pausar', 500, 764, 300, 76, { small: true });
      button('feed:sound', feedFilm.muted ? '🔇 Activar sonido' : '🔊 Sonido activo', 820, 764, 330, 76, { small: true });
    }
    if (open.permalink) button('feed:ig', '↗ Ver en Instagram', 500, 862, 460, 84, { primary: !open.video });
    button('feed:close', '← Todas', open.permalink ? 980 : 500, 862, 380, 84, {});
    return;
  }
  const pages = Math.ceil(items.length / PER_PAGE),
    pg = Math.min(state.feedPage || 0, pages - 1);
  txt(g, `${items.length} publicaciones · toca una para verla grande`, X, 296, { size: 26, color: T.muted });
  items.slice(pg * PER_PAGE, pg * PER_PAGE + PER_PAGE).forEach((it, i) => {
    const x = X + i * 336;
    tile('feed:open:' + it.id, fmtLabel(it), x, 330, 312, 520, { r: 28 });
    picture(it.thumb, x + 10, 340, 292, 440, { fit: 'cover', r: 20 });
    chip(g, x + 22, 354, fmtLabel(it), { color: it.isVideo ? T.rose : T.mint, h: 36, size: 16 });
    txt(g, dateLabel(it.createdAt) + (it.isVideo ? '  ▶' : ''), x + 22, 818, { size: 21, weight: 650, color: T.text });
  });
  if (pages > 1) {
    button('feed:prev', '← Anteriores', X, 876, 300, 76, { small: true, disabled: pg === 0 });
    txt(g, `${pg + 1} / ${pages}`, 700, 922, { size: 22, color: T.muted, align: 'center' });
    button('feed:next', 'Siguientes →', 1060, 876, 300, 76, { small: true, disabled: pg >= pages - 1 });
  }
}
