/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Schwarzschild Metric
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Schwarzschild metrikasi — aylanmaydigan, zaryadlanmagan qora tuynukning
 * fazovaqt geometriyasi. Karl Schwarzschild, 1916.
 *
 * ── Formula #1: Schwarzschild metrikasi ──
 * ds² = -(1 - Rs/r)c²dt² + (1 - Rs/r)⁻¹dr² + r²dΩ²
 *
 * Bu modul shader'ga parametrlarni tayyorlaydi va HUD uchun
 * fizik qiymatlarni hisoblaydi.
 *
 * Formulalar:
 *   #1  — ds² = -(1-Rs/r)c²dt² + ...    Metrika
 *   #3  — Rs = 2GM/c²                    Schwarzschild radiusi
 *   #10 — Veff(r) = -M/r + L²/2r² - ML²/r³  Effektiv potentsial
 *   #11 — b_c = 3√3·M                    Kritik impakt parametri
 *   #12 — r_ph = 3M = 1.5·Rs             Foton sfera radiusi
 *   #13 — δ = 4M/b                       Burilish burchagi
 *   #17 — r_ISCO = 6M = 3·Rs             ISCO radiusi
 *   #18 — v_orb = √(M/r)/(1-Rs/r)^½     Orbital tezlik
 *
 * Bog'liqliklar: MathUtils
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { clamp, PI, schwarzschildRadiusMeters, formatDistance }
  from '../utils/MathUtils.js';

export default class Schwarzschild {

  /**
   * @param {number} [mass=1.0] - Massa (natural units: G=c=1)
   * @param {number} [massSolar=100e6] - Quyosh massasida (HUD uchun)
   */
  constructor(mass = 1.0, massSolar = 100e6) {
    this._M = mass;
    this._massSolar = massSolar;
    this._recalculate();
  }

