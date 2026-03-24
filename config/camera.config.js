/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Camera Configuration
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Kamera sozlamalari, presetlar va kinematografik animatsiya yo'llari.
 *
 * Interstellar filmidagi kamera burchaklari asosida yaratilgan presetlar:
 *   - Uzoqdan kuzatish (wide shot)
 *   - Disk tekisligi (edge-on)
 *   - Qutb ustidan (polar view)
 *   - Yaqinlashish (approach)
 *   - Orbital aylantma (orbit)
 *
 * Formulalar:
 *   #34 — rayDir = normalize(right·u + up·v + forward·focalLength)
 *          Perspektiv proektsiya (ray generation)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const CameraConfig = {

  // ─────────────────────────────────────────────────────────────────────────
  // I. ASOSIY KAMERA PARAMETRLARI
  // ─────────────────────────────────────────────────────────────────────────
  defaults: {
    // ── Formula #34: Perspektiv proektsiya ──
    // fov qiymati shader ichida focalLength ga aylantiriladi:
    //   focalLength = 1.0 / tan(fov * 0.5 * π/180)
    fov: 45,                 // Degrees — ko'rish burchagi
    
    // Yaqin/uzoq kesish tekisliklari
    near: 0.01,
    far: 1000.0,

    // Boshlang'ich pozitsiya [x, y, z]
    // Qora tuynukdan 15M masofada, biroz yuqoridan
    position: [0.0, 3.0, 15.0],

    // Qarab turgan nuqta (qora tuynuk markazi)
    lookAt: [0.0, 0.0, 0.0],

    // Yuqori yo'nalish (up vector)
    up: [0.0, 1.0, 0.0],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // II. ORBITAL BOSHQARUV SOZLAMALARI
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Sichqoncha bilan kamerani qora tuynuk atrofida aylantirish
  // ─────────────────────────────────────────────────────────────────────────
  orbit: {
    // Aylantirish tezligi
    rotateSpeed: 0.5,

    // Zoom sozlamalari
    zoomSpeed: 1.0,
    minDistance: 3.0,        // Rs * 1.5 — gorizontga juda yaqin
    maxDistance: 100.0,      // Uzoq kuzatish

    // Vertikal burchak cheklovi (radianlarda)
    minPolarAngle: 0.05,     // Deyarli qutbdan
    maxPolarAngle: Math.PI - 0.05,  // Pastki qutbgacha

    // Damping (silliq to'xtash)
    enableDamping: true,
    dampingFactor: 0.08,     // Kichik = silliqliq, katta = tez to'xtash

    // Pan (siljitish) — o'chirilgan
    // Kamera doim qora tuynukka qarab turishi kerak
    enablePan: false,

    // Avtomatik aylanish
    autoRotate: true,
    autoRotateSpeed: 0.15,   // Juda sekin — kosmik miqyos hissi
  },

  // ─────────────────────────────────────────────────────────────────────────
  // III. KAMERA PRESETLARI
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Interstellar filmidagi kadrlar asosida
  // Har bir preset: pozitsiya, fov, va animatsiya davomiyligi
  // ─────────────────────────────────────────────────────────────────────────
  presets: {

    // ── "First Light" — filmda birinchi ko'rish ──
    // Uzoqdan, biroz yuqoridan, keng burchak
    wide: {
      label: 'Keng kadr',
      description: 'Uzoqdan kuzatish — to\'liq panorama',
      position: [0.0, 4.0, 25.0],
      lookAt: [0.0, 0.0, 0.0],
      fov: 55,
      transitionDuration: 3.0,  // Soniya
      easing: 'easeInOutCubic',
    },

    // ── "Edge of the Disk" — disk tekisligi ──
    // Accretion disk bilan bir tekislikda, gravitatsion
    // lensing effekti eng ko'zga ko'rinadi
    edgeOn: {
      label: 'Disk tekisligi',
      description: 'Accretion disk bilan bir tekislikda — Interstellar klasik kadr',
      position: [20.0, 0.3, 0.0],
      lookAt: [0.0, 0.0, 0.0],
      fov: 40,
      transitionDuration: 4.0,
      easing: 'easeInOutQuart',
    },

    // ── "God's Eye" — qutb ustidan ──
    // Disk to'liq doira shaklida ko'rinadi
    polar: {
      label: 'Qutb ko\'rinishi',
      description: 'Yuqoridan — disk to\'liq doira, Doppler effekt aniq',
      position: [0.0, 22.0, 0.5],
      lookAt: [0.0, 0.0, 0.0],
      fov: 45,
      transitionDuration: 3.5,
      easing: 'easeInOutCubic',
    },

    // ── "Approach" — yaqinlashish ──
    // Gargantua'ga yaqinlashish, foton halqa ko'rinadi
    approach: {
      label: 'Yaqinlashish',
      description: 'Qora tuynukka yaqin — foton halqa va lensing kuchli',
      position: [5.0, 1.5, 5.0],
      lookAt: [0.0, 0.0, 0.0],
      fov: 35,
      transitionDuration: 4.5,
      easing: 'easeInOutQuint',
    },

    // ── "Event Horizon" — gorizont yaqinida ──
    // Eng yaqin nuqta — vaqt sekinlashadi
    horizon: {
      label: 'Gorizont',
      description: 'Voqealar gorizonti yaqinida — kuchli lensing',
      position: [3.5, 0.5, 0.0],
      lookAt: [0.0, 0.0, 0.0],
      fov: 30,
      transitionDuration: 5.0,
      easing: 'easeInOutQuint',
    },

    // ── "Behind the Hole" — orqa tomondan ──
    // Disk ikki tomondan ko'rinadi (gravitatsion lensing)
    behind: {
      label: 'Orqa tomon',
      description: 'Qora tuynuk orqasidan — lensing yordamida disk ikki tomondan',
      position: [-15.0, 2.0, 8.0],
      lookAt: [0.0, 0.0, 0.0],
      fov: 45,
      transitionDuration: 4.0,
      easing: 'easeInOutCubic',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // IV. KINEMATOGRAFIK ANIMATSIYA YO'LLARI
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Avtomatik kamera harakati — "cinematic mode"
  // Bezier egri chiziqlar bo'ylab silliq harakat
  // ─────────────────────────────────────────────────────────────────────────
  cinematicPaths: {

    // ── "Discovery" — birinchi kashfiyot ──
    // Uzoqdan yaqinlashib, disk atrofida aylanib, qaytadi
    discovery: {
      label: 'Kashfiyot',
      duration: 30.0,        // Soniya
      loop: false,
      keyframes: [
        { time: 0.0,  position: [0, 5, 40],  lookAt: [0, 0, 0], fov: 55 },
        { time: 0.2,  position: [15, 3, 30],  lookAt: [0, 0, 0], fov: 50 },
        { time: 0.4,  position: [25, 1, 10],  lookAt: [0, 0, 0], fov: 42 },
        { time: 0.6,  position: [18, 0.5, -5], lookAt: [0, 0, 0], fov: 38 },
        { time: 0.8,  position: [5, 2, -12],  lookAt: [0, 0, 0], fov: 40 },
        { time: 1.0,  position: [0, 4, 20],   lookAt: [0, 0, 0], fov: 48 },
      ],
    },

    // ── "Orbit" — barqaror orbital ──
    // Qora tuynuk atrofida doira bo'ylab aylanish
    orbit: {
      label: 'Orbital',
      duration: 60.0,
      loop: true,
      keyframes: [
        { time: 0.0,   position: [15, 3, 0],    lookAt: [0, 0, 0], fov: 45 },
        { time: 0.25,  position: [0, 3, 15],    lookAt: [0, 0, 0], fov: 45 },
        { time: 0.5,   position: [-15, 3, 0],   lookAt: [0, 0, 0], fov: 45 },
        { time: 0.75,  position: [0, 3, -15],   lookAt: [0, 0, 0], fov: 45 },
        { time: 1.0,   position: [15, 3, 0],    lookAt: [0, 0, 0], fov: 45 },
      ],
    },

    // ── "Dive" — tushish ──
    // Disk tekisligida yaqinlashib, gorizont yaqinida to'xtaydi
    dive: {
      label: 'Tushish',
      duration: 20.0,
      loop: false,
      keyframes: [
        { time: 0.0,  position: [30, 0.5, 0],  lookAt: [0, 0, 0], fov: 50 },
        { time: 0.3,  position: [18, 0.3, 2],  lookAt: [0, 0, 0], fov: 45 },
        { time: 0.6,  position: [8, 0.2, 1],   lookAt: [0, 0, 0], fov: 38 },
        { time: 0.85, position: [4.5, 0.1, 0], lookAt: [0, 0, 0], fov: 32 },
        { time: 1.0,  position: [3.2, 0.1, 0], lookAt: [0, 0, 0], fov: 28 },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // V. EASING FUNKSIYALARI
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Kamera o'tishlari uchun interpolatsiya funksiyalari
  // ─────────────────────────────────────────────────────────────────────────
  easing: {
    linear:          t => t,
    easeInQuad:      t => t * t,
    easeOutQuad:     t => t * (2 - t),
    easeInOutQuad:   t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeInCubic:     t => t * t * t,
    easeOutCubic:    t => (--t) * t * t + 1,
    easeInOutCubic:  t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    easeInQuart:     t => t * t * t * t,
    easeOutQuart:    t => 1 - (--t) * t * t * t,
    easeInOutQuart:  t => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
    easeInOutQuint:  t => t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VI. KAMERA SHAKE (TEBRANISH)
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Qora tuynukka yaqinlashganda engil tebranish —
  // gravitatsion kuchlanish hissi
  // ─────────────────────────────────────────────────────────────────────────
  shake: {
    enabled: true,

    // Tebranish boshlanadigan masofa
    startDistance: 8.0,      // [M] — bu masofadan boshlanadi

    // Maksimal tebranish kuchi (piksel)
    maxAmplitude: 2.5,

    // Tebranish chastotasi
    frequency: 3.0,          // Hz

    // Masofa-kuch bog'liqligi
    // amplitude = maxAmplitude * (startDistance / currentDistance)²
    falloffExponent: 2.0,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VII. SCREENSHOT VA VIDEO EKSPORT
  // ─────────────────────────────────────────────────────────────────────────
  export: {
    // Screenshot
    screenshotFormat: 'png',
    screenshotQuality: 1.0,
    screenshotSupersampling: 2,  // 2x o'lcham, keyin downscale

    // Video eksport (MediaRecorder API)
    videoFormat: 'webm',
    videoCodec: 'vp9',
    videoBitrate: 20_000_000,    // 20 Mbps
    videoFPS: 30,
  },
};

Object.freeze(CameraConfig.defaults);
Object.freeze(CameraConfig.orbit);
Object.freeze(CameraConfig.shake);
Object.freeze(CameraConfig.export);

export default CameraConfig;