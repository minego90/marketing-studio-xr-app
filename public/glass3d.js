// Cristal 3D para la guía dentro del visor (Quest / visor virtual).
// El lienzo 2D sigue dibujando texto e iconos y atendiendo los toques; este módulo pone detrás láminas de cristal reales
// (bisel, reflejos que cambian con el ángulo e iridiscencia). Sin «transmission» para que sea ligero en Quest.
import * as THREE from './vendor/three.module.js';
import { kit3d, background, rr } from './ui-kit.js';
import { makePixelPerson, setFace, WORKERS } from './lab/pixelpeople.js';

function makeEnv() {
  const s = new THREE.Scene();
  s.background = new THREE.Color('#1c2030');
  const box = (w, h, d, x, y, z, c, k) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) }));
    m.position.set(x, y, z);
    s.add(m);
  };
  box(14, 0.5, 8, 0, 7, 0, '#ffffff', 7);
  box(0.5, 9, 8, -8, 0, 0, '#bcd4ff', 5);
  box(0.5, 9, 8, 8, 0, 0, '#ffd6e8', 4);
  box(9, 9, 0.5, 0, 0, 8, '#9fb4ff', 0.3);
  box(9, 0.5, 9, 0, -7, 0, '#6a7690', 1);
  return s;
}

function slabGeometry(w, h, r, depth, bevel) {
  const s = new THREE.Shape(),
    x = -w / 2,
    y = -h / 2,
    rr_ = Math.min(r, w / 2, h / 2);
  s.moveTo(x + rr_, y);
  s.lineTo(x + w - rr_, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr_);
  s.lineTo(x + w, y + h - rr_);
  s.quadraticCurveTo(x + w, y + h, x + w - rr_, y + h);
  s.lineTo(x + rr_, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr_);
  s.lineTo(x, y + rr_);
  s.quadraticCurveTo(x, y, x + rr_, y);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 6, curveSegments: 10 });
  g.translate(0, 0, -depth);
  return g;
}

