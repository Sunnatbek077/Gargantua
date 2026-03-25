/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Orbit Controls Wrapper
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Camera orbit boshqaruvini kengaytirish:
 *   - Touch/mobil (pinch zoom, ikki barmoqli aylantirish)
 *   - Inertia nozik sozlash
 *   - Zoom/burchak cheklovlarini dinamik o'zgartirish
 *   - Auto-rotate boshqaruvi
 *
 * Bog'liqliklar: Camera, CameraConfig
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import CameraConfig from '../../config/camera.config.js';

export default class OrbitControls {

  /**
   * @param {Camera} camera
   * @param {HTMLCanvasElement} canvas
   */
  constructor(camera, canvas) {
    this._camera = camera;
    this._canvas = canvas;
    this._config = CameraConfig.orbit;
    this._enabled = true;

    // Touch holati
    this._touches = [];
    this._prevTouchDist = 0;
    this._prevTouchAngle = 0;

    // Cheklovlar
    this._minDistance = this._config.minDistance;
    this._maxDistance = this._config.maxDistance;
    this._minPolarAngle = this._config.minPolarAngle;
    this._maxPolarAngle = this._config.maxPolarAngle;

    // Auto-rotate
    this._autoRotate = this._config.autoRotate;
    this._autoRotateSpeed = this._config.autoRotateSpeed;
    this._autoRotatePaused = false;

    // Inertia
    this._dampingFactor = this._config.dampingFactor;

    this._bindTouchEvents();
  }

  // ─── Touch ──────────────────────────────────────────────────────────────

  /** @private */
  _bindTouchEvents() {
    const opts = { passive: false };
    this._canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), opts);
    this._canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), opts);
    this._canvas.addEventListener('touchend', (e) => this._onTouchEnd(e));
  }

  /** @private */
  _onTouchStart(event) {
    if (!this._enabled) return;
    event.preventDefault();
    this._touches = Array.from(event.touches);

    if (this._touches.length === 2) {
      this._prevTouchDist = this._getTouchDistance();
      this._prevTouchAngle = this._getTouchAngle();
    }
    this._autoRotatePaused = true;
  }

  /** @private */
  _onTouchMove(event) {
    if (!this._enabled) return;
    event.preventDefault();
    this._touches = Array.from(event.touches);

    if (this._touches.length === 2) {
      // Pinch zoom
      const dist = this._getTouchDistance();
      const zoomDelta = this._prevTouchDist / dist;
      if (this._camera._zoomScale !== undefined) {
        this._camera._zoomScale *= zoomDelta;
      }
      this._prevTouchDist = dist;

      // Ikki barmoqli aylanish
      const angle = this._getTouchAngle();
      const angleDelta = angle - this._prevTouchAngle;
      if (this._camera._sphericalDelta) {
        this._camera._sphericalDelta.theta -= angleDelta * 0.5;
      }
      this._prevTouchAngle = angle;
    }
  }

  /** @private */
  _onTouchEnd(event) {
    this._touches = Array.from(event.touches);
    if (this._touches.length === 0) {
      setTimeout(() => { this._autoRotatePaused = false; }, 2000);
    }
  }

  /** @private */
  _getTouchDistance() {
    if (this._touches.length < 2) return 1;
    const dx = this._touches[0].clientX - this._touches[1].clientX;
    const dy = this._touches[0].clientY - this._touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** @private */
  _getTouchAngle() {
    if (this._touches.length < 2) return 0;
    return Math.atan2(
      this._touches[1].clientY - this._touches[0].clientY,
      this._touches[1].clientX - this._touches[0].clientX
    );
  }

  // ─── Parametrlar ───────────────────────────────────────────────────────

  setDistanceLimits(min, max) {
    this._minDistance = min; this._maxDistance = max;
    this._config.minDistance = min; this._config.maxDistance = max;
    return this;
  }

  setPolarLimits(min, max) {
    this._minPolarAngle = min; this._maxPolarAngle = max;
    this._config.minPolarAngle = min; this._config.maxPolarAngle = max;
    return this;
  }

  setAutoRotate(enabled, speed) {
    this._autoRotate = enabled; this._config.autoRotate = enabled;
    if (speed !== undefined) { this._autoRotateSpeed = speed; this._config.autoRotateSpeed = speed; }
    return this;
  }

  setDamping(factor) { this._dampingFactor = factor; this._config.dampingFactor = factor; return this; }
  setZoomSpeed(s) { this._config.zoomSpeed = s; return this; }
  setRotateSpeed(s) { this._config.rotateSpeed = s; return this; }

  // ─── Getterlar ─────────────────────────────────────────────────────────

  get enabled() { return this._enabled; }
  set enabled(val) { this._enabled = val; }
  get autoRotate() { return this._autoRotate && !this._autoRotatePaused; }
  get distance() { return this._camera.distanceToTarget; }

  getSettings() {
    return {
      minDistance: this._minDistance, maxDistance: this._maxDistance,
      minPolar: this._minPolarAngle, maxPolar: this._maxPolarAngle,
      damping: this._dampingFactor,
      autoRotate: this._autoRotate, autoRotateSpeed: this._autoRotateSpeed,
    };
  }

  dispose() { this._camera = null; this._canvas = null; this._touches = []; }
}