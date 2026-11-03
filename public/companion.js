import * as THREE from './vendor/three.module.js';
import { coachAdvice } from './studio-domain.js';
import { orchestra } from './orchestra.js';

// Small procedural companion: shared geometries/materials, no lights or model download.
export function createCompanion(parent, state) {
  const group = new THREE.Group();
  group.position.set(-0.405, 0.405, 0.035);
  parent.add(group);
  const geometries = [],
    materials = [];
  const sphere = new THREE.SphereGeometry(1, 16, 10);
  geometries.push(sphere);
  const material = color => {
    const m = new THREE.MeshBasicMaterial({ color });
    materials.push(m);
    return m;
  };
  const shell = material(0xbd9af2),
    face = material(0x181726),
    eye = material(0xb8e7cd),
    accent = material(0xffd1a0);
  function ball(mat, x, y, z, sx, sy, sz) {
    const m = new THREE.Mesh(sphere, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    group.add(m);
    return m;
  }
  ball(shell, 0, 0, 0, 0.045, 0.047, 0.032);
  ball(face, 0, 0.008, 0.027, 0.036, 0.023, 0.009);
  const eyes = [ball(eye, -0.013, 0.009, 0.036, 0.0045, 0.008, 0.004), ball(eye, 0.013, 0.009, 0.036, 0.0045, 0.008, 0.004)];
  ball(accent, 0, 0.065, 0, 0.007, 0.007, 0.007);
  ball(shell, 0, -0.045, 0, 0.025, 0.017, 0.021);
  const ringGeo = new THREE.TorusGeometry(0.055, 0.003, 6, 28);
  geometries.push(ringGeo);
  const ring = new THREE.Mesh(ringGeo, accent);
  ring.rotation.x = 1.15;
  ring.position.y = -0.026;
  group.add(ring);
  const bubbleCanvas = document.createElement('canvas');
  bubbleCanvas.width = 768;
  bubbleCanvas.height = 224;
  const q = bubbleCanvas.getContext('2d'),
    texture = new THREE.CanvasTexture(bubbleCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const bubbleGeo = new THREE.PlaneGeometry(0.28, 0.082),
    bubbleMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0 });
  geometries.push(bubbleGeo);
  materials.push(bubbleMat);
  const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
  bubble.position.set(0.2, 0.014, 0);
  bubble.visible = false;
  group.add(bubble);
  // Luma solo habla cuando el orquestador le da la palabra (una acción real) y de a un mensaje a la vez.
  let speech = { on: false, text: '', dirty: false };
  orchestra.register('luma', {
    show: text => {
      speech = { on: true, text, dirty: true };
    },
    hide: () => {
      speech.on = false;
    }
  });
  function update(time) {
    group.visible = state.assistantVisible;
    if (!group.visible) return;
    const advice = coachAdvice(state),
      motion = !state.reducedMotion,
      t = time * 0.001;
    group.position.y = 0.405 + (motion ? Math.sin(t * 1.5) * 0.008 : 0);
    group.rotation.z = motion ? Math.sin(t * 0.8) * 0.035 : 0;
    ring.rotation.z = motion ? t * (advice.mood === 'thinking' ? 1.5 : 0.15) : 0;
    const blink = motion && Math.sin(t * 0.7) > 0.997 ? 0.15 : 1;
    for (const e of eyes) e.scale.y = 0.008 * blink;
    const target = speech.on ? 1 : 0;
    bubbleMat.opacity += (target - bubbleMat.opacity) * 0.25;
    if (Math.abs(target - bubbleMat.opacity) < 0.02) bubbleMat.opacity = target;
    bubble.visible = bubbleMat.opacity > 0.02;
    if (!speech.dirty) return;
    speech.dirty = false;
    q.clearRect(0, 0, 768, 224);
    q.fillStyle = '#211b30f5';
    q.beginPath();
    q.roundRect(3, 3, 762, 218, 28);
    q.fill();
    q.strokeStyle = '#bd9af2';
    q.lineWidth = 3;
    q.stroke();
    q.fillStyle = '#ffd1a0';
    q.font = '700 27px sans-serif';
    q.fillText('LUMA', 28, 47);
    q.fillStyle = '#f6f1fc';
    q.font = '31px sans-serif';
    let line = '',
      row = 0;
    for (const word of speech.text.split(/\s+/)) {
      if (q.measureText(line + word).width > 706 && line) {
        q.fillText(line, 28, 96 + row * 38);
        row++;
        line = '';
        if (row >= 3) break;
      }
      line += word + ' ';
    }
    if (row < 3) q.fillText(line, 28, 96 + row * 38);
    texture.needsUpdate = true;
  }
  function dispose() {
    orchestra.unregister('luma');
    parent.remove(group);
    texture.dispose();
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
  }
  return { group, update, dispose };
}
