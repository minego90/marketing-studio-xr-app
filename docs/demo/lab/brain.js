// Cerebro de la oficina: lógica pura (sin THREE) para que se pueda probar en Node.
// Coordenadas de mundo en metros: x derecha, z hacia la cámara. yaw = ángulo del frente del personaje (0 = mira a +z).

export function makeRng(seed = 1) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (a, b) => a + (b - a) * r();
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  return r;
}
const TAU = Math.PI * 2;
export const angDiff = (a, b) => ((((b - a) % TAU) + TAU + Math.PI) % TAU) - Math.PI;
export const faceYaw = (fx, fz) => Math.atan2(fx, fz);
const ease = k => k * k * (3 - 2 * k);

// —— Mapa y rutas (A* en rejilla de 0.2 m) ——
const CELL = 0.2;
export function buildGrid(layout, pad = 0.28) {
  const b = layout.bounds;
  const w = Math.ceil((b.x1 - b.x0) / CELL), h = Math.ceil((b.z1 - b.z0) / CELL);
  const blocked = new Uint8Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const x = b.x0 + (i + 0.5) * CELL, z = b.z0 + (j + 0.5) * CELL;
      if (x < b.x0 + 0.25 || x > b.x1 - 0.25 || z < b.z0 + 0.25 || z > b.z1 - 0.25) blocked[j * w + i] = 1;
      for (const o of layout.obstacles) if (x > o.x0 - pad && x < o.x1 + pad && z > o.z0 - pad && z < o.z1 + pad) blocked[j * w + i] = 1;
    }
  return { w, h, blocked, b };
}
const cellOf = (g, x, z) => [Math.max(0, Math.min(g.w - 1, Math.floor((x - g.b.x0) / CELL))), Math.max(0, Math.min(g.h - 1, Math.floor((z - g.b.z0) / CELL)))];
const centerOf = (g, i, j) => ({ x: g.b.x0 + (i + 0.5) * CELL, z: g.b.z0 + (j + 0.5) * CELL });
function nearestFree(g, i, j) {
  if (!g.blocked[j * g.w + i]) return [i, j];
  for (let r = 1; r < 12; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        const a = i + di, b = j + dj;
        if (a >= 0 && b >= 0 && a < g.w && b < g.h && !g.blocked[b * g.w + a]) return [a, b];
      }
  return [i, j];
}
function lineFree(g, p, q) {
  const n = Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / (CELL * 0.5));
  for (let k = 0; k <= n; k++) {
    const t = k / Math.max(1, n), [i, j] = cellOf(g, p.x + (q.x - p.x) * t, p.z + (q.z - p.z) * t);
    if (g.blocked[j * g.w + i]) return false;
  }
  return true;
}
export function findPath(g, from, to) {
  const [si, sj] = nearestFree(g, ...cellOf(g, from.x, from.z)), [ei, ej] = nearestFree(g, ...cellOf(g, to.x, to.z));
  const key = (i, j) => j * g.w + i, open = [[0, si, sj]], came = new Map(), cost = new Map([[key(si, sj), 0]]);
  const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [1, -1, 1.41], [-1, 1, 1.41], [-1, -1, 1.41]];
  let found = false;
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const [, i, j] = open.shift();
    if (i === ei && j === ej) { found = true; break; }
    for (const [di, dj, c] of D) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= g.w || b >= g.h || g.blocked[key(a, b)]) continue;
      if (di && dj && (g.blocked[key(i + di, j)] || g.blocked[key(i, j + dj)])) continue;
      const nc = cost.get(key(i, j)) + c;
      if (nc < (cost.get(key(a, b)) ?? 1e9)) {
        cost.set(key(a, b), nc);
        came.set(key(a, b), [i, j]);
        open.push([nc + Math.hypot(ei - a, ej - b), a, b]);
      }
    }
  }
  if (!found) return [from, to];
  const pts = [];
  let cur = [ei, ej];
  while (cur) { pts.push(centerOf(g, cur[0], cur[1])); cur = came.get(key(cur[0], cur[1])); }
  pts.reverse();
  pts[0] = { x: from.x, z: from.z };
  pts[pts.length - 1] = { x: to.x, z: to.z };
  // suavizado: saltar nodos con línea libre
  const out = [pts[0]];
  let a = 0;
  while (a < pts.length - 1) {
    let b = pts.length - 1;
    while (b > a + 1 && !lineFree(g, pts[a], pts[b])) b--;
    out.push(pts[b]);
    a = b;
  }
  return out;
}

