/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Gravitational Acceleration (Qora Tuynuk Fizikasi)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Qora tuynukning gravitatsion ta'siri — nurlarni egish uchun.
 *
 * Bu faylni o'zgartirish orqali qora tuynukning o'zini
 * (sharni, gorizontni, spin effektini) boshqarish mumkin.
 *
 * Formulalar:
 *   #1 — Schwarzschild: a = -1.5·Rs·|h|²/r⁵ · pos
 *   #2-5 — Kerr-Newman: spin + zaryad korreksiyalari
 *         Σ = r² + a²cos²θ
 *         Δ = r² - Rs·r + a² + Q²
 * ═══════════════════════════════════════════════════════════════════════════════
 */


// ─────────────────────────────────────────────────────────────────────────────
// I. SCHWARZSCHILD GRAVITATSION TEZLANISH
// ─────────────────────────────────────────────────────────────────────────────
// ── Formula #1 ──
// Fotonlar uchun null geodezik: a = -1.5·Rs·|pos × vel|²/r⁵ · pos

vec3 gravitationalAcceleration(vec3 pos, vec3 vel, float Rs) {
  float r = length(pos);
  if (r < 0.001) return vec3(0.0);

  vec3 h = cross(pos, vel);
  float h2 = dot(h, h);

  float r2 = r * r;
  float r4 = r2 * r2;

  float accelMag = -1.5 * Rs * h2 / (r4 * r);

  return pos * accelMag;
}


// ─────────────────────────────────────────────────────────────────────────────
// II. KERR-NEWMAN GRAVITATSION TEZLANISH
// ─────────────────────────────────────────────────────────────────────────────
// ── Formulalar #2, #3, #4, #5 ──
// Spin + Zaryad ta'sirini hisobga oluvchi korreksiya

vec3 kerrNewmanAcceleration(vec3 pos, vec3 vel, float Rs, float spin, float charge) {
  if (abs(spin) < 0.001 && abs(charge) < 0.001) {
    return gravitationalAcceleration(pos, vel, Rs);
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
  vec3 accel = gravitationalAcceleration(pos, vel, Rs);

  // Electrostatik repulsiya (Reissner-Nordström qismi)
  if (abs(Q) > 0.001) {
    vec3 repulsion = pos * (Q * Q) / (r * r * r * r);
    accel += repulsion;
  }

  // Frame-dragging — spin ta'sirida fazovaqt "tortiladi"
  if (abs(a) > 0.001) {
    vec3 frameDrag = vec3(-pos.z, 0.0, pos.x);
    float dragMag = a * (2.0 * M * r - Q * Q) / (sigma * r * r);
    accel += normalize(frameDrag) * dragMag * 0.1;
  }

  return accel;
}
