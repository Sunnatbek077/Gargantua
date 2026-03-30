/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Doppler Effect Shader
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Relativistik Doppler effekt va gravitatsion qizil siljish.
 *
 * Diskning sizga qarab harakatlangan tomoni YORQINROQ va KO'KROQ,
 * sizdan uzoqlashayotgan tomoni XIRAROQ va QIZILROQ.
 *
 * Bog'liqlik: accretion.glsl (diskOrbitalVelocity funksiyasi kerak)
 *
 * Formulalar:
 *   #22 — g = 1 / (γ(1 + β·cosα))    Doppler omili
 *   #23 — I_obs = g^n · I_emit        Doppler beaming
 *   #24 — √(1 - Rs/r)                 Gravitatsion redshift factor
 * ═══════════════════════════════════════════════════════════════════════════════
 */


// ─────────────────────────────────────────────────────────────────────────────
// I. DOPPLER OMILI
// ─────────────────────────────────────────────────────────────────────────────
// ── Formula #22 ──
// g = 1 / (γ · (1 + β · cos(α)))

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


// ─────────────────────────────────────────────────────────────────────────────
// II. DOPPLER BEAMING — yorqinlik o'zgarishi
// ─────────────────────────────────────────────────────────────────────────────
// ── Formula #23 ──
// I_obs = g^n · I_emit

float dopplerBeaming(float g, float exp_val) {
  return pow(clamp(g, 0.1, 5.0), exp_val);
}


// ─────────────────────────────────────────────────────────────────────────────
// III. GRAVITATSION REDSHIFT FACTOR
// ─────────────────────────────────────────────────────────────────────────────
// ── Formula #24 ──
// factor = √(1 - Rs/r)

float gravRedshiftFactor(float r, float Rs) {
  if (r <= Rs) return 0.0;
  return sqrt(max(1.0 - Rs / r, 0.0));
}


// ─────────────────────────────────────────────────────────────────────────────
// IV. RANG SILJISHI
// ─────────────────────────────────────────────────────────────────────────────

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


// ─────────────────────────────────────────────────────────────────────────────
// V. TO'LIQ DOPPLER QO'LLASH
// ─────────────────────────────────────────────────────────────────────────────

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
