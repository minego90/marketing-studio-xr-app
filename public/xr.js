import * as THREE from './vendor/three.module.js';
import { xrlog, getImage } from './store.js';
import { createCompanion } from './companion.js';
import { createOffice } from './lab/office3d.js';
import { officeInfo } from './office-info.js';
import { VERSION } from './version.js';
import { createWristButtons } from './wrist-buttons.js';
import { createGlass3D } from './glass3d.js';
import { kit3d } from './ui-kit.js';
import { XRHandModelFactory } from './vendor/webxr/XRHandModelFactory.js';
import {
  placeWristPanel,
  placeCameraPanel,
  configureHandOcclusion,
  beginPanelGrab,
  applyPanelGrab,
  CAMERA_PANEL_WIDTH,
  WRIST_MENU_WIDTH
} from './wrist-ui.js';

export async function initXR(app) {
  const { board, preview, cameraHud, state, draw, action, hitAt, setHover, notice, ensureCamera } = app,
    button = document.querySelector('#enterXR'),
    status = document.querySelector('#xrStatus');
  if (!window.isSecureContext) {
    button.disabled = true;
    button.textContent = 'Quest necesita HTTPS o USB';
    return;
  }
  if (!navigator.xr) {
    button.disabled = true;
    button.textContent = 'Abrir en Meta Quest Browser';
    return;
  }
  const supported = await navigator.xr.isSessionSupported('immersive-ar');
  if (!supported) {
    button.disabled = true;
    button.textContent = 'AR no disponible en este navegador';
    return;
  }
  let buildTag = '';
  fetch('/api/build' + location.search)
    .then(r => r.json())
    .then(b => {
      buildTag = b.label + ' · ' + b.hash;
      status.textContent = 'Versión ' + buildTag;
      window.__build = b;
    })
    .catch(() => {});
  const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#xrCanvas'), alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFoveation?.(0.6);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.08, 14),
    raycaster = new THREE.Raycaster();
  let session = null,
    recenterNext = false,
    summonNext = false,
    frameNumber = 0;
  const wristCanvas = document.createElement('canvas');
  wristCanvas.width = 256;
  wristCanvas.height = 512;
  const wg = wristCanvas.getContext('2d');
  let officeShown = false;
  function drawWrist() {
    wg.clearRect(0, 0, 256, 512);
    // botón 1: cámara
    wg.fillStyle = '#282037';
    wg.beginPath();
    wg.roundRect(4, 4, 248, 248, 52);
    wg.fill();
    wg.strokeStyle = '#ffd1a0';
    wg.lineWidth = 11;
    wg.strokeRect(52, 82, 152, 108);
    wg.beginPath();
    wg.arc(128, 136, 32, 0, Math.PI * 2);
    wg.stroke();
    wg.fillStyle = '#ffd1a0';
    wg.fillRect(86, 57, 68, 25);
    wg.font = 'bold 23px sans-serif';
    wg.textAlign = 'center';
    wg.fillText('CÁMARA', 128, 228);
    // botón 2: oficina (invoca / oculta la maqueta 3D)
    wg.fillStyle = officeShown ? '#4a35c9' : '#282037';
    wg.beginPath();
    wg.roundRect(4, 260, 248, 248, 52);
    wg.fill();
    wg.strokeStyle = '#c9bcff';
    wg.lineWidth = 11;
    wg.lineJoin = 'round';
    wg.beginPath();
    wg.moveTo(128, 296); wg.lineTo(206, 336); wg.lineTo(206, 416); wg.lineTo(128, 456); wg.lineTo(50, 416); wg.lineTo(50, 336); wg.closePath();
    wg.moveTo(50, 336); wg.lineTo(128, 376); wg.lineTo(206, 336); wg.moveTo(128, 376); wg.lineTo(128, 456);
    wg.stroke();
    wg.fillStyle = '#c9bcff';
    wg.font = 'bold 23px sans-serif';
    wg.fillText(officeShown ? 'OCULTAR' : 'OFICINA', 128, 492);
  }
  drawWrist();
  const uiAt = (name, x, y) =>
    name === 'wrist'
      ? x >= 0 && x <= 256 && y >= 0 && y <= 256
        ? { id: state.hudVisible ? 'hud-close' : 'camera-hud', label: 'Cámara', disabled: false }
        : x >= 0 && x <= 256 && y > 256 && y <= 512
          ? { id: 'office-toggle', label: 'Oficina 3D', disabled: false }
          : null
      : hitAt(name, x, y);
  const textures = [];
  const panels = [
    { name: 'main', canvas: board, width: 0.84, height: (0.84 * 1060) / 1400 },
    { name: 'preview', canvas: preview, width: 0.4, height: (0.4 * 1100) / 900 },
    { name: 'camera', canvas: cameraHud, width: CAMERA_PANEL_WIDTH, height: (CAMERA_PANEL_WIDTH * 1040) / 1000 },
    { name: 'wrist', canvas: wristCanvas, width: 0.05, height: 0.1 }
  ].map(p => {
    const texture = new THREE.CanvasTexture(p.canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    textures.push(texture);
    const group = new THREE.Group(),
      plane = new THREE.Mesh(
        new THREE.PlaneGeometry(p.width, p.height),
        new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true })
      );
    plane.userData.panel = p.name;
    // Orden fijo: los paneles siempre se dibujan después de la oficina; así no se intercambian al moverte (parpadeo).
    plane.renderOrder = p.name === 'wrist' ? 0 : 20;
    group.add(plane);
    let handle = null,
      handleHit = null;
    if (p.name !== 'wrist') {
      // Separate bottom grab rail: a thin white bar with a larger invisible target.
      const w = Math.min(0.16, p.width * 0.42),
        y = -p.height / 2 - 0.024;
      handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.004, w - 0.008, 4, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      handle.rotation.z = Math.PI / 2;
      handle.position.set(0, y, 0.002);
      group.add(handle);
      handleHit = new THREE.Mesh(
        new THREE.PlaneGeometry(w + 0.045, 0.044),
        new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide })
      );
      handleHit.position.set(0, y, 0.004);
      group.add(handleHit);
    }
    scene.add(group);
    return { ...p, group, plane, texture, handle, handleHit };
  });
  const glass3d = createGlass3D(panels[0], renderer); // cristal 3D de la guía (se activa solo dentro del visor)
  const wristPanel = panels[3];
  wristPanel.group.visible = false;
  // El plano del canvas queda solo como zona de toque (invisible); lo que se ve son los botones 3D.
  wristPanel.plane.material.colorWrite = false;
  wristPanel.plane.material.depthWrite = false;
  const wristBtns = createWristButtons();
  wristPanel.group.add(wristBtns.group);
  let wristHover = -1,
    wristPress = -1,
    wristPressUntil = 0;
  const wristIdx = id => (id === 'office-toggle' ? 1 : id === 'camera-hud' || id === 'hud-close' ? 0 : -1);
  const hudPanel = panels[2];
  hudPanel.group.visible = false;
  let hudWasVisible = false;
  const hudDelta = new THREE.Vector3();
  const panelPlanes = panels.flatMap(p => (p.handleHit ? [p.plane, p.handleHit] : [p.plane])),
    companion = { update() {}, dispose() {} }; // Luma (bot flotante) retirada: ya no encaja con la interfaz
  {
    const c = document.createElement('canvas'); c.width = 512; c.height = 80;
    const g = c.getContext('2d'); g.fillStyle = 'rgba(16,12,28,.9)'; g.beginPath(); g.roundRect(4, 4, 504, 72, 30); g.fill();
    g.fillStyle = '#dfe8ff'; g.font = '700 36px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(VERSION, 256, 42);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.047), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    m.position.set(0, panels[0].height / 2 + 0.05, 0.004); m.renderOrder = 22; panels[0].group.add(m);
  }
  const rayDirection = new THREE.Vector3(),
    rayOrigin = new THREE.Vector3(),
    normal = new THREE.Vector3(),
    tmp = new THREE.Vector3(),
    viewerPosition = new THREE.Vector3();
  const factory = new XRHandModelFactory(null, configureHandOcclusion).setPath('/vendor/hands/');
  const hands = [0, 1].map(i => {
    const mesh = renderer.xr.getHand(i);
    scene.add(mesh);
    const model = factory.createHandModel(mesh, 'mesh');
    mesh.add(model);
    return {
      mesh,
      model,
      contact: null,
      lastPress: 0,
      tip: new THREE.Vector3(),
      wrist: new THREE.Vector3(),
      wristQuaternion: new THREE.Quaternion(),
      haveWrist: false,
      indexBase: new THREE.Vector3(),
      pinkyBase: new THREE.Vector3(),
      middleBase: new THREE.Vector3(),
      havePalm: false
    };
  });
  // ───────── Oficina 3D (hub de la app): se invoca desde la muñeca, se agarra y se toca ─────────
  const officeFrame = new THREE.Group(); // mover / girar
  scene.add(officeFrame);
  const office = createOffice(null, { renderer, scene, camera });
  officeFrame.add(office.root);
  officeFrame.visible = false;
  window.addEventListener('studio-event', e => {
    try {
      office.notify(e.detail.type, e.detail.data);
    } catch {}
  });
  office.watchServer();
  office.autoReports(600);
  office.watchInsights?.(120)?.then?.(f => f && setTimeout(f, 15000));
  office.setTime('auto', true);
  office.ready.then(() => {
    office.root.traverse(o => {
      if (o.isSprite && o.renderOrder !== 11) o.material.depthTest = true; // las manos tapan burbujas e iconos
    });
  });
  let officeOk = true,
    lastCtxPage = null,
    lastTvAt = -1e9;
  let demoHover = false;
  let officeScale = 0.075;
  office.root.scale.setScalar(officeScale);
  // barra de agarre (como la de los paneles): una mano mueve y gira; dos manos escalan y giran
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.2, 4, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  handle.rotation.z = Math.PI / 2;
  officeFrame.add(handle);
  const handleHit = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.04), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  officeFrame.add(handleHit);
  let placeHandle = () => {
    const r = 5.0 * officeScale;
    for (const o of [handle, handleHit]) o.position.set(r * 0.7071, 0.0, r * 0.7071);
    handle.rotation.set(0, Math.PI / 4, Math.PI / 2, 'YXZ');
    handleHit.rotation.set(0, Math.PI / 4, 0);
  };
  // botón 3D "Demo": los personajes avisan publicación, pauta, métricas, etc.
  const demoCanvas = document.createElement('canvas');
  demoCanvas.width = 512;
  demoCanvas.height = 128;
  const dg = demoCanvas.getContext('2d');
  const drawDemo = on => {
    dg.clearRect(0, 0, 512, 128);
    dg.fillStyle = on ? '#6a52ff' : '#241c4a';
    dg.beginPath();
    dg.roundRect(6, 6, 500, 116, 58);
    dg.fill();
    dg.strokeStyle = on ? '#fff' : '#ffd1a0';
    dg.lineWidth = 6;
    dg.stroke();
    dg.fillStyle = '#fff4e2';
    dg.font = 'bold 50px sans-serif';
    dg.textAlign = 'center';
    dg.textBaseline = 'middle';
    dg.fillText(on ? 'Demo en curso…' : '▶  Demo de avisos', 256, 68);
  };
  drawDemo(false);
  const demoTex = new THREE.CanvasTexture(demoCanvas);
  demoTex.colorSpace = THREE.SRGBColorSpace;
  const demoBtn = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), new THREE.MeshBasicMaterial({ map: demoTex, transparent: true, side: THREE.DoubleSide }));
  // (botón «Demo de avisos» retirado: ya no se usa; no se añade a la escena ni a los objetivos)
  let demoUntil = 0;
  function runDemo() {
    if (performance.now() < demoUntil) return;
    const n = office.demo();
    demoUntil = performance.now() + n * 4200 + 1500;
    drawDemo(true);
    demoTex.needsUpdate = true;
    notice('Demo: los personajes avisan foto, idea, imágenes, video, revisión, pauta, publicación y métricas.');
    setTimeout(() => {
      drawDemo(false);
      demoTex.needsUpdate = true;
    }, n * 4200 + 1500);
  }
  const placeHandle0 = placeHandle;
  placeHandle = () => {
    placeHandle0();
    const r = 5.0 * officeScale,
      ax = new THREE.Vector3(0.7071, 0, -0.7071).multiplyScalar(0.27);
    demoBtn.position.set(r * 0.7071 + ax.x, 0.03, r * 0.7071 + ax.z);
    demoBtn.rotation.set(-0.55, Math.PI / 4, 0, 'YXZ');
  };
  placeHandle();
  // Cuerpo invisible de la oficina: pellizcar el piso o las paredes también agarra la maqueta (prioridad más baja que las zonas y botones).
  const officeBody = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.4, 7.4), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  officeBody.position.y = 1.2;
  office.root.add(officeBody);
  const officeTargets = () => [...office.pickables, handleHit, officeBody];
  const officeRoute = { estudio: 'capture', redaccion: 'strategy', taller: 'xr', pauta: 'ads', analitica: 'results', revision: 'review', __tv: 'feed' };
  window.__office = office; office.showFrame = () => { if (!officeFrame.visible) summonOffice(); };
  office.setInfoProvider(id => {
    const d = officeInfo(id, state);
    if (d) d.images = (d.imageUrls || []).map(u => getImage(u));
    return d;
  });
  office.onPick(id => {
    const page = officeRoute[id];
    if (!page) return;
    action('nav:' + page);
    notice('Abriendo: ' + (id === '__tv' ? 'Parrilla' : office.ROOMS.find(r => r.id === id)?.name || page));
  });
  function summonOffice() {
    const cam = renderer.xr.getCamera();
    cam.getWorldPosition(tmp);
    cam.getWorldDirection(rayDirection);
    rayDirection.y = 0;
    if (rayDirection.length() < 0.1) rayDirection.set(0, 0, -1);
    rayDirection.normalize();
    const right = new THREE.Vector3().crossVectors(rayDirection, new THREE.Vector3(0, 1, 0)).normalize();
    officeScale = 0.075;
    office.root.scale.setScalar(officeScale);
    placeHandle();
    officeFrame.position.copy(tmp).addScaledVector(rayDirection, 0.85).addScaledVector(right, -0.88); // a la izquierda del panel, sin taparlo
    officeFrame.position.y = Math.max(0.35, tmp.y - 0.68);
    const dx = tmp.x - officeFrame.position.x, dz = tmp.z - officeFrame.position.z;
    officeFrame.rotation.set(0, Math.atan2(dx, dz) - Math.PI / 4, 0);
    officeFrame.visible = true;
    officeShown = true;
    drawWrist();
  }
  function toggleOffice() {
    if (officeFrame.visible) {
      officeFrame.visible = false; office.hideInfo?.();
      officeShown = false;
      drawWrist();
    } else summonOffice();
  }
  const act = id => {
    const w = wristIdx(id);
    if (w >= 0) {
      wristPress = w;
      wristPressUntil = performance.now() + 200;
    }
    return id === 'office-toggle' ? toggleOffice() : action(id);
  };
  const officeGrab = { a: null, b: null };
  let twoHand = null;
  function officeHit(d) {
    if (!officeFrame.visible) return null;
    d.c.updateWorldMatrix(true, false);
    rayOrigin.setFromMatrixPosition(d.c.matrixWorld);
    rayDirection.set(0, 0, -1).transformDirection(d.c.matrixWorld);
    raycaster.set(rayOrigin, rayDirection);
    raycaster.camera = renderer.xr.getCamera();
    const hits = raycaster.intersectObjects(officeTargets(), false);
    const h = hits.find(x => x.object !== officeBody) || hits[0];
    return h ? { ...h, id: h.object === officeBody ? '__body' : h.object === handleHit ? '__handle' : h.object === demoBtn ? '__demo' : h.object.userData.room } : null;
  }
  const poseTmp = new THREE.Vector3(),
    poseBox = new THREE.Box3();
  let lastPoke = 0;
  function pokeOffice() {
    if (!officeFrame.visible || performance.now() - lastPoke < 800) return;
    for (const h of hands) {
      if (!h.havePalm && !h.haveWrist) continue;
      poseTmp.copy(h.tip);
      if (poseTmp.lengthSq() === 0) continue;
      for (const o of [...office.pickables]) {
        o.updateWorldMatrix(true, false);
        poseBox.setFromObject(o).expandByScalar(0.008);
        if (poseBox.containsPoint(poseTmp)) {
          lastPoke = performance.now();
          if (o === demoBtn) runDemo();
          else office.triggerPick(o.userData.room);
          return;
        }
      }
    }
  }
  function updateOfficeGrab() {
    const drags = controllerData.filter(d => d.drag?.office);
    if (drags.length === 1 && !twoHand) {
      const d = drags[0];
      applyPanelGrab(officeFrame, d.c, d.drag.relative);
      officeFrame.rotation.x = 0;
      officeFrame.rotation.z = 0;
      officeFrame.updateMatrixWorld(true);
    } else if (drags.length === 2) {
      const a = drags[0].c.getWorldPosition(new THREE.Vector3()),
        b = drags[1].c.getWorldPosition(new THREE.Vector3());
      if (!twoHand) twoHand = { d0: Math.max(0.05, a.distanceTo(b)), ang0: Math.atan2(b.x - a.x, b.z - a.z), s0: officeScale, ry0: officeFrame.rotation.y, off: officeFrame.position.clone().sub(a.clone().add(b).multiplyScalar(0.5)) };
      const k = THREE.MathUtils.clamp((twoHand.s0 * a.distanceTo(b)) / twoHand.d0, 0.03, 0.3);
      officeScale = k;
      office.root.scale.setScalar(k);
      placeHandle();
      const rot = Math.atan2(b.x - a.x, b.z - a.z) - twoHand.ang0;
      officeFrame.rotation.y = twoHand.ry0 + rot;
      officeFrame.position.copy(a.add(b).multiplyScalar(0.5)).add(twoHand.off.clone().multiplyScalar(k / twoHand.s0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot));
      officeFrame.updateMatrixWorld(true);
    } else twoHand = null;
  }
  const controllerData = [];
  for (let i = 0; i < 2; i++) {
    const c = renderer.xr.getController(i);
    scene.add(c);
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: 0xc4a0f0, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false })
    );
    line.renderOrder = 40;
    line.scale.z = 1;
    line.visible = false;
    c.add(line);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.004, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd1a0, depthTest: false }));
    scene.add(dot);
    dot.visible = false;
    dot.renderOrder = 41;
    const d = { c, line, dot, source: null, drag: null, selectedAt: 0 };
    controllerData.push(d);
    c.addEventListener('connected', e => {
      d.source = e.data;
      line.visible = true;
    });
    c.addEventListener('disconnected', () => {
      d.source = null;
      d.drag = null;
      line.visible = false;
      dot.visible = false;
    });
    c.addEventListener('selectstart', () => {
      const h = intersect(d),
        oh = officeHit(d);
      if (oh && (!h || oh.distance < h.distance)) {
        if (oh.id === '__handle' || oh.id === '__body') {
          d.drag = { office: true, relative: beginPanelGrab(officeFrame, d.c) };
          twoHand = null;
        } else if (oh.id === '__demo') {
          runDemo();
        } else {
          office.triggerPick(oh.id);
          d.source?.gamepad?.hapticActuators?.[0]?.pulse(0.3, 40);
        }
        return;
      }
      if (!h && controllerData.some(o => o !== d && o.drag?.office)) {
        d.drag = { office: true, relative: beginPanelGrab(officeFrame, d.c) };
        twoHand = null;
        return;
      }
      if (!h) return;
      const ui = h.ui || uiAt(h.panel.name, h.x, h.y);
      if (!ui) return;
      if (ui.disabled) return;
      if (ui.drag) {
        d.drag = {
          panel: h.panel,
          relative: h.panel.name === 'camera' ? beginPanelGrab(h.panel.group, d.c) : null,
          distance: Math.max(0.45, Math.min(1.3, h.distance)),
          offset: h.panel.group.position.clone().sub(h.point)
        };
        return;
      }
      // Direct contact already activated this finger: don't fire a second pinch action.
      if (performance.now() - Math.max(...hands.map(h => h.lastPress)) < 600) return;
      d.selectedAt = performance.now();
      act(ui.id);
      d.source?.gamepad?.hapticActuators?.[0]?.pulse(0.25, 35);
    });
    c.addEventListener('selectend', () => {
      d.drag = null;
      twoHand = null;
      for (const o of controllerData) if (o.drag?.office) o.drag.relative = beginPanelGrab(officeFrame, o.c);
    });
  }
  function intersect(d) {
    d.c.updateWorldMatrix(true, false);
    rayOrigin.setFromMatrixPosition(d.c.matrixWorld);
    rayDirection.set(0, 0, -1).transformDirection(d.c.matrixWorld);
    raycaster.set(rayOrigin, rayDirection);
    const hit = raycaster.intersectObjects(panelPlanes, false).find(hit => {
      const p = panels.find(p => p.plane === hit.object || p.handleHit === hit.object);
      return (
        p.group.visible &&
        !(p.name === 'wrist' && d.source?.handedness === 'left') &&
        (!state.hudVisible || p.name === 'camera' || p.name === 'wrist' || p.handleHit === hit.object)
      );
    });
    if (!hit) return null;
    const panel = panels.find(p => p.plane === hit.object || p.handleHit === hit.object);
    return {
      ...hit,
      panel,
      x: hit.uv.x * panel.canvas.width,
      y: (1 - hit.uv.y) * panel.canvas.height,
      ui: panel.handleHit === hit.object ? { id: 'drag', label: 'Mover desde la barra inferior', drag: true } : null
    };
  }
  function recenter() {
    const xrCamera = renderer.xr.getCamera();
    xrCamera.getWorldPosition(tmp);
    xrCamera.getWorldDirection(rayDirection);
    rayDirection.y = 0;
    if (rayDirection.length() < 0.1) rayDirection.set(0, 0, -1);
    rayDirection.normalize();
    const right = new THREE.Vector3().crossVectors(rayDirection, new THREE.Vector3(0, 1, 0)).normalize();
    panels[0].group.position
      .copy(tmp)
      .addScaledVector(rayDirection, 0.72)
      .add(new THREE.Vector3(0, -0.15, 0));
    panels[1].group.position
      .copy(tmp)
      .addScaledVector(rayDirection, 0.88)
      .addScaledVector(right, 0.66)
      .add(new THREE.Vector3(0, -0.12, 0));
    for (const p of panels) {
      if (p.name === 'main' || p.name === 'preview') p.group.lookAt(tmp);
      p.group.updateMatrixWorld(true);
    }
  }
  window.addEventListener('xr-recenter', () => {
    if (session) recenterNext = true;
  });
  window.addEventListener('xr-camera-recenter', () => {
    hudWasVisible = false;
  });
  window.addEventListener('xr-exit', () => {
    session?.end();
  });
  const posePoint = new THREE.Vector3();
  function updateHands(frame) {
    for (const h of hands) {
      h.haveWrist = false;
      h.havePalm = false;
    }
    let n = 0;
    const referenceSpace = renderer.xr.getReferenceSpace();
    for (const source of session.inputSources) {
      if (!source.hand) continue;
      const index = source.handedness === 'left' ? 0 : 1,
        h = hands[index];
      n++;
      let tip = null,
        palmCount = 0;
      for (const name of ['wrist', 'index-finger-tip', 'index-finger-metacarpal', 'middle-finger-metacarpal', 'pinky-finger-metacarpal']) {
        const joint = source.hand.get(name),
          pose = joint ? frame.getJointPose(joint, referenceSpace) : null;
        if (!pose) continue;
        const pos = pose.transform.position;
        if (name === 'wrist') {
          h.wrist.set(pos.x, pos.y, pos.z);
          h.wristQuaternion.copy(pose.transform.orientation);
          h.haveWrist = true;
        } else if (name === 'index-finger-tip') tip = h.tip.set(pos.x, pos.y, pos.z);
        else {
          const dest = name.startsWith('index') ? h.indexBase : name.startsWith('middle') ? h.middleBase : h.pinkyBase;
          dest.set(pos.x, pos.y, pos.z);
          palmCount++;
        }
      }
      h.havePalm = palmCount === 3;
      let touched = false;
      if (tip) {
        for (const p of panels) {
          if (
            !p.group.visible ||
            (p.name === 'wrist' && source.handedness === 'left') ||
            (state.hudVisible && p.name !== 'camera' && p.name !== 'wrist')
          )
            continue;
          p.group.updateWorldMatrix(true, false);
          posePoint.copy(tip);
          p.plane.worldToLocal(posePoint);
          const x = (posePoint.x / p.width + 0.5) * p.canvas.width,
            y = (0.5 - posePoint.y / p.height) * p.canvas.height;
          const ui = uiAt(p.name, x, y);
          if (Math.abs(posePoint.z) < 0.055 && ui) {
            setHover(ui.id);
            if (p.name === 'wrist') wristHover = wristIdx(ui.id);
            if (Math.abs(posePoint.z) < 0.018 && !ui.drag && !ui.disabled) {
              touched = true;
              if (!h.contact && performance.now() - h.lastPress > 550) {
                h.contact = ui.id;
                h.lastPress = performance.now();
                act(ui.id);
              }
            } else if (h.contact && Math.abs(posePoint.z) < 0.045) touched = true;
          }
        }
      }
      if (!touched) h.contact = null;
    }
    return n;
  }
  function updateCameraHud() {
    wristPanel.group.visible = hands[0].haveWrist;
    if (wristPanel.group.visible) placeWristPanel(wristPanel.group, hands[0], viewerPosition, 0.035, 0.0);
    hudPanel.group.visible = state.hudVisible;
    if (!state.hudVisible) {
      hudWasVisible = false;
      return;
    }
    if (!hudWasVisible) {
      renderer.xr.getCamera().getWorldDirection(hudDelta);
      placeCameraPanel(hudPanel.group, viewerPosition, hudDelta);
    }
    hudPanel.group.updateMatrixWorld(true);
    hudWasVisible = true;
  }
  // Marco guía de grabación pegado a la cabeza: muestra aproximadamente qué parte de lo que ves queda en el video (sin mostrar el video).
  const recGuide = (() => {
    const c = document.createElement('canvas'); c.width = 768; c.height = 432;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.54), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    mesh.renderOrder = 60; mesh.visible = false; mesh.frustumCulled = false; scene.add(mesh);
    return { c, tex, mesh, sec: -1, q: new THREE.Quaternion(), p: new THREE.Vector3(), f: new THREE.Vector3(), up: new THREE.Vector3(), orient: '' };
  })();
  function updateRecGuide() {
    const R = state.rec, on = !!(R && R.on && session);
    recGuide.mesh.visible = on;
    if (!on) { recGuide.sec = -1; return; }
    const cam = renderer.xr.getCamera();
    cam.getWorldPosition(recGuide.p); cam.getWorldQuaternion(recGuide.q);
    recGuide.f.set(0, 0, -1).applyQuaternion(recGuide.q);
    recGuide.up.set(0, 1, 0).applyQuaternion(recGuide.q);
    // Bajado ~0.2 m: la cámara del casco apunta más abajo que la mirada.
    recGuide.mesh.position.copy(recGuide.p).addScaledVector(recGuide.f, 1.0).addScaledVector(recGuide.up, -0.2);
    recGuide.mesh.quaternion.copy(recGuide.q);
    const sec = Math.floor((Date.now() - R.t0) / 1000);
    if (sec !== recGuide.sec || recGuide.orient !== R.orient) {
      recGuide.sec = sec;
      recGuide.orient = R.orient;
      const g = recGuide.c.getContext('2d'), W = 768, H = 432;
      g.clearRect(0, 0, W, H);
      g.strokeStyle = '#ff4d5e'; g.lineWidth = 8; g.lineCap = 'round';
      const vx = R.orient === 'vertical' ? (W - (H * 9) / 16) / 2 : 0, x0 = vx + 16, x1 = W - vx - 16; // vertical: recorte central 9:16
      if (vx) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, vx, H); g.fillRect(W - vx, 0, vx, H); }
      [[x0, 16, 1, 1], [x1, 16, -1, 1], [x0, H - 16, 1, -1], [x1, H - 16, -1, -1]].forEach(([x, y, dx, dy]) => { g.beginPath(); g.moveTo(x, y + 90 * dy); g.lineTo(x, y); g.lineTo(x + 90 * dx, y); g.stroke(); });
      g.fillStyle = 'rgba(16,12,28,.8)'; g.beginPath(); g.roundRect(x0 + 24, 30, 230, 62, 31); g.fill();
      g.fillStyle = sec % 2 ? '#ff4d5e' : '#8a2a35'; g.beginPath(); g.arc(x0 + 62, 61, 15, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.font = '800 34px sans-serif'; g.textBaseline = 'middle'; g.fillText('REC ' + String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'), x0 + 90, 63);
      recGuide.tex.needsUpdate = true;
    }
  }
  let lastPanelDraw = 0,
    statsTime = 0,
    statsFrames = 0;
  // Sin culling por ojo: el frustum combinado de WebXR puede descartar objetos que un solo ojo sí ve (parpadeo en el ojo izquierdo).
  let lastNoCull = -1e9;
  const noCull = () => scene.traverse(o => { if (o.frustumCulled) o.frustumCulled = false; });
  // Telemetría ligera hacia el servidor (data/xr-perf.log) para diagnosticar fallos reales en el visor.
  const perf = { last: 0, n: 0, sum: 0, worst: 0, slow: 0, sentAt: 0 };
  const perfFrame = time => {
    if (perf.last) {
      const d = time - perf.last;
      perf.n++; perf.sum += d; if (d > perf.worst) perf.worst = d; if (d > 25) perf.slow++;
      if (d > 150 && time - (perf.stallAt || 0) > 1000) { perf.stallAt = time; xrlog('stall', Math.round(d) + 'ms page=' + state.page); }
    }
    perf.last = time;
    if (time - perf.sentAt < 5000) return;
    perf.sentAt = time;
    const i = renderer.info;
    const row = {
      t: new Date().toISOString(), page: state.page, fps: perf.n ? Math.round(1000 / (perf.sum / perf.n)) : 0, avgMs: perf.n ? +(perf.sum / perf.n).toFixed(1) : 0,
      worstMs: Math.round(perf.worst), slow: perf.slow, frames: perf.n, tex: i.memory.textures, geo: i.memory.geometries, calls: i.render.calls, tris: i.render.triangles,
      heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, hud: !!state.hudVisible, office: officeFrame.visible, hands: hands.filter(h => h.havePalm || h.haveWrist).length,
      min: Math.round(time / 60000)
    };
    perf.n = perf.sum = perf.worst = perf.slow = 0;
    fetch('/api/xr-stats' + location.search, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row), keepalive: true }).catch(() => {});
  };
  const tick = (time, frame) => {
    if (!session || !frame) return;
    perfFrame(time);
    if (time - lastNoCull > 2000) { lastNoCull = time; noCull(); }
    if (recenterNext) {
      recenter();
      recenterNext = false;
    }
    if (summonNext && frameNumber > 1) {
      summonOffice();
      summonNext = false;
    }
    renderer.xr.getCamera().getWorldPosition(viewerPosition);
    hudPanel.group.visible = state.hudVisible;
    for (const p of panels) {
      p.plane.material.opacity = state.hudVisible && p.name !== 'camera' && p.name !== 'wrist' ? 0.28 : 1;
      if (p.name === 'main' || p.name === 'preview') p.group.lookAt(viewerPosition);
      p.group.updateMatrixWorld(true);
    }
    companion.update(time);
    setHover(null);
    wristHover = -1;
    demoHover = false;
    if (officeOk && officeFrame.visible)
      try {
        if (state.page !== lastCtxPage) { lastCtxPage = state.page; office.setContext(state.page); }
        if (time - lastTvAt > 800) {
          lastTvAt = time;
          const urls = ['front', 'right', 'left', 'back'].map(k => state.photos?.[k]?.url).filter(Boolean);
          office.setTVData({
            photos: urls,
            gallery: (state.feed || []).filter(f => f.thumb).map(f => ({ thumb: f.thumb, format: f.format, caption: f.caption })),
            status: state.publishReceipt ? 'Publicado ✓ · pauta en PAUSA' : urls.length < 4 ? `Toma las 4 fotos · ${urls.length}/4` : 'Fotos listas · sigue con la campaña'
          });
        }
        office.update(time);
      } catch (e) {
        officeOk = false;
        notice('Oficina 3D desactivada: ' + e.message);
        console.error(e);
      }
    for (const d of controllerData) {
      if (!d.source) continue;
      let hit = intersect(d);
      let oh = null;
      try {
        oh = officeOk ? officeHit(d) : null;
      } catch (e) {
        officeOk = false;
        console.error(e);
      }
      office.setHover(null);
      if (oh && (!hit || oh.distance < hit.distance)) {
        d.dot.visible = true;
        d.dot.position.copy(oh.point);
        d.line.scale.z = oh.distance;
        if (oh.id !== '__handle' && oh.id !== '__demo') office.setHover(oh.id);
        demoHover = oh.id === '__demo';
        hit = null;
      } else {
      d.dot.visible = !!hit;
      if (hit) {
        d.dot.position.copy(hit.point);
        d.line.scale.z = hit.distance;
        const ui = hit.ui || uiAt(hit.panel.name, hit.x, hit.y);
        if (ui) {
          setHover(ui.id);
          if (hit.panel.name === 'wrist') wristHover = wristIdx(ui.id);
        }
      } else d.line.scale.z = 0.7;
      }
      if (d.drag?.office) {
        /* lo mueve updateOfficeGrab */
      } else if (d.drag?.relative) {
        applyPanelGrab(d.drag.panel.group, d.c, d.drag.relative);
      } else if (d.drag) {
        rayOrigin.setFromMatrixPosition(d.c.matrixWorld);
        rayDirection.set(0, 0, -1).transformDirection(d.c.matrixWorld);
        d.drag.panel.group.position.copy(rayOrigin).addScaledVector(rayDirection, d.drag.distance).add(d.drag.offset);
        d.drag.panel.group.lookAt(viewerPosition);
        d.drag.panel.group.updateMatrixWorld(true);
      }
    }
    demoBtn.scale.setScalar(demoHover ? 1.12 : 1);
    try {
      if (officeOk) updateOfficeGrab();
    } catch (e) {
      officeOk = false;
      console.error(e);
    }
    const count = updateHands(frame);
    // Una mano sin rastreo no debe dejar su malla de oclusión (escribe profundidad) delante del panel: provocaba que desapareciera por instantes.
    hands.forEach(h => (h.mesh.visible = h.havePalm || h.haveWrist));
    try {
      if (officeOk) pokeOffice();
    } catch (e) {
      officeOk = false;
      console.error(e);
    }
    updateCameraHud();
    if (performance.now() > wristPressUntil) wristPress = -1;
    wristBtns.update(time, { hover: wristHover, press: wristPress, camActive: state.hudVisible, officeActive: officeFrame.visible });
    if (frameNumber++ % 30 === 0)
      status.textContent = (count ? `${count} mano(s) rastreada(s)` : 'Usa manos o mandos · pinza para seleccionar') + (buildTag ? ' · ' + buildTag : '');
    // Los paneles se redibujan a 30 fps solo con la cámara abierta; con la cámara cerrada bastan 15 fps y solo se suben las texturas visibles.
    // Redibujar los paneles 2D (canvas) cuesta 20-50 ms y subir sus texturas pesa varios MB: hacerlo cada 66 ms
    // provocaba un cuadro lento cada ~4 (≈30% de cuadros caídos, medido en el visor). Ahora solo se redibuja
    // rápido mientras hay interacción reciente; en reposo, 2 veces por segundo.
    const sinceTouch = time - (state.uiTouch || 0),
      every = state.rec?.on ? 1000 : state.hudVisible ? 50 : (state.videoWatch && state.page === 'video') || (state.page === 'feed' && state.feedOpen) ? 90 : sinceTouch < 700 ? 66 : state.busy || state.captureBusy ? 160 : 1200;
    if (time - lastPanelDraw >= every) {
      let drawOk = true;
      try {
        draw();
      } catch (e) {
        drawOk = false; // no subir un lienzo a medio dibujar (parpadeo): se conserva el último cuadro bueno
        xrlog('js-error', 'draw: ' + String(e && e.message).slice(0, 120));
      }
      if (drawOk) panels.forEach(p => {
        if (p.texture && p.group.visible && (p.name !== 'camera' || state.hudVisible)) p.texture.needsUpdate = true;
      });
      lastPanelDraw = time;
    }
    updateRecGuide();
    glass3d.update(time);
    renderer.render(scene, camera);
    statsFrames++;
    if (time - statsTime >= 1000) {
      state.xrStats = {
        fps: Math.round((statsFrames * 1000) / (time - statsTime)),
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles
      };
      statsFrames = 0;
      statsTime = time;
    }
  };
  renderer.setAnimationLoop(tick);
  if (new URLSearchParams(location.search).has('xrdebug'))
    window.__xrDebug = { wristBtns, recenter, tick: (t, joints) => {
        const sources = Object.entries(joints || {}).map(([side, j]) => ({ handedness: side, hand: { get: n => (j[n] ? n + '@' + side : null) } }));
        session = { inputSources: sources };
        const fake = { getJointPose: name => { const side = String(name).split('@')[1], key = String(name).split('@')[0], p = joints?.[side]?.[key]; return p ? { transform: { position: { x: p[0], y: p[1], z: p[2] }, orientation: { x: 0, y: 0, z: 0, w: 1 } } } : null; } };
        tick(t, fake);
      },
      hands, wristPanel, setOfficeHold: () => {}, summonOffice, officeFrame, controllerData, officeHit, office, panels, scene, renderer, camera };
  window.addEventListener(
    'pagehide',
    () => {
      companion.dispose();
      textures.forEach(t => t.dispose());
      for (const p of panels) {
        p.plane.geometry.dispose();
        p.plane.material.dispose();
        for (const part of [p.handle, p.handleHit]) {
          part?.geometry.dispose();
          part?.material.dispose();
        }
      }
      for (const h of hands)
        h.model.traverse(o => {
          o.geometry?.dispose();
          if (o.material) {
            for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
              for (const value of Object.values(m)) if (value?.isTexture) value.dispose();
              m.dispose();
            }
          }
        });
      for (const d of controllerData) {
        d.line.geometry.dispose();
        d.line.material.dispose();
        d.dot.geometry.dispose();
        d.dot.material.dispose();
      }
      renderer.dispose();
    },
    { once: true }
  );
  // Visor virtual (?vr=virtual): clic del mouse = rayo desde el ojo izquierdo hacia los paneles.
  if (window.__xrmock) {
    const cv = document.querySelector('#xrCanvas');
    document.addEventListener('pointerdown', e => {
      if (!session || e.target.closest?.('button')) return;
      const r = cv.getBoundingClientRect(),
        half = r.width / 2,
        ex = (e.clientX - r.left) % half;
      const cam = renderer.xr.getCamera().cameras?.[0] || renderer.xr.getCamera();
      raycaster.setFromCamera(new THREE.Vector2((ex / half) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)), cam);
      const hit = raycaster.intersectObjects(panelPlanes, false).find(h => {
        const p = panels.find(p => p.plane === h.object || p.handleHit === h.object);
        return p.group.visible && p.name !== 'wrist' && p.plane === h.object && (!state.hudVisible || p.name === 'camera');
      });
      if (!hit) return;
      const panel = panels.find(p => p.plane === hit.object),
        ui = hitAt(panel.name, hit.uv.x * panel.canvas.width, (1 - hit.uv.y) * panel.canvas.height);
      if (ui && !ui.disabled && ui.id !== 'drag') action(ui.id);
    });
  }
  button.onclick = async () => {
    try {
      if (session) {
        await session.end();
        return;
      }
      // Permiso de cámara ANTES de entrar (dentro de las gafas el aviso no puede mostrarse). Primer toque: pide el permiso; segundo: entra.
      if (!button.dataset.camAsked) {
        let st = 'unknown';
        try { st = (await navigator.permissions.query({ name: 'camera' })).state; } catch {}
        if (st !== 'granted') {
          button.dataset.camAsked = '1';
          button.disabled = true;
          notice('Acepta el permiso de la cámara en la ventana que aparece…');
          try { await ensureCamera(); notice('Cámara lista. Toca «Entrar» otra vez.'); xrlog('camera-ok', 'pre-permiso'); }
          catch (e) { notice('La cámara no tiene permiso: ' + e.message + ' · Ajustes del navegador → Permisos del sitio → Cámara. Toca otra vez para entrar igual.'); }
          button.disabled = false;
          return;
        }
      }
      ensureCamera().catch(e => notice('Cámara pendiente: ' + e.message));
      session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['hand-tracking']
      });
      await renderer.xr.setSession(session);
      document.body.classList.add('xr-active');
      kit3d.enabled = true;
      recenterNext = true;
      summonNext = true;
      hudWasVisible = false;
      button.textContent = 'Salir de realidad mixta';
      notice('AR activa (' + (buildTag || 'versión ?') + '). Luma te acompaña. Muñeca izquierda: 📷 cámara y 🏢 oficina.');
      xrlog('xr-start', (session.environmentBlendMode || '?') + ' rates=' + (session.supportedFrameRates ? [...session.supportedFrameRates].join('/') : '?'));
      session.addEventListener('visibilitychange', () => xrlog('xr-vis', session?.visibilityState));
      session.addEventListener('end', () => {
        xrlog('xr-end');
        session = null;
        action('hud-close');
        hudWasVisible = false;
        hudPanel.group.visible = false;
        wristPanel.group.visible = false;
        officeFrame.visible = false;
        officeShown = false;
        drawWrist();
        document.body.classList.remove('xr-active');
        kit3d.enabled = false;
        button.textContent = 'Entrar en realidad mixta ↗';
        hands.forEach(h => (h.mesh.visible = false));
        controllerData.forEach(d => (d.drag = null));
        notice('Saliste de AR. Tu campaña sigue disponible.');
      });
    } catch (e) {
      session = null;
      document.body.classList.remove('xr-active');
      notice('No se pudo iniciar AR: ' + e.message);
    }
  };
}
