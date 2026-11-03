import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrchestra } from '../public/orchestra.js';
test('un mensaje a la vez entre personajes', () => {
  const timers = [];
  const o = createOrchestra({ setTimer: (f) => timers.push(f) && timers.length, clearTimer() {}, gapMs: 1 });
  const shown = [];
  for (const id of ['luma', 'estudio']) o.register(id, { show: t => shown.push(id + ':' + t), hide() {} });
  o.say('estudio', 'Foto guardada · 1/4'); o.say('luma', 'Hola');
  assert.deepEqual(shown, ['estudio:Foto guardada · 1/4']);
  timers.shift()(); timers.shift()();
  assert.deepEqual(shown, ['estudio:Foto guardada · 1/4', 'luma:Hola']);
});
