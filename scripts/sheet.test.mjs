import test from 'node:test';
import assert from 'node:assert/strict';
import { composeSheet, sheetCells, sheetSize, SHEET_LAYOUTS } from '../public/sheet.js';
const ctx = () => new Proxy({ calls: [] }, { get: (t, k) => (k === 'calls' ? t.calls : (...a) => t.calls.push([k, ...a])), set: () => true });
test('hoja: celdas dentro del lienzo y sin solaparse', () => {
  for (const l of SHEET_LAYOUTS) {
    const [W, H] = sheetSize(l), cells = sheetCells(l, 4);
    assert.equal(cells.length, 4);
    for (const [x, y, w, h] of cells) assert.ok(x >= 0 && y >= 0 && x + w <= W && y + h <= H && w > 100 && h > 100, l);
  }
});
test('hoja: fondo blanco y una imagen por vista; null sin imágenes', () => {
  const g = ctx(), mk = () => ({ getContext: () => g });
  assert.equal(composeSheet([['front', null]], 'grid', mk), null);
  const im = { complete: true, naturalWidth: 800, naturalHeight: 1000 };
  const c = composeSheet([['front', im], ['right', im], ['left', im], ['back', im]], 'grid', mk);
  assert.equal(c.width, 1400);
  assert.equal(g.calls.filter(x => x[0] === 'drawImage').length, 4);
  assert.ok(g.calls.some(x => x[0] === 'fillRect' && x[3] === 1400));
});
