import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {placeWristPanel,WRIST_CAMERA_WIDTH,WRIST_MENU_WIDTH} from '../public/wrist-ui.js';
const viewer=new THREE.Vector3(0,0,1);
function hand(){return {havePalm:true,wrist:new THREE.Vector3(),wristQuaternion:new THREE.Quaternion(),indexBase:new THREE.Vector3(.03,.07,0),middleBase:new THREE.Vector3(0,.08,0),pinkyBase:new THREE.Vector3(-.03,.07,0)};}
test('camera and menu stay compact and translate exactly with wrist',()=>{
 assert.equal(WRIST_CAMERA_WIDTH,.22);assert.equal(WRIST_MENU_WIDTH,.065);
 const h=hand(),panel=new THREE.Group();placeWristPanel(panel,h,viewer);const initial=panel.position.clone();
 const shift=new THREE.Vector3(.2,.1,0);for(const key of ['wrist','indexBase','middleBase','pinkyBase'])h[key].add(shift);
 placeWristPanel(panel,h,viewer);assert.ok(panel.position.distanceTo(initial.add(shift))<1e-8);
});
test('wrist panel rotates with the tracked hand rather than billboarding to the head',()=>{
 const h=hand(),panel=new THREE.Group(),rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/3);
 placeWristPanel(panel,h,viewer);const original=panel.quaternion.clone();
 for(const key of ['indexBase','middleBase','pinkyBase'])h[key].applyQuaternion(rotation);
 placeWristPanel(panel,h,viewer);assert.ok(panel.quaternion.angleTo(rotation.clone().multiply(original))<1e-7);
 const before=panel.quaternion.clone();placeWristPanel(panel,h,new THREE.Vector3(.2,0,1));assert.ok(before.angleTo(panel.quaternion)<1e-7);
});
test('wrist orientation fallback works when palm joints temporarily disappear',()=>{
 const h=hand(),panel=new THREE.Group();h.havePalm=false;h.wristQuaternion.setFromAxisAngle(new THREE.Vector3(0,0,1),.3);
 placeWristPanel(panel,h,viewer);assert.ok(Number.isFinite(panel.position.length()));assert.ok(Math.abs(panel.quaternion.length()-1)<1e-8);
});

test('floating camera starts in front and does not follow subsequent wrist movement',async()=>{
 const {placeCameraPanel,CAMERA_PANEL_WIDTH}=await import('../public/wrist-ui.js');const p=new THREE.Group(),viewer=new THREE.Vector3(0,1.6,0);
 placeCameraPanel(p,viewer,new THREE.Vector3(0,0,-1));assert.equal(CAMERA_PANEL_WIDTH,.34);assert.ok(p.position.distanceTo(new THREE.Vector3(0,1.51,-.65))<1e-8);
});
test('hand mesh writes depth for occlusion without drawing its grey surface',async()=>{
 const {configureHandOcclusion}=await import('../public/wrist-ui.js');const group=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());group.add(mesh);configureHandOcclusion(group);
 assert.equal(mesh.material.colorWrite,false);assert.equal(mesh.material.depthWrite,true);assert.equal(mesh.material.depthTest,true);assert.equal(mesh.material.transparent,false);assert.equal(mesh.renderOrder,-10);mesh.geometry.dispose();mesh.material.dispose();
});

test('grabbing camera preserves its initial offset and applies hand translation and rotation',async()=>{
 const {beginPanelGrab,applyPanelGrab}=await import('../public/wrist-ui.js');const scene=new THREE.Group(),controller=new THREE.Group(),panel=new THREE.Group();scene.add(controller,panel);
 controller.position.set(.1,1.2,-.2);panel.position.set(.2,1.4,-.65);panel.rotation.set(.1,.2,.05);scene.updateMatrixWorld(true);
 const start=panel.matrixWorld.clone(),relative=beginPanelGrab(panel,controller);applyPanelGrab(panel,controller,relative);assert.ok(panel.matrixWorld.elements.every((v,i)=>Math.abs(v-start.elements[i])<1e-8),'Grabbing must not jump');
 controller.position.add(new THREE.Vector3(.15,.1,-.1));controller.rotation.set(0,.4,.2);controller.updateMatrixWorld(true);const expected=controller.matrixWorld.clone().multiply(relative);applyPanelGrab(panel,controller,relative);
 assert.ok(panel.matrixWorld.elements.every((v,i)=>Math.abs(v-expected.elements[i])<1e-8));const frozen=panel.matrixWorld.clone();controller.position.set(3,3,3);controller.updateMatrixWorld(true);panel.updateMatrixWorld(true);assert.deepEqual(panel.matrixWorld.elements,frozen.elements,'Released window must stay at its saved world pose');
});
