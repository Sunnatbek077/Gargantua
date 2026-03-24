/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Camera System
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * To'liq kamera boshqaruv tizimi:
 *   - Orbital boshqaruv (sichqoncha bilan aylantirish/zoom)
 *   - Preset o'tishlari (silliq animatsiya)
 *   - Kinematografik yo'llar (Catmull-Rom spline)
 *   - Gravitatsion tebranish (shake)
 *   - Shader uchun parametrlar tayyorlash
 *
 * Formula:
 *   #34 — rayDir = normalize(right·u + up·v + forward·focalLength)
 *          Perspektiv proektsiya — har piksel uchun nur yo'nalishi
 *
 * Bog'liqliklar: Three.js, CameraConfig
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import CameraConfig from '../../config/camera.config.js';

export default class Camera {

  // ─────────────────────────────────────────────────────────────────────────
  // KONSTRUKTOR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {HTMLCanvasElement} canvas - Render canvas (aspect ratio uchun)
   */
  constructor(canvas) {
    this._canvas = canvas;
    this._config = CameraConfig;
    const defaults = this._config.defaults;

    // ── Three.js PerspectiveCamera ──
    const aspect = canvas.clientWidth / canvas.clientHeight;
    this._camera = new THREE.PerspectiveCamera(
      defaults.fov,
      aspect,
      defaults.near,
      defaults.far
    );
    this._camera.position.set(...defaults.position);
    this._camera.lookAt(new THREE.Vector3(...defaults.lookAt));
    this._camera.up.set(...defaults.up);

    // ── Orbital boshqaruv holati ──
    this._spherical = new THREE.Spherical();
    this._spherical.setFromVector3(
      new THREE.Vector3(...defaults.position)
    );
    this._target = new THREE.Vector3(...defaults.lookAt);

    // Damping uchun tezlik
    this._sphericalDelta = new THREE.Spherical();
    this._panOffset = new THREE.Vector3();

    // Sichqoncha holati
    this._isPointerDown = false;
    this._pointerStart = new THREE.Vector2();
    this._pointerCurrent = new THREE.Vector2();

    // Zoom holati
    this._zoomScale = 1.0;

    // ── Preset o'tish animatsiyasi ──
    this._transition = {
      active: false,
      startPosition: new THREE.Vector3(),
      endPosition: new THREE.Vector3(),
      startLookAt: new THREE.Vector3(),
      endLookAt: new THREE.Vector3(),
      startFov: defaults.fov,
      endFov: defaults.fov,
      progress: 0,
      duration: 0,
      easingFn: null,
    };

    // ── Kinematografik yo'l ──
    this._cinematic = {
      active: false,
      path: null,
      progress: 0,
      duration: 0,
      loop: false,
    };

    // ── Shake (tebranish) ──
    this._shake = {
      offset: new THREE.Vector3(),
      time: 0,
    };

    // ── Avtomatik aylanish ──
    this._autoRotateAngle = 0;

    // ── Shader uchun uniform qiymatlar ──
    this._uniforms = {
      cameraPosition: new THREE.Vector3(),
      cameraDirection: new THREE.Vector3(),
      cameraRight: new THREE.Vector3(),
      cameraUp: new THREE.Vector3(),
      focalLength: 1.0,
      aspectRatio: aspect,
    };

    // ── Event listener'larni o'rnatish ──
    this._bindEvents();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ASOSIY YANGILASH — har kadr chaqiriladi
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Kamera holatini yangilash
   *
   * @param {number} delta - Delta time (soniya)
   * @param {number} elapsed - Umumiy vaqt (soniya)
   * @param {number} [cameraDistance] - Qora tuynukdan masofa (shake uchun)
   */
  update(delta, elapsed, cameraDistance) {
    // Preset o'tish animatsiyasi
    if (this._transition.active) {
      this._updateTransition(delta);
    }
    // Kinematografik yo'l
    else if (this._cinematic.active) {
      this._updateCinematic(delta);
    }
    // Oddiy orbital boshqaruv
    else {
      this._updateOrbital(delta);
    }

    // Gravitatsion tebranish
    if (this._config.shake.enabled && cameraDistance !== undefined) {
      this._updateShake(delta, cameraDistance);
    }

    // Shader uniform'larni yangilash
    this._updateUniforms();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ORBITAL BOSHQARUV
  // ─────────────────────────────────────────────────────────────────────────

  /** @private */
  _updateOrbital(delta) {
    const orbit = this._config.orbit;

    // Avtomatik aylanish
    if (orbit.autoRotate && !this._isPointerDown) {
      this._autoRotateAngle += orbit.autoRotateSpeed * delta;
      this._sphericalDelta.theta -= orbit.autoRotateSpeed * delta;
    }

    // Damping — silliq sekinlashish
    if (orbit.enableDamping) {
      this._spherical.theta += this._sphericalDelta.theta * orbit.dampingFactor;
      this._spherical.phi += this._sphericalDelta.phi * orbit.dampingFactor;

      this._sphericalDelta.theta *= (1 - orbit.dampingFactor);
      this._sphericalDelta.phi *= (1 - orbit.dampingFactor);
    } else {
      this._spherical.theta += this._sphericalDelta.theta;
      this._spherical.phi += this._sphericalDelta.phi;
      this._sphericalDelta.set(this._spherical.radius, 0, 0);
    }

    // Burchak cheklovlari
    this._spherical.phi = Math.max(
      orbit.minPolarAngle,
      Math.min(orbit.maxPolarAngle, this._spherical.phi)
    );

    // Zoom qo'llash
    this._spherical.radius *= this._zoomScale;
    this._spherical.radius = Math.max(
      orbit.minDistance,
      Math.min(orbit.maxDistance, this._spherical.radius)
    );
    this._zoomScale = 1.0; // Reset

    // Spherical → Cartesian
    const offset = new THREE.Vector3().setFromSpherical(this._spherical);
    this._camera.position.copy(this._target).add(offset);
    this._camera.lookAt(this._target);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRESET O'TISHLARI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Kamerani presetga silliq o'tkazish
   *
   * @param {string} presetName - Preset nomi ('wide', 'edgeOn', 'polar', ...)
   */
  transitionToPreset(presetName) {
    const preset = this._config.presets[presetName];
    if (!preset) {
      console.warn(`Camera preset "${presetName}" topilmadi`);
      return this;
    }

    const t = this._transition;
    t.active = true;
    t.progress = 0;
    t.duration = preset.transitionDuration;

    // Boshlang'ich holat
    t.startPosition.copy(this._camera.position);
    t.startLookAt.copy(this._target);
    t.startFov = this._camera.fov;

    // Maqsad holat
    t.endPosition.set(...preset.position);
    t.endLookAt.set(...preset.lookAt);
    t.endFov = preset.fov;

    // Easing funksiya
    t.easingFn = this._config.easing[preset.easing] || this._config.easing.easeInOutCubic;

    return this;
  }

  /** @private */
  _updateTransition(delta) {
    const t = this._transition;
    t.progress += delta / t.duration;

    if (t.progress >= 1.0) {
      t.progress = 1.0;
      t.active = false;

      // Orbital holatini yangi pozitsiyaga sinxronlash
      this._spherical.setFromVector3(
        t.endPosition.clone().sub(t.endLookAt)
      );
      this._target.copy(t.endLookAt);
    }

    const ease = t.easingFn(t.progress);

    // Pozitsiya interpolatsiya
    this._camera.position.lerpVectors(t.startPosition, t.endPosition, ease);

    // LookAt interpolatsiya
    const lookAt = new THREE.Vector3().lerpVectors(t.startLookAt, t.endLookAt, ease);
    this._camera.lookAt(lookAt);

    // FOV interpolatsiya
    this._camera.fov = THREE.MathUtils.lerp(t.startFov, t.endFov, ease);
    this._camera.updateProjectionMatrix();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // KINEMATOGRAFIK YO'LLAR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Kinematografik kamera yo'lini ishga tushirish
   *
   * @param {string} pathName - Yo'l nomi ('discovery', 'orbit', 'dive')
   */
  playCinematicPath(pathName) {
    const path = this._config.cinematicPaths[pathName];
    if (!path) {
      console.warn(`Cinematic path "${pathName}" topilmadi`);
      return this;
    }

    this._cinematic.active = true;
    this._cinematic.path = path;
    this._cinematic.progress = 0;
    this._cinematic.duration = path.duration;
    this._cinematic.loop = path.loop;

    return this;
  }

  /**
   * Kinematografik yo'lni to'xtatish
   */
  stopCinematicPath() {
    this._cinematic.active = false;
    this._cinematic.path = null;

    // Orbital holatini hozirgi pozitsiyaga sinxronlash
    this._spherical.setFromVector3(
      this._camera.position.clone().sub(this._target)
    );

    return this;
  }

  /** @private */
  _updateCinematic(delta) {
    const cin = this._cinematic;
    cin.progress += delta / cin.duration;

    if (cin.progress >= 1.0) {
      if (cin.loop) {
        cin.progress -= 1.0;
      } else {
        cin.progress = 1.0;
        cin.active = false;
      }
    }

    const keyframes = cin.path.keyframes;
    const t = cin.progress;

    // Keyframe'lar orasida Catmull-Rom interpolatsiya
    const result = this._interpolateKeyframes(keyframes, t);

    this._camera.position.set(...result.position);
    const lookAt = new THREE.Vector3(...result.lookAt);
    this._camera.lookAt(lookAt);
    this._target.copy(lookAt);

    if (result.fov !== this._camera.fov) {
      this._camera.fov = result.fov;
      this._camera.updateProjectionMatrix();
    }
  }

  /**
   * Catmull-Rom spline interpolatsiya
   * Keyframe'lar orasida silliq egri chiziq
   *
   * @private
   * @param {Array} keyframes - {time, position, lookAt, fov} massivi
   * @param {number} t - Progress [0, 1]
   * @returns {{position: number[], lookAt: number[], fov: number}}
   */
  _interpolateKeyframes(keyframes, t) {
    // Hozirgi t uchun atrofdagi 4 ta keyframe'ni topish
    let i1 = 0;
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (t >= keyframes[i].time && t <= keyframes[i + 1].time) {
        i1 = i;
        break;
      }
    }

    const i0 = Math.max(0, i1 - 1);
    const i2 = Math.min(keyframes.length - 1, i1 + 1);
    const i3 = Math.min(keyframes.length - 1, i1 + 2);

    const kf0 = keyframes[i0];
    const kf1 = keyframes[i1];
    const kf2 = keyframes[i2];
    const kf3 = keyframes[i3];

    // Segment ichidagi lokal t
    const segmentLength = kf2.time - kf1.time;
    const localT = segmentLength > 0 ? (t - kf1.time) / segmentLength : 0;

    // Catmull-Rom har bir komponent uchun
    const position = [
      this._catmullRom(kf0.position[0], kf1.position[0], kf2.position[0], kf3.position[0], localT),
      this._catmullRom(kf0.position[1], kf1.position[1], kf2.position[1], kf3.position[1], localT),
      this._catmullRom(kf0.position[2], kf1.position[2], kf2.position[2], kf3.position[2], localT),
    ];

    const lookAt = [
      this._catmullRom(kf0.lookAt[0], kf1.lookAt[0], kf2.lookAt[0], kf3.lookAt[0], localT),
      this._catmullRom(kf0.lookAt[1], kf1.lookAt[1], kf2.lookAt[1], kf3.lookAt[1], localT),
      this._catmullRom(kf0.lookAt[2], kf1.lookAt[2], kf2.lookAt[2], kf3.lookAt[2], localT),
    ];

    const fov = this._catmullRom(kf0.fov, kf1.fov, kf2.fov, kf3.fov, localT);

    return { position, lookAt, fov };
  }

  /**
   * Catmull-Rom spline interpolatsiya (1D)
   *
   * @private
   * @param {number} p0 - Oldingi nuqta
   * @param {number} p1 - Boshlang'ich nuqta
   * @param {number} p2 - Yakuniy nuqta
   * @param {number} p3 - Keyingi nuqta
   * @param {number} t  - Interpolatsiya [0, 1]
   * @returns {number}
   */
  _catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
      (2.0 * p1) +
      (-p0 + p2) * t +
      (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 +
      (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GRAVITATSION TEBRANISH (SHAKE)
  // ─────────────────────────────────────────────────────────────────────────

  /** @private */
  _updateShake(delta, cameraDistance) {
    const shakeConfig = this._config.shake;
    const s = this._shake;

    if (cameraDistance >= shakeConfig.startDistance) {
      // Uzoqda — tebranish yo'q
      s.offset.set(0, 0, 0);
      return;
    }

    s.time += delta;

    // Masofa-kuch bog'liqligi
    // amplitude = maxAmplitude * (startDistance / currentDistance)^falloff
    const ratio = shakeConfig.startDistance / Math.max(cameraDistance, 0.1);
    const amplitude = shakeConfig.maxAmplitude * Math.pow(ratio, shakeConfig.falloffExponent);
    const freq = shakeConfig.frequency;

    // 3D tebranish — turli chastotalar har o'qda
    s.offset.set(
      Math.sin(s.time * freq * 6.28318) * amplitude * 0.001,
      Math.cos(s.time * freq * 7.13274) * amplitude * 0.001,
      Math.sin(s.time * freq * 5.37921) * amplitude * 0.0005
    );

    this._camera.position.add(s.offset);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SHADER UNIFORM'LARNI YANGILASH
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * ── Formula #34: Perspektiv proektsiya (ray generation) ──
   * rayDir = normalize(right * u + up * v + forward * focalLength)
   *
   * Bu qiymatlar shader'ga yuboriladi — har piksel uchun
   * nur yo'nalishini hisoblash uchun ishlatiladi
   *
   * @private
   */
  _updateUniforms() {
    const cam = this._camera;
    const u = this._uniforms;

    // Kamera pozitsiyasi
    u.cameraPosition.copy(cam.position);

    // Kamera yo'nalish vektorlari (world space)
    cam.getWorldDirection(u.cameraDirection);

    // Right vektor = direction × up
    u.cameraRight.crossVectors(u.cameraDirection, cam.up).normalize();

    // Up vektor (kameraga nisbatan) = right × direction
    u.cameraUp.crossVectors(u.cameraRight, u.cameraDirection).normalize();

    // ── Focal length — FOV dan hisoblash ──
    // focalLength = 1.0 / tan(fov * 0.5 * π / 180)
    u.focalLength = 1.0 / Math.tan(
      THREE.MathUtils.degToRad(cam.fov) * 0.5
    );

    // Aspect ratio
    u.aspectRatio = cam.aspect;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SICHQONCHA/TOUCH HODISALARI
  // ─────────────────────────────────────────────────────────────────────────

  /** @private */
  _bindEvents() {
    const canvas = this._canvas;

    // Sichqoncha
    canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    canvas.addEventListener('pointermove', (e) => this._onPointerMove(e));
    canvas.addEventListener('pointerup', () => this._onPointerUp());
    canvas.addEventListener('pointerleave', () => this._onPointerUp());

    // Zoom (scroll)
    canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });

    // Oyna o'lcham o'zgarishi
    window.addEventListener('resize', () => this._onResize());
  }

  /** @private */
  _onPointerDown(event) {
    // Kinematografik yo'l paytida — bosish bilan to'xtatish
    if (this._cinematic.active) {
      this.stopCinematicPath();
    }

    // Preset o'tish paytida — bekor qilish
    if (this._transition.active) {
      this._transition.active = false;
      this._spherical.setFromVector3(
        this._camera.position.clone().sub(this._target)
      );
    }

    this._isPointerDown = true;
    this._pointerStart.set(event.clientX, event.clientY);
    this._pointerCurrent.copy(this._pointerStart);
  }

  /** @private */
  _onPointerMove(event) {
    if (!this._isPointerDown) return;

    this._pointerCurrent.set(event.clientX, event.clientY);
    const orbit = this._config.orbit;

    // Delta hisoblash
    const deltaX = (this._pointerCurrent.x - this._pointerStart.x) / this._canvas.clientHeight;
    const deltaY = (this._pointerCurrent.y - this._pointerStart.y) / this._canvas.clientHeight;

    // Aylantirish (theta = gorizontal, phi = vertikal)
    this._sphericalDelta.theta -= deltaX * orbit.rotateSpeed * Math.PI * 2;
    this._sphericalDelta.phi -= deltaY * orbit.rotateSpeed * Math.PI;

    this._pointerStart.copy(this._pointerCurrent);
  }

  /** @private */
  _onPointerUp() {
    this._isPointerDown = false;
  }

  /** @private */
  _onWheel(event) {
    event.preventDefault();
    const orbit = this._config.orbit;

    if (event.deltaY > 0) {
      // Uzoqlashtirish
      this._zoomScale *= 1.0 + orbit.zoomSpeed * 0.05;
    } else if (event.deltaY < 0) {
      // Yaqinlashtirish
      this._zoomScale *= 1.0 - orbit.zoomSpeed * 0.05;
    }
  }

  /** @private */
  _onResize() {
    const width = this._canvas.clientWidth;
    const height = this._canvas.clientHeight;

    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
    this._uniforms.aspectRatio = this._camera.aspect;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TASHQI API
  // ─────────────────────────────────────────────────────────────────────────

  /** Three.js camera ob'ekti */
  get native() {
    return this._camera;
  }

  /** Shader uchun uniform qiymatlar */
  get uniforms() {
    return this._uniforms;
  }

  /** Qora tuynukdan masofa */
  get distanceToTarget() {
    return this._camera.position.distanceTo(this._target);
  }

  /** Hozirgi pozitsiya (clone) */
  get position() {
    return this._camera.position.clone();
  }

  /** Kamera yo'nalishi */
  get direction() {
    return this._uniforms.cameraDirection.clone();
  }

  /** Preset nomlari ro'yxati */
  get presetNames() {
    return Object.keys(this._config.presets);
  }

  /** Kinematografik yo'l nomlari */
  get cinematicPathNames() {
    return Object.keys(this._config.cinematicPaths);
  }

  /** Kinematografik yo'l faolmi? */
  get isCinematicActive() {
    return this._cinematic.active;
  }

  /** Preset o'tish faolmi? */
  get isTransitioning() {
    return this._transition.active;
  }

  /**
   * Tozalash — event listener'larni olib tashlash
   */
  dispose() {
    // Event listener'lar canvas bilan birga yo'q bo'ladi
    this._camera = null;
    this._canvas = null;
  }
}