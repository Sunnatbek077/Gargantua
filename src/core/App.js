/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Main Application
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Asosiy ilova — barcha modullarni birlashtiradi va boshqaradi.
 *
 * Arxitektura:
 *
 *   App (bu fayl)
 *    ├── Clock        — vaqt, delta, FPS
 *    ├── Camera       — kamera boshqaruvi, presetlar
 *    ├── Scene        — sahna, uniform'lar, texture'lar
 *    ├── Renderer     — WebGL render, HDR pipeline
 *    └── [keyinroq]
 *         ├── Physics     — Schwarzschild, Kerr, Geodesic
 *         ├── Shaders     — GLSL vertex + fragment
 *         ├── PostFX      — Bloom, HDR, Film Grain, ...
 *         ├── Objects     — BlackHole, AccretionDisk, ...
 *         └── Controls    — ParameterPanel, KeyboardShortcuts
 *
 * Render loop:
 *   1. clock.tick()               — vaqt yangilash
 *   2. camera.update()            — kamera pozitsiyasi
 *   3. scene.updateUniforms()     — shader parametrlari
 *   4. renderer.render()          — GPU render
 *   5. [adaptiveQuality check]    — sifat moslashtirish
 *
 * Bog'liqliklar: Three.js, barcha core/ modullari, barcha config/ fayllar
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import Clock from './Clock.js';
import Camera from './Camera.js';
import Scene from './Scene.js';
import Renderer from './Renderer.js';
import BloomPass from '../postprocessing/BloomPass.js';
import HDRPipeline from '../postprocessing/HDRPipeline.js';
import FilmGrain from '../postprocessing/FilmGrain.js';

export default class App {

