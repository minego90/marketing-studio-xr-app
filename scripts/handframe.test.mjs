import test from 'node:test';
import assert from 'node:assert/strict';
import { frameFromHands, fitAspect, nearestFormat, createSteady } from '../public/lab/handframe.js';
const L = { thumb: { x: 0.2, y: 0.5 }, index: { x: 0.2, y: 0.3 } },
  R = { thumb: { x: 0.6, y: 0.5 }, index: { x: 0.6, y: 0.7 } };
test('El marco de manos contiene las cuatro puntas', () => {
  const r = frameFromHands(L, R);
  assert.deepEqual([r.x, r.y], [0.2, 0.3]);
  assert.ok(Math.abs(r.w - 0.4) < 1e-9 && Math.abs(r.h - 0.4) < 1e-9);
  assert.equal(frameFromHands(L, null), null);
  assert.equal(frameFromHands({ thumb: { x: 1, y: 1 }, index: { x: 1, y: 1 } }, { thumb: { x: 1, y: 1 }, index: { x: 1, y: 1 } }), null);
});
test('Ajuste de proporción y formato más cercano', () => {
  const f = fitAspect(frameFromHands(L, R), 9 / 16);
  assert.ok(Math.abs(f.w / f.h - 9 / 16) < 1e-9 && f.h <= 0.4 + 1e-9);
  assert.equal(nearestFormat(0.8)[0], 'Feed 4:5');
  assert.equal(nearestFormat(0.56)[0], 'Historia/Reel 9:16');
});
test('Detector de quieto exige mantener el marco y se reinicia al moverlo', () => {
  const s = createSteady({ ms: 1000, tol: 0.02 }),
    r = frameFromHands(L, R);
  assert.equal(s.update(r, 0).steady, false);
  assert.equal(s.update(r, 500).progress, 0.5);
  assert.equal(s.update(r, 1000).steady, true);
  const moved = frameFromHands(L, { thumb: { x: 0.8, y: 0.5 }, index: { x: 0.8, y: 0.7 } });
  assert.equal(s.update(moved, 1100).progress, 0);
  assert.equal(s.update(null, 1200).steady, false);
});
