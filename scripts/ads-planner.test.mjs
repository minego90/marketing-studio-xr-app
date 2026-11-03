import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {validateAdsBrief,pushPausedAds} from '../lib/ads.mjs';import {planAds,localAdsPlan,validatePlan} from '../lib/ads-planner.mjs';
const b=validateAdsBrief({country:'CO',city:'Bogotá',radius:10,goal:'auto',dailyBudget:'',currency:'COP',days:3,selected:['a'],cta:'VIEW_INSTAGRAM_PROFILE'}),assets=[{id:'a',file:'a.jpg',title:'Producto y temática',headline:'Una propuesta única'}],context={title:'Navidad con cactus',product:'Cactus tejido',caption:'Este copy fue editado por el usuario.',profile:'danielmurcia.ia',strategy:{audience:'Adultos de Bogotá'}};
const plan={goal:'profile',audience:'Personas adultas de Bogotá interesadas en decoración creativa.',placements:'Instagram Feed; adaptar la pieza a 9:16 antes de Stories.',testPlan:'Comparar dos enfoques y revisar visitas al perfil y seguidores.',reasoning:'La imagen del cactus y el copy editado construyen una invitación al perfil.',copy:'Descubre el cactus de esta temporada y sigue nuestro perfil para más ideas.',schedule:'Probar tres días y revisar datos antes de ampliar la pauta.',budgetReasoning:'Presupuesto exploratorio estimativo, pendiente de aprobar y validar en Meta.',suggestedDailyBudget:5000,days:3,kpis:['Visitas al perfil','Seguidores obtenidos'],creativePlan:[{assetId:'a',angle:'El cactus protagonista y su luz cálida sirven como gancho de esta imagen.'}]};
test('Luma recibe imágenes reales, copy editado y contexto; no navega ni genera medios',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'luma-ads-'));await writeFile(join(dir,'a.jpg'),'mock-image');const old=global.fetch;let calls=0;
 global.fetch=async(url,opts)=>{calls++;assert.equal(url,'https://api.meta.ai/v1/responses');const body=JSON.parse(opts.body);assert.equal(body.tools,undefined);assert.equal(body.input[0].content.filter(c=>c.type==='input_image').length,1);assert.match(body.input[0].content[0].text,/Este copy fue editado/);assert.match(body.input[0].content[0].text,/Navidad con cactus/);return new Response(JSON.stringify({status:'completed',id:'response-id',usage:{input_tokens:200},output_text:JSON.stringify(plan)}));};
 try{const r=await planAds({MODEL_API_KEY:'mock'},b,context,assets,dir);assert.equal(calls,1);assert.equal(r.responseId,'response-id');assert.equal(r.usage.input_tokens,200);assert.equal(r.totalBudget,15000);assert.equal(r.grounded,false);assert.equal(r.destinationType,'instagram_profile');assert.equal(r.creativePlan[0].assetId,'a');}finally{global.fetch=old;await rm(dir,{recursive:true});}
});
test('Un presupuesto propuesto no puede superar el tope y no se aceptan piezas inventadas',()=>{
 assert.throws(()=>validatePlan(plan,{...b,dailyBudget:1000},assets),/tope/);assert.throws(()=>validatePlan({...plan,creativePlan:[{assetId:'otra',angle:'No pertenece al producto actual.'}]},b,assets),/imagen/);
 const local=localAdsPlan(b,context,assets);assert.equal(local.suggestedDailyBudget,null);assert.equal(local.copy,context.caption);assert.equal(local.provider,'local-demo');
});
test('Un borrador sin presupuesto confirmado no llama a Meta',async()=>{
 const old=global.fetch;global.fetch=()=>{throw Error('No debe llamar Meta');};
 try{await assert.rejects(pushPausedAds({ADS_ACCESS_TOKEN:'mock',ADS_ACCOUNT_ID:'123',ADS_PAGE_ID:'456',ADS_IG_ACTOR_ID:'789'},{brief:b,recommendation:plan},assets,'/tmp'),/presupuesto/);}finally{global.fetch=old;}
});

import { assertWithinCap, HARD_CAP_COP, spendCap, assertDraftSafe as _guard } from '../lib/ads.mjs';
import test2 from 'node:test';
import assert2 from 'node:assert/strict';
test2('tope de gasto: 100 mil COP duro, no se sube por .env, acumulado', () => {
  assert2.equal(HARD_CAP_COP, 100000);
  assert2.equal(spendCap({ ADS_MAX_TOTAL_COP: '999999999' }), 100000);
  assert2.equal(spendCap({ ADS_MAX_TOTAL_COP: '50000' }), 50000);
  assert2.doesNotThrow(() => assertWithinCap({ dailyBudget: 20000, days: 5, currency: 'COP' }, {}));
  assert2.throws(() => assertWithinCap({ dailyBudget: 20000, days: 6, currency: 'COP' }, {}), /Tope de seguridad/);
  assert2.throws(() => assertWithinCap({ dailyBudget: 20000, days: 3, currency: 'COP' }, {}, 60000), /comprometidos/);
  assert2.throws(() => assertWithinCap({ dailyBudget: 25, days: 3, currency: 'USD' }, {}), /Tope/);
  assert2.throws(() => _guard('act_1/campaigns', { name: 'x', status: 'PAUSED', spend_cap: 5000000 }), /spend_cap/);
  assert2.doesNotThrow(() => _guard('123', { spend_cap: 60000 }));
  assert2.throws(() => _guard('123', { status: 'ACTIVE' }));
});
