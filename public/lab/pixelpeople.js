// Personajes "animalito" en pixel art 3D (voxeles con solo las caras visibles). Cada parte es un hueso animable.
import * as THREE from '../vendor/three.module.js';

export const PX = 0.034; // tamaño de un píxel en metros (personaje ≈ 0.8 m)
export const WORKERS = [
  { id: 'estudio', animal: 'zorro', color: '#f0953a', icon: 'cam', label: 'Zorro fotógrafo' },
  { id: 'redaccion', animal: 'pinguino', color: '#4a3fa0', icon: 'pen', label: 'Pingüino redactor' },
  { id: 'taller', animal: 'rana', color: '#3aa05a', icon: 'wrench', label: 'Rana diseñadora XR' },
  { id: 'pauta', animal: 'toro', color: '#9a6240', icon: 'mega', label: 'Toro de pauta' },
  { id: 'analitica', animal: 'mapache', color: '#8a8f9a', icon: 'chart', label: 'Mapache analista' },
  { id: 'revision', animal: 'tiburon', color: '#6f7fd8', icon: 'check', label: 'Tiburón revisor' }
];
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const shade = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));
const SK = hex('#f2b98f'), SKD = hex('#d98f6a'), DK = hex('#2a1f2d'), WH = hex('#fff6f0'), PINK = hex('#ff6fa8');

// Pinta en una rejilla de 22×24 con partes: head, body, armL, armR, legL, legR, tail
function paint(animal, colHex, icon) {
  const c = hex(colHex), cd = shade(c, 0.78), cl = shade(c, 1.18), cells = new Map();
  const R = (x, y, w, h, col, part, face = false) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) cells.set(i + ',' + j, { x: i, y: j, col, part, face });
  };
  R(5, 13, 12, 7, c, 'body'); R(5, 18, 12, 2, cd, 'body'); R(7, 14, 8, 5, WH, 'body');
  const I = icon === 'heart' ? PINK : [91, 74, 138], cx = 11, cy = 15;
  const dot = (dx, dy) => cells.set(cx + dx + ',' + (cy + dy), { x: cx + dx, y: cy + dy, col: I, part: 'body', face: false });
  const ICONS = {
    cam: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-2, 1], [-1, 1], [1, 1], [2, 1], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2], [-1, -1], [0, -1]],
    pen: [[-2, 3], [-1, 3], [-1, 2], [0, 2], [0, 1], [1, 1], [1, 0], [2, 0], [2, -1]],
    wrench: [[-1, 0], [0, 0], [-1, 1], [0, 1], [-1, 2], [0, 2], [-1, 3], [0, 3], [-2, -1], [-1, -1], [0, -1], [1, -1], [-2, -2], [1, -2]],
    mega: [[-2, 1], [-1, 1], [-2, 2], [-1, 2], [0, 0], [0, 1], [0, 2], [0, 3], [1, -1], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [2, -1], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4]],
    chart: [[-2, 2], [-2, 3], [0, 0], [0, 1], [0, 2], [0, 3], [2, 1], [2, 2], [2, 3]],
    check: [[-2, 2], [-1, 3], [0, 2], [1, 1], [2, 0]],
    heart: [[-2, 0], [-1, 0], [1, 0], [2, 0], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [-1, 2], [0, 2], [1, 2], [0, 3]]
  };
  (ICONS[icon] || ICONS.heart).forEach(([dx, dy]) => dot(dx, dy));
  R(3, 14, 2, 4, c, 'armL'); R(3, 17, 2, 1, cd, 'armL'); R(17, 14, 2, 4, c, 'armR'); R(17, 17, 2, 1, cd, 'armR');
  R(6, 20, 4, 2, cd, 'legL'); R(12, 20, 4, 2, cd, 'legR');
  R(3, 3, 16, 10, c, 'head'); R(4, 2, 14, 1, c, 'head'); R(3, 11, 16, 2, cd, 'head'); R(4, 3, 6, 1, cl, 'head');
  R(6, 5, 10, 7, DK, 'head', true); R(7, 6, 8, 5, SK, 'head', true); R(7, 10, 8, 1, SKD, 'head', true);
  const f = (x, y, col) => cells.set(x + ',' + y, { x, y, col, part: 'head', face: true });
  if (animal === 'zorro') {
    R(3, 0, 3, 3, c, 'head'); R(16, 0, 3, 3, c, 'head'); R(4, 1, 1, 2, DK, 'head'); R(17, 1, 1, 2, DK, 'head');
    R(19, 15, 3, 5, c, 'tail'); R(20, 12, 2, 3, c, 'tail'); R(20, 12, 2, 2, WH, 'tail'); R(19, 19, 2, 1, WH, 'tail');
  } else if (animal === 'pinguino') {
    R(9, 3, 4, 2, [255, 182, 41], 'head'); R(4, 4, 2, 1, WH, 'head'); R(16, 4, 2, 1, WH, 'head'); R(5, 5, 1, 6, WH, 'head'); R(16, 5, 1, 6, WH, 'head');
  } else if (animal === 'rana') {
    R(4, 0, 5, 4, WH, 'head'); R(13, 0, 5, 4, WH, 'head'); R(6, 1, 2, 2, DK, 'head'); R(14, 1, 2, 2, DK, 'head'); R(3, 0, 1, 4, c, 'head'); R(18, 0, 1, 4, c, 'head');
  } else if (animal === 'toro') {
    R(2, 1, 2, 3, WH, 'head'); R(1, 0, 1, 2, WH, 'head'); R(18, 1, 2, 3, WH, 'head'); R(20, 0, 1, 2, WH, 'head'); R(4, 3, 2, 3, cd, 'head'); R(16, 3, 2, 3, cd, 'head');
    R(9, 11, 4, 1, PINK, 'head', true); R(19, 16, 1, 4, c, 'tail'); R(20, 19, 2, 2, cd, 'tail');
  } else if (animal === 'mapache') {
    R(3, 1, 4, 3, c, 'head'); R(15, 1, 4, 3, c, 'head'); R(4, 2, 2, 2, DK, 'head'); R(16, 2, 2, 2, DK, 'head'); R(6, 6, 10, 2, [59, 59, 68], 'head', true);
    R(19, 14, 3, 6, c, 'tail'); R(19, 15, 3, 1, DK, 'tail'); R(19, 17, 3, 1, DK, 'tail');
  } else if (animal === 'tiburon') {
    R(9, 0, 4, 3, c, 'head'); R(10, 0, 2, 1, WH, 'head'); R(3, 5, 1, 6, WH, 'head'); R(18, 5, 1, 6, WH, 'head'); R(19, 16, 3, 3, c, 'tail'); R(21, 15, 1, 5, c, 'tail');
  }
  return cells;
}

