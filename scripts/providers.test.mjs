import test from 'node:test';
import assert from 'node:assert/strict';
import { videoInput,jsonResult,meta,uploadHiggs,instagram,dataImage,ProviderError,analyzeCampaign,reviewImages,generateImage } from '../lib/providers.mjs';
import { validateCreativePlan,imageDirection } from '../lib/creative-direction.mjs';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('Higgsfield conserva duración, orientación y referencias; rechaza controles inválidos',()=>{
 const v=videoInput({duration:10,orientation:'vertical',style:'halloween',prompt:'Una taza sobre la mesa'},['https://example.com/cup.jpg']);assert.equal(v.duration,10);assert.equal(v.aspect_ratio,'9:16');assert.deepEqual(v.image_urls,['https://example.com/cup.jpg']);assert.equal(v.generate_audio,false);
 assert.throws(()=>videoInput({duration:7,orientation:'vertical',style:'halloween'},['a']),ProviderError);assert.throws(()=>videoInput({duration:5,orientation:'horizontal',style:'invented'},['a']),ProviderError);
});
test('Credenciales ausentes no llaman a ningún proveedor',async()=>{const old=global.fetch;let calls=0;global.fetch=()=>{calls++;throw Error('unexpected network');};try{await assert.rejects(meta({},{}),/MODEL_API_KEY/);await assert.rejects(instagram({},'me'),/IG_ACCESS_TOKEN/);assert.equal(calls,0);}finally{global.fetch=old;}});
test('Billing y respuestas incompletas de Meta nunca se convierten en éxito',async()=>{const old=global.fetch;try{global.fetch=async()=>new Response(JSON.stringify({error:{message:'Billing not configured'}}),{status:402});await assert.rejects(meta({MODEL_API_KEY:'test'},{model:'muse-image-1.0'}),/402/);global.fetch=async()=>new Response(JSON.stringify({status:'incomplete',output:[]}));await assert.rejects(meta({MODEL_API_KEY:'test'},{}),/incomplete/);}finally{global.fetch=old;}});
test('Subida firmada no transmite la clave de API al almacenamiento',async()=>{const dir=await mkdtemp(join(tmpdir(),'xr-provider-'));await writeFile(join(dir,'test.png'),'test-image');const old=global.fetch;const calls=[];global.fetch=async(url,opts)=>{calls.push({url,opts});return new Response(JSON.stringify(calls.length===1?{upload_url:'https://storage.example/upload',upload_headers:{'x-test':'signed'},public_url:'https://cdn.example/img.png'}:{}));};try{const url=await uploadHiggs({HF_API_KEY:'id:secret'},'test.png',dir);assert.equal(url,'https://cdn.example/img.png');assert.equal(calls[0].opts.headers.Authorization,'Key id:secret');assert.equal(calls[1].opts.headers.Authorization,undefined);assert.equal(calls[1].opts.headers['x-test'],'signed');assert.equal(calls[1].opts.method,'PUT');}finally{global.fetch=old;await rm(dir,{recursive:true});}});
test('Análisis estructurado rechaza texto libre y fotos no admitidas',()=>{assert.deepEqual(jsonResult({output:[{content:[{type:'output_text',text:'{"ok":true}'}]}]}),{ok:true});assert.throws(()=>jsonResult({output_text:'No pude analizar'}));assert.throws(()=>dataImage('https://example.com/image.jpg'));assert.throws(()=>dataImage('data:image/svg+xml;base64,abcd'));});
test('La guía exige cuatro ejecuciones distintas y dirección fotográfica completa antes de generar',()=>{
 const concept={title:'Hero de estudio',subject:'Producto protagonista, etiqueta visible',composition:'Encuadre a nivel del producto con espacio negativo',lighting:'Luz suave lateral, relleno y contraluz tenue',palette:'Violetas profundos y acentos ámbar',setting:'Set de estudio con utilería desenfocada',preservation:'Conservar logotipo, forma y colores observados',prompt:'Fotografía editorial de producto en un set de estudio con jerarquía clara, perspectiva de teleobjetivo corto, luz principal a 45 grados, relleno suave, contraluz ámbar, profundidad real y textura natural; marca y etiqueta originales sin cambios.',caption:'Una noche extraordinaria para descubrir nuestro producto. Conócelo hoy.'};
 const plan={title:'Noche de estudio',product:'Producto fotografiado',summary:'Cuatro conceptos distintos que preservan la identidad visual del producto y se adaptan al encargo.',caption:'Descubre esta propuesta de Halloween con nuestro producto. Conoce más.',videoPrompt:'Movimiento lento de cámara con luz lateral ámbar y fondo oscuro.',concepts:[0,1,2,3].map(i=>({...concept,title:`Concepto ${i+1}`}))};
 assert.equal(validateCreativePlan(plan),plan);assert.match(imageDirection(concept),/45 grados/);
 assert.throws(()=>validateCreativePlan({...plan,concepts:[concept,concept,concept,concept]}),/repitió/);
 assert.throws(()=>validateCreativePlan({...plan,concepts:plan.concepts.map((c,i)=>i===0?{...c,lighting:'bonita'}:c)}),/dirección fotográfica/);
});
test('El análisis usa solo fotos y nunca habilita búsqueda, incluso con una URL antigua',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'xr-direction-'));await writeFile(join(dir,'front.jpg'),'mock-photo');const old=global.fetch,seen=[];
 const concept={title:'Hero de estudio',subject:'Producto principal con etiqueta visible',composition:'Perspectiva a nivel del producto y espacio lateral',lighting:'Luz principal suave lateral y relleno bajo',palette:'Violeta oscuro y ámbar contenido',setting:'Estudio minimalista con fondo profundo',preservation:'Misma marca, color y forma de la referencia',prompt:'Fotografía de producto protagonista en estudio con perspectiva de teleobjetivo, etiqueta frontal, luz lateral suave, rebote sutil, fondo violeta con profundidad y utilería desenfocada; conservar forma, color, proporciones y logotipo originales.',caption:'Una nueva forma de celebrar Halloween con este producto. Descúbrelo.'};
 const payload={title:'Noche editorial',product:'Producto visto',summary:'Cuatro escenas cuidadas que muestran el producto en escenarios diferenciados y coherentes.',caption:'Descubre este producto en nuestra propuesta de Halloween.',videoPrompt:'Revelado gradual con cámara lenta y luces contrastadas.',concepts:[0,1,2,3].map(i=>({...concept,title:`Concepto ${i+1}`}))};
 global.fetch=async(_url,opts)=>{seen.push(JSON.parse(opts.body));return new Response(JSON.stringify({status:'completed',output_text:JSON.stringify(payload),output:[]}));};
 try{await analyzeCampaign({MODEL_API_KEY:'mock'},{photo:'front.jpg',brief:'Campaña Halloween'},dir);assert.equal(seen[0].tools,undefined);await analyzeCampaign({MODEL_API_KEY:'mock'},{photo:'front.jpg',website:'https://example.com',webPhoto:'front.jpg',brief:'Campaña Halloween'},dir);assert.equal(seen[1].tools,undefined);assert.equal(seen[1].input[0].content.length,2);}
 finally{global.fetch=old;await rm(dir,{recursive:true});}
});
test('La revisión visual acepta cuatro decisiones y bloquea una respuesta incompleta',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'xr-review-'));await Promise.all(['reference.jpg','one.jpg','two.jpg','three.jpg','four.jpg'].map(n=>writeFile(join(dir,n),'mock-photo')));const old=global.fetch;
 const assets=['one.jpg','two.jpg','three.jpg','four.jpg'].map(file=>({file}));
 try{
  global.fetch=async()=>new Response(JSON.stringify({status:'completed',output_text:JSON.stringify({reviews:[true,true,false,true].map(approved=>({approved,note:'Identidad comparada con referencia'}))})}));
  const review=await reviewImages({MODEL_API_KEY:'mock'},'reference.jpg',assets,dir);assert.equal(review[2].approved,false);
  global.fetch=async()=>new Response(JSON.stringify({status:'completed',output_text:'{"reviews":[]}'}));
  await assert.rejects(reviewImages({MODEL_API_KEY:'mock'},'reference.jpg',assets,dir),/cuatro resultados/);
 }finally{global.fetch=old;await rm(dir,{recursive:true});}
});
test('Muse Image recibe las tres vistas y la instrucción conserva proporciones',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'xr-image-'));await Promise.all(['front.jpg','side.jpg','back.jpg'].map(n=>writeFile(join(dir,n),'mock-photo')));const old=global.fetch;let requestBody;
 global.fetch=async(_url,opts)=>{requestBody=JSON.parse(opts.body);return new Response(JSON.stringify({status:'completed',output:[{type:'image_generation_call',result:Buffer.alloc(64,1).toString('base64')}] }));};
 try{await generateImage({MODEL_API_KEY:'mock'},'front.jpg',{prompt:'Producto completo con entorno Halloween',subject:'Producto protagonista',composition:'Cámara frontal',lighting:'Luz lateral suave',palette:'Ámbar y violeta',setting:'Set nocturno',preservation:'Mandos y pantalla originales'},dir,{front:'front.jpg',side:'side.jpg',back:'back.jpg'});
  const parts=requestBody.input[0].content;assert.equal(parts.filter(p=>p.type==='input_image').length,3);assert.match(parts[0].text,/NO comprimas, encojas, estires ni acortes/);
 }finally{global.fetch=old;await rm(dir,{recursive:true});}
});

test('Muse Image conserva cuatro referencias distintas: frente, derecha, izquierda y atrás',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'xr-four-views-')),old=global.fetch;for(const name of ['front','right','left','back'])await writeFile(join(dir,name+'.jpg'),name+' reference');
 let body;global.fetch=async(_url,opts)=>{body=JSON.parse(opts.body);return new Response(JSON.stringify({id:'four-views',status:'completed',output:[{type:'image_generation_call',result:Buffer.from('A generated image placeholder with enough bytes').toString('base64')}]}));};
 try{await generateImage({MODEL_API_KEY:'test'},'front.jpg',{title:'Foto de campaña',prompt:'Fotografía del producto para una campaña'},dir,{front:'front.jpg',right:'right.jpg',left:'left.jpg',back:'back.jpg'});const parts=body.input[0].content;assert.equal(parts.filter(x=>x.type==='input_image').length,4);const labels=parts.filter(x=>x.type==='input_text').map(x=>x.text).join(' ');assert.match(labels,/lateral derecha/);assert.match(labels,/lateral izquierda/);assert.match(labels,/posterior/);}finally{global.fetch=old;await rm(dir,{recursive:true});}
});
