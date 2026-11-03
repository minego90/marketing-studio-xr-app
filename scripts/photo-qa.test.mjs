import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzePixels,adviseFromMetrics} from '../public/photo-qa.js';

function make(w,h,fn){const a=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=fn(x,y),i=(y*w+x)*4;a[i]=a[i+1]=a[i+2]=v;a[i+3]=255;}return a;}
const W=256,H=256;
// Producto: rectángulo con textura fina (bordes nítidos) sobre fondo liso.
const textured=(x,y)=>x>80&&x<176&&y>50&&y<206?((x*7+y*13)%9<4?210:60):120;

test('Una escena nítida y centrada se aprueba',()=>{
 const m=analyzePixels(make(W,H,textured),W,H),a=adviseFromMetrics(m);
 assert.ok(m.coverage>.22&&m.coverage<.9,'cobertura '+m.coverage);assert.ok(Math.abs(m.center.x-.5)<.1);
 assert.ok(!a.issues.some(i=>['oscura','movida','pequeno','descentrado'].includes(i.id)),JSON.stringify(a.issues));
});
test('Imagen oscura, plana y sin detalle pide más luz y cambia de fondo',()=>{
 const a=adviseFromMetrics(analyzePixels(make(W,H,()=>20),W,H));
 assert.ok(a.issues.some(i=>i.id==='oscura'));assert.ok(a.issues.some(i=>i.id==='contraste'));assert.ok(a.issues.some(i=>i.id==='movida'));assert.equal(a.verdict,'repetir');
});
test('Imagen quemada se detecta',()=>{
 const a=adviseFromMetrics(analyzePixels(make(W,H,()=>255),W,H));assert.ok(a.issues.some(i=>i.id==='sobreexpuesta'));assert.ok(a.issues.some(i=>i.id==='quemadas'));
});
test('Imagen suavizada (movida) baja la nitidez frente a la original',()=>{
 const sharp=analyzePixels(make(W,H,textured),W,H);
 const blur=make(W,H,(x,y)=>{let s=0,n=0;for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){s+=textured(Math.min(W-1,Math.max(0,x+dx)),Math.min(H-1,Math.max(0,y+dy)));n++;}return s/n;});
 const soft=analyzePixels(blur,W,H);assert.ok(soft.sharpness<sharp.sharpness/3,`${soft.sharpness} vs ${sharp.sharpness}`);
 assert.ok(adviseFromMetrics(soft).issues.some(i=>i.id==='movida'));
});
test('Producto diminuto y descentrado genera avisos de encuadre',()=>{
 const tiny=make(W,H,(x,y)=>x>10&&x<46&&y>10&&y<46?((x*7+y*13)%9<4?220:50):120);
 const a=adviseFromMetrics(analyzePixels(tiny,W,H));assert.ok(a.issues.some(i=>i.id==='pequeno'));assert.ok(a.issues.some(i=>i.id==='descentrado'));
});
