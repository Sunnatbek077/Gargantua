/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Doppler Effect Shader
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Relativistik Doppler effekt va gravitatsion qizil siljish.
 *
 * Interstellar filmidagi eng ko'zga ko'ringan effektlardan biri:
 *   - Diskning sizga qarab harakatlangan tomoni YORQINROQ va KO'KROQ
 *   - Sizdan uzoqlashayotgan tomoni XIRAROQ va QIZILROQ
 *   - Bu assimetriya "Gargantua"ning xarakterli ko'rinishini beradi
 *
 * Fizik sabab:
 *   Yorug'lik manbai sizga qarab harakatlansa, to'lqin uzunligi
 *   qisqaradi (ko'k siljish), uzoqlashsa — cho'ziladi (qizil siljish).
 *   Qo'shimcha: gravitatsiya ham yorug'likni "qizartiradi" (redshift).
 *
 * Formulalar:
 *   #22 — g = 1 / (γ(1 + β·cosα))
 *          Relativistik Doppler omili
 *   #23 — I_obs = g^4 · I_emit
 *          Doppler beaming (yorqinlik o'zgarishi)
 *   #24 — z_grav = 1/√(1 - Rs/r) - 1
 *          Gravitatsion qizil siljish
 *   #25 — ν_obs/ν_emit = g · √(1-Rs/r_emit) / √(1-Rs/r_obs)
 *          Umumiy chastota siljishi (Doppler + gravitatsion)
 * ═══════════════════════════════════════════════════════════════════════════════
 */


// ─────────────────────────────────────────────────────────────────────────────
// I. LORENTZ OMILI (γ)
// ─────────────────────────────────────────────────────────────────────────────
//
// γ = 1 / √(1 - v²/c²)
//
// v → 0 da γ → 1 (effekt yo'q)
// v → c da γ → ∞ (effekt cheksiz)
//
// Natural units'da c = 1, shuning uchun:
// γ = 1 / √(1 - v²)
// ─────────────────────────────────────────────────────────────────────────────

float lorentzFactor(float velocity) {
  float v2 = velocity * velocity;
  // Raqamli barqarorlik — v ≈ c da 0 ga bo'linishni oldini olish
  v2 = min(v2, 0.9999);
  return 1.0 / sqrt(1.0 - v2);
}


// ─────────────────────────────────────────────────────────────────────────────
// II. DOPPLER OMILI (g)
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Formula #22 ──
//
// g = 1 / (γ · (1 + β · cos(α)))
//
// Bu yerda:
//   γ — Lorentz omili
//   β — v/c (tezlik / yorug'lik tezligi)
//   α — manba harakat yo'nalishi va kuzatuvchiga bo'lgan burchak
//       cos(α) > 0 → uzoqlashayotgan (qizil siljish, g < 1)
//       cos(α) < 0 → yaqinlashayotgan (ko'k siljish, g > 1)
//       cos(α) = 0 → ko'ndalang (faqat vaqt kengayishi, g = 1/γ)
//
// g > 1 → ko'k siljish (yaqinlashayotgan)
// g < 1 → qizil siljish (uzoqlashayotgan)
// g = 1 → siljish yo'q
// ─────────────────────────────────────────────────────────────────────────────

float dopplerFactor(
  vec3 hitPoint,      // Disk yuzasidagi nuqta
  vec3 cameraPos,     // Kuzatuvchi pozitsiyasi
  float velocity,     // Orbital tezlik v/c
  float Rs            // Schwarzschild radiusi
) {
  // Disk tekisligidagi orbital harakat yo'nalishi
  // Aylanish y o'qi atrofida — tangensial yo'nalish
  vec2 diskPos = hitPoint.xz;
  float r = length(diskPos);
  
  if (r < 0.001) return 1.0;

  // Tangensial yo'nalish (soat strelkasiga qarshi)
  // Agar pozitsiya (x, z) bo'lsa, tangensial = (-z, x) / r
  vec3 orbitalDir = normalize(vec3(-diskPos.y, 0.0, diskPos.x));

  // Kuzatuvchiga yo'nalish
  vec3 toObserver = normalize(cameraPos - hitPoint);

  // cos(α) — orbital harakat va kuzatuvchi orasidagi burchak
  float cosAlpha = dot(orbitalDir, toObserver);

  // β = v/c (natural units'da c = 1)
  float beta = velocity;

  // Lorentz omili
  float gamma = lorentzFactor(velocity);

  // ── Formula #22 ──
  float g = 1.0 / (gamma * (1.0 + beta * cosAlpha));

  return g;
}


// ─────────────────────────────────────────────────────────────────────────────
// III. DOPPLER BEAMING — yorqinlik o'zgarishi
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Formula #23 ──
//
// I_obs = g^n · I_emit
//
// Bu yerda n = beaming exponent:
//   n = 4 — termal (qora tanali) nurlanish uchun
//   n = 3+α — sinxrotron nurlanish uchun (α ≈ spektral indeks)
//
// Fizik ma'no:
//   Sizga qarab harakatlangan nurlanish kuchayadi (g > 1 → g^4 >> 1)
//   Sizdan uzoqlashayotgan nurlanish kuchsizlanadi (g < 1 → g^4 << 1)
//
// Bu "relativistik prožektor effekti" — harakat yo'nalishida
// yorug'lik konsentratsiyalanadi
//
// Natija: yorqinlik multiplikatori
// ─────────────────────────────────────────────────────────────────────────────

float dopplerBeaming(float g, float exponent) {
  // Xavfsiz darajaga ko'tarish (g juda katta yoki kichik bo'lganda)
  float clampedG = clamp(g, 0.1, 5.0);
  return pow(clampedG, exponent);
}


// ─────────────────────────────────────────────────────────────────────────────
// IV. GRAVITATSION QIZIL SILJISH
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Formula #24 ──
//
// z_grav = 1 / √(1 - Rs/r) - 1
//
// Gravitatsiya yorug'likni "cho'zadi" — chastota pasayadi.
// Bu Doppler effektdan ALOHIDA — faqat gravitatsiyadan.
//
// r → Rs da z → ∞ (cheksiz qizil siljish — voqealar gorizonti)
// r → ∞ da z → 0 (effekt yo'q)
//
// Natija: z ≥ 0, 0 = siljish yo'q
// ─────────────────────────────────────────────────────────────────────────────

float gravitationalRedshift(float r, float Rs) {
  if (r <= Rs) return 100.0;  // Gorizont ichida — cheksiz

  float factor = 1.0 - Rs / r;
  if (factor <= 0.0) return 100.0;

  return 1.0 / sqrt(factor) - 1.0;
}

// Gravitatsion qizil siljish omili (rang multiplikatori sifatida)
// 1.0 = siljish yo'q, < 1.0 = qizilga siljigan
float gravitationalRedshiftFactor(float r, float Rs) {
  if (r <= Rs) return 0.0;

  float factor = 1.0 - Rs / r;
  if (factor <= 0.0) return 0.0;

  return sqrt(factor);  // [0, 1)
}


// ─────────────────────────────────────────────────────────────────────────────
// V. UMUMIY CHASTOTA SILJISHI
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Formula #25 ──
//
// ν_obs / ν_emit = g · √(1 - Rs/r_emit) / √(1 - Rs/r_obs)
//
// Doppler + gravitatsion effektlarni birlashtirish:
//   - g — Doppler omili (harakat)
//   - √(1-Rs/r_emit) — chiqqan nuqtadagi gravitatsion qizartirish
//   - √(1-Rs/r_obs) — kuzatuvchi nuqtadagi gravitatsion ko'kartirish
//
// Kuzatuvchi uzoqda bo'lsa (r_obs >> Rs):
//   √(1-Rs/r_obs) ≈ 1
//   va formula soddalashadi: ν_obs/ν_emit = g · √(1-Rs/r_emit)
// ─────────────────────────────────────────────────────────────────────────────

float combinedFrequencyShift(float g, float rEmit, float rObs, float Rs) {
  float gravEmit = gravitationalRedshiftFactor(rEmit, Rs);

  // Kuzatuvchi uzoqda bo'lsa
  float gravObs = 1.0;
  if (rObs < 100.0 * Rs) {
    gravObs = gravitationalRedshiftFactor(rObs, Rs);
  }

  // Umumiy siljish
  if (gravObs < 0.001) return 0.0;
  return g * gravEmit / gravObs;
}


// ─────────────────────────────────────────────────────────────────────────────
// VI. RANG SILJISHI — chastota o'zgarishini rangga aylantirish
// ─────────────────────────────────────────────────────────────────────────────
//
// Doppler effekt yorug'likning chastotasini o'zgartiradi.
// Ko'k siljish: qizil → sariq → yashil → ko'k
// Qizil siljish: ko'k → yashil → sariq → qizil → infraqizil
//
// Biz rangni "harorat siljishi" sifatida modellashtiramiz:
//   g > 1 → temperatura oshadi (ko'kroq rang)
//   g < 1 → temperatura pasayadi (qizilroq rang)
// ─────────────────────────────────────────────────────────────────────────────

vec3 applyDopplerColorShift(vec3 color, float g, float shiftStrength) {
  // g = 1 da o'zgarish yo'q
  // g > 1 da ko'k siljish
  // g < 1 da qizil siljish

  // Siljish miqdori
  float shift = (g - 1.0) * shiftStrength;

  // Ko'k siljish — ko'k kanal ko'payadi, qizil kamayadi
  // Qizil siljish — qizil ko'payadi, ko'k kamayadi
  vec3 shifted = color;

  if (shift > 0.0) {
    // Ko'k siljish — energiya oshadi
    // Qizil → sariq → oq → ko'kish oq
    float blueBoost = shift;
    shifted.b += blueBoost * 0.3;
    shifted.g += blueBoost * 0.1;
    shifted.r -= blueBoost * 0.1;
  } else {
    // Qizil siljish — energiya pasayadi
    // Oq → sariq → to'q sariq → qizil → infraqizil
    float redBoost = -shift;
    shifted.r += redBoost * 0.2;
    shifted.g -= redBoost * 0.15;
    shifted.b -= redBoost * 0.3;
  }

  return max(shifted, vec3(0.0));
}


// ─────────────────────────────────────────────────────────────────────────────
// VII. TO'LIQ DOPPLER QO'LLASH — birlashtiruvchi funksiya
// ─────────────────────────────────────────────────────────────────────────────
//
// Disk rangiga barcha Doppler va gravitatsion effektlarni qo'llash
//
// Kirish: disk rangi, hit nuqta, kamera pozitsiyasi, parametrlar
// Chiqish: Doppler-shifted rang (HDR)
// ─────────────────────────────────────────────────────────────────────────────

vec4 applyFullDoppler(
  vec4 diskColor,          // Asl disk rangi (HDR, alpha bilan)
  vec3 hitPoint,           // Disk yuzasidagi nuqta
  vec3 cameraPos,          // Kuzatuvchi pozitsiyasi
  float diskVelocity,      // Orbital tezlik (v/c)
  float Rs,                // Schwarzschild radiusi
  float beamingExponent,   // Beaming ko'rsatkichi (4.0)
  float colorShiftStrength,// Rang siljish kuchi
  float brightnessBoost,   // Yorqinlik kuchayishi
  float dopplerEnabled,    // 1.0 = yoqilgan, 0.0 = o'chirilgan
  float gravRedshiftEnabled // Gravitatsion redshift
) {
  if (dopplerEnabled < 0.5) return diskColor;

  float r = length(hitPoint.xz);

  // ── Doppler omili (Formula #22) ──
  float g = dopplerFactor(hitPoint, cameraPos, diskVelocity, Rs);

  // ── Doppler beaming — yorqinlik (Formula #23) ──
  float beaming = dopplerBeaming(g, beamingExponent);

  // ── Gravitatsion qizil siljish (Formula #24) ──
  float gravFactor = 1.0;
  if (gravRedshiftEnabled > 0.5) {
    gravFactor = gravitationalRedshiftFactor(r, Rs);
  }

  // ── Umumiy siljish (Formula #25) ──
  float totalShift = g * gravFactor;

  // ── Rang siljishi ──
  vec3 shiftedColor = applyDopplerColorShift(
    diskColor.rgb, totalShift, colorShiftStrength
  );

  // ── Yorqinlik qo'llash ──
  // beaming — bir tomon yorqin, bir tomon xira
  // gravFactor — gorizontga yaqinda hammasi xiraroq
  // brightnessBoost — estetik sozlash
  float finalBrightness = beaming * gravFactor * brightnessBoost;
  shiftedColor *= finalBrightness;

  return vec4(shiftedColor, diskColor.a * min(finalBrightness, 1.0));
}
