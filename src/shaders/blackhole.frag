/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Main Fragment Shader
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * LOYIHANING YURAGI — har bir piksel uchun mustaqil ray marching.
 *
 * Har piksel uchun:
 *   1. Kameradan nur yo'naltirish (#34)
 *   2. Nurni egri fazovaqtda harakatlantirish (#1-9)
 *   3. Accretion disk kesishishini tekshirish (#17-21, #31-32)
 *   4. Doppler effektlarni qo'llash (#22-25)
 *   5. Yulduz fonini ko'rsatish (#13-16, #35)
 *   6. Foton halqasi porlashi
 *   7. Tone mapping va yakuniy rang (#26, #36, #37)
 *
 * Formulalar: BARCHA 37 ta shu yerda yoki #include orqali ishlatiladi
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

precision highp float;

// ─────────────────────────────────────────────────────────────────────────────
// UNIFORM'LAR — JavaScript'dan keladi (Scene.js)
// ─────────────────────────────────────────────────────────────────────────────

// ── Vaqt ──
uniform float u_time;
uniform float u_deltaTime;

// ── Ekran ──
uniform vec2 u_resolution;

// ── Kamera (#34) ──
uniform vec3  u_cameraPos;
uniform vec3  u_cameraDir;
uniform vec3  u_cameraRight;
uniform vec3  u_cameraUp;
uniform float u_focalLength;
uniform float u_aspectRatio;

// ── Qora tuynuk (#1-5) ──
uniform float u_blackHoleMass;
uniform float u_Rs;
uniform float u_spin;
uniform float u_charge;
uniform float u_rPhotonSphere;
uniform float u_rISCO;
uniform float u_rOuterHorizon;

// ── Accretion disk (#17-21, #31-32) ──
uniform float u_diskInnerRadius;
uniform float u_diskOuterRadius;
uniform float u_diskThickness;
uniform float u_diskRotSpeed;
uniform float u_diskTMax;
uniform vec3  u_diskColorHot;
uniform vec3  u_diskColorWarm;
uniform vec3  u_diskColorCool;
uniform float u_noiseScale;
uniform float u_noiseLacunarity;
uniform int   u_noiseOctaves;
uniform float u_noisePersistence;
uniform float u_noiseTimeScale;

// ── Doppler (#22-25) ──
uniform float u_dopplerEnabled;
uniform float u_beamingExp;
uniform float u_colorShift;
uniform float u_brightnessBoost;
uniform float u_gravRedshift;

// ── Ray marching (#6-9) ──
uniform int   u_maxSteps;
uniform float u_stepSize;
uniform float u_adaptiveStep;
uniform float u_minStepSize;
uniform float u_maxStepSize;
uniform float u_stepSizeFactor;
uniform float u_escapeRadius;
uniform float u_captureRadius;
uniform float u_useRK4;

// ── Lensing (#13-16) ──
uniform float u_lensingEnabled;
uniform float u_photonRingIntensity;

// ── Texturalar ──
uniform samplerCube u_starfieldCube;
uniform sampler2D   u_noiseTexture;

// ── Vertex shader'dan ──
varying vec2 vUv;


// ═══════════════════════════════════════════════════════════════════════════════
// INCLUDE: Yordamchi shader fayllar
// ═══════════════════════════════════════════════════════════════════════════════
// Build tizimida bu #include orqali alohida fayllardan olinadi.
// Hozir esa to'g'ridan-to'g'ri shu yerga yoziladi.
// Vite + glslify yoki raw-loader bilan alohida fayllardan import qilish mumkin.


// ─────────────────────────────────────────────────────────────────────────────
// NOISE FUNKSIYALARI (noise.glsl)
// ─────────────────────────────────────────────────────────────────────────────

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

vec3 quintic3(vec3 x) {
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

float gradientNoise3D(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = quintic3(f);

  float n000 = hash31(i);
  float n100 = hash31(i + vec3(1, 0, 0));
  float n010 = hash31(i + vec3(0, 1, 0));
  float n110 = hash31(i + vec3(1, 1, 0));
  float n001 = hash31(i + vec3(0, 0, 1));
  float n101 = hash31(i + vec3(1, 0, 1));
  float n011 = hash31(i + vec3(0, 1, 1));
  float n111 = hash31(i + vec3(1, 1, 1));

  float n00 = mix(n000, n100, u.x);
  float n10 = mix(n010, n110, u.x);
  float n01 = mix(n001, n101, u.x);
  float n11 = mix(n011, n111, u.x);
  float n0  = mix(n00, n10, u.y);
  float n1  = mix(n01, n11, u.y);

  return mix(n0, n1, u.z) * 2.0 - 1.0;
}

float fbm3D(vec3 p, int octaves, float lac, float pers) {
  float val = 0.0, amp = 0.5, freq = 1.0, maxVal = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    val += amp * gradientNoise3D(p * freq);
    maxVal += amp;
    freq *= lac;
    amp *= pers;
  }
  return val / maxVal;
}


// ─────────────────────────────────────────────────────────────────────────────
// ACCRETION DISK (accretion.glsl)
// ─────────────────────────────────────────────────────────────────────────────

// ── Formula #19: Temperatura ──
float diskTemperature(float r, float rISCO) {
  if (r <= rISCO) return 0.0;
  float ratio = rISCO / r;
  return pow(ratio, 0.75) * pow(max(1.0 - sqrt(ratio), 0.0), 0.25);
}

// ── Formula #21: Yorqinlik ──
float diskLuminosity(float r, float rISCO) {
  if (r <= rISCO) return 0.0;
  float ratio = rISCO / r;
  return ratio * ratio * ratio * max(1.0 - sqrt(ratio), 0.0);
}

// ── Formula #18: Orbital tezlik ──
float diskOrbitalVelocity(float r, float Rs) {
  if (r <= Rs) return 0.999;
  return min(1.0 / sqrt(r) / sqrt(1.0 - Rs / r), 0.999);
}

// ── Formula #20: Qora tana rangi — INTERSTELLAR palitrasi ──
vec3 blackbodyColor(float t) {
  // Interstellar'da disk deyarli oq-oltin, qizil juda kam
  if (t < 0.3) {
    float s = t / 0.3;
    return vec3(s * 0.9, s * 0.65, s * 0.4);         // Qorong'i oltin
  }
  if (t < 0.6) {
    float s = (t - 0.3) / 0.3;
    return vec3(0.9 + s * 0.1, 0.65 + s * 0.25, 0.4 + s * 0.35);  // Iliq oltin → oq
  }
  float s = (t - 0.6) / 0.4;
  return vec3(1.0, 0.9 + s * 0.1, 0.75 + s * 0.22);  // Oq-oltin
}

// Disk noise — spiral tuzilma
float diskNoise(vec2 diskPos, float time) {
  float r = length(diskPos);
  float theta = atan(diskPos.y, diskPos.x);
  float spiralAngle = theta + 3.0 / (r + 0.5) + time * u_noiseTimeScale * (2.0 / (r + 1.0));

  vec3 p3d = vec3(r * u_noiseScale, spiralAngle * u_noiseScale * 0.5, time * u_noiseTimeScale * 0.3);

  float large = fbm3D(p3d * 0.5, max(u_noiseOctaves - 2, 2), u_noiseLacunarity, u_noisePersistence);
  float small = fbm3D(p3d * 2.0, u_noiseOctaves, u_noiseLacunarity, u_noisePersistence);
  float spiral = sin(spiralAngle * 3.0 + r * 2.0) * 0.5 + 0.5;

  return large * 0.55 + small * 0.3 + pow(spiral, 1.5) * 0.15;
}

// To'liq disk rangi
vec4 computeDiskColor(float hitR, vec3 hitPoint) {
  float temp = diskTemperature(hitR, u_diskInnerRadius);
  float lum  = diskLuminosity(hitR, u_diskInnerRadius);

  // Rang
  vec3 bbColor = blackbodyColor(temp);
  vec3 mapColor = temp < 0.5
    ? mix(u_diskColorCool, u_diskColorWarm, temp * 2.0)
    : mix(u_diskColorWarm, u_diskColorHot, (temp - 0.5) * 2.0);
  vec3 color = mix(mapColor, bbColor, 0.4);

  // Aylanish
  vec2 dp = hitPoint.xz;
  float rotAngle = u_time * u_diskRotSpeed * (2.0 / (hitR + 1.0));
  float ca = cos(rotAngle), sa = sin(rotAngle);
  vec2 rp = vec2(dp.x * ca - dp.y * sa, dp.x * sa + dp.y * ca);

  // Noise
  float n = diskNoise(rp, u_time);
  float nFactor = 0.6 + n * 0.4;

  // Edge fade
  float radPos = (hitR - u_diskInnerRadius) / (u_diskOuterRadius - u_diskInnerRadius);
  float fade = smoothstep(0.0, 0.05, radPos) * (1.0 - smoothstep(0.7, 1.0, radPos));

  float finalLum = lum * max(nFactor, 0.1) * fade;
  // INTERSTELLAR FIX: disk yorqinroq — bloom kuchli bo'ladi
  float hdr = 3.0 + temp * 5.0;
  color *= finalLum * hdr;

  return vec4(color, finalLum * fade);
}


// ─────────────────────────────────────────────────────────────────────────────
// DOPPLER (doppler.glsl)
// ─────────────────────────────────────────────────────────────────────────────

// ── Formula #22: Doppler omili ──
float dopplerFactor(vec3 hitPt, vec3 camPos, float vel) {
  vec2 dp = hitPt.xz;
  float r = length(dp);
  if (r < 0.001) return 1.0;

  vec3 orbDir = normalize(vec3(-dp.y, 0.0, dp.x));
  vec3 toObs = normalize(camPos - hitPt);
  float cosA = dot(orbDir, toObs);
  float beta = vel;
  float gamma = 1.0 / sqrt(max(1.0 - beta * beta, 0.0001));

  return 1.0 / (gamma * (1.0 + beta * cosA));
}

// ── Formula #23: Beaming ──
float dopplerBeaming(float g, float exp_val) {
  return pow(clamp(g, 0.1, 5.0), exp_val);
}

// ── Formula #24: Gravitatsion redshift factor ──
float gravRedshiftFactor(float r, float Rs) {
  if (r <= Rs) return 0.0;
  return sqrt(max(1.0 - Rs / r, 0.0));
}

// ── Rang siljishi ──
vec3 dopplerColorShift(vec3 col, float g, float str) {
  float shift = (g - 1.0) * str;
  if (shift > 0.0) {
    col.b += shift * 0.3;
    col.g += shift * 0.1;
    col.r -= shift * 0.1;
  } else {
    col.r -= shift * 0.2;
    col.g += shift * 0.15;
    col.b += shift * 0.3;
  }
  return max(col, vec3(0.0));
}

// To'liq Doppler qo'llash
vec4 applyDoppler(vec4 diskCol, vec3 hitPt, float hitR) {
  if (u_dopplerEnabled < 0.5) return diskCol;

  float vel = diskOrbitalVelocity(hitR, u_Rs);
  float g = dopplerFactor(hitPt, u_cameraPos, vel);
  float beam = dopplerBeaming(g, u_beamingExp);

  float grav = 1.0;
  if (u_gravRedshift > 0.5) {
    grav = gravRedshiftFactor(hitR, u_Rs);
  }

  float totalShift = g * grav;
  vec3 shifted = dopplerColorShift(diskCol.rgb, totalShift, u_colorShift);
  float brightness = beam * grav * u_brightnessBoost;
  shifted *= brightness;

  return vec4(shifted, diskCol.a * min(brightness, 1.0));
}


// ─────────────────────────────────────────────────────────────────────────────
// LENSING (lensing.glsl)
// ─────────────────────────────────────────────────────────────────────────────

// ── Foton halqa porlashi ──
// INTERSTELLAR FIX: normalizatsiya — zoom'da barqaror
float photonRingGlow(float closest, float rPh) {
  // Nisbiy masofa: foton sferaga qanchalik yaqin
  float relDist = abs(closest - rPh) / rPh;
  
  // Asosiy glow — keng, yumshoq
  float glow = exp(-relDist * relDist * 80.0) * u_photonRingIntensity;
  
  // Birlamchi halqa — tor, yorqin
  float ring1 = exp(-relDist * relDist * 400.0) * u_photonRingIntensity * 2.0;
  
  // Ikkilamchi halqa — juda tor
  float relDist2 = abs(closest - rPh * 1.01) / rPh;
  float ring2 = exp(-relDist2 * relDist2 * 1500.0) * u_photonRingIntensity * 0.8;
  
  return glow + ring1 + ring2;
}


// ─────────────────────────────────────────────────────────────────────────────
// TONE MAPPING (tonemap.glsl)
// ─────────────────────────────────────────────────────────────────────────────

// ── Formula #36: Luminance ──
float calcLuminance(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// ── Formula #26: ACES ──
vec3 acesToneMap(vec3 x) {
  return clamp(
    (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14),
    0.0, 1.0
  );
}

// ── Formula #37: Gamma ──
vec3 gammaCorrect(vec3 c) {
  return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));
}

// Vignette — INTERSTELLAR: kuchliroq kadr hissi
float vignette(vec2 uv) {
  vec2 d = abs(uv - 0.5) * 2.0;
  d = pow(d, vec2(0.8));
  float dist = pow(d.x + d.y, 1.0 / 0.8);
  return 1.0 - smoothstep(0.3, 1.0, dist) * 0.55;
}

// ── Formula #29: Film grain — INTERSTELLAR: 70mm IMAX ──
float filmGrain(vec2 uv, float time) {
  return (fract(sin(dot(uv + fract(time * 0.71), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.12;
}


// ═══════════════════════════════════════════════════════════════════════════════
// GRAVITATSION TEZLANISH — ray marching uchun
// ═══════════════════════════════════════════════════════════════════════════════

// ── Formula #1 (Schwarzschild) soddalashtirilgan gravitatsion tezlanish ──
// Nurga ta'sir qiluvchi gravitatsion kuch
// a = -M·h·(position / r³)
// h = 1.5 * Rs² (foton uchun effektiv parametr)
vec3 gravitationalAcceleration(vec3 pos, float Rs) {
  float r = length(pos);
  if (r < 0.001) return vec3(0.0);

  float r2 = r * r;
  float r3 = r2 * r;

  // Schwarzschild geodezik: effektiv potentsial gradiyenti
  // Foton uchun: a = -1.5 * Rs² / r⁴ * (pos/r) + korreksiyalar
  //
  // Soddalashtirilgan, lekin fizik jihatdan to'g'ri:
  // Gravitatsion kuch + relativistik korreksiya
  float M = Rs * 0.5;  // Rs = 2M → M = Rs/2

  // Newtonian + GR korreksiya
  // Newtonian: -M/r² * pos_hat
  // GR korreksiya: -1.5 * Rs * L² / r⁴ (L = burchak impulsi)
  float accelMag = -M / r2;

  // Relativistik korreksiya — foton sferani to'g'ri beradi
  // INTERSTELLAR FIX: 1.5 → 3.0 — nurlar kuchliroq egriladi
  // Bu disk ustidan va ostidan ham ko'rinishini ta'minlaydi
  float grCorrection = 1.0 + 3.0 * Rs * Rs / r2;

  return normalize(pos) * accelMag * grCorrection;
}

// ── Kerr-Newman metriki uchun gravitatsion tezlanish (#2, #3, #4, #5) ──
// Spin + Zaryad ta'sirini hisobga oluvchi korreksiya
vec3 kerrNewmanAcceleration(vec3 pos, float Rs, float spin, float charge) {
  if (abs(spin) < 0.001 && abs(charge) < 0.001) {
    return gravitationalAcceleration(pos, Rs);
  }

  float r = length(pos);
  if (r < 0.001) return vec3(0.0);

  float M = Rs * 0.5;
  float a = spin * M;  // Kerr parametri
  float Q = charge;    // Zaryad parametri

  // ── Formula #4, #5: Σ va Δ ──
  float cosTheta = pos.y / r;
  float sinTheta2 = 1.0 - cosTheta * cosTheta;
  float sigma = r * r + a * a * cosTheta * cosTheta;
  
  // Asosiy Schwarzschild tezlanishi
  vec3 accel = gravitationalAcceleration(pos, Rs);

  // Electrostatik repulsiya (Reissner-Nordström qismi)
  // Coulomb kuchi nurlarga (Q^2 / r^3) shaklida qarama-qarshi kuch beradi
  if (abs(Q) > 0.001) {
    vec3 repulsion = pos * (Q * Q) / (r * r * r * r); // soddalashtirilgan repel
    accel += repulsion;
  }

  // Frame-dragging — spin ta'sirida fazovaqt "tortiladi"
  if (abs(a) > 0.001) {
    // φ yo'nalishda qo'shimcha tezlanish disk aylanishi yo'nalishida (y o'qi atrofida)
    vec3 frameDrag = vec3(-pos.z, 0.0, pos.x); 
    // Zaryad Q ham frame-dragging ga ta'sir qiladi
    float dragMag = a * (2.0 * M * r - Q * Q) / (sigma * r * r);
    accel += normalize(frameDrag) * dragMag * 0.1;
  }

  return accel;
}


// ═══════════════════════════════════════════════════════════════════════════════
// RAY MARCHING — asosiy simulyatsiya tsikli
// ═══════════════════════════════════════════════════════════════════════════════
//
// Formulalar #6-9:
//   #6 — Geodezik tenglamasi (nurning egri fazovaqtdagi harakati)
//   #7 — Christoffel simvollari (gravitationalAcceleration ichida)
//   #8 — Verlet integrallash
//   #9 — RK4 integrallash
//
// Har bir piksel uchun:
//   1. Kameradan nur yo'naltiriladi
//   2. Nur bosqichma-bosqich harakatlantiriladi
//   3. Har qadamda gravitatsion tezlanish hisoblanadi
//   4. Nurning yo'nalishi egriladi
//   5. Disk kesishishi, qora tuynukka tushish yoki qochish tekshiriladi
// ═══════════════════════════════════════════════════════════════════════════════

struct RayResult {
  vec3  color;             // Yakuniy rang (HDR)
  bool  hitDisk;           // Diskka tegdimi
  bool  captured;          // Qora tuynukka tushdimi
  float closestApproach;   // Eng yaqin kelish radiusi
};

RayResult marchRay(vec3 rayPos, vec3 rayDir) {
  RayResult result;
  result.color = vec3(0.0);
  result.hitDisk = false;
  result.captured = false;
  result.closestApproach = 1000.0;

  vec3 prevPos = rayPos;
  vec3 accumulatedDiskColor = vec3(0.0);
  float accumulatedDiskAlpha = 0.0;

  float Rs = u_Rs;
  float captureR = u_captureRadius;

  for (int i = 0; i < 500; i++) {
    if (i >= u_maxSteps) break;

    float r = length(rayPos);

    // Eng yaqin kelishni kuzatish (foton halqa uchun)
    result.closestApproach = min(result.closestApproach, r);

    // ── Adaptiv qadam kattaligi ──
    float stepSize;
    if (u_adaptiveStep > 0.5) {
      // Qora tuynukka yaqinda kichik qadam — aniqlik
      // Uzoqda katta qadam — tezlik
      stepSize = clamp(
        r * u_stepSizeFactor,
        u_minStepSize,
        u_maxStepSize
      );
    } else {
      stepSize = u_stepSize;
    }

    // ── Gravitatsion tezlanish ──
    vec3 accel;
    if (abs(u_spin) > 0.001 || abs(u_charge) > 0.001) {
      accel = kerrNewmanAcceleration(rayPos, Rs, u_spin, u_charge);
    } else {
      accel = gravitationalAcceleration(rayPos, Rs);
    }

    // ── Integrallash ──
    if (u_useRK4 > 0.5) {
      // ── Formula #9: RK4 ──
      vec3 k1v = accel * stepSize;
      vec3 k1x = rayDir * stepSize;

      vec3 midPos1 = rayPos + k1x * 0.5;
      vec3 midDir1 = rayDir + k1v * 0.5;
      vec3 a2 = (abs(u_spin) > 0.001 || abs(u_charge) > 0.001)
        ? kerrNewmanAcceleration(midPos1, Rs, u_spin, u_charge)
        : gravitationalAcceleration(midPos1, Rs);
      vec3 k2v = a2 * stepSize;
      vec3 k2x = midDir1 * stepSize;

      vec3 midPos2 = rayPos + k2x * 0.5;
      vec3 midDir2 = rayDir + k2v * 0.5;
      vec3 a3 = (abs(u_spin) > 0.001 || abs(u_charge) > 0.001)
        ? kerrNewmanAcceleration(midPos2, Rs, u_spin, u_charge)
        : gravitationalAcceleration(midPos2, Rs);
      vec3 k3v = a3 * stepSize;
      vec3 k3x = midDir2 * stepSize;

      vec3 endPos = rayPos + k3x;
      vec3 endDir = rayDir + k3v;
      vec3 a4 = (abs(u_spin) > 0.001 || abs(u_charge) > 0.001)
        ? kerrNewmanAcceleration(endPos, Rs, u_spin, u_charge)
        : gravitationalAcceleration(endPos, Rs);
      vec3 k4v = a4 * stepSize;
      vec3 k4x = endDir * stepSize;

      prevPos = rayPos;
      rayDir += (k1v + 2.0 * k2v + 2.0 * k3v + k4v) / 6.0;
      rayPos += (k1x + 2.0 * k2x + 2.0 * k3x + k4x) / 6.0;
    } else {
      // ── Formula #8: Verlet ──
      prevPos = rayPos;
      rayDir += accel * stepSize;
      rayPos += rayDir * stepSize;
    }

    rayDir = normalize(rayDir);
    float newR = length(rayPos);

    // ── Qora tuynukka tushdi ──
    // INTERSTELLAR FIX: aniqroq shadow chegara
    if (newR < captureR + u_rOuterHorizon) {
      result.captured = true;
      result.color = vec3(0.0);
      break;
    }

    // ── Accretion disk kesishishi ──
    // y=0 tekisligini kesib o'tganini tekshirish
    if (prevPos.y * rayPos.y < 0.0) {
      // Kesishish nuqtasini interpolatsiya
      float t = prevPos.y / (prevPos.y - rayPos.y);
      vec3 hitPoint = mix(prevPos, rayPos, t);
      float hitR = length(hitPoint.xz);

      if (hitR >= u_diskInnerRadius && hitR <= u_diskOuterRadius) {
        // Disk rangi
        vec4 diskCol = computeDiskColor(hitR, hitPoint);

        // Doppler effekt
        diskCol = applyDoppler(diskCol, hitPoint, hitR);

        // Alpha blending — bir necha marta diskni ko'rish mumkin
        // (gravitatsion lensing tufayli)
        accumulatedDiskColor += diskCol.rgb * (1.0 - accumulatedDiskAlpha);
        accumulatedDiskAlpha += diskCol.a * (1.0 - accumulatedDiskAlpha);
        accumulatedDiskAlpha = min(accumulatedDiskAlpha, 1.0);

        result.hitDisk = true;
      }
    }

    // ── Qochdi — yulduz foni ──
    if (newR > u_escapeRadius) {
      // ── Formula #35: Cubemap lookup ──
      vec3 starColor = textureCube(u_starfieldCube, rayDir).rgb;

      // Foton halqa porlashi
      float ringGlow = photonRingGlow(result.closestApproach, u_rPhotonSphere);
      vec3 ringColor = vec3(1.0, 0.85, 0.6) * ringGlow;

      // Foton sfera yaqinida kuchayish
      float approachRatio = u_rPhotonSphere / max(result.closestApproach, u_rPhotonSphere * 0.5);
      float mag = 1.0 + pow(approachRatio, 8.0) * 3.0;

      vec3 bgColor = starColor * mag + ringColor;

      // Disk bilan birlashtirish
      result.color = accumulatedDiskColor + bgColor * (1.0 - accumulatedDiskAlpha);
      break;
    }
  }

  // Agar loop tugadi, lekin hali bitmaganligi —
  // nurni qochgan deb hisoblaymiz
  if (!result.captured && result.color == vec3(0.0)) {
    vec3 starColor = textureCube(u_starfieldCube, rayDir).rgb;
    float ringGlow = photonRingGlow(result.closestApproach, u_rPhotonSphere);
    vec3 ringColor = vec3(1.0, 0.85, 0.6) * ringGlow;
    result.color = accumulatedDiskColor + (starColor + ringColor) * (1.0 - accumulatedDiskAlpha);
  }

  return result;
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN — har bir piksel shu yerdan boshlanadi
// ═══════════════════════════════════════════════════════════════════════════════

void main() {
  // ── Formula #34: Ray generation ──
  // Piksel koordinatalarini NDC ga aylantirish
  vec2 ndc = (vUv - 0.5) * 2.0;
  ndc.x *= u_aspectRatio;

  // Nur yo'nalishi
  vec3 rayDir = normalize(
    u_cameraRight * ndc.x +
    u_cameraUp    * ndc.y +
    u_cameraDir   * u_focalLength
  );

  vec3 rayPos = u_cameraPos;

  // ── Ray marching ──
  RayResult result = marchRay(rayPos, rayDir);

  vec3 color = result.color;

  // ── Post-processing pipeline ──

  // 1. Ekspozitsiya
  color *= 1.0;

  // 2. ACES Tone Mapping (Formula #26)
  color = acesToneMap(color);

  // 3. Gamma korreksiya (Formula #37)
  color = gammaCorrect(color);

  // 4. Vignette
  color *= vignette(vUv);

  // 5. Film grain (Formula #29)
  float grain = filmGrain(vUv, u_time);
  float lum = calcLuminance(color);
  // Qorong'i joylarda ko'proq, yorqinda kam
  float grainResponse = mix(1.0, 0.3, smoothstep(0.0, 0.5, lum));
  color += grain * grainResponse;

  // 6. Yakuniy clamp
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
