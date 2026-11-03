import test from 'node:test';import assert from 'node:assert/strict';
import {klingInput,submitKling,readKlingTask,KLING_BASE} from '../lib/kling.mjs';
const settings={duration:5,orientation:'vertical',prompt:'Campaña de Halloween para este producto.',style:'halloween'};
test('Kling 4.0 Omni usa referencias, 720p y 9:16 sin parámetros de otros proveedores',()=>{
 const b=klingInput(settings,['https://assets.example/one.jpg','https://assets.example/two.jpg'],'task-test');assert.deepEqual(b.settings,{resolution:'720p',duration:5,aspect_ratio:'9:16'});assert.equal(b.contents[1].type,'refer_image');assert.equal(b.contents[1].id,'image_1');assert.equal(b.contents[2].id,'image_2');assert.match(b.contents[0].text,/@image_1, @image_2/);assert.equal(b.options.external_task_id,'task-test');assert.equal(b.generate_audio,undefined);assert.equal(b.model_name,undefined);
 assert.throws(()=>klingInput({...settings,orientation:'horizontal'},['https://assets.example/a.jpg'],'task'),/vertical/);assert.throws(()=>klingInput(settings,[],'task'));assert.throws(()=>klingInput(settings,['http://localhost/a.jpg'],'task'));
});
test('Kling oficial: autenticación separada, ID persistible y consulta GET del video correcto',async()=>{
 const old=global.fetch,calls=[];global.fetch=async(url,opts)=>{calls.push({url,opts});assert.ok(url.startsWith(KLING_BASE+'/'));assert.equal(opts.headers.Authorization,'Bearer mock-kling');if(opts.method==='POST')return new Response(JSON.stringify({code:0,data:{id:'task-123',status:'submitted'}}));return new Response(JSON.stringify({code:0,data:[{id:'another',status:'processing'},{id:'task-123',status:'succeeded',outputs:[{type:'video',url:'https://cdn.example/video.mp4'}],billing:[]}]}));};
 try{const submitted=await submitKling({KLING_API_KEY:'mock-kling'},klingInput(settings,['https://assets.example/a.jpg'],'unique-task'));assert.equal(submitted.id,'task-123');const result=await readKlingTask({KLING_API_KEY:'mock-kling'},submitted.id);assert.equal(result.url,'https://cdn.example/video.mp4');assert.equal(calls[0].url,KLING_BASE+'/omni-video/kling-4.0');assert.equal(calls[1].url,KLING_BASE+'/tasks?task_ids=task-123');}finally{global.fetch=old;}
});
test('Kling no convierte errores de negocio ni videos sin URL en éxito',async()=>{
 const old=global.fetch;try{global.fetch=async()=>new Response(JSON.stringify({code:1100,message:'Invalid key'}));await assert.rejects(submitKling({KLING_API_KEY:'mock'},{}),/rechazó/);global.fetch=async()=>new Response(JSON.stringify({code:0,data:[{id:'123',status:'succeeded',outputs:[]}]}));await assert.rejects(readKlingTask({KLING_API_KEY:'mock'},'123'),/sin una URL/);}finally{global.fetch=old;}
});
