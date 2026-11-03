import {localVideoIdeas} from '../lib/video-director.mjs';
import {localAdsPlan} from '../lib/ads-planner.mjs';
import {validateAdsBrief} from '../lib/ads.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {localStrategy,STRATEGY_DEFAULTS} from '../public/studio-domain.js';

// Runs actual application actions with a deterministic camera/DOM adapter.
// No browser, provider or account is contacted by this test.
const gradient={addColorStop(){}};
const context=()=>new Proxy({measureText:t=>({width:String(t).length*11}),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
const elements=new Map();
function element(){return {width:1400,height:1060,style:{},value:'',children:[],classList:{contains:()=>false,add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},getContext:()=>context(),getBoundingClientRect:()=>({left:0,top:0,width:1400,height:1060}),replaceChildren(){this.children=[];},append(x){this.children.push(x);},click(){},removeAttribute(){},toDataURL:()=> 'data:image/jpeg;base64,dGVzdA=='};}
for(const id of ['board','preview','cameraHud','cameraHudBackdrop','camera','film','notice','modeLabel','modeDescription','accessibleActions','brief','caption','uploadPhoto','file','download','recenter','connection','enterXR','xrStatus','prepareStrategy','askSpark',...Object.keys(STRATEGY_DEFAULTS).map(k=>'strategy'+k[0].toUpperCase()+k.slice(1))])elements.set('#'+id,element());
Object.assign(elements.get('#camera'),{videoWidth:1280,videoHeight:720,readyState:2,play:async()=>{}});
Object.assign(elements.get('#film'),{paused:true,pause(){},play:async()=>{}});
global.document={querySelector:s=>elements.get(s)||null,querySelectorAll:()=>[],createElement:()=>element(),activeElement:null,body:element()};
global.window={isSecureContext:false,matchMedia:()=>({matches:true}),addEventListener(){},dispatchEvent(){},open(){}};
global.requestAnimationFrame=()=>0;
Object.defineProperty(global,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>({getVideoTracks:()=>[{label:'test camera',getSettings:()=>({deviceId:'one'})}],getTracks:()=>[{stop(){}}]})}}});
global.Image=class{constructor(){this.complete=true;this.naturalWidth=640;this.naturalHeight=800;this.width=640;this.height=800;}set src(v){this.url=v;}get src(){return this.url;}};
const calls=[],photos={front:null,right:null,left:null,back:null};
global.fetch=async(url,options={})=>{
 assert.match(String(url),/^\/api\//,'El test no puede llamar proveedores externos');
 const path=String(url).slice(5),b=options.body?JSON.parse(options.body):null;calls.push({path,b});let data;
 if(path==='config')data={paidEnabled:false,meta:false,ads:true,adsWriteEnabled:false};
 else if(path==='connections')data={instagram:{valid:true,username:'test'},ads:{valid:true}};
 else if(path==='jobs')data=[];
 else if(path==='strategy')data=b?{brief:b.brief,plan:localStrategy(b.brief)}:{brief:STRATEGY_DEFAULTS,plan:null};
 else if(path==='photos'){if(b)photos[b.slot]=b.remove?null:{file:b.file,url:'/media/'+b.file};data={...photos};}
 else if(path==='upload')data={file:'test.jpg',url:'/media/test.jpg'};
 else if(path==='ads/plan'){const brief=validateAdsBrief(b);const assets=b.selected.map(id=>({id,title:'Producto seleccionado',url:'/media/test.jpg'}));data={id:'local-ads-test',mode:'demo',status:'completed',result:{brief,recommendation:localAdsPlan(brief,{caption:b.caption,title:'Campaña'},assets),caption:b.caption,assets,remote:null}};}
 else if(path==='video/plan')data={id:'video-plan-test',status:'completed',mode:'demo',result:{...localVideoIdeas({campaign:{title:'Producto'},caption:b.caption,duration:b.duration}),selected:b.selected,duration:b.duration}};
 else if(path==='publish')data={status:'completed',result:{simulated:true,message:'Simulación completada'}};
 else throw Error('Unexpected endpoint '+path);
 return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
};
const {state,action,draw,hitAt}=await import('../public/app.js');

test('Recorrido real de acciones: estrategia → captura revisada → orden y publicación simulada',async()=>{
 assert.equal(state.page,'guide','El flujo empieza en la guía paso a paso');await action('nav:capture');await action('nav:strategy');state.strategyProduct='Cactus de prueba';
 await action('strategy:local');assert.equal(state.strategyPlan.provider,'local');
 await action('strategy:continue');assert.equal(state.page,'brief','Aprobada la idea se pasa a crear las imágenes');assert.match(state.brief,/Cactus de prueba/);await action('nav:capture');
 state.captureTimer=1;const interrupted=action('capture');await action('nav:strategy');await interrupted;assert.equal(state.pendingCapture,null,'Salir de captura cancela la foto pendiente');await action('nav:capture');
 state.captureTimer=0;
 const before=calls.filter(x=>x.path==='upload').length;
 await action('capture');assert.equal(state.pendingCapture.slot,'front');assert.equal(calls.filter(x=>x.path==='upload').length,before,'Capturar no guarda automáticamente');
 await action('capture-retake');assert.equal(state.pendingCapture,null);assert.equal(photos.front,null);
 await action('capture');await action('capture-save');assert.ok(photos.front);assert.equal(state.captureSlot,'right');assert.equal(state.pendingCapture,null);
 await action('capture');await action('capture-save');assert.ok(photos.right);assert.equal(state.captureSlot,'left');
 await action('camera-hud');assert.equal(state.hudVisible,true);assert.equal(state.hudChoice,true,'Con fotos ya tomadas pregunta: usar o borrar');draw();assert.equal(hitAt('camera',500,580).id,'hud-keep');await action('hud-keep');assert.equal(state.hudChoice,false);draw();assert.equal(hitAt('camera',500,580).drag,true);assert.equal(hitAt('camera',600,950).id,'hud-shutter');await action('capture-timer');assert.equal(state.captureTimer,3);
 const originalNow=performance.now.bind(performance);let clock=originalNow();Object.defineProperty(performance,'now',{value:()=>clock,configurable:true});
 try{clock+=1000;const pendingHud=action('hud-shutter');assert.equal(state.captureCountdown,3);assert.equal(photos.left,null,'La foto no se guarda antes del conteo');draw();assert.equal(hitAt('camera',90,80).drag,true,'El asa permite mover la cámara');await pendingHud;assert.ok(photos.left);clock+=1000;await action('hud-shutter');assert.ok(photos.back);
 const fullUploads=calls.filter(x=>x.path==='upload').length;clock+=1000;await action('hud-shutter');assert.equal(calls.filter(x=>x.path==='upload').length,fullUploads,'Cuatro espacios llenos no permiten sobrescritura automática');
 await action('hud-view:right');assert.equal(state.hudReviewSlot,'right');await action('hud-delete:right');assert.equal(photos.right,null);clock+=1000;await action('hud-shutter');assert.ok(photos.right);draw();assert.ok(hitAt('camera',30+238+180,160).id.startsWith('hud-delete:'));await action('camera-hud');assert.equal(state.hudVisible,false,'El botón del menú cierra la cámara abierta');await action('camera-hud');assert.equal(state.hudVisible,true);clock+=1000;await action('hud-delete:left');const uploadsBeforeCancel=calls.filter(x=>x.path==='upload').length;const cancelled=action('hud-shutter');assert.equal(state.captureCountdown,3);await action('hud-close');await cancelled;assert.equal(state.hudVisible,false);assert.equal(state.captureCountdown,0);assert.equal(calls.filter(x=>x.path==='upload').length,uploadsBeforeCancel,'Cerrar la cámara cancela el temporizador sin guardar');await action('camera-hud');await action('capture-timer');assert.equal(state.captureTimer,0);clock+=1000;await action('hud-shutter');assert.ok(photos.left,'El conteo desactivado permite tomar foto inmediata');assert.equal(state.captureCountdown,0);await action('hud-close');
 }finally{Object.defineProperty(performance,'now',{value:originalNow,configurable:true});}
 state.mode='demo';state.campaign={id:'campaign-test',result:{assets:[{id:'a',url:'/a.jpg',title:'A'},{id:'b',url:'/b.jpg',title:'B'}]}};state.selected=['a','b'];
 await action('nav:publish');await action('publish-move:right');assert.deepEqual(state.selected,['b','a']);draw();assert.equal(hitAt('main',600,910).id,'confirm-publish');
 await action('confirm-publish');assert.equal(state.confirm,true);await action('publish');
 assert.deepEqual(calls.find(x=>x.path==='publish').b.selected,['b','a']);assert.equal(state.publishReceipt.simulated,true);
 await action('nav:ads');state.adsBudget='';await action('ads:back');draw();await action('ads:plan');assert.equal(state.adsStage,'review');assert.equal(calls.find(x=>x.path==='ads/plan').b.destination,undefined);assert.equal(state.adsPlan.result.recommendation.destinationType,'instagram_profile');assert.equal(state.adsPlan.result.brief.dailyBudget,null);draw();await action('ads:preview');assert.match(state.notice,/deshabilitado/);assert.equal(calls.some(x=>x.path==='ads/push'),false);await action('nav:video');await action('video-select:b');await action('video-select:a');assert.deepEqual(state.videoSelected,['a']);await action('video:plan');assert.equal(state.videoPlan.result.hooks.length,3);assert.deepEqual(calls.find(x=>x.path==='video/plan').b.selected,['a']);assert.equal(calls.some(x=>x.path==='video'),false,'Analizar no genera el video');await action('video-hook:1');assert.equal(state.videoHookIndex,1);draw();await action('duration:10');assert.equal(state.videoPlan,null,'Cambiar duración exige revisar propuestas nuevas');
});
