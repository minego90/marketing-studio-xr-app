// Plantillas de anuncio XR como «programas con parámetros»: cambias un valor y la escena se regenera.
// Sin IA, sin costo. Cada plantilla declara sus controles; la interfaz se genera sola desde ese esquema.
import * as THREE from '../vendor/three.module.js';

export const COMMON = [
  { id: 'title', type: 'text', label: 'Titular', value: 'Una vista real desde cada lado' },
  { id: 'cta', type: 'text', label: 'Botón', value: 'Visitar perfil' },
  { id: 'bg', type: 'color', label: 'Fondo', value: '#17122b' },
  { id: 'accent', type: 'color', label: 'Acento', value: '#ff8fb8' },
  { id: 'light', type: 'range', label: 'Luz', min: 0.2, max: 3, step: 0.05, value: 1.6 },
  { id: 'warm', type: 'range', label: 'Temperatura (fría ⇄ cálida)', min: 0, max: 1, step: 0.01, value: 0.6 },
  { id: 'speed', type: 'range', label: 'Giro', min: 0, max: 2, step: 0.05, value: 0.5 }
];
export const TEMPLATES = {
  prism: { name: 'Prisma', blurb: 'Cuatro vistas reales en un bloque que gira.', params: [{ id: 'size', type: 'range', label: 'Tamaño', min: 0.6, max: 1.6, step: 0.05, value: 1 }] },
  arc: { name: 'Carrusel espacial', blurb: 'Cuatro pósters en arco alrededor del espectador.', params: [{ id: 'radius', type: 'range', label: 'Radio del arco', min: 0.6, max: 2, step: 0.05, value: 1.1 }, { id: 'tilt', type: 'range', label: 'Inclinación', min: 0, max: 0.5, step: 0.01, value: 0.12 }] },
  portal: { name: 'Portal', blurb: 'Una puerta que abre un túnel de vistas.', params: [{ id: 'depth', type: 'range', label: 'Profundidad', min: 2, max: 8, step: 1, value: 5 }, { id: 'ring', type: 'range', label: 'Brillo del aro', min: 0, max: 1.5, step: 0.05, value: 0.8 }] }
};
export const defaults = kind => Object.fromEntries([...COMMON, ...TEMPLATES[kind].params].map(p => [p.id, p.value]));

