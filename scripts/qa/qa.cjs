const {chromium}=require('playwright');
const SP=process.argv[2];
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const ctx=await b.newContext({viewport:{width:1100,height:760},permissions:['camera']});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/404/.test(m.text()))errs.push(m.text().slice(0,160))});
await p.addInitScript(()=>{Object.defineProperty(navigator,'xr',{value:{isSessionSupported:async()=>true,requestSession:async()=>{throw new Error('stub')}},configurable:true});});
await p.goto('http://localhost:8844/?access=test&xrdebug=1');await p.waitForTimeout(3500);
const R=await p.evaluate(async()=>{
 const T=await import('/vendor/three.module.js');const D=__xrDebug;const out={};const V=(x,y,z)=>new T.Vector3(x,y,z);
 D.renderer.setClearColor(0x30404c,1);D.camera.position.set(0,0,0);D.recenter();D.summonOffice();await D.office.ready;
 const tick=(j)=>{D.tick(performance.now(),j)};tick();tick();
 const setC=(d,pos,tgt)=>{d.source=d.source||{};d.c.position.copy(pos);const m=new T.Matrix4().lookAt(pos,tgt,V(0,1,0));d.c.quaternion.setFromRotationMatrix(m);d.c.matrix.compose(d.c.position,d.c.quaternion,V(1,1,1));d.c.matrixWorld.copy(d.c.matrix)};
 const d0=D.controllerData[0],d1=D.controllerData[1];
 const wp=o=>{const v=V(0,0,0);o.getWorldPosition(v);return v};
 const press=async(d)=>{d.c.dispatchEvent({type:'selectstart'});await new Promise(r=>setTimeout(r,120));d.c.dispatchEvent({type:'selectend'});await new Promise(r=>setTimeout(r,350))};
 const expect={estudio:'capture',redaccion:'strategy',taller:'xr',pauta:'ads',analitica:'results',revision:'review'};
 out.rooms={};
 for(const id of Object.keys(expect)){
  const res={};
  for(const kind of ['zone','person']){
   await __studio.action('nav:settings');
   const cands=D.office.pickables.filter(o=>o.userData.room===id&&o.isMesh);
   const o=kind==='zone'?cands.find(c=>c.parent===D.office.root)||cands[0]:cands.find(c=>c.parent!==D.office.root)||cands[0];
   const tgt=wp(o);setC(d0,V(tgt.x+0.05,tgt.y+0.55,tgt.z+0.5),tgt);tick();
   const h=D.officeHit(d0);await press(d0);res[kind]={hit:h&&h.id,page:__studio.state.page};
  }
  out.rooms[id]={expected:expect[id],...res};
 }
 // TV
 await __studio.action('nav:settings');{const o=D.office.pickables.find(o=>o.userData.room==='__tv');const t=wp(o);setC(d0,V(t.x,t.y+0.4,t.z+0.7),t);tick();const h=D.officeHit(d0);await press(d0);out.tv={hit:h&&h.id,page:__studio.state.page}}
 // interruptor día/noche
 {const o=D.office.pickables.find(o=>o.userData.room==='__time');const t=wp(o);setC(d0,V(t.x+0.1,t.y+0.3,t.z+0.6),t);tick();const h=D.officeHit(d0);out.switchHit=h&&h.id}
 // handle: una mano mueve/gira
 const F=D.officeFrame;const handle=F.children.find(o=>o.geometry?.type==='CapsuleGeometry');
 {const hp=wp(handle);setC(d0,V(hp.x,hp.y+0.35,hp.z+0.3),hp);tick();const h=D.officeHit(d0);d0.c.dispatchEvent({type:'selectstart'});
  const p0=F.position.clone(),r0=F.rotation.y;
  // mover 0.2 en x y girar la mano 0.5 rad
  const q=new T.Quaternion().setFromAxisAngle(V(0,1,0),0.5);d0.c.position.x+=0.2;d0.c.quaternion.premultiply(q);d0.c.matrix.compose(d0.c.position,d0.c.quaternion,V(1,1,1));d0.c.matrixWorld.copy(d0.c.matrix);tick();
  out.grab1={hit:h&&h.id,moved:+F.position.distanceTo(p0).toFixed(3),rotated:+(F.rotation.y-r0).toFixed(3),tiltX:F.rotation.x,tiltZ:F.rotation.z};
  d0.c.dispatchEvent({type:'selectend'});}
 // dos manos
 {const hp=wp(handle);setC(d0,V(hp.x-0.1,hp.y+0.35,hp.z+0.3),hp);tick();d0.c.dispatchEvent({type:'selectstart'});
  setC(d1,V(hp.x+0.4,hp.y+0.7,hp.z+0.3),V(hp.x+0.4,hp.y+0.7,hp.z-3));tick();d1.c.dispatchEvent({type:'selectstart'});tick();
  const s0=D.office.root.scale.x;const ry0=F.rotation.y;
  const a=wp(d0.c),bb=wp(d1.c);
  // separar manos: d1 se aleja 0.3 en x
  d1.c.position.x+=0.3;d1.c.matrix.compose(d1.c.position,d1.c.quaternion,V(1,1,1));d1.c.matrixWorld.copy(d1.c.matrix);tick();const s1=D.office.root.scale.x;
  d1.c.position.x-=0.5;d1.c.matrix.compose(d1.c.position,d1.c.quaternion,V(1,1,1));d1.c.matrixWorld.copy(d1.c.matrix);tick();const s2=D.office.root.scale.x;
  d1.c.position.z-=0.4;d1.c.matrix.compose(d1.c.position,d1.c.quaternion,V(1,1,1));d1.c.matrixWorld.copy(d1.c.matrix);tick();const ry1=F.rotation.y;
  out.scale={start:+s0.toFixed(4),apart:+s1.toFixed(4),closer:+s2.toFixed(4),yawChange:+(ry1-ry0).toFixed(3)};
  d0.c.dispatchEvent({type:'selectend'});d1.c.dispatchEvent({type:'selectend'});
  // límites
  d0.c.position.set(0,0,0);}
 // volver a invocar y capturar
 D.summonOffice();tick();
 // dedo: tocar TV
 await __studio.action('nav:settings');{const o=D.office.pickables.find(o=>o.userData.room==='__tv');const t=wp(o);
  const j={right:{wrist:[t.x+0.1,t.y-0.1,t.z+0.2],'index-finger-tip':[t.x,t.y,t.z],'index-finger-metacarpal':[t.x+0.05,t.y-0.05,t.z+0.1],'middle-finger-metacarpal':[t.x+0.06,t.y-0.05,t.z+0.1],'pinky-finger-metacarpal':[t.x+0.07,t.y-0.05,t.z+0.1]}};
  tick(j);await new Promise(r=>setTimeout(r,300));out.pokeTV={page:__studio.state.page};}
 // dedo: Demo
 {const dp=D.officeFrame.children.find(o=>o.material?.map&&o.geometry?.parameters?.width===0.2);const t=wp(dp);
  const j={right:{wrist:[t.x+0.1,t.y-0.1,t.z+0.2],'index-finger-tip':[t.x,t.y,t.z],'index-finger-metacarpal':[t.x+0.05,t.y-0.05,t.z+0.1],'middle-finger-metacarpal':[t.x+0.06,t.y-0.05,t.z+0.1],'pinky-finger-metacarpal':[t.x+0.07,t.y-0.05,t.z+0.1]}};
  const n0=D.office.log.length;tick(j);out.demoStarted=true;}
 // muñeca izquierda
 {const wr={left:{wrist:[-0.18,-0.25,-0.35],'index-finger-tip':[-0.18,-0.2,-0.5],'index-finger-metacarpal':[-0.15,-0.22,-0.42],'middle-finger-metacarpal':[-0.17,-0.22,-0.42],'pinky-finger-metacarpal':[-0.21,-0.22,-0.42]}};
  tick(wr);tick(wr);out.wristVisible=D.wristPanel.group.visible;
  const g=D.wristPanel.group;g.updateMatrixWorld(true);
  const up=V(0,0.025,0.01).applyMatrix4(g.matrixWorld),dn=V(0,-0.025,0.01).applyMatrix4(g.matrixWorld);
  // cámara
  setC(d1,V(up.x+0.05,up.y+0.25,up.z+0.35),up);tick(wr);let h=d1.c&&null;
  const before=__studio.state.hudVisible;await press(d1);tick(wr);out.wristCamera={before,after:__studio.state.hudVisible};
  await __studio.action('hud-close');
  // oficina
  const v0=D.officeFrame.visible;setC(d1,V(dn.x+0.05,dn.y+0.25,dn.z+0.35),dn);tick(wr);await press(d1);tick(wr);const v1=D.officeFrame.visible;await press(d1);tick(wr);out.wristOffice={start:v0,afterOne:v1,afterTwo:D.officeFrame.visible};}
 out.spritesDepthOff=(()=>{let n=0;D.office.root.traverse(o=>{if(o.isSprite&&o.renderOrder!==11&&o.material.depthTest===false)n++});return n})();
 return out});
console.log(JSON.stringify(R,null,1));console.log('ERRS',JSON.stringify(errs));
await b.close()})();
