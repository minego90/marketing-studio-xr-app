import test from 'node:test';
import assert from 'node:assert/strict';
import { falInput, promptFromPlan, submitFal, readFal } from '../lib/fal.mjs';
const plan = JSON.stringify({ duration_s: 5, concept: 'Revelación', references: { '@image_1': 'hoja', '@image_2': 'publicación' }, shots: [{ time: '0-2 s', action: 'detalle', camera: 'push-in', lens: '50 mm', lighting: 'cálida', transition: 'corte' }, { time: '2-5 s', action: 'revela', camera: 'órbita', lens: '35 mm', lighting: 'contraluz', transition: 'ninguna' }], product_consistency: 'No cambiar etiqueta', avoid: ['texto'] });
const s = { duration: 5, orientation: 'vertical', prompt: plan, style: 'reveal' };
test('entrada de fal: 720p vertical, referencias @ImageN y plan por segundos', () => {
  const i = falInput(s, ['https://a.example/sheet.jpg', 'https://a.example/post.jpg'], { sheet: true });
  assert.equal(i.resolution, '720p'); assert.equal(i.aspect_ratio, '9:16'); assert.equal(i.duration, 5);
  assert.equal(i.image_urls.length, 2);
  assert.match(i.prompt, /@Image1/); assert.doesNotMatch(i.prompt, /@image_/);
  assert.match(i.prompt, /PLANO 1 \(0-2 s\): lente 50 mm, push-in\. Acción: detalle\./);
  assert.equal(i.generate_audio, undefined);
  assert.throws(() => falInput({ ...s, orientation: 'horizontal' }, ['https://a.example/a.jpg']), /vertical/);
  assert.throws(() => falInput({ ...s, duration: 7 }, ['https://a.example/a.jpg']), /5 o 10/);
  assert.throws(() => falInput(s, ['http://localhost/a.jpg']), /HTTPS/);
  assert.equal(promptFromPlan('texto libre con @image_1'), 'texto libre con @Image1');
});
test('cola de fal: envío, estado y resultado; la clave no se filtra', async () => {
  const old = global.fetch, calls = [], env = { FAL_KEY: 'fal_clave_ficticia_no_usar' };
  global.fetch = async (url, o = {}) => {
    calls.push({ url: String(url), auth: o.headers?.Authorization, method: o.method || 'GET' });
    if (String(url).endsWith('/kling/v4/reference-to-video')) return new Response(JSON.stringify({ request_id: 'r1', status_url: 'https://queue.fal.run/kling/v4/requests/r1/status', response_url: 'https://queue.fal.run/kling/v4/requests/r1' }));
    if (String(url).endsWith('/status')) return new Response(JSON.stringify({ status: calls.filter(c => c.url.endsWith('/status')).length > 1 ? 'COMPLETED' : 'IN_PROGRESS' }));
    return new Response(JSON.stringify({ video: { url: 'https://v3b.fal.media/f.mp4' } }));
  };
  try {
    const sub = await submitFal(env, { prompt: 'x' });
    assert.equal(sub.id, 'r1'); assert.equal(calls[0].auth, 'Key fal_clave_ficticia_no_usar');
    assert.equal((await readFal(env, sub)).status, 'procesando');
    const done = await readFal(env, sub);
    assert.equal(done.status, 'succeeded'); assert.equal(done.url, 'https://v3b.fal.media/f.mp4');
    global.fetch = async () => new Response(JSON.stringify({ detail: 'Exhausted balance fal_clave_ficticia_no_usar' }), { status: 403 });
    await assert.rejects(submitFal(env, { prompt: 'x' }), e => /Exhausted balance/.test(e.message) && !e.message.includes('fal_clave_ficticia_no_usar'));
    await assert.rejects(submitFal({}, {}), /FAL_KEY/);
  } finally { global.fetch = old; }
});
import { FLUX_MODEL, falModel } from '../lib/fal.mjs';
test('FLUX 3 Max: una sola imagen, 720p vertical, sin hoja ni @ImageN, duración como texto', async () => {
  assert.equal(falModel().id, 'seedance'); assert.equal(falModel('flux').id, 'flux'); assert.equal(falModel('kling').id, 'kling'); assert.equal(FLUX_MODEL.sheet, false);
  const i = falInput(s, ['https://a.example/post.jpg'], { model: FLUX_MODEL });
  assert.equal(i.image_url, 'https://a.example/post.jpg'); assert.equal(i.image_urls, undefined);
  assert.strictEqual(i.duration, 5); assert.equal(i.resolution, '720p'); assert.equal(i.aspect_ratio, '9:16'); assert.equal(i.generate_audio, true);
  assert.doesNotMatch(i.prompt, /@Image|@image_|Referencias →/); assert.match(i.prompt, /PLANO 1 \(0-2 s\).*Acción: detalle/);
  assert.throws(() => falInput(s, ['https://a.example/a.jpg', 'https://a.example/b.jpg'], { model: FLUX_MODEL }), /una sola imagen/);
  assert.throws(() => falInput(s, ['http://x/a.jpg'], { model: FLUX_MODEL }), /HTTPS/);
  assert.throws(() => falInput({ ...s, duration: 7 }, ['https://a.example/a.jpg'], { model: FLUX_MODEL }), /5 o 10/);
  const old = global.fetch, urls = [];
  global.fetch = async u => { urls.push(String(u)); return new Response(JSON.stringify({ request_id: 'f1', status_url: 'https://queue.fal.run/blackforestlabs/flux-3-max/requests/f1/status', response_url: 'https://queue.fal.run/blackforestlabs/flux-3-max/requests/f1' })); };
  try { const sub = await submitFal({ FAL_KEY: 'k' }, i, FLUX_MODEL.endpoint); assert.equal(sub.id, 'f1'); assert.equal(urls[0], 'https://queue.fal.run/blackforestlabs/flux-3-max/image-to-video'); } finally { global.fetch = old; }
});
test('el audio del plan (música, efectos por plano) llega al prompt y FLUX genera con audio', () => {
  const withAudio = JSON.stringify({ duration_s: 5, concept: 'x', audio: { music: 'synthwave medio', sfx: 'whoosh y brillos', voice: 'sin voz hablada' }, shots: [{ time: '0-2 s', action: 'a', camera: 'c', lens: 'l', lighting: 'z', sound: 'whoosh de entrada' }, { time: '2-5 s', action: 'b', camera: 'c', lens: 'l', lighting: 'z' }] });
  const i = falInput({ ...s, prompt: withAudio }, ['https://a.example/p.jpg'], { model: FLUX_MODEL });
  assert.equal(i.generate_audio, true);
  assert.match(i.prompt, /Audio: whoosh de entrada/); assert.match(i.prompt, /Audio: música synthwave medio\. Efectos: whoosh y brillos\. sin voz hablada/);
  assert.match(i.prompt, /música de fondo y efectos de sonido/);
});

import { SEEDANCE_MODEL } from '../lib/fal.mjs';
test('Seedance 2.5 480p: una imagen, duración como texto, aspecto automático, con audio', () => {
  assert.equal(SEEDANCE_MODEL.endpoint, 'bytedance/seedance-2.5/image-to-video');
  const i = falInput(s, ['https://a.example/post.jpg'], { model: SEEDANCE_MODEL });
  assert.equal(i.image_url, 'https://a.example/post.jpg'); assert.strictEqual(i.duration, '5'); assert.equal(i.resolution, '480p'); assert.equal(i.aspect_ratio, 'auto'); assert.equal(i.generate_audio, true);
  assert.equal(falInput({ ...s, duration: 10 }, ['https://a.example/post.jpg'], { model: SEEDANCE_MODEL }).duration, '10');
  assert.doesNotMatch(i.prompt, /@Image|@image_/);
  assert.throws(() => falInput(s, ['https://a.example/a.jpg', 'https://a.example/b.jpg'], { model: SEEDANCE_MODEL }), /una sola imagen/);
});
