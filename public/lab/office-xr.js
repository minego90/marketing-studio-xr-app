// Modo XR de la oficina: entra en AR/VR, coloca la oficina en miniatura frente al usuario,
// se agarra con pellizco/gatillo (1 mano mueve, 2 manos escalan y giran) y se invoca desde la muñeca.
import * as THREE from '../vendor/three.module.js';

export function attachXR(office, { button, onState } = {}) {
  const { renderer, scene, root, camera } = office;
  const S0 = 0.085;
  const wrapper = new THREE.Group(); // la oficina completa cuelga de aquí (mover/escalar/rotar)
  scene.add(wrapper); scene.remove(root); wrapper.add(root);
  wrapper.visible = true;
  const xr = { on: false, mode: null, savedBg: null, placed: false, shown: true };
  const ctrl = [0, 1].map(i => renderer.xr.getController(i));
  const grips = [0, 1].map(i => renderer.xr.getControllerGrip(i));
  const hands = [0, 1].map(i => renderer.xr.getHand(i));
  const rayMat = new THREE.LineBasicMaterial({ color: 0xa392ff, transparent: true, opacity: 0.8 });
  const rayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
  const player = new THREE.Group(); scene.add(player);
  ctrl.forEach((c, i) => { const l = new THREE.Line(rayGeo, rayMat); l.scale.z = 0.6; c.add(l); c.userData.i = i; c.userData.grab = false; player.add(c); player.add(grips[i]); player.add(hands[i]); });
  // botón de muñeca (mano izquierda): invoca / oculta la oficina y la vuelve a centrar
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  function drawWrist() {
    const g = cv.getContext('2d'); g.clearRect(0, 0, 128, 128);
    g.fillStyle = xr.shown ? '#6c4fff' : '#241c4a'; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill();
    g.strokeStyle = '#d8ccff'; g.lineWidth = 5; g.stroke();
    g.font = '60px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('🏢', 64, 70);
  }
  drawWrist();
  const wtex = new THREE.CanvasTexture(cv); wtex.colorSpace = THREE.SRGBColorSpace;
  const wrist = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.055), new THREE.MeshBasicMaterial({ map: wtex, transparent: true, depthTest: false }));
  wrist.renderOrder = 50; wrist.userData.wrist = true; wrist.visible = false; scene.add(wrist);
  const tmpP = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4(), ray = new THREE.Raycaster();
  function summon() { // coloca la oficina ~0.8 m delante, a la altura del pecho
    const cam = renderer.xr.getCamera(); cam.getWorldPosition(tmpP);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(tmpQ)); dir.y = 0; dir.normalize();
    wrapper.position.copy(tmpP).addScaledVector(dir, 0.85); wrapper.position.y = Math.max(0.55, tmpP.y - 0.55);
    wrapper.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI + 0.0;
    wrapper.scale.setScalar(S0); wrapper.visible = true; xr.shown = true; xr.placed = true; drawWrist(); wtex.needsUpdate = true;
  }
  function toggle() { if (xr.shown) { wrapper.visible = false; xr.shown = false; } else summon(); drawWrist(); wtex.needsUpdate = true; }
  const grab = [null, null];
  function rayFrom(c) { tmpM.identity().extractRotation(c.matrixWorld); ray.ray.origin.setFromMatrixPosition(c.matrixWorld); ray.ray.direction.set(0, 0, -1).applyMatrix4(tmpM); return ray; }
  ctrl.forEach((c, i) => {
    c.addEventListener('selectstart', () => {
      const r = rayFrom(c);
      if (r.intersectObject(wrist, false).length && wrist.visible) { toggle(); return; }
      if (!xr.shown) return;
      const id = office.pickAtRay(r);
      if (id) { office.triggerPick(id); return; }
      // ¿apunta a la oficina? -> agarrar
      const box = new THREE.Box3().setFromObject(wrapper).expandByScalar(0.08);
      if (r.ray.intersectsBox(box)) { c.userData.grab = true; begin(); }
    });
    c.addEventListener('selectend', () => { c.userData.grab = false; begin(); });
    c.addEventListener('squeezestart', () => { c.userData.grab = true; begin(); });
    c.addEventListener('squeezeend', () => { c.userData.grab = false; begin(); });
  });
  let gs = null;
  function begin() {
    const act = ctrl.filter(c => c.userData.grab);
    if (!act.length) { gs = null; return; }
    wrapper.updateMatrixWorld(true);
    if (act.length === 1) { gs = { n: 1, c: act[0], rel: act[0].matrixWorld.clone().invert().multiply(wrapper.matrixWorld) }; }
    else {
      const a = act[0].getWorldPosition(new THREE.Vector3()), b = act[1].getWorldPosition(new THREE.Vector3());
      gs = { n: 2, d: a.distanceTo(b), ang: Math.atan2(b.x - a.x, b.z - a.z), s: wrapper.scale.x, ry: wrapper.rotation.y, off: wrapper.position.clone().sub(a.clone().add(b).multiplyScalar(0.5)) };
    }
  }
  const dumpV = new THREE.Vector3(), dumpS = new THREE.Vector3();
  office.xrHook(() => {
    if (!renderer.xr.isPresenting) return;
    if (!xr.placed) summon();
    // botón de muñeca sobre la mano izquierda
    wrist.visible = false;
    const lc = ctrl.find(c => c.userData.hand === 'left') || ctrl[0];
    const lh = hands[0], wj = lh.joints && lh.joints['wrist'];
    if (wj && wj.position.lengthSq() > 0) { wj.getWorldPosition(wrist.position); wj.getWorldQuaternion(wrist.quaternion); wrist.translateY(0.05); wrist.translateZ(0.015); wrist.rotateX(-Math.PI / 2); wrist.visible = true; }
    else if (lc) { lc.getWorldPosition(wrist.position); wrist.position.y += 0.07; wrist.quaternion.copy(renderer.xr.getCamera().quaternion); wrist.visible = true; }
    if (gs && xr.shown) {
      if (gs.n === 1) { tmpM.copy(gs.c.matrixWorld).multiply(gs.rel); tmpM.decompose(wrapper.position, tmpQ, dumpS); wrapper.rotation.setFromQuaternion(tmpQ); wrapper.rotation.x = 0; wrapper.rotation.z = 0; }
      else {
        const a = ctrl[0].getWorldPosition(new THREE.Vector3()), b = ctrl[1].getWorldPosition(new THREE.Vector3());
        const k = THREE.MathUtils.clamp(gs.s * a.distanceTo(b) / Math.max(0.05, gs.d), 0.03, 0.4);
        wrapper.scale.setScalar(k); wrapper.rotation.y = gs.ry + (Math.atan2(b.x - a.x, b.z - a.z) - gs.ang);
        wrapper.position.copy(a.add(b).multiplyScalar(0.5)).add(gs.off.clone().multiplyScalar(k / gs.s));
      }
    }
  });
  async function start() {
    if (!navigator.xr) throw new Error('WebXR no disponible');
    const ar = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
    const mode = ar ? 'immersive-ar' : 'immersive-vr';
    const session = await navigator.xr.requestSession(mode, { optionalFeatures: ['local-floor', 'hand-tracking', 'bounded-floor'] });
    xr.mode = mode; xr.savedBg = scene.background;
    if (ar) scene.background = null;
    renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
    await renderer.xr.setSession(session);
    xr.on = true; xr.placed = false; onState && onState(true, mode);
    session.addEventListener('end', () => { xr.on = false; renderer.xr.enabled = false; scene.background = xr.savedBg; wrapper.position.set(0, 0, 0); wrapper.rotation.set(0, 0, 0); wrapper.scale.setScalar(1); wrapper.visible = true; wrist.visible = false; xr.shown = true; onState && onState(false); office.resize(); });
  }
  if (button) {
    (async () => {
      const ok = navigator.xr && (await navigator.xr.isSessionSupported('immersive-ar').catch(() => false) || await navigator.xr.isSessionSupported('immersive-vr').catch(() => false));
      button.hidden = !ok; if (!ok) return;
      button.onclick = () => start().catch(e => { button.textContent = 'XR: ' + e.message; });
    })();
  }
  return { start, summon, toggle, wrapper, state: xr };
}
