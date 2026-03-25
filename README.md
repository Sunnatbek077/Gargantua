Here is your project rewritten cleanly in English while keeping the same structure and meaning:

⸻

🌀 GARGANTUA

A real-time WebGL simulation of the Gargantua black hole from Interstellar.

Gravitational lensing, Doppler effects, and accretion disk physics — all rendered directly in the browser.


⸻

🚀 Getting Started

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview


⸻

🏗️ Architecture

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
│   │   └── tonemap.glsl     #   ACES tone mapping and gamma correction
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
│   │   └── Starfield.js     #   Star background
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
│   │   ├── OrbitControls.js #   Mouse orbit controls
│   │   ├── ParameterPanel.js#   GUI panel
│   │   ├── KeyboardShortcuts.js  # Keyboard shortcuts
│   │   └── CameraPath.js    #   Cinematic camera paths
│   │
│   └── utils/               # Utility modules
│       ├── ShaderLoader.js  #   Load GLSL files
│       ├── TextureLoader.js #   Texture management
│       ├── MathUtils.js     #   Math utilities
│       ├── PerformanceMonitor.js  # FPS and GPU monitoring
│       └── Exporter.js      #   Screenshot and video export
│
├── public/
│   └── index.html           # HTML — canvas and loading screen
│
├── package.json
├── vite.config.js
└── README.md


⸻

🎮 Controls

Key	Action
Mouse drag	Rotate camera
Scroll	Zoom in / out
1–6	Camera presets
Space	Pause / resume
S	Take screenshot
R	Record video
Q	Change quality


⸻

⚙️ Quality Levels

Level	Steps	Bloom	Resolution
Low	150	3 passes	50%
Medium	250	4 passes	75%
High	300	5 passes	100%
Ultra	500	6 passes	150%


⸻

📐 Physics Formulas
	•	Schwarzschild radius: Rs = 2GM/c²
	•	Kerr metric: Spacetime of a rotating black hole
	•	Geodesic equations: Curved paths of light
	•	Doppler effect: Color and brightness shift
	•	ACES tone mapping: HDR → SDR conversion

⸻

🛠️ Technologies
	•	Three.js — WebGL rendering engine
	•	GLSL — GPU shader programming
	•	Vite — Build tool and development server

⸻

📄 License

MIT

⸻

If you want, I can also:
	•	make it more “GitHub viral” (polished README with badges, GIFs, demo section)
	•	add a live demo section (Netlify/Vercel)
	•	or rewrite it in a more “scientific / academic” style