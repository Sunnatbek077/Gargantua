/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Motion Blur
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Harakat xiraligi — kamera tez harakatlanganda kadr xiralashadi.
 * Kinematografik ko'rinish uchun muhim — 24fps filmlarning xarakteristikasi.
 *
 * Usul: Oldingi kadr bilan hozirgi kadrni aralash (accumulation blur)
 * + kamera tezligiga asoslangan yo'nalishli blur
 *
 * Bog'liqliklar: Three.js, PostFXConfig
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import PostFXConfig from '../../config/postfx.config.js';

export default class MotionBlur {

  constructor(renderer, width, height) {
    this._renderer = renderer;
    this._config = PostFXConfig.motionBlur;

    // Oldingi kadr uchun buffer
    this._prevTarget = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: false,
    });

    // Kamera holati kuzatuvi
    this._prevCameraMatrix = new THREE.Matrix4();
    this._cameraVelocity = new THREE.Vector2(0, 0);
    this._hasPreviousFrame = false;

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
        tCurrent: { value: null },
        tPrevious: { value: null },
        u_velocity: { value: new THREE.Vector2(0, 0) },
        u_intensity: { value: this._config.intensity },
        u_samples: { value: this._config.samples },
        u_maxBlur: { value: this._config.maxBlur },
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
        uniform sampler2D tCurrent;
        uniform sampler2D tPrevious;
        uniform vec2 u_velocity;
        uniform float u_intensity;
        uniform int u_samples;
        uniform float u_maxBlur;
        varying vec2 vUv;

        void main() {
          // Kamera tezligi asosida blur yo'nalishi
          vec2 vel = u_velocity * u_intensity;

          // Maksimal blur cheklashi
          float velLen = length(vel);
          if (velLen > u_maxBlur * 0.001) {
            vel = normalize(vel) * u_maxBlur * 0.001;
          }

          // Agar tezlik juda kichik bo'lsa — blur yo'q
          if (velLen < 0.00001) {
            gl_FragColor = texture2D(tCurrent, vUv);
            return;
          }

          // Yo'nalishli blur — tezlik bo'ylab sample'lar
          vec3 color = vec3(0.0);
          float totalWeight = 0.0;

          for (int i = 0; i < 16; i++) {
            if (i >= u_samples) break;

            float t = float(i) / float(u_samples) - 0.5;
            vec2 offset = vel * t;
            vec2 sampleUV = vUv + offset;

            // Chegarada clamp
            sampleUV = clamp(sampleUV, 0.0, 1.0);

            // Markazga yaqin sample'larga ko'proq vazn
            float weight = 1.0 - abs(t) * 2.0;
            weight = max(weight, 0.1);

            color += texture2D(tCurrent, sampleUV).rgb * weight;
            totalWeight += weight;
          }

          color /= totalWeight;

          // Oldingi kadr bilan aralashtirish (temporal smoothing)
          vec3 prev = texture2D(tPrevious, vUv).rgb;
          float blendFactor = min(velLen * 500.0, 0.3);
          color = mix(color, prev, blendFactor * 0.15);

          gl_FragColor = vec4(color, 1.0);
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
   * Motion blur qo'llash
   *
   * @param {THREE.WebGLRenderTarget} inputTarget
   * @param {THREE.WebGLRenderTarget|null} outputTarget
   * @param {THREE.Camera} camera3D - Three.js kamera (tezlik hisoblash uchun)
   */
  render(inputTarget, outputTarget, camera3D) {
    if (!this._config.enabled) return;

    // Kamera tezligini hisoblash
    if (camera3D) {
      this._updateCameraVelocity(camera3D);
    }

    // Tezlik threshold — juda kichik bo'lsa blur qilmaslik
    const speed = this._cameraVelocity.length();
    if (speed < this._config.velocityThreshold) {
      // Blur kerak emas — faqat oldingi kadrni saqlash
      this._savePreviousFrame(inputTarget);
      return;
    }

    this._material.uniforms.tCurrent.value = inputTarget.texture;
    this._material.uniforms.tPrevious.value = this._prevTarget.texture;
    this._material.uniforms.u_velocity.value.copy(this._cameraVelocity);

    this._renderer.setRenderTarget(outputTarget || null);
    this._renderer.render(this._scene, this._camera);

    // Hozirgi kadrni "oldingi" sifatida saqlash
    this._savePreviousFrame(inputTarget);
  }

  /**
   * Kamera tezligini hisoblash — kadrlar orasidagi matritsa farqi
   * @private
   */
  _updateCameraVelocity(camera3D) {
    const currentMatrix = camera3D.matrixWorld;

    if (this._hasPreviousFrame) {
      // Pozitsiya farqi
      const dx = currentMatrix.elements[12] - this._prevCameraMatrix.elements[12];
      const dy = currentMatrix.elements[13] - this._prevCameraMatrix.elements[13];
      const dz = currentMatrix.elements[14] - this._prevCameraMatrix.elements[14];

      // Yo'nalish farqi (ekran makonida taxminiy)
      // To'liq reprojection o'rniga soddalashtirilgan
      this._cameraVelocity.set(dx * 0.1, dy * 0.1);

      // Aylanish tezligini ham hisobga olish
      const rotDiff = Math.abs(
        currentMatrix.elements[0] - this._prevCameraMatrix.elements[0]
      ) + Math.abs(
        currentMatrix.elements[2] - this._prevCameraMatrix.elements[2]
      );
      this._cameraVelocity.x += rotDiff * 0.5;
    }

    this._prevCameraMatrix.copy(currentMatrix);
    this._hasPreviousFrame = true;
  }

  /**
   * Oldingi kadrni saqlash
   * @private
   */
  _savePreviousFrame(inputTarget) {
    // inputTarget'ni prevTarget'ga nusxalash
    // (Three.js'da to'g'ridan-to'g'ri texture swap qilish mumkin emas)
    // Oddiy render pass bilan nusxalaymiz
    const copyMat = new THREE.MeshBasicMaterial({ map: inputTarget.texture });
    this._quad.material = copyMat;
    this._renderer.setRenderTarget(this._prevTarget);
    this._renderer.render(this._scene, this._camera);
    this._quad.material = this._material;
    copyMat.dispose();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PARAMETRLAR
  // ─────────────────────────────────────────────────────────────────────────

  setIntensity(val) { this._config.intensity = val; this._material.uniforms.u_intensity.value = val; return this; }
  setSamples(val) { this._config.samples = val; this._material.uniforms.u_samples.value = val; return this; }
  setEnabled(val) { this._config.enabled = val; return this; }
  get enabled() { return this._config.enabled; }

  resize(width, height) {
    this._prevTarget.setSize(width, height);
    this._hasPreviousFrame = false;
  }

  dispose() {
    this._prevTarget.dispose();
    this._material.dispose();
    this._quad.geometry.dispose();
  }
}