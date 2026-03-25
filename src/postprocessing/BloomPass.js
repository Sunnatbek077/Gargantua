/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Bloom Post-Processing Pass
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Bloom — yorqin joylar atrofida yumshoq yorug'lik tarqalishi.
 * Interstellar'dagi accretion diskning xarakterli "porlashi".
 *
 * Pipeline:
 *   1. Bright pass — luminance > threshold piksellarni ajratish
 *   2. Downsample — kichik o'lchamlarga qadam-baqadam pasaytirish
 *   3. Gaussian blur — har darajada gorizontal + vertikal blur
 *   4. Upsample — katta o'lchamga qaytarish (blend bilan)
 *   5. Composite — asl rasm + bloom natijasi
 *
 * Formulalar:
 *   #27 — G(x,y) = 1/(2πσ²)·e^(-(x²+y²)/2σ²)  Gaussian blur
 *   #28 — bloom = max(0, luminance - threshold)·intensity
 *   #36 — L = 0.2126R + 0.7152G + 0.0722B  Luminance
 *
 * Bog'liqliklar: Three.js, PostFXConfig
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import PostFXConfig from '../../config/postfx.config.js';

export default class BloomPass {

  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {number} width - Render kengligi
   * @param {number} height - Render balandligi
   */
  constructor(renderer, width, height) {
    this._renderer = renderer;
    this._width = width;
    this._height = height;
    this._config = PostFXConfig.bloom;

    // ── Shader materiallar ──
    this._brightPassMaterial = this._createBrightPassMaterial();
    this._blurMaterial = this._createBlurMaterial();
    this._compositeMaterial = this._createCompositeMaterial();

    // ── Render targetlar (mip chain) ──
    this._mipTargets = [];
    this._createMipChain();

    // ── Full-screen quad ──
    this._quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      null
    );
    this._quad.frustumCulled = false;

    this._scene = new THREE.Scene();
    this._scene.add(this._quad);
    this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SHADER MATERIALLAR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Bright pass — yorqin piksellarni ajratish
   * ── Formula #28, #36 ──
   * @private
   */
  _createBrightPassMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        u_threshold: { value: this._config.threshold },
        u_softKnee: { value: 0.5 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tDiffuse;
        uniform float u_threshold;
        uniform float u_softKnee;
        varying vec2 vUv;

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);

