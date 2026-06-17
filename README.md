# Cozy Mosaic — Trial Task

A single-screen cozy 3D puzzle prototype: tap a color zone, vacuum matte stones into a tray, then place them back as glittering faceted gems.

## Live demo

Deploy with one click:

```bash
npm install
npm run build
npx vercel --prod
```

Or use Netlify / GitHub Pages — `dist/` is the static output.

Local dev:

```bash
npm install
npm run dev
```

## How it was built (AI workflow)

Built with **Cursor + Claude** driving implementation: brief → scene architecture → animation polish pass. I owned art direction (cozy palette, heart mosaic, gem materials), motion timing (GSAP overshoot, staggered vacuum), and juice (Web Audio morph chime, particle sparkles). AI generated the Three.js scaffolding; I iterated on feel until the matte-to-gem read as magic.

## Stack

- TypeScript, Vite, Three.js
- GSAP for weighted easing / overshoot
- Web Audio API (procedural sounds, no assets)
- Canvas-generated particle sprites

## Interaction

1. **Tap a color** on the heart mosaic — stones vacuum into the tray
2. **Tap the tray** — stones fly back and morph into glossy gems
3. Repeat for the second color
4. **Completion sparkle** when both zones are placed

Mobile-first, portrait, touch-friendly.

## Client brief alignment

| Requirement | Implementation |
|---|---|
| 10×10–12×12 grid, two colors | 11×11 heart, rose + sage |
| Vacuum to tray | Staggered curved GSAP path with squash |
| Tap tray → fly back | Arc flight with `back.out` landing |
| Matte disc → faceted gem | Crossfade scale + emissive ramp + halo ring |
| Morph sound | Layered sine chime + sparkle noise |
| Particle sparkle | Per-stone burst + completion rings |
| Completion when both placed | Global gem pulse + particle celebration |
| Web only, no engine | Plain Three.js + TS |

## License

Work-for-hire trial deliverable.
