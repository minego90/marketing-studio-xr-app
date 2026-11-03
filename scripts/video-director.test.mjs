import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {directVideo,localVideoIdeas,validateVideoIdeas} from '../lib/video-director.mjs';
const url='https://www.instagram.com/reel/reference/',context={campaign:{title:'Campaña del cactus',product:'Cactus tejido'},assets:[{id:'chosen',file:'chosen.jpg'}],caption:'Copy aprobado',instruction:'Movimiento suave con hook visual',duration:5};
const hooks=Array.from({length:3},(_,i)=>({title:'Hook visual '+i,hook:'El cactus aparece bajo un cambio de luz sin cambiar su identidad.',storyboard:'0–1 s: luz inicial. 1–4 s: revelación suave. 4–5 s: producto completo.',prompt:JSON.stringify({duration_s:5,references:{'@image_1':'publicación'},shots:[{time:'0-2 s',action:'luz inicial',framing:'plano detalle',camera:'push-in',lens:'85 mm f/1.8',lighting:'cálida',sound:'whoosh suave'},{time:'2-5 s',action:'revelación',framing:'plano general',camera:'órbita',lens:'35 mm f/4',lighting:'contraluz',sound:'brillo final'}]}),copy:'Descubre esta campaña y sigue nuestro perfil para más ideas creativas.',sourceUrls:[url]}));
test('Director recibe solo las imágenes seleccionadas y devuelve tres hooks con fuentes y usage',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'video-director-'));await writeFile(join(dir,'chosen.jpg'),'mock');const old=global.fetch;
 global.fetch=async(_url,opts)=>{const b=JSON.parse(opts.body);assert.equal(b.tools[0].type,'web_search');assert.equal(b.input[0].content.filter(c=>c.type==='input_image').length,1);assert.match(b.input[0].content[0].text,/Copy aprobado/);assert.match(b.input[0].content[0].text,/Kling 4.0 Omni/);return new Response(JSON.stringify({status:'completed',id:'director-response',usage:{input_tokens:200},output:[{type:'web_search_call',status:'completed'},{type:'message',content:[{type:'output_text',text:JSON.stringify({hooks}),annotations:[{type:'url_citation',url,title:'Video de referencia'}]}]}]}));};
 try{const p=await directVideo({MODEL_API_KEY:'mock'},context,dir);assert.equal(p.hooks.length,3);assert.equal(p.grounded,true);assert.equal(p.sources[0].url,url);assert.equal(p.responseId,'director-response');assert.equal(p.usage.input_tokens,200);}finally{global.fetch=old;await rm(dir,{recursive:true});}
});
test('No se inventan tendencias si no hubo búsqueda ni se aceptan URLs inventadas',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'video-director-'));await writeFile(join(dir,'chosen.jpg'),'mock');const old=global.fetch;
 try{global.fetch=async()=>new Response(JSON.stringify({status:'completed',output_text:JSON.stringify({hooks}),output:[]}));await assert.rejects(directVideo({MODEL_API_KEY:'mock'},context,dir),/referencias web verificables/);const dropped=validateVideoIdeas({hooks:hooks.map(h=>({...h,sourceUrls:['https://inventado.example/',url]}))},[{url}]);assert.deepEqual(dropped[0].sourceUrls,[url]);const none=validateVideoIdeas({hooks:hooks.map(h=>({...h,sourceUrls:['https://inventado.example/']}))},[{url}]);assert.ok(none.every(h=>h.sourceUrls.length===0),'las URLs inventadas se descartan');const local=localVideoIdeas(context);assert.equal(local.grounded,false);assert.equal(local.hooks.length,3);assert.deepEqual(local.sources,[]);}finally{global.fetch=old;await rm(dir,{recursive:true});}
});

import {validateShotPrompt} from '../lib/video-director.mjs';
test('El prompt de video debe ser un plan por segundos (JSON con cámara, lente y luz)',()=>{
 assert.throws(()=>validateShotPrompt('Anima @image_1 con luz suave'),/JSON/);
 assert.throws(()=>validateShotPrompt(JSON.stringify({shots:[{time:'0-5 s',action:'x1',camera:'y1'}]})),/entre 2 y 8/);
 assert.throws(()=>validateShotPrompt(JSON.stringify({shots:[{time:'0-2 s',action:'aa',camera:'bb',lens:'cc'},{time:'2-5 s',action:'aa',camera:'bb',lens:'cc',lighting:'dd'}]})),/lighting/);
 const l=localVideoIdeas({campaign:{title:'X'},duration:10,instruction:'Que gire el frasco',sheet:true});
 assert.equal(l.hooks[0].title,'Tu idea mejorada');
 for(const h of l.hooks){const o=validateShotPrompt(h.prompt);assert.equal(o.duration_s,10);assert.ok(o.references['@image_2']);}
});
import { validateShotPrompt as vsp, shotPrompt as sp } from '../lib/video-director.mjs';
test('regla de 10 s: corte cada 2-3 s con encuadre, diafragma y sonido', () => {
  const ok = sp({ duration: 10, refs: { '@image_1': 'x' }, concept: 'c' });
  assert.equal(vsp(ok, 10).shots.length, 4);
  const o = JSON.parse(ok);
  const bad = f => JSON.stringify(f(structuredClone(o)));
  assert.throws(() => vsp(bad(x => { x.shots = x.shots.slice(0, 2); return x; }), 10), /4 o 5 planos/);
  assert.throws(() => vsp(bad(x => { x.shots[0].time = '0-6 s'; return x; }), 10), /entre 2 y 3 segundos/);
  assert.throws(() => vsp(bad(x => { delete x.shots[1].framing; return x; }), 10), /framing/);
  assert.throws(() => vsp(bad(x => { x.shots[2].lens = '50 mm'; return x; }), 10), /diafragma/);
  assert.throws(() => vsp(bad(x => { delete x.shots[3].sound; return x; }), 10), /sound/);
  assert.doesNotThrow(() => vsp(sp({ duration: 5, refs: {}, concept: 'c' }), 5));
});
import { localAdsPlan } from '../lib/ads-planner.mjs';
import { adsManagerCsv } from '../lib/ads-export.mjs';
test('pauta con video: plan local con Reels/Stories y CSV con Video File Name', () => {
  const assets = [{ id: 'video', kind: 'video', title: 'Hook', headline: 'Hook', file: 'v.mp4', duration: 5 }];
  const b = { goal: 'profile', city: 'Bogotá', country: 'CO', currency: 'COP', dailyBudget: 20000, days: 3 };
  const p = localAdsPlan(b, { pieceType: 'video', title: 'X' }, assets);
  assert.match(p.placements, /Reels/);
  assert.match(p.creativePlan[0].angle, /Video 5 s/);
  const csv = adsManagerCsv({ brief: b, recommendation: p, assets, caption: 'c' }, { pageId: '', instagramId: '' });
  assert.match(csv, /Video File Name/);
  assert.match(csv, /v\.mp4/);
  assert.match(csv, /Reels/);
});