const D_ = DK, W_ = [255, 255, 255], R_ = [184, 82, 63], P_ = [255, 154, 168], A_ = [232, 72, 72], T_ = [90, 170, 255], K_ = [255, 111, 168];
const E = (cells, col) => cells.map(([x, y]) => [x, y, col]);
const CH = [[8, 9, P_], [14, 9, P_]];
const arcL = [[8, 8], [9, 7], [10, 8]], arcR = [[12, 8], [13, 7], [14, 8]];
const smile = [[9, 9], [10, 10], [11, 10], [12, 10], [13, 9]];
export const EXPRESSIONS = {
  neutral: [...E([[9, 7], [9, 8], [13, 7], [13, 8]], D_), ...E([[10, 10], [11, 10], [12, 10]], R_), ...CH],
  blink: [...E([[8, 8], [9, 8], [10, 8], [12, 8], [13, 8], [14, 8]], D_), ...E([[10, 10], [11, 10], [12, 10]], R_), ...CH],
  happy: [...E([...arcL, ...arcR], D_), ...E(smile, R_), ...CH],
  laugh: [...E([...arcL, ...arcR], D_), ...E([[9, 9], [10, 9], [11, 9], [12, 9], [13, 9], [10, 10], [12, 10]], D_), ...E([[11, 10]], K_), ...CH],
  surprised: [...E([[8, 7], [9, 7], [8, 8], [9, 8], [12, 7], [13, 7], [12, 8], [13, 8]], W_), ...E([[9, 8], [13, 8]], D_), ...E([[10, 10], [11, 10], [12, 10], [11, 9]], D_), ...CH],
  angry: [...E([[8, 6], [9, 7], [10, 7], [14, 6], [13, 7], [12, 7], [9, 8], [13, 8]], D_), ...E([[10, 10], [11, 10], [12, 10]], D_), [8, 9, A_], [14, 9, A_]],
  focused: [...E([[8, 7], [9, 7], [10, 7], [12, 7], [13, 7], [14, 7], [9, 8], [13, 8]], D_), ...E([[11, 10]], R_), ...CH],
  sleepy: [...E([[8, 8], [9, 8], [10, 8], [12, 8], [13, 8], [14, 8]], [90, 70, 110]), ...E([[11, 10], [11, 9]], R_), ...CH],
  think: [...E([[10, 7], [10, 8], [14, 7], [14, 8]], D_), ...E([[12, 10], [13, 10]], R_), ...CH],
  wink: [...E([[9, 7], [9, 8], [12, 8], [13, 8], [14, 8]], D_), ...E(smile, R_), ...CH],
  love: [...E([[8, 7], [10, 7], [8, 8], [9, 8], [10, 8], [9, 9], [12, 7], [14, 7], [12, 8], [13, 8], [14, 8], [13, 9]], K_), ...E([[11, 10]], R_)],
  sad: [...E([[8, 7], [9, 8], [13, 8], [14, 7], [9, 8]], D_), ...E([[10, 10], [11, 9], [12, 10]], R_), [8, 9, T_]]
};
const DEPTH = { head: 7, body: 5, armL: 2, armR: 2, legL: 3, legR: 3, tail: 2 };
const PIVOT = { head: [11, 12.5], body: [11, 14], armL: [4, 14.3], armR: [18, 14.3], legL: [8, 20], legR: [14, 20], tail: [20, 17] };
const FACE_SHADE = [1.0, 0.82, 1.12, 0.62]; // frente/lados, arriba, atrás