  /** @private — barcha hosila qiymatlarni qayta hisoblash */
  _recalculate() {
    const M = this._M;
    this._Rs = 2.0 * M;                             // #3
    this._rPhotonSphere = 3.0 * M;                   // #12
    this._rISCO = 6.0 * M;                           // #17
    this._bCritical = 3.0 * Math.sqrt(3.0) * M;     // #11
    this._rMarginally = 4.0 * M;
    this._RsMeters = schwarzschildRadiusMeters(this._massSolar);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // METRIKA KOMPONENTLARI (#1)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * g_tt = -(1 - Rs/r) — vaqt-vaqt komponenti
   * r → Rs da 0 ga yaqinlashadi (vaqt to'xtaydi)
   */
  g_tt(r) {
    if (r <= 0) return -Infinity;
    return -(1.0 - this._Rs / r);
  }

  /**
   * g_rr = 1/(1 - Rs/r) — radius-radius komponenti
   * r → Rs da cheksizga oshadi (makon cho'ziladi)
   */
  g_rr(r) {
    if (r <= this._Rs) return Infinity;
    return 1.0 / (1.0 - this._Rs / r);
  }

  /**
   * Vaqt kengayishi omili √(1 - Rs/r)
   * 0 = vaqt to'xtagan (gorizont), 1 = normal (cheksiz uzoqda)
   */
  timeDilationFactor(r) {
    if (r <= this._Rs) return 0;
    return Math.sqrt(1.0 - this._Rs / r);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ORBITAL MEXANIKA
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * ── Formula #10: Effektiv potentsial ──
   * Veff(r) = -M/r + L²/(2r²) - ML²/r³
   *
   * Uchinchi qo'shimcha (-ML²/r³) — faqat GR'da mavjud.
   * Newtonian fizikada bu yo'q, shuning uchun:
   *   - Newton: barcha orbit barqaror
   *   - GR: ISCO dan ichkarida barqaror orbit YO'Q
   *
   * @param {number} r - Radius
   * @param {number} L - Solishtirma burchak impulsi
   */
  effectivePotential(r, L) {
    if (r <= 0) return Infinity;
    const M = this._M;
    const r2 = r * r;
    return -M / r + (L * L) / (2.0 * r2) - (M * L * L) / (r2 * r);
  }

  /** dVeff/dr — orbital barqarorlik tahlili uchun */
  effectivePotentialDerivative(r, L) {
    if (r <= 0) return 0;
    const M = this._M;
    const r2 = r * r;
    const L2 = L * L;
    return M / r2 - L2 / (r2 * r) + 3.0 * M * L2 / (r2 * r2);
  }

  /**
   * ── Formula #18: Orbital tezlik ──
   * v_orb = √(M/r) / √(1 - Rs/r)
   */
  orbitalVelocity(r) {
    if (r <= this._Rs) return 1.0;
    return Math.min(
      Math.sqrt(this._M / r) / Math.sqrt(1.0 - this._Rs / r),
      0.9999
    );
  }

  /** Orbital davr: T = 2π√(r³/M) / (1 - Rs/r) */
  orbitalPeriod(r) {
    if (r <= this._Rs) return Infinity;
    return 2.0 * PI * Math.sqrt(r * r * r / this._M) / (1.0 - this._Rs / r);
  }

  /** Doiraviy orbit uchun burchak impulsi: L = √(Mr/(1 - 3M/r)) */
  circularOrbitAngularMomentum(r) {
    const denom = 1.0 - 3.0 * this._M / r;
    if (denom <= 0) return null;
    return Math.sqrt(this._M * r / denom);
  }

  /**
   * Doiraviy orbit energiyasi: E = (1 - Rs/r) / √(1 - 3M/r)
   * ISCO'da: E ≈ 0.9428 → ~5.72% samaradorlik
   */
  circularOrbitEnergy(r) {
    const denom = 1.0 - 3.0 * this._M / r;
    if (denom <= 0) return null;
    return (1.0 - this._Rs / r) / Math.sqrt(denom);
  }

  /** Radiativ samaradorlik: η = 1 - E_ISCO ≈ 5.72% */
  get radiativeEfficiency() {
    const e = this.circularOrbitEnergy(this._rISCO);
    return e !== null ? 1.0 - e : 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NUR FIZIKASI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * ── Formula #13: Burilish burchagi ──
   * δ = 4M/b + 15πM²/(4b²) (ikkinchi tartib korreksiya bilan)
   */
  deflectionAngle(b) {
    if (b <= 0) return PI;
    const M = this._M;
    return 4.0 * M / b + (15.0 * PI / 4.0) * M * M / (b * b);
  }

  /**
   * Eng yaqin kelish radiusi — kubik tenglamani iterativ yechish
   * r³ - b²r + b²Rs = 0
   */
  closestApproach(b) {
    if (b <= this._bCritical) return this._Rs;
    let r = b;
    for (let i = 0; i < 20; i++) {
      const f = r * r * r - b * b * r + b * b * this._Rs;
      const df = 3.0 * r * r - b * b;
      if (Math.abs(df) < 1e-12) break;
      const dr = f / df;
      r -= dr;
      if (Math.abs(dr) < 1e-10) break;
    }
    return Math.max(r, this._Rs);
  }

  /** Foton tutilish tekshiruvi: |b| < b_c → tutiladi */
  isPhotonCaptured(b) {
    return Math.abs(b) < this._bCritical;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TIDAL KUCHLAR VA PROPER DISTANCE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Tidal tezlanish: a = 2M·Δr/r³
   * Gargantua (100M☉) uchun gorizont yaqinida juda kuchsiz.
   */
  tidalAcceleration(r, deltaR) {
    if (r <= 0) return Infinity;
    return 2.0 * this._M * deltaR / (r * r * r);
  }

  /**
   * Haqiqiy (proper) masofa: d = ∫dr/√(1-Rs/r)
   * Koordinata masofadan kattaroq — fazovaqt egrilgan.
   */
  properDistance(r1, r2, steps = 1000) {
    const rMin = Math.max(r1, this._Rs * 1.001);
    const dr = (r2 - rMin) / steps;
    let dist = 0;
    for (let i = 0; i < steps; i++) {
      const ra = rMin + i * dr;
      const rb = rMin + (i + 1) * dr;
      dist += (1.0 / Math.sqrt(1.0 - this._Rs / ra) +
               1.0 / Math.sqrt(1.0 - this._Rs / rb)) * 0.5 * dr;
    }
    return dist;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SHADER / HUD INTERFEYS
  // ─────────────────────────────────────────────────────────────────────────

  /** Shader uniform'lari */
  getShaderUniforms() {
    return {
      u_blackHoleMass: this._M,
      u_Rs: this._Rs,
      u_rPhotonSphere: this._rPhotonSphere,
      u_rISCO: this._rISCO,
      u_rOuterHorizon: this._Rs,
    };
  }

  /** HUD uchun formatlangan ma'lumotlar */
  getHUDInfo() {
    return {
      type: 'Schwarzschild',
      mass: `${(this._massSolar / 1e6).toFixed(0)}M M☉`,
      Rs: formatDistance(this._RsMeters),
      photonSphere: formatDistance(this._RsMeters * 1.5),
      ISCO: formatDistance(this._RsMeters * 3.0),
      efficiency: `${(this.radiativeEfficiency * 100).toFixed(1)}%`,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERLAR / SETTERLAR
  // ─────────────────────────────────────────────────────────────────────────

  get M() { return this._M; }
  get massSolar() { return this._massSolar; }
  get Rs() { return this._Rs; }
  get rPhotonSphere() { return this._rPhotonSphere; }
  get rISCO() { return this._rISCO; }
  get bCritical() { return this._bCritical; }
  get RsMeters() { return this._RsMeters; }

  set M(mass) {
    this._M = Math.max(mass, 0.01);
    this._recalculate();
  }

  set massSolar(val) {
    this._massSolar = val;
    this._RsMeters = schwarzschildRadiusMeters(val);
  }
}