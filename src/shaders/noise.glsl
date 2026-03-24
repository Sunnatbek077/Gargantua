/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Noise Functions Library
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Procedural noise funksiyalari — accretion disk tuzilmasi va
 * film grain effekti uchun.
 *
 * Tarkibi:
 *   - Hash funksiyalari (pseudo-random)
 *   - 2D/3D gradient noise
 *   - FBM (Fractal Brownian Motion)
 *   - Domain warping (turbulentlik)
 *   - Film grain noise
 *
 * Formulalar:
 *   #29 — grain = fract(sin(dot(uv, vec2(12.9898,78.233))) * 43758.5453)
 *          Film grain pseudo-random noise
 *   #31 — noise(p) = Σ(amplitude_i · simplex(frequency_i · p))
 *          Procedural noise
 *   #32 — fbm(p) = Σᵢ 0.5ⁱ · noise(2ⁱ · p)
 *          Fractal Brownian Motion
 * ═══════════════════════════════════════════════════════════════════════════════
 */


// ─────────────────────────────────────────────────────────────────────────────
// I. HASH FUNKSIYALARI — tez pseudo-random
// ─────────────────────────────────────────────────────────────────────────────
// Bu funksiyalar deterministik — bir xil kirishga doim bir xil natija beradi.
// Lekin natija "tasodifiy" ko'rinadi. Shader'da haqiqiy random yo'q,
// shuning uchun hash ishlatiladi.
// ─────────────────────────────────────────────────────────────────────────────

// ── Formula #29: Klassik 1D hash ──
// Juda tez, lekin artefaktlarga moyil (katta qiymatlar uchun)
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

// 2D kirish → 1D chiqish
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// 2D kirish → 2D chiqish
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// 3D kirish → 1D chiqish
float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

// 3D kirish → 3D chiqish
vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}


// ─────────────────────────────────────────────────────────────────────────────
// II. GRADIENT NOISE — 2D va 3D
// ─────────────────────────────────────────────────────────────────────────────
// Perlin noise'ga o'xshash — lekin optimallashtirilgan GPU uchun.
// Har bir grid nuqtasida tasodifiy gradient vektori hosil qilinadi,
// keyin qo'shni nuqtalar orasida silliq interpolatsiya qilinadi.
//
// Natija: [-1, 1] diapazonida
// ─────────────────────────────────────────────────────────────────────────────

// Silliq interpolatsiya — quintic Hermite
// Oddiy lerp'dan farqi: hosilasi (derivative) chegaralarda 0 ga teng
// Bu FBM'da artefaktlarni yo'q qiladi
vec2 quintic(vec2 x) {
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

vec3 quintic(vec3 x) {
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

// ── 2D Gradient Noise ──
float gradientNoise2D(vec2 p) {
  vec2 i = floor(p);   // Grid katakchasi
  vec2 f = fract(p);   // Katakcha ichidagi pozitsiya

  // To'rt burchak uchun tasodifiy gradient
  float a = hash21(i + vec2(0.0, 0.0));
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));

  // Silliq interpolatsiya
  vec2 u = quintic(f);

  // Bilinear interpolatsiya
  return mix(
    mix(a, b, u.x),
    mix(c, d, u.x),
    u.y
  ) * 2.0 - 1.0;  // [0,1] → [-1,1]
}

// ── 3D Gradient Noise ──
// Accretion disk uchun — vaqt uchinchi o'lchov sifatida ishlatiladi
// p = vec3(diskX, diskZ, time) → animatsiyalangan noise
float gradientNoise3D(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = quintic(f);

  // 8 ta burchak (kub)
  float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

  // Trilinear interpolatsiya
  float n00 = mix(n000, n100, u.x);
  float n10 = mix(n010, n110, u.x);
  float n01 = mix(n001, n101, u.x);
  float n11 = mix(n011, n111, u.x);

  float n0 = mix(n00, n10, u.y);
  float n1 = mix(n01, n11, u.y);

  return mix(n0, n1, u.z) * 2.0 - 1.0;
}


