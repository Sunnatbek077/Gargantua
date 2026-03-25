/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Black Hole Object
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Qora tuynuk obyekti — fizika va render orasidagi ko'prik.
 *
 * Bu modul:
 *   - Schwarzschild yoki Kerr metrikasini boshqaradi
 *   - Shader uniform'larni fizika modullaridan yig'adi
 *   - Parametr o'zgarishlarini barcha modullarga tarqatadi
 *   - Voqealar gorizonti vizual ko'rsatkichini boshqaradi
 *   - HUD uchun barcha fizik ma'lumotlarni birlashtiradi
 *   - Spin, massa kabi parametrlarni real-time o'zgartirish imkonini beradi
 *
 * Arxitektura:
 *   BlackHole
 *    ├── KerrMetric (yoki Schwarzschild)  — fazovaqt geometriyasi
 *    ├── DopplerBeaming                    — Doppler effekt
 *    ├── GravitationalRedshift             — gravitatsion siljish
 *    └── [shader uniforms]                 — GPU'ga parametrlar
 *
 * Bog'liqliklar: Three.js, KerrMetric, DopplerBeaming, GravitationalRedshift
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import KerrMetric from '../physics/KerrMetric.js';
import DopplerBeaming from '../physics/DopplerBeaming.js';
import GravitationalRedshift from '../physics/GravitationalRedshift.js';
import PhysicsConfig from '../../config/physics.config.js';

export default class BlackHole {

  // ─────────────────────────────────────────────────────────────────────────
  // KONSTRUKTOR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {Object} [options]
   * @param {number} [options.mass=1.0] - Massa (natural units)
   * @param {number} [options.spin=0.998] - Spin a/M [0, 0.9999]
   * @param {number} [options.massSolar=100e6] - Quyosh massasida
   * @param {boolean} [options.showHorizon=false] - Gorizont sferasini ko'rsatish
   */
  constructor(options = {}) {
    const config = PhysicsConfig.blackHole;

    this._mass = options.mass || 1.0;
    this._spin = options.spin ?? config.spin;
    this._massSolar = options.massSolar || config.massSolar;

    // ── Fizika modullari ──
    this._metric = new KerrMetric(this._mass, this._spin, this._massSolar);
    this._doppler = new DopplerBeaming();
    this._redshift = new GravitationalRedshift(this._metric.Rs);

    // ── Three.js obyektlar ──
    this._group = new THREE.Group();
    this._group.name = 'BlackHole';

    // Vizual gorizont sferasi (ixtiyoriy — debug/estetik uchun)
    this._horizonMesh = null;
    this._showHorizon = options.showHorizon || false;
    if (this._showHorizon) {
      this._createHorizonMesh();
    }

    // ── Ergosfera vizualizatsiya (ixtiyoriy) ──
    this._ergosphereMesh = null;
    this._showErgosphere = false;

    // ── O'zgarish kuzatuvchisi ──
    this._onChangeCallbacks = [];
    this._dirty = true;  // Parametr o'zgardimi?
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VIZUAL KOMPONENTLAR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Voqealar gorizonti sferasini yaratish
   * Qora, to'liq shaffof emas — faqat chuqurlik uchun
   * @private
   */
  _createHorizonMesh() {
    const rHorizon = this._metric.rOuterHorizon;

    const geometry = new THREE.SphereGeometry(rHorizon, 64, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: false,
      side: THREE.FrontSide,
      depthWrite: true,
    });

    this._horizonMesh = new THREE.Mesh(geometry, material);
    this._horizonMesh.name = 'EventHorizon';
    this._group.add(this._horizonMesh);
  }

  /**
   * Gorizont sferasini yangilash (spin o'zgarganda)
   * @private
   */
  _updateHorizonMesh() {
    if (!this._horizonMesh) return;

    const rHorizon = this._metric.rOuterHorizon;
    this._horizonMesh.geometry.dispose();
    this._horizonMesh.geometry = new THREE.SphereGeometry(rHorizon, 64, 32);
  }

