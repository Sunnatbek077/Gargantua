/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Doppler Beaming (CPU-side)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Relativistik Doppler effekt hisoblashlari.
 *
 * Bu modul:
 *   - HUD uchun Doppler qiymatlarni hisoblaydi
 *   - Parametr panelida slider qiymatlarini ko'rsatadi
 *   - Diagnostika va vizualizatsiya uchun aniq qiymatlar beradi
 *   - Shader'ga yuborilayotgan parametrlarni boshqaradi
 *
 * Per-piksel Doppler hisoblash GPU'da (doppler.glsl) amalga oshiriladi.
 *
 * Formulalar:
 *   #22 — g = 1 / (γ(1 + β·cosα))    Doppler omili
 *   #23 — I_obs = g^n · I_emit        Doppler beaming
 *   #25 — ν_obs/ν_emit = g·√(...)     Umumiy chastota siljishi
 *
 * Bog'liqliklar: MathUtils
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { clamp, vecLength, vecNormalize, vecSub, vecDot }
  from '../utils/MathUtils.js';
import PhysicsConfig from '../../config/physics.config.js';

export default class DopplerBeaming {

  constructor() {
    this._config = PhysicsConfig.doppler;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ASOSIY HISOB-KITOBLAR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Lorentz omili γ
   * γ = 1/√(1 - v²/c²) = 1/√(1 - β²)
   *
   * @param {number} beta - v/c [0, 1)
   * @returns {number} γ ≥ 1
   */
  lorentzFactor(beta) {
    const b2 = Math.min(beta * beta, 0.9999);
    return 1.0 / Math.sqrt(1.0 - b2);
  }

  /**
   * ── Formula #22: Doppler omili ──
   *
   * g = 1 / (γ · (1 + β · cosα))
   *
   * @param {number} beta - Orbital tezlik v/c
   * @param {number} cosAlpha - cos(kuzatuvchiga burchak)
   *   cosα > 0: uzoqlashayotgan (qizil siljish, g < 1)
   *   cosα < 0: yaqinlashayotgan (ko'k siljish, g > 1)
   *   cosα = 0: ko'ndalang (faqat transversal effekt)
   *
   * @returns {number} g — Doppler omili
   */
  dopplerFactor(beta, cosAlpha) {
    const gamma = this.lorentzFactor(beta);
    const g = 1.0 / (gamma * (1.0 + beta * cosAlpha));
    return g;
  }

  /**
   * ── Formula #23: Doppler beaming ──
   *
   * I_obs = g^n · I_emit
   *
   * @param {number} g - Doppler omili
   * @param {number} [exponent] - Beaming ko'rsatkichi (default: config'dan)
   * @returns {number} Yorqinlik multiplikatori
   */
  beaming(g, exponent) {
    const n = exponent || this._config.beamingExponent;
    const clampedG = clamp(g, 0.05, 10.0);
    return Math.pow(clampedG, n);
  }

  /**
   * Disk yuzasidagi nuqta uchun to'liq Doppler hisoblash
   *
   * @param {number[]} diskPoint - [x, 0, z] disk nuqtasi
   * @param {number[]} cameraPos - [x, y, z] kuzatuvchi
   * @param {number} orbitalVelocity - v/c
   * @returns {{g: number, beaming: number, cosAlpha: number, approaching: boolean}}
   */
  computeAtPoint(diskPoint, cameraPos, orbitalVelocity) {
    const dp = [diskPoint[0], diskPoint[2]];  // xz tekislik
    const r = Math.sqrt(dp[0] * dp[0] + dp[1] * dp[1]);
    if (r < 0.001) {
      return { g: 1.0, beaming: 1.0, cosAlpha: 0, approaching: false };
    }

    // Tangensial yo'nalish (soat strelkasiga qarshi)
    const orbitalDir = vecNormalize([-dp[1], 0, dp[0]]);

    // Kuzatuvchiga yo'nalish
    const toObserver = vecNormalize(vecSub(cameraPos, diskPoint));

    // cos(α)
    const cosAlpha = vecDot(orbitalDir, toObserver);

    // Doppler omili
    const g = this.dopplerFactor(orbitalVelocity, cosAlpha);

    // Beaming
    const beam = this.beaming(g);

    return {
      g,
      beaming: beam,
      cosAlpha,
      approaching: cosAlpha < 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // YORQINLIK XARITASI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Disk bo'ylab Doppler yorqinlik xaritasini hisoblash
   * HUD yoki mini-xarita uchun
   *
   * @param {number[]} cameraPos - Kuzatuvchi pozitsiyasi
   * @param {number} diskRadius - Disk radiusi
   * @param {number} orbitalVelocity - v/c
   * @param {number} [resolution=64] - Xarita o'lchami
   * @returns {Float32Array} Yorqinlik xaritasi (resolution × resolution)
   */
  computeBrightnessMap(cameraPos, diskRadius, orbitalVelocity, resolution = 64) {
    const map = new Float32Array(resolution * resolution);
    const halfRes = resolution * 0.5;

    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        // Pikselni disk koordinatalariga aylantirish
        const dx = (x - halfRes) / halfRes * diskRadius;
        const dz = (y - halfRes) / halfRes * diskRadius;
        const r = Math.sqrt(dx * dx + dz * dz);

        if (r < 1.0 || r > diskRadius) {
          map[y * resolution + x] = 0;
          continue;
        }

        const result = this.computeAtPoint([dx, 0, dz], cameraPos, orbitalVelocity);
        map[y * resolution + x] = result.beaming;
      }
    }

    return map;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RANG SILJISHI HISOBLASH
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * ── Formula #25: Umumiy chastota siljishi ──
   *
   * Doppler + gravitatsion effektlar birgalikda.
   * HUD'da to'lqin uzunligini ko'rsatish uchun.
   *
   * @param {number} g - Doppler omili
   * @param {number} rEmit - Nurlanish nuqtasining radiusi
   * @param {number} Rs - Schwarzschild radiusi
   * @returns {number} ν_obs/ν_emit nisbati
   */
  combinedFrequencyShift(g, rEmit, Rs) {
    if (rEmit <= Rs) return 0;
    const gravFactor = Math.sqrt(1.0 - Rs / rEmit);
    return g * gravFactor;
  }

  /**
   * To'lqin uzunligi siljishini nm ga aylantirish
   * (vizual ko'rsatish uchun)
   *
   * @param {number} lambdaEmit - Chiqqan to'lqin uzunligi (nm)
   * @param {number} frequencyRatio - ν_obs/ν_emit
   * @returns {number} Kuzatilgan to'lqin uzunligi (nm)
   */
  shiftedWavelength(lambdaEmit, frequencyRatio) {
    if (frequencyRatio <= 0) return Infinity;
    return lambdaEmit / frequencyRatio;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SHADER PARAMETRLARNI BOSHQARISH
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Doppler parametrlarini yangilash va shader uniform sifatida qaytarish
   *
   * @param {Object} [overrides] - O'zgartirilgan parametrlar
   * @returns {Object} Shader uniform'lari
   */
  getShaderUniforms(overrides = {}) {
    return {
      u_dopplerEnabled: (overrides.enabled ?? this._config.enabled) ? 1.0 : 0.0,
      u_beamingExp: overrides.beamingExponent ?? this._config.beamingExponent,
      u_colorShift: overrides.colorShiftStrength ?? this._config.colorShiftStrength,
      u_brightnessBoost: overrides.brightnessBoost ?? this._config.brightnessBoost,
      u_gravRedshift: (overrides.gravitationalRedshift ?? this._config.gravitationalRedshift) ? 1.0 : 0.0,
    };
  }

  /**
   * HUD uchun formatlangan ma'lumot
   *
   * @param {number[]} diskPoint - Disk nuqtasi
   * @param {number[]} cameraPos - Kamera pozitsiyasi
   * @param {number} velocity - Orbital tezlik
   * @returns {Object}
   */
  getHUDInfo(diskPoint, cameraPos, velocity) {
    const result = this.computeAtPoint(diskPoint, cameraPos, velocity);
    return {
      dopplerG: result.g.toFixed(3),
      beaming: result.beaming.toFixed(2) + 'x',
      direction: result.approaching ? 'Yaqinlashmoqda (ko\'k)' : 'Uzoqlashmoqda (qizil)',
      velocity: (velocity * 100).toFixed(1) + '% c',
      gamma: this.lorentzFactor(velocity).toFixed(3),
    };
  }
}