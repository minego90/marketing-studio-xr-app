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
(async()=>{const out=process.argv[2]||('/home/claude/shots/flow-'+Date.now());fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--ignore-gpu-blocklist']});
const ctx=await b.newContext({viewport:{width:1600,height:900},permissions:['camera']});const p=await ctx.newPage();
const logs=[];p.on('pageerror',e=>{logs.push('PAGEERR '+e.message);console.log('PAGEERR',e.message)});
await p.addInitScript(MOCK);
await p.goto('http://localhost:8844/?access=test');await p.waitForTimeout(2500);
const info=async n=>console.log(n,await p.evaluate(()=>{const s=window.__studio.state;return JSON.stringify({page:s.page,busy:s.busy,hud:s.hudVisible,assets:(s.campaign?.result?.assets||[]).length,ads:s.adsWiz,done:!!s.adsDone,notice:(s.notice||'').slice(0,110)})}));
const shot=async n=>{await p.screenshot({path:`${out}/${n}.png`})};
const act=async(id,w=900)=>{try{await p.evaluate(id=>window.__studio.action(id),id)}catch(e){console.log('ERR',id,e.message)}await p.waitForTimeout(w)};
await p.click('#enterXR');await p.waitForTimeout(3000);
await act('example:all',2500);await act('photos:done',3500);await info('idea');await shot('01-idea');
await act('idea:pick:date:0');await act('idea:create',6000);await info('imagenes');await shot('02-imagenes');
await act('nav:publish',1500);await info('publicar');await shot('03-publicar');
await act('nav:ads',1500);await info('pauta1');await shot('04-pauta-objetivo');
for(const i of [2,3,4]){await act('ads:next',1200);await info('pauta'+i);await shot('0'+(3+i)+'-pauta-'+i)}
await act('nav:data',3000);await info('datos');await shot('08-datos');
await act('nav:rec',1500);await info('grabar');await shot('09-grabar');
console.log(logs.join('\n'));console.log(out);await b.close()})();
