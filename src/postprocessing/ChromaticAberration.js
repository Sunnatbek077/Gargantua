/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Chromatic Aberration
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Rang aberratsiyasi — IMAX linza imperfeksiyasi.
 * RGB kanallar biroz farqli burchakda sinadi (dispersiya).
 * Natija: chetlarda rangli "kamalak" cheti.
 *
 * Formula:
 *   #30 — R=tex(uv+d), G=tex(uv), B=tex(uv-d)
 *          d = normalize(uv-0.5) * amount
 *
 * Bog'liqliklar: Three.js, PostFXConfig
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import PostFXConfig from '../../config/postfx.config.js';

export default class ChromaticAberration {

  constructor(renderer) {
    this._renderer = renderer;
    this._config = PostFXConfig.chromaticAberration;
    this._material = this._createMaterial();

    this._quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._material);
    this._quad.frustumCulled = false;
    this._scene = new THREE.Scene();
    this._scene.add(this._quad);
    this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /** @private */
  _createMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        u_intensity: { value: this._config.intensity },
        u_falloffExp: { value: this._config.falloffExponent },
        u_lumThreshold: { value: this._config.luminanceThreshold },
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
        uniform float u_intensity;
        uniform float u_falloffExp;
        uniform float u_lumThreshold;
        varying vec2 vUv;

        void main() {
          // ── Formula #30 ──
          vec2 center = vec2(0.5);
          vec2 dir = vUv - center;
          float dist = length(dir);

          // Radial falloff — markazda 0, chetda to'liq
          float falloff = pow(dist, u_falloffExp);
          vec2 offset = normalize(dir + vec2(0.0001)) * u_intensity * falloff;

          // Luminance-based masking (faqat yorqin joylarda)
          vec4 centerColor = texture2D(tDiffuse, vUv);
          float lum = dot(centerColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          float lumMask = smoothstep(u_lumThreshold * 0.5, u_lumThreshold, lum);

          // Effektiv offset
          vec2 finalOffset = offset * max(lumMask, 0.3);

          // RGB kanallar siljishi
          float r = texture2D(tDiffuse, vUv + finalOffset).r;
          float g = centerColor.g;
          float b = texture2D(tDiffuse, vUv - finalOffset).b;

          gl_FragColor = vec4(r, g, b, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
  }

  render(inputTarget, outputTarget) {
    if (!this._config.enabled) return;
    this._material.uniforms.tDiffuse.value = inputTarget.texture;
    this._renderer.setRenderTarget(outputTarget || null);
    this._renderer.render(this._scene, this._camera);
  }

  setIntensity(val) { this._config.intensity = val; this._material.uniforms.u_intensity.value = val; return this; }
  setEnabled(val) { this._config.enabled = val; return this; }
  get enabled() { return this._config.enabled; }

  dispose() {
    this._material.dispose();
    this._quad.geometry.dispose();
  }
}