  // ─────────────────────────────────────────────────────────────────────────
  // KONSTRUKTOR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {HTMLCanvasElement|string} canvasOrSelector
   *   Canvas element yoki CSS selector ('#canvas', '.render-target')
   *
   * @param {Object} [options] - Qo'shimcha sozlamalar
   * @param {string} [options.quality='medium'] - Boshlang'ich sifat
   * @param {boolean} [options.autoStart=true] - Avtomatik ishga tushirish
   * @param {string} [options.vertexShader] - GLSL vertex shader kodi
   * @param {string} [options.fragmentShader] - GLSL fragment shader kodi
   */
  constructor(canvasOrSelector, options = {}) {
    // ── Canvas topish ──
    if (typeof canvasOrSelector === 'string') {
      this._canvas = document.querySelector(canvasOrSelector);
      if (!this._canvas) {
        throw new Error(`Canvas "${canvasOrSelector}" topilmadi`);
      }
    } else {
      this._canvas = canvasOrSelector;
    }

    // ── Sozlamalar ──
    this._options = {
      quality: 'medium',
      autoStart: true,
      vertexShader: null,
      fragmentShader: null,
      ...options,
    };

    // ── Core modullar ──
    this._clock = new Clock();
    this._camera = new Camera(this._canvas);
    this._scene = new Scene();
    this._renderer = new Renderer(this._canvas);

    // ── Post-processing ──
    this._bloom = null;
    this._hdr = null;
    this._grain = null;
    this._postFX = null;
    this._lastRenderWidth = 0;
    this._lastRenderHeight = 0;

    // ── Render loop ──
    this._animationFrameId = null;
    this._running = false;

    // ── Sifat ──
    this._renderer.setQuality(this._options.quality);

    // ── Event callbacks ──
    this._onUpdateCallbacks = [];
    this._onReadyCallbacks = [];

    // ── Initialization ──
    this._initialized = false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INITSIALIZATSIYA
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Ilovani to'liq ishga tayyorlash
   *
   * Tartib:
   *   1. Shader'larni yuklash (agar berilmagan bo'lsa — placeholder)
   *   2. Texture'larni generatsiya qilish
   *   3. Sahnani qurish
   *   4. Ekran o'lchamini sozlash
   *   5. [options.autoStart = true bo'lsa] render loopni boshlash
   *
   * @param {Object} [shaders] - {vertex, fragment} GLSL kodlar
   * @returns {App} this (chaining uchun)
   */
  async init(shaders = {}) {
    if (this._initialized) {
      console.warn('App allaqachon ishga tushirilgan');
      return this;
    }

    const vertexShader = shaders.vertex
      || this._options.vertexShader
      || this._getPlaceholderVertexShader();

    const fragmentShader = shaders.fragment
      || this._options.fragmentShader
      || this._getPlaceholderFragmentShader();

    // ── Texture generatsiya ──
    this._scene.generateNoiseTexture(512);
    this._scene.generateStarfieldCubemap(1024);

    // ── Sahnani qurish ──
    this._scene.build(vertexShader, fragmentShader);

    // ── Ekran o'lchamini sozlash ──
    const size = this._renderer.renderSize;
    this._scene.updateResolution(size.width, size.height);

    // ── Post-processing pipeline ──
    const nativeRenderer = this._renderer.native;
    this._bloom = new BloomPass(nativeRenderer, size.width, size.height);
    this._bloom.setThreshold(0.4);   // Lower: more disk contributes, wider softer glow
    this._bloom.setIntensity(1.0);   // Pulled back to avoid blowing out inner disk
    this._hdr = new HDRPipeline(nativeRenderer);
    this._hdr.setExposure(1.4);      // Reduced: recover highlight detail in hot regions
    this._grain = new FilmGrain(nativeRenderer);
    this._lastRenderWidth = size.width;
    this._lastRenderHeight = size.height;

    // Pipeline orchestrator — called by Renderer.renderWithPostFX
    this._postFX = {
      process: (renderer, targets, width, height) => {
        const elapsed = this._clock.elapsed;

        // 1. Bloom: main → post (scene + bloom, still HDR)
        if (this._bloom.enabled) {
          this._bloom.render(targets.main, targets.post);
        }

        // 2. Tone mapping + vignette: HDR → SDR
        const tmIn = this._bloom.enabled ? targets.post : targets.main;
        const grainEnabled = this._grain.enabled;
        if (grainEnabled) {
          // Tone map to intermediate, grain will output to screen
          const tmOut = (tmIn === targets.post) ? targets.main : targets.post;
          this._hdr.render(tmIn, tmOut);
          // 3. Film grain → screen
          this._grain.render(tmOut, null, elapsed);
        } else {
          // Tone map directly to screen
          this._hdr.render(tmIn, null);
        }
      }
    };

    // ── Tayyor ──
    this._initialized = true;

    // Ready callback'larni chaqirish
    this._onReadyCallbacks.forEach(cb => cb(this));
    this._onReadyCallbacks.length = 0;

    // Avtomatik boshlash
    if (this._options.autoStart) {
      this.start();
    }

    console.log(
      '%c🌀 GARGANTUA initialized',
      'color: #ffaa50; font-weight: bold; font-size: 14px;'
    );
    console.log('   GPU:', this._renderer.gpuInfo.renderer);
    console.log('   Quality:', this._renderer.quality);
    console.log('   Resolution:', `${size.width}×${size.height}`);

    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER LOOP
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Render loop'ni boshlash
   */
  start() {
    if (this._running) return this;
    if (!this._initialized) {
      console.warn('Avval init() chaqiring');
      return this;
    }

    this._clock.start();
    this._running = true;
    this._loop();

    return this;
  }

  /**
   * Render loop'ni to'xtatish
   */
  stop() {
    this._running = false;
    this._clock.stop();

    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }

    return this;
  }

  /**
   * Pauza
   */
  pause() {
    this._clock.pause();
    return this;
  }

  /**
   * Davom ettirish
   */
  resume() {
    this._clock.resume();
    return this;
  }

  /**
   * Asosiy render loop
   *
   * @private
   * @param {number} timestamp - requestAnimationFrame timestamp
   */
  _loop(timestamp) {
    if (!this._running) return;

    // 1. Vaqt yangilash
    this._clock.tick(timestamp);

    const delta = this._clock.deltaUnscaled;
    const elapsed = this._clock.elapsed;
    const cameraDistance = this._camera.distanceToTarget;

    // 2. Kamera yangilash
    this._camera.update(delta, elapsed, cameraDistance);

    // 3. Shader uniform'larni yangilash
    this._scene.updateTimeUniforms(this._clock);
    this._scene.updateCameraUniforms(this._camera);

    // 4. Tashqi update callback'lar
    for (let i = 0; i < this._onUpdateCallbacks.length; i++) {
      this._onUpdateCallbacks[i](delta, elapsed, this);
    }

    // 5. Render with HDR bloom pipeline
    this._renderer.renderWithPostFX(
      this._scene.native,
      this._camera.native,
      this._postFX
    );

    // 5b. Resize bloom if render size changed
    const currentSize = this._renderer.renderSize;
    if (this._lastRenderWidth !== currentSize.width || this._lastRenderHeight !== currentSize.height) {
      this._bloom.resize(currentSize.width, currentSize.height);
      this._lastRenderWidth = currentSize.width;
      this._lastRenderHeight = currentSize.height;
    }

    // 6. Adaptiv sifat tekshiruv
    const newQuality = this._renderer.adaptQuality(
      this._clock.fps,
      this._clock.elapsedUnscaled * 1000
    );
    if (newQuality) {
      this._scene.applyQualityPreset(this._renderer.qualityPreset);
      const size = this._renderer.renderSize;
      this._scene.updateResolution(size.width, size.height);
      console.log(`⚡ Sifat moslashtirish: ${newQuality}`);
    }

    // Keyingi kadr
    this._animationFrameId = requestAnimationFrame((t) => this._loop(t));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TASHQI API — boshqaruv
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Kamera presetiga o'tish
   * @param {string} presetName - 'wide', 'edgeOn', 'polar', 'approach', 'horizon', 'behind'
   */
  setCameraPreset(presetName) {
    this._camera.transitionToPreset(presetName);
    return this;
  }

  /**
   * Kinematografik kamera yo'lini ishga tushirish
   * @param {string} pathName - 'discovery', 'orbit', 'dive'
   */
  playCinematic(pathName) {
    this._camera.playCinematicPath(pathName);
    return this;
  }

  /**
   * Kinematografik yo'lni to'xtatish
   */
  stopCinematic() {
    this._camera.stopCinematicPath();
    return this;
  }

  /**
   * Qora tuynuk parametrlarini o'zgartirish
   * @param {Object} params - {spin, mass, ...}
   */
  setBlackHoleParams(params) {
    this._scene.updateBlackHoleParams(params);
    return this;
  }

  /**
   * Post-processing parametrlarini o'zgartirish
   * @param {Object} params - {dopplerEnabled, beamingExponent, ...}
   */
  setPostFXParams(params) {
    this._scene.updatePostFXParams(params);
    return this;
  }

  /**
   * Sifat darajasini o'zgartirish
   * @param {string} quality - 'low', 'medium', 'high', 'ultra'
   */
  setQuality(quality) {
    this._renderer.setQuality(quality);
    this._scene.applyQualityPreset(this._renderer.qualityPreset);
    const size = this._renderer.renderSize;
    this._scene.updateResolution(size.width, size.height);
    return this;
  }

  /**
   * Vaqt masshtabini o'zgartirish (time dilation)
   * @param {number} scale - 0.0 = to'xtagan, 1.0 = normal
   */
  setTimeScale(scale) {
    this._clock.setTimeScale(scale);
    return this;
  }

  /**
   * Shader'larni almashtirish (runtime hot-reload)
   * @param {string} vertexShader - Yangi vertex shader
   * @param {string} fragmentShader - Yangi fragment shader
   */
  updateShaders(vertexShader, fragmentShader) {
    if (this._scene.material) {
      this._scene.material.vertexShader = vertexShader;
      this._scene.material.fragmentShader = fragmentShader;
      this._scene.material.needsUpdate = true;
    }
    return this;
  }

  /**
   * Screenshot olish
   * @param {string} [filename='gargantua'] - Fayl nomi
   */
  async screenshot(filename) {
    return this._renderer.downloadScreenshot(filename);
  }

  /**
   * Video yozishni boshlash/to'xtatish
   * @param {string} [filename='gargantua'] - Fayl nomi
   */
  async toggleRecording(filename) {
    if (this._renderer.isRecording) {
      return this._renderer.stopRecording(filename);
    } else {
      this._renderer.startRecording();
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVENT CALLBACK'LAR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Har kadr chaqiriladigan callback qo'shish
   * @param {Function} callback - callback(delta, elapsed, app)
   */
  onUpdate(callback) {
    this._onUpdateCallbacks.push(callback);
    return this;
  }

  /**
   * Ilova tayyor bo'lganda chaqiriladigan callback
   * @param {Function} callback - callback(app)
   */
  onReady(callback) {
    if (this._initialized) {
      callback(this);
    } else {
      this._onReadyCallbacks.push(callback);
    }
    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PLACEHOLDER SHADER'LAR
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Haqiqiy shader'lar yuklanguncha ko'rsatiladigan
  // soddalashtirilgan qora tuynuk effekti
  // ─────────────────────────────────────────────────────────────────────────

  /** @private */
  _getPlaceholderVertexShader() {
    return /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;
  }

  /** @private */
  _getPlaceholderFragmentShader() {
    return /* glsl */ `
      precision highp float;

      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec3 u_cameraPos;
      uniform vec3 u_cameraDir;
      uniform vec3 u_cameraRight;
      uniform vec3 u_cameraUp;
      uniform float u_focalLength;
      uniform float u_aspectRatio;
      uniform float u_Rs;
      uniform float u_spin;
      uniform float u_diskInnerRadius;
      uniform float u_diskOuterRadius;

      varying vec2 vUv;

      // ── Formula #34: Ray generation ──
      vec3 getRayDirection(vec2 uv) {
        vec2 ndc = (uv - 0.5) * 2.0;
        ndc.x *= u_aspectRatio;
        return normalize(
          u_cameraRight * ndc.x +
          u_cameraUp * ndc.y +
          u_cameraDir * u_focalLength
        );
      }

      void main() {
        vec3 rayDir = getRayDirection(vUv);
        vec3 rayPos = u_cameraPos;

        float Rs = u_Rs;
        vec3 color = vec3(0.0);

        // Soddalashtirilgan ray marching
        float stepSize = 0.1;
        for (int i = 0; i < 200; i++) {
          float r = length(rayPos);

          // Gravitatsion tezlanish (Formula #6 soddalashtirilgan)
          vec3 gravity = -normalize(rayPos) * 1.5 / (r * r);
          rayDir = normalize(rayDir + gravity * stepSize);
          rayPos += rayDir * stepSize;

          // Qora tuynukka tushdi
          if (r < Rs * 0.5) {
            color = vec3(0.0);
            break;
          }

          // Accretion disk kesishish
          if (abs(rayPos.y) < 0.1 && r > u_diskInnerRadius && r < u_diskOuterRadius) {
            float diskR = (r - u_diskInnerRadius) / (u_diskOuterRadius - u_diskInnerRadius);
            float temp = pow(1.0 - diskR, 0.75);

            // Rang: issiq (oq) → sovuq (qizil)
            vec3 diskColor = mix(
              vec3(0.8, 0.15, 0.02),  // Tashqi - qizil
              vec3(1.0, 0.9, 0.7),    // Ichki - oq
              temp
            );

            // Yorqinlik
            float brightness = temp * 2.0;
            color += diskColor * brightness * 0.5;
          }

          // Uzoqlashdi — yulduzlar
          if (r > 50.0) {
            // Oddiy yulduz foni
            float stars = step(0.998, fract(sin(dot(rayDir.xy, vec2(12.9898,78.233))) * 43758.5453));
            color += vec3(stars * 0.5);
            break;
          }
        }

        // Foton halqasi porlashi
        float rFinal = length(rayPos);
        if (rFinal > Rs * 1.4 && rFinal < Rs * 1.6) {
          color += vec3(1.0, 0.7, 0.3) * 0.3;
        }

        // Soddalashtirilgan tone mapping
        color = color / (color + vec3(1.0));

        // Gamma (Formula #37)
        color = pow(color, vec3(1.0 / 2.2));

        gl_FragColor = vec4(color, 1.0);
      }
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERLAR
  // ─────────────────────────────────────────────────────────────────────────

  /** Clock moduli */
  get clock() { return this._clock; }

  /** Camera moduli */
  get camera() { return this._camera; }

  /** Scene moduli */
  get scene() { return this._scene; }

  /** Renderer moduli */
  get renderer() { return this._renderer; }

  /** Ilova ishlayaptimi? */
  get running() { return this._running; }

  /** Ilova tayyor bo'lganmi? */
  get initialized() { return this._initialized; }

  /** Hozirgi FPS */
  get fps() { return this._clock.fps; }

  /** Hozirgi sifat darajasi */
  get quality() { return this._renderer.quality; }

  /** Kamera presetlari ro'yxati */
  get cameraPresets() { return this._camera.presetNames; }

  /** Kinematografik yo'llar ro'yxati */
  get cinematicPaths() { return this._camera.cinematicPathNames; }

  /** Diagnostik ma'lumotlar */
  get debugInfo() {
    return {
      ...this._clock.getDebugInfo(),
      quality: this._renderer.quality,
      resolution: this._renderer.renderSize,
      gpu: this._renderer.gpuInfo.renderer,
      cameraDistance: this._camera.distanceToTarget.toFixed(2),
      recording: this._renderer.isRecording,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOZALASH
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Barcha resurslarni tozalash
   * Sahifadan chiqishda yoki qayta ishga tushirishda
   */
  dispose() {
    this.stop();
    if (this._bloom) this._bloom.dispose();
    if (this._hdr) this._hdr.dispose();
    if (this._grain) this._grain.dispose();
    this._scene.dispose();
    this._camera.dispose();
    this._renderer.dispose();
    this._clock.dispose();
    this._onUpdateCallbacks.length = 0;
    this._onReadyCallbacks.length = 0;
    this._initialized = false;

    console.log('%c🌀 GARGANTUA disposed', 'color: #666;');
  }
}