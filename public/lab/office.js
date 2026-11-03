// Oficina de marketing en miniatura: una sala por área, un agente por sala. Todo con primitivas (sin assets).
import * as THREE from '../vendor/three.module.js';

export const ROOMS = [
  { id: 'estudio', name: 'Estudio de fotos', agent: 'Fotógrafa', color: 0xffc78c, say: ['Cuadrando el marco…', 'Midiendo la luz…', 'Revisando nitidez…'] },
  { id: 'redaccion', name: 'Redacción', agent: 'Copywriter', color: 0xff8fb8, say: ['Escribiendo el gancho…', 'Probando titulares…', 'Puliendo el CTA…'] },
  { id: 'taller', name: 'Taller de anuncios', agent: 'Diseñador XR', color: 0xa392ff, say: ['Montando el prisma…', 'Ajustando la luz…', 'Probando el portal…'] },
  { id: 'pauta', name: 'Sala de pauta', agent: 'Media buyer + Guardián', color: 0x7fe9bf, say: ['Armando el borrador…', 'Verificando PAUSED…', 'Calculando alcance…'] },
  { id: 'analitica', name: 'Analítica', agent: 'Analista', color: 0x8fd0ff, say: ['Leyendo métricas…', 'Buscando patrones…', 'Vigilando el gasto…'] },
  { id: 'revision', name: 'Sala de revisión', agent: 'Revisor', color: 0xffd27a, say: ['Revisando copy…', 'Comprobando zonas seguras…', 'Puntuando la campaña…'] }
];
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.05, ...o });
const box = (w, h, d, c, o) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(c, o));

function bubbleTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 112;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(14,11,24,.9)';
  g.beginPath();
  g.roundRect(4, 4, 504, 90, 30);
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = '#f6f3fd';
  g.font = '600 34px Inter,system-ui,sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function labelTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#f6f3fd';
  g.font = '800 46px "Inter Display",Inter,system-ui,sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeAgent(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 24), std(0x8f7dff, { roughness: 0.35 }));
  body.position.y = 0.34;
  const visor = box(0.3, 0.15, 0.1, 0x0d0a18, { roughness: 0.2 });
  visor.position.set(0, 0.36, 0.17);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x7fe9bf });
  const eyes = [-1, 1].map(s => {
    const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.03, 4, 8), eyeM);
    e.position.set(s * 0.06, 0.36, 0.225);
    return e;
  });
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.018, 8, 32), new THREE.MeshBasicMaterial({ color }));
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.22;
  const arms = [-1, 1].map(s => {
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.1, 4, 8), std(0xb7a8ff));
    a.position.set(s * 0.22, 0.28, 0.06);
    return a;
  });
  const feet = [-1, 1].map(s => {
    const f = box(0.08, 0.04, 0.12, 0x2b2540);
    f.position.set(s * 0.08, 0.02, 0.02);
    return f;
  });
  g.add(body, visor, ...eyes, band, ...arms, ...feet);
  g.userData = { body, eyes, arms, visor };
  return g;
}

