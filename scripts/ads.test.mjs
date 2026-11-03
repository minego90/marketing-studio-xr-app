import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {validateAdsBrief,researchAds,pushPausedAds} from '../lib/ads.mjs';

const brief={country:'CO',city:'Bogotá',radius:10,goal:'auto',destination:'https://aumentadosco.com/producto',dailyBudget:10000,currency:'COP',days:7,cta:'LEARN_MORE',audience:'Personas adultas interesadas en el producto',campaignTheme:'Halloween',selected:['one']};
const env={ADS_ACCESS_TOKEN:'mock',ADS_ACCOUNT_ID:'123',ADS_PAGE_ID:'456',ADS_IG_ACTOR_ID:'789',MODEL_API_KEY:'mock',ADS_LEDGER_FILE:join(tmpdir(),'ads-ledger-test-'+process.pid+'-'+Date.now()+'.json')};

test('La pauta valida ubicación, moneda y topes; no exige web ni presupuesto para planificar',()=>{
 assert.equal(validateAdsBrief(brief).city,'Bogotá');const profile=validateAdsBrief({...brief,destination:'',dailyBudget:''});assert.equal(profile.destinationType,'instagram_profile');assert.equal(profile.dailyBudget,null);assert.equal(profile.cta,'VIEW_INSTAGRAM_PROFILE');assert.throws(()=>validateAdsBrief({...brief,goal:'traffic',destination:''}));
 for(const change of [{destination:'http://localhost:8844'},{dailyBudget:-1},{dailyBudget:0},{currency:'EUR'},{city:''},{radius:100},{goal:'sales'},{selected:[]}])assert.throws(()=>validateAdsBrief({...brief,...change}));
});

test('Muse Spark no puede llamar investigación web a una respuesta sin búsqueda y citas',async()=>{
 const old=global.fetch;global.fetch=async()=>new Response(JSON.stringify({status:'completed',output_text:'{}',output:[]}));
 try{await assert.rejects(researchAds(env,brief,'producto de ejemplo'),/no devolvió investigación web/);}finally{global.fetch=old;}
});

test('La propuesta investigada conserva fuentes reales de la respuesta de Spark',async()=>{
 const old=global.fetch,body={objective:'OUTCOME_TRAFFIC',audience:'Público adulto en la ciudad indicada, sin intereses inventados.',placements:'Instagram Feed con fotografías verticales y pruebas separadas.',testPlan:'Comparar clics y calidad de visita de dos piezas, luego ajustar.',reasoning:'Hipótesis basada en recomendaciones públicas, sin datos de resultados propios.',copy:'Conoce el producto de esta temporada en nuestra página.'};
 global.fetch=async(_url,opts)=>{assert.equal(JSON.parse(opts.body).tools[0].type,'web_search');return new Response(JSON.stringify({status:'completed',output:[{type:'web_search_call',status:'completed'},{type:'message',content:[{type:'output_text',text:JSON.stringify(body),annotations:[{type:'url_citation',url:'https://www.facebook.com/business/ads',title:'Meta Ads'}]}]}]}));};
 try{const r=await researchAds(env,brief,'producto de ejemplo');assert.equal(r.grounded,true);assert.equal(r.sources[0].url,'https://www.facebook.com/business/ads');}finally{global.fetch=old;}
});

