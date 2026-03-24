/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Render Configuration
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Three.js renderer sozlamalari va render pipeline konfiguratsiyasi.
 *
 * Bu fayl GPU render jarayonini boshqaradi:
 *   - Ekran o'lchamlari va piksel nisbati
 *   - Anti-aliasing sozlamalari
 *   - Render targetlar (off-screen bufferlar)
 *   - Sifat darajalari (low/medium/high/ultra)
 *   - Performance budjet
 *
 * Formulalar:
 *   #26 — ACES tone mapping parametrlari
 *   #36 — Luminance hisoblash (bloom threshold uchun)
 *   #37 — Gamma korreksiya
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const RenderConfig = {

  // ─────────────────────────────────────────────────────────────────────────
  // I. RENDERER ASOSIY SOZLAMALARI
  // ─────────────────────────────────────────────────────────────────────────
  renderer: {
    // Piksel nisbati — Retina displaylar uchun
    // 1.0 = oddiy, 2.0 = retina sifat, 'auto' = qurilma asosida
    pixelRatio: 'auto',
    maxPixelRatio: 2.0,      // Retina'da 2x dan oshmasin (performance)

    // Anti-aliasing
    antialias: false,        // Three.js AA o'chirilgan — FXAA post-process ishlatiladi
    
    // Rang formati
    outputColorSpace: 'srgb-linear',  // Chiziqli rang makon (tone mapping uchun)

    // Tone mapping
    // ── Formula #26: ACES Filmic ──
    // Three.js ichida: THREE.ACESFilmicToneMapping
    toneMapping: 'ACESFilmic',
    toneMappingExposure: 1.0,

    // Fon
    clearColor: 0x000000,    // Mutlaq qora
    clearAlpha: 1.0,

    // Render format — HDR pipeline uchun
    // HalfFloat = 16-bit float (yetarli aniqlik, kam xotira)
    frameBufferType: 'HalfFloat',

    // Logarifmik chuqurlik buffer (katta masshtab farqi uchun)
    logarithmicDepthBuffer: true,

    // Power preference — GPU tanlash
    // 'high-performance' = diskret GPU (agar mavjud)
    // 'low-power' = integratsiyalangan GPU
    powerPreference: 'high-performance',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // II. RENDER TARGET SOZLAMALARI
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Qora tuynuk simulyatsiyasi uchun multi-pass render pipeline:
  //   Pass 1: Asosiy ray marching → mainTarget (HDR)
  //   Pass 2: Yorqin joylarni ajratish → brightTarget
  //   Pass 3: Gaussian blur (ikki o'tish) → blurTargets
  //   Pass 4: Bloom birlashtirish → compositeTarget
  //   Pass 5: Tone mapping + grain → ekran
  // ─────────────────────────────────────────────────────────────────────────
  renderTargets: {
    // Asosiy HDR buffer
    main: {
      scale: 1.0,            // Ekran o'lchamiga nisbatan
      format: 'RGBAFormat',
      type: 'HalfFloatType',
      minFilter: 'LinearFilter',
      magFilter: 'LinearFilter',
      generateMipmaps: false,
    },

    // Bloom uchun yorqin joylar
    bright: {
      scale: 0.5,            // Yarim o'lcham (performance)
      format: 'RGBAFormat',
      type: 'HalfFloatType',
      minFilter: 'LinearFilter',
      magFilter: 'LinearFilter',
      generateMipmaps: false,
    },

    // Gaussian blur bufferlar (ping-pong)
    blur: {
      scale: 0.5,
      passes: 2,             // Ikki o'tishli blur (H + V)
      format: 'RGBAFormat',
      type: 'HalfFloatType',
      minFilter: 'LinearFilter',
      magFilter: 'LinearFilter',
      generateMipmaps: false,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // III. SIFAT DARAJALARI (Quality Presets)
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Qurilma imkoniyatiga qarab avtomatik tanlanadi
  // yoki foydalanuvchi qo'lda tanlashi mumkin.
  // ─────────────────────────────────────────────────────────────────────────
  qualityPresets: {

    low: {
      label: 'Tez (720p)',
      resolution: 0.5,       // Ekranning yarmi
      rayMarchSteps: 150,    // Kamroq qadam
      bloomPasses: 3,        // Kamroq blur
      bloomScale: 0.25,      // Kichikroq blur buffer
      noiseOctaves: 3,       // Kamroq detail
      adaptiveStep: false,   // Oddiy fixed step
      chromaticAberration: false,
      filmGrain: false,
      targetFPS: 60,
    },

    medium: {
      label: 'Muvozanat (1080p)',
      resolution: 0.75,
      rayMarchSteps: 250,
      bloomPasses: 4,
      bloomScale: 0.5,
      noiseOctaves: 5,
      adaptiveStep: true,
      chromaticAberration: true,
      filmGrain: true,
      targetFPS: 60,
    },

    high: {
      label: 'Sifatli (native)',
      resolution: 1.0,
      rayMarchSteps: 300,
      bloomPasses: 5,
      bloomScale: 0.5,
      noiseOctaves: 6,
      adaptiveStep: true,
      chromaticAberration: true,
      filmGrain: true,
      targetFPS: 30,
    },

    ultra: {
      label: 'Ultra (screenshot)',
      resolution: 1.5,       // Supersampling
      rayMarchSteps: 500,
      bloomPasses: 6,
      bloomScale: 0.5,
      noiseOctaves: 8,
      adaptiveStep: true,
      chromaticAberration: true,
      filmGrain: true,
      targetFPS: 15,         // Real-time emas
    },
  },

  // Boshlang'ich sifat darajasi
  defaultQuality: 'medium',

  // ─────────────────────────────────────────────────────────────────────────
  // IV. PERFORMANCE MONITORING
  // ─────────────────────────────────────────────────────────────────────────
  performance: {
    // FPS monitoring
    showFPS: true,
    fpsUpdateInterval: 500,  // ms — HUD yangilanish chastotasi

    // Adaptiv sifat — FPS pastga tushsa avtomatik kamaytirish
    adaptiveQuality: true,
    minAcceptableFPS: 24,    // Bu ostida sifat pasaytiriladi
    qualityCheckInterval: 2000,  // ms — har 2 sekundda tekshirish

    // GPU xotira chegarasi (MB)
    maxTextureMemory: 512,

    // Frame timing budget (ms)
    frameBudget: 16.67,      // 60 FPS = 16.67ms per frame
  },

  // ─────────────────────────────────────────────────────────────────────────
  // V. TONE MAPPING PARAMETRLARI
  // ─────────────────────────────────────────────────────────────────────────
  toneMapping: {
    // ── Formula #26: ACES Filmic Tone Mapping ──
    // f(x) = (x(ax+b)) / (x(cx+d)+e)
    aces: {
      a: 2.51,
      b: 0.03,
      c: 2.43,
      d: 0.59,
      e: 0.14,
    },

    // Ekspozitsiya
    exposure: 1.0,
    minExposure: 0.1,
    maxExposure: 5.0,

    // ── Formula #37: Gamma korreksiya ──
    // color_out = pow(color_linear, 1.0/gamma)
    gamma: 2.2,

    // ── Formula #36: Luminance (yorqinlik) ──
    // L = 0.2126·R + 0.7152·G + 0.0722·B
    luminanceCoefficients: [0.2126, 0.7152, 0.0722],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VI. TEXTURE SOZLAMALARI
  // ─────────────────────────────────────────────────────────────────────────
  textures: {
    // Yulduzli osmon cubemap
    starfield: {
      resolution: 2048,       // Har bir yuz uchun piksel
      format: 'RGBFormat',
      encoding: 'sRGBEncoding',
    },

    // Accretion disk noise texture
    noiseTexture: {
      resolution: 512,
      format: 'RGBAFormat',
      wrapS: 'RepeatWrapping',
      wrapT: 'RepeatWrapping',
    },
  },
};

// Asosiy sozlamalarni muzlatish
Object.freeze(RenderConfig.renderer);
Object.freeze(RenderConfig.toneMapping);
Object.freeze(RenderConfig.toneMapping.aces);
Object.freeze(RenderConfig.performance);

export default RenderConfig;