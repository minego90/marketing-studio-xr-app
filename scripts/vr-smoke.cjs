// Prueba de humo en el visor virtual: se corre ANTES de entregar cualquier versión. Falla (exit 1) si algo se rompe.
// Uso: servidor de pruebas en :8844 (bash srv.sh restart) y luego: node scripts/vr-smoke.cjs
const {chromium}=require('playwright');const fs=require('fs');
const MOCK=fs.readFileSync(__dirname+'/../public/xr-mock.js','utf8');
let fails=0;const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m);if(!c)fails++};
(async()=>{
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
for(const hang of [false,true]){
 const p=await (await b.newContext({viewport:{width:1600,height:900},permissions:['camera']})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 if(hang)await p.addInitScript(()=>{navigator.mediaDevices.getUserMedia=()=>new Promise(()=>{})});
 await p.addInitScript(MOCK);
 await p.goto('http://localhost:8844/?access=test');await p.waitForTimeout(2500);
 const S=()=>p.evaluate(()=>{const s=window.__studio.state;return {page:s.page,hud:s.hudVisible,photos:['front','right','left','back'].filter(k=>s.photos[k]).length,sel:s.captureSlot}});
 const A=async(id,w=800)=>{await p.evaluate(id=>window.__studio.action(id),id);await p.waitForTimeout(w)};
 const tag=hang?'[cámara colgada] ':'[cámara normal] ';
 await p.click('#enterXR');await p.waitForTimeout(2500);
 ok(await p.evaluate(()=>document.body.classList.contains('xr-active')),tag+'entra en VR');
 await A('photos:clear',1200);ok((await S()).photos===0,tag+'«Empezar de nuevo» deja 0 fotos');
 await A('camera-hud',1000);ok((await S()).hud===true,tag+'el panel de cámara abre al instante');
 if(!hang){await p.evaluate(()=>{window.__studio.state.captureTimer=0});
  for(let i=0;i<4;i++)await A('hud-shutter',3500);
  ok((await S()).photos===4,tag+'4 disparos → 4 fotos');
  await A('hud-close');await A('slot:left',1500);ok((await S()).hud===true,tag+'tocar una foto abre la cámara para reemplazar');
  await A('hud-close');await A('photo:del:right',1000);ok((await S()).photos===3,tag+'✕ quita una foto');
  await A('example:all',2500);await A('photos:done',3000);ok((await S()).page==='strategy',tag+'con 4 fotos pasa a Idea');
  await p.mouse.click(1,1);
 }
 if(!hang){
  const O=()=>p.evaluate(()=>({i:window.__office.infoState(),page:window.__studio.state.page}));
  await p.evaluate(()=>window.__office.showFrame());await p.waitForTimeout(600);await p.evaluate(()=>window.__office.triggerPick('pauta'));await p.waitForTimeout(2500);
  let o=await O();ok(o.i.id==='pauta'&&o.i.p>0.9,tag+'tocar un escritorio sube la ventana con su información');
  const pg=o.page;await p.evaluate(()=>window.__office.triggerPick('pauta'));await p.waitForTimeout(600);
  o=await O();ok(o.page==='ads'||o.page!==pg,tag+'segundo toque abre la pantalla');
  await p.evaluate(()=>{window.__office.speak('estudio','Uno');window.__office.speak('pauta','Dos')});
  const said=await p.evaluate(()=>Object.values(window.__office.workers).filter(w=>w.say).length);
  ok(said<=1,tag+'solo un personaje habla a la vez');
 }
 if(!hang){
  await A('example:all',2000);await A('idea:analyze',3000);
  await p.evaluate(()=>{const s=window.__studio.state;s.mode='live';s.config.paidEnabled=true;});
  const before=await p.evaluate(()=>window.__studio.state.campaign?.id||'');
  await A('idea:create',800);
  let c=await p.evaluate(()=>({ch:window.__studio.state.imgChoice,id:window.__studio.state.campaign?.id||''}));
  ok(c.ch===true&&c.id===before,tag+'en modo real, antes de crear pregunta IA o local (no crea nada solo)');
  await A('img:go:cancel',300);ok(!(await p.evaluate(()=>window.__studio.state.imgChoice)),tag+'se puede volver sin crear');
  await p.evaluate(()=>{const s=window.__studio.state;s.mode='demo';});
 }
 ok(errs.length===0,tag+'sin errores de JavaScript'+(errs.length?': '+errs[0]:''));
 await p.close();
}
await b.close();console.log(fails?`\n${fails} FALLO(S)`:'\nTODO OK');process.exit(fails?1:0)})();
