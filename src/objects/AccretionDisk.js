/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Accretion Disk Object
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Accretion disk boshqaruvi — parametrlar, animatsiya, vizualizatsiya.
 *
 * MUHIM: Haqiqiy disk RENDERING ray marching shader'da amalga oshiriladi
 * (blackhole.frag → computeDiskColor funksiyasi).
 * Bu modul shader'ga parametrlarni yuboradi va boshqaradi.
 *
 * Qo'shimcha ravishda:
 *   - Ixtiyoriy Three.js mesh (wireframe overlay, debug uchun)
 *   - Temperatura/yorqinlik profilini vizualizatsiya
 *   - Disk parametrlarini real-time o'zgartirish
 *   - Noise parametrlarini fine-tuning
 *   - Rang xaritasini boshqarish
 *   - HUD uchun disk ma'lumotlari
 *
 * Disk fizikasi shader'da (accretion.glsl):
 *   #17 — r_ISCO (ichki radius)
 *   #18 — Kepler orbital tezlik
 *   #19 — Shakura-Sunyaev temperatura profili
 *   #20 — Planck qora tana nurlanishi → rang
 *   #21 — Yorqinlik profili
 *   #31 — Procedural noise (disk tuzilmasi)
 *   #32 — FBM (fraktal tuzilma)
 *
 * Bog'liqliklar: Three.js, PhysicsConfig
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import PhysicsConfig from '../../config/physics.config.js';

export default class AccretionDisk {

