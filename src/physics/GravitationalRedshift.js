/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Gravitational Redshift
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Gravitatsion qizil siljish va vaqt kengayishi.
 *
 * Fizik mohiyat:
 *   Gravitatsiya yorug'likning chastotasini pasaytiradi (energiyasini kamaytiradi).
 *   Qora tuynukdan chiqqan yorug'lik uzoqdagi kuzatuvchiga kelganda
 *   "qizilroq" (past chastotali) bo'ladi.
 *
 *   Shu bilan birga vaqt ham sekinlashadi — gorizont yaqinida
 *   1 soniya uzoqdagi kuzatuvchi uchun soatlab davom etadi.
 *
 * Interstellar filmi misoli:
 *   Miller sayyorasi Gargantua yaqinida — 1 soat = 7 yil Yerda.
 *   Bu gravitatsion vaqt kengayishining dramatik misoli.
 *
 * Bu modul:
 *   - HUD uchun vaqt kengayishini hisoblaydi
 *   - Kamera pozitsiyasidagi redshift ko'rsatadi
 *   - Rang korreksiyasi parametrlarini beradi
 *   - Ta'limiy vizualizatsiya uchun grafiklar tayyorlaydi
 *
 * Formulalar:
 *   #24 — z_grav = 1/√(1 - Rs/r) - 1           Gravitatsion redshift
 *   #25 — ν_obs/ν_emit = g·√(1-Rs/r_e)/√(1-Rs/r_o)  Umumiy siljish
 *
 * Bog'liqliklar: MathUtils
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { clamp } from '../utils/MathUtils.js';

export default class GravitationalRedshift {

