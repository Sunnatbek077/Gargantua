/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Starfield Generator
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Yulduzli osmon fonini yaratish va boshqarish.
 *
 * Gravitatsion lensing effekti uchun yulduzli fon zarur:
 *   - Nurlar egrilib o'tganda boshqa yo'nalishdagi yulduzlarni ko'rsatadi
 *   - Eynshteyn halqasi yulduzlarning "halqa" tasviri
 *   - Foton sfera yaqinida yulduzlar kuchaytiriladi
 *
 * Procedural generatsiya — tashqi faylga bog'liq emas:
 *   - 7 ta spektral sinf (O, B, A, F, G, K, M)
 *   - Haqiqiy yorqinlik taqsimoti (ko'pchiligi xira)
 *   - Milky Way bandi
 *   - Nebula hintlari
 *   - Sifat darajalariga mos resolution
 *
 * Formula:
 *   #35 — color = textureCube(skybox, rayDirection)
 *          Cubemap lookup — shader'da ishlatiladi
 *
 * Bog'liqliklar: Three.js
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';

export default class Starfield {

  /**
   * @param {Object} [options]
   * @param {number} [options.resolution=1024] - Har yuz uchun piksel
   * @param {number} [options.starCount=4000] - Har yuzda yulduz soni
   * @param {boolean} [options.milkyWay=true] - Somon Yo'li bandi
   * @param {boolean} [options.nebulae=true] - Nebula hintlari
   * @param {number} [options.seed=42] - Random seed (takrorlanadigan)
   */
  constructor(options = {}) {
    this._resolution = options.resolution || 1024;
    this._starCount = options.starCount || 4000;
    this._milkyWay = options.milkyWay !== false;
    this._nebulae = options.nebulae !== false;
    this._seed = options.seed || 42;

    // ── Cubemap texture ──
    this._cubemap = null;
    this._generated = false;

    // ── Three.js group ──
    this._group = new THREE.Group();
    this._group.name = 'Starfield';

    // ── Spektral sinf taqsimoti ──
    // Haqiqiy yulduz populyatsiyasiga yaqin
    this._spectralDistribution = [
      { class: 'O', fraction: 0.003, tempRange: [30000, 50000], color: [0.6, 0.7, 1.0] },
      { class: 'B', fraction: 0.01,  tempRange: [10000, 30000], color: [0.7, 0.8, 1.0] },
      { class: 'A', fraction: 0.06,  tempRange: [7500, 10000],  color: [0.9, 0.95, 1.0] },
      { class: 'F', fraction: 0.10,  tempRange: [6000, 7500],   color: [1.0, 0.98, 0.92] },
      { class: 'G', fraction: 0.15,  tempRange: [5200, 6000],   color: [1.0, 0.92, 0.75] },
      { class: 'K', fraction: 0.25,  tempRange: [3700, 5200],   color: [1.0, 0.78, 0.5] },
      { class: 'M', fraction: 0.41,  tempRange: [2400, 3700],   color: [1.0, 0.5, 0.3] },
    ];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GENERATSIYA
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Yulduzli osmon cubemap'ini generatsiya qilish
   *
   * @returns {THREE.CubeTexture}
   */
  generate() {
    const size = this._resolution;
    const faces = [];

    for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      // ── Qora fon ──
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, size, size);

      // ── Milky Way bandi ──
      if (this._milkyWay) {
        this._drawMilkyWay(ctx, size, faceIndex);
      }

      // ── Nebula hintlari ──
      if (this._nebulae) {
        this._drawNebulae(ctx, size, faceIndex);
      }

      // ── Yulduzlar ──
      this._drawStars(ctx, size, faceIndex);

      faces.push(canvas);
    }

    this._cubemap = new THREE.CubeTexture(faces);
    this._cubemap.needsUpdate = true;
    this._generated = true;

    return this._cubemap;
  }

  /**
   * Yulduzlarni chizish
   * @private
   */
  _drawStars(ctx, size, faceIndex) {
    const count = this._starCount;

    for (let i = 0; i < count; i++) {
      const starSeed = this._seed * 1000 + faceIndex * 100000 + i;

      // Pozitsiya
      const x = this._seededRandom(starSeed) * size;
      const y = this._seededRandom(starSeed + 7777) * size;

      // ── Yorqinlik — eksponensial taqsimot ──
      // Ko'pchilik yulduzlar xira, ozchiligi yorqin
      // Bu haqiqiy yulduz populyatsiyasini aks ettiradi
      const rawBrightness = this._seededRandom(starSeed + 3333);
      const magnitude = Math.pow(rawBrightness, 4.5);  // Kuchli eksponensial
      // INTERSTELLAR: yulduzlar juda mayda — disk yorqinligi bostirib qo'yadi
      const radius = magnitude * 0.8 + 0.1;

      // ── Spektral sinf ──
      const spectral = this._getSpectralClass(starSeed + 5555);
      let r = spectral.color[0];
      let g = spectral.color[1];
      let b = spectral.color[2];

      // Yorqinlikka qarab rangni moslashtirish
      // Xira yulduzlar — ko'proq qizil (sovuqroq)
      // Yorqin yulduzlar — spektral rang to'liq ko'rinadi
      const colorSaturation = 0.3 + magnitude * 0.7;
      r = 1.0 - (1.0 - r) * colorSaturation;
      g = 1.0 - (1.0 - g) * colorSaturation;
      b = 1.0 - (1.0 - b) * colorSaturation;

      const alpha = magnitude * 0.85 + 0.15;

      // ── Yulduz nuqtasi ──
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},${alpha})`;
      ctx.fill();

      // INTERSTELLAR: glow faqat eng yorqinlarga, kichikroq
      if (magnitude > 0.85) {
        this._drawStarGlow(ctx, x, y, radius, r, g, b, magnitude);
      }

      // ── Eng yorqin yulduzlarga diffraction spikes ──
      if (magnitude > 0.95) {
        this._drawDiffractionSpikes(ctx, x, y, radius, r, g, b, magnitude);
      }
    }
  }

  /**
   * Yulduz glow effekti
   * @private
   */
  _drawStarGlow(ctx, x, y, radius, r, g, b, magnitude) {
    // INTERSTELLAR: kichikroq, xiraroq glow
    const glowRadius = radius * 3;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
    const glowAlpha = (magnitude - 0.85) * 0.8;

    gradient.addColorStop(0, `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},${glowAlpha * 0.4})`);
    gradient.addColorStop(0.3, `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},${glowAlpha * 0.1})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  /**
   * Diffraction spike effekti (eng yorqin yulduzlar)
   * @private
   */
  _drawDiffractionSpikes(ctx, x, y, radius, r, g, b, magnitude) {
    // INTERSTELLAR: kichikroq spike'lar
    const spikeLength = radius * 6;
    const spikeAlpha = (magnitude - 0.95) * 2.0;

    ctx.strokeStyle = `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},${spikeAlpha * 0.15})`;
    ctx.lineWidth = 0.5;

    // 4 ta spike (xoch shaklida)
    const angles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
    for (const angle of angles) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(
        x + Math.cos(angle) * spikeLength,
        y + Math.sin(angle) * spikeLength
      );
      ctx.stroke();
    }
  }

  /**
   * Milky Way bandi
   * @private
   */
  _drawMilkyWay(ctx, size, faceIndex) {
    // Faqat ba'zi yuzlarda ko'rinadi
    // Cubemap yuzlari: +X, -X, +Y, -Y, +Z, -Z
    const milkyWayFaces = [0, 2, 4];  // Uchta yuzda
    if (!milkyWayFaces.includes(faceIndex)) return;

    // Gorizontal band — ekvator bo'ylab
    const bandCenter = size * 0.5;
    const bandWidth = size * 0.25;

    // Ko'p qatlamli gradient — chuqurlik hissi
    for (let layer = 0; layer < 3; layer++) {
      const layerWidth = bandWidth * (1.0 + layer * 0.3);
      const layerAlpha = 0.015 / (layer + 1);
      const yOffset = Math.sin(faceIndex * 1.5) * size * 0.05 * layer;

      const gradient = ctx.createLinearGradient(
        0, bandCenter - layerWidth + yOffset,
        0, bandCenter + layerWidth + yOffset
      );

      // Har qatlam uchun biroz farqli rang
      const r = 25 + layer * 8;
      const g = 20 + layer * 5;
      const b = 35 + layer * 10;

      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(0.25, `rgba(${r},${g},${b},${layerAlpha * 0.3})`);
      gradient.addColorStop(0.45, `rgba(${r},${g},${b},${layerAlpha})`);
      gradient.addColorStop(0.5, `rgba(${r + 10},${g + 8},${b + 15},${layerAlpha * 1.2})`);
      gradient.addColorStop(0.55, `rgba(${r},${g},${b},${layerAlpha})`);
      gradient.addColorStop(0.75, `rgba(${r},${g},${b},${layerAlpha * 0.3})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }

    // Milky Way ichidagi qo'shimcha yulduz zichligi
    const extraStars = 800;
    for (let i = 0; i < extraStars; i++) {
      const seed = this._seed * 2000 + faceIndex * 50000 + i;
      const x = this._seededRandom(seed) * size;

      // Gaussian taqsimot — band markaziga yaqin
      const gaussSeed = this._seededRandom(seed + 1111);
      const gauss = Math.sqrt(-2 * Math.log(Math.max(gaussSeed, 0.001))) *
                    Math.cos(2 * Math.PI * this._seededRandom(seed + 2222));
      const y = bandCenter + gauss * bandWidth * 0.3;

      if (y < 0 || y > size) continue;

      const brightness = Math.pow(this._seededRandom(seed + 3333), 3.0);
      const radius = brightness * 0.8 + 0.2;
      const alpha = brightness * 0.5 + 0.1;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,190,210,${alpha})`;
      ctx.fill();
    }
  }

  /**
   * Nebula hintlari — yumshoq rangli dog'lar
   * @private
   */
  _drawNebulae(ctx, size, faceIndex) {
    const nebulaCount = 2 + Math.floor(this._seededRandom(this._seed + faceIndex * 99) * 3);

    for (let i = 0; i < nebulaCount; i++) {
      const seed = this._seed * 3000 + faceIndex * 70000 + i;
      const x = this._seededRandom(seed) * size;
      const y = this._seededRandom(seed + 111) * size;
      const radius = 30 + this._seededRandom(seed + 222) * 80;

      // Nebula ranglari — qizil, ko'k, yashil tumanliklar
      const colorSeed = this._seededRandom(seed + 333);
      let r, g, b;
      if (colorSeed < 0.4) {
        // Emission nebula — qizg'ish
        r = 60; g = 20; b = 30;
      } else if (colorSeed < 0.7) {
        // Reflection nebula — ko'kish
        r = 20; g = 30; b = 60;
      } else {
        // Planetary nebula — yashil-ko'k
        r = 15; g = 45; b = 50;
      }

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(${r},${g},${b},0.02)`);
      gradient.addColorStop(0.5, `rgba(${r},${g},${b},0.008)`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // YORDAMCHI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Spektral sinfni aniqlash
   * @private
   */
  _getSpectralClass(seed) {
    const rand = this._seededRandom(seed);
    let cumulative = 0;

    for (const spec of this._spectralDistribution) {
      cumulative += spec.fraction;
      if (rand < cumulative) return spec;
    }

    return this._spectralDistribution[this._spectralDistribution.length - 1];
  }

  /**
   * Seed asosida pseudo-random
   * @private
   */
  _seededRandom(seed) {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SIFAT BOSHQARUVI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Sifat darajasiga mos cubemap yaratish
   *
   * @param {string} quality - 'low', 'medium', 'high', 'ultra'
   * @returns {THREE.CubeTexture}
   */
  generateForQuality(quality) {
    const settings = {
      low:    { resolution: 512,  starCount: 2000 },
      medium: { resolution: 1024, starCount: 4000 },
      high:   { resolution: 2048, starCount: 6000 },
      ultra:  { resolution: 4096, starCount: 10000 },
    };

    const s = settings[quality] || settings.medium;
    this._resolution = s.resolution;
    this._starCount = s.starCount;

    return this.generate();
  }

  /**
   * Cubemap'ni yangilash (parametr o'zgarganda)
   *
   * @returns {THREE.CubeTexture}
   */
  regenerate() {
    if (this._cubemap) {
      this._cubemap.dispose();
    }
    return this.generate();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERLAR
  // ─────────────────────────────────────────────────────────────────────────

  get object3D() { return this._group; }
  get cubemap() { return this._cubemap; }
  get generated() { return this._generated; }
  get resolution() { return this._resolution; }
  get starCount() { return this._starCount; }

  set resolution(val) { this._resolution = Math.max(256, Math.min(4096, val)); }
  set starCount(val) { this._starCount = Math.max(500, Math.min(20000, val)); }
  set seed(val) { this._seed = val; }

  // ─────────────────────────────────────────────────────────────────────────
  // TOZALASH
  // ─────────────────────────────────────────────────────────────────────────

  dispose() {
    if (this._cubemap) {
      this._cubemap.dispose();
      this._cubemap = null;
    }
    this._generated = false;
  }
}