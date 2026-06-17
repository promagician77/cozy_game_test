import * as THREE from 'three';

interface Particle {
  mesh: THREE.Sprite;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private readonly group = new THREE.Group();
  private readonly textures: Record<string, THREE.Texture>;

  constructor(scene: THREE.Scene) {
    this.textures = {
      sparkle: this.createSparkleTexture(),
      ring: this.createRingTexture(),
    };
    scene.add(this.group);
  }

  private createSparkleTexture(): THREE.Texture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.2, 'rgba(255, 240, 220, 0.9)');
    grad.addColorStop(0.5, 'rgba(255, 200, 180, 0.4)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Cross sparkle arms
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-size * 0.35, 0);
    ctx.lineTo(size * 0.35, 0);
    ctx.moveTo(0, -size * 0.35);
    ctx.lineTo(0, size * 0.35);
    ctx.stroke();
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  private createRingTexture(): THREE.Texture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.strokeStyle = 'rgba(255, 230, 200, 0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.38, 0, Math.PI * 2);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  burst(position: THREE.Vector3, count = 12, color = 0xffffff): void {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.textures.sparkle,
        color,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.copy(position);
      sprite.scale.setScalar(0.15 + Math.random() * 0.1);

      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 0.8 + Math.random() * 1.2;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed + 0.5,
        (Math.random() - 0.5) * 0.5,
      );

      this.particles.push({
        mesh: sprite,
        velocity,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.3,
      });
      this.group.add(sprite);
    }
  }

  ring(position: THREE.Vector3, color = 0xffe8c8): void {
    const mat = new THREE.SpriteMaterial({
      map: this.textures.ring,
      color,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    sprite.scale.setScalar(0.3);

    this.particles.push({
      mesh: sprite,
      velocity: new THREE.Vector3(0, 0.2, 0),
      life: 0,
      maxLife: 0.8,
    });
    this.group.add(sprite);
  }

  celebration(center: THREE.Vector3): void {
    for (let wave = 0; wave < 3; wave++) {
      setTimeout(() => {
        for (let i = 0; i < 24; i++) {
          const angle = (i / 24) * Math.PI * 2;
          const radius = 1.5 + wave * 0.8;
          const pos = new THREE.Vector3(
            center.x + Math.cos(angle) * radius,
            center.y + Math.sin(angle) * radius * 0.6,
            center.z + 0.5,
          );
          this.burst(pos, 4, wave % 2 === 0 ? 0xffd4a8 : 0xffffff);
        }
        this.ring(
          new THREE.Vector3(center.x, center.y, center.z + 0.3),
          0xffe0b0,
        );
      }, wave * 200);
    }
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      const t = p.life / p.maxLife;

      p.mesh.position.addScaledVector(p.velocity, dt);
      p.velocity.y -= dt * 1.5;
      p.velocity.multiplyScalar(1 - dt * 0.8);

      const mat = p.mesh.material as THREE.SpriteMaterial;
      mat.opacity = 1 - t * t;

      if (p.mesh.material.map === this.textures.ring) {
        p.mesh.scale.setScalar(0.3 + t * 2.5);
      } else {
        p.mesh.scale.setScalar((0.15 + Math.random() * 0.05) * (1 - t * 0.5));
      }

      if (p.life >= p.maxLife) {
        this.group.remove(p.mesh);
        mat.dispose();
        this.particles.splice(i, 1);
      }
    }
  }
}
