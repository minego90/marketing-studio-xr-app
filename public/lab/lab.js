// Laboratorio demo: oficina 3D + salas con herramientas reales y gratuitas. No toca la app principal.
import * as THREE from '../vendor/three.module.js';
import { createOffice, ROOMS } from './office3d.js';
import { attachXR } from './office-xr.js';
import { createStage, TEMPLATES, COMMON, defaults, sampleTexture } from './templates.js';
import { frameFromHands, fitAspect, nearestFormat, createSteady } from './handframe.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const office = createOffice($('#scene'));
office.watchServer();
office.autoReports(600);
let tmode = 'auto';
const tl = { auto: 'Hora: automática', atardecer: 'Atardecer', noche: 'Noche' };
office.setTime('auto');
const xrCtl = attachXR(office, { button: document.getElementById('xrbtn'), onState: on => { document.body.classList.toggle('inxr', on); } });
window.__xr = xrCtl;
$('#time').onclick = () => {
  tmode = { auto: 'atardecer', atardecer: 'noche', noche: 'auto' }[tmode];
  office.setTime(tmode);
  $('#time').textContent = '🌗 ' + tl[tmode];
};
const EV = [['images_ready', '🖼 Imágenes listas', { n: 12 }], ['copy_ready', '✍️ Plan de textos'], ['idea_ready', '💡 Idea de publicación'], ['video_ready', '🎬 Video listo'], ['xr_ad_ready', '🕶 Anuncio XR listo'], ['review_done', '✅ Revisión 92/100', { score: 92 }], ['ads_draft', '📣 Borrador de pauta (pausado)'], ['ads_active', '🚀 Pauta activa'], ['published', '🎉 Publicado'], ['metrics', '📊 Reporte de métricas'], ['failed', '⚠️ Algo falló']];
$('#evs').innerHTML = EV.map(([k, l], i) => `<button class="btn" data-i="${i}">${l}</button>`).join('');
$('#evs').onclick = e => { const b = e.target.closest('button'); if (b) office.notify(EV[b.dataset.i][0], EV[b.dataset.i][2] || {}); };
$('#evt').onclick = () => $('#evs').classList.toggle('open');
const api = async (p, d) => {
  const r = await fetch('/api/' + p, d ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) } : {});
  if (!r.ok) throw Error('HTTP ' + r.status);
  return r.json();
};
let current = null,
  cleanup = [];
const drawer = $('#drawer');

function open(id) {
  if (!ROOMS.find(x => x.id === id)) return;
  cleanup.splice(0).forEach(f => f());
  current = id;
  const r = ROOMS.find(x => x.id === id);
  $('#who').textContent = 'Agente · ' + r.agent;
  $('#title').textContent = r.name;
  const body = $('#body');
  body.innerHTML = '';
  office.focus(id);
  office.setActive(id, true);
  drawer.classList.add('open');
  ({ estudio, redaccion, taller, pauta, analitica, revision })[id](body);
}
function close() {
  cleanup.splice(0).forEach(f => f());
  drawer.classList.remove('open');
  office.focus(null);
  current = null;
}
$('#close').onclick = close;
office.onPick(open);
addEventListener('keydown', e => e.key === 'Escape' && close());
let allOn = false;
$('#all').onclick = () => {
  allOn = !allOn;
  ROOMS.forEach(r => office.setActive(r.id, allOn));
  $('#all').textContent = allOn ? 'Pausar a todos' : 'Activar a todos';
  $('#all').classList.toggle('on', allOn);
};
const card = (html, parent) => {
  const d = document.createElement('div');
  d.className = 'card';
  d.innerHTML = html;
  parent.append(d);
  return d;
};

