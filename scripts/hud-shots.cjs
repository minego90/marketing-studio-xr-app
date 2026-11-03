const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});const p=await (await b.newContext({viewport:{width:1500,height:1000},permissions:['camera']})).newPage();
await p.goto('http://localhost:8844/?access=test');await p.waitForTimeout(2500);
const A=async(id,w=900)=>{await p.evaluate(id=>window.__studio.action(id),id);await p.waitForTimeout(w)};
await A('nav:capture',300);await A('photos:clear',800);await A('camera-hud',1500);await p.evaluate(()=>{window.__studio.state.captureTimer=0});
await A('hud-shutter',3500);await A('hud-close');await A('camera-hud',1500);await p.screenshot({path:'/tmp/hud-choice.png'});
await A('hud-keep',800);await p.screenshot({path:'/tmp/hud-shutter.png'});
await A('nav:guide',500);await A('guide:start',100).catch(()=>{});await p.evaluate(()=>{window.__studio.state.gStep=1});await A('hud-close',300);await p.waitForTimeout(500);await p.screenshot({path:'/tmp/guide-place.png'});
await b.close()})();
