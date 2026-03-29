/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Accretion Disk Shader
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Accretion disk fizikasi va vizualizatsiyasi.
 *
 * Accretion disk — qora tuynuk atrofida spiralda aylanayotgan
 * qizib ketgan gaz va plazma diski. U quyoshdan millionlab
 * marta yorqinroq bo'lishi mumkin.
 *
 * Tarkibi:
 *   - Disk geometriyasi (ichki/tashqi radius, qalinlik)
 *   - Temperatura profili (Shakura-Sunyaev modeli)
 *   - Yorqinlik profili
 *   - Qora tanali nurlanish (Planck) → rang
 *   - Orbital tezlik (Kepler)
 *   - Disk-nur kesishish testi
 *   - Procedural tuzilma (noise orqali)
 *
 * Formulalar:
 *   #17 — r_ISCO = 6GM/c²              Disk ichki radiusi
 *   #18 — v_orb = √(M/r)·(1-Rs/r)⁻¹/² Kepler orbital tezligi
 *   #19 — T(r) = T_max·(r/r_ISCO)^(-3/4)·[1-√(r_ISCO/r)]^(1/4)
 *          Shakura-Sunyaev temperatura profili
 *   #20 — B(ν,T) = 2hν³/c² · 1/(e^(hν/kT)-1)
 *          Qora tanali nurlanish (Planck) — rangga aylantirish
 *   #21 — I(r) = I₀·(r_ISCO/r)³·[1-√(r_ISCO/r)]
 *          Disk yorqinlik profili
 * ═══════════════════════════════════════════════════════════════════════════════
 */


// ─────────────────────────────────────────────────────────────────────────────
// I. DISK PARAMETRLARI (uniform'lardan)
// ─────────────────────────────────────────────────────────────────────────────
// Bu qiymatlar JavaScript'dan (Scene.js) keladi:
//   uniform float u_diskInnerRadius;   // r_ISCO
//   uniform float u_diskOuterRadius;   // Tashqi chegara
//   uniform float u_diskThickness;     // Qalinlik (r ga nisbatan)
//   uniform float u_diskRotSpeed;      // Vizual aylanish tezligi
//   uniform float u_diskTMax;          // Maksimal temperatura (normallashtirilgan)
//   uniform vec3  u_diskColorHot;      // Issiq rang [1.0, 0.95, 0.88]
//   uniform vec3  u_diskColorWarm;     // Iliq rang [1.0, 0.55, 0.15]
//   uniform vec3  u_diskColorCool;     // Sovuq rang [0.75, 0.15, 0.02]


// ─────────────────────────────────────────────────────────────────────────────
// II. TEMPERATURA PROFILI
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Formula #19: Shakura-Sunyaev (1973) ──
//
// T(r) = T_max · (r / r_ISCO)^(-3/4) · [1 - √(r_ISCO / r)]^(1/4)
//
// Bu formula nima deydi:
//   - Disk eng issiq nuqtasi r_ISCO dan biroz tashqarida
//   - r_ISCO da T = 0 (gaz erkin tushish boshlanadi)
//   - Tashqariga qarab temperatura pasayadi (r^(-3/4))
//   - Ichki chegarada ildiz ifodasi 0 ga olib keladi
//
// Natija: [0, 1] — normallashtirilgan temperatura
// ─────────────────────────────────────────────────────────────────────────────

float diskTemperature(float r, float rISCO) {
  if (r <= rISCO) return 0.0;

  float ratio = rISCO / r;

  // (r / r_ISCO)^(-3/4) = (r_ISCO / r)^(3/4)
  float radialFalloff = pow(ratio, 0.75);

  // [1 - √(r_ISCO / r)]^(1/4)
  float innerCutoff = pow(max(1.0 - sqrt(ratio), 0.0), 0.25);

  return radialFalloff * innerCutoff;
}


// ─────────────────────────────────────────────────────────────────────────────
// III. YORQINLIK PROFILI
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Formula #21 ──
//
// I(r) = I₀ · (r_ISCO / r)³ · [1 - √(r_ISCO / r)]
//
// Yorqinlik markazga yaqinlashganda tez oshadi (r⁻³),
// lekin ISCO'da yana 0 ga tushadi.
// Eng yorqin nuqta r_ISCO dan ~1.5x tashqarida.
//
// Natija: [0, ~1] — normallashtirilgan yorqinlik
// ─────────────────────────────────────────────────────────────────────────────

float diskLuminosity(float r, float rISCO) {
  if (r <= rISCO) return 0.0;

  float ratio = rISCO / r;

  // (r_ISCO / r)³
  float radialFalloff = ratio * ratio * ratio;

  // 1 - √(r_ISCO / r)
  float innerCutoff = 1.0 - sqrt(ratio);

  return radialFalloff * max(innerCutoff, 0.0);
}