// ———————————————————— Estudio: marco con las manos ————————————————————
function estudio(body) {
  card(`<h3>Foto con el marco de tus manos</h3><div class="muted">Forma un rectángulo con pulgar e índice de cada mano. Quédate quieto 1 segundo y esa es la toma. Aquí lo pruebas con el mouse; en las gafas, con tus manos reales.</div>`, body);
  const c = card(`<canvas class="view" id="hf" width="520" height="390"></canvas>
    <div class="row" style="margin-top:10px"><button class="btn" id="cam">Usar webcam</button><button class="btn primary" id="xr" disabled>Probar con mis manos (gafas)</button></div>
    <div class="kv" style="margin-top:12px" id="hfInfo"></div>`, body);
  const out = card(`<h3>Tomas</h3><div class="thumbs" id="shots"><span class="faint">Aún sin tomas. Mueve los 4 puntos y mantén el marco.</span></div>`, body);
  const cv = $('#hf'),
    g = cv.getContext('2d');
  const W = cv.width,
    H = cv.height;
  const pts = { lt: { x: 150, y: 120 }, li: { x: 150, y: 80 }, rt: { x: 380, y: 270 }, ri: { x: 380, y: 310 } };
  let drag = null,
    video = null;
  const sample = document.createElement('canvas');
  sample.width = W;
  sample.height = H;
  (function drawSample() {
    const s = sample.getContext('2d');
    const gr = s.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#2b2250');
    gr.addColorStop(1, '#4a2f4f');
    s.fillStyle = gr;
    s.fillRect(0, 0, W, H);
    s.fillStyle = '#3b2a4f';
    s.beginPath();
    s.roundRect(230, 110, 70, 190, 18);
    s.fill();
    s.fillStyle = '#b89a6a';
    s.fillRect(247, 80, 36, 36);
    s.fillStyle = '#efe4c8';
    s.fillRect(238, 190, 54, 64);
    s.fillStyle = 'rgba(255,255,255,.08)';
    s.fillRect(0, 320, W, 70);
  })();
  const steady = createSteady({ ms: 1000, tol: 8 });
  const shots = [];
  let flashAt = 0,
    raf = 0;
  const frameNow = () =>
    frameFromHands({ thumb: pts.lt, index: pts.li }, { thumb: pts.rt, index: pts.ri });
  function loop(t) {
    raf = requestAnimationFrame(loop);
    g.drawImage(video || sample, 0, 0, W, H);
    const r = frameNow();
    const s = steady.update(r, t);
    if (r) {
      g.fillStyle = 'rgba(0,0,0,.45)';
      g.beginPath();
      g.rect(0, 0, W, H);
      g.rect(r.x, r.y, r.w, r.h);
      g.fill('evenodd');
      g.strokeStyle = s.steady ? '#7fe9bf' : '#ffc78c';
      g.lineWidth = 3;
      g.strokeRect(r.x, r.y, r.w, r.h);
      g.fillStyle = '#ffc78c';
      g.font = '700 13px Inter';
      g.fillText(nearestFormat(r.aspect)[0] + ' · ' + Math.round(r.w) + '×' + Math.round(r.h), r.x + 6, r.y - 8);
      g.strokeStyle = 'rgba(255,255,255,.6)';
      g.lineWidth = 1;
      g.beginPath();
      for (let i = 1; i < 3; i++) {
        g.moveTo(r.x + (r.w * i) / 3, r.y);
        g.lineTo(r.x + (r.w * i) / 3, r.y + r.h);
        g.moveTo(r.x, r.y + (r.h * i) / 3);
        g.lineTo(r.x + r.w, r.y + (r.h * i) / 3);
      }
      g.stroke();
      if (s.progress > 0) {
        g.strokeStyle = '#7fe9bf';
        g.lineWidth = 6;
        g.beginPath();
        g.arc(r.cx, r.cy, 22, -Math.PI / 2, -Math.PI / 2 + s.progress * Math.PI * 2);
        g.stroke();
      }
      if (s.steady && t - flashAt > 1500) {
        flashAt = t;
        const k = document.createElement('canvas');
        k.width = Math.round(r.w);
        k.height = Math.round(r.h);
        k.getContext('2d').drawImage(video || sample, r.x, r.y, r.w, r.h, 0, 0, k.width, k.height);
        shots.push({ url: k.toDataURL('image/jpeg', 0.85), fmt: nearestFormat(r.aspect)[0], w: k.width, h: k.height });
        steady.reset();
        renderShots();
      }
    }
    for (const [k, p] of Object.entries(pts)) {
      g.beginPath();
      g.arc(p.x, p.y, 11, 0, Math.PI * 2);
      g.fillStyle = k.endsWith('t') ? '#a392ff' : '#ff8fb8';
      g.fill();
      g.strokeStyle = '#fff';
      g.lineWidth = 2;
      g.stroke();
    }
    if (t - flashAt < 180) {
      g.fillStyle = 'rgba(255,255,255,' + (1 - (t - flashAt) / 180) * 0.8 + ')';
      g.fillRect(0, 0, W, H);
    }
    $('#hfInfo').innerHTML = r
      ? `<span>Formato</span><span>${nearestFormat(r.aspect)[0]}</span><span>Marco</span><span>${Math.round(r.w)}×${Math.round(r.h)} px</span><span>Estado</span><span class="${s.steady ? 'ok' : 'warn'}">${s.steady ? '¡Toma!' : 'Mantén quieto… ' + Math.round(s.progress * 100) + '%'}</span>`
      : '<span>Estado</span><span class="bad">No se ve un marco válido</span>';
  }
  function renderShots() {
    $('#shots').innerHTML = shots.map(s => `<figure style="margin:0"><img src="${s.url}"><figcaption class="faint">${esc(s.fmt)} · ${s.w}×${s.h}</figcaption></figure>`).join('');
  }
  const at = e => {
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  cv.onpointerdown = e => {
    const p = at(e);
    const k = Object.entries(pts).sort((a, b) => Math.hypot(a[1].x - p.x, a[1].y - p.y) - Math.hypot(b[1].x - p.x, b[1].y - p.y))[0];
    if (Math.hypot(k[1].x - p.x, k[1].y - p.y) < 40) {
      drag = k[0];
      cv.setPointerCapture(e.pointerId);
    }
  };
  cv.onpointermove = e => drag && Object.assign(pts[drag], at(e));
  cv.onpointerup = () => (drag = null);
  raf = requestAnimationFrame(loop);
  cleanup.push(() => {
    cancelAnimationFrame(raf);
    video?.srcObject?.getTracks().forEach(t => t.stop());
  });
  $('#cam').onclick = async () => {
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      video = document.createElement('video');
      video.srcObject = st;
      video.muted = true;
      await video.play();
      $('#cam').textContent = 'Webcam activa';
    } catch (e) {
      $('#cam').textContent = 'Sin webcam: ' + e.message.slice(0, 30);
    }
  };
  if (navigator.xr) navigator.xr.isSessionSupported('immersive-ar').then(ok => ($('#xr').disabled = !ok));
  $('#xr').onclick = () => startXRHandFrame(out);
}

