/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Accretion Disk Shader
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Accretion disk fizikasi va vizualizatsiyasi.
 * Qora tuynuk atrofida spiralda aylanayotgan qizib ketgan gaz va plazma diski.
 *
 * Vizual maqsad: Interstellar filmi referans tasviri —
 *   - Nozik filamentli tolalar orbital yo'nalish bo'ylab cho'zilgan
 *   - Ichki: yorqin oq-oltin, o'rta: oltin-amber, tashqi: qora-qizil
 *   - Yuqori kontrast: yorqin tolalar va qorong'i bo'shliqlar
 *   - Konsentrik halqa tuzilmalari
 *
 * Bog'liqlik: noise.glsl (fbm3D funksiyasi kerak)
 *
 * Formulalar:
 *   #17 — r_ISCO = 6GM/c²              Disk ichki radiusi
 *   #18 — v_orb = √(M/r)·(1-Rs/r)⁻¹/² Kepler orbital tezligi
 *   #19 — T(r) = T_max·(r/r_ISCO)^(-3/4)·[1-√(r_ISCO/r)]^(1/4)
 *   #20 — B(ν,T) → blackbody rang approksimatsiyasi
 *   #21 — I(r) = I₀·(r/r_ISCO)³·[1-√(r_ISCO/r)]
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
  if (t < 0.2) {
    float s = t / 0.2;
    return mix(vec3(0.12, 0.03, 0.005), vec3(0.55, 0.18, 0.03), s);
  }
  if (t < 0.5) {
    float s = (t - 0.2) / 0.3;
    return mix(vec3(0.55, 0.18, 0.03), vec3(1.0, 0.6, 0.12), s);
  }
  if (t < 0.8) {
    float s = (t - 0.5) / 0.3;
    return mix(vec3(1.0, 0.6, 0.12), vec3(1.0, 0.9, 0.55), s);
  }
  float s = (t - 0.8) / 0.2;
  return mix(vec3(1.0, 0.9, 0.55), vec3(1.0, 0.97, 0.9), s);
}


// ─────────────────────────────────────────────────────────────────────────────
// V. DISK NOISE — anizotropik filament tuzilma
// ─────────────────────────────────────────────────────────────────────────────
// Orbital yo'nalishda cho'zilgan nozik tolalar + radial halqa variatsiyalari.
// Anizotropik: theta bo'ylab past chastota (uzun yoylar),
//              radial bo'ylab yuqori chastota (nozik chiziqlar).

float diskNoise(vec2 diskPos, float time) {
  float r = length(diskPos);
  float theta = atan(diskPos.y, diskPos.x);

  // Orbital aylanish (ichki tezroq)
  float rotRate = u_diskRotSpeed * (2.0 / (r + 1.0));
  theta += time * rotRate;

  // ── Nozik filamentlar — radial bo'ylab yuqori chastota ──
  // Azimuthal stretch: theta * 0.12 (juda cho'zilgan tolalar hosil qiladi)
  vec3 pFine = vec3(
    r * u_noiseScale * 4.0,
    theta * u_noiseScale * 0.12,
    time * u_noiseTimeScale * 0.15
  );
  float filaments = fbm3D(pFine, u_noiseOctaves, u_noiseLacunarity, u_noisePersistence);
  filaments = filaments * 0.5 + 0.5;

  // ── O'rta masshtabli turbulensiya ──
  vec3 pMid = vec3(
    r * u_noiseScale * 2.0,
    theta * u_noiseScale * 0.3,
    time * u_noiseTimeScale * 0.12
  );
  float midTurb = fbm3D(pMid, max(u_noiseOctaves - 1, 2), u_noiseLacunarity, u_noisePersistence);
  midTurb = midTurb * 0.5 + 0.5;

  // ── Spiral qo'llar — katta masshtabli tuzilma ──
  float spiralPhase = theta * 2.0 + 5.0 / (r + 0.4) + time * u_noiseTimeScale * 0.4;
  float spiral = sin(spiralPhase) * 0.5 + 0.5;
  spiral = pow(spiral, 0.7);

  // ── Konsentrik halqa variatsiyalari ──
  float ringMod = fbm3D(vec3(theta * 0.3, r * 1.5, 0.0), 2, 2.0, 0.5);
  float rings = sin(r * 10.0 + ringMod * 3.5) * 0.5 + 0.5;
  rings = smoothstep(0.15, 0.85, rings);

  // Birlashtirish: filamentlar dominant
  float n = filaments * 0.40 + midTurb * 0.25 + spiral * 0.15 + rings * 0.20;

  // Kontrastni oshirish — yorqin tolalar va qorong'i bo'shliqlar
  n = smoothstep(0.2, 0.8, n);

  return n;
}


// ─────────────────────────────────────────────────────────────────────────────
// VI. YAKUNIY DISK RANGI — hamma narsani birlashtirish
// ─────────────────────────────────────────────────────────────────────────────

