# PlayGround

## 🌲 Everwild — A Forest Exploration

A first-person exploration adventure set in a fully procedural, hand-shaded wilderness.
No guns, no combat — just wander, look closely, and find all six hidden landmarks.

**Play it:** serve the repo root statically and open `index.html` (e.g. `npx serve .` or any static host). Three.js is vendored locally — no build step and no network needed at runtime.

### Highlights
- **Hyper-detailed water shader** — Gerstner vertex waves, two-octave scrolling detail normals, fresnel sky reflection, sun/moon glitter, depth-tinted body colour from a baked float heightmap, and animated lapping shore foam.
- **Procedural mountains** — ridged multifractal massif with snowline, rock-on-slope and valley carving; rim peaks enclose the world.
- **Living forest** — 2,000+ instanced wind-swayed pines, bushes, boulders, grass tufts and wildflowers, all with per-instance variation.
- **Dynamic sky** — gradient dome with sun/moon discs, twinkling stars, and FbM clouds; full golden hour→midday→dusk→night cycle (`C`).
- **Six landmarks** — Crystal Lake dock, The Great Falls, Eagle's Overlook, Ember Camp, The Ancient Elder and Sunstone Cairn. Discovery toasts, compass ticks, a relief minimap and a completion ceremony.
- **Procedural ambience** — wind, birdsong by day, crickets by night, campfire crackle and footsteps, all synthesized with Web Audio (no assets).
- **Desktop & mobile** — pointer-lock mouse look + WASD/Shift/Space, or left-thumb joystick and right-thumb drag look on touch devices, with safe-area-aware HUD.

### Controls
| Input | Action |
| --- | --- |
| `W A S D` / arrows | Move |
| Mouse | Look (pointer lock) |
| `Shift` | Sprint (stamina) |
| `Space` | Jump |
| `C` | Cycle time of day |
| `M` | Mute ambience |
| `H` / `?` | Pause & controls |

### Verification
Flow tested headlessly with `playwright-cli` (headed Chromium under Xvfb, SwiftShader software rendering): spawn vista, all six discovery triggers, golden hour / midday / night lighting, completion banner, and 390×844 mobile layout.

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://go.ondev.store/).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://go.ondev.store/glitchdingle-cpu/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/glitchdingle-cpu/PlayGround)

- 🎮 [Open the project](https://go.ondev.store/glitchdingle-cpu/PlayGround).
- ✨ [Remix this project](https://go.ondev.store/glitchdingle-cpu/PlayGround?remix=1).
- 💻 [Explore the source](https://github.com/glitchdingle-cpu/PlayGround).
- 🛠️ [Check build runs](https://github.com/glitchdingle-cpu/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/glitchdingle-cpu/PlayGround/issues).
- 👤 [Explore the creator's projects](https://go.ondev.store/glitchdingle-cpu).
- 🌍 [Create with OMGithub](https://go.ondev.store/).
<!-- omgithub:readme:end -->
