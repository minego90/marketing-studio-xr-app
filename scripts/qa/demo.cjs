const {chromium}=require('playwright');const SP=process.argv[2];
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:1100,height:760}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{Object.defineProperty(navigator,'xr',{value:{isSessionSupported:async()=>true,requestSession:async()=>{throw new Error('stub')}},configurable:true});});
await p.goto('http://localhost:8844/?access=test&xrdebug=1');await p.waitForTimeout(3500);
await p.evaluate(async()=>{const D=__xrDebug;D.renderer.setClearColor(0x30404c,1);D.renderer.setSize(1100,760,false);D.camera.aspect=1100/760;D.camera.updateProjectionMatrix();D.camera.position.set(0,1.0,0.2);D.camera.lookAt(-0.3,0.4,-1);D.panels.forEach(x=>{if(x.name!=='main')x.group.visible=false});D.recenter();D.summonOffice();D.officeFrame.position.set(-0.1,0.55,-0.8);await D.office.ready;D.office.demo();window.__t0=performance.now();});
const shot=async(n,ms)=>{await p.waitForTimeout(ms);const d=await p.evaluate(()=>{const D=__xrDebug;for(let i=0;i<3;i++)D.tick(performance.now()+i*16);return document.querySelector('#xrCanvas').toDataURL('image/png')});require('fs').writeFileSync(SP+'/'+n,Buffer.from(d.split(',')[1],'base64'))};
// avanzar el reloj de la oficina rápido: ticks cada 33 ms durante la espera
await p.evaluate(()=>{window.__iv=setInterval(()=>__xrDebug.tick(performance.now()),33)});
await shot('demo1.png',9000);await shot('demo2.png',14000);await shot('demo3.png',14000);
console.log(JSON.stringify(await p.evaluate(()=>__xrDebug.office.log.map(l=>l.type+': '+l.text))));console.log('ERRS',errs);await b.close()})();