// —— Silla con física suelta ——
export class Chair {
  constructor(home, bounds) {
    this.home = { ...home };
    this.x = home.x; this.z = home.z; this.yaw = home.yaw;
    this.vx = 0; this.vz = 0; this.w = 0; this.mode = 'home'; this.t = 0; this.from = null; this.b = bounds;
  }
  kick(fx, fz, rng, power = 0.9) { // el ocupante se levanta mirando (fx,fz): la silla rueda hacia atrás
    this.mode = 'free'; this.vx = -fx * power + rng.range(-0.15, 0.15); this.vz = -fz * power + rng.range(-0.15, 0.15); this.w = rng.range(-2.4, 2.4);
  }
  nudge(dx, dz, rng) { if (this.mode === 'free') { this.vx += dx; this.vz += dz; this.w += rng.range(-1, 1); } }
  goHome() { if (this.mode === 'free') { this.mode = 'return'; this.t = 0; this.from = { x: this.x, z: this.z, yaw: this.yaw }; } }
  update(dt) {
    if (this.mode === 'free') {
      this.x += this.vx * dt; this.z += this.vz * dt; this.yaw += this.w * dt;
      const f = Math.exp(-2.1 * dt); this.vx *= f; this.vz *= f; this.w *= Math.exp(-1.8 * dt);
      const b = this.b;
      if (this.x < b.x0 + 0.4 || this.x > b.x1 - 0.4) { this.vx *= -0.4; this.x = Math.max(b.x0 + 0.4, Math.min(b.x1 - 0.4, this.x)); }
      if (this.z < b.z0 + 0.4 || this.z > b.z1 - 0.4) { this.vz *= -0.4; this.z = Math.max(b.z0 + 0.4, Math.min(b.z1 - 0.4, this.z)); }
    } else if (this.mode === 'return') {
      this.t = Math.min(1, this.t + dt / 0.8);
      const k = ease(this.t), f = this.from;
      this.x = f.x + (this.home.x - f.x) * k; this.z = f.z + (this.home.z - f.z) * k; this.yaw = f.yaw + angDiff(f.yaw, this.home.yaw) * k;
      if (this.t >= 1) { this.mode = 'home'; this.yaw = this.home.yaw; }
    }
  }
}

// —— Acciones fuera del escritorio ——
export const BREAKS = {
  tv: { label: 'Prendiendo la TV', anim: 'tv', dur: [7, 11], w: 3 },
  ventana: { label: 'Mirando por la ventana', anim: 'window', dur: [6, 10], w: 3 },
  celular: { label: 'Hablando por celular', anim: 'phone', dur: [7, 12], w: 3 },
  alejo: { label: 'Jugando con Alejo', anim: 'play', dur: [8, 13], w: 4 },
  planta: { label: 'Regando la palmera', anim: 'water', dur: [5, 8], w: 2 },
  estanteria: { label: 'Buscando un libro', anim: 'browse', dur: [5, 8], w: 2 },
  estirar: { label: 'Estirando las piernas', anim: 'stretch', dur: [4, 6], w: 2 },
  cafe: { label: 'Tomándose un café', anim: 'sip', dur: [5, 8], w: 2 },
  reporte: { label: 'Presentando el reporte', anim: 'point', dur: [12, 16], w: 0 }
};
export const WORK = {
  estudio: ['shoot', 'shoot', 'check', 'adjust', 'look'],
  redaccion: ['write', 'write', 'type', 'think', 'read', 'sip'],
  taller: ['type', 'tweak', 'type', 'think', 'look', 'stretch'],
  pauta: ['type', 'type', 'call', 'read', 'sip', 'think'],
  analitica: ['type', 'read', 'point', 'think', 'sip', 'type'],
  revision: ['read', 'mark', 'read', 'think', 'sip', 'nod']
};
export const WORK_SAY = {
  estudio: ['Midiendo la luz…', 'Cuadrando el marco…', 'Revisando nitidez…'],
  redaccion: ['Escribiendo el gancho…', 'Probando titulares…', 'Puliendo el CTA…'],
  taller: ['Montando el prisma…', 'Ajustando la luz…', 'Probando el portal…'],
  pauta: ['Armando el borrador…', 'Verificando PAUSED…', 'Calculando alcance…'],
  analitica: ['Leyendo métricas…', 'Buscando patrones…', 'Vigilando el gasto…'],
  revision: ['Revisando copy…', 'Zonas seguras OK…', 'Puntuando la campaña…']
};

