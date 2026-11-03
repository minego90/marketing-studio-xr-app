import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {createCompanion} from '../public/companion.js';

test('Luma inicializa, respeta visibilidad/movimiento reducido y libera su escena',()=>{
 const ctx=new Proxy({measureText:t=>({width:t.length*12})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 global.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
 const parent=new THREE.Group(),state={assistantVisible:true,reducedMotion:true,page:'strategy',busy:false};
 const assistant=createCompanion(parent,state);assert.equal(parent.children.length,1);assistant.update(2000);assert.equal(assistant.group.position.y,.405);
 state.reducedMotion=false;assistant.update(3000);assert.notEqual(assistant.group.position.y,.405);
 state.assistantVisible=false;assistant.update(4000);assert.equal(assistant.group.visible,false);assistant.dispose();assert.equal(parent.children.length,0);
});