  // ─────────────────────────────────────────────────────────────────────────
  // KONSTRUKTOR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {Object} [options]
   * @param {number} [options.innerRadius] - Ichki radius (default: r_ISCO)
   * @param {number} [options.outerRadius=20] - Tashqi radius
   * @param {boolean} [options.showWireframe=false] - Debug wireframe
   * @param {boolean} [options.showProfile=false] - Temperatura profili
   */
  constructor(options = {}) {
    const config = PhysicsConfig.accretionDisk;

    // ── Disk parametrlari ──
    this._innerRadius = options.innerRadius || config.innerRadius;
    this._outerRadius = options.outerRadius || config.outerRadius;
    this._thickness = config.thickness;
    this._rotationSpeed = config.rotationSpeed;

    // ── Rang sozlamalari ──
    this._colorMap = {
      hot:  [...config.colorMap.hot],
      warm: [...config.colorMap.warm],
      cool: [...config.colorMap.cool],
    };

    // ── Noise parametrlari ──
    this._noise = {
      scale: config.noise.scale,
      lacunarity: config.noise.lacunarity,
      octaves: config.noise.octaves,
      persistence: config.noise.persistence,
      timeScale: config.noise.timeScale,
    };

    // ── Temperatura parametrlari ──
    this._tMax = config.T_maxNormalized;

    // ── Three.js ──
    this._group = new THREE.Group();
    this._group.name = 'AccretionDisk';

    // Wireframe overlay (debug)
    this._wireframeMesh = null;
    this._showWireframe = options.showWireframe || false;
    if (this._showWireframe) {
      this._createWireframe();
    }

    // Temperatura profili vizualizatsiyasi
    this._profileMesh = null;
    this._showProfile = options.showProfile || false;

    // ── Holat ──
    this._visible = true;
    this._dirty = true;

    // ── Animatsiya ──
    this._currentRotation = 0;  // Vizual aylanish burchagi
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WIREFRAME OVERLAY (debug/estetik)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Disk chegaralarini ko'rsatuvchi wireframe yaratish
   * @private
   */
  _createWireframe() {
    // Ichki doira
    const innerGeom = new THREE.RingGeometry(
      this._innerRadius - 0.05,
      this._innerRadius + 0.05,
      128, 1
    );
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const innerRing = new THREE.Mesh(innerGeom, innerMat);
    innerRing.rotation.x = -Math.PI * 0.5;  // y=0 tekislikda
    innerRing.name = 'DiskInnerEdge';

    // Tashqi doira
    const outerGeom = new THREE.RingGeometry(
      this._outerRadius - 0.05,
      this._outerRadius + 0.05,
      128, 1
    );
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x993300,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const outerRing = new THREE.Mesh(outerGeom, outerMat);
    outerRing.rotation.x = -Math.PI * 0.5;
    outerRing.name = 'DiskOuterEdge';

    // Radial chiziqlar (spiral kollarni ko'rsatish)
    const radialGeom = new THREE.BufferGeometry();
    const radialPositions = [];
    const radialCount = 12;
    for (let i = 0; i < radialCount; i++) {
      const angle = (i / radialCount) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      radialPositions.push(
        this._innerRadius * cos, 0, this._innerRadius * sin,
        this._outerRadius * cos, 0, this._outerRadius * sin
      );
    }
    radialGeom.setAttribute('position',
      new THREE.Float32BufferAttribute(radialPositions, 3));
    const radialMat = new THREE.LineBasicMaterial({
      color: 0x663300,
      transparent: true,
      opacity: 0.08,
    });
    const radialLines = new THREE.LineSegments(radialGeom, radialMat);
    radialLines.name = 'DiskRadialLines';

    // Foton sfera doirasi
    const photonR = PhysicsConfig.blackHole.rPhotonSphere;
    const photonGeom = new THREE.RingGeometry(
      photonR - 0.03, photonR + 0.03, 128, 1
    );
    const photonMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const photonRing = new THREE.Mesh(photonGeom, photonMat);
    photonRing.rotation.x = -Math.PI * 0.5;
    photonRing.name = 'PhotonSphereMarker';

    // Groupga qo'shish
    this._wireframeMesh = new THREE.Group();
    this._wireframeMesh.name = 'DiskWireframe';
    this._wireframeMesh.add(innerRing, outerRing, radialLines, photonRing);
    this._group.add(this._wireframeMesh);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PARAMETR BOSHQARUVI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Ichki radiusni o'zgartirish
   * Odatda r_ISCO ga teng — spin o'zgarganda avtomatik yangilanadi
   *
   * @param {number} radius
   */
  setInnerRadius(radius) {
    this._innerRadius = Math.max(radius, 1.0);
    this._dirty = true;
    return this;
  }

  /** Tashqi radiusni o'zgartirish */
  setOuterRadius(radius) {
    this._outerRadius = Math.max(radius, this._innerRadius + 1.0);
    this._dirty = true;
    return this;
  }

  /** Aylanish tezligini o'zgartirish */
  setRotationSpeed(speed) {
    this._rotationSpeed = speed;
    this._dirty = true;
    return this;
  }

  /**
   * Noise parametrlarini o'zgartirish
   *
   * @param {Object} params - {scale, lacunarity, octaves, persistence, timeScale}
   */
  setNoiseParams(params) {
    if (params.scale !== undefined) this._noise.scale = params.scale;
    if (params.lacunarity !== undefined) this._noise.lacunarity = params.lacunarity;
    if (params.octaves !== undefined) this._noise.octaves = Math.max(1, Math.min(8, params.octaves));
    if (params.persistence !== undefined) this._noise.persistence = params.persistence;
    if (params.timeScale !== undefined) this._noise.timeScale = params.timeScale;
    this._dirty = true;
    return this;
  }

  /**
   * Rang xaritasini o'zgartirish
   *
   * @param {Object} colors - {hot: [r,g,b], warm: [r,g,b], cool: [r,g,b]}
   */
  setColorMap(colors) {
    if (colors.hot) this._colorMap.hot = [...colors.hot];
    if (colors.warm) this._colorMap.warm = [...colors.warm];
    if (colors.cool) this._colorMap.cool = [...colors.cool];
    this._dirty = true;
    return this;
  }

  /**
   * Barcha parametrlarni bir vaqtda o'zgartirish
   *
   * @param {Object} params
   */
  setParams(params) {
    if (params.innerRadius !== undefined) this._innerRadius = params.innerRadius;
    if (params.outerRadius !== undefined) this._outerRadius = params.outerRadius;
    if (params.rotationSpeed !== undefined) this._rotationSpeed = params.rotationSpeed;
    if (params.thickness !== undefined) this._thickness = params.thickness;
    if (params.tMax !== undefined) this._tMax = params.tMax;
    if (params.noise) this.setNoiseParams(params.noise);
    if (params.colors) this.setColorMap(params.colors);

    this._dirty = true;
    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SHADER UNIFORM'LAR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Disk parametrlarini shader uniform sifatida qaytarish
   *
   * @returns {Object}
   */
  getShaderUniforms() {
    return {
      u_diskInnerRadius: this._innerRadius,
      u_diskOuterRadius: this._outerRadius,
      u_diskThickness: this._thickness,
      u_diskRotSpeed: this._rotationSpeed,
      u_diskTMax: this._tMax,

      // Ranglar
      u_diskColorHot: new THREE.Vector3(...this._colorMap.hot),
      u_diskColorWarm: new THREE.Vector3(...this._colorMap.warm),
      u_diskColorCool: new THREE.Vector3(...this._colorMap.cool),

      // Noise
      u_noiseScale: this._noise.scale,
      u_noiseLacunarity: this._noise.lacunarity,
      u_noiseOctaves: this._noise.octaves,
      u_noisePersistence: this._noise.persistence,
      u_noiseTimeScale: this._noise.timeScale,
    };
  }

  /**
   * Scene uniform'larini yangilash
   *
   * @param {Object} sceneUniforms
   */
  applyToSceneUniforms(sceneUniforms) {
    if (!this._dirty) return;

    const uniforms = this.getShaderUniforms();
    for (const [key, value] of Object.entries(uniforms)) {
      if (sceneUniforms[key]) {
        if (value instanceof THREE.Vector3) {
          sceneUniforms[key].value.copy(value);
        } else {
          sceneUniforms[key].value = value;
        }
      }
    }

    this._dirty = false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROFIL HISOB-KITOBLARI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Temperatura profilini hisoblash (grafik uchun)
   * Formula #19
   *
   * @param {number} [points=100]
   * @returns {{r: number[], T: number[]}}
   */
  temperatureProfile(points = 100) {
    const rValues = [];
    const tValues = [];
    const dr = (this._outerRadius - this._innerRadius) / (points - 1);

    for (let i = 0; i < points; i++) {
      const r = this._innerRadius + i * dr;
      rValues.push(r);

      // Formula #19: Shakura-Sunyaev
      const ratio = this._innerRadius / r;
      const temp = Math.pow(ratio, 0.75) * Math.pow(Math.max(1.0 - Math.sqrt(ratio), 0), 0.25);
      tValues.push(temp);
    }

    return { r: rValues, T: tValues };
  }

  /**
   * Yorqinlik profilini hisoblash (grafik uchun)
   * Formula #21
   *
   * @param {number} [points=100]
   * @returns {{r: number[], I: number[]}}
   */
  luminosityProfile(points = 100) {
    const rValues = [];
    const iValues = [];
    const dr = (this._outerRadius - this._innerRadius) / (points - 1);

    for (let i = 0; i < points; i++) {
      const r = this._innerRadius + i * dr;
      rValues.push(r);

      const ratio = this._innerRadius / r;
      const lum = ratio * ratio * ratio * Math.max(1.0 - Math.sqrt(ratio), 0);
      iValues.push(lum);
    }

    return { r: rValues, I: iValues };
  }

  /**
   * Orbital tezlik profilini hisoblash (grafik uchun)
   * Formula #18
   *
   * @param {number} Rs - Schwarzschild radiusi
   * @param {number} [points=100]
   * @returns {{r: number[], v: number[]}}
   */
  velocityProfile(Rs, points = 100) {
    const rValues = [];
    const vValues = [];
    const dr = (this._outerRadius - this._innerRadius) / (points - 1);

    for (let i = 0; i < points; i++) {
      const r = this._innerRadius + i * dr;
      rValues.push(r);

      const v = Math.min(
        Math.sqrt(1.0 / r) / Math.sqrt(Math.max(1.0 - Rs / r, 0.001)),
        0.999
      );
      vValues.push(v);
    }

    return { r: rValues, v: vValues };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // YANGILASH — har kadr
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Disk holatini yangilash
   *
   * @param {number} delta - Delta vaqt
   * @param {number} elapsed - Umumiy vaqt
   */
  update(delta, elapsed) {
    // Vizual aylanish (wireframe uchun)
    this._currentRotation += delta * this._rotationSpeed * 0.5;

    if (this._wireframeMesh) {
      this._wireframeMesh.rotation.y = this._currentRotation;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HUD MA'LUMOTLARI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * HUD uchun disk ma'lumotlari
   *
   * @returns {Object}
   */
  getHUDInfo() {
    // Eng yorqin nuqtadagi temperatura va yorqinlik
    const peakR = this._innerRadius * 1.5;  // Taxminan eng yorqin nuqta

    const ratio = this._innerRadius / peakR;
    const peakTemp = Math.pow(ratio, 0.75) * Math.pow(Math.max(1 - Math.sqrt(ratio), 0), 0.25);

    return {
      innerRadius: this._innerRadius.toFixed(2) + ' M',
      outerRadius: this._outerRadius.toFixed(1) + ' M',
      peakTemperature: (peakTemp * 100).toFixed(0) + '%',
      rotationSpeed: this._rotationSpeed.toFixed(2),
      noiseOctaves: this._noise.octaves,
      visible: this._visible,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERLAR
  // ─────────────────────────────────────────────────────────────────────────

  get object3D() { return this._group; }
  get innerRadius() { return this._innerRadius; }
  get outerRadius() { return this._outerRadius; }
  get rotationSpeed() { return this._rotationSpeed; }
  get noise() { return { ...this._noise }; }
  get colorMap() { return { ...this._colorMap }; }
  get visible() { return this._visible; }
  get dirty() { return this._dirty; }

  set visible(val) {
    this._visible = val;
    this._group.visible = val;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOZALASH
  // ─────────────────────────────────────────────────────────────────────────

  dispose() {
    if (this._wireframeMesh) {
      this._wireframeMesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      this._group.remove(this._wireframeMesh);
    }
    if (this._profileMesh) {
      this._profileMesh.geometry.dispose();
      this._profileMesh.material.dispose();
      this._group.remove(this._profileMesh);
    }
  }
}