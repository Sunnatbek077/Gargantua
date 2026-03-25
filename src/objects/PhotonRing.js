/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Photon Ring Object
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Foton halqasi — Interstellar'dagi eng yorqin va eng nozik chiziq.
 *
 * Fizik mohiyat:
 *   r = 3M = 1.5Rs radiusda fotonlar qora tuynuk atrofida
 *   beqaror doiraviy orbitada aylanadi. Bu "foton sfera".
 *
 *   Bu halqa aslida cheksiz ko'p sub-halqalardan iborat:
 *     n=1: foton bir marta aylanib o'tgan (eng yorqin, eng keng)
 *     n=2: foton ikki marta aylanib o'tgan (xiraroq, ingichkaroq)
 *     n=3, 4, ...: har keyingisi eksponensial ravishda xiraroq
 *
 *   Ularning barchasi gorizont chetida "to'planadi" —
 *   bu "black hole shadow" ning chegarasini hosil qiladi.
 *
 * Bu modul:
 *   - Foton halqa parametrlarini boshqaradi
 *   - Shader'ga porlash intensivligini yuboradi
 *   - Ixtiyoriy Three.js overlay (ta'limiy ko'rinish)
 *   - Sub-halqalar fizikasini hisoblaydi
 *   - HUD uchun ma'lumotlar beradi
 *
 * Rendering: blackhole.frag → photonRingGlow() funksiyasi
 *
 * Bog'liqliklar: Three.js, PhysicsConfig
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import PhysicsConfig from '../../config/physics.config.js';

export default class PhotonRing {

