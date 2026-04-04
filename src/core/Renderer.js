/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Renderer
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Three.js WebGL render pipeline boshqaruvi.
 *
 * Vazifalari:
 *   - WebGLRenderer yaratish va sozlash
 *   - HDR render target'lar boshqaruvi
 *   - Multi-pass render pipeline
 *   - Ekran o'lcham boshqaruvi (resize)
 *   - Adaptiv sifat (FPS monitoring)
 *   - Screenshot va video eksport
 *
 * Render pipeline:
 *   Pass 1 → Ray marching (asosiy shader) → HDR buffer
 *   Pass 2 → Post-processing chain       → Ekran
 *
 * Formulalar:
 *   #26 — ACES tone mapping (render config orqali)
 *   #37 — Gamma korreksiya (output)
 *
 * Bog'liqliklar: Three.js, RenderConfig
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import RenderConfig from '../../config/render.config.js';

export default class Renderer {

  // ─────────────────────────────────────────────────────────────────────────
  // KONSTRUKTOR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {HTMLCanvasElement} canvas - Render canvas
   */
  constructor(canvas) {
    this._canvas = canvas;
    this._config = RenderConfig;

    // ── WebGL Renderer ──
    this._renderer = this._createRenderer(canvas);

    // ── Ekran o'lchamlari ──
    this._width = canvas.clientWidth;
    this._height = canvas.clientHeight;
    this._pixelRatio = this._renderer.getPixelRatio();
    this._renderWidth = this._width * this._pixelRatio;
    this._renderHeight = this._height * this._pixelRatio;

    // ── HDR Render Target'lar ──
    this._renderTargets = {};
    this._createRenderTargets();

    // ── Sifat darajasi ──
    this._currentQuality = this._config.defaultQuality;
    this._qualityPreset = this._config.qualityPresets[this._currentQuality];

    // ── Adaptiv sifat ──
    this._adaptiveQuality = {
      lastCheck: 0,
      lowFPSFrames: 0,
      threshold: 30,  // Ketma-ket past FPS kadrlar
    };

    // ── Screenshot holati ──
    this._screenshotRequested = false;
    this._screenshotCallback = null;

    // ── Video eksport holati ──
    this._recording = false;
    this._mediaRecorder = null;
    this._recordedChunks = [];

    // ── Resize kuzatuvchisi ──
    this._resizeObserver = new ResizeObserver(() => this._onResize());
    this._resizeObserver.observe(canvas);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDERER YARATISH
  // ─────────────────────────────────────────────────────────────────────────

  /** @private */
  _createRenderer(canvas) {
    const cfg = this._config.renderer;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: cfg.antialias,
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,   // Screenshot uchun kerak
      powerPreference: cfg.powerPreference,
      logarithmicDepthBuffer: cfg.logarithmicDepthBuffer,
    });

