import * as THREE from 'three';

const TAP_MOVE_PX = 14;
const TAP_MAX_MS = 450;

export interface TapInput {
  pointer: THREE.Vector2;
  onTap: () => void;
}

export function bindTapInput(canvas: HTMLCanvasElement, input: TapInput): () => void {
  const pointer = input.pointer;
  let downX = 0;
  let downY = 0;
  let downAt = 0;
  let dragging = false;

  const updatePointer = (clientX: number, clientY: number): void => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = false;
    downX = e.clientX;
    downY = e.clientY;
    downAt = performance.now();
    updatePointer(e.clientX, e.clientY);
    canvas.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!canvas.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    if (Math.hypot(dx, dy) > TAP_MOVE_PX) dragging = true;
    updatePointer(e.clientX, e.clientY);
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!canvas.hasPointerCapture(e.pointerId)) return;
    canvas.releasePointerCapture(e.pointerId);
    updatePointer(e.clientX, e.clientY);

    const elapsed = performance.now() - downAt;
    if (!dragging && elapsed <= TAP_MAX_MS) {
      input.onTap();
    }
  };

  const onPointerCancel = (e: PointerEvent): void => {
    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
  };
}
