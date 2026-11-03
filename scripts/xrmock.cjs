// Visor virtual: simula una sesión WebXR (Quest) dentro de Chromium para probar el modo VR/AR de verdad.
const {chromium}=require('playwright');const fs=require('fs');
const MOCK=()=>{
  const persp=(fov,asp,n,f)=>{const t=1/Math.tan(fov/2);return new Float32Array([t/asp,0,0,0, 0,t,0,0, 0,0,(f+n)/(n-f),-1, 0,0,2*f*n/(n-f),0])};
  class XRWebGLLayer{constructor(s,gl){this.session=s;this.framebuffer=null;this.framebufferWidth=gl.drawingBufferWidth;this.framebufferHeight=gl.drawingBufferHeight}getViewport(v){const w=this.framebufferWidth/2;return {x:v.eye==='left'?0:w,y:0,width:w,height:this.framebufferHeight}}}
  window.XRWebGLLayer=XRWebGLLayer;try{delete window.XRWebGLBinding;window.XRWebGLBinding=undefined}catch(e){}
  if(!window.XRRigidTransform){window.XRRigidTransform=class{constructor(p={x:0,y:0,z:0,w:1},o={x:0,y:0,z:0,w:1}){this.position=DOMPointReadOnly.fromPoint({x:p.x,y:p.y,z:p.z,w:1});this.orientation=DOMPointReadOnly.fromPoint({x:o.x||0,y:o.y||0,z:o.z||0,w:o.w==null?1:o.w});this.matrix=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,p.x,p.y,p.z,1]);this.inverse=this}}}
  const mk=(x,y,z)=>{const t=new XRRigidTransform({x,y,z,w:1},{x:0,y:0,z:0,w:1});return t};
  window.__xrmock={frames:0,head:{x:0,y:1.6,z:0},sessions:0};
  const proto=WebGL2RenderingContext.prototype;proto.makeXRCompatible=async function(){};
  const WP=WebGLRenderingContext.prototype;WP.makeXRCompatible=async function(){};
  const XRMOCK={isSessionSupported:async()=>true,addEventListener(){},removeEventListener(){},
    requestSession:async(mode,opts)=>{
      window.__xrmock.sessions++;window.__xrmock.mode=mode;
      const s=new EventTarget();s.inputSources=[];s.renderState={depthNear:.1,depthFar:1000};s.environmentBlendMode='alpha-blend';s.visibilityState='visible';s.supportedFrameRates=[72,90];s.frameRate=72;s.enabledFeatures=['local-floor'];
      s.updateRenderState=st=>Object.assign(s.renderState,st);
      s.requestReferenceSpace=async()=>({getOffsetReferenceSpace(){return this},addEventListener(){}});
      s.requestAnimationFrame=cb=>requestAnimationFrame(t=>{window.__xrmock.frames++;const h=window.__xrmock.head;const asp=(s.renderState.baseLayer?.framebufferWidth/2)/(s.renderState.baseLayer?.framebufferHeight)||1;
        const proj=persp(1.7,asp,s.renderState.depthNear||.1,s.renderState.depthFar||100);
        const fr={session:s,getViewerPose:()=>({transform:mk(h.x,h.y,h.z),views:[{eye:'left',projectionMatrix:proj,transform:mk(h.x-.032,h.y,h.z),requestViewportScale(){}},{eye:'right',projectionMatrix:proj,transform:mk(h.x+.032,h.y,h.z),requestViewportScale(){}}]}),getPose:()=>null,getJointPose:()=>null,fillJointRadii:()=>true,fillPoses:()=>true};
        cb(t,fr)});
      s.cancelAnimationFrame=id=>cancelAnimationFrame(id);
      s.end=async()=>{s.dispatchEvent(new Event('end'))};
      return s}};
  Object.defineProperty(navigator,'xr',{value:XRMOCK,configurable:true});
};
(async()=>{const out=process.argv[2]||('/home/claude/shots/xr-'+Date.now());fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--ignore-gpu-blocklist']});
const ctx=await b.newContext({viewport:{width:1600,height:900},permissions:['camera']});const p=await ctx.newPage();
const logs=[];p.on('pageerror',e=>{logs.push('PAGEERR '+e.message);console.log('PAGEERR',e.message)});p.on('console',m=>{if(m.type()==='error')logs.push('CONSOLE '+m.text())});
await p.addInitScript(MOCK);
await p.goto('http://localhost:8844/?access=test');await p.waitForTimeout(2500);
const info=()=>p.evaluate(()=>{const s=window.__studio.state;return JSON.stringify({btn:document.querySelector('#enterXR').textContent,disabled:document.querySelector('#enterXR').disabled,xr:document.body.classList.contains('xr-active'),frames:window.__xrmock.frames,page:s.page,hud:s.hudVisible,notice:s.notice})});
const shot=async n=>{await p.screenshot({path:`${out}/${n}.png`})};
const act=async(id,w=700)=>{await p.evaluate(id=>window.__studio.action(id),id);await p.waitForTimeout(w)};
console.log('0',await info());
await p.click('#enterXR');await p.waitForTimeout(3500);console.log('1 entrar VR',await info());await shot('1-vr-inicio');
await act('example:all',2500);await shot('2-fotos');console.log('2',await info());
await act('camera-hud',1500);await shot('3-camara');console.log('3',await info());
await act('hud-close');await act('photos:clear',1200);console.log('4 limpiar',await info());
await act('example:all',2500);await act('photos:done',3000);await shot('4-idea');console.log('5 idea',await info());
console.log(logs.join('\n'));
const frames1=await p.evaluate(()=>window.__xrmock.frames);await p.waitForTimeout(2000);const frames2=await p.evaluate(()=>window.__xrmock.frames);console.log('fps aprox (software, no real):',(frames2-frames1)/2);
console.log(out);await b.close()})();
