import test from 'node:test';
import assert from 'node:assert/strict';
import {loadAgentKit,skillContext,reviewCampaign,askLuma} from '../lib/agent.mjs';

test('El kit de agentes carga roles y skills coherentes',async()=>{
 const kit=await loadAgentKit();assert.ok(kit.roles.roles.length>=9);assert.ok(Object.keys(kit.skills).length>=7);
 for(const p of kit.roles.pipeline)assert.ok(kit.roles.roles.some(r=>r.id===p.agent),'pipeline→rol '+p.agent);
 for(const r of kit.roles.roles)for(const h of r.handoff)assert.ok(kit.roles.roles.some(x=>x.id===h),'handoff '+h);
 assert.ok(kit.roles.roles.find(r=>r.id==='guardian'));
});
test('skillContext incluye principios y acota el tamaño',async()=>{
 const c=await skillContext('media-buyer',{maxChars:1500});assert.match(c,/PRINCIPIOS/);assert.ok(c.length<=1500);
 await assert.rejects(skillContext('no-existe'));
});
test('El revisor detecta promesas, precios y titulares malos; y da luz verde a un copy sano',()=>{
 const bad=reviewCampaign({caption:'EL MEJOR producto GARANTIZADO 100% con descuento #a #b #c #d #e #f',headlines:['Uno','Uno','Esta frase tiene muchas más palabras de las permitidas aquí']});
 assert.equal(bad.verdict,'corregir');for(const r of ['copy.promesa','copy.precio','copy.hashtags','titular.repetido','titular.largo'])assert.ok(bad.findings.some(x=>x.rule===r),r);
 const ok=reviewCampaign({caption:'Una noche distinta empieza aquí. Visita el perfil y descubre la colección. #halloween #bogotá #arte',headlines:['Una noche distinta','Entre luz y sombra'],photos:{front:1,right:1,left:1,back:1}});
 assert.ok(ok.findings.every(x=>x.severity!=='error'));assert.ok(ok.score>=90);
});
test('El revisor señala público sensible y objetos remotos no pausados',()=>{
 const r=reviewCampaign({caption:'Hola. Visita el perfil #a',ads:{recommendation:{objective:'OUTCOME_TRAFFIC',audience:'personas de cierta religión',suggestedDailyBudget:20000,days:3},remote:{status:'ACTIVE'}}});
 assert.ok(r.findings.some(x=>x.rule==='pauta.sensible'));assert.ok(r.findings.some(x=>x.rule==='pauta.activa'));
});
test('Luma responde preguntas desde las skills sin costo',async()=>{
 const a=await askLuma('¿cómo mejoro la luz?');assert.equal(a.cost,0);assert.equal(a.skill,'fotografia-producto');assert.ok(a.answer.length>40);
});