// Prueba con manos reales en las gafas: dibuja el marco en 3D y reporta qué soporta el navegador.
async function startXRHandFrame(host) {
  const log = card(`<h3>Prueba en las gafas</h3><div id="xrlog" class="kv"></div>`, host);
  const set = (k, v, cls = '') => {
    const l = $('#xrlog');
    let row = l.querySelector(`[data-k="${k}"]`);
    if (!row) l.insertAdjacentHTML('beforeend', `<span>${k}</span><span data-k="${k}"></span>`), (row = l.querySelector(`[data-k="${k}"]`));
    row.className = cls;
    row.textContent = v;
  };
  try {
    const renderer = office.renderer;
    const session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking', 'camera-access'] });
    renderer.xr.enabled = true;
    const granted = session.enabledFeatures || [];
    set('Seguimiento de manos', granted.includes('hand-tracking') ? 'activo' : 'NO disponible', granted.includes('hand-tracking') ? 'ok' : 'bad');
    set('Acceso a la cámara (captura real)', granted.includes('camera-access') ? 'activo' : 'no disponible: el marco se mide, la foto no se recorta', granted.includes('camera-access') ? 'ok' : 'warn');
    const xs = new THREE.Scene();
    const frameGeo = new THREE.BufferGeometry();
    const line = new THREE.LineLoop(frameGeo, new THREE.LineBasicMaterial({ color: 0xffc78c }));
    line.frustumCulled = false;
    xs.add(line);
    const steady = createSteady({ ms: 1000, tol: 0.02 });
    let shots = 0;
    const hands = [renderer.xr.getHand(0), renderer.xr.getHand(1)];
    hands.forEach(h => xs.add(h));
    await renderer.xr.setSession(session);
    const saved = office.scene;
    renderer.setAnimationLoop((t, frame) => {
      if (!frame) return;
      const cam = renderer.xr.getCamera();
      const inv = cam.matrixWorldInverse;
      const ref = renderer.xr.getReferenceSpace();
      const local = [];
      const get = (src, name) => {
        const j = src.hand?.get(name);
        const p = j && frame.getJointPose(j, ref);
        if (!p) return null;
        const v = new THREE.Vector3(p.transform.position.x, p.transform.position.y, p.transform.position.z);
        return { w: v.clone(), l: v.clone().applyMatrix4(inv) };
      };
      const hs = [...session.inputSources].filter(s => s.hand);
      const L = hs.find(s => s.handedness === 'left'),
        R = hs.find(s => s.handedness === 'right');
      const pts = L && R ? [get(L, 'thumb-tip'), get(L, 'index-finger-tip'), get(R, 'thumb-tip'), get(R, 'index-finger-tip')] : [];
      let r = null;
      if (pts.length === 4 && pts.every(Boolean)) r = frameFromHands({ thumb: pts[0].l, index: pts[1].l }, { thumb: pts[2].l, index: pts[3].l });
      const s = steady.update(r, t);
      if (r) {
        const z = pts.reduce((a, p) => a + p.l.z, 0) / 4;
        const c = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]].map(([x, y]) => new THREE.Vector3(x, y, z).applyMatrix4(cam.matrixWorld));
        frameGeo.setFromPoints(c);
        line.material.color.set(s.steady ? 0x7fe9bf : 0xffc78c);
        line.visible = true;
        set('Marco', `${nearestFormat(r.aspect)[0]} · ${(r.w * 100).toFixed(0)}×${(r.h * 100).toFixed(0)} cm`, s.steady ? 'ok' : 'warn');
        if (s.steady) {
          shots++;
          steady.reset();
          set('Tomas con marco', String(shots), 'ok');
        }
      } else {
        line.visible = false;
        set('Marco', hs.length < 2 ? 'muestra las dos manos' : 'forma el rectángulo', 'warn');
      }
      renderer.render(xs, cam);
    });
    session.addEventListener('end', () => {
      renderer.xr.enabled = false;
      renderer.setAnimationLoop(null);
      location.reload();
    });
  } catch (e) {
    set('Error', e.message, 'bad');
  }
}