export const FACE_BY_ANIM = { type: 'focused', write: 'focused', read: 'focused', mark: 'focused', tweak: 'focused', shoot: 'focused', adjust: 'focused', check: 'surprised', point: 'neutral', look: 'neutral', think: 'think', sip: 'happy', nod: 'happy', stretch: 'sleepy', call: 'happy', tv: 'neutral', window: 'sleepy', phone: 'happy', play: 'laugh', water: 'happy', browse: 'think', walk: 'neutral', rise: 'neutral', jump: 'laugh', cheer: 'laugh', wave: 'happy', hand_up: 'happy', surprise: 'surprised' };

// —— Trabajador: máquina de estados ——
export class Worker {
  constructor(id, layout, rng, opts = {}) {
    this.id = id; this.layout = layout; this.rng = rng; this.grid = opts.grid || buildGrid(layout);
    const h = layout.workers[id];
    this.home = h; // {x,z,yaw (mirada del trabajador sentado), standing?, stand:{x,z}}
    this.standing = !!h.standing;
    this.chair = this.standing ? null : new Chair({ x: h.x, z: h.z, yaw: h.chairYaw ?? h.yaw + Math.PI }, layout.bounds);
    this.x = h.x; this.z = h.z; this.yaw = h.yaw; this.sit = this.standing ? 0 : 1;
    this.state = 'work'; this.anim = 'type'; this.animT = 0; this.subT = 0; this.subDur = 0; this.workLeft = rng.range(10, 30) + (opts.delay || 0);
    this.forceWork = false; this.orders = []; this.react = null; this.view = 'type'; this.hop = 0; this.face = 'neutral'; this.blinkT = rng.range(1.5, 4); this.blinking = 0; this.faceHold = null; this.path = []; this.speed = 0; this.say = ''; this.sayUntil = 0; this.events = []; this.t = 0; this.last = ''; this.act = null; this.stateT = 0;
    this.nextSub();
  }
  nextSub() {
    const list = WORK[this.id] || WORK.analitica;
    let a = this.rng.pick(list), n = 0;
    while (a === this.anim && n++ < 4) a = this.rng.pick(list);
    this.anim = a; this.animT = 0; this.subDur = this.rng.range(2.4, 6);
  }
  // reacciones puntuales: 'jump' (salta), 'hand_up' (levanta la mano), 'cheer' (brazos arriba), 'wave' (saluda), 'surprise'
  doReact(kind, dur = 1.6, face) {
    this.react = { kind, left: dur, dur }; this.faceHold = { face: face || ({ jump: 'laugh', cheer: 'laugh', wave: 'happy', hand_up: 'happy', surprise: 'surprised' }[kind] || 'happy'), left: dur };
  }
  updateFace(dt) {
    if (this.faceHold) { this.faceHold.left -= dt; if (this.faceHold.left <= 0) this.faceHold = null; }
    const rx = this.react, an = this.view;
    this.hop = rx && (rx.kind === 'jump' || rx.kind === 'cheer') ? Math.abs(Math.sin((rx.dur - rx.left) * 9)) * 0.2 : 0;
    let f = FACE_BY_ANIM[an] || 'neutral';
    if (this.state === 'act' && this.act?.key === 'tv' && this.stateT < 2.2) f = 'surprised';
    if (this.state === 'walk_out' || this.state === 'walk_back') f = 'neutral';
    if (this.ctxNight && this.state === 'work' && ['type', 'read', 'look'].includes(this.anim) && Math.floor(this.t / 9 + this.id.length) % 3 === 0) f = 'sleepy';
    if (this.state === 'work' && this.anim === 'call' && Math.floor(this.t / 6) % 5 === 3) f = 'angry';
    if (this.faceHold) f = this.faceHold.face;
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blinking = 0.13; this.blinkT = this.rng.range(2.2, 5.2); }
    if (this.blinking > 0) { this.blinking -= dt; if (['neutral', 'focused', 'think', 'surprised'].includes(f)) f = 'blink'; }
    this.face = f;
  }
  order(key) { if (BREAKS[key] && !this.orders.includes(key)) this.orders.push(key); }
  setBusy(b) { this.forceWork = b; if (b && this.state === 'act') this.finishAct(); }
  standPoint() { // donde se para junto a su silla
    const h = this.home, fx = Math.sin(h.yaw), fz = Math.cos(h.yaw);
    return this.standing ? { x: h.x, z: h.z } : { x: h.x - fx * 0.62, z: h.z - fz * 0.62 };
  }
  pickBreak(ctx) {
    const keys = Object.keys(BREAKS).filter(k => BREAKS[k].w > 0 && k !== this.last && (k !== 'alejo' || ctx.dogOk !== false));
    const wt = k => BREAKS[k].w * (ctx.night ? ({ ventana: 2.2, cafe: 2.5, estirar: 2, celular: 0.5, alejo: 0.5, tv: 1.3 }[k] || 1) : 1);
    let tot = keys.reduce((a, k) => a + wt(k), 0), r = this.rng() * tot;
    for (const k of keys) { r -= wt(k); if (r <= 0) return k; }
    return keys[0];
  }
  poiFor(key, ctx) {
    const P = this.layout.pois;
    if (key === 'alejo') return ctx.alejo || P.alejo;
    if (key === 'ventana') return this.rng.pick(P.ventanas);
    if (key === 'reporte') return P.tv;
    if (key === 'estirar' || key === 'cafe') { const s = this.standPoint(); return { x: s.x, z: s.z, fx: Math.sin(this.home.yaw + 0.8), fz: Math.cos(this.home.yaw + 0.8) }; }
    return P[key];
  }
  goTo(p, next) { this.path = findPath(this.grid, { x: this.x, z: this.z }, p); this.path.shift(); this.state = next; this.stateT = 0; }
  say_(txt, t, dur = 2.6) { this.say = txt; this.sayUntil = t + dur; }
  finishAct() { this.act = null; this.events.push({ type: 'actEnd', worker: this.id }); this.goTo(this.standPoint(), 'walk_back'); }
  update(dt, ctx = {}) {
    this.t += dt; this.stateT += dt; this.animT += dt; this.ctxNight = !!ctx.night;
    if (this.react) { this.react.left -= dt; if (this.react.left <= 0) this.react = null; }
    if (this.chair) this.chair.update(dt);
    const s = this.state;
    if (s === 'work') {
      this.sit = this.standing ? 0 : Math.min(1, this.sit + dt * 3);
      this.speed = 0;
      this.subT += dt;
      if (this.subT > this.subDur) { this.subT = 0; this.nextSub(); }
      if (this.orders.length) { this.state = 'rise'; this.stateT = 0; this.anim = 'rise'; this.pendingKey = this.orders.shift(); }
      else if (!this.forceWork) { this.workLeft -= dt; if (this.workLeft <= 0) { this.state = 'rise'; this.stateT = 0; this.anim = 'rise'; } }
    } else if (s === 'rise') {
      this.sit = Math.max(0, this.sit - dt / 0.55);
      if (this.chair && this.stateT < dt * 1.5) { this.chair.kick(Math.sin(this.home.yaw), Math.cos(this.home.yaw), this.rng); }
      if (this.chair) { const sp = this.standPoint(), k = ease(Math.min(1, this.stateT / 0.55)); this.x = this.home.x + (sp.x - this.home.x) * k; this.z = this.home.z + (sp.z - this.home.z) * k; }
      if (this.stateT >= 0.55) {
        this.sit = 0;
        const key = this.pendingKey || this.pickBreak(ctx); this.pendingKey = null; this.last = key; this.act = { key, ...BREAKS[key], poi: this.poiFor(key, ctx), dur: this.rng.range(...BREAKS[key].dur) };
        if (ctx.night && key === 'ventana') this.act.label = 'Mirando las estrellas';
        this.events.push({ type: 'actStart', worker: this.id, key, label: this.act.label, poi: this.act.poi });
        this.goTo(this.act.poi, 'walk_out');
      }
    } else if (s === 'walk_out' || s === 'walk_back') {
      this.walk(dt);
      if (s === 'walk_back' && this.chair && this.chair.mode === 'free' && Math.hypot(this.x - this.chair.home.x, this.z - this.chair.home.z) < 1.5) this.chair.goHome();
      if (!this.path.length) {
        if (s === 'walk_out') {
          const p = this.act.poi;
          this.state = 'turn'; this.stateT = 0; this.turnTo = faceYaw(p.fx ?? 0, p.fz ?? 1);
        } else { this.state = 'turn_sit'; this.stateT = 0; this.turnTo = this.home.yaw; this.anim = 'walk'; }
      }
    } else if (s === 'turn' || s === 'turn_sit') {
      this.yaw += angDiff(this.yaw, this.turnTo) * Math.min(1, dt * 9); this.speed = 0;
      if (Math.abs(angDiff(this.yaw, this.turnTo)) < 0.08 || this.stateT > 0.8) {
        if (s === 'turn') { this.state = 'act'; this.stateT = 0; this.anim = this.act.anim; this.animT = 0; this.events.push({ type: 'actDo', worker: this.id, key: this.act.key, poi: this.act.poi }); }
        else { this.state = 'sit'; this.stateT = 0; if (this.chair) this.chair.goHome(); }
      }
    } else if (s === 'act') {
      this.speed = 0;
      if ((this.forceWork && this.act.key !== 'reporte') || this.stateT > this.act.dur) this.finishAct();
    } else if (s === 'sit') {
      if (this.chair) { const sp = this.standPoint(), k = ease(Math.min(1, this.stateT / 0.6)); this.x = sp.x + (this.home.x - sp.x) * k; this.z = sp.z + (this.home.z - sp.z) * k; this.sit = k; }
      else this.sit = 0;
      if (this.stateT >= 0.6) { this.state = 'work'; this.subT = 0; this.nextSub(); this.workLeft = this.rng.range(16, 40); this.x = this.home.x; this.z = this.home.z; this.yaw = this.home.yaw; this.events.push({ type: 'actEnd', worker: this.id, seated: true }); }
    }
    if (this.t > this.sayUntil) this.say = '';
    this.view = this.react ? this.react.kind : this.anim;
    this.updateFace(dt);
    return this;
  }
  walk(dt) {
    if (!this.path.length) return;
    const t = this.path[0], dx = t.x - this.x, dz = t.z - this.z, d = Math.hypot(dx, dz), step = Math.min(d, 0.95 * dt);
    this.anim = 'walk'; this.speed = 0.95;
    if (d > 0.02) { this.x += (dx / d) * step; this.z += (dz / d) * step; const ty = faceYaw(dx, dz); this.yaw += angDiff(this.yaw, ty) * Math.min(1, dt * 10); }
    if (d - step < 0.03) this.path.shift();
  }
}

