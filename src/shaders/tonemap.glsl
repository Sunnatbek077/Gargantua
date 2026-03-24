/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Tone Mapping & Color Processing
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * HDR → SDR konversiya va yakuniy rang ishlov berish.
 *
 * Ray marching natijasi HDR (High Dynamic Range) formatda —
 * accretion disk qiymatlari 0 dan 10+ gacha bo'lishi mumkin.
 * Lekin ekran faqat [0, 1] diapazonni ko'rsata oladi.
 * Tone mapping bu muammoni hal qiladi:
 *   - Yorqin joylarni "siqadi" (compress)
 *   - Qorong'i joylarni saqlaydi
 *   - Kontrast va detallarni yo'qotmaydi
 *
 * Formulalar:
 *   #26 — f(x) = (x(ax+b)) / (x(cx+d)+e)  ACES Filmic
 *   #30 — R=tex(uv+d), G=tex(uv), B=tex(uv-d)  Chromatic Aberration
 *   #36 — L = 0.2126·R + 0.7152·G + 0.0722·B  Luminance
 *   #37 — color_out = pow(color, 1.0/2.2)  Gamma korreksiya
 * ═══════════════════════════════════════════════════════════════════════════════
 */


// ─────────────────────────────────────────────────────────────────────────────
// I. LUMINANCE — Yorqinlik hisoblash
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Formula #36 ──
//
// L = 0.2126·R + 0.7152·G + 0.0722·B
//
// Bu koeffitsientlar inson ko'zining rang sezuvchanligiga mos:
//   - Ko'z yashil rangga eng sezgir (71.52%)
//   - Qizilga o'rtacha (21.26%)
//   - Ko'kga eng kam (7.22%)
//
// ITU-R BT.709 standarti (sRGB)
//
// Ishlatiladi:
//   - Bloom threshold hisoblash
//   - Film grain yo'nalish
//   - Ekspozitsiya hisoblash
// ─────────────────────────────────────────────────────────────────────────────

float luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

// Nisbiy luminance (keng diapazon uchun, logarifmik)
float logLuminance(vec3 color) {
  return log(luminance(color) + 0.0001);
}


// ─────────────────────────────────────────────────────────────────────────────
// II. ACES FILMIC TONE MAPPING
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Formula #26 ──
//
// f(x) = (x · (a·x + b)) / (x · (c·x + d) + e)
//
// Parametrlar (ACES standarti):
//   a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14
//
// Bu "S-egri" (sigmoid):
//   - Qorong'i tonlar → deyarli chiziqli (detallar saqlanadi)
//   - O'rta tonlar → biroz siqilgan
//   - Yorqin tonlar → kuchli siqilgan (clipping yo'q)
//   - Juda yorqin → 1.0 ga asimptotik yaqinlashadi
//
// Hollywood standarti — Interstellar, Dune, va boshqa filmlar
// shu usulni ishlatadi.
// ─────────────────────────────────────────────────────────────────────────────

vec3 acesToneMap(vec3 color) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;

  // Formulani har bir kanal uchun qo'llash
  vec3 x = color;
  vec3 result = (x * (a * x + b)) / (x * (c * x + d) + e);

  return clamp(result, 0.0, 1.0);
}

// Ekspozitsiya qo'llanilgan versiya
vec3 acesToneMapExposed(vec3 color, float exposure) {
  return acesToneMap(color * exposure);
}


// ─────────────────────────────────────────────────────────────────────────────
// III. MUQOBIL TONE MAPPING USULLARI
// ─────────────────────────────────────────────────────────────────────────────

// ── Reinhard (oddiy, lekin kontrast yo'qolishi) ──
vec3 reinhardToneMap(vec3 color) {
  return color / (color + vec3(1.0));
}

// ── Reinhard Extended (oq nuqta bilan) ──
vec3 reinhardExtendedToneMap(vec3 color, float whitePoint) {
  float wp2 = whitePoint * whitePoint;
  vec3 numerator = color * (1.0 + color / wp2);
  return numerator / (1.0 + color);
}

