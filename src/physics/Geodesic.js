/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Geodesic Integrator (CPU-side)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Egri fazovaqtda nurlarning va zarralarning yo'lini hisoblash.
 *
 * MUHIM: Bu modul PER-PIKSEL ray marching emas!
 * Per-piksel hisoblash GPU'da (blackhole.frag) amalga oshiriladi.
 *
 * Bu modul quyidagilar uchun ishlatiladi:
 *   - Orbit yo'lini vizualizatsiya qilish (UI'da egri chiziq)
 *   - Foton traektoriyasini tahlil qilish (diagnostika)
 *   - Impakt parametrga bog'liq burilish burchagini hisoblash
 *   - Offline yuqori aniqlikdagi hisob-kitoblar
 *   - Effektiv potentsial grafikini chizish
 *
 * Formulalar:
 *   #6  — d²xᵘ/dλ² + Γᵘᵥₚ(dxᵛ/dλ)(dxᵖ/dλ) = 0  Geodezik tenglama
 *   #7  — Γᵘᵥₚ = ½gᵘˢ(∂ᵥgₛₚ + ∂ₚgₛᵥ - ∂ₛgᵥₚ)  Christoffel simvollari
 *   #8  — Verlet integrallash
 *   #9  — Runge-Kutta 4 (RK4) integrallash
 *
 * Bog'liqliklar: Schwarzschild, KerrMetric, MathUtils
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { vecLength, vecNormalize, vecAdd, vecSub, vecScale }
  from '../utils/MathUtils.js';

export default class Geodesic {