test('Meta Ads recibe campaña, conjunto y anuncio PAUSED; ubicación ambigua impide subir',async()=>{
 const old=global.fetch,dir=await mkdtemp(join(tmpdir(),'ads-test-')),calls=[];await writeFile(join(dir,'one.jpg'),'mock-image');
 global.fetch=async(url,opts={})=>{
  const u=new URL(url),body=opts.body?Object.fromEntries(opts.body):{};calls.push({url:u.pathname,body});
  if(u.pathname.endsWith('/act_123'))return new Response(JSON.stringify({currency:'COP',account_id:'123'}));
  if(u.pathname.endsWith('/search'))return new Response(JSON.stringify({data:[{type:'city',country_code:'CO',name:'Bogotá',key:'999'}]}));
  if(u.pathname.endsWith('/campaigns'))return new Response(JSON.stringify({id:'100'}));
  if(u.pathname.endsWith('/adsets'))return new Response(JSON.stringify({id:'200'}));
  if(u.pathname.endsWith('/adimages'))return new Response(JSON.stringify({images:{'one.jpg':{hash:'hash-one'}}}));
  if(u.pathname.endsWith('/adcreatives'))return new Response(JSON.stringify({id:'300'}));
  if(u.pathname.endsWith('/ads'))return new Response(JSON.stringify({id:'400'}));
  if(/\/\d+$/.test(u.pathname)&&!opts.body)return new Response(JSON.stringify({id:u.pathname.split('/').pop(),status:'PAUSED'}));
  throw Error('unexpected request');
 };
 try{
  const r=await pushPausedAds(env,{brief,recommendation:{objective:'OUTCOME_TRAFFIC',copy:'Conoce el producto de la campaña con una propuesta especial.'}},[{file:'one.jpg',headline:'Una noche distinta'}],dir);
  assert.equal(r.status,'PAUSED');assert.deepEqual(r.ads,['400']);
  for(const path of ['/campaigns','/adsets','/ads'])assert.equal(calls.find(x=>x.url.endsWith(path)).body.status,'PAUSED');
  const adsetBody=calls.find(x=>x.url.endsWith('/adsets')).body;
  assert.equal(adsetBody.daily_budget,'10000','COP usa pesos enteros: no multiplicar el presupuesto por 100');
  assert.equal((Date.parse(adsetBody.end_time)-Date.parse(adsetBody.start_time))/86400000,7);
  assert.equal(JSON.parse(calls.find(x=>x.url.endsWith('/adsets')).body.targeting).geo_locations.cities[0].key,'999');
  assert.equal(JSON.parse(calls.find(x=>x.url.endsWith('/adcreatives')).body.object_story_spec).link_data.image_hash,'hash-one');
  assert.equal(JSON.parse(calls.find(x=>x.url.endsWith('/adcreatives')).body.object_story_spec).instagram_user_id,'789');
  calls.length=0;await pushPausedAds({...env,ADS_LEDGER_FILE:env.ADS_LEDGER_FILE+'2'},{brief:{...brief,goal:'awareness'},recommendation:{objective:'OUTCOME_AWARENESS',copy:'Conoce la propuesta de esta campaña.'}},[{file:'one.jpg'}],dir);
  assert.equal(calls.find(x=>x.url.endsWith('/campaigns')).body.objective,'OUTCOME_AWARENESS');
  assert.equal(calls.find(x=>x.url.endsWith('/adsets')).body.optimization_goal,'REACH');
  calls.length=0;global.fetch=async(url)=>new Response(JSON.stringify(new URL(url).pathname.endsWith('/search')?{data:[]}:{currency:'COP'}));
  await assert.rejects(pushPausedAds({...env,ADS_LEDGER_FILE:env.ADS_LEDGER_FILE+'3'},{brief,recommendation:{objective:'OUTCOME_TRAFFIC',copy:'Texto'}},[{file:'one.jpg'}],dir),/No se identificó/);
  assert.equal(calls.length,0);
 }finally{global.fetch=old;await rm(dir,{recursive:true});}
});
test('Pauta con video: sube portada y video, crea creativo video_data y anuncio PAUSED; sin spend_cap si el tope es menor al mínimo de Meta',async()=>{
 const old=global.fetch,dir=await mkdtemp(join(tmpdir(),'ads-vid-')),calls=[];await writeFile(join(dir,'thumb.jpg'),'mock-thumb');
 global.fetch=async(url,opts={})=>{
  const u=new URL(url),body=opts.body?Object.fromEntries(opts.body):{};calls.push({url:u.pathname,body});
  if(u.pathname.endsWith('/act_123'))return new Response(JSON.stringify({currency:'COP',account_id:'123'}));
  if(u.pathname.endsWith('/search'))return new Response(JSON.stringify({data:[{type:'city',country_code:'CO',name:'Bogotá',key:'999'}]}));
  if(u.pathname.endsWith('/campaigns'))return new Response(JSON.stringify({id:'100'}));
  if(u.pathname.endsWith('/adsets'))return new Response(JSON.stringify({id:'200'}));
  if(u.pathname.endsWith('/adimages'))return new Response(JSON.stringify({images:{x:{hash:'hash-thumb'}}}));
  if(u.pathname.endsWith('/advideos'))return new Response(JSON.stringify({id:'555'}));
  if(u.pathname.endsWith('/555'))return new Response(JSON.stringify({id:'555',status:{video_status:'ready'}}));
  if(u.pathname.endsWith('/adcreatives'))return new Response(JSON.stringify({id:'300'}));
  if(u.pathname.endsWith('/ads'))return new Response(JSON.stringify({id:'400'}));
  if(/\/\d+$/.test(u.pathname)&&!opts.body)return new Response(JSON.stringify({id:u.pathname.split('/').pop(),status:'PAUSED'}));
  throw Error('unexpected request '+u.pathname);
 };
 try{
  const env2={...env,ADS_LEDGER_FILE:join(dir,'ledger.json'),ADS_VIDEO_POLL_MS:'1'};
  const r=await pushPausedAds(env2,{brief,sourceContext:{profile:'cuenta.ia'},recommendation:{objective:'OUTCOME_TRAFFIC',copy:'Mira este video con una propuesta especial.'}},[{kind:'video',file:'v.mp4',headline:'Hook',publicUrl:'https://x.example/media/v.mp4?sig=1',thumbFile:'thumb.jpg'}],dir);
  assert.equal(r.status,'PAUSED');assert.equal(r.videoId,'555');
  const camp=calls.find(x=>x.url.endsWith('/campaigns')).body;assert.equal(camp.spend_cap,undefined);assert.equal(camp.status,'PAUSED');
  assert.equal(calls.find(x=>x.url.endsWith('/advideos')).body.file_url,'https://x.example/media/v.mp4?sig=1');
  const cr=JSON.parse(calls.find(x=>x.url.endsWith('/adcreatives')).body.object_story_spec);assert.equal(cr.video_data.video_id,'555');assert.equal(cr.video_data.image_hash,'hash-thumb');
  assert.match(calls.find(x=>x.url.endsWith('/adsets')).body.targeting,/reels/);
  assert.equal(calls.find(x=>x.url.endsWith('/ads')).body.status,'PAUSED');
 }finally{global.fetch=old}
});
