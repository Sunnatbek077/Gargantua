/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Film Grain Post-Processing
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Film donadorligi — 70mm IMAX film pellikasi effekti.
 * Interstellar haqiqiy filmda suratga olingan — bu donadorlik
 * raqamli renderga "analoglik" va "haqiqiylik" beradi.
 *
 * Formula:
 *   #29 — grain = fract(sin(dot(uv,vec2(12.9898,78.233)))*43758.5453)
 *
 * Bog'liqliklar: Three.js, PostFXConfig
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import PostFXConfig from '../../config/postfx.config.js';

export default class FilmGrain {

  constructor(renderer) {
    this._renderer = renderer;
    this._config = PostFXConfig.filmGrain;
    this._material = this._createMaterial();

    this._quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._material);
    this._quad.frustumCulled = false;
    this._scene = new THREE.Scene();
    this._scene.add(this._quad);
    this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /** @private */
  _createMaterial() {
    const lum = this._config.luminanceResponse;

    return new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        u_time: { value: 0 },
        u_intensity: { value: this._config.intensity },
        u_size: { value: this._config.size },
        u_chromatic: { value: this._config.chromatic ? 1.0 : 0.0 },
        u_chromaticIntensity: { value: this._config.chromaticIntensity },
        u_shadowResponse: { value: lum.shadows },
        u_midResponse: { value: lum.midtones },
        u_highlightResponse: { value: lum.highlights },
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
        uniform float u_time;
        uniform float u_intensity;
        uniform float u_size;
        uniform float u_chromatic;
        uniform float u_chromaticIntensity;
        uniform float u_shadowResponse;
        uniform float u_midResponse;
        uniform float u_highlightResponse;
        varying vec2 vUv;

        // ── Formula #29: Pseudo-random hash ──
        float hash(vec2 p, float seed) {
          return fract(sin(dot(p + fract(seed), vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);

          // Luminance
          float lum = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));

          // Luminance-responsive grain kuchi
          float shadowW = 1.0 - smoothstep(0.0, 0.3, lum);
          float midW = 1.0 - abs(lum - 0.5) * 2.0;
          float highW = smoothstep(0.6, 1.0, lum);
          float response = shadowW * u_shadowResponse
                         + max(midW, 0.0) * u_midResponse
                         + highW * u_highlightResponse;

          // Grain koordinatalari (size ta'siri)
          vec2 grainUV = vUv * u_size;
          float timeSeed = u_time * 0.71;

          // Asosiy mono grain
          float grain = (hash(grainUV, timeSeed) - 0.5) * u_intensity * response;

          if (u_chromatic > 0.5) {
            // Xromatik grain — har kanal uchun biroz farqli
            float rGrain = (hash(grainUV + vec2(0.13, 0.0), timeSeed * 1.1) - 0.5) * u_chromaticIntensity * response;
            float gGrain = (hash(grainUV + vec2(0.0, 0.13), timeSeed * 1.2) - 0.5) * u_chromaticIntensity * response;
            float bGrain = (hash(grainUV + vec2(0.13, 0.13), timeSeed * 1.3) - 0.5) * u_chromaticIntensity * response;

            color.r += grain + rGrain;
            color.g += grain + gGrain;
            color.b += grain + bGrain;
          } else {
            color.rgb += grain;
          }

          gl_FragColor = vec4(clamp(color.rgb, 0.0, 1.0), 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
  }

  render(inputTarget, outputTarget, time) {
    if (!this._config.enabled) return;
    this._material.uniforms.tDiffuse.value = inputTarget.texture;
    this._material.uniforms.u_time.value = time || 0;
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