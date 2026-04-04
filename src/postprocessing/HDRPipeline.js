/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — HDR Tone Mapping Pipeline
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * HDR → SDR konversiya — yuqori dinamik diapazonni ekranga moslashtirish.
 *
 * Ray marching natijasi HDR: accretion disk 0-10+ diapazonida.
 * Ekran faqat 0-1 ko'rsata oladi. Tone mapping bu masalani hal qiladi.
 *
 * Formulalar:
 *   #26 — f(x)=(x(ax+b))/(x(cx+d)+e)  ACES filmic (Hollywood standarti)
 *   #37 — color_out = pow(color, 1/2.2)  Gamma korreksiya
 *
 * Bog'liqliklar: Three.js, PostFXConfig
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import PostFXConfig from '../../config/postfx.config.js';

export default class HDRPipeline {

  /**
   * @param {THREE.WebGLRenderer} renderer
   */
  constructor(renderer) {
    this._renderer = renderer;
    this._config = PostFXConfig.toneMapping;

    this._material = this._createMaterial();

    this._quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._material);
    this._quad.frustumCulled = false;
    this._scene = new THREE.Scene();
    this._scene.add(this._quad);
    this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /** @private */
  _createMaterial() {
    const aces = this._config.aces;

    return new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        u_exposure: { value: this._config.exposure },
        u_gamma: { value: this._config.gamma },
        u_whitePoint: { value: this._config.whitePoint },
        u_method: { value: 0 },  // 0=ACES, 1=Reinhard, 2=Uncharted2
        // ACES parametrlari
        u_aces_a: { value: aces.a },
        u_aces_b: { value: aces.b },
        u_aces_c: { value: aces.c },
        u_aces_d: { value: aces.d },
        u_aces_e: { value: aces.e },
        u_vignetteIntensity: { value: 0.55 },
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
        uniform float u_exposure;
        uniform float u_gamma;
        uniform float u_whitePoint;
        uniform int u_method;
        uniform float u_aces_a, u_aces_b, u_aces_c, u_aces_d, u_aces_e;
        uniform float u_vignetteIntensity;
        varying vec2 vUv;

        // ── Vignette — kinematic frame edge darkening ──
        float vignette(vec2 uv) {
          vec2 d = abs(uv - 0.5) * 2.0;
          d = pow(d, vec2(0.8));
          float dist = pow(d.x + d.y, 1.0 / 0.8);
          return 1.0 - smoothstep(0.3, 1.0, dist) * u_vignetteIntensity;
        }

        // ── Formula #26: ACES Filmic ──
        vec3 acesToneMap(vec3 x) {
          float a = u_aces_a, b = u_aces_b;
          float c = u_aces_c, d = u_aces_d, e = u_aces_e;
          return clamp((x*(a*x+b)) / (x*(c*x+d)+e), 0.0, 1.0);
        }

        // Reinhard
        vec3 reinhardToneMap(vec3 x) {
          return x / (x + vec3(1.0));
        }

        // Reinhard extended (oq nuqta bilan)
        vec3 reinhardExtToneMap(vec3 x) {
          float wp2 = u_whitePoint * u_whitePoint;
          return x * (1.0 + x / wp2) / (1.0 + x);
        }

        // Uncharted 2
        vec3 unchartedPart(vec3 x) {
          return ((x*(0.15*x+0.05)+0.004) / (x*(0.15*x+0.5)+0.06)) - 0.0667;
        }
        vec3 uncharted2ToneMap(vec3 x) {
          vec3 curr = unchartedPart(x * 2.0);
          vec3 whiteScale = vec3(1.0) / unchartedPart(vec3(11.2));
          return curr * whiteScale;
        }

        void main() {
          vec3 hdr = texture2D(tDiffuse, vUv).rgb;

          // 1. Ekspozitsiya
          vec3 exposed = hdr * u_exposure;

          // 2. Tone mapping
          vec3 mapped;
          if (u_method == 0) {
            mapped = acesToneMap(exposed);
          } else if (u_method == 1) {
            mapped = reinhardExtToneMap(exposed);
          } else {
            mapped = uncharted2ToneMap(exposed);
          }

          // 3. Gamma korreksiya (Formula #37)
          vec3 corrected = pow(max(mapped, vec3(0.0)), vec3(1.0 / u_gamma));

          // 4. Vignette — IMAX kinematic frame
          corrected *= vignette(vUv);

          gl_FragColor = vec4(corrected, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Tone mapping qo'llash
   *
   * @param {THREE.WebGLRenderTarget} inputTarget - HDR rasm
   * @param {THREE.WebGLRenderTarget|null} outputTarget - Natija (null = ekran)
   */
  render(inputTarget, outputTarget) {
    if (!this._config.enabled) return;

    this._material.uniforms.tDiffuse.value = inputTarget.texture;
    this._renderer.setRenderTarget(outputTarget || null);
    this._renderer.render(this._scene, this._camera);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PARAMETRLAR
  // ─────────────────────────────────────────────────────────────────────────

  setExposure(val) {
    this._config.exposure = Math.max(0.01, Math.min(10, val));
    this._material.uniforms.u_exposure.value = this._config.exposure;
    return this;
  }

  setGamma(val) {
    this._config.gamma = Math.max(1.0, Math.min(3.0, val));
    this._material.uniforms.u_gamma.value = this._config.gamma;
    return this;
  }

  setWhitePoint(val) {
    this._config.whitePoint = val;
    this._material.uniforms.u_whitePoint.value = val;
    return this;
  }

  /**
   * Tone mapping usulini tanlash
   * @param {string} method - 'ACES', 'Reinhard', 'Uncharted2'
   */
  setMethod(method) {
    const methods = { 'ACES': 0, 'Reinhard': 1, 'Uncharted2': 2 };
    this._material.uniforms.u_method.value = methods[method] ?? 0;
    return this;
  }

  setEnabled(val) { this._config.enabled = val; return this; }
  get enabled() { return this._config.enabled; }
  get exposure() { return this._config.exposure; }
  get gamma() { return this._config.gamma; }

  dispose() {
    this._material.dispose();
    this._quad.geometry.dispose();
  }
}