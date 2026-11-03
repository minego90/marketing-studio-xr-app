// Capturas de la guía en cristal 3D dentro del visor virtual (modo demo, $0). Guarda /tmp/g3d-*.png
const {chromium}=require('playwright');const fs=require('fs');
const MOCK=fs.readFileSync(__dirname+'/../public/xr-mock.js','utf8');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
const p=await (await b.newContext({viewport:{width:1600,height:900},permissions:['camera']})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.addInitScript(MOCK);
await p.goto('http://localhost:8844/?access=test');await p.waitForTimeout(2500);
const A=async(id,w=900)=>{await p.evaluate(id=>window.__studio.action(id),id);await p.waitForTimeout(w)};
await p.click('#enterXR');await p.waitForTimeout(3000);
await A('photos:clear',1200);await A('nav:guide',1200);
await p.screenshot({path:'/tmp/g3d-0.png'});
await p.evaluate(()=>window.__studio.action('hud-close'));await p.waitForTimeout(600);await p.screenshot({path:'/tmp/g3d-0.png'});
await p.evaluate(()=>{const s=window.__studio.state;s.gStep=6});await p.waitForTimeout(1200);await p.screenshot({path:'/tmp/g3d-1.png'});
await A('guide:glass',1000);await p.screenshot({path:'/tmp/g3d-2-2d.png'});
console.log('errs',errs.slice(0,5));await b.close()})();
