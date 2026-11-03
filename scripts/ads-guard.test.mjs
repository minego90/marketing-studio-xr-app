import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDraftSafe,adsGuardReport} from '../lib/ads.mjs';
import {promoteCard,adsManagerCsv} from '../lib/ads-export.mjs';

test('El guardián bloquea ACTIVE, rutas desconocidas y estados anidados',()=>{
 assert.ok(assertDraftSafe('act_1/campaigns',{name:'x',status:'PAUSED'}));
 assert.ok(assertDraftSafe('act_1/adsets',{status:'PAUSED',targeting:JSON.stringify({a:1})}));
 assert.ok(assertDraftSafe('act_1/adcreatives',{name:'c',object_story_spec:'{"link_data":{"message":"ACTIVE promo"}}'}));
 assert.ok(assertDraftSafe('123',{status:'PAUSED'}),'pausa de emergencia');
 assert.throws(()=>assertDraftSafe('act_1/campaigns',{status:'ACTIVE'}),/PAUSED|PAUSED/);
 assert.throws(()=>assertDraftSafe('act_1/ads',{name:'x'}),/PAUSED/,'sin status no se permite crear ads');
 assert.throws(()=>assertDraftSafe('act_1/ads',{status:'PAUSED',creative:JSON.stringify({effective_status:'ACTIVE'})}),/PAUSED/);
 assert.throws(()=>assertDraftSafe('123',{status:'ACTIVE'}),/no está permitida/,'no se puede activar un objeto existente');
 assert.throws(()=>assertDraftSafe('123',{daily_budget:99999}),/no está permitida/);
 assert.throws(()=>assertDraftSafe('act_1/campaigns/copies',{status:'PAUSED'}),/no está permitida/);
});

test('El informe del guardián refleja que por defecto no se envía nada',()=>{
 const g=adsGuardReport({});assert.equal(g.mode,'local-draft');assert.equal(g.writeEnabled,false);
 assert.match(adsGuardReport({ENABLE_META_ADS_WRITE:'true'}).label,/solo PAUSED/);
});

test('La ficha y el CSV nunca incluyen estados activos',()=>{
 const result={brief:{city:'Bogotá',country:'CO',currency:'COP',days:3,radius:10,campaignTheme:'Halloween',goal:'profile'},recommendation:{objective:'OUTCOME_TRAFFIC',goal:'profile',audience:'Adultos 24-40',suggestedDailyBudget:25000,days:3,copy:'Hola, mira, esto "es" nuevo',kpis:['Visitas'],creativePlan:[{angle:'Detalle'}]},assets:[{headline:'Noche',file:'a.jpg'}]};
 const card=promoteCard(result);assert.equal(card.screens.length,4);assert.match(card.warning,/NO envía/);
 const csv=adsManagerCsv(result);assert.ok(!/active/i.test(csv.replace(/Campaign Status|Ad Status/g,'')));assert.match(csv,/Paused/);assert.match(csv,/""es""/);
});