function titleTexture(text, accent) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 256);
  g.font = '800 84px "Inter Display",Inter,system-ui,sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#f6f3fd';
  const words = String(text || '').split(/\s+/);
  let lines = [''];
  for (const w of words) {
    const t = lines.at(-1) ? lines.at(-1) + ' ' + w : w;
    if (g.measureText(t).width > 940 && lines.at(-1)) lines.push(w);
    else lines[lines.length - 1] = t;
  }
  lines = lines.slice(0, 2);
  if (lines.length > 1) g.font = '800 68px "Inter Display",Inter,system-ui,sans-serif';
  lines.forEach((l, i) => g.fillText(l, 512, 128 + (i - (lines.length - 1) / 2) * 84));
  g.fillStyle = accent;
  g.fillRect(432, 242, 160, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function ctaTexture(text, accent) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = accent;
  g.beginPath();
  g.roundRect(8, 16, 496, 96, 48);
  g.fill();
  g.fillStyle = '#16111f';
  g.font = '800 46px Inter,system-ui,sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text || '', 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const mix = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k);

/** Construye (o reconstruye) la escena de una plantilla. `faces` = 4 texturas (o null). */
export function createStage(canvas, kind = 'prism', opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 60);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x2a2340, 1);
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(1, 2, 1.5);
  scene.add(hemi, key);
  const root = new THREE.Group();
  scene.add(root);
  const stage = { kind, params: defaults(kind), faces: opts.faces || [], yaw: 0.4, dist: 1.15, auto: true, drag: null, renderer, scene, camera, root, stats: { tris: 0, objects: 0 } };
  const mats = [];
  const faceMat = i => {
    const t = stage.faces[i % Math.max(1, stage.faces.length)] || null;
    const m = new THREE.MeshStandardMaterial({ map: t, color: t ? 0xffffff : 0x4b3f7a, roughness: 0.55 });
    mats.push(m);
    return m;
  };
  let title, cta, ring, glow;
  function build() {
    root.clear();
    mats.length = 0;
    const p = stage.params;
    const faceAspect = (stage.faces[0]?.image && stage.faces[0].image.width / stage.faces[0].image.height) || 0.8;
    const H = 0.3 * (p.size || 1),
      W = Math.min(0.32, H * faceAspect);
    if (kind === 'prism') {
      const dark = new THREE.MeshStandardMaterial({ color: 0x14111d, roughness: 0.6 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(W, H, W), [faceMat(1), faceMat(3), dark, dark, faceMat(0), faceMat(2)]);
      m.position.y = 0.15;
      root.add(m);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.78, W * 0.84, 0.012, 48), new THREE.MeshStandardMaterial({ color: 0x1b1727, metalness: 0.6, roughness: 0.4 }));
      base.position.y = 0.15 - H / 2 - 0.006;
      root.add(base);
      stage.spin = m;
      stage.spinRoot = false;
    } else if (kind === 'arc') {
      const grp = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const a = -0.9 + i * 0.6;
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.32 * faceAspect * 1.25, 0.4), new THREE.MeshStandardMaterial({ map: stage.faces[i % Math.max(1, stage.faces.length)] || null, color: stage.faces.length ? 0xffffff : 0x4b3f7a, side: THREE.DoubleSide, roughness: 0.5 }));
        pl.position.set(Math.sin(a) * p.radius, 0.2, -Math.cos(a) * p.radius + p.radius);
        pl.rotation.y = -a;
        pl.rotation.x = -p.tilt;
        grp.add(pl);
      }
      root.add(grp);
      stage.spin = grp;
      stage.spinRoot = false;
      grp.position.z = -p.radius;
    } else {
      const grp = new THREE.Group();
      for (let i = 0; i < p.depth; i++) {
        const s = 1 - i * 0.12,
          z = -i * 0.28;
        const fr = new THREE.Mesh(new THREE.TorusGeometry(0.32 * s, 0.012, 12, 64), new THREE.MeshBasicMaterial({ color: mix(p.accent, '#a392ff', i / p.depth) }));
        fr.position.set(0, 0.25, z);
        fr.material.opacity = 1 - i / (p.depth + 1);
        fr.material.transparent = true;
        grp.add(fr);
      }
      const back = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.52), faceMat(0));
      back.position.set(0, 0.25, -p.depth * 0.28);
      grp.add(back);
      ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 16, 80), new THREE.MeshBasicMaterial({ color: p.accent }));
      ring.position.set(0, 0.25, 0.02);
      grp.add(ring);
      root.add(grp);
      stage.spin = grp;
      stage.spinRoot = false;
      grp.position.z = 0.4;
    }
    // glow de suelo + titular + botón
    glow = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.33, 64), new THREE.MeshBasicMaterial({ color: p.accent, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    glow.rotation.x = -Math.PI / 2;
    root.add(glow);
    title = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.175), new THREE.MeshBasicMaterial({ map: titleTexture(p.title, p.accent), transparent: true }));
    title.position.set(0, 0.62, 0);
    cta = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.07), new THREE.MeshBasicMaterial({ map: ctaTexture(p.cta, p.accent), transparent: true }));
    cta.position.set(0, -0.06, 0.28);
    root.add(title, cta);
    stage.cta = cta;
    scene.background = new THREE.Color(p.bg);
    hemi.intensity = p.light * 0.6;
    key.intensity = p.light;
    key.color = mix('#9cc4ff', '#ffd2a0', p.warm);
    let tris = 0,
      objects = 0;
    root.traverse(o => {
      if (o.isMesh) {
        objects++;
        const g = o.geometry;
        tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      }
    });
    stage.stats = { tris: Math.round(tris), objects };
  }
  stage.set = (k, v) => {
    stage.params[k] = v;
    // los cambios de luz/fondo/giro son instantáneos; el resto regenera la escena
    if (k === 'light') (hemi.intensity = v * 0.6), (key.intensity = v);
    else if (k === 'warm') key.color = mix('#9cc4ff', '#ffd2a0', v);
    else if (k === 'bg') scene.background = new THREE.Color(v);
    else if (k !== 'speed') build();
  };
  stage.setKind = k => {
    kind = k;
    stage.kind = k;
    stage.params = { ...defaults(k), ...Object.fromEntries(Object.entries(stage.params).filter(([id]) => COMMON.some(c => c.id === id))) };
    build();
  };
  stage.setFaces = f => {
    stage.faces = f;
    build();
  };
  stage.resize = (w, h) => {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  stage.render = (t, dt) => {
    if (stage.auto) stage.yaw += dt * stage.params.speed;
    if (kind === 'portal') {
      stage.spin.rotation.y = Math.sin(stage.yaw * 0.6) * 0.35;
      ring && (ring.material.opacity = 1);
    } else stage.spin.rotation.y = stage.yaw;
    if (kind === 'arc') root.rotation.y = 0;
    glow.material.opacity = 0.3 + 0.25 * Math.sin(t / 500);
    camera.position.set(0, 0.35, stage.dist);
    camera.lookAt(0, 0.25, 0);
    cta.lookAt(camera.position);
    title.lookAt(camera.position);
    renderer.render(scene, camera);
  };
  const el = canvas;
  el.addEventListener('pointerdown', e => ((stage.drag = { x: e.clientX, yaw: stage.yaw }), (stage.auto = false), el.setPointerCapture(e.pointerId)));
  el.addEventListener('pointermove', e => stage.drag && (stage.yaw = stage.drag.yaw + (e.clientX - stage.drag.x) * 0.01));
  el.addEventListener('pointerup', () => (stage.drag = null));
  el.addEventListener('wheel', e => ((stage.dist = Math.min(3.2, Math.max(0.7, stage.dist + e.deltaY * 0.001))), e.preventDefault()), { passive: false });
  build();
  return stage;
}

// Textura de producto de ejemplo cuando todavía no hay fotos.
export function sampleTexture(i = 0) {
  const c = document.createElement('canvas');
  c.width = 400;
  c.height = 500;
  const g = c.getContext('2d');
  const hues = [['#d8cfe6', '#8a7aa8'], ['#f0d6c4', '#b07a6a'], ['#cfe6dc', '#6aa08a'], ['#e6e0c4', '#a8a06a']][i % 4];
  const gr = g.createLinearGradient(0, 0, 0, 500);
  gr.addColorStop(0, hues[0]);
  gr.addColorStop(1, hues[1]);
  g.fillStyle = gr;
  g.fillRect(0, 0, 400, 500);
  g.fillStyle = '#3b2a4f';
  g.beginPath();
  g.roundRect(150, 140, 100, 260, 26);
  g.fill();
  g.fillStyle = '#b89a6a';
  g.fillRect(172, 100, 56, 48);
  g.fillStyle = '#efe4c8';
  g.fillRect(162, 230, 76, 90);
  g.fillStyle = '#3b2a4f';
  g.font = '700 16px serif';
  g.textAlign = 'center';
  g.fillText(['FRENTE', 'DERECHA', 'ATRÁS', 'IZQUIERDA'][i % 4], 200, 282);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