    // Piksel nisbati
    if (cfg.pixelRatio === 'auto') {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, cfg.maxPixelRatio));
    } else {
      renderer.setPixelRatio(Math.min(cfg.pixelRatio, cfg.maxPixelRatio));
    }

    // O'lcham
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

    // Rang makon
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Tone mapping — shader ichida qo'lda qilamiz, Three.js'nikini o'chiramiz
    renderer.toneMapping = THREE.NoToneMapping;

    // Fon rangi
    renderer.setClearColor(cfg.clearColor, cfg.clearAlpha);

    return renderer;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER TARGET'LAR (Off-screen buffer'lar)
  // ─────────────────────────────────────────────────────────────────────────

  /** @private */
  _createRenderTargets() {
    const cfg = this._config.renderTargets;

    // ── Asosiy HDR buffer ──
    // Ray marching natijasi shu yerga yoziladi
    this._renderTargets.main = this._createTarget(
      cfg.main.scale,
      THREE.HalfFloatType
    );

    // ── Post-processing intermediate buffer (full resolution) ──
    // Bloom composite yoziladi, keyin tone mapping o'qiydi
    this._renderTargets.post = this._createTarget(
      cfg.main.scale,
      THREE.HalfFloatType
    );

    // ── Bloom: Yorqin piksellar ──
    this._renderTargets.bright = this._createTarget(
      cfg.bright.scale,
      THREE.HalfFloatType
    );

    // ── Bloom: Blur buffer'lar (ping-pong) ──
    this._renderTargets.blurA = this._createTarget(
      cfg.blur.scale,
      THREE.HalfFloatType
    );
    this._renderTargets.blurB = this._createTarget(
      cfg.blur.scale,
      THREE.HalfFloatType
    );
  }

  /**
   * Render target yaratish
   *
   * @private
   * @param {number} scale - Ekran o'lchamiga nisbatan (0.5 = yarim)
   * @param {number} type - THREE.HalfFloatType yoki THREE.FloatType
   * @returns {THREE.WebGLRenderTarget}
   */
  _createTarget(scale, type) {
    const w = Math.max(1, Math.floor(this._renderWidth * scale));
    const h = Math.max(1, Math.floor(this._renderHeight * scale));

    return new THREE.WebGLRenderTarget(w, h, {
      format: THREE.RGBAFormat,
      type: type,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: false,
      stencilBuffer: false,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — har kadr chaqiriladi
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Sahnani render qilish
   *
   * @param {THREE.Scene} scene - Three.js sahna
   * @param {THREE.Camera} camera - Three.js kamera
   */
  render(scene, camera) {
    // ── Pass 1: Asosiy ray marching → HDR buffer ──
    // Hozircha to'g'ridan-to'g'ri ekranga render qilamiz
    // Post-processing qo'shilganda render target'ga yo'naltiriladi
    this._renderer.render(scene, camera);

    // ── Screenshot tekshiruv ──
    if (this._screenshotRequested) {
      this._captureScreenshot();
      this._screenshotRequested = false;
    }
  }

  /**
   * Multi-pass render (post-processing bilan)
   * Post-processing modullar tayyor bo'lganda ishlatiladi
   *
   * @param {THREE.Scene} scene - Sahna
   * @param {THREE.Camera} camera - Kamera
   * @param {Object} postFX - Post-processing modullari
   */
  renderWithPostFX(scene, camera, postFX) {
    const renderer = this._renderer;
    const targets = this._renderTargets;

    // Pass 1: Ray marching → HDR buffer
    renderer.setRenderTarget(targets.main);
    renderer.render(scene, camera);

    // Pass 2-N: Post-processing chain
    if (postFX && postFX.process) {
      postFX.process(renderer, targets, this._renderWidth, this._renderHeight);
    }

    // Yakuniy: ekranga chiqarish
    renderer.setRenderTarget(null);

    // Screenshot
    if (this._screenshotRequested) {
      this._captureScreenshot();
      this._screenshotRequested = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EKRAN O'LCHAM BOSHQARUVI
  // ─────────────────────────────────────────────────────────────────────────

  /** @private */
  _onResize() {
    this._width = this._canvas.clientWidth;
    this._height = this._canvas.clientHeight;

    if (this._width === 0 || this._height === 0) return;

    this._pixelRatio = this._renderer.getPixelRatio();

    // Sifat darajasiga qarab resolution scale
    const resolutionScale = this._qualityPreset.resolution;
    this._renderWidth = Math.floor(this._width * this._pixelRatio * resolutionScale);
    this._renderHeight = Math.floor(this._height * this._pixelRatio * resolutionScale);

    // Renderer o'lchamini yangilash
    this._renderer.setSize(this._width, this._height, false);

    // Render target'larni qayta yaratish
    this._disposeRenderTargets();
    this._createRenderTargets();
  }

  /** @private */
  _disposeRenderTargets() {
    Object.values(this._renderTargets).forEach(target => {
      if (target) target.dispose();
    });
    this._renderTargets = {};
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADAPTIV SIFAT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * FPS asosida sifat darajasini avtomatik moslashtirish
   *
   * @param {number} currentFPS - Hozirgi FPS
   * @param {number} elapsed - Umumiy vaqt (ms)
   * @returns {string|null} O'zgargan sifat nomi yoki null
   */
  adaptQuality(currentFPS, elapsed) {
    const perfConfig = this._config.performance;
    if (!perfConfig.adaptiveQuality) return null;

    // Tekshirish oralig'i
    if (elapsed - this._adaptiveQuality.lastCheck < perfConfig.qualityCheckInterval) {
      return null;
    }
    this._adaptiveQuality.lastCheck = elapsed;

    // FPS past bo'lsa, ketma-ket kadrlarni hisoblash
    if (currentFPS < perfConfig.minAcceptableFPS) {
      this._adaptiveQuality.lowFPSFrames++;
    } else {
      this._adaptiveQuality.lowFPSFrames = Math.max(0, this._adaptiveQuality.lowFPSFrames - 1);
    }

    // Yetarlicha past kadrlar to'planganda sifatni pasaytirish
    if (this._adaptiveQuality.lowFPSFrames >= this._adaptiveQuality.threshold) {
      const newQuality = this._downgradeQuality();
      if (newQuality) {
        this._adaptiveQuality.lowFPSFrames = 0;
        return newQuality;
      }
    }

    return null;
  }

  /** @private */
  _downgradeQuality() {
    const order = ['ultra', 'high', 'medium', 'low'];
    const currentIndex = order.indexOf(this._currentQuality);

    if (currentIndex < order.length - 1) {
      const newQuality = order[currentIndex + 1];
      this.setQuality(newQuality);
      return newQuality;
    }

    return null;
  }

  /**
   * Sifat darajasini qo'lda o'rnatish
   *
   * @param {string} qualityName - 'low', 'medium', 'high', 'ultra'
   */
  setQuality(qualityName) {
    const preset = this._config.qualityPresets[qualityName];
    if (!preset) {
      console.warn(`Sifat darajasi "${qualityName}" topilmadi`);
      return;
    }

    this._currentQuality = qualityName;
    this._qualityPreset = preset;

    // Resize bilan yangi resolution qo'llash
    this._onResize();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCREENSHOT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Screenshot olish (keyingi kadrda)
   *
   * @param {Function} [callback] - callback(dataURL) — natija
   * @returns {Promise<string>} Data URL (PNG)
   */
  takeScreenshot(callback) {
    return new Promise((resolve) => {
      this._screenshotRequested = true;
      this._screenshotCallback = (dataURL) => {
        if (callback) callback(dataURL);
        resolve(dataURL);
      };
    });
  }

  /** @private */
  _captureScreenshot() {
    const cfg = this._config.renderer;
    const canvas = this._renderer.domElement;
    const dataURL = canvas.toDataURL(
      `image/${RenderConfig.qualityPresets ? 'png' : 'png'}`,
      1.0
    );

    if (this._screenshotCallback) {
      this._screenshotCallback(dataURL);
      this._screenshotCallback = null;
    }
  }

  /**
   * Screenshotni fayl sifatida yuklab olish
   *
   * @param {string} [filename='gargantua'] - Fayl nomi
   */
  async downloadScreenshot(filename = 'gargantua') {
    const dataURL = await this.takeScreenshot();
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `${filename}_${Date.now()}.png`;
    link.click();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VIDEO EKSPORT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Video yozishni boshlash
   */
  startRecording() {
    if (this._recording) return;

    const canvas = this._renderer.domElement;
    const stream = canvas.captureStream(30); // 30 FPS

    try {
      this._mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 20_000_000,
      });
    } catch (e) {
      // VP9 qo'llab-quvvatlanmasa, oddiy webm
      this._mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm',
        videoBitsPerSecond: 10_000_000,
      });
    }

    this._recordedChunks = [];

    this._mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this._recordedChunks.push(event.data);
      }
    };

    this._mediaRecorder.start(100); // 100ms chunk'lar
    this._recording = true;
  }

  /**
   * Video yozishni to'xtatish va yuklab olish
   *
   * @param {string} [filename='gargantua'] - Fayl nomi
   * @returns {Promise<Blob>} Video blob
   */
  stopRecording(filename = 'gargantua') {
    return new Promise((resolve) => {
      if (!this._recording || !this._mediaRecorder) {
        resolve(null);
        return;
      }

      this._mediaRecorder.onstop = () => {
        const blob = new Blob(this._recordedChunks, { type: 'video/webm' });

        // Avtomatik yuklab olish
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}_${Date.now()}.webm`;
        link.click();
        URL.revokeObjectURL(url);

        this._recordedChunks = [];
        this._recording = false;
        resolve(blob);
      };

      this._mediaRecorder.stop();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERLAR
  // ─────────────────────────────────────────────────────────────────────────

  /** Three.js WebGLRenderer */
  get native() {
    return this._renderer;
  }

  /** Render target'lar */
  get renderTargets() {
    return this._renderTargets;
  }

  /** Hozirgi sifat darajasi nomi */
  get quality() {
    return this._currentQuality;
  }

  /** Hozirgi sifat preset ob'ekti */
  get qualityPreset() {
    return this._qualityPreset;
  }

  /** Render o'lchami (piksel) */
  get renderSize() {
    return { width: this._renderWidth, height: this._renderHeight };
  }

  /** Ekran o'lchami (CSS piksel) */
  get displaySize() {
    return { width: this._width, height: this._height };
  }

  /** Piksel nisbati */
  get pixelRatio() {
    return this._pixelRatio;
  }

  /** Video yozilmoqdami? */
  get isRecording() {
    return this._recording;
  }

  /** GPU ma'lumotlari */
  get gpuInfo() {
    try {
      if (this._renderer.isWebGPURenderer) {
        return {
          vendor: 'WebGPU',
          renderer: 'WebGPU API',
          maxTextureSize: 'N/A',
          maxVaryings: 'N/A',
        };
      }
      
      const gl = this._renderer.getContext();
      if (!gl) return { vendor: 'Unknown', renderer: 'Unknown', maxTextureSize: 'Unknown', maxVaryings: 'Unknown' };
      
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'Unknown',
        renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown',
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        maxVaryings: gl.getParameter(gl.MAX_VARYING_VECTORS),
      };
    } catch (e) {
      return {
        vendor: 'WebGPU/Unknown',
        renderer: 'WebGPU/Unknown',
        maxTextureSize: 'Unknown',
        maxVaryings: 'Unknown',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOZALASH
  // ─────────────────────────────────────────────────────────────────────────

  dispose() {
    // Video yozishni to'xtatish
    if (this._recording) {
      this._mediaRecorder.stop();
      this._recording = false;
    }

    // Render target'larni tozalash
    this._disposeRenderTargets();

    // Resize kuzatuvchisini to'xtatish
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }

    // Renderer'ni tozalash
    this._renderer.dispose();
    this._renderer = null;
    this._canvas = null;
  }
}