/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Post-Processing Configuration
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Kinematografik post-processing effektlar sozlamalari.
 * Bu effektlar Interstellar filmidagi vizual sifatni ta'minlaydi.
 *
 * Render pipeline tartibi:
 *   1. Ray marching natijasi (HDR)
 *   2. Bloom (yorqinlik tarqalishi)
 *   3. Chromatic Aberration (rang siljishi)
 *   4. Lens Flare (linza porlashi)
 *   5. Motion Blur (harakat xiraligi)
 *   6. Tone Mapping (HDR → SDR)
 *   7. Film Grain (donadorlik)
 *   8. FXAA (anti-aliasing)
 *   9. Vignette (qorayish)
 *
 * Formulalar:
 *   #26 — f(x) = (x(ax+b))/(x(cx+d)+e)   ACES tone mapping
 *   #27 — G(x,y) = 1/(2πσ²)·e^...         Gaussian blur (bloom)
 *   #28 — bloom = max(0, L-threshold)·I     Bloom threshold
 *   #29 — grain = fract(sin(dot(...)))·I    Film grain noise
 *   #30 — R=tex(uv+d), G=tex(uv), B=tex(uv-d)  Chromatic aberration
 *   #36 — L = 0.2126R + 0.7152G + 0.0722B  Luminance
 *   #37 — color_out = pow(color, 1/2.2)     Gamma korreksiya
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const PostFXConfig = {

  // ─────────────────────────────────────────────────────────────────────────
  // I. BLOOM — Yorqinlik tarqalishi
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Accretion diskning yorqin joylari atrofida yumshoq
  // yorug'lik tarqalishi. Interstellar'ning eng xarakterli effekti.
  //
  // Pipeline:
  //   1. Yorqinlik threshold bo'yicha bright piksellarni ajratish (#28, #36)
  //   2. Gaussian blur qo'llash (#27) — bir necha o'tish
  //   3. Asl rasm + blur natijasini birlashtirish
  // ─────────────────────────────────────────────────────────────────────────
  bloom: {
    enabled: true,

    // ── Formula #28: Threshold ──
    // bloom = max(0, luminance - threshold) * intensity
    // INTERSTELLAR: pastroq threshold — ko'proq porlash
    threshold: 0.12,

    // INTERSTELLAR: kuchliroq bloom — disk atrofida keng glow
    intensity: 4.5,

    // ── Formula #27: Gaussian blur ──
    // Blur radiusi (sigma) va o'tishlar soni
    // Ko'proq o'tish = yumshoqroq tarqalish
    radius: 0.7,
    passes: 5,               // Blur o'tishlari soni

    // INTERSTELLAR: iliqroq oltin bloom
    tint: [1.0, 0.88, 0.7],

    // Mip chain — turli o'lchamdagi blur
    // Bu katta va kichik yorqinlik doiralarini beradi
    mipLevels: [
      { scale: 0.5,  weight: 1.0 },   // Yaqin glow
      { scale: 0.25, weight: 1.0 },   // INTERSTELLAR: kuchliroq o'rta
      { scale: 0.125, weight: 0.8 },  // Keng tarqalish
      { scale: 0.0625, weight: 0.6 }, // Atmosfera — iliq halo
    ],

    // ── Formula #36: Luminance hisoblash ──
    // L = 0.2126·R + 0.7152·G + 0.0722·B
    // Bu koeffitsientlar inson ko'zi sezuvchanligiga mos
    luminanceWeights: [0.2126, 0.7152, 0.0722],

    // Anamorfik bloom (filmga xos gorizontal cho'zilish)
    anamorphic: {
      enabled: true,
      ratio: 3.0,            // INTERSTELLAR: kuchliroq gorizontal cho'zilish
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // II. HDR TONE MAPPING
  // ─────────────────────────────────────────────────────────────────────────
  //
  // HDR (High Dynamic Range) qiymatlarni ekran diapazoniga moslashtirish.
  // Qora tuynuk simulyatsiyasida juda katta yorqinlik farqi bor —
  // accretion disk 10,000x ga yorqinroq kosmik fondan.
  // ─────────────────────────────────────────────────────────────────────────
  toneMapping: {
    enabled: true,

    // ── Formula #26: ACES Filmic Tone Mapping ──
    // f(x) = (x(ax+b)) / (x(cx+d)+e)
    //
    // Hollywood standarti — Interstellar ham shu usulda ishlangan
    method: 'ACES',
    aces: {
      a: 2.51,
      b: 0.03,
      c: 2.43,
      d: 0.59,
      e: 0.14,
    },

    // Ekspozitsiya — umumiy yorqinlik
    exposure: 1.6,

    // ── Formula #37: Gamma korreksiya ──
    // color_out = pow(color_linear, vec3(1.0/gamma))
    //
    // Chiziqli rang makonidan sRGB ga o'tkazish
    gamma: 2.2,

    // Oq nuqta — maksimal yorqinlik chegarasi
    whitePoint: 4.0,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // III. FILM GRAIN — Donadorlik
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Film pellikasining tabiiy donadorligi.
  // Interstellar 70mm IMAX filmda suratga olingan —
  // bu donadorlik filmga haqiqiylik beradi.
  // ─────────────────────────────────────────────────────────────────────────
  filmGrain: {
    enabled: true,

    // ── Formula #29: Pseudo-random noise ──
    // grain = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453) * intensity
    //
    // Har kadrda uv ga vaqt qo'shiladi — donalar harakat qiladi
    // INTERSTELLAR: aniq seziluvchi 70mm IMAX grain
    intensity: 0.12,
    
    // Kattaroq donalar — film pellikasiga xos
    size: 2.0,

    // Vaqt bo'yicha o'zgarish (statik emas, tirik)
    animated: true,

    // Yorqin joylarda kamroq, qorong'i joylarda ko'proq
    // (haqiqiy film xususiyati)
    luminanceResponse: {
      shadows: 1.0,          // Qorong'i joylarda to'liq
      midtones: 0.7,         // O'rtada kamroq
      highlights: 0.3,       // Yorqinda oz
    },

    // Rang donadorligi (xromatik noise)
    chromatic: true,
    chromaticIntensity: 0.03,  // RGB kanallari biroz farqli
  },

  // ─────────────────────────────────────────────────────────────────────────
  // IV. CHROMATIC ABERRATION — Rang aberratsiyasi
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Linza imperfeksiyasi — ranglar biroz siljiydi.
  // Interstellar'da IMAX linzalar uchun xos effekt.
  // ─────────────────────────────────────────────────────────────────────────
  chromaticAberration: {
    enabled: true,

    // ── Formula #30: Rang kanallari siljishi ──
    // R = texture(uv + direction * amount)
    // G = texture(uv)
    // B = texture(uv - direction * amount)
    //
    // direction = normalize(uv - 0.5) — markazdan chetga
    intensity: 0.003,        // Juda engil — sezilmas, lekin hisga ta'sir qiladi

    // Chetda kuchliroq (haqiqiy linza xususiyati)
    radialFalloff: true,
    falloffExponent: 2.0,    // Markazda 0, chetda to'liq

    // Faqat yorqin joylarda ko'rinadi
    luminanceThreshold: 0.5,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // V. LENS FLARE — Linza porlashi
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Accretion diskning eng yorqin nuqtalaridan keladigan
  // linza porlashi. Filmda kamera linzasidagi ichki
  // yansishlar (internal reflections).
  // ─────────────────────────────────────────────────────────────────────────
  lensFlare: {
    enabled: true,

    // Umumiy kuch
    intensity: 0.15,

    // Porlash boshlanadigan yorqinlik
    threshold: 2.0,          // HDR qiymat — juda yorqin joylar

    // Ghost elementlari (linza ichki yansishlari)
    ghosts: {
      count: 4,
      spacing: 0.3,          // Markazdan masofasi
      sizes: [0.1, 0.15, 0.08, 0.2],
      intensities: [0.3, 0.2, 0.15, 0.1],
      // Har bir ghost uchun rang tinting
      tints: [
        [1.0, 0.8, 0.5],    // Oltin
        [0.7, 0.8, 1.0],    // Ko'kish
        [1.0, 0.6, 0.3],    // To'q sariq
        [0.8, 0.9, 1.0],    // Oq-ko'k
      ],
    },

    // Linza ifloslik texture
    dirtIntensity: 0.1,

    // Starburst (yorug'lik nurlari)
    starburst: {
      enabled: true,
      rays: 6,
      intensity: 0.08,
      rotation: 0.0,         // Kamera burchagiga bog'liq
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VI. MOTION BLUR — Harakat xiraligi
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Kamera tez harakatlanganda xiralashish.
  // Kinematografik ko'rinish uchun muhim.
  // ─────────────────────────────────────────────────────────────────────────
  motionBlur: {
    enabled: true,

    // Xiralashish kuchi
    intensity: 0.5,

    // Namunalar soni (ko'proq = silliqroq, lekin sekinroq)
    samples: 8,

    // Faqat kamera harakatlanganda faollashadi
    velocityThreshold: 0.01, // Minimal tezlik

    // Maksimal xiralashish (piksel)
    maxBlur: 20.0,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VII. FXAA — Anti-Aliasing
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Fast Approximate Anti-Aliasing
  // Tishli chiziqlarni yumshatish (post-processing asosida)
  // ─────────────────────────────────────────────────────────────────────────
  fxaa: {
    enabled: true,

    // Sezuvchanlik — qanchalik agressiv smoothing
    // Kichik = ko'proq smoothing
    edgeThreshold: 0.125,
    edgeThresholdMin: 0.0625,

    // Subpixel sifat
    // 1.0 = maksimal (yumshoq), 0.0 = minimal (keskin)
    subpixelQuality: 0.75,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VIII. VIGNETTE — Chetlarning qorayishi
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Ekran chetlari biroz qorayadi — kinematografik kadr hissi.
  // Interstellar'dagi IMAX kadrlarida tabiiy ravishda mavjud.
  // ─────────────────────────────────────────────────────────────────────────
  vignette: {
    enabled: true,

    // INTERSTELLAR: kuchliroq kinematografik vignette
    intensity: 0.55,

    // Qorayish ertaroq boshlanadi
    smoothness: 0.3,
    roundness: 0.8,

    // Rang — sof qora yoki biroz ko'kish
    color: [0.0, 0.0, 0.02],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // IX. COLOR GRADING — Rang sozlash
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Interstellar filmining rang palitrasiga yaqinlashtirish
  // ─────────────────────────────────────────────────────────────────────────
  colorGrading: {
    enabled: true,

    // INTERSTELLAR: biroz yuqoriroq kontrast
    contrast: 1.15,

    // INTERSTELLAR: desaturated — filmga xos "ranglar o'chirilgan" hissi
    saturation: 0.75,

    // INTERSTELLAR: iliqroq — oltin tonlar
    temperature: 5200,

    // INTERSTELLAR: ko'kish soyalar, oltin yorqin joylar
    shadowTint:    [0.01, 0.01, 0.06],   // Sovuq ko'k soyalar
    midtoneTint:   [0.0,  0.0,  0.0],    // Neytral
    highlightTint: [0.05, 0.03, 0.0],    // Iliq oltin yorqinlik
  },

  // ─────────────────────────────────────────────────────────────────────────
  // X. PIPELINE TARTIBI
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Post-processing effektlar qo'llaniladigan tartib.
  // Tartib muhim — bloom tone mapping'dan OLDIN bo'lishi kerak.
  // ─────────────────────────────────────────────────────────────────────────
  pipelineOrder: [
    'bloom',
    'chromaticAberration',
    'lensFlare',
    'motionBlur',
    'toneMapping',          // HDR → SDR shu yerda
    'colorGrading',
    'filmGrain',            // Tone mapping'dan KEYIN
    'fxaa',                 // Eng oxirida
    'vignette',             // Yakuniy touch
  ],
};

// Kritik parametrlarni muzlatish
Object.freeze(PostFXConfig.toneMapping.aces);
Object.freeze(PostFXConfig.bloom.luminanceWeights);
Object.freeze(PostFXConfig.pipelineOrder);

export default PostFXConfig;