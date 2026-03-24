/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Math Utilities
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Matematik yordamchi funksiyalar.
 *
 * Tarkibi:
 *   - Koordinata konversiyalari (sferik ↔ Kartezian, Boyer-Lindquist)
 *   - Interpolatsiya (lerp, smoothstep, Catmull-Rom)
 *   - Raqamli yordamchilar (clamp, remap, degToRad)
 *   - Fizik birlik konversiyalari (natural ↔ SI)
 *   - Vektor operatsiyalari (Three.js'siz ishlaydiganlari)
 *
 * Formulalar:
 *   #5  — Boyer-Lindquist → Kartezian koordinata konversiyasi
 *   #33 — Sferik → Kartezian: x=r·sinθ·cosφ, y=r·sinθ·sinφ, z=r·cosθ
 *
 * Bog'liqliklar: yo'q (sof matematik, tashqi kutubxonalarsiz)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// I. KONSTANTALAR
// ─────────────────────────────────────────────────────────────────────────────

export const PI = Math.PI;
export const TWO_PI = Math.PI * 2.0;
export const HALF_PI = Math.PI * 0.5;
export const DEG_TO_RAD = Math.PI / 180.0;
export const RAD_TO_DEG = 180.0 / Math.PI;
export const EPSILON = 1e-10;


// ─────────────────────────────────────────────────────────────────────────────
// II. ASOSIY RAQAMLI YORDAMCHILAR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Qiymatni [min, max] diapazoniga cheklash
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Chiziqli interpolatsiya
 * t=0 da a, t=1 da b, orada silliq o'tish
 *
 * @param {number} a - Boshlang'ich qiymat
 * @param {number} b - Yakuniy qiymat
 * @param {number} t - Interpolatsiya koeffitsienti [0, 1]
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Teskari lerp — qiymatdan t ni topish
 * a da 0, b da 1 qaytaradi
 *
 * @param {number} a - Diapazon boshi
 * @param {number} b - Diapazon oxiri
 * @param {number} value - Qiymat
 * @returns {number}
 */
export function inverseLerp(a, b, value) {
  if (Math.abs(b - a) < EPSILON) return 0;
  return clamp((value - a) / (b - a), 0, 1);
}

/**
 * Qiymatni bir diapazondan boshqasiga o'tkazish
 * [inMin, inMax] → [outMin, outMax]
 *
 * @param {number} value
 * @param {number} inMin
 * @param {number} inMax
 * @param {number} outMin
 * @param {number} outMax
 * @returns {number}
 */
export function remap(value, inMin, inMax, outMin, outMax) {
  const t = inverseLerp(inMin, inMax, value);
  return lerp(outMin, outMax, t);
}

/**
 * Silliq o'tish — Hermite interpolatsiya
 * lerp'dan farqi: chetlarda hosilasi 0 (silliq boshlanish va tugash)
 *
 * @param {number} edge0 - O'tish boshi
 * @param {number} edge1 - O'tish oxiri
 * @param {number} x - Qiymat
 * @returns {number} [0, 1]
 */
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Yanada silliq o'tish — Perlin'ning "smoother" versiyasi
 * smoothstep'dan farqi: ikkinchi hosila ham 0 chetlarda
 *
 * @param {number} edge0
 * @param {number} edge1
 * @param {number} x
 * @returns {number}
 */
export function smootherstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Daraja → radian
 * @param {number} degrees
 * @returns {number}
 */
export function degToRad(degrees) {
  return degrees * DEG_TO_RAD;
}

/**
 * Radian → daraja
 * @param {number} radians
 * @returns {number}
 */
export function radToDeg(radians) {
  return radians * RAD_TO_DEG;
}

/**
 * Modulo — JavaScript'ning % operatori manfiy sonlar uchun noto'g'ri ishlaydi
 * Bu funksiya har doim [0, m) diapazonida qaytaradi
 *
 * @param {number} n
 * @param {number} m
 * @returns {number}
 */
export function mod(n, m) {
  return ((n % m) + m) % m;
}

/**
 * Ikki burchak orasidagi eng qisqa farq (radianlarda)
 * Natija: [-π, π]
 *
 * @param {number} a - Birinchi burchak (radian)
 * @param {number} b - Ikkinchi burchak (radian)
 * @returns {number}
 */
export function angleDifference(a, b) {
  let diff = mod(b - a + PI, TWO_PI) - PI;
  return diff;
}


// ─────────────────────────────────────────────────────────────────────────────
// III. KOORDINATA KONVERSIYALARI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ── Formula #33: Sferik → Kartezian ──
 *
 * x = r · sin(θ) · cos(φ)
 * y = r · cos(θ)              ← Y yuqoriga
 * z = r · sin(θ) · sin(φ)
 *
 * Eslatma: Fizikada odatda Y = r·cosθ (qutb o'qi), lekin
 * Three.js'da Y yuqoriga qaraydi, shuning uchun:
 *   Y = r·cosθ (yuqori-past)
 *   X,Z = ekvatorial tekislik
 *
 * @param {number} r - Radius
 * @param {number} theta - Qutb burchagi [0, π] (0=yuqori qutb)
 * @param {number} phi - Azimut burchagi [0, 2π]
 * @returns {{x: number, y: number, z: number}}
 */
export function sphericalToCartesian(r, theta, phi) {
  const sinTheta = Math.sin(theta);
  return {
    x: r * sinTheta * Math.cos(phi),
    y: r * Math.cos(theta),
    z: r * sinTheta * Math.sin(phi),
  };
}

/**
 * Kartezian → Sferik
 *
 * r = √(x² + y² + z²)
 * θ = arccos(y / r)
 * φ = atan2(z, x)
 *
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {{r: number, theta: number, phi: number}}
 */
export function cartesianToSpherical(x, y, z) {
  const r = Math.sqrt(x * x + y * y + z * z);
  if (r < EPSILON) return { r: 0, theta: 0, phi: 0 };
  return {
    r: r,
    theta: Math.acos(clamp(y / r, -1, 1)),
    phi: Math.atan2(z, x),
  };
}

/**
 * ── Formula #5: Boyer-Lindquist → Kartezian ──
 *
 * Kerr qora tuynuk uchun koordinata tizimi.
 * Oddiy sferikdan farqi: a (spin) parametri kiritilgan.
 *
 * x = √(r² + a²) · sin(θ) · cos(φ)
 * y = r · cos(θ)
 * z = √(r² + a²) · sin(θ) · sin(φ)
 *
 * a=0 bo'lganda oddiy sferik koordinatalarga aylanadi.
 *
 * @param {number} r - Boyer-Lindquist radiusi
 * @param {number} theta - Qutb burchagi
 * @param {number} phi - Azimut burchagi
 * @param {number} a - Kerr spin parametri
 * @returns {{x: number, y: number, z: number}}
 */
export function boyerLindquistToCartesian(r, theta, phi, a) {
  const sinTheta = Math.sin(theta);
  const rho = Math.sqrt(r * r + a * a);
  return {
    x: rho * sinTheta * Math.cos(phi),
    y: r * Math.cos(theta),
    z: rho * sinTheta * Math.sin(phi),
  };
}

/**
 * Kartezian → Boyer-Lindquist
 *
 * Teskari konversiya — iterativ yechim kerak bo'lishi mumkin,
 * lekin ekvatorial tekislikda (θ=π/2) aniq:
 *   r = √(x² + z² - a²)  (agar x²+z² > a²)
 *
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} a - Kerr spin parametri
 * @returns {{r: number, theta: number, phi: number}}
 */
export function cartesianToBoyerLindquist(x, y, z, a) {
  const phi = Math.atan2(z, x);
  const rhoSq = x * x + y * y + z * z;
  const a2 = a * a;

  // r² ni topish: r⁴ + (a² - ρ²)r² - a²y² = 0
  // Kvardratik formula r² uchun
  const discriminant = (rhoSq - a2) * (rhoSq - a2) + 4 * a2 * y * y;
  const r2 = (-(a2 - rhoSq) + Math.sqrt(Math.max(discriminant, 0))) * 0.5;
  const r = Math.sqrt(Math.max(r2, 0));

  const theta = (r > EPSILON) ? Math.acos(clamp(y / r, -1, 1)) : 0;

  return { r, theta, phi };
}

/**
 * Disk tekisligidagi (y=0) qutbiy koordinatalar
 * Accretion disk uchun qulay
 *
 * @param {number} x
 * @param {number} z
 * @returns {{r: number, angle: number}}
 */
export function diskPolarCoordinates(x, z) {
  return {
    r: Math.sqrt(x * x + z * z),
    angle: Math.atan2(z, x),
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// IV. INTERPOLATSIYA — ILG'OR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Catmull-Rom spline interpolatsiya (1D)
 * 4 ta nuqta orasida silliq egri chiziq
 *
 * Camera.js'dagi kinematografik yo'llar uchun ishlatiladi
 *
 * @param {number} p0 - Oldingi nuqta
 * @param {number} p1 - Boshlang'ich
 * @param {number} p2 - Yakuniy
 * @param {number} p3 - Keyingi nuqta
 * @param {number} t - [0, 1]
 * @returns {number}
 */
export function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2.0 * p1) +
    (-p0 + p2) * t +
    (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 +
    (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
  );
}

/**
 * Catmull-Rom 3D versiya
 *
 * @param {number[]} p0 - [x,y,z]
 * @param {number[]} p1
 * @param {number[]} p2
 * @param {number[]} p3
 * @param {number} t
 * @returns {number[]}
 */
export function catmullRom3D(p0, p1, p2, p3, t) {
  return [
    catmullRom(p0[0], p1[0], p2[0], p3[0], t),
    catmullRom(p0[1], p1[1], p2[1], p3[1], t),
    catmullRom(p0[2], p1[2], p2[2], p3[2], t),
  ];
}

/**
 * Kubik Bezier interpolatsiya
 *
 * @param {number} p0 - Boshlanish
 * @param {number} p1 - Boshqaruv nuqtasi 1
 * @param {number} p2 - Boshqaruv nuqtasi 2
 * @param {number} p3 - Tugash
 * @param {number} t - [0, 1]
 * @returns {number}
 */
export function cubicBezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const u2 = u * u;
  const t2 = t * t;
  return u2 * u * p0 + 3 * u2 * t * p1 + 3 * u * t2 * p2 + t2 * t * p3;
}


// ─────────────────────────────────────────────────────────────────────────────
// V. VEKTOR OPERATSIYALARI (Three.js'siz)
// ─────────────────────────────────────────────────────────────────────────────
// Physics modullarida Three.js import qilmaslik uchun
// Oddiy massiv [x,y,z] formatida ishlaydi

/**
 * Vektor uzunligi
 * @param {number[]} v - [x, y, z]
 * @returns {number}
 */
export function vecLength(v) {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

/**
 * Vektorni normallash (birlik vektorga aylantirish)
 * @param {number[]} v
 * @returns {number[]}
 */
export function vecNormalize(v) {
  const len = vecLength(v);
  if (len < EPSILON) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

/**
 * Skalar ko'paytma (dot product)
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function vecDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Vektorli ko'paytma (cross product)
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number[]}
 */
export function vecCross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/**
 * Vektor qo'shish
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number[]}
 */
export function vecAdd(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/**
 * Vektor ayirish
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number[]}
 */
export function vecSub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/**
 * Vektorni skalarga ko'paytirish
 * @param {number[]} v
 * @param {number} s
 * @returns {number[]}
 */
export function vecScale(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

/**
 * Ikki vektor orasidagi masofa
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function vecDistance(a, b) {
  return vecLength(vecSub(a, b));
}

/**
 * Vektor lerp
 * @param {number[]} a
 * @param {number[]} b
 * @param {number} t
 * @returns {number[]}
 */
export function vecLerp(a, b, t) {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];
}


// ─────────────────────────────────────────────────────────────────────────────
// VI. FIZIK BIRLIK KONVERSIYALARI
// ─────────────────────────────────────────────────────────────────────────────
//
// Simulyatsiya natural units'da ishlaydi (G=1, c=1, M=1).
// HUD va foydalanuvchi interfeysi uchun SI birliklariga aylantirish kerak.
// ─────────────────────────────────────────────────────────────────────────────

const SI = {
  G: 6.67430e-11,
  c: 2.99792458e8,
  M_sun: 1.989e30,
};

/**
 * Natural units'dagi radiusni metrlarga aylantirish
 *
 * r_SI = r_natural × (GM/c²)
 *
 * @param {number} rNatural - Natural units'dagi radius
 * @param {number} massSolar - Quyosh massasi birligida massa
 * @returns {number} Metrda
 */
export function naturalRadiusToMeters(rNatural, massSolar) {
  const M_kg = massSolar * SI.M_sun;
  const lengthScale = SI.G * M_kg / (SI.c * SI.c);
  return rNatural * lengthScale;
}

/**
 * Natural units'dagi vaqtni soniyalarga aylantirish
 *
 * t_SI = t_natural × (GM/c³)
 *
 * @param {number} tNatural
 * @param {number} massSolar
 * @returns {number} Soniyada
 */
export function naturalTimeToSeconds(tNatural, massSolar) {
  const M_kg = massSolar * SI.M_sun;
  const timeScale = SI.G * M_kg / (SI.c * SI.c * SI.c);
  return tNatural * timeScale;
}

/**
 * Schwarzschild radiusini metrlarda hisoblash
 *
 * Rs = 2GM/c² [metrlarda]
 *
 * @param {number} massSolar - Quyosh massasi birligida
 * @returns {number} Metrda
 */
export function schwarzschildRadiusMeters(massSolar) {
  const M_kg = massSolar * SI.M_sun;
  return 2.0 * SI.G * M_kg / (SI.c * SI.c);
}

/**
 * Metrlarni qulay formatga aylantirish
 * 1e3 → "1 km", 1e9 → "1 mln km", 1e12 → "6.7 AU"
 *
 * @param {number} meters
 * @returns {string}
 */
export function formatDistance(meters) {
  const AU = 1.496e11;  // Astronomik birlik (metrda)
  const LY = 9.461e15;  // Yorug'lik yili (metrda)

  if (meters < 1000) {
    return `${meters.toFixed(1)} m`;
  } else if (meters < 1e6) {
    return `${(meters / 1000).toFixed(1)} km`;
  } else if (meters < AU * 0.1) {
    return `${(meters / 1e6).toFixed(1)} mln km`;
  } else if (meters < LY * 0.1) {
    return `${(meters / AU).toFixed(2)} AU`;
  } else {
    return `${(meters / LY).toFixed(2)} ly`;
  }
}

/**
 * Katta sonlarni qulay formatga aylantirish
 * 1e6 → "1M", 1e9 → "1B", 100e6 → "100M"
 *
 * @param {number} value
 * @returns {string}
 */
export function formatLargeNumber(value) {
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}