  /**
   * Ergosfera vizualizatsiyasini yaratish/yangilash
   * Gorizontdan tashqaridagi "tortish" hududi
   */
  showErgosphere(visible = true) {
    this._showErgosphere = visible;

    if (visible && !this._ergosphereMesh) {
      // Ergosfera — ekvatorda kattaroq, qutblarda kichikroq
      // Buni qo'lda geometriya bilan yaratamiz
      const segments = 64;
      const rings = 32;
      const positions = [];
      const indices = [];

      for (let j = 0; j <= rings; j++) {
        const theta = (j / rings) * Math.PI;
        const rErgo = this._metric.ergosphereRadius(theta);
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let i = 0; i <= segments; i++) {
          const phi = (i / segments) * Math.PI * 2;
          positions.push(
            rErgo * sinTheta * Math.cos(phi),
            rErgo * cosTheta,
            rErgo * sinTheta * Math.sin(phi)
          );
        }
      }

      // Indekslar
      for (let j = 0; j < rings; j++) {
        for (let i = 0; i < segments; i++) {
          const a = j * (segments + 1) + i;
          const b = a + segments + 1;
          indices.push(a, b, a + 1);
          indices.push(b, b + 1, a + 1);
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

      const material = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.08,
        wireframe: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      this._ergosphereMesh = new THREE.Mesh(geometry, material);
      this._ergosphereMesh.name = 'Ergosphere';
      this._group.add(this._ergosphereMesh);
    }

    if (this._ergosphereMesh) {
      this._ergosphereMesh.visible = visible;
    }

    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PARAMETR BOSHQARUVI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Spinni o'zgartirish — barcha bog'liq qiymatlar yangilanadi
   *
   * @param {number} spin - a/M nisbati [0, 0.9999]
   * @param {boolean} [silent=false] - Callback chaqirilmasin
   */
  setSpin(spin, silent = false) {
    this._spin = Math.min(Math.abs(spin), 0.9999);
    this._metric.spin = this._spin;
    this._redshift.Rs = this._metric.Rs;

    // Vizual yangilash
    if (this._showHorizon) this._updateHorizonMesh();
    if (this._showErgosphere && this._ergosphereMesh) {
      // Ergosfera geometriyasini qayta qurish
      this._group.remove(this._ergosphereMesh);
      this._ergosphereMesh.geometry.dispose();
      this._ergosphereMesh.material.dispose();
      this._ergosphereMesh = null;
      this.showErgosphere(true);
    }

    this._dirty = true;
    if (!silent) this._emitChange('spin', this._spin);
    return this;
  }

  /**
   * Massani o'zgartirish
   *
   * @param {number} mass - Massa (natural units)
   */
  setMass(mass, silent = false) {
    this._mass = Math.max(mass, 0.01);
    this._metric.M = this._mass;
    this._redshift.Rs = this._metric.Rs;

    if (this._showHorizon) this._updateHorizonMesh();

    this._dirty = true;
    if (!silent) this._emitChange('mass', this._mass);
    return this;
  }

  /**
   * Bir nechta parametrni bir vaqtda o'zgartirish
   *
   * @param {Object} params - {spin, mass, massSolar, ...}
   */
  setParams(params) {
    if (params.mass !== undefined) this.setMass(params.mass, true);
    if (params.spin !== undefined) this.setSpin(params.spin, true);
    if (params.massSolar !== undefined) {
      this._massSolar = params.massSolar;
      this._metric.massSolar = params.massSolar;
    }

    this._dirty = true;
    this._emitChange('params', params);
    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SHADER UNIFORM'LAR — har kadr yangilanadi
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Barcha fizika modullaridan shader uniform'larni yig'ish
   *
   * @returns {Object} Shader uniform qiymatlari
   */
  getShaderUniforms() {
    // Metrika parametrlari
    const metricUniforms = this._metric.getShaderUniforms();

    // Doppler parametrlari
    const dopplerUniforms = this._doppler.getShaderUniforms();

    return {
      ...metricUniforms,
      ...dopplerUniforms,
    };
  }

  /**
   * Scene.js'dagi uniform'larni yangilash
   *
   * @param {Object} sceneUniforms - Scene._uniforms ob'ekti
   */
  applyToSceneUniforms(sceneUniforms) {
    if (!this._dirty) return;

    const uniforms = this.getShaderUniforms();

    for (const [key, value] of Object.entries(uniforms)) {
      if (sceneUniforms[key]) {
        sceneUniforms[key].value = value;
      }
    }

    this._dirty = false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIZIK HISOB-KITOBLAR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Berilgan nuqtadagi vaqt kengayishini hisoblash
   *
   * @param {number} r - Radius (natural units)
   * @returns {number} Vaqt kengayishi omili [0, 1]
   */
  timeDilationAt(r) {
    return this._redshift.timeDilation(r);
  }

  /**
   * Berilgan nuqtadagi gravitatsion redshift
   *
   * @param {number} r
   * @returns {number} z qiymati
   */
  redshiftAt(r) {
    return this._redshift.redshift(r);
  }

  /**
   * Berilgan nuqtadagi Doppler effekt
   *
   * @param {number[]} diskPoint - [x, 0, z]
   * @param {number[]} cameraPos - [x, y, z]
   * @returns {Object} {g, beaming, approaching, ...}
   */
  dopplerAt(diskPoint, cameraPos) {
    const r = Math.sqrt(diskPoint[0] * diskPoint[0] + diskPoint[2] * diskPoint[2]);
    const velocity = this._metric.orbitalVelocity(r);
    return this._doppler.computeAtPoint(diskPoint, cameraPos, velocity);
  }

  /**
   * Berilgan nuqtaning ergosfera ichida ekanligini tekshirish
   *
   * @param {number} r
   * @param {number} [theta=Math.PI/2] - Qutb burchagi
   * @returns {boolean}
   */
  isInErgosphere(r, theta) {
    return this._metric.isInsideErgosphere(r, theta);
  }

  /**
   * Berilgan nuqtaning gorizont ichida ekanligini tekshirish
   *
   * @param {number} r
   * @returns {boolean}
   */
  isInsideHorizon(r) {
    return this._metric.isInsideHorizon(r);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HUD MA'LUMOTLARI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * HUD uchun to'liq ma'lumot paketi
   *
   * @param {number} [cameraR] - Kameraning qora tuynukdan masofasi
   * @returns {Object}
   */
  getHUDInfo(cameraR) {
    const metricInfo = this._metric.getHUDInfo();

    const result = {
      ...metricInfo,
    };

    // Kamera pozitsiyasidagi effektlar
    if (cameraR !== undefined) {
      const redshiftInfo = this._redshift.getHUDInfo(cameraR);
      result.cameraRedshift = redshiftInfo.redshift;
      result.cameraTimeDilation = redshiftInfo.timeRatio;
      result.cameraInErgosphere = this._metric.isInsideErgosphere(cameraR);
    }

    return result;
  }

  /**
   * Interstellar ssenariylarini olish
   *
   * @returns {Object}
   */
  getInterstellarScenarios() {
    return this._redshift.getInterstellarScenarios();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // YANGILASH — har kadr
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Har kadr chaqiriladi
   *
   * @param {number} delta - Delta vaqt
   * @param {number} elapsed - Umumiy vaqt
   */
  update(delta, elapsed) {
    // Hozircha statik — keyinchalik:
    // - Spin pretsessiyasi animatsiyasi
    // - Massa o'sishi (accretion)
    // - Jet pulsatsiyasi
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVENT TIZIMI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Parametr o'zgarganda chaqiriladigan callback
   * @param {Function} callback - callback(paramName, value)
   */
  onChange(callback) {
    this._onChangeCallbacks.push(callback);
    return this;
  }

  /** @private */
  _emitChange(param, value) {
    for (const cb of this._onChangeCallbacks) {
      cb(param, value, this);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERLAR
  // ─────────────────────────────────────────────────────────────────────────

  /** Three.js group (sahnaga qo'shish uchun) */
  get object3D() { return this._group; }

  /** Fizika metrikasi */
  get metric() { return this._metric; }

  /** Doppler moduli */
  get doppler() { return this._doppler; }

  /** Redshift moduli */
  get redshift() { return this._redshift; }

  /** Massa (natural units) */
  get mass() { return this._mass; }

  /** Spin a/M */
  get spin() { return this._spin; }

  /** Schwarzschild radiusi */
  get Rs() { return this._metric.Rs; }

  /** Tashqi gorizont radiusi */
  get rHorizon() { return this._metric.rOuterHorizon; }

  /** Foton sfera radiusi */
  get rPhotonSphere() { return this._metric.rPhotonSphere; }

  /** ISCO radiusi */
  get rISCO() { return this._metric.rISCO; }

  /** Radiativ samaradorlik */
  get efficiency() { return this._metric.radiativeEfficiency; }

  /** Parametr o'zgardimi? */
  get dirty() { return this._dirty; }

  // ─────────────────────────────────────────────────────────────────────────
  // TOZALASH
  // ─────────────────────────────────────────────────────────────────────────

  dispose() {
    if (this._horizonMesh) {
      this._horizonMesh.geometry.dispose();
      this._horizonMesh.material.dispose();
      this._group.remove(this._horizonMesh);
    }
    if (this._ergosphereMesh) {
      this._ergosphereMesh.geometry.dispose();
      this._ergosphereMesh.material.dispose();
      this._group.remove(this._ergosphereMesh);
    }
    this._onChangeCallbacks.length = 0;
  }
}