// ─────────────────────────────────────────────────────────────────────────────
// IV. ORBITAL TEZLIK
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Formula #18: Kepler orbital tezligi (Schwarzschild) ──
//
// v_orb = √(M/r) · (1 - Rs/r)^(-1/2)
//
// Natural units'da M = 1, Rs = 2:
// v_orb = 1/√r · 1/√(1 - 2/r)
//
// Relativistik korreksiya: (1 - Rs/r)^(-1/2) termi
// Gorizont yaqinida tezlik yorug'lik tezligiga yaqinlashadi
//
// Natija: v/c nisbati [0, 1)
// ─────────────────────────────────────────────────────────────────────────────

float diskOrbitalVelocity(float r, float Rs) {
  if (r <= Rs) return 1.0;  // Gorizont ostida — c

  float vKepler = 1.0 / sqrt(r);                    // √(M/r), M=1
  float relativisticCorrection = 1.0 / sqrt(1.0 - Rs / r);

  // c dan oshmasligi kerak
  return min(vKepler * relativisticCorrection, 0.999);
}

// Orbital burchak tezligi (Doppler hisoblash uchun)
// ω = v_orb / r
float diskAngularVelocity(float r, float Rs) {
  return diskOrbitalVelocity(r, Rs) / r;
}


// ─────────────────────────────────────────────────────────────────────────────
// V. QORA TANALI NURLANISH → RANG
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Formula #20: Planck qonuni ──
//
// B(ν,T) = 2hν³/c² · 1/(e^(hν/kT) - 1)
//
// Haqiqiy Planck integralini shader'da hisoblash qimmat.
// O'rniga: normallashtirilgan temperaturani to'g'ridan-to'g'ri
// rangga aylantiruvchi approksimatsiya ishlatiladi.
//
// Bu "qora tanali rang egri chizig'i" (blackbody locus):
//   T past  → chuqur qizil     (3000K)
//   T o'rta → oltin-to'q sariq  (5000K)
//   T yuqori → oq-ko'kish       (10000K+)
// ─────────────────────────────────────────────────────────────────────────────

vec3 blackbodyColor(float temperature) {
  // Interstellar Gargantua palitrasi:
  // Sovuq (tashqi) — to'q sariq/bronza
  // Issiq (ichki)  — oq, deyarli ko'kish-oq
  // Foton halqa — sof oq

  vec3 color;

  if (temperature < 0.25) {
    // Bronza-oltin: tashqi disk
    float t = temperature / 0.25;
    color = vec3(0.7 + t * 0.25, 0.35 + t * 0.3, 0.05 + t * 0.15);
  } else if (temperature < 0.5) {
    // Oltin → sariq-oq
    float t = (temperature - 0.25) / 0.25;
    color = vec3(0.95 + t * 0.05, 0.65 + t * 0.25, 0.2 + t * 0.45);
  } else if (temperature < 0.75) {
    // Sariq-oq → issiq oq
    float t = (temperature - 0.5) / 0.25;
    color = vec3(1.0, 0.9 + t * 0.08, 0.65 + t * 0.3);
  } else {
    // Sof oq (ichki, juda issiq) — Interstellar'dagi markaziy porlash
    float t = (temperature - 0.75) / 0.25;
    color = vec3(1.0, 0.98 + t * 0.02, 0.95 + t * 0.05);
  }

  return color;
}

