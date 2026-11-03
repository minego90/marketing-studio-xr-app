import * as THREE from './vendor/three.module.js';

// Physical metres: compact viewfinder, slightly wider than a hand.
export const WRIST_CAMERA_WIDTH = 0.22;
export const WRIST_MENU_WIDTH = 0.065;
const across = new THREE.Vector3(),
  along = new THREE.Vector3(),
  out = new THREE.Vector3(),
  toward = new THREE.Vector3(),
  basis = new THREE.Matrix4();
const rotate = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
export function placeWristPanel(group, hand, viewer, lift = 0.065, forward = 0.055) {
  if (hand.havePalm) {
    across.subVectors(hand.indexBase, hand.pinkyBase).normalize();
    along.subVectors(hand.middleBase, hand.wrist).normalize();
    out.crossVectors(across, along).normalize();
    toward.subVectors(viewer, hand.wrist);
    // Keep the readable face above the wrist; retain the hand's in-plane rotation.
    if (out.dot(toward) < 0) {
      across.negate();
      out.negate();
    }
    along.crossVectors(out, across).normalize();
    basis.makeBasis(across, along, out);
    group.quaternion.setFromRotationMatrix(basis);
  } else {
    group.quaternion.copy(hand.wristQuaternion).multiply(rotate);
    out.set(0, 0, 1).applyQuaternion(group.quaternion);
    along.set(0, 1, 0).applyQuaternion(group.quaternion);
  }
  group.position.copy(hand.wrist).addScaledVector(out, lift).addScaledVector(along, forward);
  group.updateMatrixWorld(true);
}

export const CAMERA_PANEL_WIDTH = 0.34;
export function placeCameraPanel(group, viewer, direction) {
  group.position.copy(viewer).addScaledVector(direction, 0.65);
  group.position.y -= 0.09;
  group.lookAt(viewer);
  group.updateMatrixWorld(true);
}
// Depth-only tracked mesh: the real passthrough hand remains visible and masks UI.
export function configureHandOcclusion(object) {
  object.traverse(o => {
    if (!o.isMesh) return;
    o.renderOrder = -10;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      m.colorWrite = false;
      m.depthWrite = true;
      m.depthTest = true;
      m.transparent = false;
      m.needsUpdate = true;
    }
  });
}

// Store panel pose in the grabbing hand's frame; release leaves the world pose intact.
export function beginPanelGrab(panel, controller) {
  panel.updateWorldMatrix(true, false);
  controller.updateWorldMatrix(true, false);
  return controller.matrixWorld.clone().invert().multiply(panel.matrixWorld);
}
const grabWorld = new THREE.Matrix4(),
  grabLocal = new THREE.Matrix4();
export function applyPanelGrab(panel, controller, relative) {
  controller.updateWorldMatrix(true, false);
  grabWorld.multiplyMatrices(controller.matrixWorld, relative);
  if (panel.parent) {
    panel.parent.updateWorldMatrix(true, false);
    grabLocal.copy(panel.parent.matrixWorld).invert().multiply(grabWorld);
  } else grabLocal.copy(grabWorld);
  grabLocal.decompose(panel.position, panel.quaternion, panel.scale);
  panel.updateMatrixWorld(true);
}