  /**
   * @param {number} Rs - Schwarzschild radiusi (natural units, odatda 2.0)
   */
  constructor(Rs = 2.0) {
    this._Rs = Rs;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ASOSIY FORMULALAR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * ── Formula #24: Gravitatsion redshift (z) ──
   *
   * z = 1/√(1 - Rs/r) - 1
   *
   * z qiymatlari:
   *   z = 0    — siljish yo'q (cheksiz uzoqda)
   *   z = 0.06 — Quyosh yuzasida (juda kichik)
   *   z = 0.41 — r = 2Rs (Schwarzschild radiusining 2 baravar)
   *   z → ∞    — r → Rs (gorizont yaqinida cheksiz)
   *
   * @param {number} r - Radiusli koordinata
   * @returns {number} z ≥ 0 (0 = siljish yo'q, ∞ = gorizont)
   */
  redshift(r) {
    if (r <= this._Rs) return Infinity;
    const factor = 1.0 - this._Rs / r;
    if (factor <= 0) return Infinity;
    return 1.0 / Math.sqrt(factor) - 1.0;
  }

  /**
   * Redshift omili — rang multiplikatori sifatida
   *
   * f = √(1 - Rs/r)
   *
   * f = 1 → siljish yo'q
   * f = 0 → to'liq redshift (gorizont)
   *
   * @param {number} r
   * @returns {number} [0, 1]
   */
  redshiftFactor(r) {
    if (r <= this._Rs) return 0;
    return Math.sqrt(Math.max(1.0 - this._Rs / r, 0));
  }

  /**
   * Vaqt kengayishi omili
   *
   * dτ/dt = √(1 - Rs/r)
   *
   * Bu "mahalliy vaqt / koordinata vaqti" nisbati.
   * Gorizont yaqinida mahalliy vaqt sekinlashadi.
   *
   * Interstellar misoli:
   *   dτ/dt = √(1 - Rs/r)
   *   Agar dτ/dt = 1/61320 (Miller sayyorasi)
   *   → 1 soat mahalliy = 7 yil uzoqda
   *
   * @param {number} r
   * @returns {number} [0, 1] — 0 = vaqt to'xtagan, 1 = normal
   */
  timeDilation(r) {
    return this.redshiftFactor(r);
  }

  /**
   * Vaqt kengayishi nisbati — "1 soat shu yerda = X soat uzoqda"
   *
   * @param {number} r
   * @returns {number} Nisbat (≥ 1)
   */
  timeDilationRatio(r) {
    const dilation = this.timeDilation(r);
    if (dilation < 1e-10) return Infinity;
    return 1.0 / dilation;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // IKKI NUQTA ORASIDAGI SILJISH
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * ── Formula #25: Ikki nuqta orasidagi chastota siljishi ──
   *
   * ν_obs/ν_emit = √(1 - Rs/r_emit) / √(1 - Rs/r_obs)
   *
   * Bu Doppler'siz, faqat gravitatsion effekt.
   *
   * Misol: disk (r=6M) dan kamera (r=15M) ga:
   *   ν_obs/ν_emit = √(1-2/6) / √(1-2/15) = √(2/3) / √(13/15) ≈ 0.877
   *   → ~12.3% qizil siljish
   *
   * @param {number} rEmit - Nurlanish nuqtasi radiusi
   * @param {number} rObs - Kuzatuvchi radiusi
   * @returns {number} Chastota nisbati (< 1 = qizil siljish, > 1 = ko'k)
   */
  frequencyShiftBetween(rEmit, rObs) {
    const fEmit = this.redshiftFactor(rEmit);
    const fObs = this.redshiftFactor(rObs);

    if (fObs < 1e-10) return 0;
    return fEmit / fObs;
  }

  /**
   * To'lqin uzunligi siljishi
   * λ_obs = λ_emit / (ν_obs/ν_emit)
   *
   * @param {number} lambdaEmit - Chiqqan to'lqin uzunligi (nm)
   * @param {number} rEmit - Chiqqan nuqta radiusi
   * @param {number} rObs - Kuzatuvchi radiusi
   * @returns {number} Kuzatilgan to'lqin uzunligi (nm)
   */
  shiftedWavelength(lambdaEmit, rEmit, rObs) {
    const ratio = this.frequencyShiftBetween(rEmit, rObs);
    if (ratio <= 0) return Infinity;
    return lambdaEmit / ratio;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VIZUALIZATSIYA YORDAMCHILARI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Redshift profili — radius bo'yicha grafik
   * UI'dagi mini-grafik uchun
   *
   * @param {number} [rMin=2.1] - Minimal radius (gorizontdan biroz tashqarida)
   * @param {number} [rMax=30] - Maksimal radius
   * @param {number} [points=100] - Nuqtalar soni
   * @returns {{r: number[], z: number[], dilation: number[]}}
   */
  redshiftProfile(rMin, rMax = 30, points = 100) {
    const startR = rMin || (this._Rs * 1.05);  // Gorizontdan 5% tashqarida
    const dr = (rMax - startR) / (points - 1);

    const rValues = [];
    const zValues = [];
    const dilationValues = [];

    for (let i = 0; i < points; i++) {
      const r = startR + i * dr;
      rValues.push(r);
      zValues.push(this.redshift(r));
      dilationValues.push(this.timeDilation(r));
    }

    return { r: rValues, z: zValues, dilation: dilationValues };
  }

  /**
   * To'lqin uzunligi → ko'rinadigan rang (approksimatsiya)
   * Redshift vizualizatsiyasi uchun
   *
   * @param {number} lambda - To'lqin uzunligi (nm)
   * @returns {{r: number, g: number, b: number}} RGB [0, 1]
   */
  wavelengthToColor(lambda) {
    // Ko'rinadigan spektr: 380nm (binafsha) — 780nm (qizil)
    let r = 0, g = 0, b = 0;

    if (lambda < 380) {
      // Ultrabinafsha — ko'rinmaydi, lekin qora-binafsha ko'rsatamiz
      r = 0.2; g = 0.0; b = 0.3;
    } else if (lambda < 440) {
      r = -(lambda - 440) / 60;
      g = 0;
      b = 1;
    } else if (lambda < 490) {
      r = 0;
      g = (lambda - 440) / 50;
      b = 1;
    } else if (lambda < 510) {
      r = 0;
      g = 1;
      b = -(lambda - 510) / 20;
    } else if (lambda < 580) {
      r = (lambda - 510) / 70;
      g = 1;
      b = 0;
    } else if (lambda < 645) {
      r = 1;
      g = -(lambda - 645) / 65;
      b = 0;
    } else if (lambda < 780) {
      r = 1;
      g = 0;
      b = 0;
    } else {
      // Infraqizil — ko'rinmaydi, qorong'i qizil
      r = 0.3; g = 0.0; b = 0.0;
    }

    // Chetlarda pasayish (ko'z sezuvchanligi)
    let factor = 1.0;
    if (lambda >= 380 && lambda < 420) {
      factor = 0.3 + 0.7 * (lambda - 380) / 40;
    } else if (lambda > 700 && lambda <= 780) {
      factor = 0.3 + 0.7 * (780 - lambda) / 80;
    }

    return {
      r: clamp(r * factor, 0, 1),
      g: clamp(g * factor, 0, 1),
      b: clamp(b * factor, 0, 1),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HUD MA'LUMOTLARI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Berilgan radiusdagi to'liq redshift ma'lumoti
   * HUD overlay uchun
   *
   * @param {number} r - Kamera yoki nuqta radiusi
   * @returns {Object}
   */
  getHUDInfo(r) {
    const z = this.redshift(r);
    const dilation = this.timeDilation(r);
    const ratio = this.timeDilationRatio(r);

    // Vaqt nisbatini inson o'qiy oladigan formatga
    let timeDescription;
    if (ratio < 1.001) {
      timeDescription = 'Siljish sezilmaydi';
    } else if (ratio < 2) {
      timeDescription = `1 soat = ${(ratio).toFixed(2)} soat uzoqda`;
    } else if (ratio < 100) {
      timeDescription = `1 soat = ${ratio.toFixed(1)} soat uzoqda`;
    } else if (ratio < 8760) {
      timeDescription = `1 soat = ${(ratio / 24).toFixed(1)} kun uzoqda`;
    } else if (ratio < 8760 * 100) {
      timeDescription = `1 soat = ${(ratio / 8760).toFixed(1)} yil uzoqda`;
    } else {
      timeDescription = `1 soat = ${(ratio / 8760).toFixed(0)} yil uzoqda`;
    }

    // 550nm (yashil) yorug'likning shu nuqtadan cheksiz uzoqga kelgandagi rangi
    const shiftedLambda = 550 / this.redshiftFactor(r);
    const color = this.wavelengthToColor(Math.min(shiftedLambda, 900));

    return {
      radius: r.toFixed(2) + ' M',
      redshift: z < 100 ? 'z = ' + z.toFixed(4) : 'z → ∞',
      timeDilation: dilation.toFixed(6),
      timeRatio: timeDescription,
      shiftedWavelength: shiftedLambda < 2000
        ? Math.round(shiftedLambda) + ' nm'
        : 'infraqizil',
      visualColor: color,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTERSTELLAR MISOLLAR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Miller sayyorasi effekti — berilgan vaqt nisbati uchun radiusni topish
   *
   * Masala: "1 soat = 7 yil" uchun qanday radiusda bo'lish kerak?
   * ratio = 7 × 365.25 × 24 = 61,362
   * dτ/dt = 1/61362
   * 1 - Rs/r = (1/61362)² ≈ 2.66×10⁻¹⁰
   * r ≈ Rs / (1 - 2.66×10⁻¹⁰) ≈ Rs × (1 + 2.66×10⁻¹⁰)
   *
   * @param {number} ratio - Vaqt nisbati (1 soat mahalliy = ratio soat uzoqda)
   * @returns {number} Kerakli radius (natural units)
   */
  radiusForTimeDilation(ratio) {
    if (ratio <= 1) return Infinity;
    // dτ/dt = 1/ratio
    // 1 - Rs/r = (1/ratio)²
    // r = Rs / (1 - 1/ratio²)
    const dilationSq = 1.0 / (ratio * ratio);
    const denom = 1.0 - dilationSq;
    if (denom <= 0) return this._Rs;
    return this._Rs / denom;
  }

  /**
   * "Interstellar" ssenariylarini hisoblash
   */
  getInterstellarScenarios() {
    const millerRatio = 7 * 365.25 * 24; // 1 soat = 7 yil
    return {
      millerPlanet: {
        name: 'Miller sayyorasi',
        ratio: millerRatio,
        radius: this.radiusForTimeDilation(millerRatio),
        description: '1 soat = 7 yil',
      },
      mannPlanet: {
        name: 'Mann sayyorasi',
        ratio: 1.5,
        radius: this.radiusForTimeDilation(1.5),
        description: 'Engil vaqt kengayishi',
      },
      safeOrbit: {
        name: 'Xavfsiz orbit',
        ratio: 1.01,
        radius: this.radiusForTimeDilation(1.01),
        description: '1% vaqt farqi',
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERLAR / SETTERLAR
  // ─────────────────────────────────────────────────────────────────────────

  get Rs() { return this._Rs; }

  set Rs(val) {
    this._Rs = Math.max(val, 0.01);
  }
}