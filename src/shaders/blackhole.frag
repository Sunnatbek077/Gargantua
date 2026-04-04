/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Main Fragment Shader
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * LOYIHANING YURAGI — har bir piksel uchun mustaqil ray marching.
 *
 * Har piksel uchun:
 *   1. Kameradan nur yo'naltirish (#34)
 *   2. Nurni egri fazovaqtda harakatlantirish (#1-9)
 *   3. Accretion disk kesishishini tekshirish (#17-21, #31-32)
 *   4. Doppler effektlarni qo'llash (#22-25)
 *   5. Yulduz fonini ko'rsatish (#13-16, #35)
 *   6. Foton halqasi porlashi
 *   7. Tone mapping va yakuniy rang (#26, #36, #37)
 *
 * Tuzilma:
 *   Har bir modul alohida .glsl faylda:
 *     noise.glsl     — Procedural noise (hash, fbm)
 *     accretion.glsl — Accretion disk (halqa rangi, tuzilmasi)
 *     doppler.glsl   — Doppler effekt (rang/yorqinlik siljishi)
 *     lensing.glsl   — Foton halqa va event horizon effektlari
 *     tonemap.glsl   — Tone mapping va post-processing
 *     gravity.glsl   — Gravitatsion tezlanish (qora tuynuk fizikasi)
 *
 * O'zgartirish uchun tegishli .glsl faylni tahrirlang.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

precision highp float;

// ─────────────────────────────────────────────────────────────────────────────
// UNIFORM'LAR — JavaScript'dan keladi (Scene.js)
// ─────────────────────────────────────────────────────────────────────────────

// ── Vaqt ──
uniform float u_time;
uniform float u_deltaTime;

// ── Ekran ──
uniform vec2 u_resolution;

// ── Kamera (#34) ──
uniform vec3  u_cameraPos;
uniform vec3  u_cameraDir;
uniform vec3  u_cameraRight;
uniform vec3  u_cameraUp;
uniform float u_focalLength;
uniform float u_aspectRatio;

// ── Qora tuynuk (#1-5) ──
uniform float u_blackHoleMass;
uniform float u_Rs;
uniform float u_spin;
uniform float u_charge;
uniform float u_rPhotonSphere;
uniform float u_rISCO;
uniform float u_rOuterHorizon;

// ── Accretion disk (#17-21, #31-32) ──
uniform float u_diskInnerRadius;
uniform float u_diskOuterRadius;
uniform float u_diskThickness;
uniform float u_diskRotSpeed;
uniform float u_diskTMax;
uniform vec3  u_diskColorHot;
uniform vec3  u_diskColorWarm;
uniform vec3  u_diskColorCool;
uniform float u_noiseScale;
uniform float u_noiseLacunarity;
uniform int   u_noiseOctaves;
uniform float u_noisePersistence;
uniform float u_noiseTimeScale;

// ── Doppler (#22-25) ──
uniform float u_dopplerEnabled;
uniform float u_beamingExp;
uniform float u_colorShift;
uniform float u_brightnessBoost;
uniform float u_gravRedshift;

// ── Ray marching (#6-9) ──
uniform int   u_maxSteps;
uniform float u_stepSize;
uniform float u_adaptiveStep;
uniform float u_minStepSize;
uniform float u_maxStepSize;
uniform float u_stepSizeFactor;
uniform float u_escapeRadius;
uniform float u_captureRadius;
uniform float u_useRK4;

// ── Lensing (#13-16) ──
uniform float u_lensingEnabled;
uniform float u_photonRingIntensity;

// ── Texturalar ──
uniform samplerCube u_starfieldCube;
uniform sampler2D   u_noiseTexture;

// ── Vertex shader'dan ──
varying vec2 vUv;


// ═══════════════════════════════════════════════════════════════════════════════
// INCLUDE: Modul fayllar
// ═══════════════════════════════════════════════════════════════════════════════
// Har bir modul alohida faylda — o'zgartirish oson.
// ShaderLoader #include direktivlarini avtomatik hal qiladi.

#include <noise>
#include <accretion>
#include <doppler>
#include <lensing>
#include <tonemap>
#include <gravity>


// ═══════════════════════════════════════════════════════════════════════════════
// CINEMATIC BACKGROUND — deep space haze & dust
// ═══════════════════════════════════════════════════════════════════════════════
//
// Gravitatsion linzalash orqali kuchaytirilgan kosmik fon.
// Juda nozik — faqat "bo'shliq emas, chuqurlik" hissini beradi.
// Ray marching'dan keyin escaped ray yo'nalishi bilan chaqiriladi.

vec3 cinematicBackground(vec3 dir) {
  // ── I. Soft vertical gradient — extremely wide, no visible banding ──
  float vertFade = abs(dir.y);

  vec3 coolDark  = vec3(0.001, 0.0008, 0.0025);
  vec3 warmDark  = vec3(0.0025, 0.0015, 0.0005);

  // Very wide smoothstep — gradient spans most of the hemisphere
  vec3 base = mix(warmDark, coolDark, smoothstep(0.0, 0.85, vertFade));

  // ── II. Ultra-low-frequency volumetric haze ──
  // Scale 0.25 on unit sphere = continent-sized shapes, single octave only.
  // Use a tilted sample to break any axis-alignment.
  vec3 tiltedDir = vec3(
    dir.x * 0.9 + dir.y * 0.3,
    dir.y * 0.9 - dir.x * 0.2 + dir.z * 0.15,
    dir.z * 0.95 + dir.x * 0.1
  );
  float haze = fbm3D(tiltedDir * 0.25, 1, 2.0, 0.5);
  // [-1,1] → [0,1], then quartic crush — only the broadest peaks survive
  haze = haze * 0.5 + 0.5;
  haze = haze * haze * haze * haze;

  base += vec3(0.001, 0.0007, 0.0015) * haze;

  // ── III. Disk-plane scattered glow — very soft falloff ──
  float diskScatter = exp(-vertFade * 3.5);
  base += vec3(0.002, 0.001, 0.0004) * diskScatter;

  return base;
}


// ═══════════════════════════════════════════════════════════════════════════════
// RAY MARCHING — asosiy simulyatsiya tsikli
// ═══════════════════════════════════════════════════════════════════════════════
//
// Formulalar #6-9:
//   #6 — Geodezik tenglamasi
//   #7 — Christoffel simvollari (gravity.glsl ichida)
//   #8 — Verlet integrallash
//   #9 — RK4 integrallash

struct RayResult {
  vec3  color;             // Yakuniy rang (HDR)
  bool  hitDisk;           // Diskka tegdimi
  bool  captured;          // Qora tuynukka tushdimi
  float closestApproach;   // Eng yaqin kelish radiusi
};

RayResult marchRay(vec3 rayPos, vec3 rayDir) {
  RayResult result;
  result.color = vec3(0.0);
  result.hitDisk = false;
  result.captured = false;
  result.closestApproach = 1000.0;

  vec3 prevPos = rayPos;
  vec3 accumulatedDiskColor = vec3(0.0);
  float accumulatedDiskAlpha = 0.0;

  float Rs = u_Rs;
  float captureR = u_captureRadius;

  for (int i = 0; i < 500; i++) {
    if (i >= u_maxSteps) break;

    float r = length(rayPos);

    // Eng yaqin kelishni kuzatish (foton halqa uchun)
    result.closestApproach = min(result.closestApproach, r);

    // ── Adaptiv qadam kattaligi ──
    float stepSize;
    if (u_adaptiveStep > 0.5) {
      stepSize = clamp(
        r * u_stepSizeFactor,
        u_minStepSize,
        u_maxStepSize
      );
    } else {
      stepSize = u_stepSize;
    }

    // ── Gravitatsion tezlanish (gravity.glsl) ──
    vec3 accel;
    if (abs(u_spin) > 0.001 || abs(u_charge) > 0.001) {
      accel = kerrNewmanAcceleration(rayPos, rayDir, Rs, u_spin, u_charge);
    } else {
      accel = gravitationalAcceleration(rayPos, rayDir, Rs);
    }

    // ── Integrallash ──
    if (u_useRK4 > 0.5) {
      // ── Formula #9: RK4 ──
      vec3 k1v = accel * stepSize;
      vec3 k1x = rayDir * stepSize;

      vec3 midPos1 = rayPos + k1x * 0.5;
      vec3 midDir1 = rayDir + k1v * 0.5;
      vec3 a2 = (abs(u_spin) > 0.001 || abs(u_charge) > 0.001)
        ? kerrNewmanAcceleration(midPos1, midDir1, Rs, u_spin, u_charge)
        : gravitationalAcceleration(midPos1, midDir1, Rs);
      vec3 k2v = a2 * stepSize;
      vec3 k2x = midDir1 * stepSize;

      vec3 midPos2 = rayPos + k2x * 0.5;
      vec3 midDir2 = rayDir + k2v * 0.5;
      vec3 a3 = (abs(u_spin) > 0.001 || abs(u_charge) > 0.001)
        ? kerrNewmanAcceleration(midPos2, midDir2, Rs, u_spin, u_charge)
        : gravitationalAcceleration(midPos2, midDir2, Rs);
      vec3 k3v = a3 * stepSize;
      vec3 k3x = midDir2 * stepSize;

      vec3 endPos = rayPos + k3x;
      vec3 endDir = rayDir + k3v;
      vec3 a4 = (abs(u_spin) > 0.001 || abs(u_charge) > 0.001)
        ? kerrNewmanAcceleration(endPos, endDir, Rs, u_spin, u_charge)
        : gravitationalAcceleration(endPos, endDir, Rs);
      vec3 k4v = a4 * stepSize;
      vec3 k4x = endDir * stepSize;

      prevPos = rayPos;
      rayDir += (k1v + 2.0 * k2v + 2.0 * k3v + k4v) / 6.0;
      rayPos += (k1x + 2.0 * k2x + 2.0 * k3x + k4x) / 6.0;
    } else {
      // ── Formula #8: Verlet ──
      prevPos = rayPos;
      rayDir += accel * stepSize;
      rayPos += rayDir * stepSize;
    }

    rayDir = normalize(rayDir);
    float newR = length(rayPos);

    // ── Qora tuynukka tushdi ──
    if (newR < captureR + u_rOuterHorizon) {
      result.captured = true;
      result.color = accumulatedDiskColor;
      break;
    }

    // ── Volumetrik Accretion Disk (accretion.glsl) ──
    float rXZ = length(rayPos.xz);
    if (rXZ >= u_diskInnerRadius && rXZ <= u_diskOuterRadius) {
      float H = rXZ * u_diskThickness;

      float y0 = prevPos.y;
      float y1 = rayPos.y;
      float dy = y1 - y0;

      float t_in = 0.0;
      float t_out = 1.0;
      bool intersects = false;

      if (abs(dy) > 1e-5) {
        float t1 = (H - y0) / dy;
        float t2 = (-H - y0) / dy;
        t_in = clamp(min(t1, t2), 0.0, 1.0);
        t_out = clamp(max(t1, t2), 0.0, 1.0);
        if (t_out > t_in) intersects = true;
      } else {
        if (abs(y0) <= H) {
          t_in = 0.0;
          t_out = 1.0;
          intersects = true;
        }
      }

      if (intersects) {
        float fraction = t_out - t_in;
        float t_mid = (t_in + t_out) * 0.5;
        vec3 hitPoint = mix(prevPos, rayPos, t_mid);
        float localR = length(hitPoint.xz);

        float density = smoothstep(H, 0.0, abs(hitPoint.y));

        vec4 stepCol = computeDiskColor(localR, hitPoint);
        stepCol = applyDoppler(stepCol, hitPoint, localR);

        float thicknessRatio = max(u_diskThickness, 0.01);

        float stepAlpha = stepCol.a * density * (fraction * stepSize) * (8.0 / thicknessRatio);
        stepAlpha = clamp(stepAlpha, 0.0, 1.0);

        accumulatedDiskColor += stepCol.rgb * stepAlpha * (1.0 - accumulatedDiskAlpha);
        accumulatedDiskAlpha += stepAlpha * (1.0 - accumulatedDiskAlpha);

        result.hitDisk = true;

        if (accumulatedDiskAlpha > 0.99) {
          accumulatedDiskAlpha = 1.0;
          break;
        }
      }
    }

    // ── Qochdi — Event Horizon Depth Effects (lensing.glsl) ──
    if (newR > u_escapeRadius) {
      // Gravitatsion burilishdan keyingi yo'nalish bo'yicha kosmik fon
      vec3 starColor = cinematicBackground(rayDir);

      float ringGlow = photonRingGlow(result.closestApproach, u_rPhotonSphere);
      vec3 ringColor = vec3(1.0, 0.85, 0.6) * ringGlow;

      float approachRatio = u_rPhotonSphere / max(result.closestApproach, u_rPhotonSphere * 0.5);
      float mag = 1.0 + pow(approachRatio, 8.0) * 3.0;

      float edgeFresnel = edgeFresnelFactor(result.closestApproach, u_rPhotonSphere, u_rOuterHorizon);
      mag += edgeFresnel * 0.7;

      vec3 gravGlow = gravitationalGlow(result.closestApproach, u_rPhotonSphere, u_rOuterHorizon, u_time);
      float depthCue = sphericalDepthCue(result.closestApproach, u_rPhotonSphere);

      vec3 bgColor = starColor * mag * (1.0 + depthCue) + ringColor + gravGlow;

      result.color = accumulatedDiskColor + bgColor * (1.0 - accumulatedDiskAlpha);
      break;
    }
  }

  // Loop tugadi lekin bitmaganligi — qochgan deb hisoblaymiz
  if (!result.captured && result.color == vec3(0.0)) {
    vec3 starColor = cinematicBackground(rayDir);
    float ringGlow = photonRingGlow(result.closestApproach, u_rPhotonSphere);
    vec3 ringColor = vec3(1.0, 0.85, 0.6) * ringGlow;

    float approachRatio = u_rPhotonSphere / max(result.closestApproach, u_rPhotonSphere * 0.5);
    float mag = 1.0 + pow(approachRatio, 8.0) * 3.0;
    float edgeFresnel = edgeFresnelFactor(result.closestApproach, u_rPhotonSphere, u_rOuterHorizon);
    mag += edgeFresnel * 1.5;
    vec3 gravGlow = gravitationalGlow(result.closestApproach, u_rPhotonSphere, u_rOuterHorizon, u_time);
    float depthCue = sphericalDepthCue(result.closestApproach, u_rPhotonSphere);

    result.color = accumulatedDiskColor + (starColor * mag * (1.0 + depthCue) + ringColor + gravGlow) * (1.0 - accumulatedDiskAlpha);
  }

  return result;
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN — har bir piksel shu yerdan boshlanadi
// ═══════════════════════════════════════════════════════════════════════════════

void main() {
  // ── Formula #34: Ray generation ──
  vec2 ndc = (vUv - 0.5) * 2.0;
  ndc.x *= u_aspectRatio;

  vec3 rayDir = normalize(
    u_cameraRight * ndc.x +
    u_cameraUp    * ndc.y +
    u_cameraDir   * u_focalLength
  );

  vec3 rayPos = u_cameraPos;

  // ── Ray marching ──
  RayResult result = marchRay(rayPos, rayDir);

  // Raw HDR output — post-processing pipeline handles
  // bloom, tone mapping, vignette, and grain in separate passes
  gl_FragColor = vec4(result.color, 1.0);
}
