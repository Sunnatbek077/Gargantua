/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Shader Loader
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * GLSL shader fayllarini yuklash va boshqarish.
 *
 * Vazifalari:
 *   - .vert / .frag / .glsl fayllarni yuklash
 *   - #include direktivlarini hal qilish
 *   - Shader kodini cache'lash
 *   - Inline (embedded) shader'larni qo'llab-quvvatlash
 *   - Uniform ro'yxatini avtomatik aniqlash
 *   - Hot-reload (ishlab chiqish paytida)
 *
 * Yuklash usullari:
 *   1. fetch() — Vite dev server orqali (oddiy ishlab chiqish)
 *   2. import — Vite raw import (?raw suffix)
 *   3. inline — to'g'ridan-to'g'ri string sifatida
 *
 * Bog'liqliklar: yo'q
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export default class ShaderLoader {

  // ─────────────────────────────────────────────────────────────────────────
  // KONSTRUKTOR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @param {string} [basePath='src/shaders/'] - Shader fayllar joylashgan papka
   */
  constructor(basePath = 'src/shaders/') {
    this._basePath = basePath.endsWith('/') ? basePath : basePath + '/';
    this._cache = new Map();          // fayl nomi → shader kodi
    this._includes = new Map();       // include nomi → kodi
    this._onReloadCallbacks = [];     // hot-reload callback'lari
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ASOSIY YUKLASH
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Bitta shader faylni yuklash
   *
   * @param {string} filename - Fayl nomi ('blackhole.frag', 'noise.glsl')
   * @param {boolean} [useCache=true] - Cache ishlatish
   * @returns {Promise<string>} Shader kodi
   */
  async load(filename, useCache = true) {
    // Cache tekshirish
    if (useCache && this._cache.has(filename)) {
      return this._cache.get(filename);
    }

    const url = this._basePath + filename;
    let code;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Shader "${filename}" yuklanmadi: ${response.status}`);
      }
      code = await response.text();
    } catch (error) {
      console.error(`Shader yuklash xatosi: ${filename}`, error);
      throw error;
    }

    // #include direktivlarini hal qilish
    code = await this._resolveIncludes(code);

    // Cache'ga saqlash
    this._cache.set(filename, code);

    return code;
  }

  /**
   * Vertex va Fragment shader'larni birga yuklash
   *
   * @param {string} vertFile - Vertex shader fayli
   * @param {string} fragFile - Fragment shader fayli
   * @returns {Promise<{vertex: string, fragment: string}>}
   */
  async loadPair(vertFile, fragFile) {
    const [vertex, fragment] = await Promise.all([
      this.load(vertFile),
      this.load(fragFile),
    ]);
    return { vertex, fragment };
  }

  /**
   * Barcha loyiha shader'larini bir vaqtda yuklash
   *
   * @returns {Promise<{vertex: string, fragment: string, includes: Object}>}
   */
  async loadAll() {
    // Avval include fayllarni yuklash
    const includeFiles = [
      'noise.glsl',
      'accretion.glsl',
      'doppler.glsl',
      'lensing.glsl',
      'tonemap.glsl',
      'gravity.glsl',
    ];

    await Promise.all(
      includeFiles.map(f => this.loadInclude(f))
    );

    // Asosiy shader'larni yuklash
    const shaders = await this.loadPair('blackhole.vert', 'blackhole.frag');

    return {
      ...shaders,
      includes: Object.fromEntries(this._includes),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INCLUDE TIZIMI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Include fayl sifatida yuklash va saqlash
   *
   * @param {string} filename
   * @returns {Promise<string>}
   */
  async loadInclude(filename) {
    const code = await this.load(filename, false);
    const name = filename.replace(/\.[^.]+$/, ''); // '.glsl' olib tashlash
    this._includes.set(name, code);
    return code;
  }

  /**
   * Include faylni to'g'ridan-to'g'ri string sifatida ro'yxatga olish
   * (fetch'siz, inline embedding uchun)
   *
   * @param {string} name - Include nomi ('noise', 'accretion', ...)
   * @param {string} code - GLSL kodi
   */
  registerInclude(name, code) {
    this._includes.set(name, code);
    return this;
  }

  /**
   * Shader koddagi #include direktivlarini hal qilish
   *
   * Format: #include <noise>  yoki  #include "noise.glsl"
   *
   * @private
   * @param {string} code - Shader kodi
   * @returns {Promise<string>} Include'lar almashtirilgan kod
   */
  async _resolveIncludes(code) {
    // #include <name> formatini qidirish
    const includeRegex = /^\s*#include\s+[<"]([^>"]+)[>"]\s*$/gm;
    let match;
    let result = code;

    while ((match = includeRegex.exec(code)) !== null) {
      const includeName = match[1].replace(/\.[^.]+$/, '');
      let includeCode = this._includes.get(includeName);

      if (!includeCode) {
        // Avtomatik yuklash
        try {
          const filename = includeName + '.glsl';
          includeCode = await this.load(filename, false);
          this._includes.set(includeName, includeCode);
        } catch {
          console.warn(`Include "${includeName}" topilmadi, o'tkazildi`);
          includeCode = `// Include "${includeName}" topilmadi\n`;
        }
      }

      result = result.replace(match[0], includeCode);
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INLINE SHADER'LAR
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Fayl yuklamasdan to'g'ridan-to'g'ri string sifatida berish.
  // Single-file build yoki tezkor prototiplash uchun.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Inline shader kodini cache'ga qo'yish
   *
   * @param {string} name - Fayl nomi sifatida ('blackhole.frag')
   * @param {string} code - GLSL kodi
   */
  registerInline(name, code) {
    this._cache.set(name, code);
    return this;
  }

  /**
   * Bir nechta inline shader'larni birga ro'yxatga olish
   *
   * @param {Object} shaders - {name: code, ...}
   */
  registerMultiple(shaders) {
    for (const [name, code] of Object.entries(shaders)) {
      this._cache.set(name, code);
    }
    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UNIFORM ANALIZ
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Shader koddan uniform o'zgaruvchilarni ajratib olish
   * Scene.js'da uniform'larni avtomatik yaratish uchun foydali
   *
   * @param {string} code - GLSL shader kodi
   * @returns {Array<{type: string, name: string}>}
   *
   * Misol natija:
   *   [
   *     {type: 'float', name: 'u_time'},
   *     {type: 'vec3', name: 'u_cameraPos'},
   *     {type: 'sampler2D', name: 'u_noiseTexture'},
   *   ]
   */
  static extractUniforms(code) {
    const uniformRegex = /^\s*uniform\s+([\w]+)\s+([\w]+)\s*;/gm;
    const uniforms = [];
    let match;

    while ((match = uniformRegex.exec(code)) !== null) {
      uniforms.push({
        type: match[1],
        name: match[2],
      });
    }

    return uniforms;
  }

  /**
   * Shader'dagi barcha varying'larni topish
   *
   * @param {string} code
   * @returns {Array<{type: string, name: string}>}
   */
  static extractVaryings(code) {
    const varyingRegex = /^\s*varying\s+([\w]+)\s+([\w]+)\s*;/gm;
    const varyings = [];
    let match;

    while ((match = varyingRegex.exec(code)) !== null) {
      varyings.push({
        type: match[1],
        name: match[2],
      });
    }

    return varyings;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HOT RELOAD (ishlab chiqish uchun)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Shader o'zgarganda callback qo'shish
   *
   * @param {Function} callback - callback(name, newCode)
   */
  onReload(callback) {
    this._onReloadCallbacks.push(callback);
    return this;
  }

  /**
   * Shader kodini yangilash va callback'larni chaqirish
   * Vite HMR bilan ishlatish uchun
   *
   * @param {string} name - Fayl nomi
   * @param {string} newCode - Yangi GLSL kodi
   */
  async hotReload(name, newCode) {
    // Include'larni hal qilish
    const resolvedCode = await this._resolveIncludes(newCode);
    this._cache.set(name, resolvedCode);

    // Callback'larni chaqirish
    for (const cb of this._onReloadCallbacks) {
      cb(name, resolvedCode);
    }

    console.log(`🔄 Shader hot-reload: ${name}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // YORDAMCHI
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GLSL versiya prefiksi qo'shish
   * Ba'zi qurilmalarda kerak bo'lishi mumkin
   *
   * @param {string} code
   * @param {string} [version='300 es']
   * @returns {string}
   */
  static addVersionPrefix(code, version = '300 es') {
    if (code.trimStart().startsWith('#version')) {
      return code;
    }
    return `#version ${version}\n${code}`;
  }

  /**
   * Shader kodidagi izohlarni olib tashlash
   * Production build uchun — o'lchamni kamaytiradi
   *
   * @param {string} code
   * @returns {string}
   */
  static minify(code) {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, '')  // Block comments
      .replace(/\/\/.*$/gm, '')           // Line comments
      .replace(/^\s*\n/gm, '')            // Bo'sh qatorlar
      .replace(/\s+/g, ' ')              // Ko'p bo'shliqlar → bitta
      .replace(/\s*([{}();,=+\-*/<>!&|])\s*/g, '$1')  // Operator atrofi
      .trim();
  }

  /**
   * Cache'ni tozalash
   */
  clearCache() {
    this._cache.clear();
    return this;
  }

  /**
   * Cache statistikasi
   */
  get cacheStats() {
    let totalSize = 0;
    for (const code of this._cache.values()) {
      totalSize += code.length;
    }
    return {
      entries: this._cache.size,
      includes: this._includes.size,
      totalChars: totalSize,
      totalKB: (totalSize / 1024).toFixed(1),
    };
  }

  /**
   * Tozalash
   */
  dispose() {
    this._cache.clear();
    this._includes.clear();
    this._onReloadCallbacks.length = 0;
  }
}