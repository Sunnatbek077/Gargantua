/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Gravitational Lensing & Event Horizon Effects
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Foton halqa porlashi va qora tuynuk siluetining 3D chuqurligi.
 *
 * Foton sfera (r = 1.5 Rs) yaqinida nurlar qora tuynuk atrofida
 * aylanib o'tadi — bu "foton halqasi" Interstellar'dagi eng yorqin chiziq.
 *
 * Event horizon depth effektlari:
 *   - Fresnel-like edge brightening (siluet chegarasi)
 *   - Gravitational glow (fazovaqt egriligi)
 *   - Spherical depth cue (3D sferik ko'rinish)
 *
 * Formulalar:
 *   #13 — δ = 4GM/(bc²)           Burilish burchagi
 *   #16 — μ = θ/β · dθ/dβ         Kuchayish
 * ═══════════════════════════════════════════════════════════════════════════════
 */


// ─────────────────────────────────────────────────────────────────────────────
// I. FOTON HALQA PORLASHI
// ─────────────────────────────────────────────────────────────────────────────
// Asymmetric multi-ring structure with depth-aware falloff

float photonRingGlow(float closest, float rPh) {
  float relDist = abs(closest - rPh) / rPh;

  // Asymmetric falloff: gentler outside, sharper at shadow edge
  float asymFactor = mix(1.3, 0.7, smoothstep(rPh * 0.98, rPh * 1.05, closest));

  // Wide halo
  float glow = exp(-relDist * relDist * 55.0 * asymFactor) * u_photonRingIntensity;

  // Primary ring (n=1 orbit)
  float ring1 = exp(-relDist * relDist * 400.0) * u_photonRingIntensity * 2.0;

  // Secondary sub-ring (n=2 orbit)
  float relDist2 = abs(closest - rPh * 1.01) / rPh;
  float ring2 = exp(-relDist2 * relDist2 * 1500.0) * u_photonRingIntensity * 0.8;

  // Tertiary sub-ring (n=3 orbit)
  float relDist3 = abs(closest - rPh * 1.003) / rPh;
  float ring3 = exp(-relDist3 * relDist3 * 3500.0) * u_photonRingIntensity * 0.3;

  // Inner caustic — shadow boundary
  float shadowEdgeDist = abs(closest - rPh * 0.997) / rPh;
  float caustic = exp(-shadowEdgeDist * shadowEdgeDist * 1800.0) * u_photonRingIntensity * 0.2;

  return glow + ring1 + ring2 + ring3 + caustic;
}


// ─────────────────────────────────────────────────────────────────────────────
// II. FRESNEL-LIKE EDGE BRIGHTENING
// ─────────────────────────────────────────────────────────────────────────────
// Siluet chegarasida nurlarning konvergensiyasi

float edgeFresnelFactor(float closestApproach, float rPhoton, float rHorizon) {
  float approachRatio = closestApproach / rPhoton;
  float edgeProximity = max(approachRatio - 1.0, 0.0);

  float fresnel = exp(-edgeProximity * edgeProximity * 25.0);
  float depthGradient = smoothstep(rHorizon, rPhoton * 1.5, closestApproach);

  return fresnel * depthGradient;
}


// ─────────────────────────────────────────────────────────────────────────────
// III. GRAVITATIONAL GLOW
// ─────────────────────────────────────────────────────────────────────────────
// Fazovaqt egriligi sababli juda xira energiya buzilishi

vec3 gravitationalGlow(float closestApproach, float rPhoton, float rHorizon, float time) {
  float photonDist = abs(closestApproach - rPhoton) / rPhoton;

  float thermalIntensity = exp(-photonDist * photonDist * 60.0) * 0.012;
  float haloIntensity = exp(-photonDist * photonDist * 12.0) * 0.004;

  float innerFactor = smoothstep(rPhoton * 1.3, rPhoton * 0.95, closestApproach);

  vec3 glowColor = mix(
    vec3(0.7, 0.5, 0.2),
    vec3(0.6, 0.65, 0.9),
    innerFactor
  ) * thermalIntensity;

  glowColor += vec3(0.5, 0.4, 0.2) * haloIntensity;

  return glowColor;
}


// ─────────────────────────────────────────────────────────────────────────────
// IV. SPHERICAL DEPTH CUE
// ─────────────────────────────────────────────────────────────────────────────
// 3D sferik ko'rinish uchun yorqinlik gradienti

float sphericalDepthCue(float closestApproach, float rPhoton) {
  float normalizedDist = max((closestApproach - rPhoton) / rPhoton, 0.0);

  float edgeBright = exp(-normalizedDist * 8.0) * 0.1;
  float depthGrad = exp(-normalizedDist * normalizedDist * 3.0) * 0.08;

  return edgeBright + depthGrad;
}
