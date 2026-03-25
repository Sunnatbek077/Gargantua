/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Keyboard Shortcuts
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Klaviatura boshqaruvi — tez buyruqlar.
 *
 * Tugmalar:
 *   1-6     — kamera presetlari (wide, edgeOn, polar, approach, horizon, behind)
 *   Space   — pauza / davom
 *   H       — GUI panelni ko'rsatish / yashirish
 *   F       — to'liq ekran (fullscreen)
 *   P       — screenshot olish
 *   R       — video yozishni boshlash / to'xtatish
 *   C       — kinematografik yo'lni boshlash
 *   Q / E   — sifatni pasaytirish / oshirish
 *   [ / ]   — ekspozitsiya kamaytirish / oshirish
 *   D       — Doppler effektni almashtirish
 *   G       — film grain almashtirish
 *   B       — bloom almashtirish
 *   J       — jet oqimini almashtirish
 *   I       — HUD info ko'rsatish
 *   Esc     — kinematografik yo'lni to'xtatish
 *
 * Bog'liqliklar: yo'q
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export default class KeyboardShortcuts {

  /**
   * @param {Object} [options]
   * @param {boolean} [options.enabled=true]
   * @param {boolean} [options.preventDefault=true] — ba'zi tugmalarda default'ni bloklash
   */
  constructor(options = {}) {
    this._enabled = options.enabled !== false;
    this._preventDefault = options.preventDefault !== false;

    // ── Tugma → callback xaritasi ──
    this._bindings = new Map();

    // ── Bosib turish kuzatuvi ──
    this._pressed = new Set();

    // ── Event listener ref (dispose uchun) ──
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);

    // ── Standart tugmalarni bog'lash ──
    this._setupDefaults();

    // ── DOM event'lar ──
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STANDART TUGMALAR
  // ─────────────────────────────────────────────────────────────────────────

  /** @private */
  _setupDefaults() {
    // Bu yerda faqat tugmalar ro'yxatga olinadi.
    // Haqiqiy callback'lar App tomonidan bind() orqali o'rnatiladi.

    // Oldindan aniqlangan tugmalar (foydalanuvchi o'zgartira oladi)
    this._keyLabels = {
      'Digit1': 'Keng kadr',
      'Digit2': 'Disk tekisligi',
      'Digit3': 'Qutb ko\'rinishi',
      'Digit4': 'Yaqinlashish',
      'Digit5': 'Gorizont',
      'Digit6': 'Orqa tomon',
      'Space':  'Pauza',
      'KeyH':   'Panel',
      'KeyF':   'To\'liq ekran',
      'KeyP':   'Screenshot',
      'KeyR':   'Video yozish',
      'KeyC':   'Kinematografik',
      'KeyQ':   'Sifat -',
      'KeyE':   'Sifat +',
      'BracketLeft':  'Ekspozitsiya -',
      'BracketRight': 'Ekspozitsiya +',
      'KeyD':   'Doppler',
      'KeyG':   'Film grain',
      'KeyB':   'Bloom',
      'KeyJ':   'Jet oqimi',
      'KeyI':   'HUD info',
      'Escape': 'Bekor qilish',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TUGMA BOG'LASH
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Tugmaga callback bog'lash
   *
   * @param {string} keyCode - KeyboardEvent.code ('KeyH', 'Space', 'Digit1', ...)
   * @param {Function} callback - callback(event)
   * @param {Object} [options]
   * @param {boolean} [options.repeat=false] — bosib turganda takrorlash
   * @param {boolean} [options.preventDefault=true]
   * @returns {KeyboardShortcuts} this
   */
  bind(keyCode, callback, options = {}) {
    this._bindings.set(keyCode, {
      callback,
      repeat: options.repeat || false,
      preventDefault: options.preventDefault !== false,
    });
    return this;
  }

  /**
   * Bir nechta tugmani bir vaqtda bog'lash
   *
   * @param {Object} bindings - {keyCode: callback, ...}
   * @param {Object} [options] — umumiy options
   */
  bindMultiple(bindings, options = {}) {
    for (const [key, callback] of Object.entries(bindings)) {
      this.bind(key, callback, options);
    }
    return this;
  }

  /**
   * Tugma bog'lanishini olib tashlash
   * @param {string} keyCode
   */
  unbind(keyCode) {
    this._bindings.delete(keyCode);
    return this;
  }

  /**
   * Barcha bog'lanishlarni tozalash
   */
  unbindAll() {
    this._bindings.clear();
    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVENT HANDLING
  // ─────────────────────────────────────────────────────────────────────────

  /** @private */
  _handleKeyDown(event) {
    if (!this._enabled) return;

    // Input/textarea'da bo'lsa — o'tkazib yuborish
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const code = event.code;
    const binding = this._bindings.get(code);

    if (!binding) return;

    // Takrorlash tekshiruvi
    if (event.repeat && !binding.repeat) return;

    // Default'ni bloklash
    if (binding.preventDefault && this._preventDefault) {
      event.preventDefault();
    }

    // Bosib turish kuzatuvi
    this._pressed.add(code);

    // Callback chaqirish
    binding.callback(event);
  }

  /** @private */
  _handleKeyUp(event) {
    this._pressed.delete(event.code);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HOLAT TEKSHIRUVI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Tugma hozir bosib turilganmi?
   * @param {string} keyCode
   * @returns {boolean}
   */
  isPressed(keyCode) {
    return this._pressed.has(keyCode);
  }

  /**
   * Bir nechta tugmadan birortasi bosib turilganmi?
   * @param {...string} keyCodes
   * @returns {boolean}
   */
  isAnyPressed(...keyCodes) {
    return keyCodes.some(k => this._pressed.has(k));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // YORDAMCHI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * To'liq ekranga o'tish/chiqish
   * @param {HTMLElement} [element=document.documentElement]
   */
  static toggleFullscreen(element) {
    const el = element || document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  /**
   * Barcha tugma-label juftlarini olish (HUD uchun)
   * @returns {Object}
   */
  getKeyMap() {
    return { ...this._keyLabels };
  }

  /**
   * Bog'langan tugmalar ro'yxati
   * @returns {string[]}
   */
  get boundKeys() {
    return Array.from(this._bindings.keys());
  }

  /** Enabled holat */
  get enabled() { return this._enabled; }
  set enabled(val) { this._enabled = val; }

  // ─────────────────────────────────────────────────────────────────────────
  // TOZALASH
  // ─────────────────────────────────────────────────────────────────────────

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this._bindings.clear();
    this._pressed.clear();
  }
}