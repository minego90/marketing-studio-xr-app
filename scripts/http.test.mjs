import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import net from 'node:net';

test('Servidor aislado: guarda estrategia local, exige consentimiento IA y bloquea pauta y protege secretos',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-http-'));
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const env={...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:dir,APP_ACCESS_CODE:'test-only',ENABLE_PAID_APIS:'false',ENABLE_META_ADS_WRITE:'false',MODEL_API_KEY:'',IG_ACCESS_TOKEN:'',IG_USER_ID:'',ADS_ACCESS_TOKEN:'',ADS_ACCOUNT_ID:'',ADS_PAGE_ID:'',ADS_IG_ACTOR_ID:''};
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env,stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),5000);child.stdout.on('data',data=>{if(String(data).includes('Aumentados XR:')){clearTimeout(timer);resolve();}});child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code));});});
  const call=(path,b)=>fetch(`http://127.0.0.1:${port}${path}`,b?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}:{});
  const config=await (await call('/api/config')).json();assert.equal(config.meta,false);assert.equal(config.adsWriteEnabled,false);
  const saved=await call('/api/strategy',{mode:'local',brief:{product:'Producto de prueba'}});assert.equal(saved.status,200);assert.equal((await saved.json()).plan.provider,'local');
  assert.equal((await (await call('/api/strategy')).json()).brief.product,'Producto de prueba');
  assert.equal((await call('/api/strategy',{mode:'live',brief:{product:'X'}})).status,400);
  assert.equal((await call('/api/strategy',{mode:'live',confirmAnalysis:true,brief:{product:'X'}})).status,409);
  assert.equal((await call('/api/strategy',{mode:'local',brief:{metricsVisits:'-50'}})).status,400);
  const blocked=await call('/api/ads/push',{confirm:true});assert.equal(blocked.status,409);assert.match((await blocked.json()).error,/deshabilitado/);
  const uploaded=await (await call('/api/upload',{image:'data:image/png;base64,dGVzdA=='})).json();
  for(const slot of ['front','right','left','back'])assert.equal((await call('/api/photos',{slot,file:uploaded.file})).status,200);
  const allPhotos=await (await call('/api/photos')).json();assert.ok(allPhotos.right&&allPhotos.left);
  const removed=await (await call('/api/photos',{slot:'right',remove:true})).json();assert.equal(removed.right,null);assert.ok(removed.left);
  assert.equal((await call('/.env')).status,404);assert.equal((await call('/.private/CLAUDE_EXECUTION_PRIVATE.md')).status,404);
  assert.deepEqual(await (await call('/api/jobs')).json(),[]);
  let campaign=await (await call('/api/campaign',{mode:'demo',photo:uploaded.file,brief:'Campaña del producto de prueba',demoAssets:Array(4).fill('data:image/png;base64,dGVzdA==')})).json();
  for(let i=0;i<30&&campaign.status!=='completed';i++){await new Promise(r=>setTimeout(r,10));campaign=await (await call('/api/jobs/'+campaign.id)).json();}
  assert.equal(campaign.status,'completed');
  const draftResponse=await call('/api/ads/plan',{campaignId:campaign.id,selected:[campaign.result.assets[0].id],country:'CO',city:'Bogotá',radius:10,goal:'auto',dailyBudget:'',currency:'COP',days:3,caption:'Copy aprobado y editado por el usuario.',profileUsername:'test'});assert.equal(draftResponse.status,202);
  let draft=await draftResponse.json();for(let i=0;i<30&&draft.status!=='completed';i++){await new Promise(r=>setTimeout(r,10));draft=await (await call('/api/jobs/'+draft.id)).json();}
  assert.equal(draft.status,'completed');assert.equal(draft.result.brief.destination,'');assert.equal(draft.result.brief.dailyBudget,null);assert.equal(draft.result.recommendation.destinationType,'instagram_profile');assert.equal(draft.result.caption,'Copy aprobado y editado por el usuario.');assert.equal(draft.result.remote,null);
  const videoPlanResponse=await call('/api/video/plan',{campaignId:campaign.id,selected:[campaign.result.assets[1].id],duration:5,caption:'Copy del Reel'});assert.equal(videoPlanResponse.status,202);let videoPlan=await videoPlanResponse.json();for(let i=0;i<30&&videoPlan.status!=='completed';i++){await new Promise(r=>setTimeout(r,10));videoPlan=await (await call('/api/jobs/'+videoPlan.id)).json();}assert.equal(videoPlan.status,'completed');assert.deepEqual(videoPlan.result.selected,[campaign.result.assets[1].id]);assert.equal(videoPlan.result.hooks.length,3);assert.equal(videoPlan.result.grounded,false);

  const bundle=await (await call('/api/xr-ad/bundle')).json();assert.equal(bundle.cost,0);assert.ok(bundle.faces.length>=1);
  const kit=await (await call('/api/agent/kit')).json();assert.ok(JSON.stringify(kit).includes('guardian'));
  const rv=await (await call('/api/agent/review',{caption:'Hola',headlines:['A B','A B'],mode:'demo'})).json();assert.ok(rv.score<=100&&Array.isArray(rv.findings));
  const ask=await (await call('/api/agent/ask',{question:'¿Cómo ilumino un producto brillante?',page:'capture'})).json();assert.ok(ask&&typeof ask==='object');
  const exp=await call('/api/ads/export?planId='+draft.id+'&format=csv');assert.equal(exp.status,200);assert.match(await exp.text(),/Paused/i);

 }finally{child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));await rm(dir,{recursive:true,force:true});}
});
