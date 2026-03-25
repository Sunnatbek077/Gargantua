/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Camera Path Controller
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Kinematografik kamera yo'llari boshqaruvi.
 *
 * CameraConfig'dagi yo'llarni boshqaradi:
 *   - discovery: uzoqdan yaqinlashib, disk atrofida aylanib qaytish
 *   - orbit: qora tuynuk atrofida barqaror doiraviy harakat
 *   - dive: disk tekisligida yaqinlashib gorizont yaqinida to'xtash
 *
 * Qo'shimcha imkoniyatlar:
 *   - Yo'llarni ketma-ket ijro etish (playlist)
 *   - Ijro tezligini o'zgartirish (slow-motion, fast-forward)
 *   - Yo'l davomida callback'lar (progress event)
 *   - Yo'lni teskari ijro etish
 *   - Yo'l tugaganda avtomatik keyingisiga o'tish
 *
 * Bog'liqliklar: Camera, CameraConfig
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import CameraConfig from '../../config/camera.config.js';

export default class CameraPath {

  /**
   * @param {Camera} camera — Camera moduli (src/core/Camera.js)
   */
  constructor(camera) {
    this._camera = camera;
    this._paths = CameraConfig.cinematicPaths;

    // ── Ijro holati ──
    this._currentPath = null;      // Hozirgi yo'l nomi
    this._playing = false;
    this._playbackSpeed = 1.0;     // 0.5 = sekin, 2.0 = tez
    this._progress = 0;            // 0...1

    // ── Playlist ──
    this._playlist = [];           // Yo'l nomlari ketma-ketligi
    this._playlistIndex = -1;
    this._playlistLoop = false;

    // ── Callback'lar ──
    this._onProgressCallbacks = [];
    this._onCompleteCallbacks = [];
    this._onPathChangeCallbacks = [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // IJRO BOSHQARUVI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Bitta yo'lni ijro etish
   *
   * @param {string} pathName — 'discovery', 'orbit', 'dive'
   * @param {number} [speed=1.0] — ijro tezligi
   * @returns {CameraPath} this
   */
  play(pathName, speed) {
    const path = this._paths[pathName];
    if (!path) {
      console.warn(`Camera path "${pathName}" topilmadi`);
      return this;
    }

    this._currentPath = pathName;
    this._playing = true;
    this._progress = 0;
    if (speed !== undefined) this._playbackSpeed = speed;

    // Camera moduliga yo'lni uzatish
    this._camera.playCinematicPath(pathName);

    this._emitPathChange(pathName);
    return this;
  }

  /**
   * Ijroni to'xtatish
   */
  stop() {
    if (!this._playing) return this;

    this._camera.stopCinematicPath();
    this._playing = false;
    this._currentPath = null;
    this._progress = 0;

    return this;
  }

  /**
   * Ijroni pauza qilish / davom ettirish
   */
  togglePause() {
    if (!this._playing) return this;

    // Camera'ning cinematic holatini boshqarish
    if (this._camera.isCinematicActive) {
      this._camera.stopCinematicPath();
    } else if (this._currentPath) {
      this._camera.playCinematicPath(this._currentPath);
    }

    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PLAYLIST
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Yo'llar ketma-ketligini o'rnatish
   *
   * @param {string[]} pathNames — ['discovery', 'orbit', 'dive']
   * @param {boolean} [loop=false] — tugaganda qaytadan boshlash
   */
  setPlaylist(pathNames, loop = false) {
    this._playlist = pathNames.filter(name => this._paths[name]);
    this._playlistLoop = loop;
    this._playlistIndex = -1;
    return this;
  }

  /**
   * Playlistni boshlash
   */
  playPlaylist() {
    if (this._playlist.length === 0) return this;
    this._playlistIndex = 0;
    this.play(this._playlist[0]);
    return this;
  }

  /**
   * Keyingi yo'lga o'tish
   */
  next() {
    if (this._playlist.length === 0) return this;

    this._playlistIndex++;
    if (this._playlistIndex >= this._playlist.length) {
      if (this._playlistLoop) {
        this._playlistIndex = 0;
      } else {
        this.stop();
        this._emitComplete();
        return this;
      }
    }

    this.play(this._playlist[this._playlistIndex]);
    return this;
  }

  /**
   * Oldingi yo'lga qaytish
   */
  previous() {
    if (this._playlist.length === 0) return this;

    this._playlistIndex--;
    if (this._playlistIndex < 0) {
      this._playlistIndex = this._playlistLoop ? this._playlist.length - 1 : 0;
    }

    this.play(this._playlist[this._playlistIndex]);
    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // IJRO TEZLIGI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Ijro tezligini o'rnatish
   * @param {number} speed — 0.25 = 4x sekin, 1.0 = normal, 2.0 = 2x tez
   */
  setSpeed(speed) {
    this._playbackSpeed = Math.max(0.1, Math.min(5.0, speed));
    return this;
  }

  /** Sekinlashtirish */
  slower() { return this.setSpeed(this._playbackSpeed * 0.75); }

  /** Tezlashtirish */
  faster() { return this.setSpeed(this._playbackSpeed * 1.333); }

  /** Normal tezlik */
  normalSpeed() { return this.setSpeed(1.0); }

  // ─────────────────────────────────────────────────────────────────────────
  // YANGILASH — har kadr
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Har kadr chaqiriladi — progressni kuzatish
   *
   * @param {number} delta — Delta vaqt
   */
  update(delta) {
    if (!this._playing || !this._currentPath) return;

    const path = this._paths[this._currentPath];
    if (!path) return;

    // Progress hisoblash
    this._progress += (delta * this._playbackSpeed) / path.duration;

    // Progress callback
    this._emitProgress(this._progress);

    // Yo'l tugadimi?
    if (this._progress >= 1.0) {
      if (path.loop) {
        this._progress -= 1.0;
      } else {
        // Playlist'da keyingi yo'l bormi?
        if (this._playlist.length > 0 && this._playlistIndex < this._playlist.length - 1) {
          this.next();
        } else if (this._playlistLoop && this._playlist.length > 0) {
          this.next();
        } else {
          this.stop();
          this._emitComplete();
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRESETLARGA TEZKOR O'TISH
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Kamera presetiga silliq o'tish (yo'lsiz, faqat pozitsiya)
   *
   * @param {string} presetName — 'wide', 'edgeOn', 'polar', ...
   */
  goToPreset(presetName) {
    this.stop();  // Hozirgi yo'lni to'xtatish
    this._camera.transitionToPreset(presetName);
    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVENT TIZIMI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Progress callback
   * @param {Function} callback — callback(progress) progress: 0...1
   */
  onProgress(callback) {
    this._onProgressCallbacks.push(callback);
    return this;
  }

  /**
   * Yo'l tugaganda callback
   * @param {Function} callback
   */
  onComplete(callback) {
    this._onCompleteCallbacks.push(callback);
    return this;
  }

  /**
   * Yo'l o'zgarganda callback
   * @param {Function} callback — callback(pathName)
   */
  onPathChange(callback) {
    this._onPathChangeCallbacks.push(callback);
    return this;
  }

  /** @private */
  _emitProgress(progress) {
    for (const cb of this._onProgressCallbacks) cb(progress);
  }

  /** @private */
  _emitComplete() {
    for (const cb of this._onCompleteCallbacks) cb(this._currentPath);
  }

  /** @private */
  _emitPathChange(name) {
    for (const cb of this._onPathChangeCallbacks) cb(name);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MA'LUMOT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Mavjud yo'llar ro'yxati
   * @returns {Array<{name: string, label: string, duration: number, loop: boolean}>}
   */
  getAvailablePaths() {
    return Object.entries(this._paths).map(([name, path]) => ({
      name,
      label: path.label,
      duration: path.duration,
      loop: path.loop,
    }));
  }

  /** HUD uchun ma'lumot */
  getHUDInfo() {
    if (!this._playing) {
      return { playing: false, path: 'none' };
    }

    const path = this._paths[this._currentPath];
    return {
      playing: true,
      path: path ? path.label : this._currentPath,
      progress: (this._progress * 100).toFixed(0) + '%',
      speed: this._playbackSpeed.toFixed(1) + 'x',
      remaining: path ? ((1 - this._progress) * path.duration / this._playbackSpeed).toFixed(0) + 's' : '?',
      playlist: this._playlist.length > 0
        ? `${this._playlistIndex + 1}/${this._playlist.length}`
        : 'none',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERLAR
  // ─────────────────────────────────────────────────────────────────────────

  get playing() { return this._playing; }
  get currentPath() { return this._currentPath; }
  get progress() { return this._progress; }
  get speed() { return this._playbackSpeed; }
  get availablePathNames() { return Object.keys(this._paths); }

  // ─────────────────────────────────────────────────────────────────────────
  // TOZALASH
  // ─────────────────────────────────────────────────────────────────────────

  dispose() {
    this.stop();
    this._onProgressCallbacks.length = 0;
    this._onCompleteCallbacks.length = 0;
    this._onPathChangeCallbacks.length = 0;
    this._playlist = [];
    this._camera = null;
  }
}