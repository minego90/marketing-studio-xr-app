// Anuncio XR: un prisma de cuatro vistas reales del producto. Sin IA, sin costo.
// Escritorio: arrastrar/rueda. Quest/Android: «Entrar en AR» con colocación sobre superficies.
import * as THREE from './vendor/three.module.js';

const $ = s => document.querySelector(s);
const LABELS = { front: 'Frente', right: 'Derecha', left: 'Izquierda', back: 'Atrás' };
const ORDER = ['front', 'right', 'back', 'left']; // vuelta alrededor del prisma
let bundle = { title: 'Anuncio XR', sub: '', cta: { label: 'Visitar perfil', url: '' }, faces: [] };
try {
  bundle = await (await fetch('/api/xr-ad/bundle')).json();
} catch {}
$('#titleText').textContent = bundle.title || 'Anuncio XR';
if (bundle.sub) $('#sub').textContent = bundle.sub;
const cta = $('#cta');
cta.textContent = bundle.cta?.label || 'Visitar perfil';
bundle.cta?.url ? (cta.href = bundle.cta.url) : cta.removeAttribute('href');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.01, 50);
camera.position.set(0, 0.25, 1.0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2340, 1.6));
const key = new THREE.DirectionalLight(0xffe2c4, 1.8);
key.position.set(1, 2, 1.5);
scene.add(key);

// fondo de escritorio (se oculta en AR)
const bgTex = (() => {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 512;
  const g = c.getContext('2d'),
    gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#2a1f4d');
  gr.addColorStop(0.55, '#120f1f');
  gr.addColorStop(1, '#09080f');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 512);
  return new THREE.CanvasTexture(c);
})();
bgTex.colorSpace = THREE.SRGBColorSpace;
scene.background = bgTex;

const loader = new THREE.TextureLoader();
const load = url =>
  new Promise(r =>
    loader.load(
      url,
      t => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        r(t);
      },
      undefined,
      () => r(null)
    )
  );
const textures = {};
for (const f of bundle.faces || []) textures[f.slot] = await load(f.url);
const fallback = Object.values(textures).find(Boolean);
const aspect = fallback ? fallback.image.width / fallback.image.height : 0.8;
const H = 0.3,
  Wd = Math.min(0.3, H * aspect);
const dark = new THREE.MeshStandardMaterial({ color: 0x14111d, roughness: 0.6, metalness: 0.2 });
const side = slot => new THREE.MeshStandardMaterial({ map: textures[slot] || fallback || null, color: textures[slot] || fallback ? 0xffffff : 0x3a3150, roughness: 0.55, metalness: 0 });
// Orden de caras de BoxGeometry: +x, -x, +y, -y, +z, -z  →  derecha, izquierda, arriba, abajo, frente, atrás
const prism = new THREE.Mesh(new THREE.BoxGeometry(Wd, H, Wd), [side('right'), side('left'), dark, dark, side('front'), side('back')]);
const root = new THREE.Group();
root.add(prism);
const base = new THREE.Mesh(new THREE.CylinderGeometry(Wd * 0.78, Wd * 0.84, 0.012, 48), new THREE.MeshStandardMaterial({ color: 0x1b1727, roughness: 0.4, metalness: 0.6 }));
base.position.y = -H / 2 - 0.006;
root.add(base);
const glow = new THREE.Mesh(new THREE.RingGeometry(Wd * 0.9, Wd * 0.97, 64), new THREE.MeshBasicMaterial({ color: 0xff8fb8, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
glow.rotation.x = -Math.PI / 2;
glow.position.y = -H / 2;
root.add(glow);
root.position.y = 0.15;
scene.add(root);

// Interacción de escritorio
let yaw = 0.5,
  auto = true,
  dist = 1.0,
  drag = null;
const el = renderer.domElement;
el.addEventListener('pointerdown', e => ((drag = { x: e.clientX, yaw }), (auto = false), el.setPointerCapture(e.pointerId)));
el.addEventListener('pointermove', e => drag && (yaw = drag.yaw + (e.clientX - drag.x) * 0.01));
el.addEventListener('pointerup', () => (drag = null));
el.addEventListener('wheel', e => ((dist = Math.min(2.4, Math.max(0.6, dist + e.deltaY * 0.001))), e.preventDefault()), { passive: false });
$('#spin').onclick = () => {
  auto = !auto;
  $('#spin').textContent = auto ? 'Pausar giro' : 'Girar solo';
};
$('#spin').textContent = 'Pausar giro';
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function currentFace() {
  const a = ((yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  // yaw=0 → frente; la cara visible gira al revés que el prisma
  const idx = Math.round(((Math.PI * 2 - a) % (Math.PI * 2)) / (Math.PI / 2)) % 4;
  return ORDER[idx];
}

// AR
let reticle,
  placed = false,
  hitSource = null,
  refSpace = null;
if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-ar').then(ok => {
    $('#enter').disabled = !ok;
    if (!ok) $('#enter').textContent = 'AR no disponible aquí';
  });
} else $('#enter').textContent = 'AR no disponible aquí';
$('#enter').onclick = async () => {
  const session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['local-floor', 'hand-tracking', 'dom-overlay'], domOverlay: { root: document.body } });
  scene.background = null;
  root.scale.setScalar(1);
  root.visible = false;
  placed = false;
  $('#hint').textContent = 'Apunta a una superficie y toca para colocar el prisma';
  reticle = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.09, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7fe9bf }));
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);
  await renderer.xr.setSession(session);
  refSpace = renderer.xr.getReferenceSpace();
  const viewer = await session.requestReferenceSpace('viewer');
  hitSource = await session.requestHitTestSource({ space: viewer });
  const ctrl = renderer.xr.getController(0);
  ctrl.addEventListener('select', () => {
    if (!placed && reticle.visible) {
      root.position.setFromMatrixPosition(reticle.matrix);
      root.position.y += H / 2 + 0.012;
      root.visible = true;
      placed = true;
      reticle.visible = false;
      $('#hint').textContent = 'Camina alrededor: cada lado es una vista real · toca para girar';
    } else if (placed) yaw += Math.PI / 2;
  });
  scene.add(ctrl);
  session.addEventListener('end', () => {
    scene.background = bgTex;
    hitSource = null;
    reticle && scene.remove(reticle);
    root.visible = true;
    root.position.set(0, 0.15, 0);
    $('#hint').textContent = 'Arrastra para girar · rueda para acercar';
  });
};

let last = 0;
renderer.setAnimationLoop((t, frame) => {
  const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
  last = t;
  if (auto) yaw += dt * 0.6;
  root.rotation.y = yaw;
  glow.material.opacity = 0.35 + 0.2 * Math.sin(t / 500);
  if (!renderer.xr.isPresenting) {
    camera.position.set(0, 0.25, dist);
    camera.lookAt(0, 0.15, 0);
  } else if (frame && hitSource && !placed) {
    const hits = frame.getHitTestResults(hitSource);
    if (hits.length) {
      reticle.visible = true;
      reticle.matrix.fromArray(hits[0].getPose(refSpace).transform.matrix);
    } else reticle.visible = false;
  }
  const f = currentFace();
  if ($('#face').dataset.f !== f) {
    $('#face').dataset.f = f;
    $('#face').textContent = LABELS[f];
  }
  renderer.render(scene, camera);
});
window.__xrAd = { ready: true, faces: Object.keys(textures).filter(k => textures[k]) };
