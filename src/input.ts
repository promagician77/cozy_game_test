import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const TAP_MOVE_PX = 10;

export interface SceneInput {
  pointer: THREE.Vector2;
  controls: OrbitControls;
  update: () => void;
  setLookAt: (lookAtY: number, cameraY: number, cameraZ: number) => void;
}

export function bindSceneInput(
  canvas: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  pointer: THREE.Vector2,
  onTap: () => void,
): SceneInput {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.enablePan = true;
  controls.panSpeed = 0.55;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 0.85;
  controls.screenSpacePanning = true;
  controls.minDistance = 7;
  controls.maxDistance = 24;
  controls.minPolarAngle = Math.PI * 0.28;
  controls.maxPolarAngle = Math.PI * 0.62;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };

  const cameraAtDown = new THREE.Vector3();
  const targetAtDown = new THREE.Vector3();
  let downX = 0;
  let downY = 0;

  const updatePointer = (clientX: number, clientY: number): void => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    downX = e.clientX;
    downY = e.clientY;
    cameraAtDown.copy(camera.position);
    targetAtDown.copy(controls.target);
    updatePointer(e.clientX, e.clientY);
  };

  const onPointerMove = (e: PointerEvent): void => {
    updatePointer(e.clientX, e.clientY);
  };

  const onPointerUp = (e: PointerEvent): void => {
    updatePointer(e.clientX, e.clientY);

    const fingerMoved = Math.hypot(e.clientX - downX, e.clientY - downY) > TAP_MOVE_PX;
    const viewMoved =
      camera.position.distanceToSquared(cameraAtDown) > 0.02 ||
      controls.target.distanceToSquared(targetAtDown) > 0.02;

    if (!fingerMoved && !viewMoved) {
      onTap();
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
  canvas.addEventListener('pointermove', onPointerMove, { passive: true });
  canvas.addEventListener('pointerup', onPointerUp, { passive: true });
  canvas.addEventListener('pointercancel', onPointerUp, { passive: true });

  const setLookAt = (lookAtY: number, cameraY: number, cameraZ: number): void => {
    controls.target.set(0, lookAtY, 0);
    camera.position.set(0, cameraY, cameraZ);
    controls.update();
  };

  return {
    pointer,
    controls,
    update: () => controls.update(),
    setLookAt,
  };
}
