import test from 'node:test';
import assert from 'node:assert/strict';
import { officeInfo } from '../public/office-info.js';
test('sin datos: «esperando» + explicación; con datos: el resultado', () => {
  for (const id of ['estudio', 'redaccion', 'taller', 'pauta', 'analitica', 'revision', '__tv']) {
    const i = officeInfo(id, {});
    assert.ok(i.waiting && /Esperando/.test(i.status) && i.what && i.open, id);
  }
  assert.equal(officeInfo('nada', {}), null);
  const e = officeInfo('estudio', { photos: { front: { url: '/a.jpg' }, back: { url: '/b.jpg' } } });
  assert.match(e.status, /2\/4/);
  assert.equal(e.imageUrls.length, 2);
  assert.ok(!e.waiting);
  assert.match(officeInfo('pauta', { adsDone: {}, adsBudgetN: 10000, adsDays: '4' }).status, /PAUSA/);
  assert.match(officeInfo('analitica', { data: { insights: { summary: { reach: 49, views: 154, likes: 9, comments: 0 } } } }).lines[0], /49/);
  assert.equal(officeInfo('taller', { campaign: { result: { assets: [{ id: 1, url: '/x.png' }] } } }).imageUrls.length, 1);
});