          // Formula #36: Luminance
          float lum = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));

          // Formula #28: Soft threshold
          float knee = u_threshold * u_softKnee;
          float soft = lum - u_threshold + knee;
          soft = clamp(soft / (2.0 * knee + 0.0001), 0.0, 1.0);
          soft = soft * soft;

          float contribution = max(soft, step(u_threshold, lum));

          gl_FragColor = vec4(color.rgb * contribution, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
  }

  /**
   * Gaussian blur — ikki o'tishli (gorizontal + vertikal)
   * ── Formula #27 ──
   * @private
   */
  _createBlurMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        u_direction: { value: new THREE.Vector2(1, 0) },
        u_resolution: { value: new THREE.Vector2(this._width, this._height) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tDiffuse;
        uniform vec2 u_direction;
        uniform vec2 u_resolution;
        varying vec2 vUv;

        // 9-tap Gaussian kernel (sigma ≈ 4)
        // Formula #27: G(x) = e^(-x²/2σ²)
        void main() {
          vec2 texelSize = 1.0 / u_resolution;
          vec2 dir = u_direction * texelSize;

          // Gaussian weights (pre-computed, sigma=4)
          float weights[5];
          weights[0] = 0.227027;
          weights[1] = 0.194596;
          weights[2] = 0.121622;
          weights[3] = 0.054054;
          weights[4] = 0.016216;

          vec3 result = texture2D(tDiffuse, vUv).rgb * weights[0];

          for (int i = 1; i < 5; i++) {
            vec2 offset = dir * float(i) * 1.5;
            result += texture2D(tDiffuse, vUv + offset).rgb * weights[i];
            result += texture2D(tDiffuse, vUv - offset).rgb * weights[i];
          }

          gl_FragColor = vec4(result, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
  }

  /**
   * Composite — asl rasm + bloom = yakuniy natija
   * @private
   */
  _createCompositeMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tBloom0: { value: null },
        tBloom1: { value: null },
        tBloom2: { value: null },
        tBloom3: { value: null },
        u_bloomIntensity: { value: this._config.intensity },
        u_bloomTint: { value: new THREE.Vector3(...this._config.tint) },
        u_weights: { value: new THREE.Vector4(
          this._config.mipLevels[0]?.weight || 1.0,
          this._config.mipLevels[1]?.weight || 0.8,
          this._config.mipLevels[2]?.weight || 0.6,
          this._config.mipLevels[3]?.weight || 0.4,
        )},
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tDiffuse;
        uniform sampler2D tBloom0;
        uniform sampler2D tBloom1;
        uniform sampler2D tBloom2;
        uniform sampler2D tBloom3;
        uniform float u_bloomIntensity;
        uniform vec3 u_bloomTint;
        uniform vec4 u_weights;
        varying vec2 vUv;

        void main() {
          vec3 original = texture2D(tDiffuse, vUv).rgb;

          // Bloom mip darajalarini birlashtirish
          vec3 bloom = vec3(0.0);
          bloom += texture2D(tBloom0, vUv).rgb * u_weights.x;
          bloom += texture2D(tBloom1, vUv).rgb * u_weights.y;
          bloom += texture2D(tBloom2, vUv).rgb * u_weights.z;
          bloom += texture2D(tBloom3, vUv).rgb * u_weights.w;

          // Tint va intensivlik
          bloom *= u_bloomTint * u_bloomIntensity;

          // Additive blending
          gl_FragColor = vec4(original + bloom, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MIP CHAIN — turli o'lchamdagi blur targetlar
  // ─────────────────────────────────────────────────────────────────────────

  /** @private */
  _createMipChain() {
    this._disposeMipChain();

    const levels = this._config.mipLevels;
    for (let i = 0; i < levels.length; i++) {
      const scale = levels[i].scale;
      const w = Math.max(1, Math.floor(this._width * scale));
      const h = Math.max(1, Math.floor(this._height * scale));

      // Har daraja uchun ikkita target (ping-pong blur uchun)
      this._mipTargets.push({
        a: this._createTarget(w, h),
        b: this._createTarget(w, h),
        width: w,
        height: h,
      });
    }
  }

  /** @private */
  _createTarget(w, h) {
    return new THREE.WebGLRenderTarget(w, h, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: false,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — to'liq bloom pipeline
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Bloom effektini qo'llash
   *
   * @param {THREE.WebGLRenderTarget} inputTarget - Asl HDR rasm
   * @param {THREE.WebGLRenderTarget} outputTarget - Natija (null = ekran)
   */
  render(inputTarget, outputTarget) {
    if (!this._config.enabled) {
      // Bloom o'chirilgan — to'g'ridan-to'g'ri nusxalash
      this._renderQuad(this._compositeMaterial, outputTarget);
      return;
    }

    // ── 1. Bright pass ──
    this._brightPassMaterial.uniforms.tDiffuse.value = inputTarget.texture;
    this._renderQuad(this._brightPassMaterial, this._mipTargets[0].a);

    // ── 2. Har mip daraja uchun blur ──
    for (let i = 0; i < this._mipTargets.length; i++) {
      const mip = this._mipTargets[i];

      // Agar birinchi daraja bo'lmasa — oldingi darajadan downsample
      if (i > 0) {
        const prevMip = this._mipTargets[i - 1];
        this._blurMaterial.uniforms.tDiffuse.value = prevMip.a.texture;
        this._blurMaterial.uniforms.u_direction.value.set(1, 0);
        this._blurMaterial.uniforms.u_resolution.value.set(mip.width, mip.height);
        this._renderQuad(this._blurMaterial, mip.a);
      }

      // Gorizontal blur: a → b
      this._blurMaterial.uniforms.tDiffuse.value = mip.a.texture;
      this._blurMaterial.uniforms.u_direction.value.set(1, 0);
      this._blurMaterial.uniforms.u_resolution.value.set(mip.width, mip.height);

      // Anamorphic bloom — gorizontal cho'zilish
      if (this._config.anamorphic?.enabled) {
        this._blurMaterial.uniforms.u_direction.value.set(this._config.anamorphic.ratio, 0);
      }

      this._renderQuad(this._blurMaterial, mip.b);

      // Vertikal blur: b → a
      this._blurMaterial.uniforms.tDiffuse.value = mip.b.texture;
      this._blurMaterial.uniforms.u_direction.value.set(0, 1);
      this._renderQuad(this._blurMaterial, mip.a);
    }

    // ── 3. Composite ──
    this._compositeMaterial.uniforms.tDiffuse.value = inputTarget.texture;
    for (let i = 0; i < Math.min(4, this._mipTargets.length); i++) {
      this._compositeMaterial.uniforms[`tBloom${i}`].value = this._mipTargets[i].a.texture;
    }
    this._renderQuad(this._compositeMaterial, outputTarget);
  }

  /** @private */
  _renderQuad(material, target) {
    this._quad.material = material;
    this._renderer.setRenderTarget(target || null);
    this._renderer.render(this._scene, this._camera);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PARAMETRLAR
  // ─────────────────────────────────────────────────────────────────────────

  setThreshold(val) {
    this._config.threshold = val;
    this._brightPassMaterial.uniforms.u_threshold.value = val;
    return this;
  }

  setIntensity(val) {
    this._config.intensity = val;
    this._compositeMaterial.uniforms.u_bloomIntensity.value = val;
    return this;
  }

  setTint(r, g, b) {
    this._config.tint = [r, g, b];
    this._compositeMaterial.uniforms.u_bloomTint.value.set(r, g, b);
    return this;
  }

  setEnabled(val) { this._config.enabled = val; return this; }
  get enabled() { return this._config.enabled; }

  // ─────────────────────────────────────────────────────────────────────────
  // RESIZE
  // ─────────────────────────────────────────────────────────────────────────

  resize(width, height) {
    this._width = width;
    this._height = height;
    this._createMipChain();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOZALASH
  // ─────────────────────────────────────────────────────────────────────────

  /** @private */
  _disposeMipChain() {
    for (const mip of this._mipTargets) {
      mip.a.dispose();
      mip.b.dispose();
    }
    this._mipTargets = [];
  }

  dispose() {
    this._disposeMipChain();
    this._brightPassMaterial.dispose();
    this._blurMaterial.dispose();
    this._compositeMaterial.dispose();
    this._quad.geometry.dispose();
  }
}