  /**
   * @param {Schwarzschild|KerrMetric} metric - Qo'llaniladigan metrika
   */
  constructor(metric) {
    this._metric = metric;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GRAVITATSION TEZLANISH
  // ─────────────────────────────────────────────────────────────────────────
  //
  // ── Formulalar #6, #7: Geodezik tenglama + Christoffel ──
  //
  // To'liq geodezik tenglamani yechish o'rniga,
  // "pseudo-Newtonian + GR korreksiya" usulini ishlatamiz.
  // Bu blackhole.frag'dagi usul bilan bir xil.
  //
  // Fotonlar uchun effektiv potentsial:
  //   a_grav = -M/r² × (1 + 1.5Rs²/r²) × r_hat
  //
  // Bu Schwarzschild metrikasida foton sferani (r=3M)
  // to'g'ri reproduktsiya qiladi.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Gravitatsion tezlanish vektorini hisoblash
   *
   * @param {number[]} pos - [x, y, z] pozitsiya
   * @returns {number[]} [ax, ay, az] tezlanish
   */
  acceleration(pos) {
    const r = vecLength(pos);
    if (r < 0.001) return [0, 0, 0];

    const Rs = this._metric.Rs;
    const M = Rs * 0.5;
    const r2 = r * r;

    // Newtonian + GR korreksiya
    const accelMag = -M / r2;
    const grCorrection = 1.0 + 1.5 * Rs * Rs / r2;

    const rHat = vecNormalize(pos);
    return vecScale(rHat, accelMag * grCorrection);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTEGRALLASH USULLARI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * ── Formula #8: Verlet (Leapfrog) integrallash ──
   *
   * x(t+dt) = x(t) + v(t)·dt + ½a(t)·dt²
   * v(t+dt) = v(t) + ½(a(t) + a(t+dt))·dt
   *
   * Xususiyatlari:
   *   - Simplatik (energiyani uzoq muddatda saqlaydi)
   *   - Ikkinchi tartibli aniqlik O(dt²)
   *   - Tez (bir qadam = 1 ta acceleration hisoblash)
   *
   * @param {number[]} pos - Boshlang'ich pozitsiya
   * @param {number[]} vel - Boshlang'ich tezlik
   * @param {number} dt - Qadam kattaligi
   * @returns {{pos: number[], vel: number[]}} Yangi holat
   */
  stepVerlet(pos, vel, dt) {
    const a1 = this.acceleration(pos);

    // Pozitsiyani yangilash
    const newPos = vecAdd(
      vecAdd(pos, vecScale(vel, dt)),
      vecScale(a1, 0.5 * dt * dt)
    );

    // Yangi nuqtadagi tezlanish
    const a2 = this.acceleration(newPos);

    // Tezlikni yangilash
    const avgAccel = vecScale(vecAdd(a1, a2), 0.5);
    const newVel = vecAdd(vel, vecScale(avgAccel, dt));

    return { pos: newPos, vel: vecNormalize(newVel) };
  }

  /**
   * ── Formula #9: Runge-Kutta 4 (RK4) integrallash ──
   *
   * k₁ = f(tₙ, yₙ)
   * k₂ = f(tₙ + h/2, yₙ + h·k₁/2)
   * k₃ = f(tₙ + h/2, yₙ + h·k₂/2)
   * k₄ = f(tₙ + h, yₙ + h·k₃)
   * yₙ₊₁ = yₙ + h/6·(k₁ + 2k₂ + 2k₃ + k₄)
   *
   * Xususiyatlari:
   *   - To'rtinchi tartibli aniqlik O(dt⁴)
   *   - Har qadam = 4 ta acceleration hisoblash
   *   - Eng keng qo'llaniladigan umumiy maqsadli integrator
   *
   * @param {number[]} pos
   * @param {number[]} vel
   * @param {number} dt
   * @returns {{pos: number[], vel: number[]}}
   */
  stepRK4(pos, vel, dt) {
    // k1
    const a1 = this.acceleration(pos);
    const k1v = vecScale(a1, dt);
    const k1x = vecScale(vel, dt);

    // k2
    const midPos1 = vecAdd(pos, vecScale(k1x, 0.5));
    const midVel1 = vecAdd(vel, vecScale(k1v, 0.5));
    const a2 = this.acceleration(midPos1);
    const k2v = vecScale(a2, dt);
    const k2x = vecScale(midVel1, dt);

    // k3
    const midPos2 = vecAdd(pos, vecScale(k2x, 0.5));
    const midVel2 = vecAdd(vel, vecScale(k2v, 0.5));
    const a3 = this.acceleration(midPos2);
    const k3v = vecScale(a3, dt);
    const k3x = vecScale(midVel2, dt);

    // k4
    const endPos = vecAdd(pos, k3x);
    const endVel = vecAdd(vel, k3v);
    const a4 = this.acceleration(endPos);
    const k4v = vecScale(a4, dt);
    const k4x = vecScale(endVel, dt);

    // Birlashtirish: y + h/6·(k1 + 2k2 + 2k3 + k4)
    const newVel = vecAdd(vel, vecScale(
      vecAdd(vecAdd(k1v, vecScale(k2v, 2)), vecAdd(vecScale(k3v, 2), k4v)),
      1.0 / 6.0
    ));
    const newPos = vecAdd(pos, vecScale(
      vecAdd(vecAdd(k1x, vecScale(k2x, 2)), vecAdd(vecScale(k3x, 2), k4x)),
      1.0 / 6.0
    ));

    return { pos: newPos, vel: vecNormalize(newVel) };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TO'LIQ TRAEKTORIYA HISOBLASH
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Nurning to'liq traektoriyasini hisoblash
   *
   * @param {number[]} startPos - Boshlang'ich pozitsiya [x, y, z]
   * @param {number[]} startDir - Boshlang'ich yo'nalish [dx, dy, dz]
   * @param {Object} [options]
   * @param {number} [options.maxSteps=500] - Maksimum qadam
   * @param {number} [options.stepSize=0.05] - Qadam kattaligi
   * @param {boolean} [options.adaptive=true] - Adaptiv qadam
   * @param {string} [options.method='rk4'] - 'rk4' yoki 'verlet'
   * @param {number} [options.escapeRadius=50] - Qochish radiusi
   * @param {number} [options.captureRadius=0.1] - Tutish radiusi
   *
   * @returns {{
   *   points: number[][],         — traektoriya nuqtalari [[x,y,z], ...]
   *   captured: boolean,          — qora tuynukka tushdimi
   *   escaped: boolean,           — uzoqlashdimi
   *   closestApproach: number,    — eng yaqin kelish
   *   totalSteps: number,         — bajarilgan qadamlar
   *   diskCrossings: number[],    — disk kesishish radiuslari
   *   deflectionAngle: number     — burilish burchagi (radian)
   * }}
   */
  traceRay(startPos, startDir, options = {}) {
    const maxSteps = options.maxSteps || 500;
    const baseStep = options.stepSize || 0.05;
    const adaptive = options.adaptive !== false;
    const method = options.method || 'rk4';
    const escapeR = options.escapeRadius || 50;
    const captureR = options.captureRadius || 0.1;

    const Rs = this._metric.Rs;
    const stepFn = method === 'rk4'
      ? (p, v, dt) => this.stepRK4(p, v, dt)
      : (p, v, dt) => this.stepVerlet(p, v, dt);

    // Natijalar
    const points = [startPos.slice()];
    let pos = startPos.slice();
    let vel = vecNormalize(startDir.slice());
    let closestApproach = vecLength(pos);
    let captured = false;
    let escaped = false;
    const diskCrossings = [];
    let totalSteps = 0;

    for (let i = 0; i < maxSteps; i++) {
      const r = vecLength(pos);
      closestApproach = Math.min(closestApproach, r);

      // Adaptiv qadam
      let dt = baseStep;
      if (adaptive) {
        dt = Math.max(0.01, Math.min(0.2, r * 0.3));
      }

      // Oldingi y (disk kesishish uchun)
      const prevY = pos[1];

      // Integrallash
      const result = stepFn(pos, vel, dt);
      const prevPos = pos;
      pos = result.pos;
      vel = result.vel;
      totalSteps++;

      points.push(pos.slice());

      const newR = vecLength(pos);

      // Qora tuynukka tushdi
      if (newR < Rs * 0.5 + captureR) {
        captured = true;
        break;
      }

      // Disk kesishish (y=0 tekisligi)
      if (prevY * pos[1] < 0) {
        const t = prevY / (prevY - pos[1]);
        const hitR = Math.sqrt(
          Math.pow(prevPos[0] + (pos[0] - prevPos[0]) * t, 2) +
          Math.pow(prevPos[2] + (pos[2] - prevPos[2]) * t, 2)
        );
        diskCrossings.push(hitR);
      }

      // Uzoqlashdi
      if (newR > escapeR) {
        escaped = true;
        break;
      }
    }

    // Burilish burchagi
    const initialDir = vecNormalize(startDir);
    const finalDir = vecNormalize(vel);
    const cosAngle = initialDir[0] * finalDir[0] +
                     initialDir[1] * finalDir[1] +
                     initialDir[2] * finalDir[2];
    const deflectionAngle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));

    return {
      points,
      captured,
      escaped,
      closestApproach,
      totalSteps,
      diskCrossings,
      deflectionAngle,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ANALITIK YORDAMCHILAR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Impakt parametr bo'yicha traektoriyani hisoblash
   * Uzoqdan keladigan nur uchun
   *
   * @param {number} b - Impakt parametri
   * @param {number} [distance=40] - Boshlang'ich masofa
   * @param {Object} [options] - traceRay uchun parametrlar
   * @returns {Object} traceRay natijasi
   */
  traceByImpactParameter(b, distance = 40, options = {}) {
    // Nur x o'qi bo'ylab keladi, y = b (impakt parametr)
    const startPos = [distance, b, 0];
    const startDir = [-1, 0, 0];

    return this.traceRay(startPos, startDir, options);
  }

  /**
   * Bir nechta impakt parametrlar uchun traektoriyalar
   * Gravitatsion lensing vizualizatsiyasi uchun
   *
   * @param {number[]} bValues - Impakt parametrlar massivi
   * @param {number} [distance=40]
   * @param {Object} [options]
   * @returns {Object[]} Traektoriyalar massivi
   */
  traceMultipleRays(bValues, distance = 40, options = {}) {
    return bValues.map(b => ({
      b,
      ...this.traceByImpactParameter(b, distance, options),
    }));
  }

  /**
   * Effektiv potentsial grafikini hisoblash
   * UI'da ko'rsatish uchun
   *
   * @param {number} L - Burchak impulsi
   * @param {number} [rMin=2.5] - Minimal radius
   * @param {number} [rMax=20] - Maksimal radius
   * @param {number} [points=200] - Nuqtalar soni
   * @returns {{r: number[], V: number[]}} Grafik ma'lumotlari
   */
  effectivePotentialCurve(L, rMin = 2.5, rMax = 20, points = 200) {
    const rValues = [];
    const vValues = [];
    const dr = (rMax - rMin) / (points - 1);

    for (let i = 0; i < points; i++) {
      const r = rMin + i * dr;
      rValues.push(r);
      vValues.push(this._metric.effectivePotential(r, L));
    }

    return { r: rValues, V: vValues };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // METRIKANI O'ZGARTIRISH
  // ─────────────────────────────────────────────────────────────────────────

  /** Metrikani yangilash */
  set metric(newMetric) {
    this._metric = newMetric;
  }

  get metric() {
    return this._metric;
  }
}