// ── Uncharted 2 (filmic, lekin ACES'dan eski) ──
vec3 unchartedPartial(vec3 x) {
  float A = 0.15;
  float B = 0.50;
  float C = 0.10;
  float D = 0.20;
  float E = 0.02;
  float F = 0.30;
  return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
}

vec3 uncharted2ToneMap(vec3 color) {
  float exposureBias = 2.0;
  vec3 curr = unchartedPartial(color * exposureBias);
  vec3 whiteScale = vec3(1.0) / unchartedPartial(vec3(11.2));
  return curr * whiteScale;
}


// ─────────────────────────────────────────────────────────────────────────────
// IV. GAMMA KORREKSIYA
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Formula #37 ──
//
// color_out = pow(color_linear, vec3(1.0 / gamma))
// gamma = 2.2 (sRGB standarti)
//
// Fizik sabab:
//   GPU ichida ranglar CHIZIQLI (linear) makonida saqlanadi —
//   bu fizik hisob-kitoblar uchun to'g'ri.
//
//   Lekin ekranlar (monitorlar) NOLINEAR — ular chiziqli qiymatni
//   to'g'ridan-to'g'ri ko'rsatsa, rasm juda qorong'i bo'ladi.
//
//   Gamma korreksiya: chiziqli → sRGB (ekran uchun mos)
//
// pow(x, 1/2.2) ≈ 0.4545 ko'rsatkichi — qorong'i tonlarni ochadi
// ─────────────────────────────────────────────────────────────────────────────

vec3 gammaCorrect(vec3 color, float gamma) {
  return pow(max(color, vec3(0.0)), vec3(1.0 / gamma));
}

// Standart sRGB gamma (2.2)
vec3 linearToSRGB(vec3 color) {
  return gammaCorrect(color, 2.2);
}

// Teskari: sRGB → chiziqli (agar kerak bo'lsa)
vec3 srgbToLinear(vec3 color) {
  return pow(max(color, vec3(0.0)), vec3(2.2));
}


// ─────────────────────────────────────────────────────────────────────────────
// V. CHROMATIC ABERRATION
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Formula #30 ──
//
// R = texture(uv + direction * amount)
// G = texture(uv)
// B = texture(uv - direction * amount)
//
// direction = normalize(uv - 0.5) — markazdan chetga yo'nalish
//
// Linza imperfeksiyasi — RGB kanallar biroz turli burchak ostida
// sinadi (dispersiya). Natija: chetlarda rangli "kamalak".
//
// Bu funksiya post-processing pass'da ishlatiladi —
// asosiy fragment shader'da emas (chunki texture lookup kerak)
// ─────────────────────────────────────────────────────────────────────────────

// UV siljish vektorini hisoblash
// Markazda 0, chetlarda maksimal
vec2 chromaticOffset(vec2 uv, float intensity, float falloffExponent) {
  vec2 center = vec2(0.5);
  vec2 direction = uv - center;
  float dist = length(direction);

  // Radial falloff — markazda effekt yo'q, chetda to'liq
  float falloff = pow(dist, falloffExponent);

  return normalize(direction) * intensity * falloff;
}


// ─────────────────────────────────────────────────────────────────────────────
// VI. VIGNETTE — chetlar qorayishi
// ─────────────────────────────────────────────────────────────────────────────
//
// Kinematografik kadr hissi — chetlar qorayadi
// IMAX linzalar uchun tabiiy effekt
// ─────────────────────────────────────────────────────────────────────────────

float vignette(vec2 uv, float intensity, float smoothness, float roundness) {
  vec2 center = vec2(0.5);
  vec2 dist = abs(uv - center) * 2.0;

  // Elliptik masofa
  dist = pow(dist, vec2(roundness));
  float d = pow(dist.x + dist.y, 1.0 / roundness);

  // Silliq o'tish
  return 1.0 - smoothstep(smoothness, smoothness + (1.0 - smoothness), d) * intensity;
}


