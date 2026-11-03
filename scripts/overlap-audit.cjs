// Auditoría de choques: en cada pantalla busca botones/zonas táctiles que se pisan. Uso: servidor de pruebas en :8844.
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
const p=await (await b.newContext({viewport:{width:1500,height:1000},permissions:['camera']})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8844/?access=test');await p.waitForTimeout(2500);
const A=async(id,w=700)=>{await p.evaluate(id=>window.__studio.action(id),id);await p.waitForTimeout(w)};
const found=new Map();
const audit=async tag=>{const hs=await p.evaluate(()=>{window.__studio.draw();return window.__studio.hits().map(h=>({id:h.id,x:h.x,y:h.y,w:h.w,h:h.h,drag:!!h.drag,disabled:!!h.disabled}))});
 for(let i=0;i<hs.length;i++)for(let j=i+1;j<hs.length;j++){const a=hs[i],c=hs[j];if(a.drag||c.drag)continue;if(/^photo:del:/.test(a.id)||/^photo:del:/.test(c.id))continue; // la ✕ sobre la foto es intencional
 
  const ox=Math.min(a.x+a.w,c.x+c.w)-Math.max(a.x,c.x),oy=Math.min(a.y+a.h,c.y+c.h)-Math.max(a.y,c.y);
  if(ox>3&&oy>3){const k=tag+' :: '+a.id+' × '+c.id;if(!found.has(k))found.set(k,`${ox|0}×${oy|0}px  A(${a.x|0},${a.y|0},${a.w|0},${a.h|0}) B(${c.x|0},${c.y|0},${c.w|0},${c.h|0})`)}}};
await A('photos:clear',800);await A('example:all',2500);
for(let g=0;g<=10;g++){await p.evaluate(g=>{window.__studio.state.gStep=g;window.__studio.state.page='guide'},g);await p.waitForTimeout(400);await audit('guía-'+g);}
await A('idea:analyze',3500);
for(const pg of ['capture','strategy','brief','gallery','publish','ads','data','video','settings','feed','rec']){await p.evaluate(pg=>{window.__studio.state.page=pg},pg);await p.waitForTimeout(500);await audit(pg);}
await p.evaluate(()=>{window.__studio.state.page='guide';window.__studio.state.hudVisible=true});await p.waitForTimeout(500);await audit('camera-hud');
console.log([...found].map(([k,v])=>k+'  '+v).join('\n')||'SIN CHOQUES');console.log('errs',errs.slice(0,3));await b.close()})();
