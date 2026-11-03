// Visor virtual (solo pruebas): simula una sesión WebXR de Quest en un navegador normal.
// Se activa abriendo la app con ?vr=virtual. Teclas: W/A/S/D mover cabeza, Q/E subir/bajar. Clic sobre un panel = tocarlo.
(()=>{
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
  window.addEventListener('keydown',e=>{const h=window.__xrmock.head,k=e.key.toLowerCase(),st=.08;if(k==='w')h.z-=st;else if(k==='s')h.z+=st;else if(k==='a')h.x-=st;else if(k==='d')h.x+=st;else if(k==='q')h.y+=st;else if(k==='e')h.y-=st});
  window.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelector('#enterXR')?.click()});
  addEventListener('DOMContentLoaded',()=>{const d=document.createElement('div');d.textContent='VISOR VIRTUAL · clic = tocar · W A S D Q E mover · Esc salir';d.style.cssText='position:fixed;left:12px;bottom:10px;z-index:30;font:12px sans-serif;color:#ffd0a0;background:#000a;padding:6px 10px;border-radius:8px;pointer-events:none';document.body.append(d)});
})();