export function createOffice(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120e22);
  scene.fog = new THREE.Fog(0x120e22, 12, 22);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  scene.add(new THREE.HemisphereLight(0xe2dbff, 0x3a2f5c, 1.9));
  const sun = new THREE.DirectionalLight(0xffe2c4, 1.7);
  sun.position.set(4, 8, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 6, bottom: -6 });
  scene.add(sun);
  const base = box(8.4, 0.2, 5.4, 0x14101f);
  base.position.y = -0.12;
  base.receiveShadow = true;
  scene.add(base);

  const rooms = {};
  const pickables = [];
  const W = 2.6,
    D = 2.4;
  ROOMS.forEach((r, i) => {
    const col = i % 3,
      row = Math.floor(i / 3);
    const g = new THREE.Group();
    g.position.set((col - 1) * (W + 0.1), 0, (row - 0.5) * (D + 0.1));
    const floor = box(W, 0.08, D, new THREE.Color(0x3a2f5e).lerp(new THREE.Color(r.color), 0.16));
    floor.receiveShadow = true;
    floor.userData.room = r.id;
    g.add(floor);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, D), new THREE.MeshBasicMaterial({ color: r.color, transparent: true, opacity: 0.0 }));
    rim.position.y = 0.05;
    g.add(rim);
    const wallBack = box(W, 0.55, 0.06, 0x403470);
    wallBack.position.set(0, 0.275, -D / 2 + 0.03);
    const wallSide = box(0.06, 0.55, D, 0x372d62);
    wallSide.position.set(-W / 2 + 0.03, 0.275, 0);
    const stripe = box(W, 0.05, 0.07, r.color, { emissive: r.color, emissiveIntensity: 0.4 });
    stripe.position.set(0, 0.57, -D / 2 + 0.03);
    [wallBack, wallSide, stripe].forEach(m => (m.castShadow = true));
    g.add(wallBack, wallSide, stripe);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.28), new THREE.MeshBasicMaterial({ map: labelTexture(r.name), transparent: true }));
    sign.position.set(0, 0.86, -D / 2 + 0.07);
    g.add(sign);
    const agent = makeAgent(r.color);
    agent.position.set(0.1, 0.04, 0.15);
    g.add(agent);
    const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTexture('Zzz… toca para activar', '#6f6785'), transparent: true, depthTest: false }));
    bubble.scale.set(1.2, 0.26, 1);
    bubble.position.set(0.1, 0.88, 0.15);
    g.add(bubble);
    const furn = new THREE.Group();
    g.add(furn);
    rooms[r.id] = { def: r, group: g, agent, bubble, furn, floor, rim, active: false, sayIdx: 0, sayT: 0, update: null };
    g.traverse(o => o.isMesh && (o.userData.room = r.id));
    pickables.push(g);
    scene.add(g);
  });

  // —— mobiliario por sala ——
  const F = id => rooms[id].furn;
  { // estudio: trípode + panel de luz + fondo
    const f = F('estudio');
    const back = box(1.1, 0.7, 0.04, 0xece6f7);
    back.position.set(0.5, 0.45, -0.8);
    const tri = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 3), std(0x2b2540));
    tri.position.set(-0.7, 0.34, 0.3);
    const cam = box(0.2, 0.14, 0.14, 0x15121f);
    cam.position.set(-0.7, 0.72, 0.3);
    const lamp = box(0.5, 0.35, 0.04, 0xfff1d6, { emissive: 0xffe0a8, emissiveIntensity: 0.9 });
    lamp.position.set(0.95, 0.5, 0.35);
    lamp.rotation.y = -0.6;
    const prod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 20), std(0x3b2a4f));
    prod.position.set(0.5, 0.17, -0.55);
    f.add(back, tri, cam, lamp, prod);
    rooms.estudio.flash = lamp;
  }
  { // redacción: escritorio + laptop
    const f = F('redaccion');
    const desk = box(1.2, 0.08, 0.6, 0x4a3b6b);
    desk.position.set(-0.1, 0.34, -0.5);
    const legs = [[-0.6, -0.25], [0.4, -0.25], [-0.6, -0.75], [0.4, -0.75]].map(([x, z]) => {
      const l = box(0.05, 0.3, 0.05, 0x2b2540);
      l.position.set(x, 0.15, z + 0);
      return l;
    });
    const lap = box(0.36, 0.02, 0.26, 0x1a1626);
    lap.position.set(-0.1, 0.4, -0.5);
    const scr = box(0.36, 0.24, 0.02, 0x15121f, { emissive: 0xff8fb8, emissiveIntensity: 0.35 });
    scr.position.set(-0.1, 0.52, -0.64);
    scr.rotation.x = -0.2;
    const paper = box(0.2, 0.01, 0.28, 0xf6f3fd);
    paper.position.set(0.3, 0.39, -0.45);
    f.add(desk, ...legs, lap, scr, paper);
    rooms.redaccion.screen = scr;
  }
  { // taller: pedestal con prisma
    const f = F('taller');
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.2, 32), std(0x2b2540, { metalness: 0.5 }));
    ped.position.set(0.55, 0.14, -0.25);
    const prism = box(0.3, 0.42, 0.3, 0xa392ff, { emissive: 0x6a5cd6, emissiveIntensity: 0.25 });
    prism.position.set(0.55, 0.45, -0.25);
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.012, 8, 48), new THREE.MeshBasicMaterial({ color: 0xff8fb8 }));
    ringM.rotation.x = Math.PI / 2;
    ringM.position.set(0.55, 0.26, -0.25);
    f.add(ped, prism, ringM);
    rooms.taller.spin = prism;
  }
  { // pauta: escudo + barras
    const f = F('pauta');
    const shield = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), std(0x7fe9bf, { emissive: 0x2fae86, emissiveIntensity: 0.4 }));
    shield.position.set(0.6, 0.55, -0.4);
    const bars = [0.2, 0.35, 0.28].map((h, i) => {
      const b = box(0.1, h, 0.1, 0x7fe9bf);
      b.position.set(-0.8 + i * 0.16, 0.08 + h / 2, -0.7);
      return b;
    });
    const desk = box(0.9, 0.06, 0.45, 0x4a3b6b);
    desk.position.set(-0.2, 0.3, -0.1);
    f.add(shield, desk, ...bars);
    rooms.pauta.spin = shield;
  }
  { // analítica: pantalla con gráfico animado
    const f = F('analitica');
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshBasicMaterial({ map: tex }));
    scr.position.set(0.2, 0.62, -0.9);
    const frame = box(1.56, 0.81, 0.03, 0x15121f);
    frame.position.set(0.2, 0.62, -0.93);
    const desk = box(1, 0.06, 0.4, 0x4a3b6b);
    desk.position.set(0.2, 0.3, -0.3);
    f.add(frame, scr, desk);
    rooms.analitica.chart = { c, tex };
    rooms.analitica.update = t => {
      const g = c.getContext('2d');
      g.fillStyle = '#0d0a18';
      g.fillRect(0, 0, 512, 256);
      g.strokeStyle = '#8fd0ff';
      g.lineWidth = 5;
      g.beginPath();
      for (let x = 0; x <= 512; x += 8) {
        const y = 150 - 50 * Math.sin(x / 70 + t) - 20 * Math.sin(x / 23 - t * 2) - x * 0.06;
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
      g.fillStyle = '#7fe9bf';
      g.font = '700 28px Inter';
      g.fillText('EJEMPLO', 16, 40);
      tex.needsUpdate = true;
    };
  }
  { // revisión: lupa + check
    const f = F('revision');
    const desk = box(1, 0.06, 0.5, 0x4a3b6b);
    desk.position.set(0, 0.3, -0.4);
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 12, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
    ringM.position.set(0.3, 0.62, -0.4);
    const handle = box(0.03, 0.2, 0.03, 0xffd27a);
    handle.position.set(0.3, 0.4, -0.4);
    handle.rotation.z = 0.6;
    f.add(desk, ringM, handle);
    rooms.revision.spin = ringM;
  }

  // —— cámara orbital ——
  const view = { yaw: 0.2, pitch: 0.95, dist: 9.5, target: new THREE.Vector3(0, 0, 0), goal: null, yawG: null, distG: null };
  const placeCam = () => {
    const d = view.dist;
    camera.position.set(view.target.x + Math.sin(view.yaw) * Math.cos(view.pitch) * d, view.target.y + Math.sin(view.pitch) * d, view.target.z + Math.cos(view.yaw) * Math.cos(view.pitch) * d);
    camera.lookAt(view.target);
  };
  const ray = new THREE.Raycaster(),
    ptr = new THREE.Vector2();
  let down = null,
    onPick = () => {};
  canvas.addEventListener('pointerdown', e => {
    down = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - down.x,
      dy = e.clientY - down.y;
    if (Math.hypot(dx, dy) > 5) down.moved = true;
    if (down.moved) {
      view.yaw = down.yaw - dx * 0.006;
      view.pitch = Math.max(0.25, Math.min(1.35, down.pitch + dy * 0.005));
      view.goal = null;
    }
  });
  canvas.addEventListener('pointerup', e => {
    if (down && !down.moved) {
      const r = canvas.getBoundingClientRect();
      ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ptr, camera);
      const hit = ray.intersectObjects(pickables, true).find(h => h.object.userData.room);
      if (hit) onPick(hit.object.userData.room);
    }
    down = null;
  });
  canvas.addEventListener('wheel', e => ((view.dist = Math.max(3, Math.min(16, view.dist + e.deltaY * 0.005))), (view.goal = null), e.preventDefault()), { passive: false });

  function focus(id) {
    if (!id) {
      view.goal = new THREE.Vector3(0, 0, 0);
      view.distG = 9.5;
      view.yawG = 0.2;
      return;
    }
    const p = rooms[id].group.position;
    view.goal = new THREE.Vector3(p.x + 1.3, 0.2, p.z);
    view.distG = 5.2;
    view.yawG = 0.25;
  }
  const clock = { last: 0, fps: 60, frames: 0, acc: 0 };
  function resize() {
    const w = innerWidth,
      h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();
  const names = new Map();
  function setActive(id, on) {
    const r = rooms[id];
    r.active = on;
    r.rim.material.opacity = on ? 0.35 : 0;
    r.bubble.material.map = bubbleTexture(on ? r.def.say[0] : 'Zzz… toca para activar', on ? '#' + r.def.color.toString(16).padStart(6, '0') : '#6f6785');
    r.bubble.material.needsUpdate = true;
  }
  // Luma recorre la oficina
  const luma = makeAgent(0xffffff);
  luma.scale.setScalar(1.15);
  luma.visible = false;
  scene.add(luma);
  const lumaState = { t: 0, from: 0, to: 1 };
  function frame(t) {
    const time = t / 1000,
      dt = Math.min(0.05, time - clock.last || 0.016);
    clock.last = time;
    clock.acc += dt;
    clock.frames++;
    if (clock.acc > 0.5) {
      clock.fps = Math.round(clock.frames / clock.acc);
      clock.frames = 0;
      clock.acc = 0;
    }
    for (const r of Object.values(rooms)) {
      const a = r.agent.userData;
      const k = r.active ? 1 : 0;
      const bob = r.active ? Math.abs(Math.sin(time * 6 + r.def.color)) * 0.04 : Math.sin(time * 1.4 + r.def.color) * 0.01;
      r.agent.position.y = 0.04 + bob;
      a.arms.forEach((arm, i) => (arm.rotation.x = r.active ? Math.sin(time * 12 + i * 2) * 0.9 : 0));
      a.eyes.forEach(e => (e.scale.y = r.active || Math.sin(time * 0.8 + r.def.color) < 0.97 ? 1 : 0.15));
      r.agent.rotation.y = r.active ? Math.sin(time * 2) * 0.1 : -0.3;
      r.bubble.visible = true;
      if (r.active) {
        r.sayT += dt;
        if (r.sayT > 2.4) {
          r.sayT = 0;
          r.sayIdx = (r.sayIdx + 1) % r.def.say.length;
          r.bubble.material.map = bubbleTexture(r.def.say[r.sayIdx], '#' + r.def.color.toString(16).padStart(6, '0'));
        }
      }
      if (r.spin) r.spin.rotation.y += dt * (r.active ? 2.2 : 0.4);
      if (r.screen) r.screen.material.emissiveIntensity = r.active ? 0.6 + 0.3 * Math.sin(time * 9) : 0.2;
      if (r.flash) r.flash.material.emissiveIntensity = r.active ? 0.9 + 1.4 * Math.max(0, Math.sin(time * 3.5)) ** 8 : 0.5;
      if (r.update) r.update(r.active ? time * 2 : time * 0.3);
      r.group.position.y = r.active ? 0.04 + Math.sin(time * 3) * 0.01 : 0;
    }
    // Luma pasea entre salas activas
    const act = Object.values(rooms).filter(r => r.active);
    luma.visible = act.length > 0;
    if (act.length) {
      lumaState.t += dt * 0.35;
      const i = Math.floor(lumaState.t) % act.length,
        j = (i + 1) % act.length,
        k = lumaState.t % 1;
      const a = act[i].group.position,
        b = act[j].group.position;
      const e = k * k * (3 - 2 * k);
      luma.position.set(a.x + (b.x - a.x) * e + 0.9, 0.08 + Math.abs(Math.sin(time * 6)) * 0.03, a.z + (b.z - a.z) * e + 0.7);
      luma.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    }
    if (view.goal) {
      const k = 1 - Math.exp(-dt * 5);
      view.target.lerp(view.goal, k);
      view.dist += (view.distG - view.dist) * k;
      view.yaw += (view.yawG - view.yaw) * k;
    }
    placeCam();
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);
  return { renderer, scene, camera, rooms, ROOMS, focus, setActive, onPick: fn => (onPick = fn), fps: () => clock.fps, resize, view };
}
