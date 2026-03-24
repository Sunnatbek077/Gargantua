/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Clock
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Yuqori aniqlikdagi vaqt boshqaruv tizimi.
 *
 * Vazifalari:
 *   - Delta time (kadrlar orasidagi vaqt farqi)
 *   - Umumiy o'tgan vaqt (elapsed)
 *   - FPS hisoblash va monitoring
 *   - Kadr raqami (frame count)
 *   - Vaqt masshtablash (time scale) — gorizont yaqinida sekinlashish
 *   - Fixed timestep (fizika barqarorligi uchun)
 *
 * Bog'liqliklar: yo'q (mustaqil modul)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export default class Clock {

  // ─────────────────────────────────────────────────────────────────────────
  // KONSTRUKTOR
  // ─────────────────────────────────────────────────────────────────────────

  constructor() {
    // ── Vaqt holati ──
    this._startTime = 0;           // Soat boshlangan payt (ms)
    this._previousTime = 0;        // Oldingi kadr vaqti (ms)
    this._currentTime = 0;         // Hozirgi kadr vaqti (ms)

    // ── Delta time ──
    this._delta = 0;               // Kadrlar orasidagi vaqt (soniya)
    this._deltaMS = 0;             // Kadrlar orasidagi vaqt (millisoniya)
    this._smoothDelta = 0;         // Tekislangan delta (jitter yo'q)
    this._deltaHistory = [];       // Oxirgi N ta delta (smoothing uchun)
    this._deltaHistorySize = 10;   // Smoothing oyna o'lchami

    // ── Umumiy vaqt ──
    this._elapsed = 0;             // Umumiy o'tgan vaqt (soniya, scaled)
    this._elapsedUnscaled = 0;     // Umumiy vaqt (scale'siz, haqiqiy)

    // ── Vaqt masshtabi ──
    this._timeScale = 1.0;         // 1.0 = normal, 0.5 = sekin, 2.0 = tez
    this._targetTimeScale = 1.0;   // Maqsad scale (silliq o'tish uchun)
    this._timeScaleLerp = 0.05;    // O'tish tezligi

    // ── FPS ──
    this._frameCount = 0;          // Jami kadr soni
    this._fpsFrameCount = 0;       // FPS hisoblash uchun kadr soni
    this._fpsLastUpdate = 0;       // Oxirgi FPS yangilanishi (ms)
    this._fpsUpdateInterval = 500; // FPS yangilanish oralig'i (ms)
    this._fps = 0;                 // Hozirgi FPS
    this._fpsMin = Infinity;       // Minimal FPS (session davomida)
    this._fpsMax = 0;              // Maksimal FPS
    this._fpsHistory = [];         // FPS tarixi (grafik uchun)
    this._fpsHistorySize = 60;     // Oxirgi 60 ta FPS qiymati

    // ── Fixed timestep (fizika uchun) ──
    this._fixedDelta = 1 / 60;     // 60 Hz fizika yangilanishi
    this._fixedAccumulator = 0;    // To'plangan vaqt

    // ── Holat ──
    this._running = false;
    this._paused = false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BOSHQARUV METODLARI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Soatni ishga tushirish
   * Render loop boshlanishidan oldin chaqiriladi
   */
  start() {
    const now = performance.now();
    this._startTime = now;
    this._previousTime = now;
    this._currentTime = now;
    this._fpsLastUpdate = now;
    this._running = true;
    this._paused = false;

    // Tarixlarni tozalash
    this._deltaHistory.length = 0;
    this._fpsHistory.length = 0;
    this._fpsMin = Infinity;
    this._fpsMax = 0;
    this._frameCount = 0;

    return this;
  }

  /**
   * Pauza — vaqt to'xtaydi, lekin soat "tirik" qoladi
   */
  pause() {
    if (!this._running || this._paused) return this;
    this._paused = true;
    return this;
  }

  /**
   * Pauzadan davom ettirish
   */
  resume() {
    if (!this._running || !this._paused) return this;
    this._paused = false;
    // Pauzadan keyin katta delta bo'lmasligi uchun
    this._previousTime = performance.now();
    return this;
  }

  /**
   * Soatni to'liq to'xtatish
   */
  stop() {
    this._running = false;
    this._paused = false;
    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ASOSIY YANGILASH — har kadr chaqiriladi
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Har bir kadrda chaqiriladi — barcha vaqt qiymatlarini yangilaydi
   *
   * @param {number} [timestamp] - requestAnimationFrame'dan kelgan vaqt (ms)
   *                               Agar berilmasa, performance.now() ishlatiladi
   */
  tick(timestamp) {
    if (!this._running) return this;

    const now = timestamp !== undefined ? timestamp : performance.now();
    this._currentTime = now;

    // ── Delta hisoblash ──
    if (this._paused) {
      this._delta = 0;
      this._deltaMS = 0;
    } else {
      this._deltaMS = now - this._previousTime;

      // Himoya: tabni o'chirib-yoqganda katta delta bo'lmasligi uchun
      // Maksimal delta = 100ms (10 FPS ga teng)
      this._deltaMS = Math.min(this._deltaMS, 100);

      this._delta = this._deltaMS / 1000; // Soniyaga aylantirish
    }

    this._previousTime = now;

    // ── Delta smoothing ──
    // Oxirgi N ta deltaning o'rtachasi — jitter'ni kamaytiradi
    if (!this._paused && this._delta > 0) {
      this._deltaHistory.push(this._delta);
      if (this._deltaHistory.length > this._deltaHistorySize) {
        this._deltaHistory.shift();
      }
      const sum = this._deltaHistory.reduce((a, b) => a + b, 0);
      this._smoothDelta = sum / this._deltaHistory.length;
    }

    // ── Vaqt masshtabi — silliq o'tish ──
    if (Math.abs(this._timeScale - this._targetTimeScale) > 0.001) {
      this._timeScale += (this._targetTimeScale - this._timeScale) * this._timeScaleLerp;
    } else {
      this._timeScale = this._targetTimeScale;
    }

    // ── Umumiy vaqt ──
    if (!this._paused) {
      this._elapsedUnscaled += this._delta;
      this._elapsed += this._delta * this._timeScale;
    }

    // ── Fixed timestep accumulator ──
    if (!this._paused) {
      this._fixedAccumulator += this._delta * this._timeScale;
    }

    // ── FPS hisoblash ──
    this._frameCount++;
    this._fpsFrameCount++;

    const fpsElapsed = now - this._fpsLastUpdate;
    if (fpsElapsed >= this._fpsUpdateInterval) {
      this._fps = Math.round((this._fpsFrameCount / fpsElapsed) * 1000);
      this._fpsFrameCount = 0;
      this._fpsLastUpdate = now;

      // Min/Max yangilash (birinchi 30 kadrdan keyin — stabilizatsiya)
      if (this._frameCount > 30) {
        this._fpsMin = Math.min(this._fpsMin, this._fps);
        this._fpsMax = Math.max(this._fpsMax, this._fps);
      }

      // FPS tarixi
      this._fpsHistory.push(this._fps);
      if (this._fpsHistory.length > this._fpsHistorySize) {
        this._fpsHistory.shift();
      }
    }

    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIXED TIMESTEP — fizika uchun
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fixed timestep qadamlarini ishga tushirish
   * Fizika hisob-kitoblari uchun — FPS'ga bog'liq emas, barqaror
   *
   * @param {Function} callback - Har bir fixed qadam uchun chaqiriladigan funksiya
   *                              callback(fixedDelta) shaklida
   * @returns {number} Qancha qadam bajarildi
   *
   * Foydalanish:
   *   clock.consumeFixedSteps((dt) => {
   *     physics.update(dt);
   *   });
   */
  consumeFixedSteps(callback) {
    let steps = 0;
    const maxSteps = 5; // Spiral of death himoyasi

    while (this._fixedAccumulator >= this._fixedDelta && steps < maxSteps) {
      callback(this._fixedDelta);
      this._fixedAccumulator -= this._fixedDelta;
      steps++;
    }

    return steps;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VAQT MASSHTABI (Time Dilation effekt uchun)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Vaqt masshtabini o'rnatish
   * Qora tuynukka yaqinlashganda vaqt sekinlashishi uchun
   *
   * @param {number} scale - 0.0 = to'xtagan, 0.5 = sekin, 1.0 = normal, 2.0 = tez
   * @param {boolean} [instant=false] - true = darhol, false = silliq o'tish
   */
  setTimeScale(scale, instant = false) {
    this._targetTimeScale = Math.max(0.0, Math.min(scale, 10.0));
    if (instant) {
      this._timeScale = this._targetTimeScale;
    }
    return this;
  }

  /**
   * Gravitatsion vaqt kengayishini hisoblash va qo'llash
   * Formula: time_scale = √(1 - Rs/r)
   * r → Rs bo'lganda time_scale → 0 (vaqt to'xtaydi)
   *
   * @param {number} r - Qora tuynuk markazidan masofa [natural units]
   * @param {number} Rs - Schwarzschild radiusi (odatda 2.0)
   */
  applyGravitationalTimeDilation(r, Rs) {
    if (r <= Rs) {
      this.setTimeScale(0.0);
      return this;
    }
    const dilation = Math.sqrt(1.0 - Rs / r);
    this.setTimeScale(dilation);
    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERLAR — tashqi modullar uchun
  // ─────────────────────────────────────────────────────────────────────────

  /** Kadrlar orasidagi vaqt (soniya), time scale qo'llanilgan */
  get delta() {
    return this._delta * this._timeScale;
  }

  /** Kadrlar orasidagi vaqt (soniya), time scale'siz — UI animatsiyalari uchun */
  get deltaUnscaled() {
    return this._delta;
  }

  /** Tekislangan delta (jitter kamaytirilgan) */
  get smoothDelta() {
    return this._smoothDelta * this._timeScale;
  }

  /** Umumiy o'tgan vaqt (soniya), time scale qo'llanilgan */
  get elapsed() {
    return this._elapsed;
  }

  /** Umumiy o'tgan vaqt (soniya), time scale'siz */
  get elapsedUnscaled() {
    return this._elapsedUnscaled;
  }

  /** Hozirgi FPS */
  get fps() {
    return this._fps;
  }

  /** Minimal FPS (session davomida) */
  get fpsMin() {
    return this._fpsMin === Infinity ? 0 : this._fpsMin;
  }

  /** Maksimal FPS */
  get fpsMax() {
    return this._fpsMax;
  }

  /** FPS tarixi massivi (grafik uchun) */
  get fpsHistory() {
    return this._fpsHistory;
  }

  /** Jami kadr raqami */
  get frameCount() {
    return this._frameCount;
  }

  /** Hozirgi vaqt masshtabi */
  get timeScale() {
    return this._timeScale;
  }

  /** Fixed timestep delta qiymati */
  get fixedDelta() {
    return this._fixedDelta;
  }

  /** Soat ishlamoqdami? */
  get running() {
    return this._running;
  }

  /** Pauzadami? */
  get paused() {
    return this._paused;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // YORDAMCHI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fixed timestep chastotasini o'zgartirish
   * @param {number} hz - Chastota (masalan, 60, 120, 30)
   */
  setFixedRate(hz) {
    this._fixedDelta = 1.0 / Math.max(1, hz);
    return this;
  }

  /**
   * FPS yangilanish oralig'ini o'zgartirish
   * @param {number} ms - Millisoniya (masalan, 500 = sekundiga 2 marta)
   */
  setFPSUpdateInterval(ms) {
    this._fpsUpdateInterval = Math.max(100, ms);
    return this;
  }

  /**
   * O'rtacha FPS (oxirgi N kadr)
   */
  get fpsAverage() {
    if (this._fpsHistory.length === 0) return 0;
    const sum = this._fpsHistory.reduce((a, b) => a + b, 0);
    return Math.round(sum / this._fpsHistory.length);
  }

  /**
   * Kadr vaqti (ms) — performance monitoring uchun
   */
  get frameTimeMS() {
    return this._deltaMS;
  }

  /**
   * Soat holatini diagnostik ob'ekt sifatida qaytarish
   * Debugging va HUD uchun
   */
  getDebugInfo() {
    return {
      fps: this._fps,
      fpsMin: this.fpsMin,
      fpsMax: this._fpsMax,
      fpsAvg: this.fpsAverage,
      delta: this._delta.toFixed(4),
      elapsed: this._elapsed.toFixed(2),
      timeScale: this._timeScale.toFixed(3),
      frameCount: this._frameCount,
      paused: this._paused,
    };
  }

  /**
   * Tozalash — xotira bo'shatish
   */
  dispose() {
    this._deltaHistory.length = 0;
    this._fpsHistory.length = 0;
    this._running = false;
    this._paused = false;
  }
}