function buildPart(cells, part) {
  const own = [...cells.values()].filter(c => c.part === part);
  if (!own.length) return null;
  const d = DEPTH[part], pv = PIVOT[part], vox = new Map();
  own.forEach(c => { for (let z = 0; z < d; z++) vox.set(c.x + ',' + c.y + ',' + z, c); });
  const pos = [], colr = [], idx = [];
  // direcciones en espacio de píxel (y hacia abajo): vecino, esquinas en mundo (y arriba), sombreado
  const FACES = [
    { n: [0, 0, 1], q: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], k: 1.0 },
    { n: [0, 0, -1], q: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], k: 0.6 },
    { n: [1, 0, 0], q: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], k: 0.82 },
    { n: [-1, 0, 0], q: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], k: 0.82 },
    { n: [0, -1, 0], q: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], k: 1.12 },
    { n: [0, 1, 0], q: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], k: 0.7 }
  ];
  const HOOD = hex('#3a2f48');
  // Malla «golosa»: une caras vecinas coplanares del mismo color en un solo rectángulo (mismo aspecto, ~70 % menos triángulos).
  const faceCol = (c, f, z) => {
    const hood = cells.get('4,4')?.col || c.col;
    return c.face && !(f.n[2] === 1 && z === d - 1) ? hood : c.col;
  };
  FACES.forEach(f => {
    const ax = f.n.findIndex(v => v !== 0); // eje normal
    const [u, v] = [0, 1, 2].filter(i => i !== ax); // ejes tangentes
    const planes = new Map(); // plano → mapa "u,v" → color
    vox.forEach((c, key) => {
      const p = key.split(',').map(Number);
      if (vox.has((p[0] + f.n[0]) + ',' + (p[1] + f.n[1]) + ',' + (p[2] + f.n[2]))) return;
      const pk = p[ax];
      let m = planes.get(pk); if (!m) planes.set(pk, (m = new Map()));
      m.set(p[u] + ',' + p[v], { col: faceCol(c, f, p[2]), key: faceCol(c, f, p[2]).join('-') });
    });
    planes.forEach((m, pk) => {
      const done = new Set();
      const keys = [...m.keys()].map(k => k.split(',').map(Number)).sort((A, B) => A[1] - B[1] || A[0] - B[0]);
      for (const [cu, cv] of keys) {
        const k0 = cu + ',' + cv; if (done.has(k0)) continue;
        const ck = m.get(k0).key;
        let wu = 1; while (m.has((cu + wu) + ',' + cv) && !done.has((cu + wu) + ',' + cv) && m.get((cu + wu) + ',' + cv).key === ck) wu++;
        let hv = 1, ok = true;
        while (ok) {
          for (let i = 0; i < wu; i++) { const kk = (cu + i) + ',' + (cv + hv); if (!m.has(kk) || done.has(kk) || m.get(kk).key !== ck) { ok = false; break; } }
          if (ok) hv++;
        }
        for (let j = 0; j < hv; j++) for (let i = 0; i < wu; i++) done.add((cu + i) + ',' + (cv + j));
        const col = m.get(k0).col, base = pos.length / 3;
        f.q.forEach(q0 => {
          const q = [q0[0], 1 - q0[1], q0[2]]; // píxel: y crece hacia abajo
          const P = [0, 0, 0];
          P[ax] = pk + q[ax]; P[u] = cu + q[u] * wu; P[v] = cv + q[v] * hv;
          const X = P[0] - pv[0], Y = -(P[1] - pv[1]), Z = P[2] - d / 2;
          pos.push(X * PX, Y * PX, Z * PX);
          colr.push(...col.map(w => Math.pow((w * f.k) / 255, 2.2)));
        });
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.setIndex(idx);
  return g;
}

const MAT = new THREE.MeshBasicMaterial({ vertexColors: true });
export function makePixelPerson(def) {
  const cells = paint(def.animal, def.color, def.icon);
  // contorno oscuro: celdas vecinas vacías heredan la parte vecina
  const out = [];
  cells.forEach(c => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
    const k = c.x + dx + ',' + (c.y + dy);
    if (!cells.has(k)) out.push({ x: c.x + dx, y: c.y + dy, col: c.col === DK ? DK : shade(c.col, 0.36), part: c.part, face: false, k });
  }));
  out.forEach(o => cells.set(o.k, o));
  const root = new THREE.Group(), parts = {};
  let tris = 0;
  Object.keys(PIVOT).forEach(p => {
    const geo = buildPart(cells, p);
    if (!geo) return;
    const m = new THREE.Mesh(geo, MAT);
    tris += geo.index.count / 3;
    const pivot = new THREE.Group();
    // posición del pivote: x centrado en 11, y = (24 - fila) * PX
    pivot.position.set((PIVOT[p][0] - 11) * PX, (24 - PIVOT[p][1]) * PX, 0);
    pivot.add(m);
    parts[p] = pivot;
  });
  // jerarquía: cuerpo contiene todo lo demás; la cabeza cuelga del cuerpo
  const body = parts.body, bodyY = body.position.y;
  root.add(body);
  ['head', 'armL', 'armR', 'tail'].forEach(p => {
    if (!parts[p]) return;
    parts[p].position.sub(body.position);
    body.add(parts[p]);
  });
  ['legL', 'legR'].forEach(p => { root.add(parts[p]); });
  // el cuerpo gira alrededor de la cadera, no del pecho: lo dejamos en su sitio y usamos root para altura
  // caras: un plano de píxeles por expresión pegado al frente de la cabeza
  const faces = {}, fg = new THREE.Group();
  const hd = DEPTH.head, hp = PIVOT.head;
  Object.entries(EXPRESSIONS).forEach(([name, cl]) => {
    const pos = [], col = [], idx = [];
    cl.forEach(([x, y, c]) => {
      const b = pos.length / 3, X = (x - hp[0]) * PX, Y = -(y + 1 - hp[1]) * PX, Z = (hd / 2) * PX + 0.0015;
      [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([a, e]) => { pos.push(X + a * PX, Y + e * PX, Z); col.push(...c.map(v => Math.pow(v / 255, 2.2))); });
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, MAT);
    m.visible = name === 'neutral';
    fg.add(m);
    faces[name] = m;
    tris += cl.length * 2;
  });
  parts.head.add(fg);
  root.userData = { parts, tris, bodyY, def, faces, face: 'neutral' };
  // sombra en blob
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), new THREE.MeshBasicMaterial({ color: 0x1a1020, transparent: true, opacity: 0.28, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2;
  sh.position.y = 0.006;
  root.userData.shadow = sh;
  return root;
}

export function setFace(person, name) {
  const u = person.userData;
  if (u.face === name || !u.faces[name]) return;
  u.faces[u.face].visible = false;
  u.faces[name].visible = true;
  u.face = name;
}

// Alejo: perrito pixel
export function makePixelDog() {
  const c = new Map(), S = (x, y, w, h, col) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) c.set(i + ',' + j, { x: i, y: j, col, part: 'body', face: false }); };
  const tan = hex('#d9a66c'), dk = hex('#8a5a32');
  S(2, 4, 8, 4, tan); S(8, 2, 4, 4, tan); S(9, 1, 1, 2, dk); S(11, 1, 1, 2, dk); S(10, 3, 1, 1, DK); S(11, 4, 1, 1, DK); S(12, 4, 1, 1, DK); S(1, 3, 1, 3, tan); S(2, 8, 2, 2, dk); S(7, 8, 2, 2, dk);
  const out = [];
  c.forEach(o => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const k = o.x + dx + ',' + (o.y + dy); if (!c.has(k)) out.push({ x: o.x + dx, y: o.y + dy, col: DK, part: 'body', face: false, k }); }));
  out.forEach(o => c.set(o.k, o));
  DEPTH.dog = 4; PIVOT.dog = [7, 10];
  const saved = { b: DEPTH.body, p: PIVOT.body };
  const cells = new Map([...c].map(([k, v]) => [k, { ...v, part: 'dog' }]));
  const geo = buildPart(cells, 'dog');
  const m = new THREE.Mesh(geo, MAT);
  const g = new THREE.Group();
  m.position.y = 0;
  g.add(m);
  g.scale.setScalar(0.95);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), new THREE.MeshBasicMaterial({ color: 0x1a1020, transparent: true, opacity: 0.28, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2;
  sh.position.y = 0.006;
  g.userData = { mesh: m, shadow: sh, tris: geo.index.count / 3 };
  return g;
}

export function setTint(hexColor) { MAT.color.set(hexColor); }

// Dibujo plano (Canvas 2D) del personaje, de frente, para usarlo en los menús: mismo pixel-art que el 3D de la oficina.
export function drawPixelPerson2D(g, def, x, y, px, expr = 'happy') {
  const cells = paint(def.animal, def.color, def.icon);
  const out = [];
  cells.forEach(c => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
    const k = c.x + dx + ',' + (c.y + dy);
    if (!cells.has(k)) out.push({ x: c.x + dx, y: c.y + dy, col: c.col === DK ? DK : shade(c.col, 0.36), k });
  }));
  out.forEach(o => cells.set(o.k, o));
  g.save();
  g.imageSmoothingEnabled = false;
  cells.forEach(c => { g.fillStyle = `rgb(${c.col[0]},${c.col[1]},${c.col[2]})`; g.fillRect(x + c.x * px, y + c.y * px, px + 0.5, px + 0.5); });
  (EXPRESSIONS[expr] || EXPRESSIONS.neutral).forEach(([cx, cy, col]) => { g.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`; g.fillRect(x + cx * px, y + cy * px, px + 0.5, px + 0.5); });
  g.restore();
}

// Zorro fotógrafo animado en 2D (Canvas): respira, parpadea y dispara un flash de vez en cuando.
export function drawFoxPhotographer2D(g, x, y, px, t = 0) {
  const bob = Math.round(Math.sin(t * 2.2) * px * 0.35);
  const blink = Math.sin(t * 0.9) > 0.975;
  const cycle = (t % 3.4) / 3.4, flash = cycle > 0.86 && cycle < 0.93;
  drawPixelPerson2D(g, WORKERS[0], x, y + bob, px, flash ? 'surprised' : blink ? 'blink' : 'happy');
  // cámara en las manos
  const cx = x + 6 * px, cy = y + bob + 15.4 * px;
  g.save();
  g.fillStyle = '#20243a'; g.fillRect(cx, cy, px * 10, px * 5);
  g.fillStyle = '#3a4268'; g.fillRect(cx + px * 1, cy - px * 1, px * 3, px * 1);
  g.fillStyle = '#cfd8ee'; g.fillRect(cx + px * 3.5, cy + px * 1, px * 3, px * 3);
  g.fillStyle = flash ? '#ffffff' : '#6f8fd8'; g.fillRect(cx + px * 4.2, cy + px * 1.7, px * 1.6, px * 1.6);
  if (flash) { g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(cx + px * 8, cy - px * 2, px * 2, px * 2); g.fillRect(cx + px * 10, cy - px * 1, px * 2, px * 1); }
  g.restore();
}
