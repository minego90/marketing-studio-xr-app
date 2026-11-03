import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, buildGrid, findPath, Chair, Worker, Dog, BREAKS } from '../public/lab/brain.js';
const layout = {
  bounds: { x0: -3.6, x1: 3.6, z0: -3.1, z1: 3.1 },
  obstacles: [{ x0: -1.7, x1: -0.7, z0: -2.9, z1: -2.2 }, { x0: -1.7, x1: -0.1, z0: -0.9, z1: -0.1 }, { x0: -1.6, x1: -0.2, z0: 1.1, z1: 1.9 }],
  workers: { analitica: { x: -1.2, z: -1.85, yaw: Math.PI }, estudio: { x: 2, z: 2, yaw: 0, standing: true } },
  pois: { tv: { x: 0, z: -1.5, fx: 0, fz: -1 }, ventanas: [{ x: -3.0, z: 1.6, fx: -1, fz: 0 }], celular: { x: 1, z: 0, fx: 0, fz: 1 }, alejo: { x: 1.6, z: 0.4, fx: 1, fz: 0 }, planta: { x: -2.6, z: -2.1, fx: -1, fz: -1 }, estanteria: { x: 2.4, z: -2.4, fx: 0, fz: -1 }, paseo: [{ x: 0.5, z: 0.5 }, { x: 1.5, z: 1.5 }] }
};
test('La ruta esquiva obstáculos', () => {
  const g = buildGrid(layout), p = findPath(g, { x: -2.5, z: -1.5 }, { x: 0.2, z: -1.5 });
  assert.ok(p.length >= 2);
  for (let i = 0; i < p.length - 1; i++) for (let t = 0; t <= 1; t += 0.05) {
    const x = p[i].x + (p[i + 1].x - p[i].x) * t, z = p[i].z + (p[i + 1].z - p[i].z) * t;
    for (const o of layout.obstacles) assert.ok(!(x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1), 'cruza un mueble');
  }
});
test('La silla rueda suelta al levantarse y vuelve a su lugar', () => {
  const rng = makeRng(3), c = new Chair({ x: 0, z: 0, yaw: 0 }, layout.bounds);
  c.kick(0, 1, rng);
  for (let i = 0; i < 40; i++) c.update(0.05);
  assert.ok(Math.hypot(c.x, c.z) > 0.3 && c.mode === 'free');
  c.goHome();
  for (let i = 0; i < 40; i++) c.update(0.05);
  assert.ok(Math.hypot(c.x, c.z) < 1e-6 && c.mode === 'home');
});
test('Un trabajador se levanta, hace una pausa y vuelve a sentarse con su silla', () => {
  const rng = makeRng(7), w = new Worker('analitica', layout, rng, { grid: buildGrid(layout) }), seen = new Set(), keys = new Set();
  w.workLeft = 0.5;
  for (let i = 0; i < 4000; i++) {
    w.update(0.05, { dogOk: true });
    seen.add(w.state);
    w.events.splice(0).forEach(e => e.key && keys.add(e.key));
    if (i > 100 && w.state === 'work' && seen.has('act')) break;
  }
  for (const s of ['rise', 'walk_out', 'act', 'walk_back', 'sit', 'work']) assert.ok(seen.has(s), 'falta ' + s);
  assert.ok(Math.hypot(w.x - layout.workers.analitica.x, w.z - layout.workers.analitica.z) < 0.01);
  assert.equal(w.chair.mode, 'home');
  assert.ok(w.sit > 0.99);
  assert.ok([...keys].every(k => BREAKS[k]));
});
test('Con la sala activa (busy) no se levanta nunca', () => {
  const w = new Worker('analitica', layout, makeRng(2), { grid: buildGrid(layout) });
  w.setBusy(true); w.workLeft = 0.1;
  for (let i = 0; i < 2000; i++) w.update(0.05);
  assert.equal(w.state, 'work');
});
test('Alejo corre hacia quien lo llama y juega', () => {
  const g = buildGrid(layout, 0.2), d = new Dog(layout, makeRng(5), g);
  d.call({ x: -2.5, z: 2.5 });
  for (let i = 0; i < 400; i++) d.update(0.05);
  assert.equal(d.state, 'play');
  assert.ok(Math.hypot(d.x + 2.5, d.z - 2.5) < 0.3);
});
test('Todas las pausas son alcanzables sin quedarse atascado', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const w = new Worker('estudio', layout, makeRng(seed), { grid: buildGrid(layout) });
    w.workLeft = 0.2; let acts = 0;
    for (let i = 0; i < 6000; i++) { w.update(0.05, { dogOk: true }); w.events.splice(0).forEach(e => e.type === 'actDo' && acts++); }
    assert.ok(acts >= 2, 'seed ' + seed + ' acts ' + acts);
  }
});
