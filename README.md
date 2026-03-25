# 🌀 GARGANTUA

Real-time WebGL simulation of the Gargantua black hole from **Interstellar**.

Gravitational lensing, the Doppler effect, and accretion disk physics — all in the browser.

![Three.js](https://img.shields.io/badge/Three.js-r170-orange?logo=three.js)
![WebGL](https://img.shields.io/badge/WebGL-2.0-green?logo=webgl)
![Vite](https://img.shields.io/badge/Vite-6-purple?logo=vite)

---

## 🚀 Launch it.

```bash
# Install dependencies.
npm install

# Development server
npm run dev

# Production build
npm run build

# Build preview
npm run preview
```

---

## 🏗️ Architecture

```
Gargantua/
├── config/                  # Configuration files
│   ├── camera.config.js     #   Camera presets, orbit settings
│   ├── physics.config.js    #   Schwarzschild, Kerr, accretion disk
│   ├── postfx.config.js     #   Bloom, HDR, film grain parameters
│   └── render.config.js     #   Renderer, quality levels, tone mapping
│
├── src/
│   ├── main.js              # Entry point — initializes the app
│   │
│   ├── core/                # Core modules
│   │   ├── App.js           #   Main application — integrates all modules
│   │   ├── Camera.js        #   Camera control, presets, cinematic paths
│   │   ├── Clock.js         #   Time management, delta, FPS, time dilation
│   │   ├── Renderer.js      #   WebGL render pipeline, HDR, adaptive quality
│   │   └── Scene.js         #   Full-screen quad, shader uniforms
│   │
│   ├── shaders/             # GLSL shader files
│   │   ├── blackhole.vert   #   Vertex shader — screen quad
│   │   ├── blackhole.frag   #   Fragment shader — ray marching
│   │   ├── accretion.glsl   #   Accretion disk calculations
│   │   ├── doppler.glsl     #   Doppler shift and beaming
│   │   ├── lensing.glsl     #   Gravitational lensing
│   │   ├── noise.glsl       #   Procedural noise functions
│   │   └── tonemap.glsl     #   ACES tone mapping and gamma
│   │
│   ├── physics/             # CPU-based physics calculations
│   │   ├── Schwarzschild.js #   Schwarzschild metric
│   │   ├── KerrMetric.js    #   Kerr metric (rotating black hole)
│   │   ├── Geodesic.js      #   Geodesic paths
│   │   ├── DopplerBeaming.js#   Doppler beaming calculations
│   │   └── GravitationalRedshift.js  # Gravitational redshift
│   │
│   ├── objects/             # 3D objects
│   │   ├── BlackHole.js     #   Black hole
│   │   ├── AccretionDisk.js #   Accretion disk
│   │   ├── PhotonRing.js    #   Photon ring
│   │   ├── JetStream.js     #   Jet streams
│   │   └── Starfield.js     #   Starfield
│   │
│   ├── postprocessing/      # Post-processing effects
│   │   ├── BloomPass.js     #   Bloom effect
│   │   ├── HDRPipeline.js   #   HDR pipeline
│   │   ├── ChromaticAberration.js  # Chromatic aberration
│   │   ├── FilmGrain.js     #   Film grain
│   │   ├── LensFlare.js     #   Lens flare
│   │   └── MotionBlur.js    #   Motion blur
│   │
│   ├── controls/            # User controls
│   │   ├── OrbitControls.js #   Orbit controls (mouse)
│   │   ├── ParameterPanel.js#   GUI panel
│   │   ├── KeyboardShortcuts.js  # Keyboard shortcuts
│   │   └── CameraPath.js   #   Cinematic camera paths
│   │
│   └── utils/               # Utility modules
│       ├── ShaderLoader.js  #   GLSL file loader
│       ├── TextureLoader.js #   Texture management
│       ├── MathUtils.js     #   Mathematical functions
│       ├── PerformanceMonitor.js  # FPS and GPU monitoring
│       └── Exporter.js      #   Screenshot and video export
│
├── public/
│   └── index.html           # HTML — canvas and loading screen
│
├── package.json
├── vite.config.js
└── README.md
```

---

## 🎮 Controls

| Key | Action |
|-------|--------|
| Mouse drag | Rotate camera |
| Scroll | Zoom in / out |
| `1`-`6` | Camera presets |
| `Space` | Pause / resume |
| `S` | Screenshot |
| `R` | Record video |
| `Q` | Change quality |

---

## ⚙️ Quality levels

| Level | Steps | Bloom | Resolution |
|-------|-------|-------|------------|
| **Low** | 150 | 3 pass | 50% |
| **Medium** | 250 | 4 pass | 75% |
| **High** | 300 | 5 pass | 100% |
| **Ultra** | 500 | 6 pass | 150% |

---

## 📐 Physics formulas

- **Schwarzschild radius**: `Rs = 2GM/c²`
- **Kerr metric**: Spacetime for a rotating black hole
- **Geodesic equations**: Curved path of light
- **Doppler effect**: Color and brightness changes
- **ACES tone mapping**: HDR → SDR conversion

---

## 🛠️ Technologies

- **[Three.js](https://threejs.org/)** — WebGL render engine
- **GLSL** — GPU shader programming
- **[Vite](https://vitejs.dev/)** — Build tool and dev server

---

## 📄 License

MIT
