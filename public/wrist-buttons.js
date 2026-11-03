import * as THREE from './vendor/three.module.js';

// Botones 3D de muñeca (cámara y oficina). Modelos hechos con primitivas, sin luces de escena:
// usan matcap generado para verse con volumen y brillo.
function matcap(light, mid, dark) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(46, 40, 6, 64, 64, 66);
  r.addColorStop(0, light);
  r.addColorStop(0.55, mid);
  r.addColorStop(1, dark);
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const mat = (a, b, c) => new THREE.MeshMatcapMaterial({ matcap: matcap(a, b, c) });
function roundedBox(w, h, d, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: d * 0.25, bevelSize: d * 0.25, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -d / 2);
  return g;
}

export function createWristButtons() {
  const group = new THREE.Group();
  const shared = {
    // estilo «cristal noche»: disco de cristal ahumado, iconos perla y azul hielo
    puck: mat('#7d93d0', '#1d2a50', '#070b1a'),
    cream: mat('#ffffff', '#d3dbee', '#7d89a6'),
    dark: mat('#3a4666', '#141b33', '#060912'),
    brick: mat('#b9cdf5', '#7f98cf', '#3a4c7c'),
    wall: mat('#f4f7ff', '#c4cee6', '#6f7b99'),
    floor: mat('#9fb0d8', '#5a6c9c', '#26304f'),
    wood: mat('#ffffff', '#cdd5ea', '#7a86a4'),
    violet: mat('#e0ecff', '#9fc0ff', '#4a6ab0')
  };
  const glass = new THREE.MeshBasicMaterial({ color: 0xa9c7ff });
  const make = (rimColor, build) => {
    const b = new THREE.Group();
    const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.0215, 0.007, 44), shared.puck);
    puck.rotation.x = Math.PI / 2;
    puck.position.z = 0.0035;
    const rimMat = new THREE.MeshBasicMaterial({ color: rimColor });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0205, 0.0013, 10, 56), rimMat);
    rim.position.z = 0.0075;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.0226, 0.0006, 8, 56), new THREE.MeshBasicMaterial({ color: 0x8fb8ff, transparent: true, opacity: 0.55 }));
    halo.position.z = 0.0058;
    b.add(halo);
    const icon = new THREE.Group();
    icon.position.z = 0.0082;
    build(icon);
    b.add(puck, rim, icon);
    b.userData = { rimMat, rimColor: new THREE.Color(rimColor), base: 0, hover: 0, press: 0, icon };
    return b;
  };
  const camera = make(0xdfe8ff, icon => {
    const body = new THREE.Mesh(roundedBox(0.027, 0.018, 0.005, 0.004), shared.cream);
    const hump = new THREE.Mesh(roundedBox(0.009, 0.005, 0.004, 0.0015), shared.cream);
    hump.position.set(-0.006, 0.0105, 0);
    const lensOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0066, 0.004, 28), shared.dark);
    lensOuter.rotation.x = Math.PI / 2;
    lensOuter.position.z = 0.0035;
    const lensGlass = new THREE.Mesh(new THREE.CircleGeometry(0.0036, 24), glass);
    lensGlass.position.z = 0.0057;
    const flash = new THREE.Mesh(new THREE.CircleGeometry(0.0012, 12), new THREE.MeshBasicMaterial({ color: 0x92e8c8 }));
    flash.position.set(0.0095, 0.0055, 0.0042);
    icon.add(body, hump, lensOuter, lensGlass, flash);
  });
  const office = make(0xe6dcff, icon => {
    const room = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.0025, 0.024), shared.floor);
    const wallA = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.014, 0.002), shared.brick);
    wallA.position.set(0, 0.0082, -0.011);
    const wallB = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.014, 0.022), shared.wall);
    wallB.position.set(-0.011, 0.0082, 0.001);
    const desk = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.0045, 0.005), shared.wood);
    desk.position.set(0.001, 0.0035, -0.004);
    const pc = new THREE.Mesh(new THREE.BoxGeometry(0.0045, 0.0035, 0.0008), glass);
    pc.position.set(0.001, 0.0078, -0.0065);
    const bot = new THREE.Mesh(new THREE.BoxGeometry(0.0045, 0.0055, 0.0045), shared.violet);
    bot.position.set(0.006, 0.004, 0.005);
    room.add(floor, wallA, wallB, desk, pc, bot);
    room.rotation.set(0.78, -Math.PI / 4 + 0.08, 0, 'XYZ');
    room.scale.setScalar(0.95);
    room.position.y = -0.001;
    icon.add(room);
  });
  camera.position.y = 0.025;
  office.position.y = -0.025;
  group.add(camera, office);
  let t0 = 0;
  function update(time, s) {
    const dt = Math.min(0.05, (time - t0) / 1000 || 0.016);
    t0 = time;
    [camera, office].forEach((b, i) => {
      const u = b.userData,
        active = i === 0 ? s.camActive : s.officeActive;
      u.hover += ((s.hover === i ? 1 : 0) - u.hover) * Math.min(1, dt * 14);
      u.press += ((s.press === i ? 1 : 0) - u.press) * Math.min(1, dt * 18);
      u.base += ((active ? 1 : 0) - u.base) * Math.min(1, dt * 8);
      const k = 1 + u.hover * 0.14 - u.press * 0.1;
      b.scale.setScalar(k);
      b.position.z = u.hover * 0.006 - u.press * 0.004;
      u.rimMat.color.copy(u.rimColor).lerp(new THREE.Color(0xffffff), u.base * 0.7 + u.hover * 0.25);
      u.icon.rotation.y = i === 1 ? Math.sin(time / 900) * 0.18 * (0.4 + u.hover) : 0; // la oficina "respira"
    });
  }
  return { group, update, camera, office };
}
