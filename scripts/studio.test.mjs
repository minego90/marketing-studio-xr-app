import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStrategy,localStrategy,analyzeMetrics,campaignBrief,coachAdvice} from '../public/studio-domain.js';
import {analyzeStrategy} from '../lib/strategy.mjs';

test('La estrategia usa solo datos proporcionados y no inventa tasas cuando faltan denominadores',()=>{
 const s=normalizeStrategy({product:'Cactus tejido',metricsImpressions:'1000',metricsVisits:'50',metricsFollows:'5'}),p=localStrategy(s);
 assert.equal(p.metrics.visitRate,5);assert.equal(p.metrics.followRate,10);assert.equal(p.provider,'local');assert.equal(p.shotList.length,4);
 assert.equal(localStrategy(normalizeStrategy({})).metrics.followRate,null);
 assert.equal(analyzeMetrics(normalizeStrategy({metricsVisits:'0',metricsFollows:'5'})).followRate,null);
 assert.ok(analyzeMetrics(normalizeStrategy({metricsVisits:'2',metricsFollows:'8'})).warnings.length);
 for(const input of [{objective:'sell_everything'},{metricsVisits:'-1'},{metricsVisits:'1.5'},{audience:{inject:true}}])assert.throws(()=>normalizeStrategy(input));
 assert.match(campaignBrief(s,p),/Cactus tejido/);assert.match(campaignBrief(s,p),/dimensiones/);
});

test('El asistente no propone publicar ni generar de manera autónoma',()=>{
 assert.equal(coachAdvice({busy:true}).action,null);
 assert.notEqual(coachAdvice({page:'publish',confirm:true}).action,'publish');assert.notEqual(coachAdvice({page:'ads',adsWiz:3,adsPlan:{result:{}}}).action,'ads:send');
 assert.equal(coachAdvice({pendingCapture:{}}).action,'capture-save');
 assert.equal(coachAdvice({page:'capture',photos:{front:{},right:{},left:{},back:{}}}).action,'photos:done');
});

test('El análisis opcional de Spark conserva usage, exige estructura y no habilita búsqueda web',async()=>{
 const old=global.fetch,p=localStrategy({product:'Producto de prueba'});let requests=0;
 global.fetch=async(_url,opts)=>{requests++;const b=JSON.parse(opts.body);assert.equal(b.tools,undefined);assert.match(b.input,/No hay acceso a internet/);return new Response(JSON.stringify({id:'resp-test',status:'completed',model:'muse-spark-1.3',output_text:JSON.stringify(p),usage:{input_tokens:20,output_tokens:30}}));};
 try{const result=await analyzeStrategy({MODEL_API_KEY:'test'},{product:'Producto de prueba'});assert.equal(result.provider,'muse-spark');assert.equal(result.usage.output_tokens,30);assert.equal(requests,1);
 global.fetch=async()=>new Response(JSON.stringify({status:'completed',output_text:'{}'}));await assert.rejects(analyzeStrategy({MODEL_API_KEY:'test'},{product:'Producto de prueba'}),/incompleta/);
 }finally{global.fetch=old;}
});
