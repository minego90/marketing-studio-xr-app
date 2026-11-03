import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrchestra } from '../public/orchestra.js';

// Reloj falso para probar sin esperar.
function fakeClock() {
  let now = 0, id = 0, jobs = [];
  return {
    setTimer: (fn, ms) => (jobs.push({ id: ++id, at: now + ms, fn }), id),
    clearTimer: i => (jobs = jobs.filter(j => j.id !== i)),
    advance(ms) { const end = now + ms; for (;;) { jobs.sort((a, b) => a.at - b.at); const j = jobs[0]; if (!j || j.at > end) break; jobs.shift(); now = j.at; j.fn(); } now = end; }
  };
}
const mk = () => {
  const c = fakeClock(), log = [], o = createOrchestra({ ...c });
  for (const id of ['luma', 'estudio', 'pauta']) o.register(id, { show: (t) => log.push('+' + id + ':' + t), hide: () => log.push('-' + id) });
  return { c, log, o };
};

test('un solo mensaje a la vez y en orden', () => {
  const { c, log, o } = mk();
  o.say('estudio', 'Foto guardada'); o.say('luma', 'Analizando'); o.say('pauta', 'Borrador listo');
  assert.deepEqual(log, ['+estudio:Foto guardada']);
  assert.equal(o.status().waiting.length, 2);
  c.advance(2300 + 400); // termina el primero + pausa
  assert.deepEqual(log.slice(1, 3), ['-estudio', '+luma:Analizando']);
  c.advance(10000);
  assert.equal(log.filter(x => x[0] === '+').length, 3);
  // nunca dos visibles a la vez: entre cada + y el siguiente hubo un -
  let open = 0; for (const x of log) { open += x[0] === '+' ? 1 : -1; assert.ok(open <= 1); }
});
test('no repite mensajes iguales y los errores pasan al frente', () => {
  const { c, log, o } = mk();
  o.say('luma', 'A'); assert.equal(o.say('luma', 'A'), false);
  o.say('estudio', 'B'); o.say('estudio', 'B');
  o.say('pauta', 'Falló algo', { priority: true });
  assert.deepEqual(o.status().waiting.map(m => m.text), ['Falló algo', 'B']);
  c.advance(20000);
  assert.ok(log.indexOf('+pauta:Falló algo') < log.indexOf('+estudio:B'));
});
test('hablante no registrado no habla y la cola no crece sin límite', () => {
  const { o } = mk();
  assert.equal(o.say('fantasma', 'hola'), false);
  o.say('luma', '0'); for (let i = 1; i < 12; i++) o.say('estudio', 'm' + i);
  assert.ok(o.status().waiting.length <= 4);
});
