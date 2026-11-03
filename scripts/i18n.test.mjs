import test from 'node:test';
import assert from 'node:assert/strict';
import { EN } from '../public/i18n-en.js';
import { tr, setLang, getLang } from '../public/i18n.js';
import { meta, langStore } from '../lib/providers.mjs';

test('modo inglés: diccionario exacto, plantillas, fechas, mayúsculas y símbolos', () => {
  setLang('en');
  assert.equal(getLang(), 'en');
  assert.equal(tr('Siguiente'), 'Next');
  assert.equal(tr('Foto 2 de 4 · Izquierda'), 'Photo 2 of 4 · Left');
  assert.equal(tr('Black Friday · 27 nov · en 24días'), 'Black Friday · Nov 27 · in 24 days');
  assert.equal(tr('ATRÁS'), 'BACK');
  assert.equal(tr('○ Revisar conexión'), '○ Check connection');
  assert.equal(tr('Presupuesto: 20.000 COP por día · 3 días'), 'Budget: 20.000 COP per day · 3 days');
  assert.equal(tr('Texto que no existe en el diccionario'), 'Texto que no existe en el diccionario');
  setLang('es');
  assert.equal(tr('Siguiente'), 'Siguiente');
});
test('el diccionario conserva los {} de cada plantilla', () => {
  for (const [k, v] of Object.entries(EN)) assert.equal(k.split('{}').length, v.split('{}').length, k);
});
test('Luma recibe la instrucción de escribir en inglés solo en modo inglés', async () => {
  const old = global.fetch;
  const bodies = [];
  global.fetch = async (_u, o) => (bodies.push(JSON.parse(o.body)), new Response(JSON.stringify({ status: 'completed', output_text: '{}' })));
  try {
    const input = [{ role: 'user', content: [{ type: 'input_text', text: 'hola' }] }];
    await langStore.run({ lang: 'en' }, () => meta({ MODEL_API_KEY: 'x' }, { model: 'm', input }));
    await langStore.run({ lang: 'es' }, () => meta({ MODEL_API_KEY: 'x' }, { model: 'm', input }));
    assert.match(JSON.stringify(bodies[0]), /LANGUAGE: the interface is in English/);
    assert.doesNotMatch(JSON.stringify(bodies[1]), /LANGUAGE:/);
  } finally {
    global.fetch = old;
  }
});
