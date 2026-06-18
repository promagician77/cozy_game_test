import * as THREE from 'three';

export interface ViewportSize {
  width: number;
  height: number;
}

export interface LayoutMetrics {
  mosaicScale: number;
  mosaicY: number;
  trayY: number;
  cameraZ: number;
  cameraY: number;
  lookAtY: number;
}

const MOSAIC_CELL = 1.08;
const MOSAIC_HALF = ((11 - 1) / 2) * MOSAIC_CELL;
const MOSAIC_HEIGHT = MOSAIC_HALF * 2 + MOSAIC_CELL;
const MOSAIC_WIDTH = MOSAIC_HALF * 2 + MOSAIC_CELL;
const TRAY_HEIGHT = 1.2;
const GAP = 1.35;

/** Fit mosaic + tray into portrait / landscape viewports */
export function computeLayout({ width, height }: ViewportSize): LayoutMetrics {
  const isPortrait = height >= width;
  const aspect = width / height;

  const contentW = MOSAIC_WIDTH;
  const contentH = MOSAIC_HEIGHT + GAP + TRAY_HEIGHT;

  const vFov = 42 * (Math.PI / 180);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);

  const distForHeight = (contentH * 0.56) / Math.tan(vFov / 2);
  const distForWidth = (contentW * 0.6) / Math.tan(hFov / 2);
  const cameraZ = Math.max(distForHeight, distForWidth, isPortrait ? 11.5 : 10);

  const mosaicY = isPortrait ? 0.85 : 0.55;
  const trayY = mosaicY - (MOSAIC_HALF + GAP + TRAY_HEIGHT * 0.35) * 0.92;
  const lookAtY = (mosaicY + trayY) * 0.48;

  const mosaicScale = isPortrait
    ? Math.min(0.98, (width / 390) * 0.9)
    : Math.min(1.05, (height / 680) * 1.05);

  return {
    mosaicScale,
    mosaicY,
    trayY,
    cameraZ,
    cameraY: lookAtY + (isPortrait ? 0.2 : 0.3),
    lookAtY,
  };
}

export function applyLayout(
  contentGroup: THREE.Group,
  viewport: ViewportSize,
): LayoutMetrics {
  const layout = computeLayout(viewport);

  contentGroup.position.set(0, layout.mosaicY, 0);
  contentGroup.scale.setScalar(layout.mosaicScale);

  return layout;
}
