// Revisor de fotos 100 % local (sin IA, sin red). Funciona sobre píxeles RGBA.
// Umbrales documentados en agent/skills/fotografia-producto/SKILL.md
export const QA_THRESHOLDS={darkMean:55,brightMean:205,lowContrast:28,blur:60,clipped:.06,smallSubject:.22,bigSubject:.92,offCenter:.22};

function gray(rgba,w,h){const g=new Float32Array(w*h);for(let i=0,j=0;i<g.length;i++,j+=4)g[i]=.2126*rgba[j]+.7152*rgba[j+1]+.0722*rgba[j+2];return g;}
function downscale(g,w,h,target=256){const s=Math.max(1,Math.floor(Math.max(w,h)/target));if(s===1)return {g,w,h};const nw=Math.floor(w/s),nh=Math.floor(h/s),o=new Float32Array(nw*nh);for(let y=0;y<nh;y++)for(let x=0;x<nw;x++){let a=0;for(let dy=0;dy<s;dy++)for(let dx=0;dx<s;dx++)a+=g[(y*s+dy)*w+x*s+dx];o[y*nw+x]=a/(s*s);}return {g:o,w:nw,h:nh};}

export function analyzePixels(rgba,width,height){
 const full=gray(rgba,width,height),{g,w,h}=downscale(full,width,height);
 let sum=0,sum2=0,clipped=0;for(let i=0;i<g.length;i++){const v=g[i];sum+=v;sum2+=v*v;if(v>250)clipped++;}
 const n=g.length,mean=sum/n,std=Math.sqrt(Math.max(0,sum2/n-mean*mean));
 // Varianza del Laplaciano (nitidez) + mapa de bordes para estimar dónde está el producto.
 let lsum=0,lsum2=0,count=0;const edge=new Uint8Array(w*h);let gradSum=0;
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x,l=4*g[i]-g[i-1]-g[i+1]-g[i-w]-g[i+w];lsum+=l;lsum2+=l*l;count++;const gx=g[i+1]-g[i-1],gy=g[i+w]-g[i-w],m=Math.hypot(gx,gy);gradSum+=m;edge[i]=m>0?1:0;edge[i]=0;}
 const lap=count?lsum2/count-(lsum/count)**2:0,meanGrad=gradSum/Math.max(1,count),thr=Math.max(14,meanGrad*1.6);
 let minX=w,maxX=-1,minY=h,maxY=-1,hits=0;
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x,m=Math.hypot(g[i+1]-g[i-1],g[i+w]-g[i-w]);if(m>thr){hits++;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}}
 let coverage=0,cx=.5,cy=.5;
 if(hits>w*h*.002){// recorta el 2 % de percentil extremo con un margen simple
  const bw=(maxX-minX+1)/w,bh=(maxY-minY+1)/h;coverage=Math.min(1,bw*bh);cx=(minX+maxX)/2/w;cy=(minY+maxY)/2/h;}
 return {width,height,mean:+mean.toFixed(1),contrast:+std.toFixed(1),sharpness:+lap.toFixed(1),clipped:+(clipped/n).toFixed(4),coverage:+coverage.toFixed(3),center:{x:+cx.toFixed(3),y:+cy.toFixed(3)},edgeHits:hits};
}

export function adviseFromMetrics(m,T=QA_THRESHOLDS){
 const issues=[];const add=(id,severity,message,fix)=>issues.push({id,severity,message,fix});
 if(m.mean<T.darkMean)add('oscura','warn','La imagen está oscura.','Añade luz frontal suave o acércate a una ventana.');
 else if(m.mean>T.brightMean)add('sobreexpuesta','warn','La imagen está muy clara.','Baja la luz directa o aleja el flash.');
 if(m.contrast<T.lowContrast)add('contraste','warn','El producto se confunde con el fondo.','Usa un fondo liso de otro tono.');
 if(m.sharpness<T.blur)add('movida','warn','La foto parece movida o desenfocada.','Quédate quieto 2 segundos y limpia el lente.');
 if(m.clipped>T.clipped)add('quemadas','warn','Hay zonas quemadas por reflejo.','Aleja la luz o cambia el ángulo.');
 if(m.coverage>0){
  if(m.coverage<T.smallSubject)add('pequeno','warn','El producto ocupa muy poco cuadro.','Acércate un paso.');
  else if(m.coverage>T.bigSubject)add('grande','warn','El producto casi toca los bordes.','Aléjate un poco para dejar margen.');
  const dx=Math.abs(m.center.x-.5),dy=Math.abs(m.center.y-.5);
  if(Math.max(dx,dy)>T.offCenter)add('descentrado','info','El producto está descentrado.','Reencuadra hacia el centro.');
 }
 const warn=issues.filter(i=>i.severity==='warn').length;
 const score=Math.max(0,100-warn*18-(issues.length-warn)*6);
 return {score,verdict:warn===0?'buena':warn===1?'mejorable':'repetir',issues,topFix:issues[0]?.fix||'Se ve bien: guárdala.',metrics:m};
}

export function analyzeImageElement(img,maxSide=320){
 const c=document.createElement('canvas'),s=Math.min(1,maxSide/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));c.width=Math.max(1,Math.round((img.naturalWidth||img.width)*s));c.height=Math.max(1,Math.round((img.naturalHeight||img.height)*s));
 const q=c.getContext('2d',{willReadFrequently:true});q.drawImage(img,0,0,c.width,c.height);const d=q.getImageData(0,0,c.width,c.height);
 return adviseFromMetrics(analyzePixels(d.data,c.width,c.height));
}
