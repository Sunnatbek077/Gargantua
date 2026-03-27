/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Gravitational Lensing Shader
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Gravitatsion linzalash — qora tuynuk orqasidagi yulduzlar
 * egrilgan nurlar orqali ko'rinadi. Bu Interstellar filmidagi
 * eng esda qolarli vizual effekt.
 *
 * Fizik mohiyat:
 *   Massiv obyekt (qora tuynuk) fazovaqtni egadi.
 *   Yorug'lik "to'g'ri chiziqda" harakatlanadi — lekin
 *   egri fazovaqtda "to'g'ri chiziq" bizga "egri" ko'rinadi.
 *
 * Natija:
 *   - Orqa fondagi yulduzlar "egri" ko'rinadi
 *   - Eynshteyn halqasi — fon yulduzlarining aylana tasviri
 *   - Ikkilamchi tasvir — orqadagi yulduzlarning ikkinchi nusxasi
 *   - Foton halqasi — eng yorqin chiziq (r = 1.5 Rs)
 *
 * Formulalar:
 *   #13 — δ = 4GM/(bc²)                    Burilish burchagi
 *   #14 — θ_E = √(4GM·D_ls/(c²·D_l·D_s))  Eynshteyn halqasi
 *   #15 — β = θ - D_ls/D_s · δ(θ)          Linza tenglamasi
 *   #16 — μ = θ/β · dθ/dβ                  Kuchayish
 * ═══════════════════════════════════════════════════════════════════════════════
 */


// ─────────────────────────────────────────────────────────────────────────────
// I. BURILISH BURCHAGI
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Formula #13 ──
//
// δ = 4GM / (b · c²)
//
// Bu yerda:
//   b — impakt parametri (nur va qora tuynuk markazi orasidagi masofa)
//   G, M, c — fizik konstantalar
//
// Natural units'da (G=1, c=1, M=1):
//   δ = 4 / b
//
// MUHIM: Bu formula faqat KUCHSIZ maydon limiti uchun —
// ya'ni b >> Rs bo'lganda. Kuchli maydon (b ≈ Rs) uchun
// to'liq geodezik integrallash kerak (ray marching).
//
// Bu funksiya qo'shimcha diagnostika uchun — asosiy lensing
// ray marching orqali blackhole.frag'da hisoblanadi.
// ─────────────────────────────────────────────────────────────────────────────

float deflectionAngle(float impactParameter, float mass) {
  // b = 0 da singularity — himoya
  if (impactParameter < 0.01) return 3.14159;  // Maksimal burilish (π)

  // ── Kuchsiz maydon ──
  // δ = 4M / b
  float weakField = 4.0 * mass / impactParameter;

  // ── Kuchli maydon korreksiyasi ──
  // Yuqori tartibli qo'shimchalar (post-Newtonian)
  // δ ≈ 4M/b + 15π M²/(4b²) + ...
  float b2 = impactParameter * impactParameter;
  float strongCorrection = (15.0 * 3.14159 / 4.0) * mass * mass / b2;

  return weakField + strongCorrection;
}


// ─────────────────────────────────────────────────────────────────────────────
// II. EYNSHTEYN HALQASI
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Formula #14 ──
//
// θ_E = √(4GM · D_ls / (c² · D_l · D_s))
//
// Bu yerda:
//   D_l  — kuzatuvchidan linzagacha masofa
//   D_s  — kuzatuvchidan manbagacha masofa
//   D_ls — linzadan manbagacha masofa
//
// Eynshteyn halqasi — manba, linza va kuzatuvchi bir chiziqda
// bo'lganda hosil bo'ladigan mukammal aylana.
//
// Haqiqatda mukammal aylana kam uchraydi — lekin bizning
// simulyatsiyada yulduzli fon "cheksiz uzoqda" bo'lgani uchun
// Eynshteyn halqasi har doim ko'rinadi.
//
// Natural units'da va D_s >> D_l uchun:
//   θ_E ≈ √(4M / D_l)
// ─────────────────────────────────────────────────────────────────────────────

float einsteinRingRadius(float mass, float distToLens) {
  if (distToLens < 0.01) return 0.0;

  // Soddalashtirilgan: manba cheksiz uzoqda
  // θ_E ≈ √(4M / D_l)
  return sqrt(4.0 * mass / distToLens);
}


// ─────────────────────────────────────────────────────────────────────────────
// III. LINZA TENGLAMASI
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Formula #15 ──
//
// β = θ - D_ls/D_s · δ(θ)
//
// Bu yerda:
//   β — manbaning haqiqiy burchak pozitsiyasi
//   θ — manbaning ko'rinuvchi burchak pozitsiyasi
//   δ(θ) — burilish burchagi
//
// Linza tenglamasi ikki tasvir beradi:
//   - Birlamchi tasvir (primary): θ > θ_E
//   - Ikkilamchi tasvir (secondary): θ < θ_E (kichikroq va xiraroq)
//
// Gravitatsion linzalash DOIM ikkita tasvir beradi —
// bu Interstellar'da diskning ham yuqorida, ham pastda ko'rinishini
// tushuntiradi.
// ─────────────────────────────────────────────────────────────────────────────

// β → θ konversiyasi (haqiqiy → ko'rinuvchi)
// Approksimatsiya: point mass linza uchun analitik yechim
float lensEquation(float beta, float einsteinRadius) {
  float thetaE2 = einsteinRadius * einsteinRadius;

  // θ = (β ± √(β² + 4θ_E²)) / 2
  // '+' — birlamchi tasvir, '-' — ikkilamchi tasvir
  float discriminant = beta * beta + 4.0 * thetaE2;

  // Birlamchi tasvir (kattaroq, yorqinroq)
  float thetaPrimary = 0.5 * (beta + sqrt(discriminant));

  return thetaPrimary;
}

