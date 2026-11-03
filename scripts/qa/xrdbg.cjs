const {chromium}=require('playwright');
const SP=process.argv[2];
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:1100,height:800}});
p.on('pageerror',e=>console.log('PE',e.message));p.on('console',m=>{if(['error'].includes(m.type()))console.log('CE',m.text().slice(0,200))});
await p.addInitScript(()=>{Object.defineProperty(navigator,'xr',{value:{isSessionSupported:async()=>true,requestSession:async()=>{throw new Error('stub')}},configurable:true});});
await p.goto('http://localhost:8844/?access=test&xrdebug=1');await p.waitForTimeout(4000);
const log=async(l)=>console.log(l,JSON.stringify(await p.evaluate(()=>({page:__studio.state.page,notice:__studio.state.notice,vis:__xrDebug.officeFrame.visible}))));
// preparar: mostrar canvas xr para capturar
const shotCanvas=async(name)=>{const d=await p.evaluate(()=>{__xrDebug.tick(performance.now());__xrDebug.tick(performance.now()+33);return document.querySelector('#xrCanvas').toDataURL('image/png')});require('fs').writeFileSync(SP+'/'+name,Buffer.from(d.split(',')[1],'base64'))};
await p.evaluate(()=>{const r=__xrDebug.renderer;r.setClearColor(0x30404c,1);r.setSize(1100,800,false);__xrDebug.camera.aspect=1100/800;__xrDebug.camera.updateProjectionMatrix();__xrDebug.camera.position.set(0,0.3,0);__xrDebug.recenter();__xrDebug.summonOffice();});
await p.waitForTimeout(8000);
await log('after summon');
await shotCanvas('xr1.png');
// apuntar mando al hub: TV
const res=await p.evaluate(async()=>{const T=await import('/vendor/three.module.js');const D=__xrDebug;const d=D.controllerData[0];d.source={};d.c.visible=true;
 const tv=D.office.pickables.find(o=>o.userData.room==='__tv');const tgt=new T.Vector3();tv.getWorldPosition(tgt);
 d.c.position.set(0,0.95,0.15);const m=new T.Matrix4().lookAt(d.c.position,tgt,new T.Vector3(0,1,0));d.c.quaternion.setFromRotationMatrix(m);d.c.matrix.compose(d.c.position,d.c.quaternion,new T.Vector3(1,1,1));d.c.matrixWorld.copy(d.c.matrix);
 const h=D.officeHit(d);const out={hit:h&&h.id};
 d.c.dispatchEvent({type:'selectstart'});d.c.dispatchEvent({type:'selectend'});out.page=__studio.state.page;
 // estudio
 const z=D.office.pickables.find(o=>o.userData.room==='estudio');z.getWorldPosition(tgt);const m2=new T.Matrix4().lookAt(d.c.position,tgt,new T.Vector3(0,1,0));d.c.quaternion.setFromRotationMatrix(m2);d.c.matrix.compose(d.c.position,d.c.quaternion,new T.Vector3(1,1,1));d.c.matrixWorld.copy(d.c.matrix);
 out.hit2=D.officeHit(d)?.id;d.c.dispatchEvent({type:'selectstart'});d.c.dispatchEvent({type:'selectend'});await new Promise(r=>setTimeout(r,500));out.page2=__studio.state.page;
 // handle drag
 const f=D.officeFrame;const before=f.position.clone();const hh=D.officeHit(d);
 return out});
console.log(JSON.stringify(res));
await shotCanvas('xr2.png');
await b.close()})();
