/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Noise Functions
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Procedural noise funksiyalari — accretion disk tuzilmasi uchun.
 *
 * Tarkibi:
 *   - Hash funksiyalari (pseudo-random)
 *   - 3D gradient noise
 *   - FBM (Fractal Brownian Motion)
 *
 * Formulalar:
 *   #31 — noise(p) = Σ(amplitude_i · gradient(frequency_i · p))
 *   #32 — fbm(p) = Σᵢ 0.5ⁱ · noise(2ⁱ · p)
 * ═══════════════════════════════════════════════════════════════════════════════
 */


// ─────────────────────────────────────────────────────────────────────────────
// I. HASH FUNKSIYALARI
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


// ─────────────────────────────────────────────────────────────────────────────
// II. GRADIENT NOISE — 3D
// ─────────────────────────────────────────────────────────────────────────────

// Silliq interpolatsiya — quintic Hermite
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


// ─────────────────────────────────────────────────────────────────────────────
// III. FBM — Fractal Brownian Motion
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Formula #32 ──
// fbm(p) = Σᵢ persistenceⁱ · noise(lacunarityⁱ · p)

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