// ─────────────────────────────────────────────────────────────────────────────
// III. FBM — Fractal Brownian Motion
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Formula #32 ──
// fbm(p) = Σᵢ persistenceⁱ · noise(lacunarityⁱ · p)
//
// Bir nechta noise qatlamini (oktava) ustma-ust qo'yish.
// Har keyingi oktava:
//   - Chastotasi ko'payadi (lacunarity) — mayda detallar
//   - Amplitudasi kamayadi (persistence) — mayda = kuchsiz
//
// Natija: tabiatdagi bulutlar, tog'lar, olov kabi tuzilmalar
// Accretion diskda: gaz spirallari, turbulent oqimlar
// ─────────────────────────────────────────────────────────────────────────────

// ── 2D FBM ──
// octaves — qatlamlar soni (ko'proq = ko'proq detail, lekin sekinroq)
// lacunarity — chastota ko'payish koeffitsienti (odatda 2.0)
// persistence — amplituda kamayish koeffitsienti (odatda 0.5)
float fbm2D(vec2 p, int octaves, float lacunarity, float persistence) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  float maxValue = 0.0;  // Normalizatsiya uchun

  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;

    value += amplitude * gradientNoise2D(p * frequency);
    maxValue += amplitude;

    frequency *= lacunarity;
    amplitude *= persistence;
  }

  return value / maxValue;  // [-1, 1] diapazonida normallashtirilgan
}

// ── 3D FBM ──
// Vaqt o'lchovi qo'shilgan — animatsiyalangan disk tuzilmasi
float fbm3D(vec3 p, int octaves, float lacunarity, float persistence) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  float maxValue = 0.0;

  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;

    value += amplitude * gradientNoise3D(p * frequency);
    maxValue += amplitude;

    frequency *= lacunarity;
    amplitude *= persistence;
  }

  return value / maxValue;
}


// ─────────────────────────────────────────────────────────────────────────────
// IV. DOMAIN WARPING — Turbulentlik
// ─────────────────────────────────────────────────────────────────────────────
//
// Noise'ni o'zining natijasi bilan "egish" — ikkilamchi turbulentlik.
// Natija: yanada organik, gazsimon tuzilmalar.
//
// Accretion diskda gaz oqimlarining turbulent harakatini simulyatsiya qiladi.
//
// Usul:
//   1. p nuqtada fbm hisoblash → f1
//   2. p + f1 bilan siljitilgan nuqtada fbm hisoblash → f2
//   3. [ixtiyoriy] yana bir qadam — uchlamchi warping
// ─────────────────────────────────────────────────────────────────────────────

float domainWarp2D(vec2 p, int octaves, float lacunarity, float persistence, float warpStrength) {
  // Birinchi bosqich — asosiy noise
  vec2 q = vec2(
    fbm2D(p + vec2(0.0, 0.0), octaves, lacunarity, persistence),
    fbm2D(p + vec2(5.2, 1.3), octaves, lacunarity, persistence)
  );

  // Ikkinchi bosqich — warped noise
  vec2 r = vec2(
    fbm2D(p + warpStrength * q + vec2(1.7, 9.2), octaves, lacunarity, persistence),
    fbm2D(p + warpStrength * q + vec2(8.3, 2.8), octaves, lacunarity, persistence)
  );

  return fbm2D(p + warpStrength * r, octaves, lacunarity, persistence);
}

// 3D versiya — vaqt bilan animatsiyalangan
float domainWarp3D(vec3 p, int octaves, float lacunarity, float persistence, float warpStrength) {
  vec3 q = vec3(
    fbm3D(p + vec3(0.0, 0.0, 0.0), octaves, lacunarity, persistence),
    fbm3D(p + vec3(5.2, 1.3, 2.8), octaves, lacunarity, persistence),
    fbm3D(p + vec3(2.1, 7.3, 4.2), octaves, lacunarity, persistence)
  );

  return fbm3D(p + warpStrength * q, octaves, lacunarity, persistence);
}


// ─────────────────────────────────────────────────────────────────────────────
// V. ACCRETION DISK NOISE — maxsus disk tuzilmasi
// ─────────────────────────────────────────────────────────────────────────────
//
// Accretion disk uchun maxsus noise kombinatsiyasi:
//   - Spiral tuzilma (qutbiy koordinatalar)
//   - Radial tuzilma (markazga qarab o'zgarish)
//   - Turbulent detallar (domain warping)
//   - Vaqt bo'yicha aylanish (animatsiya)
// ─────────────────────────────────────────────────────────────────────────────

