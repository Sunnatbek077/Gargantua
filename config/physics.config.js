/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Physics Configuration
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Barcha fizik konstantalar va hisoblangan qiymatlar.
 * Simulyatsiyada "tabiiy birliklar" (natural units) ishlatiladi:
 *   G = 1, c = 1, M = 1
 * Bu shader ichidagi hisob-kitoblarni soddalashtiradi.
 *
 * Haqiqiy SI qiymatlari ham saqlanadi — HUD va ma'lumot ko'rsatish uchun.
 *
 * Formulalar:
 *   #3  — Rs = 2GM/c²           (Schwarzschild radiusi)
 *   #4  — a = J/Mc, Σ, Δ        (Kerr parametrlari)
 *   #10 — Veff(r)               (Effektiv potentsial)
 *   #11 — b_c = 3√3·GM/c²      (Kritik impakt parametri)
 *   #12 — r_ph = 3GM/c²        (Foton sfera radiusi)
 *   #17 — r_ISCO = 6GM/c²      (Eng ichki barqaror orbital)
 *   #18 — v_orb = √(GM/r)      (Kepler orbital tezligi)
 *   #19 — T(r) Shakura-Sunyaev  (Disk temperaturasi)
 *   #21 — I(r)                  (Disk yorqinlik profili)
 *   #22 — g = 1/(γ(1+β·cosα))  (Relativistik Doppler)
 *   #23 — I_obs = g⁴·I_emit    (Doppler beaming)
 *   #24 — z_grav               (Gravitatsion qizil siljish)
 *   #31 — noise()              (Procedural noise)
 *   #32 — fbm()                (Fractal Brownian Motion)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const PhysicsConfig = {

  // ─────────────────────────────────────────────────────────────────────────
  // I. FUNDAMENTAL KONSTANTALAR (SI birliklari — HUD uchun)
  // ─────────────────────────────────────────────────────────────────────────
  SI: {
    G: 6.67430e-11,          // Gravitatsion konstanta       [m³ kg⁻¹ s⁻²]
    c: 2.99792458e8,         // Yorug'lik tezligi            [m/s]
    h: 6.62607015e-34,       // Plank konstantasi            [J·s]
    k_B: 1.380649e-23,       // Boltzmann konstantasi        [J/K]
    sigma: 5.670374419e-8,   // Stefan-Boltzmann konstantasi [W m⁻² K⁻⁴]
    M_sun: 1.989e30,         // Quyosh massasi               [kg]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // II. SIMULYATSIYA BIRLIKLARI (natural units: G=1, c=1, M=1)
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Bu birliklarda:
  //   Rs     = 2    (Schwarzschild radiusi)
  //   r_ph   = 3    (foton sfera)
  //   r_ISCO = 6    (eng ichki barqaror orbital)
  //
  // Shader'larga aynan shu qiymatlar yuboriladi.
  // ─────────────────────────────────────────────────────────────────────────
  natural: {
    G: 1.0,
    c: 1.0,
    M: 1.0,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // III. QORA TUYNUK PARAMETRLARI
  // ─────────────────────────────────────────────────────────────────────────
  blackHole: {

    // Massa (Quyosh massasi birligida) — faqat HUD display uchun
    massSolar: 100e6,  // 100 million quyosh massasi (Gargantua o'lchami)

    // ────────────────────────────────────────────
    // Formula #3: Schwarzschild radiusi
    // Rs = 2GM/c²
    // Natural units'da: Rs = 2M = 2.0
    // ────────────────────────────────────────────
    Rs: 2.0,

    // ────────────────────────────────────────────
    // Formula #4: Kerr spin parametri
    // a = J/(Mc), diapazoni: 0 ≤ a/M < 1
    //
    // Gargantua filmda: a ≈ 0.99999999M
    // Simulyatsiyada: 0.998 (barqaror render uchun)
    //
    // spin=0     → Schwarzschild (aylanmaydigan)
    // spin=0.998 → Gargantua (deyarli maksimal)
    // ────────────────────────────────────────────
    spin: 0.998,

    // a parametri (computed)
    // a = spin * M, natural units'da M=1
    get a() {
      return this.spin * 1.0;
    },

    // ────────────────────────────────────────────
    // Formula #4: Kerr yordamchi — gorizontlar
    // r± = M ± √(M² - a²)
    // ────────────────────────────────────────────
    get rOuterHorizon() {
      const a = this.a;
      return 1.0 + Math.sqrt(1.0 - a * a);
    },
    get rInnerHorizon() {
      const a = this.a;
      return 1.0 - Math.sqrt(1.0 - a * a);
    },

    // ────────────────────────────────────────────
    // Formula #4: Ergosfera radiusi
    // r_ergo = M + √(M² - a²cos²θ)
    // Ekvatorial tekislikda (θ=π/2): r_ergo = 2M
    // ────────────────────────────────────────────
    rErgosphere(theta) {
      const a = this.a;
      const cosTheta = Math.cos(theta);
      return 1.0 + Math.sqrt(1.0 - a * a * cosTheta * cosTheta);
    },

    // ────────────────────────────────────────────
    // Formula #12: Foton sfera radiusi
    //
    // Schwarzschild: r_ph = 3M = 1.5 * Rs
    // Kerr (prograde):
    //   r_ph = 2M · {1 + cos(2/3 · arccos(-a/M))}
    // ────────────────────────────────────────────
    get rPhotonSphere() {
      if (this.spin < 0.001) return 3.0;
      const a = this.a;
      return 2.0 * (1.0 + Math.cos((2.0 / 3.0) * Math.acos(-a)));
    },

    // ────────────────────────────────────────────
    // Formula #11: Kritik impakt parametri
    //
    // Schwarzschild: b_c = 3√3 · M ≈ 5.196
    // Nur b < b_c bilan kelsa — qora tuynukka tushadi
    // ────────────────────────────────────────────
    get bCritical() {
      if (this.spin < 0.001) return 3.0 * Math.sqrt(3.0);
      const rph = this.rPhotonSphere;
      const a = this.a;
      return rph * rph / Math.sqrt(rph * rph - 3.0 * rph + 2.0 * a * Math.sqrt(rph));
    },

    // ────────────────────────────────────────────
    // Formula #17: ISCO radiusi
    //
    // Schwarzschild: r_ISCO = 6M = 3Rs
    // Kerr (prograde): murakkab formula
    //   Z1 = 1 + ∛(1-a²) · (∛(1+a) + ∛(1-a))
    //   Z2 = √(3a² + Z1²)
    //   r_ISCO = 3 + Z2 - √((3-Z1)(3+Z1+2Z2))
    // ────────────────────────────────────────────
    get rISCO() {
      if (this.spin < 0.001) return 6.0;
      const a = this.a;
      const Z1 = 1.0 + Math.cbrt(1.0 - a * a) * (Math.cbrt(1.0 + a) + Math.cbrt(1.0 - a));
      const Z2 = Math.sqrt(3.0 * a * a + Z1 * Z1);
      return 3.0 + Z2 - Math.sqrt((3.0 - Z1) * (3.0 + Z1 + 2.0 * Z2));
    },

    // ────────────────────────────────────────────
    // Formula #10: Effektiv potentsial (Schwarzschild)
    // Veff(r) = -M/r + L²/(2r²) - ML²/r³
    //
    // Bu funksiya orbital mexanikani vizualizatsiya
    // qilish uchun ishlatiladi (HUD grafik)
    // ────────────────────────────────────────────
    effectivePotential(r, L) {
      const M = 1.0;
      return -M / r + (L * L) / (2.0 * r * r) - (M * L * L) / (r * r * r);
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // IV. ACCRETION DISK PARAMETRLARI
  // ─────────────────────────────────────────────────────────────────────────
  accretionDisk: {

    // Disk chegaralari [natural units: M=1]
    get innerRadius() {
      return PhysicsConfig.blackHole.rISCO;
    },
    outerRadius: 20.0,

    // ────────────────────────────────────────────
    // Formula #19: Disk temperaturasi (Shakura-Sunyaev)
    // T(r) = T_max · (r/r_ISCO)^(-3/4) · [1-√(r_ISCO/r)]^(1/4)
    // ────────────────────────────────────────────
    T_max: 1e7,              // [Kelvin] — HUD uchun
    T_maxNormalized: 1.0,    // Shader uchun normallashtirilgan

    // Disk geometriyasi
    thickness: 0.02,         // r ga nisbatan qalinlik (yupqa disk)

    // ────────────────────────────────────────────
    // Formula #18: Kepler orbital tezligi
    // v_orb = √(M/r) · (1 - Rs/r)^(-1/2)
    // ────────────────────────────────────────────
    orbitalVelocity(r) {
      const Rs = PhysicsConfig.blackHole.Rs;
      if (r <= Rs) return 1.0; // c dan oshmasligi kerak
      return Math.sqrt(1.0 / r) / Math.sqrt(1.0 - Rs / r);
    },

    // ────────────────────────────────────────────
    // Formula #21: Disk yorqinlik profili
    // I(r) = I₀ · (r_ISCO/r)³ · [1 - √(r_ISCO/r)]
    // ────────────────────────────────────────────
    luminosityProfile(r) {
      const rISCO = PhysicsConfig.blackHole.rISCO;
      if (r < rISCO) return 0.0;
      const ratio = rISCO / r;
      return Math.pow(ratio, 3.0) * (1.0 - Math.sqrt(ratio));
    },

    // ────────────────────────────────────────────
    // Formula #19: Temperatura profili
    // T(r) = T_max · (r/r_ISCO)^(-3/4) · [1-√(r_ISCO/r)]^(1/4)
    // ────────────────────────────────────────────
    temperatureProfile(r) {
      const rISCO = PhysicsConfig.blackHole.rISCO;
      if (r <= rISCO) return 0.0;
      const ratio = rISCO / r;
      return Math.pow(r / rISCO, -0.75) * Math.pow(1.0 - Math.sqrt(ratio), 0.25);
    },

    // Disk rang xaritasi (temperaturaga bog'liq)
    colorMap: {
      hot:  [1.0, 0.95, 0.88],    // T_max yaqini — deyarli oq
      warm: [1.0, 0.55, 0.15],    // O'rta — oltin-to'q sariq
      cool: [0.75, 0.15, 0.02],   // Tashqi — chuqur qizil
    },

    // ── Formula #31, #32: Noise parametrlari ──
    // Procedural texture — disk spirallari va tuzilmasi
    noise: {
      scale: 3.0,            // Asosiy chastota
      lacunarity: 2.0,       // Har oktavada chastota ko'payishi
      octaves: 6,            // FBM qatlamlari soni
      persistence: 0.5,      // Har oktavada amplituda kamayishi
      timeScale: 0.15,       // Vaqt bo'yicha o'zgarish tezligi
    },

    // Vizual aylanish tezligi
    rotationSpeed: 0.3,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // V. DOPPLER EFFEKT PARAMETRLARI
  // ─────────────────────────────────────────────────────────────────────────
  doppler: {

    // ── Formula #22: Relativistik Doppler omili ──
    // g = 1 / (γ(1 + β·cosα))
    enabled: true,

    // ── Formula #23: Doppler beaming ──
    // I_obs = g^exponent · I_emit
    // exponent=4 termal nurlanish uchun
    // exponent=3+α sinxrotron nurlanish uchun
    beamingExponent: 4.0,

    // ── Formula #24: Gravitatsion qizil siljish ──
    // z_grav = 1/√(1 - Rs/r) - 1
    gravitationalRedshift: true,

    // ── Formula #25: Umumiy chastota siljishi ──
    // ν_obs/ν_emit = g · √(1-Rs/r_emit) / √(1-Rs/r_obs)
    combinedShift: true,

    // Vizual tuning — rang siljish kuchi
    colorShiftStrength: 1.0,

    // Yorqinlik kuchayish faktori
    brightnessBoost: 1.5,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VI. RAY MARCHING PARAMETRLARI
  // ─────────────────────────────────────────────────────────────────────────
  rayMarching: {

    // ── Formulalar #6, #7, #8, #9 — geodezik integrallash ──

    // Har bir piksel (nur) uchun maksimum bosqichlar
    maxSteps: 300,

    // Qadam kattaligi
    stepSize: 0.05,

    // Adaptiv qadam — qora tuynukka yaqinda kichikroq
    adaptiveStep: true,
    minStepSize: 0.01,       // Gorizont yaqinida
    maxStepSize: 0.2,        // Uzoq masofada
    stepSizeFactor: 0.3,     // r * factor = actual step

    // ── Integratsiya usuli ──
    // 'verlet' — Formula #8: tezroq, GPU uchun ideal
    // 'rk4'    — Formula #9: aniqroq, sifat muhim bo'lganda
    integrationMethod: 'rk4',

    // Tugatish shartlari
    escapeRadius: 50.0,      // Nur uzoqlashdi — fon yulduzlarini ko'rsat
    captureMultiplier: 0.05, // Rs * multiplier = tutish radiusi

    get captureRadius() {
      return PhysicsConfig.blackHole.Rs * this.captureMultiplier;
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VII. GRAVITATSION LINZALASH PARAMETRLARI
  // ─────────────────────────────────────────────────────────────────────────
  lensing: {

    // ── Formula #13: Burilish burchagi ──
    // δ = 4GM/(bc²) — kuchsiz maydon limiti
    enabled: true,

    // ── Formula #14: Eynshteyn halqasi ──
    einsteinRing: true,

    // ── Formula #15: Linza tenglamasi ──
    // β = θ - D_ls/D_s · δ(θ)
    // (shader ichida to'liq ray tracing orqali hisoblanadi)

    // ── Formula #16: Kuchayish (magnification) ──
    magnification: true,
    maxMagnification: 50.0,  // Vizual cheklash

    // Ikkilamchi tasvir (orqa tomondan kelgan nur)
    secondaryImage: true,

    // Foton halqasi yorqinligi
    photonRingIntensity: 2.0,
  },
};

// Asosiy ob'ektlarni muzlatish — runtime o'zgarishlardan himoya
Object.freeze(PhysicsConfig.SI);
Object.freeze(PhysicsConfig.natural);
Object.freeze(PhysicsConfig.doppler);
Object.freeze(PhysicsConfig.lensing);

export default PhysicsConfig;