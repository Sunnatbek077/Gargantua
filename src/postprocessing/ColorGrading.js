/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Color Grading Post-Processing
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Filmic color grading — SDR makonida qo'llaniladi (tone mappingdan keyin).
 *
 * Pipeline:
 *   1. Soft S-curve kontrast (midtone-centric, shadow/highlight safe)
 *   2. Saturation (luminance-preserving)
 *   3. Split toning (shadow/highlight tint)
 *
 * Bog'liqliklar: Three.js, PostFXConfig
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import PostFXConfig from '../../config/postfx.config.js';

export default class ColorGrading {

  constructor(renderer) {
    this._renderer = renderer;
    this._config = PostFXConfig.colorGrading;
    this._material = this._createMaterial();

    this._quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._material);
    this._quad.frustumCulled = false;
    this._scene = new THREE.Scene();
    this._scene.add(this._quad);
    this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /** @private */
  _createMaterial() {
    const cfg = this._config;

    return new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse:         { value: null },
        u_contrast:       { value: cfg.contrast },
        u_saturation:     { value: cfg.saturation },
        u_shadowTint:     { value: new THREE.Vector3(...cfg.shadowTint) },
        u_highlightTint:  { value: new THREE.Vector3(...cfg.highlightTint) },
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
        uniform float u_contrast;
        uniform float u_saturation;
        uniform vec3 u_shadowTint;
        uniform vec3 u_highlightTint;
        varying vec2 vUv;

        void main() {
          vec3 color = texture2D(tDiffuse, vUv).rgb;

          // ── 1. Luminance ──
          float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));

          // ── 2. Soft S-curve contrast ──
          // Midtone-centric: pivots at 0.5, preserves extremes better
          // than linear contrast. Uses smoothstep-based curve.
          color = clamp(color, 0.0, 1.0);
          vec3 contrasted = color;
          if (u_contrast != 1.0) {
            // Shift to pivot, scale, shift back
            contrasted = (color - 0.5) * u_contrast + 0.5;
            // Blend with original near extremes to avoid crushing
            float protect = smoothstep(0.0, 0.15, lum) * smoothstep(1.0, 0.85, lum);
            contrasted = mix(color, contrasted, protect);
            contrasted = clamp(contrasted, 0.0, 1.0);
          }

          // ── 3. Saturation (luminance-preserving) ──
          float lumPost = dot(contrasted, vec3(0.2126, 0.7152, 0.0722));
          vec3 graded = mix(vec3(lumPost), contrasted, u_saturation);

          // ── 4. Split toning ──
          // Shadow tint blends into dark regions, highlight tint into bright
          float shadowW = 1.0 - smoothstep(0.0, 0.4, lumPost);
          float highlightW = smoothstep(0.6, 1.0, lumPost);
          graded += u_shadowTint * shadowW;
          graded += u_highlightTint * highlightW;

          gl_FragColor = vec4(clamp(graded, 0.0, 1.0), 1.0);
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

  setContrast(val) { this._config.contrast = val; this._material.uniforms.u_contrast.value = val; return this; }
  setSaturation(val) { this._config.saturation = val; this._material.uniforms.u_saturation.value = val; return this; }
  setEnabled(val) { this._config.enabled = val; return this; }
  get enabled() { return this._config.enabled; }

  dispose() {
    this._material.dispose();
    this._quad.geometry.dispose();
  }
}
