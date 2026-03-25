/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Lens Flare
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Linza porlashi — accretion diskning eng yorqin nuqtalaridan
 * keladigan linza ichki yansishlari (lens ghosts).
 *
 * Elementlar:
 *   - Ghost'lar: yorqin nuqtalarning linza markazi orqali yansishi
 *   - Starburst: yulduzsimon nurlar (linza diafragmasi)
 *   - Halo: yumshoq aylana (linza chekkasi)
 *
 * Bog'liqliklar: Three.js, PostFXConfig
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import PostFXConfig from '../../config/postfx.config.js';

export default class LensFlare {

  constructor(renderer) {
    this._renderer = renderer;
    this._config = PostFXConfig.lensFlare;
    this._material = this._createMaterial();

    this._quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._material);
    this._quad.frustumCulled = false;
    this._scene = new THREE.Scene();
    this._scene.add(this._quad);
    this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /** @private */
  _createMaterial() {
    const ghosts = this._config.ghosts;

    return new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        u_intensity: { value: this._config.intensity },
        u_threshold: { value: this._config.threshold },
        u_ghostCount: { value: ghosts.count },
        u_ghostSpacing: { value: ghosts.spacing },
        u_starburstEnabled: { value: this._config.starburst?.enabled ? 1.0 : 0.0 },
        u_starburstRays: { value: this._config.starburst?.rays || 6 },
        u_starburstIntensity: { value: this._config.starburst?.intensity || 0.08 },
        u_resolution: { value: new THREE.Vector2(1920, 1080) },
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
        uniform float u_threshold;
        uniform int u_ghostCount;
        uniform float u_ghostSpacing;
        uniform float u_starburstEnabled;
        uniform float u_starburstRays;
        uniform float u_starburstIntensity;
        uniform vec2 u_resolution;
        varying vec2 vUv;

        // Bright source topish (downsampled)
        vec3 sampleBright(vec2 uv) {
          vec3 c = texture2D(tDiffuse, uv).rgb;
          float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
          return c * max(lum - u_threshold, 0.0);
        }

        // Ghost element — markaz orqali yansish
        vec3 ghost(vec2 uv, float offset, float size, vec3 tint) {
          // Ghost pozitsiyasi: markaz orqali aks
          vec2 ghostUV = vec2(1.0) - uv;
          ghostUV = mix(vec2(0.5), ghostUV, offset);

          // Yumshoq doira
          float d = length(ghostUV - vec2(0.5)) * 2.0;
          float falloff = 1.0 - smoothstep(0.0, size, d);
          falloff *= falloff;

          vec3 bright = sampleBright(ghostUV);
          return bright * falloff * tint;
        }

        // Starburst — yulduzsimon nurlar
        float starburst(vec2 uv, float rays) {
          vec2 center = uv - 0.5;
          float angle = atan(center.y, center.x);
          float dist = length(center);
          float pattern = pow(abs(cos(angle * rays)), 20.0);
          return pattern * exp(-dist * 8.0);
        }

        void main() {
          vec3 original = texture2D(tDiffuse, vUv).rgb;
          vec3 flare = vec3(0.0);

          // Ghost'lar
          flare += ghost(vUv, 0.8, 0.3, vec3(1.0, 0.8, 0.5)) * 0.3;
          flare += ghost(vUv, 0.5, 0.2, vec3(0.7, 0.8, 1.0)) * 0.2;
          flare += ghost(vUv, 1.2, 0.15, vec3(1.0, 0.6, 0.3)) * 0.15;
          flare += ghost(vUv, 1.5, 0.25, vec3(0.8, 0.9, 1.0)) * 0.1;

          // Halo — ekran markazida yumshoq aylana
          float haloDist = length(vUv - 0.5) * 2.0;
          float halo = exp(-pow(haloDist - 0.7, 2.0) * 20.0) * 0.1;
          float brightCenter = dot(sampleBright(vec2(0.5)), vec3(0.333));
          flare += vec3(1.0, 0.85, 0.6) * halo * brightCenter;

          // Starburst
          if (u_starburstEnabled > 0.5) {
            float sb = starburst(vUv, u_starburstRays);
            flare += vec3(1.0, 0.9, 0.7) * sb * u_starburstIntensity * brightCenter;
          }

          gl_FragColor = vec4(original + flare * u_intensity, 1.0);
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

  setResolution(w, h) { this._material.uniforms.u_resolution.value.set(w, h); return this; }
  setIntensity(val) { this._config.intensity = val; this._material.uniforms.u_intensity.value = val; return this; }
  setEnabled(val) { this._config.enabled = val; return this; }
  get enabled() { return this._config.enabled; }

  dispose() {
    this._material.dispose();
    this._quad.geometry.dispose();
  }
}