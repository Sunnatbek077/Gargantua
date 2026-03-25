/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Scene Manager
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Sahna grafigi va 3D obyektlar boshqaruvi.
 *
 * Qora tuynuk simulyatsiyasida an'anaviy 3D sahna yo'q —
 * buning o'rniga BUTUN EKRANNI qoplaydigan bitta to'rtburchak (quad)
 * va unda ishlaydigan ray marching shader bor.
 *
 * Har bir piksel uchun shader mustaqil ravishda:
 *   1. Kameradan nur yo'naltiradi (Formula #34)
 *   2. Nurni egri fazovaqtda harakatlantirib boradi (#6, #8, #9)
 *   3. Disk, foton halqa, yulduzlar bilan kesishishni tekshiradi
 *   4. Yakuniy rangni hisoblaydi
 *
 * Bu fayl:
 *   - Full-screen quad yaratadi
 *   - ShaderMaterial sozlaydi
 *   - Uniform qiymatlarni boshqaradi
 *   - Tashqi modullardan ma'lumot qabul qiladi
 *
 * Bog'liqliklar: Three.js, PhysicsConfig
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import PhysicsConfig from '../../config/physics.config.js';

export default class Scene {

  // ─────────────────────────────────────────────────────────────────────────
  // KONSTRUKTOR
  // ─────────────────────────────────────────────────────────────────────────

  constructor() {
    this._config = PhysicsConfig;

    // ── Three.js sahna ──
    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0x000000);

    // ── Shader uniform'lari ──
    // Bu qiymatlar har kadrda yangilanadi va GLSL shaderga yuboriladi
    this._uniforms = this._createUniforms();

    // ── Shader material ──
    this._material = null;

    // ── Full-screen quad ──
    this._quad = null;

    // ── Cubemap (yulduzli osmon) ──
    this._starfieldCubemap = null;

    // ── Noise texture ──
    this._noiseTexture = null;

    // ── Tayyor holat ──
    this._ready = false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UNIFORM'LAR — Shader bilan JavaScript o'rtasidagi ko'prik
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Barcha shader uniform'larini yaratish
   *
   * Har bir uniform = shader'ga yuboriladigan qiymat.
   * Ular kategoriyalarga bo'lingan:
   *   - Vaqt (clock)
   *   - Kamera (camera)
   *   - Qora tuynuk (physics)
   *   - Accretion disk (disk)
   *   - Doppler (doppler)
   *   - Ray marching (raymarching)
   *   - Texturalar (textures)
   *
   * @private
   * @returns {Object} THREE.js uniform formatidagi ob'ekt
   */
  _createUniforms() {
    const bh = this._config.blackHole;
    const disk = this._config.accretionDisk;
    const dop = this._config.doppler;
    const rm = this._config.rayMarching;

    return {

      // ─── Vaqt ───
      u_time:      { value: 0.0 },
      u_deltaTime: { value: 0.016 },

      // ─── Ekran ───
      u_resolution: { value: new THREE.Vector2(1920, 1080) },

      // ─── Kamera (Formula #34) ───
      u_cameraPos:       { value: new THREE.Vector3(0, 3, 15) },
      u_cameraDir:       { value: new THREE.Vector3(0, 0, -1) },
      u_cameraRight:     { value: new THREE.Vector3(1, 0, 0) },
      u_cameraUp:        { value: new THREE.Vector3(0, 1, 0) },
      u_focalLength:     { value: 1.0 },
      u_aspectRatio:     { value: 16.0 / 9.0 },

      // ─── Qora tuynuk (Formulalar #1-5) ───
      u_blackHoleMass:   { value: 1.0 },          // M (natural units)
      u_Rs:              { value: bh.Rs },         // Schwarzschild radiusi
      u_spin:            { value: bh.spin },       // Kerr spin a/M
      u_charge:          { value: bh.charge },     // Reissner/Newman zaryad Q
      u_rPhotonSphere:   { value: bh.rPhotonSphere },
      u_rISCO:           { value: bh.rISCO },
      u_rOuterHorizon:   { value: bh.rOuterHorizon },

      // ─── Accretion disk (Formulalar #17-21, #31-32) ───
      u_diskInnerRadius: { value: disk.innerRadius },
      u_diskOuterRadius: { value: disk.outerRadius },
      u_diskThickness:   { value: disk.thickness },
      u_diskRotSpeed:    { value: disk.rotationSpeed },
      u_diskTMax:        { value: disk.T_maxNormalized },

      // Disk rang xaritasi
      u_diskColorHot:    { value: new THREE.Vector3(...disk.colorMap.hot) },
      u_diskColorWarm:   { value: new THREE.Vector3(...disk.colorMap.warm) },
      u_diskColorCool:   { value: new THREE.Vector3(...disk.colorMap.cool) },

      // Noise parametrlari
      u_noiseScale:      { value: disk.noise.scale },
      u_noiseLacunarity: { value: disk.noise.lacunarity },
      u_noiseOctaves:    { value: disk.noise.octaves },
      u_noisePersistence:{ value: disk.noise.persistence },
      u_noiseTimeScale:  { value: disk.noise.timeScale },

      // ─── Doppler (Formulalar #22-25) ───
      u_dopplerEnabled:  { value: dop.enabled ? 1.0 : 0.0 },
      u_beamingExp:      { value: dop.beamingExponent },
      u_colorShift:      { value: dop.colorShiftStrength },
      u_brightnessBoost: { value: dop.brightnessBoost },
      u_gravRedshift:    { value: dop.gravitationalRedshift ? 1.0 : 0.0 },

      // ─── Ray marching (Formulalar #6-9) ───
      u_maxSteps:        { value: rm.maxSteps },
      u_stepSize:        { value: rm.stepSize },
      u_adaptiveStep:    { value: rm.adaptiveStep ? 1.0 : 0.0 },
      u_minStepSize:     { value: rm.minStepSize },
      u_maxStepSize:     { value: rm.maxStepSize },
      u_stepSizeFactor:  { value: rm.stepSizeFactor },
      u_escapeRadius:    { value: rm.escapeRadius },
      u_captureRadius:   { value: rm.captureRadius },
      u_useRK4:          { value: rm.integrationMethod === 'rk4' ? 1.0 : 0.0 },

      // ─── Lensing (Formulalar #13-16) ───
      u_lensingEnabled:  { value: this._config.lensing.enabled ? 1.0 : 0.0 },
      u_photonRingIntensity: { value: this._config.lensing.photonRingIntensity },

      // ─── Texturalar ───
      u_starfieldCube:   { value: null },  // Cubemap — keyinroq yuklanadi
      u_noiseTexture:    { value: null },  // Noise — keyinroq yuklanadi
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SAHNANI QO'RISH
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Sahnani to'liq qurish
   * Vertex va fragment shader kodlari tashqaridan beriladi
   *
   * @param {string} vertexShader - GLSL vertex shader kodi
   * @param {string} fragmentShader - GLSL fragment shader kodi
   */
  build(vertexShader, fragmentShader) {
    // ── ShaderMaterial yaratish ──
    this._material = new THREE.ShaderMaterial({
      uniforms: this._uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      depthWrite: false,
      depthTest: false,
    });

    // ── Full-screen quad ──
    // Butun ekranni qoplaydigan ikki uchburchak
    // Vertex shader uni NDC (-1,-1) dan (1,1) gacha cho'zadi
    // Fragment shader har piksel uchun ray marching ishlatadi
    const geometry = new THREE.PlaneGeometry(2, 2);
    this._quad = new THREE.Mesh(geometry, this._material);

    // Kamera frustum'dan tashqarida qolmasligi uchun
    this._quad.frustumCulled = false;

    this._scene.add(this._quad);
    this._ready = true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UNIFORM YANGILASH — har kadr chaqiriladi
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Vaqt uniform'larini yangilash
   *
   * @param {Clock} clock - Clock moduli
   */
  updateTimeUniforms(clock) {
    this._uniforms.u_time.value = clock.elapsed;
    this._uniforms.u_deltaTime.value = clock.delta;
  }

  /**
   * Kamera uniform'larini yangilash
   *
   * @param {Camera} camera - Camera moduli
   */
  updateCameraUniforms(camera) {
    const cu = camera.uniforms;
    this._uniforms.u_cameraPos.value.copy(cu.cameraPosition);
    this._uniforms.u_cameraDir.value.copy(cu.cameraDirection);
    this._uniforms.u_cameraRight.value.copy(cu.cameraRight);
    this._uniforms.u_cameraUp.value.copy(cu.cameraUp);
    this._uniforms.u_focalLength.value = cu.focalLength;
    this._uniforms.u_aspectRatio.value = cu.aspectRatio;
  }

  /**
   * Ekran o'lchamini yangilash
   *
   * @param {number} width - Piksel kengligi
   * @param {number} height - Piksel balandligi
   */
  updateResolution(width, height) {
    this._uniforms.u_resolution.value.set(width, height);
  }

  /**
   * Qora tuynuk parametrlarini yangilash
   * GUI panelidan o'zgartirilganda chaqiriladi
   *
   * @param {Object} params - O'zgartirilgan parametrlar
   */
  updateBlackHoleParams(params) {
    const bh = this._config.blackHole;

    if (params.spin !== undefined || params.charge !== undefined) {
      if (params.spin !== undefined) bh.spin = params.spin;
      if (params.charge !== undefined) bh.charge = params.charge;
      
      // Spin yoki Zaryad o'zgarganda bog'liq qiymatlarni qayta hisoblash
      this._uniforms.u_spin.value = bh.spin;
      this._uniforms.u_charge.value = bh.charge;
      this._uniforms.u_rPhotonSphere.value = bh.rPhotonSphere;
      this._uniforms.u_rISCO.value = bh.rISCO;
      this._uniforms.u_rOuterHorizon.value = bh.rOuterHorizon;
      this._uniforms.u_diskInnerRadius.value = bh.rISCO;
    }

    if (params.mass !== undefined) {
      this._uniforms.u_blackHoleMass.value = params.mass;
    }
  }

  /**
   * Post-processing parametrlarini yangilash
   *
   * @param {Object} params - O'zgartirilgan parametrlar
   */
  updatePostFXParams(params) {
    if (params.dopplerEnabled !== undefined) {
      this._uniforms.u_dopplerEnabled.value = params.dopplerEnabled ? 1.0 : 0.0;
    }
    if (params.beamingExponent !== undefined) {
      this._uniforms.u_beamingExp.value = params.beamingExponent;
    }
    if (params.brightnessBoost !== undefined) {
      this._uniforms.u_brightnessBoost.value = params.brightnessBoost;
    }
  }

  /**
   * Sifat darajasini o'zgartirish
   *
   * @param {Object} qualityPreset - RenderConfig.qualityPresets ichidan
   */
  applyQualityPreset(qualityPreset) {
    this._uniforms.u_maxSteps.value = qualityPreset.rayMarchSteps;
    this._uniforms.u_noiseOctaves.value = qualityPreset.noiseOctaves;
    this._uniforms.u_adaptiveStep.value = qualityPreset.adaptiveStep ? 1.0 : 0.0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEXTURE BOSHQARUVI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Yulduzli osmon cubemap'ini o'rnatish
   *
   * @param {THREE.CubeTexture} cubemap - Yuklangan cubemap texture
   */
  setStarfieldCubemap(cubemap) {
    this._starfieldCubemap = cubemap;
    this._uniforms.u_starfieldCube.value = cubemap;
  }

  /**
   * Noise texture'ni o'rnatish
   *
   * @param {THREE.Texture} texture - Procedural noise texture
   */
  setNoiseTexture(texture) {
    this._noiseTexture = texture;
    this._uniforms.u_noiseTexture.value = texture;
  }

  /**
   * Procedural noise texture generatsiya qilish
   * Tashqi faylga bog'liq emas — runtime'da yaratiladi
   *
   * @param {number} [size=512] - Texture o'lchami (piksel)
   * @returns {THREE.DataTexture}
   */
  generateNoiseTexture(size = 512) {
    const data = new Uint8Array(size * size * 4);

    for (let i = 0; i < size * size; i++) {
      const stride = i * 4;
      // Turli chastotadagi random qiymatlar
      data[stride]     = Math.random() * 255;  // R
      data[stride + 1] = Math.random() * 255;  // G
      data[stride + 2] = Math.random() * 255;  // B
      data[stride + 3] = 255;                  // A
    }

    const texture = new THREE.DataTexture(
      data, size, size,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;

    this.setNoiseTexture(texture);
    return texture;
  }

  /**
   * Procedural yulduzli cubemap generatsiya qilish
   * Tashqi HDR faylga bog'liq emas — runtime'da yaratiladi
   *
   * @param {number} [size=1024] - Har bir yuz uchun piksel
   * @returns {THREE.CubeTexture}
   */
  generateStarfieldCubemap(size = 1024) {
    const faces = [];

    for (let face = 0; face < 6; face++) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      // Qora fon
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, size, size);

      // Yulduzlar
      const starCount = 3000 + Math.floor(Math.random() * 2000);

      for (let s = 0; s < starCount; s++) {
        const x = Math.random() * size;
        const y = Math.random() * size;

        // Yulduz yorqinligi — ko'pchiligi xira, ozchiligi yorqin
        const brightness = Math.pow(Math.random(), 3.0);
        const radius = brightness * 1.5 + 0.3;

        // Yulduz rangi — temperaturaga bog'liq
        const temp = Math.random();
        let r, g, b;
        if (temp < 0.3) {
          // Sovuq — ko'kish oq
          r = 0.7 + brightness * 0.3;
          g = 0.8 + brightness * 0.2;
          b = 1.0;
        } else if (temp < 0.7) {
          // O'rtacha — oq
          r = 1.0;
          g = 1.0;
          b = 0.95 + brightness * 0.05;
        } else {
          // Issiq — sariqcha
          r = 1.0;
          g = 0.85 + brightness * 0.15;
          b = 0.6 + brightness * 0.2;
        }

        const alpha = brightness * 0.8 + 0.2;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},${alpha})`;
        ctx.fill();

        // Eng yorqin yulduzlarga glow
        if (brightness > 0.85) {
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
          gradient.addColorStop(0, `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},0.3)`);
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.beginPath();
          ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      }

      faces.push(canvas);
    }

    const cubemap = new THREE.CubeTexture(faces);
    cubemap.needsUpdate = true;
    this.setStarfieldCubemap(cubemap);
    return cubemap;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERLAR
  // ─────────────────────────────────────────────────────────────────────────

  /** Three.js scene ob'ekti */
  get native() {
    return this._scene;
  }

  /** Shader material */
  get material() {
    return this._material;
  }

  /** Barcha uniform'lar */
  get uniforms() {
    return this._uniforms;
  }

  /** Sahna qurilganmi? */
  get ready() {
    return this._ready;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOZALASH
  // ─────────────────────────────────────────────────────────────────────────

  dispose() {
    if (this._quad) {
      this._quad.geometry.dispose();
      this._scene.remove(this._quad);
    }
    if (this._material) {
      this._material.dispose();
    }
    if (this._starfieldCubemap) {
      this._starfieldCubemap.dispose();
    }
    if (this._noiseTexture) {
      this._noiseTexture.dispose();
    }
    this._ready = false;
  }
}