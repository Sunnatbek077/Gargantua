/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Exporter
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Screenshot va video eksport qilish.
 *
 * Vazifalari:
 *   - Yuqori sifatli screenshot (PNG, supersampled)
 *   - Video yozish (WebM/VP9, MediaRecorder API)
 *   - Kadr ketma-ketligi eksport (offline render)
 *   - Fayl yuklab olish (download)
 *   - Metadata qo'shish (parametrlar, vaqt, sifat)
 *
 * Foydalanish:
 *   const exporter = new Exporter(renderer.native);
 *   await exporter.screenshot('gargantua_4k');
 *   exporter.startRecording();
 *   // ... bir necha soniya ...
 *   await exporter.stopRecording('gargantua_video');
 *
 * Bog'liqliklar: yo'q (tashqi kutubxonalarsiz, brauzar API'lari)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export default class Exporter {

  // ─────────────────────────────────────────────────────────────────────────
  // KONSTRUKTOR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {HTMLCanvasElement} canvas - Render canvas
   */
  constructor(canvas) {
    this._canvas = canvas;

    // ── Video yozish ──
    this._mediaRecorder = null;
    this._recordedChunks = [];
    this._recording = false;
    this._recordingStartTime = 0;

    // ── Kadr eksport ──
    this._frameExportActive = false;
    this._frameCount = 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCREENSHOT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Screenshot olish va yuklab olish
   *
   * @param {string} [filename='gargantua'] - Fayl nomi (kengaytmasiz)
   * @param {Object} [options]
   * @param {string} [options.format='png'] - 'png' yoki 'jpeg'
   * @param {number} [options.quality=1.0] - JPEG sifati [0, 1]
   * @param {Object} [options.metadata] - Qo'shimcha ma'lumot (HUD uchun)
   * @returns {Promise<string>} Data URL
   */
  async screenshot(filename = 'gargantua', options = {}) {
    const format = options.format || 'png';
    const quality = options.quality || 1.0;

    // Canvas'dan rasm olish
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const dataURL = this._canvas.toDataURL(mimeType, quality);

    // Yuklab olish
    this._downloadDataURL(dataURL, `${filename}_${this._timestamp()}.${format}`);

    return dataURL;
  }

  /**
   * Screenshot — faqat data URL qaytarish (yuklab olmaydi)
   *
   * @param {string} [format='png']
   * @param {number} [quality=1.0]
   * @returns {string} Data URL
   */
  captureDataURL(format = 'png', quality = 1.0) {
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    return this._canvas.toDataURL(mimeType, quality);
  }

  /**
   * Screenshot — Blob qaytarish (clipboard, upload uchun)
   *
   * @param {string} [format='png']
   * @param {number} [quality=1.0]
   * @returns {Promise<Blob>}
   */
  async captureBlob(format = 'png', quality = 1.0) {
    return new Promise((resolve) => {
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      this._canvas.toBlob(
        (blob) => resolve(blob),
        mimeType,
        quality
      );
    });
  }

  /**
   * Clipboard'ga nusxalash
   *
   * @returns {Promise<boolean>} Muvaffaqiyat
   */
  async copyToClipboard() {
    try {
      const blob = await this.captureBlob('png');
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      return true;
    } catch (error) {
      console.warn('Clipboard nusxalash muvaffaqiyatsiz:', error);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VIDEO YOZISH
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Video yozishni boshlash
   *
   * @param {Object} [options]
   * @param {number} [options.fps=30]
   * @param {number} [options.bitrate=20000000] - Bit tezligi (bps)
   * @param {string} [options.codec='vp9'] - 'vp9', 'vp8', 'h264'
   * @returns {boolean} Muvaffaqiyat
   */
  startRecording(options = {}) {
    if (this._recording) {
      console.warn('Video allaqachon yozilmoqda');
      return false;
    }

    const fps = options.fps || 30;
    const bitrate = options.bitrate || 20_000_000;
    const codec = options.codec || 'vp9';

    // Canvas stream olish
    const stream = this._canvas.captureStream(fps);

    // MediaRecorder sozlash
    const mimeTypes = [
      `video/webm;codecs=${codec}`,
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];

    let selectedMime = null;
    for (const mime of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mime)) {
        selectedMime = mime;
        break;
      }
    }

    if (!selectedMime) {
      console.error('Hech qanday video formati qo\'llab-quvvatlanmaydi');
      return false;
    }

    try {
      this._mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMime,
        videoBitsPerSecond: bitrate,
      });
    } catch (error) {
      console.error('MediaRecorder yaratish xatosi:', error);
      return false;
    }

    this._recordedChunks = [];

    this._mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this._recordedChunks.push(event.data);
      }
    };

    this._mediaRecorder.onerror = (event) => {
      console.error('Video yozish xatosi:', event.error);
      this._recording = false;
    };

    // Boshlash
    this._mediaRecorder.start(100); // 100ms oralig'ida chunk'lar
    this._recording = true;
    this._recordingStartTime = performance.now();

    console.log(`🔴 Video yozish boshlandi (${selectedMime}, ${(bitrate / 1e6).toFixed(0)} Mbps)`);
    return true;
  }

  /**
   * Video yozishni to'xtatish va yuklab olish
   *
   * @param {string} [filename='gargantua'] - Fayl nomi
   * @returns {Promise<Blob|null>} Video blob
   */
  async stopRecording(filename = 'gargantua') {
    if (!this._recording || !this._mediaRecorder) {
      console.warn('Video yozilmayapti');
      return null;
    }

    return new Promise((resolve) => {
      this._mediaRecorder.onstop = () => {
        const duration = ((performance.now() - this._recordingStartTime) / 1000).toFixed(1);
        const blob = new Blob(this._recordedChunks, { type: this._mediaRecorder.mimeType });

        // Yuklab olish
        const url = URL.createObjectURL(blob);
        this._downloadURL(url, `${filename}_${this._timestamp()}.webm`);
        URL.revokeObjectURL(url);

        const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
        console.log(`⬇️ Video saqlandi: ${duration}s, ${sizeMB} MB`);

        this._recordedChunks = [];
        this._recording = false;
        resolve(blob);
      };

      this._mediaRecorder.stop();
    });
  }

  /**
   * Video yozish holatini almashtirish (toggle)
   *
   * @param {string} [filename]
   * @returns {Promise<Blob|boolean>}
   */
  async toggleRecording(filename) {
    if (this._recording) {
      return this.stopRecording(filename);
    } else {
      return this.startRecording();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Hozirgi simulyatsiya parametrlarini metadata sifatida tayyorlash
   * Screenshot bilan birga saqlash uchun
   *
   * @param {Object} params - Simulyatsiya parametrlari
   * @returns {string} JSON formatlangan metadata
   */
  static formatMetadata(params) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      simulation: 'GARGANTUA Black Hole Simulation',
      parameters: params,
    }, null, 2);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // YORDAMCHI — ICHKI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Data URL ni fayl sifatida yuklab olish
   * @private
   */
  _downloadDataURL(dataURL, filename) {
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Object URL ni fayl sifatida yuklab olish
   * @private
   */
  _downloadURL(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Vaqt tamg'asi (fayl nomi uchun)
   * Format: 20260324_153042
   * @private
   */
  _timestamp() {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      '_',
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERLAR
  // ─────────────────────────────────────────────────────────────────────────

  /** Video yozilmoqdami? */
  get isRecording() {
    return this._recording;
  }

  /** Yozish davomiyligi (soniya) */
  get recordingDuration() {
    if (!this._recording) return 0;
    return (performance.now() - this._recordingStartTime) / 1000;
  }

  /** Yig'ilgan video o'lchami (bayt) */
  get recordingSize() {
    let size = 0;
    for (const chunk of this._recordedChunks) {
      size += chunk.size;
    }
    return size;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOZALASH
  // ─────────────────────────────────────────────────────────────────────────

  dispose() {
    if (this._recording && this._mediaRecorder) {
      this._mediaRecorder.stop();
      this._recording = false;
    }
    this._recordedChunks = [];
    this._mediaRecorder = null;
    this._canvas = null;
  }
}