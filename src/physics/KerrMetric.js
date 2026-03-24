/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Kerr Metric
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Kerr metrikasi — aylanuvchi qora tuynukning fazovaqt geometriyasi.
 * Roy Kerr, 1963.
 *
 * Interstellar filmidagi Gargantua — deyarli maksimal spinli
 * Kerr qora tuynugi (a/M ≈ 0.9999). Spin tufayli:
 *   - Ikki gorizont mavjud (ichki va tashqi)
 *   - Ergosfera — gorizont tashqarisidagi "tortish" hududi
 *   - Frame-dragging — fazovaqt qora tuynuk bilan birga "aylanadi"
 *   - ISCO radiusi kichikroq (disk yaqinroq, yorqinroq)
 *   - Radiativ samaradorlik 42% gacha (Schwarzschild'da 5.7%)
 *
 * ── Formula #2: Kerr metrikasi ──
 * ds² = -(1-Rsr/Σ)dt² + Σ/Δ dr² + Σdθ²
 *      + (r²+a²+Rsra²sin²θ/Σ)sin²θ dφ²
 *      - 2Rsra sin²θ/Σ dt dφ
 *
 * Formulalar:
 *   #2  — Kerr metrikasi (to'liq)
 *   #4  — Σ = r²+a²cos²θ, Δ = r²-Rsr+a², a = J/Mc
 *   #5  — Boyer-Lindquist → Kartezian konversiya
 *
 * Bog'liqliklar: Schwarzschild, MathUtils
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import Schwarzschild from './Schwarzschild.js';
import { PI, formatDistance, boyerLindquistToCartesian }
  from '../utils/MathUtils.js';

export default class KerrMetric extends Schwarzschild {

  /**
   * @param {number} [mass=1.0] - Massa (natural units)
   * @param {number} [spin=0.998] - Spin parametri a/M [0, 0.9999]
   * @param {number} [massSolar=100e6] - Quyosh massasida (HUD uchun)
   */
  constructor(mass = 1.0, spin = 0.998, massSolar = 100e6) {
    super(mass, massSolar);

    // ── Formula #4: Spin parametri ──
    // a = J/(Mc), 0 ≤ a < M
    // spin = a/M nisbati
    this._spin = Math.min(Math.abs(spin), 0.9999);
    this._a = this._spin * this._M;  // a = spin × M

    this._recalculateKerr();
  }

  /** @private */
  _recalculateKerr() {
    const M = this._M;
    const a = this._a;
    const a2 = a * a;

    // ── Formula #4: Ichki va tashqi gorizontlar ──
    // r± = M ± √(M² - a²)
    // a = 0 da: r+ = 2M (Schwarzschild), r- = 0
    // a → M da: r+ → M, r- → M (ular birlashadi)
    this._rOuterHorizon = M + Math.sqrt(M * M - a2);
    this._rInnerHorizon = M - Math.sqrt(M * M - a2);

    // ── Foton sfera (prograde orbit) ──
    // r_ph = 2M{1 + cos(2/3 · arccos(-a/M))}
    // a = 0 da: r_ph = 3M (Schwarzschild)
    // a → M da: r_ph → M (gorizontga yaqinlashadi)
    if (this._spin < 0.001) {
      this._rPhotonSpherePrograde = 3.0 * M;
      this._rPhotonSphereRetrograde = 3.0 * M;
    } else {
      this._rPhotonSpherePrograde =
        2.0 * M * (1.0 + Math.cos((2.0 / 3.0) * Math.acos(-a / M)));
      this._rPhotonSphereRetrograde =
        2.0 * M * (1.0 + Math.cos((2.0 / 3.0) * Math.acos(a / M)));
    }

    // Shader uchun — prograde (disk aylanishi bilan bir yo'nalishda)
    this._rPhotonSphere = this._rPhotonSpherePrograde;

    // ── ISCO (prograde) ──
    // Z1 = 1 + ∛(1-a²)·(∛(1+a) + ∛(1-a))
    // Z2 = √(3a² + Z1²)
    // r_ISCO = 3 + Z2 - √((3-Z1)(3+Z1+2Z2))
    //
    // a = 0 da: r_ISCO = 6M (Schwarzschild)
    // a → M da: r_ISCO → M (gorizontga yaqinlashadi!)
    if (this._spin < 0.001) {
      this._rISCOprograde = 6.0 * M;
      this._rISCOretrograde = 6.0 * M;
    } else {
      this._rISCOprograde = this._computeISCO(a, M, +1);
      this._rISCOretrograde = this._computeISCO(a, M, -1);
    }

    this._rISCO = this._rISCOprograde;

    // ── Kritik impakt parametri (prograde) ──
    if (this._spin < 0.001) {
      this._bCritical = 3.0 * Math.sqrt(3.0) * M;
    } else {
      const rph = this._rPhotonSpherePrograde;
      const delta = rph * rph - 2.0 * M * rph + a2;
      if (delta > 0) {
        this._bCritical = (rph * rph + a2) / (a + Math.sqrt(delta));
      } else {
        this._bCritical = 3.0 * Math.sqrt(3.0) * M;
      }
    }

    // ── Radiativ samaradorlik ──
    const eISCO = this._circularOrbitEnergyKerr(this._rISCOprograde, +1);
    this._efficiency = eISCO !== null ? 1.0 - eISCO : 0;
  }

  /**
   * ISCO hisoblash (prograde yoki retrograde)
   * @private
   * @param {number} a - Spin parametri
   * @param {number} M - Massa
   * @param {number} sign - +1 prograde, -1 retrograde
   */
  _computeISCO(a, M, sign) {
    const chi = a / M * sign;
    const Z1 = 1.0 + Math.cbrt(1.0 - chi * chi) * (Math.cbrt(1.0 + chi) + Math.cbrt(1.0 - chi));
    const Z2 = Math.sqrt(3.0 * chi * chi + Z1 * Z1);
    return M * (3.0 + Z2 - sign * Math.sqrt((3.0 - Z1) * (3.0 + Z1 + 2.0 * Z2)));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // KERR METRIKA KOMPONENTLARI (#2, #4)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * ── Formula #4: Σ (Sigma) ──
   * Σ = r² + a²cos²θ
   *
   * Bu Kerr metrikasining asosiy "masshtab omili".
   * θ = π/2 (ekvator) da: Σ = r²
   * θ = 0 (qutb) da: Σ = r² + a²
   */
  sigma(r, theta) {
    const cosTheta = Math.cos(theta);
    return r * r + this._a * this._a * cosTheta * cosTheta;
  }

  /**
   * ── Formula #4: Δ (Delta) ──
   * Δ = r² - Rs·r + a²
   *
   * Δ = 0 nuqtalarda gorizontlar joylashgan.
   * Δ > 0: gorizont tashqarisi
   * Δ < 0: gorizontlar orasida
   */
  delta(r) {
    return r * r - this._Rs * r + this._a * this._a;
  }

  /**
   * ── Ergosfera radiusi ──
   * r_ergo(θ) = M + √(M² - a²cos²θ)
   *
   * Gorizont tashqarisida, lekin bu hudud ichida
   * HECH NARSA qo'zg'almasdan tura olmaydi — hamma narsa
   * qora tuynuk aylanish yo'nalishida harakatlanishi SHART.
   *
   * θ = π/2 (ekvator) da: r_ergo = 2M (eng keng)
   * θ = 0 (qutb) da: r_ergo = r+ (gorizontga tegadi)
   */
  ergosphereRadius(theta) {
    const cosTheta = Math.cos(theta);
    return this._M + Math.sqrt(this._M * this._M - this._a * this._a * cosTheta * cosTheta);
  }

  /**
   * Frame-dragging burchak tezligi
   * ω = -g_tφ / g_φφ = 2Mar / (Σ(r²+a²) + 2Ma²r sin²θ)
   *
   * Bu fazovaqtning "aylanish tezligi" — qora tuynukka yaqinlashganda
   * hamma narsa majburiy ravishda shu tezlikda aylantiriladi.
   */
  frameDraggingRate(r, theta) {
    const a = this._a;
    const M = this._M;
    const sig = this.sigma(r, theta);
    const sinTheta2 = Math.pow(Math.sin(theta), 2);
    const r2pa2 = r * r + a * a;

    const numerator = 2.0 * M * a * r;
    const denominator = sig * r2pa2 + 2.0 * M * a * a * r * sinTheta2;

    if (Math.abs(denominator) < 1e-12) return 0;
    return numerator / denominator;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ORBITAL MEXANIKA (Kerr)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Kerr qora tuynukda orbital tezlik (ekvatorial tekislik)
   *
   * v_orb = (√M · r∓a√M) / (r · √(r² - 3Mr ± 2a√(Mr)))
   *
   * ∓/± : yuqori — prograde, pastki — retrograde
   */
  orbitalVelocityKerr(r, prograde = true) {
    const M = this._M;
    const a = this._a;
    const sqrtM = Math.sqrt(M);
    const sqrtR = Math.sqrt(r);

    const sign = prograde ? -1.0 : 1.0;

    const numerator = sqrtM * (r + sign * a * sqrtM / sqrtR);
    const denom2 = r * r - 3.0 * M * r + sign * 2.0 * a * Math.sqrt(M * r);

    if (denom2 <= 0) return 0.999;
    return Math.min(Math.abs(numerator / (r * Math.sqrt(denom2))), 0.999);
  }

  /**
   * Kerr doiraviy orbit energiyasi
   * @private
   */
  _circularOrbitEnergyKerr(r, sign) {
    const M = this._M;
    const a = this._a;
    const sqrtMr = Math.sqrt(M * r);

    const denom = r * r - 3.0 * M * r + sign * 2.0 * a * sqrtMr;
    if (denom <= 0) return null;

    const num = r * r - 2.0 * M * r + sign * a * sqrtMr;
    return num / (r * Math.sqrt(denom));
  }

  /**
   * Kerr radiativ samaradorlik
   * Schwarzschild: ~5.7%, Gargantua (a=0.998): ~32%
   * Maksimal (a→M): ~42% — yadro sintezidan 60 marta samaraliroq!
   */
  get radiativeEfficiency() {
    return this._efficiency;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NUQTA TEKSHIRUVLARI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Nuqta gorizont ichidami?
   * @param {number} r
   * @returns {boolean}
   */
  isInsideHorizon(r) {
    return r < this._rOuterHorizon;
  }

  /**
   * Nuqta ergosfera ichidami? (ekvatorial tekislik)
   * @param {number} r
   * @param {number} [theta=PI/2] - Qutb burchagi
   * @returns {boolean}
   */
  isInsideErgosphere(r, theta = PI * 0.5) {
    return r < this.ergosphereRadius(theta) && r >= this._rOuterHorizon;
  }

  /**
   * Boyer-Lindquist → Kartezian
   * ── Formula #5 ──
   */
  toCartesian(r, theta, phi) {
    return boyerLindquistToCartesian(r, theta, phi, this._a);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SHADER / HUD
  // ─────────────────────────────────────────────────────────────────────────

  /** Shader uchun uniform'lar (Schwarzschild'ni override qiladi) */
  getShaderUniforms() {
    return {
      u_blackHoleMass: this._M,
      u_Rs: this._Rs,
      u_spin: this._spin,
      u_rPhotonSphere: this._rPhotonSphere,
      u_rISCO: this._rISCO,
      u_rOuterHorizon: this._rOuterHorizon,
      u_diskInnerRadius: this._rISCO,
    };
  }

  /** HUD uchun formatlangan ma'lumotlar */
  getHUDInfo() {
    return {
      type: 'Kerr',
      mass: `${(this._massSolar / 1e6).toFixed(0)}M M☉`,
      spin: `a/M = ${this._spin.toFixed(4)}`,
      outerHorizon: `r+ = ${this._rOuterHorizon.toFixed(4)} M`,
      innerHorizon: `r- = ${this._rInnerHorizon.toFixed(4)} M`,
      ergosphere: `r_ergo = ${this.ergosphereRadius(PI * 0.5).toFixed(4)} M (ekv.)`,
      photonSphere: `r_ph = ${this._rPhotonSpherePrograde.toFixed(4)} M (pro)`,
      ISCO: `r_ISCO = ${this._rISCOprograde.toFixed(4)} M (pro)`,
      efficiency: `η = ${(this._efficiency * 100).toFixed(1)}%`,
      Rs: formatDistance(this._RsMeters),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SPIN O'ZGARTIRISH
  // ─────────────────────────────────────────────────────────────────────────

  /** Spin qiymati [0, 0.9999] */
  get spin() { return this._spin; }

  /** Spin parametri a (natural units) */
  get a() { return this._a; }

  /** Tashqi gorizont radiusi */
  get rOuterHorizon() { return this._rOuterHorizon; }

  /** Ichki gorizont radiusi */
  get rInnerHorizon() { return this._rInnerHorizon; }

  /** Prograde foton sfera */
  get rPhotonSpherePrograde() { return this._rPhotonSpherePrograde; }

  /** Retrograde foton sfera */
  get rPhotonSphereRetrograde() { return this._rPhotonSphereRetrograde; }

  /** Prograde ISCO */
  get rISCOprograde() { return this._rISCOprograde; }

  /** Retrograde ISCO */
  get rISCOretrograde() { return this._rISCOretrograde; }

  /**
   * Spinni o'zgartirish — barcha bog'liq qiymatlar qayta hisoblanadi
   * @param {number} spin - a/M nisbati [0, 0.9999]
   */
  set spin(spin) {
    this._spin = Math.min(Math.abs(spin), 0.9999);
    this._a = this._spin * this._M;
    this._recalculateKerr();
  }

  /** Massani o'zgartirish */
  set M(mass) {
    this._M = Math.max(mass, 0.01);
    this._a = this._spin * this._M;
    this._recalculate();       // Schwarzschild asosiy qiymatlar
    this._recalculateKerr();   // Kerr-specific qiymatlar
  }
}