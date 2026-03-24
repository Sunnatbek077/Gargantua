/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Performance Monitor
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Real-time performance monitoring va diagnostika.
 *
 * Vazifalari:
 *   - Kadr vaqti (frame time) tahlili
 *   - GPU yuklanishini baholash
 *   - Bottleneck aniqlash (CPU vs GPU)
 *   - Sifat moslashtirish tavsiyalari
 *   - HUD uchun diagnostik ma'lumotlar
 *   - WebGL resurs kuzatuvi
 *
 * Bog'liqliklar: yo'q (tashqi kutubxonalarsiz)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export default class PerformanceMonitor {

  // ─────────────────────────────────────────────────────────────────────────
  // KONSTRUKTOR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {Object} [options]
   * @param {number} [options.sampleSize=120] - O'lchov oynasi (kadr soni)
   * @param {number} [options.warningThreshold=33] - Ogohlantirish (ms/kadr)
   * @param {number} [options.criticalThreshold=50] - Kritik (ms/kadr)
   */
  constructor(options = {}) {
    this._sampleSize = options.sampleSize || 120;
    this._warningThreshold = options.warningThreshold || 33;   // < 30 FPS
    this._criticalThreshold = options.criticalThreshold || 50; // < 20 FPS

    // ── Frame timing ──
    this._frameTimes = [];           // Oxirgi N ta kadr vaqti (ms)
    this._lastFrameStart = 0;
    this._lastFrameEnd = 0;

    // ── Statistika ──
    this._stats = {
      fps: 0,
      avgFrameTime: 0,           // O'rtacha kadr vaqti (ms)
      minFrameTime: Infinity,    // Eng tez kadr
      maxFrameTime: 0,           // Eng sekin kadr
      p95FrameTime: 0,           // 95-persentil (eng yomon 5% ni qamraydi)
      p99FrameTime: 0,           // 99-persentil
      jitter: 0,                 // Kadr vaqti o'zgaruvchanligi (ms)
      droppedFrames: 0,          // "Tushirilgan" kadrlar (>33ms)
      totalFrames: 0,
    };

    // ── Holat ──
    this._status = 'good';          // 'good' | 'warning' | 'critical'
    this._lastStatusChange = 0;

    // ── GPU timer query (agar mavjud) ──
    this._gpuTimerExt = null;
    this._gpuQueries = [];
    this._gpuFrameTime = 0;

    // ── Xotira (taxminiy) ──
    this._memoryInfo = {
      jsHeap: 0,
      textureMemory: 0,
      geometryMemory: 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GPU TIMER SOZLASH
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * WebGL kontekstdan GPU timer extension'ni sozlash
   * Bu GPU'dagi haqiqiy render vaqtini o'lchash imkonini beradi
   *
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   */
  initGPUTimer(gl) {
    // WebGL2'da EXT_disjoint_timer_query_webgl2
    // WebGL1'da EXT_disjoint_timer_query
    this._gpuTimerExt =
      gl.getExtension('EXT_disjoint_timer_query_webgl2') ||
      gl.getExtension('EXT_disjoint_timer_query');

    if (this._gpuTimerExt) {
      console.log('✅ GPU timer query mavjud — aniq GPU vaqt o\'lchanadi');
    } else {
      console.log('⚠️  GPU timer query mavjud emas — taxminiy baholash');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // KADR O'LCHASH — har kadr boshida va oxirida
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Kadr boshida chaqirish
   */
  beginFrame() {
    this._lastFrameStart = performance.now();
  }

  /**
   * Kadr oxirida chaqirish — statistikani yangilash
   */
  endFrame() {
    this._lastFrameEnd = performance.now();
    const frameTime = this._lastFrameEnd - this._lastFrameStart;

    // Kadr vaqtini tarixga qo'shish
    this._frameTimes.push(frameTime);
    if (this._frameTimes.length > this._sampleSize) {
      this._frameTimes.shift();
    }

    this._stats.totalFrames++;

    // Tushirilgan kadr tekshirish
    if (frameTime > this._warningThreshold) {
      this._stats.droppedFrames++;
    }

    // Statistikani qayta hisoblash (har 10 kadrda)
    if (this._stats.totalFrames % 10 === 0) {
      this._recalculateStats();
    }
  }

  /** @private */
  _recalculateStats() {
    if (this._frameTimes.length === 0) return;

    const times = this._frameTimes;
    const n = times.length;

    // O'rtacha
    let sum = 0;
    let min = Infinity;
    let max = 0;
    for (let i = 0; i < n; i++) {
      sum += times[i];
      if (times[i] < min) min = times[i];
      if (times[i] > max) max = times[i];
    }
    this._stats.avgFrameTime = sum / n;
    this._stats.minFrameTime = min;
    this._stats.maxFrameTime = max;
    this._stats.fps = Math.round(1000 / this._stats.avgFrameTime);

    // Persentillar — tartiblangan massivdan
    const sorted = [...times].sort((a, b) => a - b);
    this._stats.p95FrameTime = sorted[Math.floor(n * 0.95)] || max;
    this._stats.p99FrameTime = sorted[Math.floor(n * 0.99)] || max;

    // Jitter — standart chetlanish
    let variance = 0;
    for (let i = 0; i < n; i++) {
      const diff = times[i] - this._stats.avgFrameTime;
      variance += diff * diff;
    }
    this._stats.jitter = Math.sqrt(variance / n);

    // Holat yangilash
    this._updateStatus();
  }

  /** @private */
  _updateStatus() {
    const prevStatus = this._status;

    if (this._stats.p95FrameTime > this._criticalThreshold) {
      this._status = 'critical';
    } else if (this._stats.p95FrameTime > this._warningThreshold) {
      this._status = 'warning';
    } else {
      this._status = 'good';
    }

    if (this._status !== prevStatus) {
      this._lastStatusChange = performance.now();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SIFAT TAVSIYASI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Hozirgi performance asosida sifat tavsiyasi
   *
   * @param {string} currentQuality - Hozirgi sifat darajasi
   * @returns {{action: string, reason: string, suggestedQuality: string}|null}
   *
   * action:
   *   'downgrade' — sifatni pasaytirish kerak
   *   'upgrade'   — sifatni oshirish mumkin
   *   null        — o'zgartirish kerak emas
   */
  getQualityRecommendation(currentQuality) {
    const qualityOrder = ['low', 'medium', 'high', 'ultra'];
    const currentIndex = qualityOrder.indexOf(currentQuality);

    // Kritik — pasaytirish kerak
    if (this._status === 'critical' && currentIndex > 0) {
      return {
        action: 'downgrade',
        reason: `P95 kadr vaqti ${this._stats.p95FrameTime.toFixed(1)}ms (>${this._criticalThreshold}ms)`,
        suggestedQuality: qualityOrder[currentIndex - 1],
      };
    }

    // Ogohlantirish — agar uzoq davom etsa pasaytirish
    if (this._status === 'warning' && currentIndex > 0) {
      const warningDuration = performance.now() - this._lastStatusChange;
      if (warningDuration > 5000) {  // 5 sekunddan ko'p
        return {
          action: 'downgrade',
          reason: `5+ soniya past FPS (${this._stats.fps} FPS)`,
          suggestedQuality: qualityOrder[currentIndex - 1],
        };
      }
    }

    // Yaxshi va barqaror — oshirish mumkinmi?
    if (this._status === 'good' && currentIndex < qualityOrder.length - 1) {
      const goodDuration = performance.now() - this._lastStatusChange;
      // 15 soniya barqaror yaxshi bo'lsa
      if (goodDuration > 15000 && this._stats.avgFrameTime < 12) {
        return {
          action: 'upgrade',
          reason: `Barqaror ${this._stats.fps} FPS, o'rtacha ${this._stats.avgFrameTime.toFixed(1)}ms`,
          suggestedQuality: qualityOrder[currentIndex + 1],
        };
      }
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // XOTIRA KUZATUVI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Xotira holatini yangilash
   *
   * @param {THREE.WebGLRenderer} [renderer] - Three.js renderer (info uchun)
   */
  updateMemoryInfo(renderer) {
    // JS heap (agar mavjud)
    if (performance.memory) {
      this._memoryInfo.jsHeap = Math.round(
        performance.memory.usedJSHeapSize / (1024 * 1024)
      );
    }

    // Three.js render info
    if (renderer && renderer.info) {
      const info = renderer.info;
      this._memoryInfo.textureMemory = info.memory ? info.memory.textures : 0;
      this._memoryInfo.geometryMemory = info.memory ? info.memory.geometries : 0;
      this._memoryInfo.programs = info.programs ? info.programs.length : 0;
      this._memoryInfo.drawCalls = info.render ? info.render.calls : 0;
      this._memoryInfo.triangles = info.render ? info.render.triangles : 0;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HUD DATA — diagnostik ma'lumotlar
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * HUD overlay uchun formatlangan ma'lumotlar
   *
   * @returns {Object}
   */
  getHUDData() {
    return {
      fps: this._stats.fps,
      frameTime: this._stats.avgFrameTime.toFixed(1),
      p95: this._stats.p95FrameTime.toFixed(1),
      jitter: this._stats.jitter.toFixed(1),
      status: this._status,
      dropped: this._stats.droppedFrames,
      gpuTime: this._gpuFrameTime > 0
        ? this._gpuFrameTime.toFixed(1)
        : 'n/a',
      memory: this._memoryInfo.jsHeap > 0
        ? `${this._memoryInfo.jsHeap} MB`
        : 'n/a',
    };
  }

  /**
   * To'liq diagnostika (console uchun)
   */
  getFullReport() {
    return {
      timing: { ...this._stats },
      status: this._status,
      memory: { ...this._memoryInfo },
      gpuTimer: !!this._gpuTimerExt,
      sampleSize: this._frameTimes.length,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERLAR
  // ─────────────────────────────────────────────────────────────────────────

  get fps() { return this._stats.fps; }
  get frameTime() { return this._stats.avgFrameTime; }
  get status() { return this._status; }
  get isGood() { return this._status === 'good'; }
  get isWarning() { return this._status === 'warning'; }
  get isCritical() { return this._status === 'critical'; }
  get droppedFrames() { return this._stats.droppedFrames; }

  // ─────────────────────────────────────────────────────────────────────────
  // TOZALASH
  // ─────────────────────────────────────────────────────────────────────────

  reset() {
    this._frameTimes.length = 0;
    this._stats.droppedFrames = 0;
    this._stats.totalFrames = 0;
    this._stats.minFrameTime = Infinity;
    this._stats.maxFrameTime = 0;
    this._status = 'good';
  }

  dispose() {
    this.reset();
    this._gpuTimerExt = null;
    this._gpuQueries.length = 0;
  }
}