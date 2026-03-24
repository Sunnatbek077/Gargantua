/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Texture Loader
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Texture yuklash, cache'lash va procedural generatsiya.
 *
 * Vazifalari:
 *   - 2D texture yuklash (PNG, JPG, HDR)
 *   - Cubemap yuklash (6 yuz — yulduzli osmon)
 *   - Procedural texture generatsiya (fallback)
 *   - Yuklash progressini kuzatish
 *   - Xotira boshqaruvi (dispose)
 *
 * Simulyatsiyada ishlatiladigan texture'lar:
 *   - Yulduzli osmon cubemap (lensing uchun fon)
 *   - Noise texture (accretion disk tuzilmasi)
 *   - Lens dirt texture (post-processing)
 *   - Dust particle sprite (zarralar)
 *
 * Bog'liqliklar: Three.js
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';

export default class TextureLoader {

  // ─────────────────────────────────────────────────────────────────────────
  // KONSTRUKTOR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {string} [basePath='assets/textures/'] - Texture fayllar papkasi
   */
  constructor(basePath = 'assets/textures/') {
    this._basePath = basePath.endsWith('/') ? basePath : basePath + '/';
    this._cache = new Map();
    this._threeLoader = new THREE.TextureLoader();
    this._cubeLoader = new THREE.CubeTextureLoader();

    // Yuklash progressi
    this._totalToLoad = 0;
    this._loaded = 0;
    this._onProgressCallbacks = [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2D TEXTURE YUKLASH
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 2D texture yuklash
   *
   * @param {string} filename - Fayl nomi
   * @param {Object} [options] - Qo'shimcha sozlamalar
   * @param {string} [options.wrapS='RepeatWrapping']
   * @param {string} [options.wrapT='RepeatWrapping']
   * @param {boolean} [options.generateMipmaps=true]
   * @returns {Promise<THREE.Texture>}
   */
  async load2D(filename, options = {}) {
    if (this._cache.has(filename)) {
      return this._cache.get(filename);
    }

    this._totalToLoad++;

    return new Promise((resolve, reject) => {
      const url = this._basePath + filename;

      this._threeLoader.load(
        url,
        (texture) => {
          // Sozlamalar
          texture.wrapS = THREE[options.wrapS || 'RepeatWrapping'];
          texture.wrapT = THREE[options.wrapT || 'RepeatWrapping'];
          texture.generateMipmaps = options.generateMipmaps !== false;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;

          if (options.encoding) {
            texture.colorSpace = THREE[options.encoding];
          }

          this._cache.set(filename, texture);
          this._loaded++;
          this._emitProgress();
          resolve(texture);
        },
        undefined,
        (error) => {
          console.warn(`Texture "${filename}" yuklanmadi, procedural fallback ishlatiladi`);
          this._loaded++;
          this._emitProgress();
          // Fallback: procedural texture
          const fallback = this.generateFallbackTexture();
          this._cache.set(filename, fallback);
          resolve(fallback);
        }
      );
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CUBEMAP YUKLASH
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 6 yuzli cubemap texture yuklash (yulduzli osmon)
   *
   * @param {string} folder - Cubemap papkasi ('cubemaps/milkyway/')
   * @param {string[]} [faces] - Yuz nomlari
   * @returns {Promise<THREE.CubeTexture>}
   */
  async loadCubemap(folder, faces) {
    const cacheKey = `cubemap:${folder}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const faceNames = faces || ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
    const urls = faceNames.map(f => `${this._basePath}${folder}${f}.jpg`);

    this._totalToLoad++;

    return new Promise((resolve, reject) => {
      this._cubeLoader.load(
        urls,
        (cubemap) => {
          this._cache.set(cacheKey, cubemap);
          this._loaded++;
          this._emitProgress();
          resolve(cubemap);
        },
        undefined,
        (error) => {
          console.warn(`Cubemap "${folder}" yuklanmadi, procedural fallback`);
          this._loaded++;
          this._emitProgress();
          // Fallback: procedural starfield
          const fallback = this.generateStarfieldCubemap(1024);
          this._cache.set(cacheKey, fallback);
          resolve(fallback);
        }
      );
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROCEDURAL TEXTURE GENERATSIYA
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Tashqi fayllar yuklanmasa — runtime'da generatsiya qilish.
  // Bu loyiha hech qanday tashqi resursga bog'liq bo'lmasligini ta'minlaydi.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Procedural noise texture generatsiya qilish
   *
   * Accretion disk tuzilmasi uchun — FBM noise
   * RGBA: R,G,B = turli chastotadagi noise, A = 1.0
   *
   * @param {number} [size=512]
   * @returns {THREE.DataTexture}
   */
  generateNoiseTexture(size = 512) {
    const cacheKey = `proc:noise:${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const data = new Uint8Array(size * size * 4);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        // Turli seed'lar bilan 3 kanal
        data[i]     = (this._hashNoise(x * 0.1, y * 0.1, 0.0) * 0.5 + 0.5) * 255;
        data[i + 1] = (this._hashNoise(x * 0.1, y * 0.1, 1.7) * 0.5 + 0.5) * 255;
        data[i + 2] = (this._hashNoise(x * 0.1, y * 0.1, 3.1) * 0.5 + 0.5) * 255;
        data[i + 3] = 255;
      }
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;

    this._cache.set(cacheKey, texture);
    return texture;
  }

  /**
   * Procedural yulduzli osmon cubemap
   *
   * Realstik yulduz taqsimoti:
   *   - Ko'pchilik yulduzlar xira (magnitude taqsimoti)
   *   - Turli ranglar (temperaturaga bog'liq)
   *   - Ba'zi yorqin yulduzlarda glow
   *
   * @param {number} [size=1024]
   * @returns {THREE.CubeTexture}
   */
  generateStarfieldCubemap(size = 1024) {
    const cacheKey = `proc:starfield:${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const faces = [];

    for (let face = 0; face < 6; face++) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      // Qora fon
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, size, size);

      // Yulduz soni — haqiqiyga yaqin zichlik
      const starCount = 2500 + Math.floor(this._seededRandom(face * 1000) * 2500);

      for (let s = 0; s < starCount; s++) {
        const seed = face * 10000 + s;
        const x = this._seededRandom(seed) * size;
        const y = this._seededRandom(seed + 7777) * size;

        // Yorqinlik — eksponensial taqsimot (ko'pchiligi xira)
        const rawBrightness = this._seededRandom(seed + 3333);
        const brightness = Math.pow(rawBrightness, 4.0);
        const radius = brightness * 1.8 + 0.2;

        // Yulduz rangi — spektral sinf
        const spectralSeed = this._seededRandom(seed + 5555);
        let r, g, b;
        if (spectralSeed < 0.1) {
          // O sinf — ko'k (issiq)
          r = 0.6 + brightness * 0.2;
          g = 0.7 + brightness * 0.2;
          b = 1.0;
        } else if (spectralSeed < 0.2) {
          // B sinf — ko'k-oq
          r = 0.75 + brightness * 0.2;
          g = 0.85 + brightness * 0.15;
          b = 1.0;
        } else if (spectralSeed < 0.5) {
          // A/F sinf — oq
          r = 1.0;
          g = 0.98;
          b = 0.92 + brightness * 0.08;
        } else if (spectralSeed < 0.7) {
          // G sinf — sariq (Quyoshga o'xshash)
          r = 1.0;
          g = 0.92 + brightness * 0.08;
          b = 0.7 + brightness * 0.15;
        } else if (spectralSeed < 0.9) {
          // K sinf — to'q sariq
          r = 1.0;
          g = 0.75 + brightness * 0.15;
          b = 0.5 + brightness * 0.15;
        } else {
          // M sinf — qizil (sovuq)
          r = 1.0;
          g = 0.5 + brightness * 0.2;
          b = 0.3 + brightness * 0.1;
        }

        const alpha = brightness * 0.85 + 0.15;

        // Yulduz nuqtasi
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},${alpha})`;
        ctx.fill();

        // Eng yorqin yulduzlarga diffraction spike + glow
        if (brightness > 0.8) {
          const glowRadius = radius * 5;
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
          gradient.addColorStop(0, `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},0.35)`);
          gradient.addColorStop(0.4, `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},0.08)`);
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.beginPath();
          ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      }

      // Milky Way effekti — yumshoq bulutsimon yo'l
      if (face === 0 || face === 2 || face === 4) {
        const milkyGradient = ctx.createLinearGradient(0, size * 0.35, 0, size * 0.65);
        milkyGradient.addColorStop(0, 'rgba(30,25,40,0)');
        milkyGradient.addColorStop(0.3, 'rgba(30,25,40,0.04)');
        milkyGradient.addColorStop(0.5, 'rgba(40,35,55,0.06)');
        milkyGradient.addColorStop(0.7, 'rgba(30,25,40,0.04)');
        milkyGradient.addColorStop(1, 'rgba(30,25,40,0)');
        ctx.fillStyle = milkyGradient;
        ctx.fillRect(0, 0, size, size);
      }

      faces.push(canvas);
    }

    const cubemap = new THREE.CubeTexture(faces);
    cubemap.needsUpdate = true;

    this._cache.set(cacheKey, cubemap);
    return cubemap;
  }

  /**
   * Fallback texture — tashqi fayl yuklanmaganda
   * Oddiy kulrang-oq noise
   *
   * @returns {THREE.DataTexture}
   */
  generateFallbackTexture() {
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      const val = Math.random() * 128 + 64;
      data[i * 4] = val;
      data[i * 4 + 1] = val;
      data[i * 4 + 2] = val;
      data[i * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.needsUpdate = true;
    return tex;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // YORDAMCHI — ICHKI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Seed asosida takrorlanadigan pseudo-random
   * @private
   */
  _seededRandom(seed) {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  /**
   * Oddiy 2D value noise
   * @private
   */
  _hashNoise(x, y, seed) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    // Smoothstep
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);

    const a = this._seededRandom(ix + iy * 57 + seed * 131);
    const b = this._seededRandom(ix + 1 + iy * 57 + seed * 131);
    const c = this._seededRandom(ix + (iy + 1) * 57 + seed * 131);
    const d = this._seededRandom(ix + 1 + (iy + 1) * 57 + seed * 131);

    const top = a + (b - a) * ux;
    const bot = c + (d - c) * ux;
    return (top + (bot - top) * uy) * 2.0 - 1.0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROGRESS TRACKING
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Yuklash progressi callback'i
   * @param {Function} callback - callback(loaded, total, percent)
   */
  onProgress(callback) {
    this._onProgressCallbacks.push(callback);
    return this;
  }

  /** @private */
  _emitProgress() {
    const percent = this._totalToLoad > 0
      ? Math.round((this._loaded / this._totalToLoad) * 100)
      : 100;
    for (const cb of this._onProgressCallbacks) {
      cb(this._loaded, this._totalToLoad, percent);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // XOTIRA BOSHQARUVI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Bitta texture'ni xotiradan o'chirish
   * @param {string} name
   */
  disposeTexture(name) {
    const texture = this._cache.get(name);
    if (texture) {
      texture.dispose();
      this._cache.delete(name);
    }
  }

  /**
   * Barcha texture'larni xotiradan o'chirish
   */
  dispose() {
    for (const texture of this._cache.values()) {
      if (texture && texture.dispose) {
        texture.dispose();
      }
    }
    this._cache.clear();
    this._onProgressCallbacks.length = 0;
  }

  /** Cache statistikasi */
  get stats() {
    return {
      textures: this._cache.size,
      loaded: this._loaded,
      total: this._totalToLoad,
    };
  }
}