// Ikkilamchi tasvir
float lensEquationSecondary(float beta, float einsteinRadius) {
  float thetaE2 = einsteinRadius * einsteinRadius;
  float discriminant = beta * beta + 4.0 * thetaE2;

  // '-' belgisi — ikkilamchi tasvir (kichikroq, xiraroq)
  float thetaSecondary = 0.5 * (beta - sqrt(discriminant));

  return abs(thetaSecondary);  // Manfiy bo'lishi mumkin
}


// ─────────────────────────────────────────────────────────────────────────────
// IV. KUCHAYISH (MAGNIFICATION)
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Formula #16 ──
//
// μ = θ/β · dθ/dβ
//
// Point mass linza uchun:
// μ = u² + 2 / (u · √(u² + 4))
// bu yerda u = β / θ_E
//
// Fizik ma'no:
//   Linzalash tasvirni kattalashtirib ko'rsatadi.
//   β → 0 da (manbaning haqiqiy pozitsiyasi linza ortida):
//     μ → ∞ (cheksiz kuchayish — nazariy)
//   Amalda "cheksiz" bo'lmaydi — manba nuqta emas.
//
// Simulyatsiyada: foton halqasi yaqinida yorqinlik oshadi
// ─────────────────────────────────────────────────────────────────────────────

float lensMagnification(float beta, float einsteinRadius) {
  if (einsteinRadius < 0.001) return 1.0;

  float u = abs(beta) / einsteinRadius;

  // u = 0 da cheksiz kuchayish — cheklash kerak
  if (u < 0.001) u = 0.001;

  float u2 = u * u;

  // μ = (u² + 2) / (u · √(u² + 4))
  float magnification = (u2 + 2.0) / (u * sqrt(u2 + 4.0));

  return magnification;
}

// Kuchayishni vizualizatsiya uchun cheklash
float clampedMagnification(float beta, float einsteinRadius, float maxMagnification) {
  float mu = lensMagnification(beta, einsteinRadius);
  return min(mu, maxMagnification);
}


// ─────────────────────────────────────────────────────────────────────────────
// V. FOTON HALQA PORLASHI
// ─────────────────────────────────────────────────────────────────────────────
//
// Foton sfera (r = 1.5 Rs = 3M) yaqinida nurlar qora tuynuk
// atrofida bir yoki bir necha marta aylanib o'tadi.
//
// Bu "foton halqasi" — Interstellar'dagi eng yorqin chiziq.
// Aslida bir necha halqa: n=1 (bir aylanish), n=2 (ikki), ...
// Har keyingi halqa eksponensial ravishda xiraroq va ingichka.
//
// Hisoblash: nurning minimal yaqinlashuv radiusiga qarab
// foton halqa intensivligini baholash
// ─────────────────────────────────────────────────────────────────────────────

float photonRingGlow(
  float closestApproach,  // Nurning qora tuynukka eng yaqin kelgan nuqtasi
  float photonSphereR,    // Foton sfera radiusi (3M)
  float ringIntensity     // Umumiy yorqinlik kuchi
) {
  float delta = abs(closestApproach - photonSphereR);
  float relDelta = delta / max(photonSphereR, 0.001);

  // Keng yumshoq tashqi glow (halo)
  float glow  = exp(-relDelta * relDelta * 60.0)  * ringIntensity;

  // Birlamchi ingichka halqa — Interstellar'dagi porlab turuvchi chiziq
  float ring1 = exp(-relDelta * relDelta * 800.0) * ringIntensity * 5.0;

  // Ikkilamchi sub-ring (nurlar ikki marta aylanib o'tgan)
  float delta2 = abs(closestApproach - photonSphereR * 1.004);
  float rel2   = delta2 / max(photonSphereR, 0.001);
  float ring2  = exp(-rel2 * rel2 * 4000.0) * ringIntensity * 2.0;

  return glow + ring1 + ring2;
}


// ─────────────────────────────────────────────────────────────────────────────
// VI. YULDUZ FONI LENSING — ray marching natijasi
// ─────────────────────────────────────────────────────────────────────────────
//
// Bu funksiya ray marching natijasida "qochgan" nurning
// yakuniy yo'nalishiga cubemap lookup qo'llaydi.
//
// Nur egrilib ketgani uchun u boshqa yo'nalishga qaragan yulduzni
// ko'rsatadi — bu gravitatsion linzalash effekti.
//
// Foton halqa yaqinida kuchayish (magnification) qo'shiladi
// ─────────────────────────────────────────────────────────────────────────────

vec3 lensedStarfield(
  vec3 finalRayDir,       // Nurning yakuniy yo'nalishi (egrilgandan keyin)
  float closestApproach,  // Eng yaqin kelish radiusi
  float photonSphereR,    // Foton sfera radiusi
  float photonRingIntensity, // Foton halqa yorqinligi
  samplerCube starfieldCube  // Yulduzli osmon cubemap
) {
  // ── Formula #35: Cubemap lookup ──
  // Egrilgan nur'ning yakuniy yo'nalishi bo'yicha yulduz tanlash
  vec3 starColor = textureCube(starfieldCube, finalRayDir).rgb;

  // ── Foton halqa porlashi ──
  float ringGlow = photonRingGlow(closestApproach, photonSphereR, photonRingIntensity);

  // Foton halqasi oltin-oq rangda porlaydi
  vec3 ringColor = vec3(1.0, 0.85, 0.6) * ringGlow;

  // ── Kuchayish — foton sfera yaqinida yulduzlar yorqinroq ──
  float approachRatio = photonSphereR / max(closestApproach, photonSphereR * 0.5);
  float magnification = 1.0 + pow(approachRatio, 8.0) * 3.0;

  return starColor * magnification + ringColor;
}
