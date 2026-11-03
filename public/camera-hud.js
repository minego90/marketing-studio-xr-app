import { PHOTO_SLOTS, CAPTURE_TIPS } from './studio-domain.js';

export function renderCameraHud(canvas, video, state, getImage) {
  const g = canvas.getContext('2d'),
    hits = [{ id: 'drag', label: 'Agarrar y girar la cámara', x: 0, y: 0, w: 1000, h: 1040, drag: true }];
  const box = (x, y, w, h, color, r = 18) => {
    g.fillStyle = color;
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.fill();
  };
  const text = (t, x, y, size = 24, color = '#f5f7fb', weight = 500) => {
    g.font = `${weight} ${size}px sans-serif`;
    g.fillStyle = color;
    g.fillText(String(t), x, y);
  };
  const button = (id, label, x, y, w, h, primary = false, disabled = false) => {
    // Pastilla con degradado, borde fino y brillo superior (más pequeña y limpia que el bloque plano anterior).
    const r = Math.min(h / 2, 34);
    const gr = g.createLinearGradient(0, y, 0, y + h);
    if (disabled) {
      gr.addColorStop(0, '#2a2e38');
      gr.addColorStop(1, '#20242c');
    } else if (primary) {
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(1, '#d9e2f0');
    } else {
      gr.addColorStop(0, '#3a414f');
      gr.addColorStop(1, '#2a303b');
    }
    g.fillStyle = gr;
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.fill();
    g.strokeStyle = disabled ? '#363b47' : primary ? '#ffffff' : '#8d99ad';
    g.lineWidth = 2.5;
    g.stroke();
    if (!disabled) {
      g.fillStyle = primary ? '#ffffff88' : '#ffffff1c';
      g.beginPath();
      g.roundRect(x + 10, y + 5, w - 20, h * 0.32, r * 0.6);
      g.fill();
    }
    const size = label.length > 16 ? 23 : 26;
    g.save();
    g.textAlign = 'center';
    text(label, x + w / 2, y + h / 2 + 9, size, disabled ? '#8a93a5' : primary ? '#0b0d12' : '#f5f7fb', 700);
    g.restore();
    hits.push({ id, label, x, y, w, h, disabled });
  };
  const media = (source, x, y, w, h) => {
    if (!source || !(source.naturalWidth || source.videoWidth || source.width)) return;
    const iw = source.videoWidth || source.naturalWidth || source.width,
      ih = source.videoHeight || source.naturalHeight || source.height,
      s = Math.min(w / iw, h / ih);
    g.drawImage(source, x + (w - iw * s) / 2, y + (h - ih * s) / 2, iw * s, ih * s);
  };
  const picture = (photo, x, y, w, h) => {
    const im = getImage(photo?.url);
    if (im?.complete && im.naturalWidth) media(im, x, y, w, h);
  };
  g.clearRect(0, 0, 1000, 1040);
  // Camera silhouette: raised viewfinder, top rail and textured side grip.
  box(255, 0, 370, 74, '#4a505c', 26);
  box(274, 12, 332, 48, '#0f1218', 15);
  box(0, 45, 1000, 995, '#454b57', 48);
  box(7, 53, 986, 980, '#1a1e26', 43);
  box(18, 130, 964, 888, '#222731', 30);
  for (let y = 345; y < 815; y += 22) box(9, y, 12, 11, '#6c7482', 4);
  box(40, 60, 795, 58, '#323845', 16);
  text('≡  AUMENTADOS · CÁMARA', 65, 100, 27, '#f1f4fa', 750);
  hits.push({ id: 'drag', label: 'Mantén la pinza y arrastra para mover la cámara', x: 40, y: 55, w: 795, h: 69, drag: true });
  button('hud-close', '×', 900, 58, 75, 65);
  text('Pinza para mover y girar · botones para tomar la foto', 30, 132, 22, '#c7cedb');
  PHOTO_SLOTS.forEach(([slot, label], i) => {
    const x = 30 + i * 238,
      p = state.photos[slot];
    box(x, 139, 220, 160, state.captureSlot === slot ? '#3a4458' : '#262b36');
    if (p) picture(p, x + 8, 148, 204, 102);
    else text(String(i + 1), x + 95, 215, 42, '#8a93a5', 700);
    text(label, x + 14, 281, 23, p ? '#b8e7cd' : '#aeb6c4', 650);
    hits.push({ id: 'hud-view:' + slot, label: 'Ver ' + label, x, y: 139, w: 220, h: 160 });
    if (p) button('hud-delete:' + slot, '×', x + 158, 145, 55, 52, false, state.captureBusy || state.busy);
  });
  box(30, 321, 940, 520, '#0a0c10');
  const review = state.hudReviewSlot && state.photos[state.hudReviewSlot];
  if (review) {
    picture(review, 40, 330, 920, 502);
    box(50, 341, 310, 45, '#161a22e8');
    text('VISTA · ' + PHOTO_SLOTS.find(([s]) => s === state.hudReviewSlot)[1].toUpperCase(), 65, 373, 22, '#f1dcae', 700);
  } else if (video.readyState >= 2) {
    media(video, 40, 330, 920, 502);
    text('EN DIRECTO', 56, 363, 19, '#b8e7cd', 700);
    g.strokeStyle = '#b8e7cdaa';
    g.lineWidth = 3;
    for (const [x, y, sx, sy] of [
      [65, 390, 1, 1],
      [935, 390, -1, 1],
      [65, 800, 1, -1],
      [935, 800, -1, -1]
    ]) {
      g.beginPath();
      g.moveTo(x + sx * 48, y);
      g.lineTo(x, y);
      g.lineTo(x, y + sy * 48);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(482, 581);
    g.lineTo(518, 581);
    g.moveTo(500, 563);
    g.lineTo(500, 599);
    g.stroke();
  } else {
    text('Preparando cámara…', 355, 583, 29, '#a9c7ff');
  }
  if (state.captureCountdown > 0) {
    box(30, 321, 940, 520, '#0a0c1077');
    g.beginPath();
    g.arc(500, 580, 98, 0, Math.PI * 2);
    g.fillStyle = '#161a22ea';
    g.fill();
    g.strokeStyle = '#f1dcae';
    g.lineWidth = 5;
    g.stroke();
    g.save();
    g.textAlign = 'center';
    text(state.captureCountdown, 500, 620, 112, '#ffffff', 800);
    g.restore();
  }
  const have = PHOTO_SLOTS.filter(([slot]) => state.photos[slot]).length;
  const choice = !!state.hudChoice && have > 0 && !state.captureBusy && !review;
  if (choice) {
    box(30, 321, 940, 520, '#0a0c10f2');
    g.save();
    g.textAlign = 'center';
    text(have === 4 ? 'Ya tienes las 4 fotos' : 'Ya tienes ' + have + (have === 1 ? ' foto' : ' fotos'), 500, 420, 46, '#ffffff', 800);
    text('¿Qué quieres hacer?', 500, 466, 28, '#c7cedb', 500);
    g.restore();
    button('hud-keep', have === 4 ? 'Usar las que ya tengo' : 'Seguir con las que tengo', 90, 520, 820, 130, true);
    button('hud-clearall', 'Borrar todo y empezar de nuevo', 90, 680, 820, 110, false);
  }
  const active = PHOTO_SLOTS.find(([slot]) => slot === state.captureSlot)?.[1] || 'Frente';
  const full = PHOTO_SLOTS.every(([slot]) => state.photos[slot]);
  const tip = state.captureBusy
    ? state.captureCountdown
      ? 'Mantén el encuadre… ' + state.captureCountdown
      : 'Guardando tu foto…'
    : review
      ? 'Abre otra miniatura, repite la vista o usa × para liberar el espacio.'
      : full && !state.hudReplaceSlot
        ? '¡Cuatro fotos listas! Pulsa «Continuar» para cerrar la cámara y seguir. (Puedes cambiar una con su miniatura.)'
        : active + ': ' + CAPTURE_TIPS[state.captureSlot];
  g.font = '21px sans-serif';
  let line = '',
    row = 0;
  for (const word of tip.split(/\s+/)) {
    if (g.measureText(line + word).width > 930 && line) {
      text(line, 35, 868 + row * 26, 21, '#c7cedb');
      row++;
      line = '';
      if (row === 2) break;
    }
    line += word + ' ';
  }
  if (row < 2) text(line, 35, 868 + row * 26, 21, '#c7cedb');
  if (review) {
    button('hud-live', '← Volver a cámara', 30, 919, 445, 75);
    button('hud-retake', 'Repetir esta vista', 495, 919, 475, 75, true, state.captureBusy || state.busy);
  } else if (choice) {
    // el aviso de arriba pide decidir primero
  } else if (full && !state.hudReplaceSlot) {
    button('hud-continue', '✓ 4/4 listas · Continuar →', 30, 897, 940, 98, true, state.captureBusy || state.busy);
  } else {
    const slotId = state.hudReplaceSlot || PHOTO_SLOTS.find(([s]) => !state.photos[s])?.[0];
    const idx = Math.max(0, PHOTO_SLOTS.findIndex(([s]) => s === slotId));
    const nm = PHOTO_SLOTS[idx][1];
    const label = state.captureBusy
      ? state.captureCountdown
        ? '● ' + state.captureCountdown + '…  no muevas el producto'
        : 'Guardando…'
      : state.hudReplaceSlot
        ? 'Toca para repetir la foto · ' + nm
        : have === 0
          ? 'Toca para tomar la foto 1 de 4 · ' + nm
          : 'Toca para tomar la siguiente · ' + nm + ' (' + (idx + 1) + ' de 4)';
    button('hud-shutter', label, 30, 897, 940, 98, true, state.captureBusy || state.busy || video.readyState < 2);
    button('capture-timer', state.captureTimer ? 'Conteo ON' : 'Conteo OFF', 790, 770, 170, 52, false, state.captureBusy);
  }
  text('Menú de muñeca: abrir / cerrar  ·  4 vistas del producto', 34, 1026, 18, '#a9b1c0');
  return hits;
}