float diskNoise(
  vec2 diskPos,           // Disk tekisligidagi pozitsiya (x, z)
  float time,             // Vaqt (animatsiya)
  float noiseScale,       // Umumiy masshtab
  int octaves,            // FBM oktavalar
  float lacunarity,       // Chastota ko'payishi
  float persistence,      // Amplituda kamayishi
  float timeScale         // Vaqt tezligi
) {
  // Qutbiy koordinatalarga o'tish
  float r = length(diskPos);
  float theta = atan(diskPos.y, diskPos.x);

  // Spiral tuzilma — burchak + radius bo'yicha siljish
  // Aylanish: ichki qism tezroq, tashqi sekinroq (Kepler qonuni)
  float spiralAngle = theta + 3.0 / (r + 0.5) + time * timeScale * (2.0 / (r + 1.0));

  // Noise uchun koordinatalar
  // Spiral burchakni chiziqli koordinataga aylantirish
  vec2 noiseCoord = vec2(
    r * noiseScale,
    spiralAngle * noiseScale * 0.5
  );

  // 3D noise — uchinchi o'lchov = vaqt (sekin o'zgarish)
  vec3 p3d = vec3(noiseCoord, time * timeScale * 0.3);

  // Asosiy tuzilma — katta masshtabli spiral kollar
  float largeTurbulence = fbm3D(p3d * 0.5, max(octaves - 2, 2), lacunarity, persistence);

  // Mayda detallar — kichik girdoblar va oqimlar
  float smallTurbulence = fbm3D(p3d * 2.0, octaves, lacunarity, persistence);

  // Domain warping — gazning turbulent harakati
  float warped = domainWarp3D(
    p3d * 0.7,
    max(octaves - 1, 2),
    lacunarity,
    persistence,
    0.4
  );

  // Spiral qo'llar effekti
  // sin() bilan takrorlanuvchi spiral chiziqlar
  float spiralArms = sin(spiralAngle * 3.0 + r * 2.0) * 0.5 + 0.5;
  spiralArms = pow(spiralArms, 1.5);  // Kontrastni oshirish

  // Barcha qatlamlarni birlashtirish
  float result = largeTurbulence * 0.5
               + smallTurbulence * 0.25
               + warped * 0.15
               + spiralArms * 0.1;

  return result;
}


// ─────────────────────────────────────────────────────────────────────────────
// VI. FILM GRAIN — Kinematografik donadorlik
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Formula #29 ──
// grain = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453) * intensity
//
// Har kadrda farqli noise — vaqt qo'shiladi
// Natija: [0, 1] diapazonida
// ─────────────────────────────────────────────────────────────────────────────

float filmGrain(vec2 uv, float time, float intensity) {
  // Klassik sin-hash — juda tez
  float noise = fract(
    sin(
      dot(uv + fract(time * 0.71), vec2(12.9898, 78.233))
    ) * 43758.5453
  );

  // Markazga siljitish: [0,1] → [-0.5, 0.5]
  noise = noise - 0.5;

  return noise * intensity;
}

// Xromatik grain — RGB kanallari uchun alohida noise
// Haqiqiy film pellikasida ranglar biroz farqli donadorlikka ega
vec3 filmGrainChromatic(vec2 uv, float time, float intensity, float chromaticIntensity) {
  float baseGrain = filmGrain(uv, time, intensity);

  // Har kanal uchun biroz farqli noise
  float rOffset = filmGrain(uv + vec2(0.1, 0.0), time * 1.1, chromaticIntensity);
  float gOffset = filmGrain(uv + vec2(0.0, 0.1), time * 1.2, chromaticIntensity);
  float bOffset = filmGrain(uv + vec2(0.1, 0.1), time * 1.3, chromaticIntensity);

  return vec3(
    baseGrain + rOffset,
    baseGrain + gOffset,
    baseGrain + bOffset
  );
}