vec4 computeDiskColor(float hitR, vec3 hitPoint) {
  float outerR = u_diskOuterRadius * 2.5;
  float temp = diskTemperature(hitR, u_diskInnerRadius);
  float lum  = diskLuminosity(hitR, u_diskInnerRadius);

  // ── Radial pozitsiya (0=ichki, 1=tashqi) ──
  float t = clamp((hitR - u_diskInnerRadius) / (outerR - u_diskInnerRadius), 0.0, 1.0);

  // ── Rang palitrasi: Interstellar ──
  // Ichki: yorqin oq-oltin, O'rta: to'yingan oltin, Tashqi: chuqur qora-qizil
  vec3 innerColor = vec3(1.0, 0.95, 0.82);
  vec3 midColor1  = vec3(1.0, 0.72, 0.28);
  vec3 midColor2  = vec3(0.82, 0.40, 0.08);
  vec3 outerColor = vec3(0.18, 0.06, 0.015);

  vec3 baseColor;
  if (t < 0.12) {
    baseColor = mix(innerColor, midColor1, t / 0.12);
  } else if (t < 0.35) {
    baseColor = mix(midColor1, midColor2, (t - 0.12) / 0.23);
  } else {
    baseColor = mix(midColor2, outerColor, smoothstep(0.35, 1.0, t));
  }

  // ── Noise / filament tuzilmasi ──
  vec2 dp = hitPoint.xz;
  float n = diskNoise(dp, u_time);

  // Yuqori kontrast: qorong'i bo'shliqlar juda qorong'i
  float nFactor = 0.08 + n * 0.92;

  // ── Yorqin tolalar uchun qo'shimcha oq rang (hot streaks) ──
  float hotStreak = smoothstep(0.75, 1.0, n) * smoothstep(0.35, 0.0, t);
  vec3 streakHighlight = vec3(1.0, 0.96, 0.88) * hotStreak * 0.6;

  // ── Edge fading ──
  float radPos = (hitR - u_diskInnerRadius) / (outerR - u_diskInnerRadius);
  float innerFade = smoothstep(0.0, 0.03, radPos);

  // Tashqi qirra — asosiy disk yumshoq, tolalar esa uzoqroqqa cho'ziladi
  float mainFade = 1.0 - smoothstep(outerR * 0.5, outerR * 0.85, hitR);
  float wispFade = 1.0 - smoothstep(outerR * 0.85, outerR, hitR);
  float outerFade = mainFade + wispFade * n * 0.4;

  // Vertical density — flared scale height
  float scaleHeight = u_diskThickness * 2.0 * (1.0 + hitR * 0.3);
  float verticalDensity = exp(-hitPoint.y * hitPoint.y / (scaleHeight * scaleHeight));

  float fade = innerFade * outerFade * verticalDensity;

  // ── HDR yorqinlik ──
  float finalLum = lum * nFactor * fade;

  // Kuchli HDR diapazoni — ichki disk juda yorqin
  float hdr = 90.0 + temp * 160.0;

  // Ichki disk qo'shimcha porlash
  float innerBoost = 1.0 + smoothstep(0.12, 0.0, t) * 3.5;

  vec3 color = baseColor * finalLum * hdr * innerBoost;
  color += streakHighlight * finalLum * hdr;

  return vec4(color, finalLum * fade);
}


// ─────────────────────────────────────────────────────────────────────────────
// VII. VOLUMETRIK DENSITY — 3D fazoviy zichlik
// ─────────────────────────────────────────────────────────────────────────────

float diskDensity(vec3 pos) {
  float r = length(pos.xz);
  float outerR = u_diskOuterRadius * 2.5;
  if (r < u_diskInnerRadius || r > outerR) return 0.0;

  // Vertical Gaussian — flared (inner thin, outer puffy)
  float scaleHeight = 0.08 * r;
  float vertical = exp(-pos.y * pos.y / (2.0 * scaleHeight * scaleHeight));

  // Radial falloff
  float radial = smoothstep(u_diskInnerRadius, u_diskInnerRadius * 1.3, r)
               * (1.0 - smoothstep(outerR * 0.7, outerR, r));

  // Anizotropik turbulensiya — orbital yo'nalishda cho'zilgan
  float angle = atan(pos.z, pos.x);
  float rotAngle = u_time * u_diskRotSpeed * (2.0 / (r + 1.0));
  angle += rotAngle;

  vec3 p = vec3(r * 3.5, angle * 0.15, u_time * 0.1);
  float turb = fbm3D(p, max(u_noiseOctaves - 1, 2), u_noiseLacunarity, u_noisePersistence);
  turb = 0.25 + 0.75 * (turb * 0.5 + 0.5);

  return vertical * radial * turb;
}


// ─────────────────────────────────────────────────────────────────────────────
// VIII. VOLUMETRIK EMISSION — 3D fazoviy rang
// ─────────────────────────────────────────────────────────────────────────────

vec3 diskEmission(vec3 pos, float density) {
  float r = length(pos.xz);
  float outerR = u_diskOuterRadius * 2.5;
  float temp = diskTemperature(r, u_diskInnerRadius);
  float lum = diskLuminosity(r, u_diskInnerRadius);

  float t = clamp((r - u_diskInnerRadius) / (outerR - u_diskInnerRadius), 0.0, 1.0);

  vec3 innerColor = vec3(1.0, 0.95, 0.82);
  vec3 midColor   = vec3(0.9, 0.55, 0.12);
  vec3 outerColor = vec3(0.2, 0.07, 0.015);
  vec3 col = mix(innerColor, mix(midColor, outerColor, t), t);

  // Anizotropik filament tuzilma
  float angle = atan(pos.z, pos.x);
  float rotAngle = u_time * u_diskRotSpeed * (2.0 / (r + 1.0));
  vec3 p = vec3(r * 3.5, (angle + rotAngle) * 0.15, u_time * 0.1);
  float streaks = fbm3D(p, max(u_noiseOctaves - 1, 2), u_noiseLacunarity, u_noisePersistence);
  streaks = streaks * 0.5 + 0.5;
  streaks = smoothstep(0.2, 0.8, streaks);
  col *= (0.15 + 0.85 * streaks);

  float hdr = 90.0 + temp * 160.0;
  return col * lum * hdr * density;
}