// Muqobil: uch rangli interpolatsiya (config'dagi ranglar bilan)
vec3 diskColorFromMap(float temperature, vec3 colorHot, vec3 colorWarm, vec3 colorCool) {
  if (temperature < 0.5) {
    return mix(colorCool, colorWarm, temperature * 2.0);
  } else {
    return mix(colorWarm, colorHot, (temperature - 0.5) * 2.0);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// VI. DISK-NUR KESISHISH TESTI
// ─────────────────────────────────────────────────────────────────────────────
//
// Nur y=0 tekisligini (ekvatorial tekislik) kesib o'tganini tekshirish.
// Disk yupqa — y ≈ 0 tekislikda joylashgan.
//
// Qaytaradi:
//   hitDist > 0  — kesishish nuqtasigacha masofa
//   hitDist < 0  — kesishish yo'q
// ─────────────────────────────────────────────────────────────────────────────

float diskIntersection(
  vec3 rayPos,            // Nurning hozirgi pozitsiyasi
  vec3 prevRayPos,        // Oldingi qadam pozitsiyasi
  float diskInnerRadius,  // Disk ichki radiusi (r_ISCO)
  float diskOuterRadius   // Disk tashqi radiusi
) {
  // Nur y=0 tekisligini kesib o'tdimi?
  // Agar y ishorasi o'zgargan bo'lsa — kesib o'tgan
  if (prevRayPos.y * rayPos.y > 0.0) {
    return -1.0;  // Kesishish yo'q — ikkalasi bir tomonda
  }

  // Kesishish nuqtasini interpolatsiya orqali topish
  // t = oldingi_y / (oldingi_y - hozirgi_y)
  float t = prevRayPos.y / (prevRayPos.y - rayPos.y);
  vec3 hitPoint = mix(prevRayPos, rayPos, t);

  // Kesishish nuqtasining radiusi
  float hitR = length(hitPoint.xz);  // xz tekislikdagi masofa

  // Disk chegaralari ichidami?
  if (hitR >= diskInnerRadius && hitR <= diskOuterRadius) {
    return hitR;  // Disk radiusi qaytariladi
  }

  return -1.0;  // Disk tashqarisida
}


// ─────────────────────────────────────────────────────────────────────────────
// VII. YAKUNIY DISK RANGI — hamma narsani birlashtirish
// ─────────────────────────────────────────────────────────────────────────────
//
// Kirish: disk radiusi, disk pozitsiyasi, vaqt, parametrlar
// Chiqish: HDR rang (vec4, alpha = shaffoflik)
//
// Hisoblash tartibi:
//   1. Temperatura (#19)
//   2. Yorqinlik (#21)
//   3. Rang (#20 approksimatsiya)
//   4. Noise tuzilma (#31, #32)
//   5. Birlashtirish
// ─────────────────────────────────────────────────────────────────────────────

vec4 computeDiskColor(
  float hitR,               // Disk radiusi (kesishish nuqtasi)
  vec3 hitPoint,            // 3D kesishish nuqtasi
  float time,               // Vaqt
  float rISCO,              // ISCO radiusi
  float outerRadius,        // Tashqi radius
  float Rs,                 // Schwarzschild radiusi
  vec3 colorHot,            // Config ranglar
  vec3 colorWarm,
  vec3 colorCool,
  float noiseScale,         // Noise parametrlari
  int noiseOctaves,
  float noiseLacunarity,
  float noisePersistence,
  float noiseTimeScale,
  float rotSpeed            // Aylanish tezligi
) {
  // ── 1. Temperatura (Formula #19) ──
  float temp = diskTemperature(hitR, rISCO);

  // ── 2. Yorqinlik (Formula #21) ──
  float lum = diskLuminosity(hitR, rISCO);

  // ── 3. Asosiy rang — temperaturadan ──
  vec3 baseColor = blackbodyColor(temp);
  // Config ranglar bilan aralashtirish (40% fizik, 60% estetik)
  vec3 mapColor = diskColorFromMap(temp, colorHot, colorWarm, colorCool);
  vec3 color = mix(mapColor, baseColor, 0.4);

  // ── 4. Noise tuzilma (Formulalar #31, #32) ──
  vec2 diskPos = hitPoint.xz;  // Disk tekisligidagi pozitsiya

  float r = length(diskPos);
  float phi = atan(diskPos.y, diskPos.x);

  // Aylanish — ichki qism tezroq (Kepler)
  float rotAngle = time * rotSpeed * (2.0 / (hitR + 1.0));
  phi -= rotAngle; // Azimut bo'yicha aylanish

  // ── FIX 1: Kuchaytirilgan domain warping ──
  float wp_r = r + 0.6 * fbm2D(vec2(r * 5.0, phi), 4, 2.0, 0.5);
  float wp_phi = phi + 0.8 * fbm2D(vec2(r * 4.0, phi * 3.0), 4, 2.0, 0.5);

  // ── FIX 2: Kuchaytrilgan noiseCoord ──
  vec3 noiseCoord = vec3(wp_r * noiseScale * 8.0, wp_phi * 5.0, time * noiseTimeScale * 0.5);
  float noiseVal = fbm3D(noiseCoord, 6, noiseLacunarity, noisePersistence);

  // Map from [-1, 1] to [0, 1]
  float n = noiseVal * 0.5 + 0.5;
  n = max(n, 0.0);
  
  // Multiply noise contrast: bright filaments pop against dark gaps
  n = pow(n, 0.7);

  // ── FIX 3: Kuchaytrilgan noiseFactor ──
  float noiseFactor = mix(0.0, 2.5, pow(n, 1.4));

  // ── 5. Radial fade ──
  // Disk chetlariga qarab silliq so'nish
  float radialPos = (hitR - rISCO) / (outerRadius - rISCO);
  float edgeFade = 1.0 - smoothstep(0.7, 1.0, radialPos);  // Tashqi chetda
  float innerFade = smoothstep(0.0, 0.05, radialPos);       // Ichki chetda

  // ── 6. Yakuniy birlashtirish ──
  float finalLuminosity = lum * noiseFactor * edgeFade * innerFade;

  // HDR yorqinlik — Interstellar: disk quyoshdan millionlab marta yorqin
  // Ichki qism (temp→1) juda oq va porlab turadi
  // Tashqi qism sariq-bronza, xira
  float hdrMultiplier = 4.0 + temp * 12.0;
  color *= finalLuminosity * hdrMultiplier;

  // Alpha — disk zichligi (post-processing uchun)
  float alpha = finalLuminosity * edgeFade * innerFade;

  return vec4(color, alpha);
}