// ———————————————————— Redacción ————————————————————
async function redaccion(body) {
  let m = {};
  try {
    m = await api('monitor');
  } catch {}
  const cap = m.latestCaption || 'Esta noche, lo cotidiano se vuelve extraordinario. Descubre nuestra propuesta de Halloween. #Halloween #AumentadosCo';
  card(`<h3>Copy de la última campaña</h3><textarea id="cap" rows="5">${esc(cap)}</textarea><div class="row" style="margin-top:10px"><button class="btn primary" id="rev">Revisar gratis</button></div><div id="out"></div>`, body);
  $('#rev').onclick = async () => {
    const r = await api('agent/review', { caption: $('#cap').value, headlines: [], mode: 'demo' });
    $('#out').innerHTML = `<p><span class="pill ${r.verdict === 'listo' ? '' : 'warn'}">${r.score}/100 · ${esc(r.verdict)}</span></p>` + r.findings.map(f => `<p><b>${esc(f.message)}</b><br><span class="muted">${esc(f.fix)}</span></p>`).join('');
  };
}

// ———————————————————— Taller: plantillas con parámetros ————————————————————
async function taller(body) {
  let faces = [];
  try {
    const b = await api('xr-ad/bundle');
    faces = await Promise.all(b.faces.map(f => new Promise(res => new THREE.TextureLoader().load(f.url, t => ((t.colorSpace = THREE.SRGBColorSpace), res(t)), undefined, () => res(null)))));
    faces = faces.filter(Boolean);
  } catch {}
  if (!faces.length) faces = [0, 1, 2, 3].map(sampleTexture);
  const top = card(`<div class="tabs" id="tt"></div><p class="faint" id="tb"></p><canvas class="view" id="st" style="height:300px"></canvas><div class="kv" style="margin-top:10px" id="ss"></div>`, body);
  const ai = card(`<h3>Una instrucción → una escena</h3><div class="muted">Describe el anuncio y las plantillas se ajustan solas. Es un compositor local (reglas), gratis. Con Muse Spark real sería la versión conectada.</div><input type="text" id="prompt" placeholder="Ej: portal nocturno, luz cálida, titular «Despierta la noche»" style="margin-top:8px"><div class="row" style="margin-top:8px"><button class="btn primary" id="go">Componer</button></div><div id="why" class="faint"></div>`, body);
  const ctl = card(`<h3>Parámetros</h3><div id="ctl"></div><div class="row" style="margin-top:12px"><button class="btn" id="exp">Copiar parámetros (JSON)</button><button class="btn" id="png">Guardar imagen</button></div>`, body);
  const cv = $('#st');
  const stage = createStage(cv, 'prism', { faces });
  const sz = () => stage.resize(cv.clientWidth, 300);
  sz();
  let alive = true,
    last = 0;
  const loop = t => {
    if (!alive) return;
    requestAnimationFrame(loop);
    stage.render(t, Math.min(0.05, (t - last) / 1000 || 0.016));
    last = t;
    const s = stage.stats;
    $('#ss').innerHTML = `<span>Triángulos</span><span class="${s.tris < 100000 ? 'ok' : 'bad'}">${s.tris.toLocaleString('es')} (límite XR 100 k)</span><span>Objetos</span><span>${s.objects}</span><span>FPS oficina</span><span>${office.fps()}</span>`;
  };
  requestAnimationFrame(loop);
  cleanup.push(() => {
    alive = false;
    stage.renderer.dispose();
  });
  // el renderer principal sigue usando su propio contexto; el de la plantilla vive solo mientras la sala está abierta
  function tabs() {
    $('#tt').innerHTML = Object.entries(TEMPLATES).map(([k, t]) => `<button class="btn ${stage.kind === k ? 'on' : ''}" data-k="${k}">${t.name}</button>`).join('');
    $('#tb').textContent = TEMPLATES[stage.kind].blurb;
    $('#tt').querySelectorAll('button').forEach(b => (b.onclick = () => (stage.setKind(b.dataset.k), tabs(), controls())));
  }
  function controls() {
    const box = $('#ctl');
    box.innerHTML = '';
    for (const p of [...COMMON, ...TEMPLATES[stage.kind].params]) {
      const d = document.createElement('div');
      const v = stage.params[p.id];
      d.innerHTML = `<label>${p.label}${p.type === 'range' ? ` · <span data-v>${v}</span>` : ''}</label>` + (p.type === 'range' ? `<input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${v}">` : p.type === 'color' ? `<input type="color" value="${v}">` : `<input type="text" value="${esc(v)}">`);
      const i = d.querySelector('input');
      i.oninput = () => {
        const val = p.type === 'range' ? +i.value : i.value;
        stage.set(p.id, val);
        d.querySelector('[data-v]') && (d.querySelector('[data-v]').textContent = val);
      };
      box.append(d);
    }
  }
  tabs();
  controls();
  $('#exp').onclick = () => {
    navigator.clipboard?.writeText(JSON.stringify({ template: stage.kind, params: stage.params }, null, 2));
    $('#exp').textContent = 'Copiado ✓';
  };
  $('#png').onclick = () => {
    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.download = 'anuncio-xr-' + stage.kind + '.png';
    a.click();
  };
  $('#go').onclick = () => {
    const t = $('#prompt').value.toLowerCase();
    const why = [];
    const kind = /portal|puerta|t[uú]nel/.test(t) ? 'portal' : /carrusel|arco|p[oó]ster/.test(t) ? 'arc' : /prisma|bloque|cubo/.test(t) ? 'prism' : stage.kind;
    if (kind !== stage.kind) (stage.setKind(kind), why.push('plantilla ' + TEMPLATES[kind].name));
    const apply = (k, v, w) => (stage.set(k, v), why.push(w));
    if (/noche|oscur|halloween|misterio/.test(t)) (apply('bg', '#0d0a1c', 'fondo nocturno'), apply('accent', '#ff7a3d', 'acento naranja'));
    if (/ne[oó]n|futur/.test(t)) (apply('bg', '#0a0f1f', 'fondo azul profundo'), apply('accent', '#4dffd2', 'acento neón'));
    if (/c[aá]lid|dorad|atardecer/.test(t)) apply('warm', 0.95, 'luz cálida');
    if (/fr[ií]a|hielo|azul/.test(t)) apply('warm', 0.05, 'luz fría');
    if (/brillante|luminos|claro/.test(t)) apply('light', 2.4, 'más luz');
    if (/suave|tenue/.test(t)) apply('light', 0.9, 'luz suave');
    if (/r[aá]pid/.test(t)) apply('speed', 1.4, 'giro rápido');
    if (/lent|calma|elegante/.test(t)) apply('speed', 0.25, 'giro lento');
    const q = t.match(/[«"“]([^»"”]+)[»"”]/);
    if (q) apply('title', q[1], 'titular «' + q[1] + '»');
    tabs();
    controls();
    $('#why').textContent = why.length ? 'Apliqué: ' + why.join(', ') + '.' : 'No encontré palabras clave. Prueba con «portal nocturno, luz cálida» o un titular entre comillas.';
  };
  addEventListener('resize', sz);
  cleanup.push(() => removeEventListener('resize', sz));
}

// ———————————————————— Pauta ————————————————————
async function pauta(body) {
  let m = {};
  try {
    m = await api('monitor');
  } catch {}
  const g = m.guard || {};
  card(`<h3>Guardián de pauta</h3><div class="kv"><span>Modo</span><span class="${g.mode === 'local-draft' ? 'ok' : 'warn'}">${esc(g.label || '—')}</span><span>Escritura a Meta</span><span class="${g.writeEnabled ? 'warn' : 'ok'}">${g.writeEnabled ? 'habilitada (solo PAUSED)' : 'apagada'}</span><span>APIs de pago</span><span class="${g.paidEnabled ? 'warn' : 'ok'}">${g.paidEnabled ? 'habilitadas' : 'apagadas'}</span></div>`, body);
  card(`<h3>Garantías</h3>${(g.guarantees || []).map(x => `<p class="muted">✓ ${esc(x)}</p>`).join('')}`, body);
  card(`<div class="muted">El borrador de pauta se prepara en el estudio principal.</div><div class="row" style="margin-top:10px"><a class="btn primary" href="/">Abrir estudio</a></div>`, body);
}

// ———————————————————— Analítica / monitoreo ————————————————————
async function analitica(body) {
  const sys = card('<h3>Monitoreo del sistema <span class="pill">EN VIVO</span></h3><div id="sys" class="kv"></div><div id="alerts"></div>', body);
  const rnd = (() => {
    let s = 7;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();
  const days = 14;
  const series = {
    Visualizaciones: Array.from({ length: days }, (_, i) => Math.round(900 + i * 95 + rnd() * 400)),
    Alcance: Array.from({ length: days }, (_, i) => Math.round(600 + i * 60 + rnd() * 300)),
    Guardados: Array.from({ length: days }, (_, i) => Math.round(20 + i * 4 + rnd() * 25))
  };
  const colors = ['#ffc78c', '#a392ff', '#7fe9bf'];
  const max = Math.max(...series.Visualizaciones);
  const svg = Object.entries(series)
    .map(([k, v], si) => {
      const m = Math.max(...v);
      return `<polyline fill="none" stroke="${colors[si]}" stroke-width="3" stroke-linecap="round" points="${v.map((y, i) => `${20 + (i * 480) / (days - 1)},${170 - (y / (si ? m * 1.6 : max)) * 140}`).join(' ')}"/>`;
    })
    .join('');
  card(`<h3>Rendimiento de contenido <span class="pill warn">DATOS DE EJEMPLO</span></h3><svg viewBox="0 0 520 190" width="100%">${svg}<text x="20" y="186">hace 14 días</text><text x="470" y="186">hoy</text></svg><div class="row">${Object.keys(series).map((k, i) => `<span class="chip" style="border-color:${colors[i]}66">${k}: <b style="color:${colors[i]}">${series[k].at(-1).toLocaleString('es')}</b></span>`).join('')}</div><p class="faint">Son números inventados para ver el diseño. Con Instagram Insights (solo lectura) se llenaría con tus métricas reales: es gratis, pero necesita el token de tu cuenta.</p>`, body);
  let alive = true;
  async function tick() {
    if (!alive) return;
    try {
      const m = await api('monitor');
      $('#sys').innerHTML = `<span>Servidor activo</span><span class="ok">${Math.round(m.uptimeSec / 60)} min · ${m.memoryMb} MB</span><span>Trabajos</span><span>${m.jobs.total} (${m.jobs.running} en curso, ${m.jobs.failed} fallidos)</span><span>Gasto estimado</span><span class="${m.spend.estimatedUsd ? 'bad' : 'ok'}">$${m.spend.estimatedUsd.toFixed(2)}</span><span>Trabajos con API real</span><span class="${m.spend.realApiJobs ? 'warn' : 'ok'}">${m.spend.realApiJobs}</span><span>FPS de la oficina 3D</span><span class="${office.fps() >= 55 ? 'ok' : 'warn'}">${office.fps()}</span>`;
      const al = [];
      if (m.spend.paidApisEnabled) al.push(['warn', 'APIs de pago habilitadas']);
      if (m.guard?.writeEnabled) al.push(['warn', 'Escritura a Meta Ads habilitada (solo PAUSED)']);
      if (m.jobs.failed) al.push(['bad', m.jobs.failed + ' trabajo(s) fallido(s)']);
      if (m.spend.realApiJobs) al.push(['warn', 'Hay trabajos con APIs reales']);
      $('#alerts').innerHTML = al.length ? al.map(([c, t]) => `<p class="${c}">⚠ ${esc(t)}</p>`).join('') : '<p class="ok">✓ Sin alertas: nada gastado, nada activo.</p>';
    } catch {
      $('#sys').innerHTML = '<span>Servidor</span><span class="bad">sin respuesta</span>';
    }
    setTimeout(tick, 3000);
  }
  tick();
  cleanup.push(() => (alive = false));
}

// ———————————————————— Revisión ————————————————————
async function revision(body) {
  card(`<h3>Lista de confort XR</h3><div class="kv"><span>Distancia</span><span class="ok">0,8–2 m</span><span>Texto</span><span class="ok">≥ 1,5° de ángulo</span><span>Botones</span><span class="ok">≥ 4 cm</span><span>Triángulos</span><span class="ok">≤ 100 k</span><span>Cuadros</span><span class="ok">72–90 fps</span></div>`, body);
  card(`<h3>Revisión de copy</h3><div class="muted">Abre la Redacción para revisar el copy con el revisor gratuito.</div>`, body);
  card(`<h3>Reglas del equipo</h3><p class="muted">El revisor nunca aprueba nada por ti: propone, tú decides. Nada se publica ni se activa desde aquí.</p>`, body);
}

window.__lab = { office, open, close };
