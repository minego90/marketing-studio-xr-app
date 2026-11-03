// Recorrido de la guía en el visor virtual (modo demo, $0). Guarda capturas en /tmp/guide-*.png
const {chromium}=require('playwright');const fs=require('fs');
let fails=0;const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m);if(!c)fails++};
(async()=>{
const b=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
const p=await (await b.newContext({viewport:{width:1500,height:1000},permissions:['camera']})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8844/?access=test');await p.waitForTimeout(2500);
const S=()=>p.evaluate(()=>{const s=window.__studio.state;return {page:s.page,g:s.gStep,hud:s.hudVisible,photos:['front','right','left','back'].filter(k=>s.photos[k]).length,assets:s.campaign?.result?.assets?.length||0,sel:s.selected.length,fmt:s.format,busy:s.busy,plan:!!s.strategyPlan}});
const A=async(id,w=900)=>{await p.evaluate(id=>window.__studio.action(id),id);await p.waitForTimeout(w)};
const shot=async n=>{await p.screenshot({path:'/tmp/guide-'+n+'.png'})};
await A('photos:clear',800);
ok((await S()).page==='guide','arranca en la guía');await shot('0-start');
await A('guide:next');await shot('1-place');
await A('guide:next',1500);ok((await S()).hud,'abre la cámara');
await p.evaluate(()=>{window.__studio.state.captureTimer=0});
for(let i=0;i<4;i++){await A('guide:next',3500);let s=await S();ok(s.photos===i+1,'foto '+(i+1)+' tomada');if(i==1)await shot('3-shot');await A('guide:next',900)}
let s=await S();ok(s.g===6&&!s.hud,'tras 4 fotos va a "qué publicar" y cierra cámara '+JSON.stringify(s));await shot('6-what');
await A('guide:kind:reel',300);await A('guide:next',4000);s=await S();ok(s.g===7&&s.plan,'analiza y propone ideas');await shot('7-idea');
await A('guide:next',9000);s=await S();ok(s.assets>0&&s.g===9,'crea imágenes y pasa a elegir '+JSON.stringify(s));await shot('9-pick');
await A('guide:next',500);s=await S();ok(s.g===10,'final');await shot('10-final');
await A('guide:next',1000);s=await S();ok(s.page==='video'&&s.fmt==='reel','video: abre la pestaña Video '+JSON.stringify(s));
await A('nav:guide',500);ok((await S()).page==='guide','volver a la guía');
console.log('errores de página:',errs);if(errs.length)fails++;
await b.close();process.exit(fails?1:0)})();
