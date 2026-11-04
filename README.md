# PlayGround

## The Great War — Five Banners

A complete, self-contained WWI real-time strategy game rendered with Canvas 2D. Five empires fight for the continental front: Germany, France, Britain, Austria-Hungary, and Russia. Every empire can be commanded by the player; the others are run by AI field staffs.

There are no external assets, frameworks, or build steps. The game is plain HTML, CSS, and ES modules.

### Play

Serve the folder as a static site, then open the page:

```bash
python3 -m http.server 3002
# open http://localhost:3002
```

The host environment's `start.sh` also starts the same static server on `PORT` (default `3002`). The opening screen lets you choose a starting empire; Germany is selected by default.

### Controls

| Input | Action |
| --- | --- |
| Left mouse | Select a regiment; drag to box-select |
| Right mouse | Move or attack |
| `WASD` / arrow keys | Pan the front |
| Mouse wheel / pinch | Zoom |
| `1`–`5` | Switch command to another empire |
| `H` / `S` | Dig in / stop |
| `F` | Focus the selected sector |
| `Q` | Artillery barrage, then click the target |
| `Z` `X` `C` `V` `B` | Recruit infantry, MG, artillery, cavalry, special |
| `Space` / `P` | Pause |
| `M` | Toggle sound |
| Touch | Drag to pan, pinch to zoom, tap a unit, then tap ground/enemy to order |

Recruit cards deploy to the selected friendly sector. Hold **11 of 15 sectors for 42 seconds** to force an armistice, or capture an enemy capital to knock that empire out. If the empire you are commanding capitulates, command passes to the largest surviving empire.

### Design assumptions

- This is an alternate-history **free-for-all**, not a recreation of historical alliances. All five empires are hostile to one another.
- It is a single-player game. Inactive empires are AI-controlled; switching banners hands the previous empire to its AI staff.
- The map is a painted strategic abstraction with 15 sectors, not a geographic simulation.
- Audio is procedurally generated with Web Audio and starts after the first user gesture.

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
