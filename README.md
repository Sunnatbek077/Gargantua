# 🌀 GARGANTUA

**Interstellar** filmidagi Gargantua qora tuynugining real-time WebGL simulyatsiyasi.

Gravitatsion linzalash, Doppler effekti, accretion disk fizikasi — barchasi brauzerda.

![Three.js](https://img.shields.io/badge/Three.js-r170-orange?logo=three.js)
![WebGL](https://img.shields.io/badge/WebGL-2.0-green?logo=webgl)
![Vite](https://img.shields.io/badge/Vite-6-purple?logo=vite)

---

## 🚀 Ishga tushirish

```bash
# Bog'liqliklarni o'rnatish
npm install

# Development server
npm run dev

# Production build
npm run build

# Build preview
npm run preview
```

---

## 🏗️ Arxitektura

```
Gargantua/
├── config/                  # Konfiguratsiya fayllari
│   ├── camera.config.js     #   Kamera presetlari, orbita sozlamalari
│   ├── physics.config.js    #   Schwarzschild, Kerr, accretion disk
│   ├── postfx.config.js     #   Bloom, HDR, film grain parametrlari
│   └── render.config.js     #   Renderer, sifat darajalari, tone mapping
│
├── src/
│   ├── main.js              # Entry point — ilovani ishga tushirish
│   │
│   ├── core/                # Yadro modullari
│   │   ├── App.js           #   Asosiy ilova — barcha modullarni birlashtiradi
│   │   ├── Camera.js        #   Kamera boshqaruvi, presetlar, kinematik yo'llar
│   │   ├── Clock.js         #   Vaqt boshqaruvi, delta, FPS, time dilation
│   │   ├── Renderer.js      #   WebGL render pipeline, HDR, adaptiv sifat
│   │   └── Scene.js         #   Full-screen quad, shader uniform'lar
│   │
│   ├── shaders/             # GLSL shader fayllari
│   │   ├── blackhole.vert   #   Vertex shader — ekran quad
│   │   ├── blackhole.frag   #   Fragment shader — ray marching
│   │   ├── accretion.glsl   #   Accretion disk hisoblash
│   │   ├── doppler.glsl     #   Doppler sur'ish va beaming
│   │   ├── lensing.glsl     #   Gravitatsion linzalash
│   │   ├── noise.glsl       #   Procedural noise funksiyalari
│   │   └── tonemap.glsl     #   ACES tone mapping va gamma
│   │
│   ├── physics/             # Fizika hisoblashlar (CPU)
│   │   ├── Schwarzschild.js #   Schwarzschild metriki
│   │   ├── KerrMetric.js    #   Kerr metriki (aylanuvchi qora tuynuk)
│   │   ├── Geodesic.js      #   Geodezik chiziqlari
│   │   ├── DopplerBeaming.js#   Doppler beaming hisoblash
│   │   └── GravitationalRedshift.js  # Gravitatsion qizil siljish
│   │
│   ├── objects/             # 3D obyektlar
│   │   ├── BlackHole.js     #   Qora tuynuk
│   │   ├── AccretionDisk.js #   Accretion disk
│   │   ├── PhotonRing.js    #   Foton halqa
│   │   ├── JetStream.js     #   Jet oqimlari
│   │   └── Starfield.js     #   Yulduzli fon
│   │
│   ├── postprocessing/      # Post-processing effektlar
│   │   ├── BloomPass.js     #   Bloom efekti
│   │   ├── HDRPipeline.js   #   HDR pipeline
│   │   ├── ChromaticAberration.js  # Xromatik aberratsiya
│   │   ├── FilmGrain.js     #   Film grain
│   │   ├── LensFlare.js     #   Linza porlashi
│   │   └── MotionBlur.js    #   Harakat xiraligi
│   │
│   ├── controls/            # Foydalanuvchi boshqaruvi
│   │   ├── OrbitControls.js #   Orbita boshqaruvi (sichqoncha)
│   │   ├── ParameterPanel.js#   GUI panel
│   │   ├── KeyboardShortcuts.js  # Klaviatura qisqa yo'llari
│   │   └── CameraPath.js   #   Kinematografik kamera yo'llari
│   │
│   └── utils/               # Yordamchi modullar
│       ├── ShaderLoader.js  #   GLSL fayllarni yuklash
│       ├── TextureLoader.js #   Texture boshqaruvi
│       ├── MathUtils.js     #   Matematik funksiyalar
│       ├── PerformanceMonitor.js  # FPS va GPU monitoring
│       └── Exporter.js      #   Screenshot va video eksport
│
├── public/
│   └── index.html           # HTML — canvas va loading ekran
│
├── package.json
├── vite.config.js
└── README.md
```

---

## 🎮 Boshqaruv

| Tugma | Vazifa |
|-------|--------|
| Sichqoncha suring | Kamera aylanishi |
| Scroll | Yaqinlashtirish / uzoqlashtirish |
| `1`-`6` | Kamera presetlari |
| `Space` | Pauza / davom |
| `S` | Screenshot |
| `R` | Video yozish |
| `Q` | Sifat o'zgartirish |

---

## ⚙️ Sifat darajalari

| Daraja | Qadam | Bloom | Resolution |
|--------|-------|-------|------------|
| **Low** | 150 | 3 pass | 50% |
| **Medium** | 250 | 4 pass | 75% |
| **High** | 300 | 5 pass | 100% |
| **Ultra** | 500 | 6 pass | 150% |

---

## 📐 Fizika formulalari

- **Schwarzschild radiusi**: `Rs = 2GM/c²`
- **Kerr metriki**: Aylanuvchi qora tuynuk uchun fazovaqt
- **Geodezik tenglamalar**: Nurning egri yo'li
- **Doppler effekti**: Rang va yorqinlik o'zgarishi
- **ACES tone mapping**: HDR → SDR konvertatsiya

---

## 🛠️ Texnologiyalar

- **[Three.js](https://threejs.org/)** — WebGL render engine
- **GLSL** — GPU shader dasturlash
- **[Vite](https://vitejs.dev/)** — Build tool va dev server

---

## 📄 Litsenziya

MIT
