/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Relativistic Jet Stream
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Relativistik jet oqimlari — qora tuynukning qutb o'qlaridan
 * otiladigan plazma oqimlari.
 *
 * Fizik mohiyat:
 *   Accretion diskdan kelgan material qora tuynukning magnit
 *   maydoni bilan yo'naltiriladi va qutb yo'nalishida
 *   yorug'lik tezligiga yaqin tezlikda otiladi.
 *
 *   Gargantua'da jet bor-yo'qligi bahsli — lekin vizual
 *   jihatdan juda ta'sirli. Shuning uchun ixtiyoriy (toggleable).
 *
 * Vizualizatsiya usuli:
 *   - Konus shaklida zarrachalar tizimi (particle system)
 *   - Bazada yorqin (ko'k-oq), tashqariga qarab xiraalashadi
 *   - Turbulent tuzilma (noise bilan)
 *   - Vaqt bo'yicha animatsiya (oqim harakati)
 *   - Doppler beaming — sizga qarab yo'nalgan jet yorqinroq
 *
 * Bu modul to'liq Three.js asosida — shader'da alohida ishlanmaydi.
 * Sabab: jet ray marching bilan emas, particle system bilan chiroyliroq.
 *
 * Bog'liqliklar: Three.js
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';

export default class JetStream {

  /**
   * @param {Object} [options]
   * @param {boolean} [options.visible=false] - Boshlang'ich ko'rinish
   * @param {number} [options.length=30] - Jet uzunligi (M)
   * @param {number} [options.baseRadius=0.3] - Baza radiusi (M)
   * @param {number} [options.coneAngle=5] - Konus burchagi (daraja)
   * @param {number} [options.particleCount=3000] - Zarrachalar soni
   * @param {number} [options.speed=0.8] - Oqim tezligi (c ga nisbatan)
   * @param {number} [options.intensity=1.0] - Yorqinlik
   */
  constructor(options = {}) {
    this._visible = options.visible || false;
    this._length = options.length || 30;
    this._baseRadius = options.baseRadius || 0.3;
    this._coneAngle = (options.coneAngle || 5) * Math.PI / 180;
    this._particleCount = options.particleCount || 3000;
    this._speed = options.speed || 0.8;
    this._intensity = options.intensity || 1.0;

    // ── Three.js ──
    this._group = new THREE.Group();
    this._group.name = 'JetStream';
    this._group.visible = this._visible;

    // ── Zarrachalar tizimi ──
    this._topJet = null;      // Yuqori jet (+Y)
    this._bottomJet = null;   // Pastki jet (-Y)

    // ── Material ──
    this._material = null;

    // ── Animatsiya ──
    this._elapsed = 0;

    // Yaratish
    this._build();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QURISH
  // ─────────────────────────────────────────────────────────────────────────

  /** @private */
  _build() {
    // Ikkala jet uchun umumiy material
    this._material = new THREE.PointsMaterial({
      size: 0.15,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
    });

    // Yuqori jet
    this._topJet = this._createJetParticles(1);
    this._topJet.name = 'JetTop';
    this._group.add(this._topJet);

    // Pastki jet (teskari yo'nalish)
    this._bottomJet = this._createJetParticles(-1);
    this._bottomJet.name = 'JetBottom';
    this._group.add(this._bottomJet);

    // Baza glow — jet chiqish nuqtasi
    this._createBaseGlow();
  }

  /**
   * Bitta jet uchun zarrachalar tizimini yaratish
   *
   * @private
   * @param {number} direction - +1 yuqoriga, -1 pastga
   * @returns {THREE.Points}
   */
  _createJetParticles(direction) {
    const count = this._particleCount;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    // ── Zarrachalarni konus bo'ylab taqsimlash ──
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Konus bo'ylab masofa (eksponensial — bazada zichroq)
      const t = Math.pow(Math.random(), 0.7);  // 0...1, bazada ko'proq
      const distance = t * this._length;

      // Konus radiusi — masofaga proporsional
      const coneR = this._baseRadius + distance * Math.tan(this._coneAngle);

      // Doiraviy tasodifiy pozitsiya
      const angle = Math.random() * Math.PI * 2;
      const radialDist = Math.random() * coneR;

      positions[i3]     = Math.cos(angle) * radialDist;                    // X
      positions[i3 + 1] = direction * (distance + this._baseRadius * 2);   // Y (vertikal)
      positions[i3 + 2] = Math.sin(angle) * radialDist;                    // Z

      // ── Rang — masofaga bog'liq ──
      // Baza: yorqin ko'k-oq (juda issiq plazma)
      // O'rta: oq
      // Tashqi: xira sariqcha (sovugan plazma)
      const tempFactor = 1.0 - t;  // Bazada 1, tashqida 0

      if (tempFactor > 0.7) {
        // Baza — ko'k-oq
        colors[i3]     = 0.6 + tempFactor * 0.4;   // R
        colors[i3 + 1] = 0.7 + tempFactor * 0.3;   // G
        colors[i3 + 2] = 1.0;                       // B
      } else if (tempFactor > 0.3) {
        // O'rta — oq-sariq
        const s = (tempFactor - 0.3) / 0.4;
        colors[i3]     = 1.0;
        colors[i3 + 1] = 0.7 + s * 0.3;
        colors[i3 + 2] = 0.4 + s * 0.6;
      } else {
        // Tashqi — xira to'q sariq
        const s = tempFactor / 0.3;
        colors[i3]     = 0.6 + s * 0.4;
        colors[i3 + 1] = 0.3 + s * 0.4;
        colors[i3 + 2] = 0.1 + s * 0.3;
      }

      // Yorqinlik — masofaga qarab kamayadi
      const brightnessDecay = Math.pow(tempFactor, 0.5);
      colors[i3]     *= brightnessDecay * this._intensity;
      colors[i3 + 1] *= brightnessDecay * this._intensity;
      colors[i3 + 2] *= brightnessDecay * this._intensity;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Boshlang'ich pozitsiyalarni saqlash (animatsiya uchun)
    geometry.userData = {
      basePositions: new Float32Array(positions),
      direction: direction,
    };

    return new THREE.Points(geometry, this._material);
  }

  /**
   * Jet bazasi glow effekti
   * @private
   */
  _createBaseGlow() {
    const glowGeom = new THREE.SphereGeometry(this._baseRadius * 1.5, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.12 * this._intensity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Yuqori baza
    const topGlow = new THREE.Mesh(glowGeom, glowMat);
    topGlow.position.y = this._baseRadius * 2;
    topGlow.name = 'JetBaseGlowTop';
    this._group.add(topGlow);

    // Pastki baza
    const bottomGlow = new THREE.Mesh(glowGeom.clone(), glowMat.clone());
    bottomGlow.position.y = -this._baseRadius * 2;
    bottomGlow.name = 'JetBaseGlowBottom';
    this._group.add(bottomGlow);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ANIMATSIYA — har kadr
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Jet animatsiyasini yangilash
   *
   * @param {number} delta - Delta vaqt
   * @param {number} elapsed - Umumiy vaqt
   */
  update(delta, elapsed) {
    if (!this._visible) return;

    this._elapsed = elapsed;

    // Ikkala jet'ni animatsiya qilish
    this._animateJet(this._topJet, elapsed);
    this._animateJet(this._bottomJet, elapsed);
  }

  /**
   * Bitta jet'ning zarrachalarini animatsiya qilish
   * @private
   */
  _animateJet(jetPoints, elapsed) {
    if (!jetPoints || !jetPoints.geometry) return;

    const positions = jetPoints.geometry.attributes.position.array;
    const basePositions = jetPoints.geometry.userData.basePositions;
    const direction = jetPoints.geometry.userData.direction;
    const count = positions.length / 3;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Bazadagi pozitsiya
      const bx = basePositions[i3];
      const by = basePositions[i3 + 1];
      const bz = basePositions[i3 + 2];

      // Masofani hisoblash (bazadan)
      const dist = Math.abs(by - direction * this._baseRadius * 2);
      const t = dist / this._length;

      // ── Oqim harakati — zarrachalar yuqoriga harakatlanadi ──
      const flowOffset = (elapsed * this._speed * 5.0 + i * 0.01) % this._length;
      const newDist = (dist + flowOffset) % this._length;
      const newY = direction * (newDist + this._baseRadius * 2);

      // ── Turbulent tebranish ──
      // Bazada kam, tashqida ko'proq
      const turbulence = t * 0.3;
      const noiseX = Math.sin(elapsed * 3.0 + i * 0.5) * turbulence;
      const noiseZ = Math.cos(elapsed * 2.7 + i * 0.7) * turbulence;

      // ── Konus kengayishi ──
      const expansionFactor = 1.0 + (newDist / this._length) * Math.tan(this._coneAngle) * 3.0;

      positions[i3]     = bx * expansionFactor + noiseX;
      positions[i3 + 1] = newY;
      positions[i3 + 2] = bz * expansionFactor + noiseZ;
    }

    jetPoints.geometry.attributes.position.needsUpdate = true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PARAMETR BOSHQARUVI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Jet ko'rinishini almashtirish
   */
  toggle() {
    this._visible = !this._visible;
    this._group.visible = this._visible;
    return this;
  }

  /**
   * Jet ko'rinishini o'rnatish
   * @param {boolean} visible
   */
  setVisible(visible) {
    this._visible = visible;
    this._group.visible = visible;
    return this;
  }

  /**
   * Jet intensivligini o'zgartirish
   * @param {number} intensity - [0, 3]
   */
  setIntensity(intensity) {
    this._intensity = Math.max(0, Math.min(3, intensity));
    // Material opacity yangilash
    if (this._material) {
      this._material.opacity = 0.6 * this._intensity;
    }
    return this;
  }

  /**
   * Jet tezligini o'zgartirish
   * @param {number} speed - [0, 1] v/c
   */
  setSpeed(speed) {
    this._speed = Math.max(0, Math.min(0.999, speed));
    return this;
  }

  /**
   * Jet uzunligini o'zgartirish
   * @param {number} length - [5, 100] M
   */
  setLength(length) {
    this._length = Math.max(5, Math.min(100, length));
    // Zarrachalarni qayta yaratish kerak
    this._rebuild();
    return this;
  }

  /**
   * Barcha parametrlarni o'zgartirish va qayta qurish
   * @param {Object} params
   */
  setParams(params) {
    if (params.visible !== undefined) this._visible = params.visible;
    if (params.length !== undefined) this._length = params.length;
    if (params.speed !== undefined) this._speed = params.speed;
    if (params.intensity !== undefined) this._intensity = params.intensity;
    if (params.particleCount !== undefined) this._particleCount = params.particleCount;
    if (params.coneAngle !== undefined) this._coneAngle = params.coneAngle * Math.PI / 180;

    this._rebuild();
    return this;
  }

  /** @private */
  _rebuild() {
    // Eski meshlarni tozalash
    this._group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material && child !== this._group) child.material.dispose();
    });
    this._group.clear();

    // Qayta qurish
    this._build();
    this._group.visible = this._visible;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HUD
  // ─────────────────────────────────────────────────────────────────────────

  getHUDInfo() {
    return {
      visible: this._visible,
      speed: (this._speed * 100).toFixed(0) + '% c',
      length: this._length.toFixed(0) + ' M',
      particles: this._particleCount,
      intensity: this._intensity.toFixed(1),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERLAR
  // ─────────────────────────────────────────────────────────────────────────

  get object3D() { return this._group; }
  get visible() { return this._visible; }
  get speed() { return this._speed; }
  get length() { return this._length; }
  get intensity() { return this._intensity; }

  // ─────────────────────────────────────────────────────────────────────────
  // TOZALASH
  // ─────────────────────────────────────────────────────────────────────────

  dispose() {
    this._group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    this._group.clear();
    this._material = null;
  }
}