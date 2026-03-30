/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Accretion Disk Shader
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Accretion disk fizikasi va vizualizatsiyasi.
 * Qora tuynuk atrofida spiralda aylanayotgan qizib ketgan gaz va plazma diski.
 *
 * Bu faylni o'zgartirish orqali halqa rangini, tuzilmasini,
 * yorqinligini va shaklini to'g'ridan-to'g'ri boshqarish mumkin.
 *
 * Bog'liqlik: noise.glsl (fbm3D funksiyasi kerak)
 *
 * Formulalar:
 *   #17 — r_ISCO = 6GM/c²              Disk ichki radiusi
 *   #18 — v_orb = √(M/r)·(1-Rs/r)⁻¹/² Kepler orbital tezligi
 *   #19 — T(r) = T_max·(r/r_ISCO)^(-3/4)·[1-√(r_ISCO/r)]^(1/4)
 *   #20 — B(ν,T) → blackbody rang approksimatsiyasi
 *   #21 — I(r) = I₀·(r_ISCO/r)³·[1-√(r_ISCO/r)]
 * ═══════════════════════════════════════════════════════════════════════════════
 */


// ─────────────────────────────────────────────────────────────────────────────
// I. TEMPERATURA PROFILI
// ─────────────────────────────────────────────────────────────────────────────
// ── Formula #19: Shakura-Sunyaev (1973) ──
// T(r) = T_max · (r / r_ISCO)^(-3/4) · [1 - √(r_ISCO / r)]^(1/4)

float diskTemperature(float r, float rISCO) {
  if (r <= rISCO) return 0.0;
  float ratio = rISCO / r;
  return pow(ratio, 0.75) * pow(max(1.0 - sqrt(ratio), 0.0), 0.25);
}


// ─────────────────────────────────────────────────────────────────────────────
// II. YORQINLIK PROFILI
// ─────────────────────────────────────────────────────────────────────────────
// ── Formula #21 ──
// I(r) = I₀ · (r_ISCO / r)³ · [1 - √(r_ISCO / r)]

float diskLuminosity(float r, float rISCO) {
  if (r <= rISCO) return 0.0;
  float ratio = rISCO / r;
  return ratio * ratio * ratio * max(1.0 - sqrt(ratio), 0.0);
}


// ─────────────────────────────────────────────────────────────────────────────
// III. ORBITAL TEZLIK
// ─────────────────────────────────────────────────────────────────────────────
// ── Formula #18: Kepler orbital tezligi (Schwarzschild) ──
// v_orb = √(M/r) · (1 - Rs/r)^(-1/2)

float diskOrbitalVelocity(float r, float Rs) {
  if (r <= Rs) return 0.999;
  return min(1.0 / sqrt(r) / sqrt(1.0 - Rs / r), 0.999);
}


// ─────────────────────────────────────────────────────────────────────────────
// IV. QORA TANALI NURLANISH → RANG
// ─────────────────────────────────────────────────────────────────────────────
// ── Formula #20: Planck approksimatsiyasi — INTERSTELLAR palitrasi ──

vec3 blackbodyColor(float t) {
  if (t < 0.3) {
    float s = t / 0.3;
    return vec3(0.6 + s * 0.3, 0.3 + s * 0.3, 0.05 + s * 0.15); // bronza
  }
  if (t < 0.6) {
    float s = (t - 0.3) / 0.3;
    return vec3(0.9 + s * 0.1, 0.6 + s * 0.3, 0.2 + s * 0.5);   // oltin → oq
  }
  float s = (t - 0.6) / 0.4;
  return vec3(1.0, 0.9 + s * 0.09, 0.7 + s * 0.28);              // issiq oq
}


// ─────────────────────────────────────────────────────────────────────────────
// V. DISK NOISE — spiral tuzilma
// ─────────────────────────────────────────────────────────────────────────────
// Procedural noise orqali gazning turbulent tuzilmasini yaratish

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


// ─────────────────────────────────────────────────────────────────────────────
// VI. YAKUNIY DISK RANGI — hamma narsani birlashtirish
// ─────────────────────────────────────────────────────────────────────────────

vec4 computeDiskColor(float hitR, vec3 hitPoint) {
  float outerR = u_diskOuterRadius * 2.5;
  float temp = diskTemperature(hitR, u_diskInnerRadius);
  float lum  = diskLuminosity(hitR, u_diskInnerRadius);

  // Rang — dirty warm palitra
  float angle = atan(hitPoint.z, hitPoint.x);
  vec3 innerColor = vec3(1.0, 0.88, 0.6);
  vec3 midColor   = vec3(0.9, 0.55, 0.15);
  vec3 outerColor = vec3(0.35, 0.15, 0.04);

  float t = clamp((hitR - u_diskInnerRadius) / (outerR - u_diskInnerRadius), 0.0, 1.0);
  vec3 baseColor = mix(innerColor, mix(midColor, outerColor, t), t);

  float dirt = fbm3D(vec3(hitR * 1.5, angle * 0.5, 0.0), max(u_noiseOctaves - 2, 2), u_noiseLacunarity, u_noisePersistence) * 0.25;
  baseColor *= (0.85 + dirt);

  vec3 color = vec3(1.0);

  // Aylanish
  vec2 dp = hitPoint.xz;
  float rotAngle = u_time * u_diskRotSpeed * (2.0 / (hitR + 1.0));
  float ca = cos(rotAngle), sa = sin(rotAngle);
  vec2 rp = vec2(dp.x * ca - dp.y * sa, dp.x * sa + dp.y * ca);

  // Noise
  float n = diskNoise(rp, u_time);
  float nFactor = 0.6 + n * 0.4;

  // Edge fade — soft outer falloff + flared vertical density
  float radPos = (hitR - u_diskInnerRadius) / (outerR - u_diskInnerRadius);
  float innerFade = smoothstep(0.0, 0.05, radPos);
  float edgeFade = 1.0 - smoothstep(outerR * 0.7, outerR, hitR);

  // Vertical density — flared scale height (thin at center, puffy at edges)
  float scaleHeight = u_diskThickness * 2.0;
  scaleHeight *= (1.0 + hitR * 0.3);
  float verticalDensity = exp(-hitPoint.y * hitPoint.y / (scaleHeight * scaleHeight));

  float fade = innerFade * edgeFade * verticalDensity;

  float finalLum = lum * max(nFactor, 0.1) * fade;
  // diskLuminosity max ~0.056, shuning uchun hdr kuchli bo'lishi shart
  float hdr = 50.0 + temp * 80.0;
  color *= finalLum * hdr;

  // Turbulence + dark gaps
  float turbulence = fbm3D(vec3(angle * 8.0, hitR * 5.0, u_time * 0.1), max(u_noiseOctaves - 2, 2), u_noiseLacunarity, u_noisePersistence);
  turbulence = 0.4 + 0.6 * turbulence;

  float gaps = smoothstep(0.3, 0.5, sin(angle * 14.0 + fbm3D(vec3(hitR, angle, 0.0), max(u_noiseOctaves - 2, 2), u_noiseLacunarity, u_noisePersistence) * 4.0));

  color *= turbulence * mix(0.3, 1.0, gaps);

  // Warm color tint — applied last to survive HDR/tonemapping
  color *= baseColor;

  return vec4(color, finalLum * fade);
}