// ─────────────────────────────────────────────────────────────────────────────
// VII. COLOR GRADING — rang sozlash
// ─────────────────────────────────────────────────────────────────────────────
//
// Interstellar filmining rang palitrasiga yaqinlashtirish:
//   - Biroz past saturation
//   - Iliq o'rta tonlar
//   - Sovuq soyalar
// ─────────────────────────────────────────────────────────────────────────────

// Kontrast
vec3 adjustContrast(vec3 color, float contrast) {
  vec3 midpoint = vec3(0.5);
  return (color - midpoint) * contrast + midpoint;
}

// Saturation
vec3 adjustSaturation(vec3 color, float saturation) {
  float lum = luminance(color);
  return mix(vec3(lum), color, saturation);
}

// Rang temperaturasi (soddalashtirilgan)
// temp < 1.0 = sovuq (ko'k), temp > 1.0 = iliq (sariq)
vec3 adjustTemperature(vec3 color, float temp) {
  return vec3(
    color.r * temp,
    color.g,
    color.b / temp
  );
}

// To'liq color grading pipeline
vec3 colorGrade(
  vec3 color,
  float contrast,
  float saturation,
  float temperature,
  vec3 shadowTint,
  vec3 midtoneTint,
  vec3 highlightTint
) {
  // Kontrast
  color = adjustContrast(color, contrast);

  // Saturation
  color = adjustSaturation(color, saturation);

  // Temperatura
  float tempFactor = temperature / 6500.0;
  color = adjustTemperature(color, tempFactor);

  // Shadow/Midtone/Highlight tinting
  float lum = luminance(color);

  // Soya tint (qorong'i joylar)
  float shadowWeight = 1.0 - smoothstep(0.0, 0.3, lum);
  color += shadowTint * shadowWeight;

  // O'rta ton tint
  float midWeight = 1.0 - abs(lum - 0.5) * 2.0;
  midWeight = max(midWeight, 0.0);
  color += midtoneTint * midWeight;

  // Yorqin joy tint
  float highlightWeight = smoothstep(0.6, 1.0, lum);
  color += highlightTint * highlightWeight;

  return max(color, vec3(0.0));
}


// ─────────────────────────────────────────────────────────────────────────────
// VIII. TO'LIQ POST-PROCESSING PIPELINE
// ─────────────────────────────────────────────────────────────────────────────
//
// Barcha rang ishlov berishni ketma-ket qo'llash.
// Fragment shader'ning yakuniy bosqichi sifatida chaqiriladi.
//
// Tartib muhim:
//   1. Ekspozitsiya
//   2. Tone mapping (HDR → SDR)
//   3. Color grading
//   4. Gamma korreksiya (chiziqli → sRGB)
//   5. Vignette
//   6. Film grain (noise.glsl'dan)
// ─────────────────────────────────────────────────────────────────────────────

vec3 postProcess(
  vec3 hdrColor,        // HDR rang (ray marching natijasi)
  vec2 uv,              // Ekran UV koordinatasi
  float exposure,       // Ekspozitsiya
  float gamma,          // Gamma (2.2)
  float vignetteIntensity,
  float vignetteSmoothness,
  float vignetteRoundness
) {
  // 1. Ekspozitsiya
  vec3 color = hdrColor * exposure;

  // 2. ACES Tone Mapping (Formula #26)
  color = acesToneMap(color);

  // 3. Gamma korreksiya (Formula #37)
  color = gammaCorrect(color, gamma);

  // 4. Vignette
  float vig = vignette(uv, vignetteIntensity, vignetteSmoothness, vignetteRoundness);
  color *= vig;

  // 5. Clamp
  color = clamp(color, 0.0, 1.0);

  return color;
}
