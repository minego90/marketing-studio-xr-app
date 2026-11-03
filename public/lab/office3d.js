// Oficina 3D de Marketing Studio XR: cuarto con luz horneada (Blender), personajes voxel pixel-art con cerebro propio.
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';
import { ROOMS } from './office.js';
import { LAYOUT } from './layout.js';
import { makePixelPerson, makePixelDog, setFace, setTint, WORKERS } from './pixelpeople.js';
import { orchestra } from '../orchestra.js';
import { makeRng, buildGrid, Worker, Dog, WORK_SAY } from './brain.js';
export { ROOMS };

const ASSETS = new URL('./assets/', import.meta.url).href;
const ease = k => k * k * (3 - 2 * k);
const hexOf = n => '#' + n.toString(16).padStart(6, '0');

function textSprite(cache, text, color, w = 512) {
  const key = text + color;
  let t = cache.get(key);
  if (!t) {
    const c = document.createElement('canvas'); c.width = w; c.height = 112;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(14,11,24,.9)'; g.beginPath(); g.roundRect(4, 4, w - 8, 90, 30); g.fill();
    g.strokeStyle = color; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#f6f3fd'; g.font = '600 34px Inter,system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, 50);
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; cache.set(key, t);
  }
  return t;
}
function bubbleSprite(cache, text, color) {
  const key = 'b|' + text + color;
  let t = cache.get(key);
  if (!t) {
    const W = 768, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const fit = (size, maxLines) => {
      g.font = `700 ${size}px Inter,system-ui,sans-serif`;
      const lines = []; let line = '';
      for (const w of String(text).split(/\s+/)) { const tryL = line ? line + ' ' + w : w; if (g.measureText(tryL).width > W - 80 && line) { lines.push(line); line = w; } else line = tryL; }
      lines.push(line);
      return lines.length <= maxLines ? lines : null;
    };
    let size = 60, lines = fit(size, 2);
    if (!lines) { size = 46; lines = fit(size, 3) || fit(36, 4) || [String(text).slice(0, 60)]; if (lines.length > 3) size = 36; }
    g.fillStyle = 'rgb(16,12,28)'; g.beginPath(); g.roundRect(6, 6, W - 12, H - 40, 38); g.fill();
    g.beginPath(); g.moveTo(W / 2 - 22, H - 36); g.lineTo(W / 2, H - 6); g.lineTo(W / 2 + 22, H - 36); g.closePath(); g.fill();
    g.strokeStyle = color; g.lineWidth = 6; g.beginPath(); g.roundRect(6, 6, W - 12, H - 40, 38); g.stroke();
    g.fillStyle = '#ffffff'; g.font = `700 ${size}px Inter,system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lh = size * 1.18, y0 = (H - 40) / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => g.fillText(l, W / 2, y0 + i * lh + 2));
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; cache.set(key, t);
    if (cache.size > 48) { const k0 = cache.keys().next().value; cache.get(k0)?.dispose?.(); cache.delete(k0); }
  }
  return t;
}
function glyph(g, key, cx, cy, r, col) {
  g.save(); g.translate(cx, cy); g.fillStyle = col; g.strokeStyle = col; g.lineCap = g.lineJoin = 'round'; g.lineWidth = r * 0.16;
  const u = r / 10;
  if (key === 'estudio') { g.beginPath(); g.roundRect(-9 * u, -5 * u, 18 * u, 13 * u, 2.5 * u); g.fill(); g.fillRect(-4 * u, -8.5 * u, 8 * u, 4 * u); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(0, 1.5 * u, 4.2 * u, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; g.beginPath(); g.arc(0, 1.5 * u, 2.2 * u, 0, 7); g.fill(); }
  else if (key === 'redaccion') { g.rotate(-Math.PI / 4); g.fillRect(-2.2 * u, -9 * u, 4.4 * u, 13 * u); g.beginPath(); g.moveTo(-2.2 * u, 4.6 * u); g.lineTo(2.2 * u, 4.6 * u); g.lineTo(0, 9.5 * u); g.closePath(); g.fill(); }
  else if (key === 'taller') { for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.fillRect(-1.6 * u, -9.5 * u, 3.2 * u, 4 * u); } g.beginPath(); g.arc(0, 0, 6.8 * u, 0, 7); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(0, 0, 2.6 * u, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; }
  else if (key === 'pauta') { g.beginPath(); g.moveTo(-9 * u, -2.5 * u); g.lineTo(-3 * u, -2.5 * u); g.lineTo(6 * u, -8 * u); g.lineTo(6 * u, 8 * u); g.lineTo(-3 * u, 2.5 * u); g.lineTo(-9 * u, 2.5 * u); g.closePath(); g.fill(); g.fillRect(-7 * u, 2.5 * u, 3.4 * u, 6 * u); g.beginPath(); g.arc(7 * u, 0, 3.5 * u, -1.1, 1.1); g.stroke(); }
  else if (key === 'analitica') { g.fillRect(-9 * u, 1 * u, 4.6 * u, 8 * u); g.fillRect(-2.3 * u, -4 * u, 4.6 * u, 13 * u); g.fillRect(4.4 * u, -9 * u, 4.6 * u, 18 * u); }
  else if (key === 'revision') { g.lineWidth = r * 0.28; g.beginPath(); g.moveTo(-8 * u, 0); g.lineTo(-2.5 * u, 6 * u); g.lineTo(8.5 * u, -7 * u); g.stroke(); }
  else { g.beginPath(); g.arc(0, 0, 8 * u, 0, 7); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(3.6 * u, -1.6 * u, 7 * u, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; }
  g.restore();
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,226,160,1)'); gr.addColorStop(0.4, 'rgba(255,190,110,.35)'); gr.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createOffice(canvas, opts = {}) {
  const external = !!opts.renderer; // dentro de la app XR: usa su renderer/escena, sin bucle propio
  const renderer = opts.renderer || new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  if (!external) renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = opts.scene || new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  if (!external) scene.background = new THREE.Color(0x1b1730);
  const camera = opts.camera || new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  const hemi = new THREE.HemisphereLight(0xfff0e0, 0x6b5a7a, 1.6), sunL = new THREE.DirectionalLight(0xffb878, 1.4);
  sunL.position.set(-6, 3, 1);
  root.add(hemi, sunL);
  const L = { ...LAYOUT };
  const rng = makeRng((Date.now() & 0xffff) + 11);
  const textCache = new Map(), pickables = [], rooms = {}, state = { time: 'atardecer', tvUntil: 0, loaded: false };
  const stats = { tris: 0, objects: 0 };

  // —— estructura base: se muestra enseguida un suelo, luego llega el GLB horneado ——
  const staticGroup = new THREE.Group(); root.add(staticGroup);
  const tex = {}; let staticMat = null, nightUni = null;
  const texLoader = new THREE.TextureLoader();
  // Texturas de 2048 px (≈0,5 MB y ~22 MB de GPU cada una, antes 4096 px = ~85 MB); si faltan, usa las originales.
  function loadBake(name) {
    return new Promise(res => texLoader.load(ASSETS + name.replace('.jpg', '-2k.jpg'), t => res(prep(t)), undefined, () => texLoader.load(ASSETS + name, t => res(prep(t)), undefined, () => res(null))));
  }
  function prep(t) {
    {
      t.flipY = false; t.channel = 1; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = external ? 4 : 8;
      // En visor (modo externo) basta 2048: la maqueta ocupa poco campo y se ahorran ~130 MB de GPU y ancho de banda.
      if (external && t.image && t.image.width > 2048) {
        const c = document.createElement('canvas'); c.width = c.height = 2048; c.getContext('2d').drawImage(t.image, 0, 0, 2048, 2048);
        const small = new THREE.CanvasTexture(c); small.flipY = false; small.channel = 1; small.colorSpace = THREE.SRGBColorSpace; small.anisotropy = 4; t.dispose(); t = small;
      }
      return t;
    }
  }
  const gltf = new GLTFLoader();
  const ready = (async () => {
    try { const r = await fetch(ASSETS + 'layout.json'); if (r.ok) Object.assign(L, await r.json()); } catch {}
    try {
      let g; try { g = await gltf.loadAsync(ASSETS + 'oficina_bake_lite.glb'); } catch { g = await gltf.loadAsync(ASSETS + 'oficina_bake.glb'); } // «lite» = misma malla sin la textura embebida
      const kill = [];
      g.scene.traverse(o => { if (o.name === 'Cube' || o.name.startsWith('LAB_zone_')) kill.push(o); });
      kill.forEach(o => o.removeFromParent());
      let own = null;
      g.scene.traverse(o => { if (o.isMesh) { own = o; stats.tris += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; } });
      const [dia, noche] = await Promise.all([loadBake('dia.jpg'), loadBake('noche.jpg')]);
      tex.atardecer = dia || own.material.emissiveMap; tex.noche = noche || tex.atardecer;
      if (!dia && own.material.emissiveMap) { tex.atardecer.channel = 1; }
      staticMat = new THREE.MeshBasicMaterial({ map: tex.atardecer });
      let own2 = null;
      g.scene.traverse(o => { if (o.isMesh) { o.material = staticMat; own2 = o; } });
      if (noche && own2) { // día y noche se mezclan en UN solo material (sin dos mallas superpuestas → sin parpadeo)
        nightUni = { value: 0 };
        staticMat.onBeforeCompile = sh => {
          sh.uniforms.tNight = { value: tex.noche }; sh.uniforms.uNight = nightUni;
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tNight;\nuniform float uNight;')
            .replace('#include <map_fragment>', '#ifdef USE_MAP\n vec4 dayC = texture2D( map, vMapUv );\n vec4 nightC = texture2D( tNight, vMapUv );\n diffuseColor *= mix( dayC, nightC, uNight );\n#endif');
        };
        staticMat.needsUpdate = true;
      }
      staticGroup.add(g.scene);
      state.loaded = true;
    } catch (e) {
      console.warn('No se pudo cargar la oficina horneada:', e);
      const f = new THREE.Mesh(new THREE.BoxGeometry(7, 0.2, 6), new THREE.MeshLambertMaterial({ color: 0x8a5a3a }));
      f.position.y = -0.1; staticGroup.add(f);
    }
    try {
      const sg = await gltf.loadAsync(ASSETS + 'silla.glb');
      sg.scene.traverse(o => { if (o.isMesh) { const c = o.material.color?.clone?.() || new THREE.Color(0xdddddd); o.material = new THREE.MeshLambertMaterial({ color: c }); } });
      state.chairModel = sg.scene;
    } catch (e) { console.warn('silla.glb', e); }
    try {
      const pg = await gltf.loadAsync(ASSETS + 'props.glb');
      pg.scene.traverse(o => { if (o.isMesh && o.material) { const c = o.material.color?.clone?.() || new THREE.Color(0xdddddd); const em = o.material.emissive?.clone?.(); o.material = em && em.getHex() ? new THREE.MeshBasicMaterial({ color: o.material.emissive }) : new THREE.MeshLambertMaterial({ color: c }); } });
      root.add(pg.scene);
    } catch {}
  })();

  // —— personajes y cerebro ——
  const grid = buildGrid(L), dogGrid = buildGrid(L, 0.2);
  const people = {}, workers = {}, bubbles = {};
  const chairObjs = {};
  const dog = new Dog(L, rng, dogGrid), dogMesh = makePixelDog();
  dogMesh.add(dogMesh.userData.shadow); root.add(dogMesh);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  WORKERS.forEach((wd, i) => {
    const person = makePixelPerson(wd), room = ROOMS.find(r => r.id === wd.id);
    root.add(person); person.add(person.userData.shadow);
    const w = new Worker(wd.id, L, rng, { grid, delay: i * 4 });
    people[wd.id] = person; workers[wd.id] = w;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5), hitMat); hit.position.y = 0.45; hit.userData.room = wd.id; person.add(hit); pickables.push(hit);
    const bub = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleSprite(textCache, '…', hexOf(room.color)), transparent: true, depthTest: false }));
    bub.scale.set(1.75, 0.58, 1); bub.renderOrder = 10; bub.visible = false; root.add(bub); bubbles[wd.id] = bub;
    const z = L.zones[wd.id], zg = new THREE.Group(); zg.position.set(z.x, 0, z.z); root.add(zg);
    const zhit = new THREE.Mesh(new THREE.BoxGeometry(z.w, z.h, z.d), hitMat); zhit.position.set(z.x, z.h / 2, z.z); zhit.userData.room = wd.id; root.add(zhit); pickables.push(zhit);
    rooms[wd.id] = { def: room, group: zg, agent: person, bubble: bub, active: false, rim: { material: { opacity: 0 } }, sayT: 0, sayIdx: 0 };
  });
  ready.then(() => {
    if (!state.chairModel) return;
    const mk = (x, z, yaw) => { const c = state.chairModel.clone(true); c.position.set(x, 0, z); c.rotation.y = yaw; root.add(c); return c; };
    for (const [id, w] of Object.entries(workers)) if (w.chair) chairObjs[id] = mk(w.chair.x, w.chair.z, w.chair.yaw);
    (L.extraChairs || []).forEach(c => mk(c.x, c.z, c.yaw));
  });

  // —— pantallas vivas: TV y monitores ——
  const tvC = document.createElement('canvas'); tvC.width = 512; tvC.height = 288;
  const tvData = { photos: [], status: '', imgs: new Map(), gallery: [] };
  function setTVData(d = {}) {
    tvData.status = d.status || ''; tvData.photos = (d.photos || []).slice(0, 4); tvData.gallery = (d.gallery || []).slice(0, 12);
    for (const it of tvData.gallery) if (it.thumb && !tvData.imgs.has(it.thumb)) { const im = new Image(); im.src = it.thumb; tvData.imgs.set(it.thumb, im); }
    for (const u of tvData.photos) if (u && !tvData.imgs.has(u)) { const im = new Image(); im.src = u; tvData.imgs.set(u, im); }
  }
  const tvT = new THREE.CanvasTexture(tvC); tvT.colorSpace = THREE.SRGBColorSpace; tvT.generateMipmaps = false; tvT.minFilter = THREE.LinearFilter;
  const tv = new THREE.Mesh(new THREE.PlaneGeometry(L.tv.w, L.tv.h), new THREE.MeshBasicMaterial({ map: tvT, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })); tv.position.set(L.tv.x, L.tv.y, L.tv.z); root.add(tv);
  const monCanvas = {}, monMeshes = [];
  const roleColor = Object.fromEntries(ROOMS.map(r => [r.id, hexOf(r.color)]));
  L.monitors.forEach(m => {
    if (!monCanvas[m.role]) { const c = document.createElement('canvas'); c.width = 128; c.height = 72; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; monCanvas[m.role] = { c, t }; }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.32), new THREE.MeshBasicMaterial({ map: monCanvas[m.role].t, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    mesh.position.set(m.x, m.y, m.z); mesh.rotation.y = m.ry; root.add(mesh); monMeshes.push(mesh);
  });
  function drawTV(t) {
    const g = tvC.getContext('2d'); g.setTransform(2, 0, 0, 2, 0, 0); const on = t < state.tvUntil, rp = state.report && t < state.report.until ? state.report.data : null;
    if (rp) {
      g.fillStyle = '#10142a'; g.fillRect(0, 0, 256, 144);
      g.fillStyle = '#7fe9bf'; g.font = '700 13px sans-serif'; g.fillText(rp.title || 'REPORTE', 10, 18);
      g.fillStyle = '#f6f3fd'; g.font = '600 12px sans-serif';
      (rp.lines || []).slice(0, 6).forEach((l, i) => g.fillText(l, 10, 40 + i * 17));
      if (rp.demo) { g.fillStyle = '#ffd27a'; g.font = '700 10px sans-serif'; g.fillText('DATOS DE EJEMPLO', 10, 134); }
      g.fillStyle = '#a392ff'; for (let i = 0; i < 8; i++) { const h = 8 + 22 * Math.abs(Math.sin(t * 0.9 + i)); g.fillRect(150 + i * 12, 130 - h, 9, h); }
    } else if (!on && tvData.gallery.length) {
      // Parrilla: presentación de lo ya publicado; cambia cada 4 s.
      const n = tvData.gallery.length, k = Math.floor(t / 4) % n, it = tvData.gallery[k], im = it.thumb && tvData.imgs.get(it.thumb);
      g.fillStyle = '#0d0b17'; g.fillRect(0, 0, 256, 144);
      const x = 12, y = 6, w = 76, h = 132;
      g.save(); g.beginPath(); g.roundRect(x, y, w, h, 7); g.clip(); g.fillStyle = '#241f3a'; g.fillRect(x, y, w, h);
      if (im && im.complete && im.naturalWidth) { const sc = Math.max(w / im.naturalWidth, h / im.naturalHeight); g.drawImage(im, x + (w - im.naturalWidth * sc) / 2, y + (h - im.naturalHeight * sc) / 2, im.naturalWidth * sc, im.naturalHeight * sc); }
      g.restore();
      const lab = it.format === 'reel' ? 'REEL' : it.format === 'story' ? 'HISTORIA' : 'PUBLICACIÓN';
      g.textAlign = 'left'; g.fillStyle = '#ffc78c'; g.font = '700 10px sans-serif'; g.fillText('PUBLICADO · ' + lab, 100, 22);
      g.fillStyle = '#f6f3fd'; g.font = '600 12px sans-serif';
      const words = String(it.caption || 'Tu contenido en Instagram').split(' '); let line = '', row = 0;
      for (const wd of words) { if ((line + wd).length > 24) { g.fillText(line, 100, 46 + row * 16); line = ''; if (++row > 3) break; } line += wd + ' '; }
      if (row <= 3) g.fillText(line, 100, 46 + row * 16);
      for (let i = 0; i < Math.min(n, 8); i++) { g.fillStyle = i === k % 8 ? '#ffc78c' : 'rgba(255,255,255,.22)'; g.beginPath(); g.arc(104 + i * 11, 118, 3, 0, 7); g.fill(); }
      g.fillStyle = '#7fe9bf'; g.font = '700 9px sans-serif'; g.fillText(n + ' publicaciones · toca para ver todas', 100, 134);
    } else if (!on) {
      const bg = g.createLinearGradient(0, 0, 256, 144); bg.addColorStop(0, '#171232'); bg.addColorStop(1, '#0b0a16'); g.fillStyle = bg; g.fillRect(0, 0, 256, 144);
      g.fillStyle = '#ffd1a0'; g.font = '700 11px sans-serif'; g.textAlign = 'left'; g.fillText('MARKETING STUDIO XR', 10, 16);
      g.fillStyle = '#7fe9bf'; g.textAlign = 'right'; g.fillText(`${tvData.photos.length}/4 FOTOS`, 246, 16); g.textAlign = 'left';
      for (let i = 0; i < 4; i++) {
        const x = 10 + i * 61.5, y = 26, w = 55, h = 76, u = tvData.photos[i], im = u && tvData.imgs.get(u);
        g.fillStyle = '#241f3a'; g.beginPath(); g.roundRect(x, y, w, h, 6); g.fill();
        if (im && im.complete && im.naturalWidth) {
          g.save(); g.beginPath(); g.roundRect(x, y, w, h, 6); g.clip();
          const sc = Math.max(w / im.naturalWidth, h / im.naturalHeight); g.drawImage(im, x + (w - im.naturalWidth * sc) / 2, y + (h - im.naturalHeight * sc) / 2, im.naturalWidth * sc, im.naturalHeight * sc); g.restore();
          g.strokeStyle = '#7fe9bf'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(x, y, w, h, 6); g.stroke();
        } else { g.fillStyle = '#6d6090'; g.font = '700 22px sans-serif'; g.textAlign = 'center'; g.fillText(String(i + 1), x + w / 2, y + h / 2 + 8); g.textAlign = 'left'; }
      }
      g.fillStyle = 'rgba(255,255,255,.09)'; g.beginPath(); g.roundRect(10, 112, 236, 22, 11); g.fill();
      g.fillStyle = '#f6f3fd'; g.font = '600 11px sans-serif'; g.fillText((tvData.status || 'Toca la TV para publicar').slice(0, 44), 20, 127);
      g.fillStyle = '#a392ff'; g.beginPath(); g.arc(238, 123, 3 + 1.5 * Math.sin(t * 3), 0, 7); g.fill();
    }
    else {
      g.fillStyle = '#10142a'; g.fillRect(0, 0, 256, 144);
      g.fillStyle = '#7fe9bf'; g.font = '700 14px sans-serif'; g.fillText('MARKETING STUDIO XR · EN VIVO', 10, 20);
      for (let i = 0; i < 9; i++) { const h = 20 + 60 * Math.abs(Math.sin(t * 1.3 + i * 0.7)); g.fillStyle = i % 2 ? '#a392ff' : '#7fe9bf'; g.fillRect(14 + i * 26, 130 - h, 18, h); }
      g.strokeStyle = '#ffd27a'; g.lineWidth = 3; g.beginPath(); for (let x = 0; x < 256; x += 8) g.lineTo(x, 80 - 30 * Math.sin(x / 30 + t * 2)); g.stroke();
    }
    tvT.needsUpdate = true;
  }
  function drawMon(role, t, busy) {
    const { c, t: tx } = monCanvas[role], g = c.getContext('2d');
    g.fillStyle = busy ? '#0f1d36' : '#0a1020'; g.fillRect(0, 0, 128, 72);
    if (busy) {
      g.fillStyle = roleColor[role];
      for (let i = 0; i < 7; i++) { const ln = 20 + ((Math.floor(t * 3) + i * 37) % 70); g.globalAlpha = 0.85 - i * 0.08; g.fillRect(8, 8 + i * 8, Math.min(112, ln), 3); }
      g.globalAlpha = 1; if (Math.floor(t * 2) % 2) g.fillRect(8, 64, 5, 4);
    } else { g.fillStyle = 'rgba(160,190,255,.5)'; g.fillRect(20 + 80 * Math.abs(Math.sin(t * 0.4)), 12 + 44 * Math.abs(Math.cos(t * 0.3)), 8, 8); }
    tx.needsUpdate = true;
  }

  // lámparas con halo (se ve más de noche)
  const gTex = glowTexture(), glows = [];
  (L.lamps || [[-2.6, 2.24, 1.6], [-2.4, 2.24, -1.2], [0, 2.24, -2.4]]).forEach(p => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: gTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.2 }));
    s.position.set(...p); s.scale.setScalar(0.9); root.add(s); glows.push(s);
  });
  // interruptor sutil en la pared (día / noche / hora real)
  const iconTexCache = new Map();
  function iconTex(emoji, ring = null, count = 0) {
    const k = emoji + ring + count; if (iconTexCache.has(k)) return iconTexCache.get(k);
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    if (ring) { g.fillStyle = 'rgb(16,12,28)'; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.fill(); g.strokeStyle = ring; g.lineWidth = 7; g.stroke(); }
    const gc = document.createElement('canvas'); gc.width = gc.height = 128; glyph(gc.getContext('2d'), emoji, 64, 64, ring ? 34 : 42, ring || '#f6f3fd'); g.drawImage(gc, 0, 0);
    if (count) { g.fillStyle = '#ff5d73'; g.beginPath(); g.arc(100, 28, 20, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '700 26px Inter,sans-serif'; g.fillText(String(Math.min(count, 9)), 100, 30); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; iconTexCache.set(k, t); return t;
  }
  const sw = new THREE.Group(); sw.position.set(L.switch?.x ?? 0.7, L.switch?.y ?? 1.25, L.switch?.z ?? -2.86);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.17, 0.012), new THREE.MeshLambertMaterial({ color: 0xf3efe9 })); sw.add(plate);
  const rocker = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.016), new THREE.MeshLambertMaterial({ color: 0xc9bfb5 })); rocker.position.z = 0.008; sw.add(rocker);
  const switchIcon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex('luna'), transparent: true, opacity: 0.55 })); switchIcon.scale.setScalar(0.11); switchIcon.position.set(0, 0.15, 0.02); sw.add(switchIcon);
  const swHit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.18), hitMat); swHit.userData.room = '__time'; swHit.position.z = 0.05; sw.add(swHit); pickables.push(swHit);
  const tvHit = new THREE.Mesh(new THREE.BoxGeometry(L.tv.w, L.tv.h, 0.25), hitMat); tvHit.userData.room = '__tv'; tvHit.position.set(L.tv.x, L.tv.y, L.tv.z + 0.12); root.add(tvHit); pickables.push(tvHit);
  root.add(sw);

  // insignias flotantes sobre cada escritorio: dónde tocar para abrir cada área
  const ICON = { estudio: 'estudio', redaccion: 'redaccion', taller: 'taller', pauta: 'pauta', analitica: 'analitica', revision: 'revision' }, badge = {};
  for (const id of Object.keys(rooms)) {
    const z = L.zones[id], col = hexOf(rooms[id].def.color);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex(ICON[id], col, 0), transparent: true, depthTest: false }));
    sp.scale.setScalar(0.34); sp.position.set(z.x, id === 'analitica' ? 1.75 : z.h + 0.42, z.z); sp.renderOrder = 9; sp.userData.room = id; sp.userData.base = sp.position.y;
    root.add(sp); pickables.push(sp); badge[id] = { sp, n: 0, col };
  }
  const setBadge = (id, n) => { const b = badge[id]; if (!b) return; b.n = n; b.sp.material.map = iconTex(ICON[id], b.col, n); };

  // cielo detrás de las ventanas (día / noche) en pixel art
  const wins = (L.windows || [{ z: 1.6 }, { z: -1.2 }]).map(w => {
    const c = document.createElement('canvas'); c.width = 52; c.height = 64; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 1.56), new THREE.MeshBasicMaterial({ map: t, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })); m.position.set(-3.58, 1.7, w.z); m.rotation.y = Math.PI / 2; root.add(m); return { c, t, z: w.z };
  });
  const stars = Array.from({ length: 26 }, (_, i) => [(i * 37 + 11) % 52, (i * 53 + 5) % 40, i % 5]);
  function drawSky(w, t, f, idx) {
    const g = w.c.getContext('2d'), W = 52, H = 64;
    const band = (cols, y0, y1) => cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, y0 + ((y1 - y0) * i) / cols.length, W, Math.ceil((y1 - y0) / cols.length) + 1); });
    g.globalAlpha = 1; band(['#3b2f6b', '#5a3a86', '#8a468e', '#c85a8a', '#f28a6f', '#ffb878', '#ffd699'], 0, H);
    g.fillStyle = '#ffe9b0'; g.beginPath(); g.arc(26, 58, 9, 0, 7); g.fill(); g.fillStyle = '#fff3d0'; g.beginPath(); g.arc(26, 58, 6, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 3; i++) { const x = ((t * (2.2 + i) + i * 25 + idx * 9) % 70) - 10, y = 10 + i * 13; g.fillRect(x, y, 12, 3); g.fillRect(x + 3, y - 2, 7, 2); g.fillRect(x - 2, y + 1, 4, 2); }
    const bx = ((t * 7 + idx * 17) % 120) - 20; if (bx < 56) { g.fillStyle = '#2a1f2d'; const y = 22 + Math.sin(t * 5) * 2; g.fillRect(bx, y, 2, 1); g.fillRect(bx + 2, y + (Math.floor(t * 6) % 2), 2, 1); g.fillRect(bx + 4, y, 2, 1); }
    if (f > 0.01) {
      g.globalAlpha = f; band(['#04051a', '#070a26', '#0b1236', '#101a48', '#18235a'], 0, H);
      stars.forEach(([x, y, k]) => { g.fillStyle = (Math.sin(t * (1.5 + k) + x) > 0.2) ? '#fff' : '#8fa0ff'; g.fillRect(x, y, 1, 1); });
      g.fillStyle = '#e8ecff'; g.beginPath(); g.arc(38, 12, 5, 0, 7); g.fill(); g.fillStyle = '#0b1236'; g.beginPath(); g.arc(40.5, 10.5, 4.4, 0, 7); g.fill();
      g.fillStyle = '#05061a'; [[0, 46, 8, 18], [8, 40, 7, 24], [15, 48, 9, 16], [24, 38, 6, 26], [30, 44, 8, 20], [38, 36, 7, 28], [45, 47, 7, 17]].forEach(([x, y, ww, hh]) => g.fillRect(x, y, ww, hh));
      for (let i = 0; i < 18; i++) { const x = (i * 11 + 3) % 50, y = 42 + ((i * 7) % 20); if (Math.sin(t * 0.6 + i * 3.1) > -0.3) { g.fillStyle = i % 3 ? '#ffd27a' : '#7fe9bf'; g.fillRect(x, y, 1, 1); } }
      if (state.shoot && t - state.shoot.t0 < 1.2) { const k = (t - state.shoot.t0) / 1.2; g.fillStyle = '#fff'; g.fillRect(48 - k * 44, 4 + k * 22, 3, 1); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(50 - k * 44, 3 + k * 22, 6, 1); }
    }
    g.globalAlpha = 1; g.fillStyle = '#f1ece6'; g.fillRect(0, 0, W, 2); g.fillRect(0, H - 2, W, 2); g.fillRect(0, 0, 2, H); g.fillRect(W - 2, 0, 2, H); g.fillRect(W / 2 - 1, 0, 2, H); g.fillRect(0, H / 2 - 1, W, 2);
    w.t.needsUpdate = true;
  }
  // brillo de las pantallas y "zzz" de noche
  const monGlows = L.monitors.map(m => { const s2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: gTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, color: new THREE.Color(roleColor[m.role]) })); s2.position.set(m.x + Math.sin(m.ry) * 0.05, m.y, m.z + Math.cos(m.ry) * 0.05); s2.scale.set(0.85, 0.6, 1); s2.userData.k = 0.55; root.add(s2); return s2; });
  const zzzTex = (() => { const c = document.createElement('canvas'); c.width = 96; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#cfd8ff'; g.font = '700 30px Inter,sans-serif'; g.fillText('z', 8, 56); g.font = '700 24px Inter,sans-serif'; g.fillText('Z', 36, 36); g.font = '700 18px Inter,sans-serif'; g.fillText('z', 66, 20); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const zzz = {};
  for (const id of [...Object.keys(rooms), 'dog']) { const z = new THREE.Sprite(new THREE.SpriteMaterial({ map: zzzTex, transparent: true, opacity: 0, depthTest: false })); z.scale.set(0.3, 0.2, 1); z.renderOrder = 8; root.add(z); zzz[id] = z; }

  // etiqueta de hover
  const hover = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false })); hover.scale.set(1.5, 0.33, 1); hover.visible = false; hover.renderOrder = 11; root.add(hover);
  let hoverId = null;

  const TIMES = ['auto', 'atardecer', 'noche'], TLAB = { auto: 'Hora real', atardecer: 'Siempre de día', noche: 'Siempre de noche' };
  const isNightNow = () => { const h = new Date().getHours() + new Date().getMinutes() / 60; return h >= 18.5 || h < 5.5; };
  function setTime(mode, instant) {
    state.mode = mode;
    state.target = (mode === 'auto' ? isNightNow() : mode === 'noche') ? 1 : 0;
    if (instant || state.fade == null) state.fade = state.target;
    rocker.rotation.x = mode === 'auto' ? 0 : mode === 'noche' ? -0.5 : 0.5;
    switchIcon.material.map = iconTex(mode === 'noche' ? '🌙' : mode === 'atardecer' ? '☀️' : '🌗');
  }
  const cycleTime = () => { setTime(TIMES[(TIMES.indexOf(state.mode) + 1) % 3]); };
  const mixC = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k);
  function applyFade(f) {
    if (nightUni) nightUni.value = f;
    setTint(mixC(0xfff2e6, 0x9aa6ff, f));
    hemi.color.copy(mixC(0xfff0e0, 0x6f7fd8, f)); hemi.intensity = 1.6 - 0.7 * f; sunL.color.copy(mixC(0xffb878, 0x6f86ff, f)); sunL.intensity = 1.4 - 1.15 * f;
    if (scene.background) scene.background.copy(mixC(0x2a2342, 0x090818, f));
    glows.forEach((g, i) => (g.material.opacity = (0.2 + 0.75 * f) * (f > 0.4 ? 0.92 + 0.08 * Math.sin(state.t * 7 + i * 2.1) : 1)));
    monGlows.forEach(g => (g.material.opacity = f * g.userData.k));
  }
  // —— poses ——
  const rot = (p, x = 0, y = 0, z = 0) => p && p.rotation.set(x, y, z);
  function applyPose(person, w, t) {
    const P = person.userData.parts, T = w.animT, v = w.view, s = Math.sin;
    ['body', 'head', 'armL', 'armR', 'legL', 'legR', 'tail'].forEach(k => rot(P[k]));
    person.position.set(w.x, 0.41 * ease(Math.min(1, w.sit)) + w.hop, w.z);
    person.rotation.y = w.yaw;
    const sitting = w.sit > 0.5;
    rot(P.legL, -Math.PI / 2 * w.sit); rot(P.legR, -Math.PI / 2 * w.sit);
    const aL = x => (P.armL.rotation.x = x), aR = x => (P.armR.rotation.x = x), H = P.head;
    const both = (x, k = 0) => { aL(x + s(T * 17) * k); aR(x + s(T * 17 + 2.2) * k); };
    switch (v) {
      case 'walk': { const k = s(t * 10 + w.x * 3); rot(P.legL, k * 0.75); rot(P.legR, -k * 0.75); aL(-k * 0.6); aR(k * 0.6); person.position.y += Math.abs(k) * 0.025; P.body.rotation.x = 0.06; break; }
      case 'type': both(-1.35, 0.1); H.rotation.x = 0.08 + s(T * 2) * 0.03; break;
      case 'write': aR(-1.2 + s(T * 9) * 0.18); aL(-0.9); H.rotation.x = 0.24; break;
      case 'read': both(-1.0); H.rotation.x = 0.26 + s(T) * 0.03; break;
      case 'mark': aR(-1.15 + s(T * 6) * 0.2); aL(-0.8); H.rotation.x = 0.2; break;
      case 'tweak': aR(-1.3 + s(T * 3) * 0.2); aL(-1.2); H.rotation.y = s(T * 1.5) * 0.2; break;
      case 'sip': { const k = Math.max(0, s(T * 1.6)); aR(-1.3 - 1.1 * k); aL(-1.2); H.rotation.x = -0.12 * k; break; }
      case 'think': aR(-2.5); P.armR.rotation.z = 0.2; aL(-1.2); H.rotation.z = 0.16; H.rotation.x = -0.1; break;
      case 'look': H.rotation.y = s(T * 1.2) * 0.7; both(-1.3, 0.04); break;
      case 'nod': H.rotation.x = 0.2 * s(T * 5); both(-1.0); break;
      case 'point': aR(-1.6); P.armR.rotation.z = -0.3; H.rotation.y = -0.4; aL(-1.1); break;
      case 'call': aR(-2.7); P.armR.rotation.z = -0.25; H.rotation.z = 0.12; aL(-1.1); break;
      case 'shoot': aL(-1.9); aR(-1.9); H.rotation.x = 0.05; P.body.rotation.z = s(T * 1.3) * 0.04; break;
      case 'adjust': aL(-1.4 + s(T * 4) * 0.3); aR(-1.4 - s(T * 4) * 0.3); H.rotation.y = s(T) * 0.3; break;
      case 'check': aR(-1.5); aL(-1.0); H.rotation.x = 0.3; H.rotation.y = s(T * 2) * 0.3; break;
      case 'stretch': aL(-3.0 + s(T * 3) * 0.1); aR(-3.0 + s(T * 3) * 0.1); P.body.rotation.x = -0.1; H.rotation.x = -0.15; break;
      case 'tv': { const k = Math.min(1, T / 0.9); if (T < 2) { aR(-1.7 - 0.2 * s(T * 14)); } else { aR(0); } aL(0); H.rotation.x = -0.1; H.rotation.y = 0.08 * s(T); break; }
      case 'window': H.rotation.x = -0.08; aR(-1.1); P.armR.rotation.z = -0.15; P.body.rotation.z = s(T * 0.8) * 0.02; break;
      case 'phone': aR(-2.7); P.armR.rotation.z = -0.25; aL(-0.3 * s(T * 2)); H.rotation.z = 0.12; person.position.x += s(T * 0.9) * 0.0; P.body.rotation.z = s(T * 1.1) * 0.05; break;
      case 'play': person.position.y -= 0.035; rot(P.legL, -0.8); rot(P.legR, -0.8); aL(-1.2 + s(T * 6) * 0.5); aR(-1.2 - s(T * 6) * 0.5); H.rotation.x = 0.3; P.body.rotation.x = 0.25; break;
      case 'water': aR(-1.7); P.armR.rotation.z = -0.2 + 0.25 * s(T * 2); H.rotation.x = 0.12; P.body.rotation.x = 0.1; break;
      case 'browse': aR(-2.8); H.rotation.x = -0.25; person.position.x += 0; P.body.rotation.z = s(T) * 0.05; break;
      case 'rise': aL(-0.6); aR(-0.6); P.body.rotation.x = 0.15 * (1 - w.sit); break;
      case 'jump': case 'cheer': aL(-3.0); aR(-3.0); P.armL.rotation.z = 0.25; P.armR.rotation.z = -0.25; rot(P.legL, -0.2); rot(P.legR, 0.2); break;
      case 'wave': aR(-2.9 + 0.1 * s(T * 3)); P.armR.rotation.z = -0.5 + 0.4 * s(T * 14); aL(-0.2); break;
      case 'hand_up': aR(-3.05); aL(-1.2); H.rotation.z = 0.08 * s(T * 6); break;
      case 'surprise': aL(-0.7); aR(-0.7); P.body.rotation.x = -0.08; break;
      default: both(-1.3);
    }
    if (P.tail) P.tail.rotation.z = s(t * 4 + w.x) * (v === 'play' || v === 'cheer' ? 0.5 : 0.18);
    if (sitting && v === 'walk') person.position.y = 0.41 * w.sit;
    setFace(person, w.face);
  }
  function applyDog(t) {
    const d = dog, m = dogMesh;
    m.position.set(d.x, d.hop || 0, d.z); m.rotation.y = d.yaw; m.rotation.z = 0; m.rotation.x = 0; m.scale.set(0.95, 0.95, 0.95);
    if (d.anim === 'run') { m.position.y = Math.abs(Math.sin(t * 14)) * 0.025; m.rotation.x = Math.sin(t * 14) * 0.06; }
    if (d.anim === 'sit') m.scale.y = 0.9; if (d.anim === 'wag') m.rotation.z = Math.sin(t * 12) * 0.08;
    if (d.anim === 'sleep') { m.scale.set(0.95, 0.62, 0.95); m.position.y = -0.01; }
    if (d.anim === 'play') m.rotation.z = Math.sin(t * 9) * 0.12;
  }

  // —— cámara y puntero ——
  const home = { yaw: 0.78, pitch: 0.62, dist: 14, tx: 0, ty: 0.7, tz: 0 };
  const view = { yaw: home.yaw, pitch: home.pitch, dist: home.dist, target: new THREE.Vector3(home.tx, home.ty, home.tz), goal: null, yawG: null, distG: null };
  const placeCam = () => {
    const d = view.dist;
    camera.position.set(view.target.x + Math.sin(view.yaw) * Math.cos(view.pitch) * d, view.target.y + Math.sin(view.pitch) * d, view.target.z + Math.cos(view.yaw) * Math.cos(view.pitch) * d);
    camera.lookAt(view.target);
  };
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let down = null, onPick = () => {};
  const pickAt = e => {
    const r = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    return ray.intersectObjects(pickables, false)[0]?.object.userData.room || null;
  };
  if (canvas) {
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch, moved: false }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!down) { hoverId = pickAt(e); canvas.style.cursor = hoverId ? 'pointer' : 'grab'; return; }
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.hypot(dx, dy) > 5) down.moved = true;
    if (down.moved) { view.yaw = down.yaw - dx * 0.006; view.pitch = Math.max(0.2, Math.min(1.3, down.pitch + dy * 0.005)); view.goal = null; }
  });
  canvas.addEventListener('pointerup', e => {
    if (down && !down.moved) { const id = pickAt(e); if (id === '__time') cycleTime(); else if (id) pickRoom(id); }
    down = null;
  });
  canvas.addEventListener('wheel', e => ((view.dist = Math.max(3, Math.min(22, view.dist + e.deltaY * 0.008))), (view.goal = null), e.preventDefault()), { passive: false });

  }
  function focus(id) {
    if (!id) { view.goal = new THREE.Vector3(home.tx, home.ty, home.tz); view.distG = home.dist; view.yawG = home.yaw; return; }
    const z = L.zones[id];
    view.goal = new THREE.Vector3(z.x, 0.7, z.z); view.distG = 6.2; view.yawG = 0.78;
  }
  // Orquestación: un solo mensaje a la vez entre todos los personajes; solo por acciones reales.
  function speak(id, text, opts = {}) { return orchestra.say(id, text, opts); }
  for (const [id, w] of Object.entries(workers)) orchestra.register(id, { show: (text, dur) => w.say_(text, w.t, dur + 0.2), hide: () => { w.say = ''; } });
  // Ventana de información: sube desde abajo en la pared de las ventanas y muestra qué hace el escritorio tocado.
  const IW = 5.4, IH = 4.16;
  const infoC = document.createElement('canvas'); infoC.width = 1000; infoC.height = 770;
  const infoTex = new THREE.CanvasTexture(infoC); infoTex.colorSpace = THREE.SRGBColorSpace;
  const infoMesh = new THREE.Mesh(new THREE.PlaneGeometry(IW, IH), new THREE.MeshBasicMaterial({ map: infoTex, transparent: true, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
  infoMesh.rotation.y = Math.PI / 2; infoMesh.visible = false; infoMesh.userData.room = '__info';
  const INFO_BOTTOM = 3.3, INFO_Z = 0.2; // nace en el borde superior de la pared y sube desde ahí
  infoMesh.position.set(-3.7, INFO_BOTTOM, INFO_Z); root.add(infoMesh); pickables.push(infoMesh);
  const info = { id: null, p: 0, goal: 0, provider: null, key: '', last: 0 };
  function drawInfo(d, color) {
    const g = infoC.getContext('2d'), W = 1000, H = 770;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(16,12,28,.97)'; g.beginPath(); g.roundRect(8, 8, W - 16, H - 16, 48); g.fill();
    g.strokeStyle = color; g.lineWidth = 8; g.stroke();
    g.fillStyle = color; g.fillRect(8, 8, W - 16, 16);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#fff'; g.font = '800 64px Inter,system-ui,sans-serif'; g.fillText(d.title, 56, 106);
    g.fillStyle = color; g.font = '700 36px Inter,system-ui,sans-serif'; g.fillText(d.agent, 56, 156);
    // estado: lo más importante, grande
    g.fillStyle = d.waiting ? '#ffd27a' : '#7fe9bf'; g.font = '800 46px Inter,system-ui,sans-serif';
    g.fillText((d.waiting ? '⏳ ' : '✔ ') + d.status, 56, 232);
    let y = 292;
    const wrap = (txt, size, col, max, x0 = 56, wmax = W - 112, weight = 600) => {
      g.font = `${weight} ${size}px Inter,system-ui,sans-serif`; g.fillStyle = col;
      let line = '', n = 0;
      for (const w of String(txt).split(/\s+/)) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > wmax && line) { g.fillText(line, x0, y); y += size + 12; line = w; if (++n >= max) return; } else line = t; }
      g.fillText(line, x0, y); y += size + 12;
    };
    if (d.waiting) wrap(d.what, 38, '#cfc7e6', 6);
    const imgs = (d.images || []).filter(im => im && im.complete && im.naturalWidth);
    if (imgs.length) {
      const k = imgs.length, gap = 20, tw = Math.min(210, (W - 112 - gap * (k - 1)) / k), th = tw * 1.25;
      imgs.slice(0, 4).forEach((im, i) => {
        const x = 56 + i * (tw + gap), sc = Math.max(tw / im.naturalWidth, th / im.naturalHeight);
        g.save(); g.beginPath(); g.roundRect(x, y - 8, tw, th, 18); g.clip();
        g.drawImage(im, x + (tw - im.naturalWidth * sc) / 2, y - 8 + (th - im.naturalHeight * sc) / 2, im.naturalWidth * sc, im.naturalHeight * sc); g.restore();
      });
      y += th + 36;
    }
    for (const l of (d.lines || []).slice(0, 4)) { if (y > H - 150) break; g.fillStyle = color; g.fillRect(56, y - 22, 14, 14); wrap(l, 36, '#ffffff', 2, 88, W - 144, 600); }
    g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.roundRect(56, H - 128, W - 112, 76, 38); g.fill();
    g.fillStyle = '#fff'; g.font = '700 38px Inter,system-ui,sans-serif'; g.textAlign = 'center'; g.fillText((d.open || 'Abrir') + ' · toca otra vez', W / 2, H - 78);
    infoTex.needsUpdate = true;
  }
  function showInfo(id) {
    const d = info.provider?.(id);
    if (!d) return false;
    const color = hexOf(rooms[id]?.def.color ?? 0xbd9af2);
    const key = JSON.stringify({ ...d, images: (d.images || []).map(im => !!(im && im.complete && im.naturalWidth)) }) + color;
    if (key !== info.key) { info.key = key; drawInfo(d, color); }
    if (info.id !== id) info.p = Math.min(info.p, 0.0);
    info.id = id; info.goal = 1; infoMesh.visible = true;
    return true;
  }
  function hideInfo() { info.goal = 0; info.id = null; }
  function updateInfo(dt) {
    if (info.id && info.goal === 1 && state.now - info.last > 1) { info.last = state.now; showInfo(info.id); } // se actualiza con lo que va llegando
    if (info.p === info.goal) return;
    info.p += Math.sign(info.goal - info.p) * Math.min(Math.abs(info.goal - info.p), dt / 0.45);
    const e = 1 - Math.pow(1 - info.p, 3); // sube de abajo hacia arriba y frena al final
    infoMesh.scale.set(1, Math.max(0.001, e), 1);
    infoMesh.position.y = INFO_BOTTOM + (IH * e) / 2;
    infoMesh.material.opacity = Math.min(1, info.p * 2.5);
    if (info.p <= 0.001 && info.goal === 0) infoMesh.visible = false;
  }
  // Primer toque: muestra la información. Segundo toque (en el mismo escritorio o en la ventana): abre la pantalla.
  function pickRoom(id) {
    if (id === '__info') { if (info.id) { const t = info.id; hideInfo(); onPick(t); } return; }
    if (id !== '__tv' && workers[id]) { workers[id].doReact('surprise', 1.1); setBadge(id, 0); }
    if (info.provider && info.id !== id && showInfo(id)) return;
    hideInfo(); onPick(id);
  }
  function setActive(id, on) {
    const r = rooms[id], w = workers[id];
    if (!r || r.active === on) return;
    r.active = on; w.setBusy(on); w.doReact(on ? 'hand_up' : 'cheer', on ? 1.6 : 1.5);
    if (on) speak(id, '¡Manos a la obra!');
  }
  // —— la oficina reacciona a lo que pasa en el estudio ——
  const EVENTS = {
    images_ready: { who: ['estudio'], text: d => `¡${d.n || 'Tus'} imágenes están listas!`, react: 'cheer' },
    photo_saved: { who: ['estudio'], text: d => `¡Foto guardada! ${d.n || 1}/4`, react: 'cheer', badge: false },
    photos_done: { who: ['estudio'], text: () => '¡Ya tienes las 4 fotos! Pulsa Continuar', react: 'cheer', badge: false },
    copy_ready: { who: ['redaccion'], text: () => 'Plan de textos y contenido listo', react: 'jump' },
    idea_ready: { who: ['redaccion'], text: () => 'Idea de publicación lista', react: 'hand_up' },
    video_plan_ready: { who: ['taller'], text: () => 'Guion de video listo', react: 'hand_up' },
    video_ready: { who: ['taller'], text: () => '¡Video listo!', react: 'cheer' },
    xr_ad_ready: { who: ['taller'], text: () => 'Anuncio XR listo para probar', react: 'cheer' },
    review_done: { who: ['revision'], text: d => `Revisión lista${d.score != null ? ' · ' + d.score + '/100' : ''}`, react: 'wave' },
    ads_draft: { who: ['pauta'], text: () => 'Borrador de pauta listo · PAUSADO', react: 'hand_up' },
    ads_active: { who: ['pauta', 'analitica'], text: () => 'Pauta activa y corriendo', react: 'cheer' },
    published: { who: ['estudio', 'pauta', 'redaccion'], text: () => '¡Publicado!', react: 'cheer' },
    comment_new: { who: ['redaccion'], text: d => d.text || 'Nuevo comentario en tu publicación', react: 'hand_up' },
    running: { who: [], text: () => '' },
    failed: { who: ['pauta'], text: d => d.text || 'Algo falló, revisa el panel', react: 'surprise', face: 'sad' }
  };
  // Cada aviso solo suena/habla si tiene sentido en la pantalla donde está la persona; si no, queda como insignia silenciosa.
  const CTX = {
    photos_done: ['capture'], idea_ready: ['strategy', 'brief'], copy_ready: ['strategy', 'brief'],
    images_ready: ['brief', 'express', 'gallery', 'capture'], video_plan_ready: ['video', 'gallery', 'xr'], video_ready: ['video', 'gallery', 'xr', 'publish'],
    xr_ad_ready: ['xr', 'video'], review_done: ['review', 'publish'], ads_draft: ['ads', 'publish'], ads_active: ['ads', 'results'],
    published: ['publish', 'ads', 'results', 'review'], comment_new: ['results', 'publish', 'ads'], metrics: ['results', 'ads', 'publish']
  };
  let audio = null;
  function chime() {
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t0 = audio.currentTime;
      [[880, 0], [1320, 0.11]].forEach(([f, d]) => {
        const o = audio.createOscillator(), v = audio.createGain();
        o.type = 'sine'; o.frequency.value = f; v.gain.setValueAtTime(0.0001, t0 + d); v.gain.exponentialRampToValueAtTime(0.16, t0 + d + 0.02); v.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.28);
        o.connect(v).connect(audio.destination); o.start(t0 + d); o.stop(t0 + d + 0.3);
      });
    } catch {}
  }
  const bounce = {};
  function notify(type, data = {}, force = false) {
    if (type === 'photo_saved') { if ((data.n || 1) < 4) return; type = 'photos_done'; }
    const ok = force || !state.page || !CTX[type] || CTX[type].includes(state.page) || type === 'failed';
    if (!ok) { const evq = EVENTS[type]; if (evq && evq.badge !== false) evq.who.forEach(id => setBadge(id, (badge[id]?.n || 0) + 1)); return; }
    const now = Date.now(), lastN = (notify.last ??= {});
    if (lastN[type] > now - 3500) return; // evita avisos duplicados (cliente + trabajo del servidor)
    lastN[type] = now;
    const ev = EVENTS[type];
    if (type === 'metrics') return report(data, force);
    if (!ev) return;
    chime();
    speak(type === 'failed' ? ev.who[0] : ev.who[0], ev.text(data), { priority: type === 'failed' });
    ev.who.forEach(id => { const w = workers[id]; if (!w) return; if (type !== 'failed' && ev.badge !== false) setBadge(id, (badge[id]?.n || 0) + 1); w.doReact(ev.react, 1.8, ev.face); bounce[id] = state.now || 0; });
    log.unshift({ t: Date.now(), type, text: ev.text(data) }); log.length = Math.min(log.length, 30);
  }
  const log = [];
  function demo() {
    const seq = [['photo_saved', { n: 1 }], ['photo_saved', { n: 4 }], ['idea_ready'], ['images_ready', { n: 4 }], ['video_plan_ready'], ['review_done', { score: 87 }], ['ads_draft'], ['published'], ['ads_active'], ['metrics', {}]];
    seq.forEach(([t, d], i) => setTimeout(() => { delete (notify.last ??= {})[t]; notify(t, d, true); }, 800 + i * 4200));
    return seq.length;
  }
  function report(data = {}, force = true) {
    const d = { title: data.title || 'REPORTE DE LA CAMPAÑA', lines: data.lines || ['Vistas: 1.240', 'Alcance: 860', 'CTR: 2,9 %', 'Gasto hoy: $0'], demo: data.demo !== false && !data.lines };
    const a = workers.analitica;
    state.report = { data: d, until: 0 };
    if (force || !state.page || CTX.metrics.includes(state.page)) a.order('reporte');
    state.reportPending = d;
    log.unshift({ t: Date.now(), type: 'metrics', text: d.title }); log.length = Math.min(log.length, 30);
  }
  async function watchServer(base = '') {
    const seen = new Set();
    let first = true;
    const room = { strategy: 'redaccion', campaign: 'estudio', 'ads-plan': 'pauta', 'ads-push': 'pauta', 'video-plan': 'taller', video: 'taller', publish: 'pauta' };
    const done = j => {
      if (j.status === 'failed') return notify('failed', { text: 'Falló: ' + (j.type || 'trabajo') });
      if (j.type === 'strategy') notify('copy_ready');
      if (j.type === 'campaign') { notify('images_ready', { n: j.result?.images?.length || j.result?.files?.length }); }
      if (j.type === 'ads-plan') notify('ads_draft');
      if (j.type === 'ads-push') notify('ads_draft');
      if (j.type === 'video-plan') notify('video_plan_ready');
      if (j.type === 'video') notify('video_ready');
      if (j.type === 'publish') notify('published');
    };
    const poll = async () => {
      try {
        const list = await (await fetch(base + '/api/jobs' + location.search)).json();
        const running = new Set();
        for (const j of list) {
          if (['queued', 'running'].includes(j.status) && room[j.type]) running.add(room[j.type]);
          if (['completed', 'failed'].includes(j.status) && !seen.has(j.id)) { seen.add(j.id); if (!first) done(j); }
        }
        first = false;
        for (const id of Object.keys(rooms)) if (running.has(id) !== !!rooms[id]._auto && !rooms[id]._manual) { rooms[id]._auto = running.has(id); setActive(id, running.has(id)); }
      } catch {}
    };
    poll();
    state.pollTimer = setInterval(poll, 4000);
  }
  async function watchInsights(everySec = 120) {
    let seen = null;
    const run = async () => {
      try {
        const d = await (await fetch('/api/insights' + location.search)).json();
        if (d.mode !== 'live') return;
        const s = d.summary;
        report({ title: 'REPORTE DE INSTAGRAM', demo: false, lines: [`Alcance: ${s.reach}`, `Vistas: ${s.views}`, `Me gusta: ${s.likes} · Guardados: ${s.saves}`, `Comentarios: ${s.comments}`] });
        const ids = new Set(d.comments.map(c => c.id));
        if (seen) { const fresh = d.comments.filter(c => !seen.has(c.id)); if (fresh.length) notify('comment_new', { text: `@${fresh[0].username}: ${String(fresh[0].text).slice(0, 40)}` }); }
        seen = ids;
      } catch {}
    };
    clearInterval(state.insightTimer);
    state.insightTimer = setInterval(run, everySec * 1000);
    return run;
  }
  async function autoReports(everySec = 600) {
    clearInterval(state.reportTimer);
    const run = async () => {
      let lines = null;
      try {
        const m = await (await fetch('/api/monitor' + location.search)).json();
        lines = [`Trabajos hechos: ${m.jobs.total} (${m.jobs.failed} con fallas)`, `Gasto estimado: $${m.spend.estimatedUsd.toFixed(2)}`, `Pauta: ${m.guard?.ok === false ? 'revisar guardián' : 'todo en PAUSADO'}`, 'Vistas e interacción: sin pauta activa'];
      } catch {}
      report(lines ? { title: 'REPORTE DEL SISTEMA', lines, demo: false } : {});
    };
    state.reportTimer = setInterval(run, everySec * 1000);
    return run;
  }
  function resize() { const W = innerWidth, H = innerHeight; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();

  const clock = { last: 0, fps: 60, frames: 0, acc: 0 };
  let dogBusyBy = null;
  function handleEvents(id, w, t) {
    for (const e of w.events.splice(0)) {
      if (e.type === 'actStart' && e.key === 'alejo') { dogBusyBy = id; const p = e.poi; dog.call({ x: p.x + (p.fx || 0) * 0.6, z: p.z + (p.fz || 0) * 0.6 }); }
      if (e.type === 'actDo' && e.key === 'tv') state.tvUntil = t + 12;
      if (e.type === 'actDo' && e.key === 'reporte' && state.reportPending) { state.report = { data: state.reportPending, until: t + 15 }; state.reportPending = null; speak(id, (state.report.data.lines || [])[0] || 'Reporte', { dur: 5 }); }
      if (e.type === 'actEnd' && dogBusyBy === id) { dogBusyBy = null; dog.release(); }
    }
  }
  const office_xr_hook = { fn: null };
  function frame(ms) {
    const t = ms / 1000, dt = Math.min(0.05, t - clock.last || 0.016);
    clock.last = t; clock.acc += dt; clock.frames++; state.t = t;
    if (state.mode === 'auto' && (frame.tick = (frame.tick || 0) + dt) > 20) { frame.tick = 0; state.target = isNightNow() ? 1 : 0; }
    state.fade += (state.target - state.fade) * Math.min(1, dt * 1.6); if (Math.abs(state.target - state.fade) < 0.002) state.fade = state.target;
    const night = state.fade > 0.5; applyFade(state.fade);
    if (clock.acc > 0.5) { clock.fps = Math.round(clock.frames / clock.acc); clock.frames = 0; clock.acc = 0; }
    for (const [id, w] of Object.entries(workers)) {
      const r = rooms[id];
      w.update(dt, { dogOk: dogBusyBy === null, alejo: L.pois.alejo, night });
      handleEvents(id, w, t);
      applyPose(people[id], w, t);
      const co = chairObjs[id]; if (co && w.chair) { co.position.set(w.chair.x, 0, w.chair.z); co.rotation.y = w.chair.yaw; }
      const b = bubbles[id], txt = w.say || (r.active ? '' : '');
      b.visible = !!txt;
      if (txt) { b.material.map = bubbleSprite(textCache, txt, hexOf(r.def.color)); b.position.set(w.x, Math.max(1.12 + 0.41 * w.sit + w.hop, badge[id].sp.userData.base + 0.78), w.z); }
      if (badge[id]) badge[id].sp.visible = !txt;
      r.group.position.y = 0;
    }
    for (const [id, b] of Object.entries(badge)) { const k = bounce[id] != null ? (t - bounce[id]) / 1.0 : 2; b.sp.position.y = b.sp.userData.base + (k < 1 ? 0.3 * Math.abs(Math.sin(k * Math.PI * 2)) * (1 - k) : Math.sin(t * 1.6 + b.sp.position.x) * 0.015); if (k >= 1) bounce[id] = null; }
    dog.update(dt, night); applyDog(t);
    state.now = t;
    if (!frame.tvT || t - frame.tvT > 0.12) { frame.tvT = t; drawTV(t); }
    if ((frame.sk = (frame.sk || 0) + 1) % 8 === 0) wins.forEach((w, i) => drawSky(w, t, state.fade, i));
    if (night && !state.shoot && t > (state.nextShoot ??= t + 12)) { state.shoot = { t0: t }; state.nextShoot = t + rng.range(25, 60); for (const [id, w] of Object.entries(workers)) if (w.state === 'act' && w.act?.key === 'ventana') { w.doReact('surprise', 1.4); } }
    if (state.shoot && t - state.shoot.t0 > 1.3) state.shoot = null;
    for (const [id, z] of Object.entries(zzz)) {
      const sl = id === 'dog' ? dog.anim === 'sleep' : workers[id].face === 'sleepy' && night && workers[id].view !== 'walk';
      const k = (t * 0.7 + id.length) % 1, base = id === 'dog' ? [dog.x, 0.4, dog.z] : [workers[id].x, 1.0 + 0.41 * workers[id].sit, workers[id].z];
      z.material.opacity += ((sl ? 0.9 * (1 - k) : 0) - z.material.opacity) * 0.2; z.position.set(base[0] + 0.12 + k * 0.1, base[1] + k * 0.25, base[2]);
    }
    if ((frame.n = (frame.n || 0) + 1) % 6 === 0) for (const role of Object.keys(monCanvas)) { const w = workers[role]; drawMon(role, t, w && w.state === 'work' && !w.standing); }
    if (hoverId === '__time' && !down) { hover.visible = true; hover.material.map = textSprite(textCache, '🌗 Día / noche · ' + TLAB[state.mode], '#a392ff', 640); hover.scale.set(2.5, 0.44, 1); hover.position.set(sw.position.x, sw.position.y + 0.38, sw.position.z + 0.1); } else if (hoverId === '__tv' && !down) { hover.visible = true; hover.material.map = textSprite(textCache, '📺 Publicar y reportes · toca', '#7fe9bf', 640); hover.scale.set(2.5, 0.44, 1); hover.position.set(L.tv.x, L.tv.y + 0.7, L.tv.z + 0.2); } else if (hoverId && !down && rooms[hoverId]) { const r = rooms[hoverId], z = L.zones[hoverId]; hover.visible = true; hover.material.map = textSprite(textCache, r.def.name + ' · toca para abrir', hexOf(r.def.color), 640); hover.scale.set(2.5, 0.44, 1); hover.position.set(z.x, z.h + 0.62, z.z); } else hover.visible = false;
    if (view.goal) { const k = 1 - Math.exp(-dt * 5); view.target.lerp(view.goal, k); view.dist += (view.distG - view.dist) * k; view.yaw += (view.yawG - view.yaw) * k; }
    if (!external && !renderer.xr.isPresenting) placeCam();
    updateInfo(dt);
    if (office_xr_hook.fn) office_xr_hook.fn(t, dt);
    if (!external) renderer.render(scene, camera);
  }
  if (!external) renderer.setAnimationLoop(frame);
  setTime(opts.time || 'auto', true);
  return {
    renderer, scene, root, camera, rooms, pickables, ROOMS, focus, setActive, onPick: fn => (onPick = fn), fps: () => clock.fps, resize, view, ready, workers, people, dog, setTime, layout: L, stats: () => ({ ...stats, characters: Object.values(people).reduce((a, p) => a + p.userData.tris, 0) + dogMesh.userData.tris, time: state.time }),
    update: frame, external, setHover: id => (hoverId = id), cycleTime, badge, setBadge, demo, setContext: p => (state.page = p), setTVData, xrHook: fn => (office_xr_hook.fn = fn), pickAtRay: ray => { const h = ray.intersectObjects(pickables, false)[0]; return h ? h.object.userData.room : null; }, triggerPick: id => { if (id === '__time') cycleTime(); else if (id) pickRoom(id); }, setInfoProvider: fn => (info.provider = fn), infoCanvas: infoC, showInfo, hideInfo, infoState: () => ({ id: info.id, p: info.p }), react: (id, kind, dur) => workers[id]?.doReact(kind, dur), notify, report, speak, watchServer, autoReports, watchInsights, log, EVENTS: Object.keys(EVENTS)
  };
}