export function createGlass3D(panel, renderer) {
  const W = panel.canvas.width,
    H = panel.canvas.height,
    K = panel.width / W; // metros por píxel
  const group = new THREE.Group();
  group.visible = false;
  panel.group.add(group);

  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(makeEnv(), 0.03).texture;
  pm.dispose();

  // fondo noche (mismo que el 2D) con esquinas redondeadas
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = W;
  bgCanvas.height = H;
  {
    const g = bgCanvas.getContext('2d');
    g.save();
    rr(g, 0, 0, W, H, 40);
    g.clip();
    background(g, W, H);
    g.restore();
    rr(g, 1, 1, W - 2, H - 2, 40);
    g.strokeStyle = 'rgba(255,255,255,0.16)';
    g.lineWidth = 2;
    g.stroke();
  }
  const bgTex = new THREE.CanvasTexture(bgCanvas);
  bgTex.colorSpace = THREE.SRGBColorSpace;
  bgTex.minFilter = THREE.LinearFilter;
  bgTex.generateMipmaps = false;
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(panel.width, panel.height), new THREE.MeshBasicMaterial({ map: bgTex, transparent: true, depthWrite: false }));
  bg.position.z = -0.042;
  bg.renderOrder = 15;
  group.add(bg);

  const base = { metalness: 0.15, envMap: env, transparent: true, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.06 };
  const MATS = {
    glass: new THREE.MeshPhysicalMaterial({ ...base, color: '#16213f', roughness: 0.14, opacity: 0.5, envMapIntensity: 1.6, iridescence: 0.7, iridescenceIOR: 1.3, iridescenceThicknessRange: [140, 520] }),
    glassStrong: new THREE.MeshPhysicalMaterial({ ...base, color: '#223158', roughness: 0.12, opacity: 0.62, envMapIntensity: 1.8, iridescence: 0.9, iridescenceIOR: 1.35, iridescenceThicknessRange: [140, 620] }),
    pearl: new THREE.MeshPhysicalMaterial({ ...base, color: '#eef1f8', metalness: 0.05, roughness: 0.32, opacity: 1, envMapIntensity: 0.8, iridescence: 0.5, iridescenceIOR: 1.25, iridescenceThicknessRange: [100, 380], depthWrite: true })
  };
  MATS.pearlOff = MATS.pearl.clone();
  MATS.pearlOff.opacity = 0.28;
  const geoCache = new Map();
  const getGeo = (w, h, r, d, b) => {
    const key = [Math.round(w), Math.round(h), Math.round(r), d].join('|');
    let g = geoCache.get(key);
    if (!g) {
      g = slabGeometry(w * K, h * K, r * K, d, b);
      geoCache.set(key, g);
      if (geoCache.size > 90) {
        const first = geoCache.keys().next().value;
        geoCache.get(first).dispose();
        geoCache.delete(first);
      }
    }
    return g;
  };
  // Zorro fotógrafo 3D (el mismo modelo de la oficina), pequeño, que respira y dispara fotos sobre el cristal.
  let fox = null, foxCam = null, foxFlash = null;
  function ensureFox() {
    if (fox) return;
    fox = makePixelPerson(WORKERS[0]);
    fox.scale.setScalar(0.15);
    fox.visible = false;
    const hand = fox.userData.parts.armR;
    foxCam = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.17, 0.12), new THREE.MeshBasicMaterial({ color: 0x20243a }));
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.06, 16), new THREE.MeshBasicMaterial({ color: 0x9fb8ff }));
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.09;
    foxFlash = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    foxFlash.position.set(0, 0.02, 0.16);
    foxCam.add(body, lens, foxFlash);
    foxCam.position.set(0.05, -0.12, 0.08);
    hand.add(foxCam);
    group.add(fox);
  }
  function updateFox(time) {
    const f = kit3d.fox;
    if (!f) { if (fox) fox.visible = false; return; }
    ensureFox();
    const t = time / 1000, u = fox.userData.parts;
    fox.visible = true;
    fox.position.set((f.x - W / 2) * K, -(f.y - H / 2) * K - 0.055, 0.03);
    fox.rotation.y = Math.sin(t * 0.8) * 0.35 + 0.15;
    fox.position.y += Math.sin(t * 2.2) * 0.003;
    u.armR.rotation.x = -1.55 + Math.sin(t * 1.4) * 0.05; // sostiene la cámara al frente
    u.armL.rotation.x = Math.sin(t * 2.2) * 0.12;
    u.head.rotation.z = Math.sin(t * 1.1) * 0.05;
    const cyc = (t % 3.4) / 3.4, flash = cyc > 0.86 && cyc < 0.93;
    foxFlash.material.opacity = flash ? 0.9 : 0;
    setFace(fox, flash ? 'surprised' : Math.sin(t * 0.9) > 0.975 ? 'blink' : 'happy');
  }
  const pool = [];
  const DEPTH = 0.010,
    BEVEL = 0.0038;

  function update(time = 0) {
    const on = kit3d.enabled && kit3d.guide;
    group.visible = on;
    if (!on) return;
    updateFox(time);
    const slabs = kit3d.slabs;
    for (let i = 0; i < slabs.length; i++) {
      const s = slabs[i];
      let m = pool[i];
      if (!m) {
        m = new THREE.Mesh();
        m.renderOrder = 18;
        pool[i] = m;
        group.add(m);
      }
      m.visible = true;
      m.geometry = getGeo(s.w, s.h, s.r, DEPTH, BEVEL);
      m.material = s.kind === 'pearl' ? (s.disabled ? MATS.pearlOff : MATS.pearl) : s.strong ? MATS.glassStrong : MATS.glass;
      const level = Math.min(3, s.level || 0);
      const front = -0.034 + level * 0.010 + (s.hover || 0) * 0.004 - (s.press || 0) * 0.003;
      m.position.set((s.x + s.w / 2 - W / 2) * K, -(s.y + s.h / 2 - H / 2) * K, front);
      m.renderOrder = 16 + level;
    }
    for (let i = slabs.length; i < pool.length; i++) pool[i].visible = false;
  }
  return { update, group, dispose: () => { geoCache.forEach(g => g.dispose()); bgTex.dispose(); } };
}