// —— Alejo, el perrito ——
export class Dog {
  constructor(layout, rng, grid) {
    this.layout = layout; this.rng = rng; this.grid = grid || buildGrid(layout, 0.2);
    const p = layout.pois.alejo; this.x = p.x; this.z = p.z; this.yaw = 0; this.path = []; this.state = 'idle'; this.t = rng.range(0, 3); this.anim = 'idle'; this.callTo = null; this.hop = 0;
  }
  call(p) { this.callTo = p; this.path = findPath(this.grid, { x: this.x, z: this.z }, p); this.path.shift(); this.state = 'run'; }
  release() { this.callTo = null; this.state = 'idle'; this.t = 0; }
  update(dt, night = false) {
    this.t += dt;
    if (night && this.state === 'idle') { this.anim = 'sleep'; return; }
    if (this.state === 'run') {
      if (!this.path.length) { this.state = 'play'; this.t = 0; }
      else { const p = this.path[0], dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz), st = Math.min(d, 1.5 * dt); this.x += (dx / d) * st; this.z += (dz / d) * st; this.yaw += angDiff(this.yaw, faceYaw(dx, dz)) * Math.min(1, dt * 12); this.anim = 'run'; if (d - st < 0.03) this.path.shift(); }
    } else if (this.state === 'play') { this.anim = 'play'; this.hop = Math.abs(Math.sin(this.t * 7)) * 0.07; if (this.callTo) this.yaw += angDiff(this.yaw, this.yaw + 1.2) * dt; }
    else if (this.state === 'idle') {
      this.anim = this.t % 6 < 3 ? 'sit' : 'wag';
      if (this.t > this.rng.range(4, 9)) {
        const g = this.layout.pois.paseo, p = this.rng.pick(g); this.path = findPath(this.grid, { x: this.x, z: this.z }, p); this.path.shift(); this.state = 'trot'; this.t = 0;
      }
    } else if (this.state === 'trot') {
      if (!this.path.length) { this.state = 'idle'; this.t = 0; }
      else { const p = this.path[0], dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz), st = Math.min(d, 0.8 * dt); this.x += (dx / d) * st; this.z += (dz / d) * st; this.yaw += angDiff(this.yaw, faceYaw(dx, dz)) * Math.min(1, dt * 8); this.anim = 'run'; if (d - st < 0.03) this.path.shift(); }
    }
  }
}
