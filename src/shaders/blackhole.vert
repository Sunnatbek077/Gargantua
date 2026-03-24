/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Vertex Shader
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Full-screen quad uchun vertex shader.
 *
 * Bu shader juda oddiy — uning yagona vazifasi:
 *   1. PlaneGeometry(2,2) ni ekranning to'rt burchagiga cho'zish
 *   2. UV koordinatalarni fragment shader'ga uzatish
 *
 * Haqiqiy hisob-kitoblarning BARCHASI fragment shader'da bo'ladi.
 * Vertex shader faqat "qog'oz" tayyorlaydi, fragment shader "rasm chizadi".
 *
 * Chiqish:
 *   vUv — [0,0] (pastki chap) dan [1,1] (yuqori o'ng) gacha
 * ═══════════════════════════════════════════════════════════════════════════════
 */

varying vec2 vUv;

void main() {
  vUv = uv;

  // position.xy allaqachon [-1, 1] diapazonida (PlaneGeometry(2,2))
  // Z = 0, W = 1 — ekran tekisligida
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
