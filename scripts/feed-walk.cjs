const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8844/?access=test');await p.waitForTimeout(2500);
const A=async(id,w=900)=>{await p.evaluate(id=>window.__studio.action(id),id);await p.waitForTimeout(w)};
await A('nav:feed',1500);await p.screenshot({path:'/tmp/feed-1.png'});
const id=await p.evaluate(()=>window.__studio.state.feed[0]?.id);console.log('items',await p.evaluate(()=>window.__studio.state.feed.length),id);
await A('feed:open:'+id,800);await p.screenshot({path:'/tmp/feed-2.png'});await A('feed:close');await A('nav:guide');
console.log('errores',errs);await b.close()})();