  /**
   * @param {Object} [options]
   * @param {number} [options.intensity=2.0] - Porlash intensivligi
   * @param {boolean} [options.showOverlay=false] - Three.js overlay
   * @param {number} [options.subRings=3] - Sub-halqalar soni (1-5)
   */
  constructor(options = {}) {
    this._intensity = options.intensity ?? PhysicsConfig.lensing.photonRingIntensity;
    this._subRingCount = Math.min(Math.max(options.subRings || 3, 1), 5);

    // ── Foton sfera radiusi (metrikadan olinadi) ──
    this._rPhotonSphere = PhysicsConfig.blackHole.rPhotonSphere;

    // ── Rang ──
    // Foton halqa oltin-oq rangda porlaydi
    // (yuqori temperaturali accretion diskdan kelgan yorug'lik)
    this._color = new THREE.Color(1.0, 0.85, 0.6);

    // ── Sub-halqalar parametrlari ──
    // Har keyingi sub-halqa:
    //   - Foton sferaga yaqinroq (eksponensial yaqinlashish)
    //   - Xiraroq (intensivlik × demping^n)
    //   - Ingichkaroq (kenglik × demping^n)
    this._subRings = this._computeSubRings();

    // ── Three.js overlay ──
    this._group = new THREE.Group();
    this._group.name = 'PhotonRing';
    this._overlayMesh = null;
    this._showOverlay = options.showOverlay || false;

    if (this._showOverlay) {
      this._createOverlay();
    }

    this._dirty = true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUB-HALQALAR FIZIKASI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Sub-halqalar parametrlarini hisoblash
   *
   * Har bir sub-halqa n=1,2,3,... uchun:
   *   radius: foton sferaga eksponensial yaqinlashadi
   *   width: eksponensial ingichkalashadi
   *   intensity: eksponensial xiraalashadi
   *
   * Fizik asos:
   *   n-chi sub-halqa — foton qora tuynuk atrofida n marta aylangan
   *   Har aylanishda foton sferadan e^(-2π) ≈ 0.002 koeffitsient bilan
   *   uzoqlashadi — shuning uchun har keyingisi juda yaqin va juda xira
   *
   * @private
   * @returns {Array<{radius: number, width: number, intensity: number}>}
   */
  _computeSubRings() {
    const rPh = this._rPhotonSphere;
    const rings = [];

    // Demping omili — har sub-halqa uchun
    const dempingFactor = 0.35;       // Intensivlik kamayishi
    const widthDemping = 0.5;         // Kenglik kamayishi
    const radiusConvergence = 0.02;   // Radiusning foton sferaga yaqinlashishi

    for (let n = 1; n <= this._subRingCount; n++) {
      rings.push({
        n: n,
        // Radius: foton sferaga yaqinlashadi
        radius: rPh + radiusConvergence * Math.pow(0.3, n - 1),
        // Kenglik: ingichkalashadi
        width: 0.15 * Math.pow(widthDemping, n - 1),
        // Intensivlik: xiraalashadi
        intensity: this._intensity * Math.pow(dempingFactor, n - 1),
        // Rang temperaturasi: har keyingisi biroz issiqroq
        // (ko'proq aylangan foton ko'proq energiya yo'qotgan)
        colorTemp: 1.0 - 0.1 * (n - 1),
      });
    }

    return rings;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // THREE.JS OVERLAY
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Vizual overlay yaratish (ta'limiy va debug)
   * @private
   */
  _createOverlay() {
    for (const ring of this._subRings) {
      // Halqa geometriyasi
      const innerR = ring.radius - ring.width * 0.5;
      const outerR = ring.radius + ring.width * 0.5;

      const geometry = new THREE.RingGeometry(innerR, outerR, 128, 1);
      const material = new THREE.MeshBasicMaterial({
        color: this._color.clone().multiplyScalar(ring.colorTemp),
        transparent: true,
        opacity: Math.min(ring.intensity * 0.15, 0.5),
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI * 0.5;  // y=0 tekislikda
      mesh.name = `PhotonSubRing_n${ring.n}`;

      this._group.add(mesh);
    }

    // Foton sfera markeri (punkt chiziq)
    const markerGeom = new THREE.RingGeometry(
      this._rPhotonSphere - 0.02,
      this._rPhotonSphere + 0.02,
      128, 1
    );
    const markerMat = new THREE.MeshBasicMaterial({
      color: 0xffcc00,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const marker = new THREE.Mesh(markerGeom, markerMat);
    marker.rotation.x = -Math.PI * 0.5;
    marker.name = 'PhotonSphereMarker';
    this._group.add(marker);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PARAMETR BOSHQARUVI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Porlash intensivligini o'zgartirish
   * @param {number} intensity
   */
  setIntensity(intensity) {
    this._intensity = Math.max(0, intensity);
    this._subRings = this._computeSubRings();
    this._dirty = true;
    return this;
  }

  /**
   * Foton sfera radiusini yangilash (spin o'zgarganda)
   * @param {number} rPhotonSphere
   */
  updatePhotonSphereRadius(rPhotonSphere) {
    this._rPhotonSphere = rPhotonSphere;
    this._subRings = this._computeSubRings();

    // Overlay yangilash
    if (this._showOverlay) {
      this._group.clear();
      this._createOverlay();
    }

    this._dirty = true;
    return this;
  }

  /**
   * Rang o'zgartirish
   * @param {number} r - [0,1]
   * @param {number} g - [0,1]
   * @param {number} b - [0,1]
   */
  setColor(r, g, b) {
    this._color.setRGB(r, g, b);
    this._dirty = true;
    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SHADER UNIFORM'LAR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Shader uchun uniform'lar
   */
  getShaderUniforms() {
    return {
      u_photonRingIntensity: this._intensity,
      u_rPhotonSphere: this._rPhotonSphere,
    };
  }

  /**
   * Scene uniform'larini yangilash
   */
  applyToSceneUniforms(sceneUniforms) {
    if (!this._dirty) return;

    const u = this.getShaderUniforms();
    if (sceneUniforms.u_photonRingIntensity) {
      sceneUniforms.u_photonRingIntensity.value = u.u_photonRingIntensity;
    }
    if (sceneUniforms.u_rPhotonSphere) {
      sceneUniforms.u_rPhotonSphere.value = u.u_rPhotonSphere;
    }

    this._dirty = false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // YANGILASH
  // ─────────────────────────────────────────────────────────────────────────

  update(delta, elapsed) {
    // Foton halqa statik — lekin overlay'ga engil pulsatsiya qo'shish mumkin
    if (this._showOverlay && this._group.children.length > 0) {
      // Engil pulsatsiya — foton halqa "tirik" ko'rinsin
      const pulse = 1.0 + Math.sin(elapsed * 2.0) * 0.05;
      this._group.children.forEach(child => {
        if (child.material && child.material.opacity !== undefined) {
          const baseOpacity = child.userData.baseOpacity || child.material.opacity;
          if (!child.userData.baseOpacity) child.userData.baseOpacity = baseOpacity;
          child.material.opacity = baseOpacity * pulse;
        }
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HUD
  // ─────────────────────────────────────────────────────────────────────────

  getHUDInfo() {
    return {
      radius: this._rPhotonSphere.toFixed(4) + ' M',
      intensity: this._intensity.toFixed(1),
      subRings: this._subRingCount,
      brightestRing: 'n=1, I=' + this._subRings[0].intensity.toFixed(2),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERLAR
  // ─────────────────────────────────────────────────────────────────────────

  get object3D() { return this._group; }
  get intensity() { return this._intensity; }
  get rPhotonSphere() { return this._rPhotonSphere; }
  get subRings() { return this._subRings; }
  get color() { return this._color; }

  // ─────────────────────────────────────────────────────────────────────────
  // TOZALASH
  // ─────────────────────────────────────────────────────────────────────────

  dispose() {
    this._group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    this._group.clear();
  }
}