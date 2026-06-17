import * as THREE from 'three';
import gsap from 'gsap';
import {
  buildMosaicCells,
  COLORS,
  gridToWorld,
  type CellDef,
  type StoneColor,
} from './mosaic-data';
import { AudioEngine } from './audio';
import { ParticleSystem } from './particles';

type GamePhase =
  | 'idle'
  | 'vacuuming'
  | 'awaiting_tray'
  | 'awaiting_outline'
  | 'returning'
  | 'complete';

interface Stone {
  id: number;
  color: StoneColor;
  cell: CellDef;
  group: THREE.Group;
  matte: THREE.Mesh;
  gem: THREE.Mesh;
  halo: THREE.Mesh;
  outline: THREE.Mesh;
  state: 'placed' | 'in_tray' | 'gem';
}

const TRAY_Y = -5.8;
const TRAY_Z = 0.6;

function createMatteDisc(color: StoneColor): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.42, 0.44, 0.12, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: COLORS[color].matte,
    roughness: 0.92,
    metalness: 0.02,
    flatShading: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createGem(color: StoneColor): THREE.Mesh {
  const geo = new THREE.OctahedronGeometry(0.38, 0);
  const mat = new THREE.MeshPhysicalMaterial({
    color: COLORS[color].gem,
    emissive: COLORS[color].emissive,
    emissiveIntensity: 0.35,
    roughness: 0.08,
    metalness: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    reflectivity: 1,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.scale.set(0.01, 0.01, 0.01);
  mesh.visible = false;
  mesh.castShadow = true;
  return mesh;
}

function createHalo(color: StoneColor): THREE.Mesh {
  const geo = new THREE.RingGeometry(0.35, 0.5, 32);
  const mat = new THREE.MeshBasicMaterial({
    color: COLORS[color].emissive,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.z = 0.08;
  return mesh;
}

function createOutline(color: StoneColor): THREE.Mesh {
  const geo = new THREE.RingGeometry(0.32, 0.44, 32);
  const mat = new THREE.MeshBasicMaterial({
    color: COLORS[color].outline,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.z = -0.02;
  return mesh;
}

class CozyMosaicGame {
  private readonly canvas: HTMLCanvasElement;
  private readonly hint: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly audio = new AudioEngine();
  private readonly particles: ParticleSystem;

  private readonly stones: Stone[] = [];
  private readonly trayGroup = new THREE.Group();
  private readonly mosaicGroup = new THREE.Group();
  private readonly tapTargets: THREE.Object3D[] = [];

  private phase: GamePhase = 'idle';
  private activeColor: StoneColor | null = null;
  private collectedColors = new Set<StoneColor>();
  private placedGems = new Set<StoneColor>();
  private clock = new THREE.Clock();
  private trayPulseTween: gsap.core.Tween | null = null;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.hint = document.getElementById('hint') as HTMLElement;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 0.5, 14);
    this.camera.lookAt(0, -0.5, 0);

    this.particles = new ParticleSystem(this.scene);

    this.setupScene();
    this.buildMosaic();
    this.buildTray();
    this.setupInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.animate();
  }

  private setupScene(): void {
    this.scene.background = new THREE.Color(0xf5ebe0);
    this.scene.fog = new THREE.Fog(0xf5ebe0, 18, 28);

    const ambient = new THREE.AmbientLight(0xfff5eb, 0.65);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xfff8f0, 1.1);
    key.position.set(3, 8, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    key.shadow.bias = -0.001;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xc8d8e8, 0.35);
    fill.position.set(-5, 2, 6);
    this.scene.add(fill);

    const rim = new THREE.PointLight(0xffd8b8, 0.5, 20);
    rim.position.set(0, 3, -4);
    this.scene.add(rim);

    // Soft ground plane for shadows
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({
        color: 0xf0e4d8,
        roughness: 1,
        metalness: 0,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -7;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.scene.add(this.mosaicGroup);
    this.scene.add(this.trayGroup);
  }

  private buildMosaic(): void {
    const cells = buildMosaicCells();
    cells.forEach((cell, i) => {
      const { wx, wy } = gridToWorld(cell.x, cell.y);
      const group = new THREE.Group();
      group.position.set(wx, wy, 0);
      group.userData = { type: 'stone', color: cell.color, stoneId: i };

      const matte = createMatteDisc(cell.color);
      const gem = createGem(cell.color);
      const halo = createHalo(cell.color);
      const outline = createOutline(cell.color);

      group.add(matte, gem, halo, outline);
      this.mosaicGroup.add(group);

      this.stones.push({
        id: i,
        color: cell.color,
        cell,
        group,
        matte,
        gem,
        halo,
        outline,
        state: 'placed',
      });
    });

    // Invisible tap zones per color
    (['rose', 'sage'] as StoneColor[]).forEach((color) => {
      const colorStones = this.stones.filter((s) => s.color === color);
      if (colorStones.length === 0) return;

      const xs = colorStones.map((s) => s.group.position.x);
      const ys = colorStones.map((s) => s.group.position.y);
      const minX = Math.min(...xs) - 0.6;
      const maxX = Math.max(...xs) + 0.6;
      const minY = Math.min(...ys) - 0.6;
      const maxY = Math.max(...ys) + 0.6;

      const w = maxX - minX;
      const h = maxY - minY;
      const zone = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          visible: false,
          side: THREE.DoubleSide,
        }),
      );
      zone.position.set((minX + maxX) / 2, (minY + maxY) / 2, 0.5);
      zone.userData = { type: 'colorZone', color };
      this.mosaicGroup.add(zone);
      this.tapTargets.push(zone);
    });
  }

  private buildTray(): void {
    const trayBase = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.35, 1.4),
      new THREE.MeshStandardMaterial({
        color: 0xd4c4b0,
        roughness: 0.75,
        metalness: 0.05,
      }),
    );
    trayBase.position.set(0, TRAY_Y, TRAY_Z - 0.2);
    trayBase.castShadow = true;
    trayBase.receiveShadow = true;

    const trayRim = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 0.15, 1.6),
      new THREE.MeshStandardMaterial({
        color: 0xc4b4a0,
        roughness: 0.7,
        metalness: 0.08,
      }),
    );
    trayRim.position.set(0, TRAY_Y + 0.2, TRAY_Z - 0.15);

    const trayHit = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 1.2, 2),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    trayHit.position.set(0, TRAY_Y, TRAY_Z);
    trayHit.userData = { type: 'tray' };

    const innerGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 1.1),
      new THREE.MeshBasicMaterial({
        color: 0xfff0e0,
        transparent: true,
        opacity: 0.15,
      }),
    );
    innerGlow.rotation.x = -Math.PI / 2;
    innerGlow.position.set(0, TRAY_Y + 0.22, TRAY_Z);

    this.trayGroup.add(trayBase, trayRim, innerGlow, trayHit);
    this.tapTargets.push(trayHit);
  }

  private setupInput(): void {
    const onPointer = (e: PointerEvent) => {
      this.audio.unlock();
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.handleTap();
    };

    this.canvas.addEventListener('pointerdown', onPointer);
  }

  private handleTap(): void {
    if (this.phase === 'vacuuming' || this.phase === 'returning' || this.phase === 'complete') {
      return;
    }

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.tapTargets, false);

    if (hits.length === 0) return;

    const target = hits[0].object;
    const type = target.userData.type as string;

    if (type === 'colorZone' && this.phase === 'idle') {
      const color = target.userData.color as StoneColor;
      if (this.collectedColors.has(color) || this.placedGems.has(color)) return;
      this.audio.playTap();
      void this.vacuumColor(color);
    } else if (
      type === 'colorZone' &&
      this.phase === 'awaiting_outline' &&
      this.activeColor &&
      target.userData.color === this.activeColor
    ) {
      this.audio.playTap();
      void this.returnStones(this.activeColor);
    } else if (type === 'tray' && this.phase === 'awaiting_tray' && this.activeColor) {
      this.audio.playTap();
      this.armOutlineReturn();
    }
  }

  private setHint(text: string, hide = false): void {
    this.hint.textContent = text;
    this.hint.classList.toggle('hidden', hide);
  }

  private async vacuumColor(color: StoneColor): Promise<void> {
    this.phase = 'vacuuming';
    this.activeColor = color;
    this.setHint('Tap the tray');

    const colorStones = this.stones.filter(
      (s) => s.color === color && s.state === 'placed',
    );
    this.audio.playVacuum();

    // Show outlines
    colorStones.forEach((s) => {
      gsap.to(s.outline.material, {
        opacity: 0.55,
        duration: 0.4,
        ease: 'power2.out',
      });
    });

    const traySlots = this.computeTraySlots(colorStones.length);

    const promises = colorStones.map((stone, i) => {
      const slot = traySlots[i];
      const startPos = stone.group.position.clone();
      const endPos = new THREE.Vector3(slot.x, TRAY_Y + 0.35, TRAY_Z + slot.z);
      const midPos = new THREE.Vector3(
        (startPos.x + endPos.x) / 2,
        startPos.y - 2.5,
        (startPos.z + endPos.z) / 2 + 1.5,
      );

      const delay = i * 0.04;
      const proxy = { t: 0 };

      return new Promise<void>((resolve) => {
        gsap.to(proxy, {
          t: 1,
          duration: 0.55,
          delay,
          ease: 'power3.in',
          onUpdate: () => {
            const t = proxy.t;
            // Quadratic bezier
            const omt = 1 - t;
            stone.group.position.set(
              omt * omt * startPos.x + 2 * omt * t * midPos.x + t * t * endPos.x,
              omt * omt * startPos.y + 2 * omt * t * midPos.y + t * t * endPos.y,
              omt * omt * startPos.z + 2 * omt * t * midPos.z + t * t * endPos.z,
            );
            const squash = 1 - Math.sin(t * Math.PI) * 0.25;
            stone.matte.scale.set(squash, 1, squash);
            stone.group.rotation.z = t * Math.PI * 2 * (i % 2 === 0 ? 1 : -1) * 0.5;
          },
          onComplete: () => {
            stone.state = 'in_tray';
            stone.matte.scale.set(1, 1, 1);
            stone.group.rotation.z = 0;
            resolve();
          },
        });
      });
    });

    await Promise.all(promises);
    this.collectedColors.add(color);
    this.phase = 'awaiting_tray';
    this.pulseTray();
  }

  private computeTraySlots(count: number): { x: number; z: number }[] {
    const slots: { x: number; z: number }[] = [];
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const spacingX = 0.55;
    const spacingZ = 0.45;
    const startX = -((cols - 1) * spacingX) / 2;
    const startZ = -((rows - 1) * spacingZ) / 2;

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      slots.push({
        x: startX + col * spacingX,
        z: startZ + row * spacingZ,
      });
    }
    return slots;
  }

  private pulseTray(): void {
    this.trayPulseTween?.kill();
    this.trayPulseTween = gsap.to(this.trayGroup.scale, {
      x: 1.04,
      y: 1.04,
      z: 1.04,
      duration: 0.6,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });
  }

  private armOutlineReturn(): void {
    if (!this.activeColor) return;
    this.phase = 'awaiting_outline';
    this.stopTrayPulse();
    this.setHint('Tap the empty outline');

    const colorStones = this.stones.filter((s) => s.color === this.activeColor);
    colorStones.forEach((s) => {
      gsap.to(s.outline.material, {
        opacity: 0.85,
        duration: 0.35,
        ease: 'power2.out',
      });
      gsap.to(s.outline.scale, {
        x: 1.08,
        y: 1.08,
        z: 1.08,
        duration: 0.5,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    });
  }

  private stopOutlinePulse(color: StoneColor): void {
    this.stones
      .filter((s) => s.color === color)
      .forEach((s) => {
        gsap.killTweensOf(s.outline.scale);
        s.outline.scale.set(1, 1, 1);
      });
  }

  private stopTrayPulse(): void {
    this.trayPulseTween?.kill();
    gsap.to(this.trayGroup.scale, { x: 1, y: 1, z: 1, duration: 0.2 });
  }

  private async returnStones(color: StoneColor): Promise<void> {
    this.stopOutlinePulse(color);
    this.phase = 'returning';
    this.setHint('');

    const colorStones = this.stones.filter(
      (s) => s.color === color && s.state === 'in_tray',
    );

    const promises = colorStones.map((stone, i) => {
      const { wx, wy } = gridToWorld(stone.cell.x, stone.cell.y);
      const target = new THREE.Vector3(wx, wy, 0);
      const start = stone.group.position.clone();
      const mid = new THREE.Vector3(
        (start.x + target.x) / 2,
        Math.max(start.y, target.y) + 2,
        1.8,
      );

      const delay = i * 0.05;
      const proxy = { t: 0 };

      return new Promise<void>((resolve) => {
        gsap.to(proxy, {
          t: 1,
          duration: 0.7,
          delay,
          ease: 'power2.inOut',
          onUpdate: () => {
            const t = proxy.t;
            const omt = 1 - t;
            stone.group.position.set(
              omt * omt * start.x + 2 * omt * t * mid.x + t * t * target.x,
              omt * omt * start.y + 2 * omt * t * mid.y + t * t * target.y,
              omt * omt * start.z + 2 * omt * t * mid.z + t * t * target.z,
            );
          },
          onComplete: () => {
            void this.morphToGem(stone, i, colorStones.length);
            resolve();
          },
        });
      });
    });

    await Promise.all(promises);
    this.placedGems.add(color);
    this.collectedColors.delete(color);
    this.activeColor = null;

    if (this.placedGems.size === 2) {
      this.phase = 'complete';
      this.onComplete();
    } else {
      this.phase = 'idle';
      const remaining = this.placedGems.has('rose') ? 'sage' : 'rose';
      this.setHint(`Tap the ${remaining} stones`);
    }
  }

  private async morphToGem(stone: Stone, index: number, total: number): Promise<void> {
    stone.state = 'gem';
    this.audio.playMorph(index, total);

    const worldPos = stone.group.position.clone();
    worldPos.z += 0.3;
    this.particles.burst(worldPos, 10, COLORS[stone.color].emissive);
    this.particles.ring(worldPos, COLORS[stone.color].emissive);

    // Squash matte, reveal gem
    await gsap.to(stone.matte.scale, {
      x: 1.3,
      y: 0.2,
      z: 1.3,
      duration: 0.12,
      ease: 'power2.in',
    });

    stone.gem.visible = true;
    stone.matte.visible = false;

    await gsap.to(stone.gem.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 0.55,
      ease: 'back.out(2.5)',
    });

    // Halo flash
    gsap.to(stone.halo.material, {
      opacity: 0.7,
      duration: 0.15,
      ease: 'power2.out',
      yoyo: true,
      repeat: 1,
    });

    // Gentle idle shimmer on gem
    gsap.to(stone.gem.rotation, {
      z: Math.PI * 2,
      duration: 8 + index * 0.3,
      ease: 'none',
      repeat: -1,
    });

    gsap.to((stone.gem.material as THREE.MeshPhysicalMaterial), {
      emissiveIntensity: 0.55,
      duration: 0.3,
      ease: 'power2.out',
    });
  }

  private onComplete(): void {
    this.setHint('✨ Complete!', false);
    this.audio.playCompletion();

    const center = new THREE.Vector3(0, -0.5, 0.5);
    this.particles.celebration(center);

    // Global gem pulse
    this.stones
      .filter((s) => s.state === 'gem')
      .forEach((stone, i) => {
        gsap.to(stone.gem.scale, {
          x: 1.15,
          y: 1.15,
          z: 1.15,
          duration: 0.5,
          delay: i * 0.02,
          ease: 'back.out(3)',
          yoyo: true,
          repeat: 1,
        });
      });

    // Subtle camera celebration nudge
    gsap.to(this.camera.position, {
      z: 13.2,
      duration: 1.2,
      ease: 'power2.inOut',
      yoyo: true,
      repeat: 1,
    });
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    // Portrait-friendly camera framing
    const isPortrait = h > w;
    this.camera.position.y = isPortrait ? 0.2 : 0.5;
    this.camera.position.z = isPortrait ? 15 : 14;
    this.mosaicGroup.position.y = isPortrait ? 1.2 : 0.8;
    this.mosaicGroup.scale.setScalar(isPortrait ? 0.95 : 1);
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    const dt = this.clock.getDelta();
    this.particles.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}

new CozyMosaicGame();
