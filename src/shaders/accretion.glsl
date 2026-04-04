/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Accretion Disk Shader
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Accretion disk fizikasi va vizualizatsiyasi.
 * Qora tuynuk atrofida spiralda aylanayotgan qizib ketgan gaz va plazma diski.
 *
 * Vizual maqsad: Interstellar filmi referans tasviri —
 *   - Nozik filamentli tolalar orbital yo'nalish bo'ylab cho'zilgan
 *   - Ichki: yorqin oq-oltin, o'rta: to'yingan oltin-amber, tashqi: qora-qizil
 *   - Yuqori kontrast: yorqin tolalar va qorong'i bo'shliqlar orasida
 *   - Konsentrik halqa tuzilmalari va spiral qo'llar
 *   - Tashqi chegarada nozik tolalar (wisps)
 *   - HDR yorqinlik: tonemapping'dan keyin rang ko'rinadigan qilib
 *
 * Tuzilma (1000+ qator):
 *   I.    Fizika — temperatura, yorqinlik, orbital tezlik
 *   II.   Rang — blackbody approksimatsiyasi
 *   III.  Yordamchi — kontrast, impuls, interpolatsiya
 *   IV.   Filament tizimi — ultra-nozik, nozik, o'rta, katta masshtab
 *   V.    Halqa tuzilmasi — konsentrik yorqinlik variatsiyalari
 *   VI.   Spiral qo'llar — katta masshtabli aylanma tuzilma
 *   VII.  Issiq nuqtalar — lokalizatsiyalangan yorqin hududlar
 *   VIII. Qorong'i yo'laklar — filamentlar orasidagi bo'shliqlar
 *   IX.   Ichki korona — ISCO yaqinidagi yorqin porlash
 *   X.    Tashqi tolalar — disk chegarasidagi nozik wisps
 *   XI.   Rang xaritasi — radiusdan rangga ko'p zonali xaritalash
 *   XII.  Ko'p masshtabli noise — hamma narsani birlashtirish
 *   XIII. computeDiskColor — yakuniy disk rangi
 *   XIV.  diskDensity — volumetrik zichlik
 *   XV.   diskEmission — volumetrik nurlanish
 *
 * Bog'liqlik: noise.glsl (fbm3D funksiyasi kerak)
 *
 * Formulalar:
 *   #17 — r_ISCO = 6GM/c²              Disk ichki radiusi
 *   #18 — v_orb = √(M/r)·(1-Rs/r)⁻¹/² Kepler orbital tezligi
 *   #19 — T(r) = T_max·(r/r_ISCO)^(-3/4)·[1-√(r_ISCO/r)]^(1/4)
 *   #20 — B(ν,T) → blackbody rang approksimatsiyasi
 *   #21 — I(r) = I₀·(r_ISCO/r)³·[1-√(r_ISCO/r)]
 * ═══════════════════════════════════════════════════════════════════════════════
 */


// ═══════════════════════════════════════════════════════════════════════════════
// I. FIZIKA FUNKSIYALARI
// ═══════════════════════════════════════════════════════════════════════════════
//
// Bu funksiyalar fizik formulalarga asoslangan va o'zgartirilmaydi.
// Ular diskning temperatura, yorqinlik va tezlik profillarini hisoblaydi.


// ─────────────────────────────────────────────────────────────────────────────
// I.1. TEMPERATURA PROFILI
// ─────────────────────────────────────────────────────────────────────────────
// ── Formula #19: Shakura-Sunyaev (1973) ──
// Akkresiya diskining standart nozik disk modeli.
// Temperatura ISCO yaqinida eng yuqori va tashqiga qarab kamayadi.
//
// T(r) = T_max · (r / r_ISCO)^(-3/4) · [1 - √(r_ISCO / r)]^(1/4)
//
// r     — nuqtaning radiusi
// rISCO — eng ichki barqaror aylana orbita (innermost stable circular orbit)
//
// Qaytaradi: normallashtirilgan temperatura [0, ~1]

float diskTemperature(float r, float rISCO) {
  if (r <= rISCO) return 0.0;
  float ratio = rISCO / r;
  // (rISCO/r)^0.75 — radial kamayish
  // [1-sqrt(rISCO/r)]^0.25 — ISCO da nolga tushirish (no-torque boundary)
  return pow(ratio, 0.75) * pow(max(1.0 - sqrt(ratio), 0.0), 0.25);
}


// ─────────────────────────────────────────────────────────────────────────────
// I.2. YORQINLIK PROFILI
// ─────────────────────────────────────────────────────────────────────────────
// ── Formula #21 ──
// Yuzaki yorqinlik — energiya oqimi disk yuzasidan.
// ISCO da nolga tushadi (no-torque inner boundary condition).
//
// I(r) = I₀ · (r_ISCO / r)³ · [1 - √(r_ISCO / r)]
//
// Eslatma: Bu funksiya juda tez kamayadi — r=2*rISCO da ~60% past.
// Shuning uchun HDR multiplikator kerak.
//
// Qaytaradi: normallashtirilgan yorqinlik [0, ~0.056]
//   (maksimal qiymat r ≈ 1.36 * rISCO da)

float diskLuminosity(float r, float rISCO) {
  if (r <= rISCO) return 0.0;
  float ratio = rISCO / r;
  return ratio * ratio * ratio * max(1.0 - sqrt(ratio), 0.0);
}


// ─────────────────────────────────────────────────────────────────────────────
// I.3. KENGAYTIRILGAN YORQINLIK
// ─────────────────────────────────────────────────────────────────────────────
// Standard diskLuminosity juda tez kamayadi (r^-3).
// Tashqi hududlarda rang ko'rinishi uchun yumshoqroq profil qo'shamiz.
// Bu fizik jihatdan "sochilgan yorug'lik" yoki "reprocessed emission" ni ifodalaydi.
//
// Qaytaradi: [0, ~0.056] — asosiy + yumshoq ambient

float diskLuminosityExtended(float r, float rISCO, float outerR) {
  float baseLum = diskLuminosity(r, rISCO);

  // Tashqi hududlar uchun yumshoq qo'shimcha emissiya
  // r^(-1.5) profil — fizik luminosity (r^-3) dan sekinroq kamayadi
  float t = clamp((r - rISCO) / (outerR - rISCO), 0.0, 1.0);
  float ambientLum = 0.008 * pow(max(1.0 - t, 0.0), 1.5);

  return baseLum + ambientLum;
}


// ─────────────────────────────────────────────────────────────────────────────
// I.4. ORBITAL TEZLIK
// ─────────────────────────────────────────────────────────────────────────────
// ── Formula #18: Kepler orbital tezligi (Schwarzschild) ──
// Moddaning qora tuynuk atrofidagi orbital tezligi.
// Bu doppler.glsl da Doppler effekt hisoblash uchun ishlatiladi.
//
// v_orb = √(M/r) · (1 - Rs/r)^(-1/2)
//
// Qaytaradi: tezlik [0, 0.999] (c birliklarda)

float diskOrbitalVelocity(float r, float Rs) {
  if (r <= Rs) return 0.999;
  return min(1.0 / sqrt(r) / sqrt(1.0 - Rs / r), 0.999);
}


// ═══════════════════════════════════════════════════════════════════════════════
// II. QORA TANALI NURLANISH → RANG
// ═══════════════════════════════════════════════════════════════════════════════
//
// ── Formula #20: Planck approksimatsiyasi ──
// Temperaturadan rangga o'tkazish — qora tana nurlanish spektri.
// Interstellar filmidagi issiq oltin-oq palitra asosida.
//
// t: normallashtirilgan temperatura [0, 1]
//   0.0 — sovuq (qorong'i qizil-jigarrang)
//   0.3 — iliq (amber)
//   0.6 — issiq (oltin)
//   1.0 — juda issiq (oq-oltin)

vec3 blackbodyColor(float t) {
  // Piecewise interpolatsiya — 5 zona
  if (t < 0.15) {
    // Sovuq: qorong'i jigarrang-qizil
    float s = t / 0.15;
    return mix(
      vec3(0.08, 0.02, 0.003),   // Juda sovuq: deyarli ko'rinmas
      vec3(0.45, 0.12, 0.02),    // Iliq jigarrang
      s
    );
  }
  if (t < 0.35) {
    // Iliq: amber
    float s = (t - 0.15) / 0.2;
    return mix(
      vec3(0.45, 0.12, 0.02),    // Jigarrang
      vec3(0.95, 0.50, 0.08),    // To'yingan amber
      s
    );
  }
  if (t < 0.55) {
    // Issiq: oltin
    float s = (t - 0.35) / 0.2;
    return mix(
      vec3(0.95, 0.50, 0.08),    // Amber
      vec3(1.0, 0.75, 0.25),     // Oltin
      s
    );
  }
  if (t < 0.8) {
    // Juda issiq: oq-oltin
    float s = (t - 0.55) / 0.25;
    return mix(
      vec3(1.0, 0.75, 0.25),     // Oltin
      vec3(1.0, 0.92, 0.60),     // Iliq oq
      s
    );
  }
  // Eng issiq: deyarli oq
  float s = (t - 0.8) / 0.2;
  return mix(
    vec3(1.0, 0.92, 0.60),       // Iliq oq
    vec3(1.0, 0.97, 0.88),       // Sof oq (biroz issiq)
    s
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// III. YORDAMCHI FUNKSIYALAR
// ═══════════════════════════════════════════════════════════════════════════════
//
// Noise va vizual effektlar uchun umumiy yordamchi funksiyalar.


// ─────────────────────────────────────────────────────────────────────────────
// III.1. KONTRAST KUCHAYTIRISH
// ─────────────────────────────────────────────────────────────────────────────
// S-egri chiziq orqali kontrastni oshirish.
// center — 0.5 da neytral, pastroq = qorong'iroq, yuqoriroq = yorqinroq
// sharpness — egri chiziq keskinligi (yuqori = kuchli kontrast)

float boostContrast(float x, float center, float sharpness) {
  return smoothstep(center - sharpness, center + sharpness, x);
}


// ─────────────────────────────────────────────────────────────────────────────
// III.2. NOZIK IMPULS
// ─────────────────────────────────────────────────────────────────────────────
// Gaussian impuls — berilgan markazda nozik cho'qqi hosil qiladi.
// Halqa tuzilmasi va issiq nuqtalar uchun ishlatiladi.
//
// x     — kirish qiymati
// center — cho'qqi markazi
// width  — cho'qqi kengligi (sigma)

float gaussianPulse(float x, float center, float width) {
  float d = x - center;
  return exp(-d * d / (width * width));
}


// ─────────────────────────────────────────────────────────────────────────────
// III.3. YUMSHOQ MAKSIMUM
// ─────────────────────────────────────────────────────────────────────────────
// max() ning silliq versiyasi — o'tish joylarida artefakt yo'q.

float softMax(float a, float b, float k) {
  return log(exp(k * a) + exp(k * b)) / k;
}


// ─────────────────────────────────────────────────────────────────────────────
// III.4. ORBITAL AYLANTIRILGAN BURCHAK
// ─────────────────────────────────────────────────────────────────────────────
// Differensial aylanish — ichki hududlar tezroq aylanadi.
// Har bir radius uchun burchakni vaqtga qarab siljitadi.
//
// theta — original burchak
// r     — radius
// time  — vaqt
//
// Qaytaradi: aylantirilgan burchak

float rotatedTheta(float theta, float r, float time) {
  float rotRate = u_diskRotSpeed * (2.0 / (r + 1.0));
  return theta + time * rotRate;
}


// ═══════════════════════════════════════════════════════════════════════════════
// IV. FILAMENT TIZIMI
// ═══════════════════════════════════════════════════════════════════════════════
//
// Accretion diskning eng muhim vizual xususiyati — nozik tolalar (filaments).
// Bu tolalar orbital yo'nalish bo'ylab cho'zilgan issiq gaz oqimlaridir.
//
// Fizik jihatdan: magnit maydon chiziqlari bo'ylab oqayotgan plazma.
// Vizual jihatdan: Interstellar filmidagi "soch" ga o'xshash tuzilma.
//
// Anizotropik noise orqali yaratiladi:
//   - Radial yo'nalish: YUQORI chastota → nozik chiziqlar
//   - Azimuthal yo'nalish: PAST chastota → uzun, silliq yoylar
//
// 4 ta masshtab qatlami:
//   1. Ultra-nozik  — individual gaz iplari (faqat yaqinda ko'rinadi)
//   2. Nozik        — asosiy filament tuzilmasi
//   3. O'rta        — keng yorqinlik modulyatsiyasi
//   4. Katta        — spiral qo'llar va umumiy tuzilma


// ─────────────────────────────────────────────────────────────────────────────
// IV.1. ULTRA-NOZIK FILAMENTLAR
// ─────────────────────────────────────────────────────────────────────────────
// Individual gaz oqimlari — juda ingichka, uzun yoylar.
// Radial chastota: 7x (juda ko'p nozik chiziq)
// Azimuthal cho'zilish: 0.06x (juda uzun yoylar)
//
// Bu eng kichik masshtab — disk yuzasidagi individual "iplar".
// Yorqin iplar kam, qorong'i fon ko'p (smoothstep bilan filtrlangan).

float ultraFineFilaments(float r, float theta, float time) {
  vec3 p = vec3(
    r * u_noiseScale * 7.0,       // Radial: juda yuqori chastota
    theta * u_noiseScale * 0.06,   // Azimuthal: juda cho'zilgan
    time * u_noiseTimeScale * 0.08 // Vaqt: sekin o'zgaradi
  );
  float n = fbm3D(p, u_noiseOctaves, u_noiseLacunarity, u_noisePersistence);
  n = n * 0.5 + 0.5;

  // Faqat eng yorqin iplarni ko'rsatish (qolganini kesish)
  n = smoothstep(0.35, 0.85, n);

  return n;
}


// ─────────────────────────────────────────────────────────────────────────────
// IV.2. NOZIK FILAMENTLAR
// ─────────────────────────────────────────────────────────────────────────────
// Asosiy filament tuzilmasi — disk vizualining "yuragi".
// Radial chastota: 4.5x (ko'p nozik chiziq, lekin ultra-fine dan kam)
// Azimuthal cho'zilish: 0.1x (uzun yoylar)
//
// Bu qatlam eng ko'p vizual ta'sir ko'rsatadi.
// Kontrastli: yorqin tolalar va qorong'i bo'shliqlar aniq farqlanadi.

float fineFilaments(float r, float theta, float time) {
  vec3 p = vec3(
    r * u_noiseScale * 4.5,       // Radial: yuqori chastota
    theta * u_noiseScale * 0.1,    // Azimuthal: cho'zilgan
    time * u_noiseTimeScale * 0.12 // Vaqt: sekin o'zgaradi
  );
  float n = fbm3D(p, u_noiseOctaves, u_noiseLacunarity, u_noisePersistence);
  n = n * 0.5 + 0.5;

  // Kontrast kuchaytirish
  n = smoothstep(0.2, 0.8, n);

  return n;
}


// ─────────────────────────────────────────────────────────────────────────────
// IV.3. O'RTA MASSHTABLI TURBULENSIYA
// ─────────────────────────────────────────────────────────────────────────────
// Keng yorqinlik modulyatsiyasi — filamentlar guruhini yoritadi/qoraytiradi.
// Radial chastota: 2x (keng zonalar)
// Azimuthal cho'zilish: 0.25x (uzun yoylar, lekin qisqaroq)
//
// Bu qatlam filamentlarni guruhlab "yorqin hududlar" va "qorong'i hududlar" yaratadi.
// Interstellar filmida bu "aylanayotgan bulutlar" effekti.

float mediumTurbulence(float r, float theta, float time) {
  vec3 p = vec3(
    r * u_noiseScale * 2.0,       // Radial: o'rta chastota
    theta * u_noiseScale * 0.25,   // Azimuthal: biroz cho'zilgan
    time * u_noiseTimeScale * 0.1  // Vaqt: sekin o'zgaradi
  );
  float n = fbm3D(p, max(u_noiseOctaves - 1, 2), u_noiseLacunarity, u_noisePersistence);
  n = n * 0.5 + 0.5;

  return n;
}


// ─────────────────────────────────────────────────────────────────────────────
// IV.4. BIRLASHTIRILGAN FILAMENT INTENSIVLIGI
// ─────────────────────────────────────────────────────────────────────────────
// Hamma filament qatlamlarini optimal vaznlar bilan birlashtiradi.
// Natija: 0 = qorong'i bo'shliq, 1 = yorqin filament.
//
// r, theta — disk koordinatalari (aylanish allaqachon qo'shilgan)
// time     — vaqt

float combinedFilaments(float r, float theta, float time) {
  float ultra = ultraFineFilaments(r, theta, time);
  float fine  = fineFilaments(r, theta, time);
  float med   = mediumTurbulence(r, theta, time);

  // Ultra-nozik faqat ichki hududlarda ko'rinadi (tashqida zoom yetarli emas)
  float innerWeight = smoothstep(0.4, 0.1, (r - u_diskInnerRadius) /
    (u_diskOuterRadius * 2.5 - u_diskInnerRadius));

  // Vaznli birlashtirish
  float combined = ultra * (0.15 + innerWeight * 0.10)  // Ichkida kuchli
                 + fine * 0.45                            // Asosiy tuzilma
                 + med * 0.25;                            // Keng modulyatsiya

  // Normallash (umumiy vazn 0.85-0.95 oralig'ida)
  combined = clamp(combined / 0.85, 0.0, 1.0);

  return combined;
}


// ═══════════════════════════════════════════════════════════════════════════════
// V. HALQA TUZILMASI
// ═══════════════════════════════════════════════════════════════════════════════
//
// Konsentrik halqalar — disk ichidagi yorqinlik variatsiyalari.
// Fizik jihatdan: disk moddasi bir tekis taqsimlanmagan.
// Rezonans radiuslarda modda to'planadi yoki tarqaladi.
//
// 3 ta qatlam:
//   1. Asosiy halqalar — keng, silliq yorqinlik o'zgarishlari
//   2. Nozik halqalar — ingichka, keskin chiziqlar
//   3. Halqa bo'shliqlari (gaps) — aniq qorong'i zonalar


// ─────────────────────────────────────────────────────────────────────────────
// V.1. ASOSIY HALQALAR
// ─────────────────────────────────────────────────────────────────────────────
// Keng konsentrik yorqinlik variatsiyalari.
// Noise bilan modulyatsiya qilingan sin() — muntazam emas, tabiiy ko'rinishli.

float primaryRings(float r, float theta) {
  // Noise modulyator — halqa chastotasini biroz o'zgartiradi
  float mod = fbm3D(
    vec3(theta * 0.2, r * 1.2, 0.0),
    2, 2.0, 0.5
  );

  // Asosiy halqa sin() — chastota r * 8.0 (taxminan 8 ta halqa)
  float phase = r * 8.0 + mod * 3.0;
  float rings = sin(phase) * 0.5 + 0.5;

  // Silliq qilib kesish
  rings = smoothstep(0.2, 0.8, rings);

  return rings;
}


// ─────────────────────────────────────────────────────────────────────────────
// V.2. NOZIK HALQALAR
// ─────────────────────────────────────────────────────────────────────────────
// Ingichka, yorqin halqa chiziqlari.
// Yuqori chastota — ko'p nozik chiziq.
// Ichki hududlarda kuchli, tashqida yo'qoladi.

float fineRings(float r, float theta, float ringMod) {
  // Yuqori chastota sin() — nozik chiziqlar
  float phase = r * 22.0 + ringMod * 2.0;
  float rings = sin(phase) * 0.5 + 0.5;

  // Faqat eng yorqin chiziqllarni ko'rsatish (nozik impulslar)
  rings = pow(rings, 3.0);

  // Tashqida so'nish
  float t = (r - u_diskInnerRadius) / (u_diskOuterRadius * 2.5 - u_diskInnerRadius);
  float outerFade = 1.0 - smoothstep(0.3, 0.8, t);

  return rings * outerFade;
}


// ─────────────────────────────────────────────────────────────────────────────
// V.3. HALQA BO'SHLIQLARI (GAPS)
// ─────────────────────────────────────────────────────────────────────────────
// Aniq qorong'i halqalar — modda kam bo'lgan zonalar.
// Saturn halqalaridagi Cassini bo'shlig'iga o'xshash.
// Kam chastota — 3-4 ta katta bo'shliq.

float ringGaps(float r) {
  // Past chastota — yumshoq keng bo'shliqlar
  float gap1 = smoothstep(0.0, 0.30, abs(sin(r * 4.5 + 1.0)));
  float gap2 = smoothstep(0.0, 0.25, abs(sin(r * 7.0 + 2.3)));

  // Ikkalasini birlashtirish
  return gap1 * gap2;
}


// ─────────────────────────────────────────────────────────────────────────────
// V.4. BIRLASHTIRILGAN HALQA TUZILMASI
// ─────────────────────────────────────────────────────────────────────────────
// Hamma halqa qatlamlarini birlashtiradi.
// Qaytaradi: 0 = bo'shliq (qorong'i), 1 = to'liq halqa (yorqin)

float combinedRings(float r, float theta) {
  // Ring modulator (bir marta hisoblash, qayta ishlatish)
  float ringMod = fbm3D(
    vec3(theta * 0.2, r * 1.2, 0.0),
    2, 2.0, 0.5
  );

  float primary = primaryRings(r, theta);
  float fine    = fineRings(r, theta, ringMod);
  float gaps    = ringGaps(r);

  // Vaznli birlashtirish
  float combined = primary * 0.5 + fine * 0.25 + 0.25;

  // Bo'shliqlarni qo'llash (multiplikativ)
  combined *= gaps;

  return combined;
}


// ═══════════════════════════════════════════════════════════════════════════════
// VI. SPIRAL QO'LLAR
// ═══════════════════════════════════════════════════════════════════════════════
//
// Katta masshtabli spiral tuzilma — diskning umumiy shakli.
// Fizik jihatdan: gravitatsion nobarqarorlik natijasida hosil bo'lgan
// spiral zichlik to'lqinlari (galaktika spiral qo'llariga o'xshash).
//
// 2 ta spiral qo'l + noise buzilish = tabiiy ko'rinish.


// ─────────────────────────────────────────────────────────────────────────────
// VI.1. SPIRAL QANOT INTENSIVLIGI
// ─────────────────────────────────────────────────────────────────────────────
// Logarifmik spiral — r ga teskari proporsional o'ralish.
// nArms — spiral qo'llar soni (odatda 2)
//
// Qaytaradi: 0 = spiral orasida, 1 = spiral ichida

float spiralArms(float r, float theta, float time) {
  // Spiral o'ralish — ichki hududlarda kuchli, tashqida zaif
  float wind = 5.0 / (r + 0.4);

  // 2 ta asosiy spiral qo'l
  float spiralPhase = theta * 2.0 + wind + time * u_noiseTimeScale * 0.35;
  float arm1 = sin(spiralPhase) * 0.5 + 0.5;
  arm1 = pow(arm1, 0.6); // Yumshoqroq profil (keng qo'l)

  // Noise bilan buzish — tabiiy ko'rinish
  float distortion = fbm3D(
    vec3(r * 1.0, theta * 0.4, time * 0.04),
    2, 2.0, 0.5
  );
  arm1 = clamp(arm1 + distortion * 0.2, 0.0, 1.0);

  // 3-chi kichik spiral qo'l (kuchsiz)
  float spiralPhase2 = theta * 3.0 + wind * 1.3 + time * u_noiseTimeScale * 0.25 + 2.0;
  float arm2 = sin(spiralPhase2) * 0.5 + 0.5;
  arm2 = pow(arm2, 1.2) * 0.3; // Zaifroq

  return clamp(arm1 + arm2, 0.0, 1.0);
}


// ═══════════════════════════════════════════════════════════════════════════════
// VII. ISSIQ NUQTALAR
// ═══════════════════════════════════════════════════════════════════════════════
//
// Lokalizatsiyalangan yorqin hududlar — diskning eng issiq joylari.
// Fizik jihatdan: magnit rekonnekciya, siqilish to'lqinlari,
// yoki spiral qo'llar kesishgan joylar.
//
// 2 ta masshtab:
//   1. Katta issiq hududlar — keng, yumshoq porlash
//   2. Kichik yorqin nuqtalar — keskin, lokalizatsiyalangan


// ─────────────────────────────────────────────────────────────────────────────
// VII.1. KATTA ISSIQ HUDUDLAR
// ─────────────────────────────────────────────────────────────────────────────

float largeHotRegions(float r, float theta, float time) {
  vec3 p = vec3(
    r * 1.8,
    theta * 1.2,
    time * 0.06
  );
  float n = fbm3D(p, 3, 2.0, 0.4);
  n = n * 0.5 + 0.5;
  n = smoothstep(0.35, 0.75, n);
  return n;
}


// ─────────────────────────────────────────────────────────────────────────────
// VII.2. KICHIK YORQIN NUQTALAR
// ─────────────────────────────────────────────────────────────────────────────

float smallBrightSpots(float r, float theta, float time) {
  vec3 p = vec3(
    r * 4.0,
    theta * 2.5,
    time * 0.12
  );
  float n = fbm3D(p, 2, 2.0, 0.5);
  n = n * 0.5 + 0.5;
  // Faqat eng yorqin nuqtalar (keskin filter)
  n = smoothstep(0.55, 0.9, n);
  return n;
}


// ─────────────────────────────────────────────────────────────────────────────
// VII.3. BIRLASHTIRILGAN ISSIQ NUQTALAR
// ─────────────────────────────────────────────────────────────────────────────
// Qaytaradi: 0 = oddiy, 1 = juda issiq

float combinedHotSpots(float r, float theta, float time) {
  float large = largeHotRegions(r, theta, time);
  float small = smallBrightSpots(r, theta, time);

  // Issiq nuqtalar faqat allaqachon yorqin filamentlarda kuchli ta'sir ko'rsatadi
  return large * 0.6 + small * 0.4;
}


// ═══════════════════════════════════════════════════════════════════════════════
// VIII. QORONG'I YO'LAKLAR
// ═══════════════════════════════════════════════════════════════════════════════
//
// Filamentlar orasidagi qorong'i bo'shliqlar.
// Bu vizual kontrastni yaratishning eng muhim qismi.
//
// Fizik jihatdan: magnit maydon chiziqlari orasidagi past zichlik zonalari.
//
// 2 ta tur:
//   1. Azimuthal yo'laklar — orbital yo'nalishda cho'zilgan
//   2. Radial yo'laklar — radius bo'ylab cho'zilgan (magnit maydoni)


// ─────────────────────────────────────────────────────────────────────────────
// VIII.1. AZIMUTHAL QORONG'I YO'LAKLAR
// ─────────────────────────────────────────────────────────────────────────────
// Orbital yo'nalishda cho'zilgan qorong'i chiziqlar.
// Filamentlar orasidagi asosiy bo'shliqlar.

float azimuthalDarkLanes(float r, float theta, float time) {
  // Spiral burchak + noise buzilish
  float spiralDark = sin(
    theta * 9.0 + r * 2.5 +
    fbm3D(vec3(r * 1.5, theta * 0.2, time * 0.03), 2, 2.0, 0.5) * 3.5
  );

  // Yumshoq qorong'i yo'lak (keng, silliq o'tish)
  float lanes = smoothstep(-0.5, 0.6, spiralDark);

  return lanes;
}


// ─────────────────────────────────────────────────────────────────────────────
// VIII.2. RADIAL QORONG'I YO'LAKLAR
// ─────────────────────────────────────────────────────────────────────────────
// Radius bo'ylab cho'zilgan qorong'i chiziqlar.
// Magnit maydoni ta'siri — kamroq ko'rinadi, lekin chuqurlik qo'shadi.

float radialDarkLanes(float r, float theta, float time) {
  float n = fbm3D(
    vec3(theta * 5.0, r * 0.4, time * 0.04),
    2, 2.0, 0.4
  );
  float lanes = smoothstep(-0.6, 0.5, n);
  return lanes;
}


// ─────────────────────────────────────────────────────────────────────────────
// VIII.3. BIRLASHTIRILGAN QORONG'I YO'LAKLAR
// ─────────────────────────────────────────────────────────────────────────────
// Qaytaradi: 0 = juda qorong'i yo'lak, 1 = yo'lak yo'q (normal)

float combinedDarkLanes(float r, float theta, float time) {
  float azim   = azimuthalDarkLanes(r, theta, time);
  float radial = radialDarkLanes(r, theta, time);

  // Multiplikativ — har ikkisi qoraytiradi
  return azim * 0.75 + radial * 0.25;
}


// ═══════════════════════════════════════════════════════════════════════════════
// IX. ICHKI KORONA
// ═══════════════════════════════════════════════════════════════════════════════
//
// ISCO yaqinidagi intensiv yorqin porlash.
// Bu accretion diskning eng issiq, eng yorqin qismi.
//
// Fizik jihatdan: modda ISCO dan o'tganda katta energiya chiqaradi.
// Vizual jihatdan: nozik, yorqin oq chiziq disk ichki chegarasida.
//
// 3 ta komponent:
//   1. Keskin ichki qirra — juda nozik, juda yorqin
//   2. Ichki halo — yumshoq, kengroq porlash
//   3. Koronal tolalar — ichki hududdagi kuchli filamentlar


// ─────────────────────────────────────────────────────────────────────────────
// IX.1. KESKIN ICHKI QIRRA
// ─────────────────────────────────────────────────────────────────────────────
// ISCO da juda nozik, juda yorqin chiziq.
// Gaussian profil — o'tkir cho'qqi.

float innerEdge(float r, float rISCO) {
  float dist = (r - rISCO) / rISCO;
  if (dist < 0.0) return 0.0;

  // Nozik cho'qqi — sigma = 0.05
  float edge = exp(-dist * dist / 0.003);

  return edge;
}


// ─────────────────────────────────────────────────────────────────────────────
// IX.2. ICHKI HALO
// ─────────────────────────────────────────────────────────────────────────────
// Yumshoq, kengroq porlash — ichki hududning umumiy yorqinligi.

float innerHalo(float r, float rISCO) {
  float dist = (r - rISCO) / rISCO;
  if (dist < 0.0) return 0.0;

  // Keng profil — sigma = 0.15
  float halo = exp(-dist * dist / 0.04);

  // Eksponensial so'nish — uzoqda yo'qoladi
  float falloff = exp(-dist * 1.5);

  return halo * 0.5 + falloff * 0.3;
}


// ─────────────────────────────────────────────────────────────────────────────
// IX.3. KORONAL TOLALAR
// ─────────────────────────────────────────────────────────────────────────────
// Ichki hududda kuchliroq filament tuzilmasi.
// ISCO yaqinida tolalar yorqinroq va o'tkirroq.

float coronalFilaments(float r, float theta, float time, float rISCO) {
  float dist = (r - rISCO) / rISCO;
  if (dist < 0.0 || dist > 0.5) return 0.0;

  // Juda nozik tolalar — ichki hududga xos
  vec3 p = vec3(
    r * u_noiseScale * 10.0,       // Juda yuqori radial chastota
    theta * u_noiseScale * 0.04,   // Juda cho'zilgan
    time * u_noiseTimeScale * 0.2
  );
  float n = fbm3D(p, u_noiseOctaves, u_noiseLacunarity, u_noisePersistence);
  n = n * 0.5 + 0.5;
  n = smoothstep(0.3, 0.8, n);

  // ISCO dan uzoqlashganda so'nish
  float fade = exp(-dist * dist / 0.05);

  return n * fade;
}


// ─────────────────────────────────────────────────────────────────────────────
// IX.4. BIRLASHTIRILGAN ICHKI KORONA
// ─────────────────────────────────────────────────────────────────────────────
// Qaytaradi: 0 = korona ta'siri yo'q, 1+ = kuchli koronal porlash

float combinedCorona(float r, float theta, float time, float rISCO) {
  float edge    = innerEdge(r, rISCO);
  float halo    = innerHalo(r, rISCO);
  float coronal = coronalFilaments(r, theta, time, rISCO);

  return edge * 1.5 + halo * 0.8 + coronal * 0.5;
}


// ═══════════════════════════════════════════════════════════════════════════════
// X. TASHQI TOLALAR (WISPS)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Disk tashqi chegarasidagi nozik, xiralashgan tolalar.
// Ular asosiy diskdan tashqiga cho'zilgan gaz oqimlaridir.
//
// Fizik jihatdan: disk tashqi chegarasida gravitatsiya kuchsiz —
// modda sekin tarqaladi va nozik tolalarga bo'linadi.
//
// Vizual jihatdan: diskni "yumshoq" qirra bilan tugatish.
// Noise-modulyatsiyalangan — ba'zi joylarda tolalar uzunroq.


// ─────────────────────────────────────────────────────────────────────────────
// X.1. TASHQI TOLALAR INTENSIVLIGI
// ─────────────────────────────────────────────────────────────────────────────
// Disk tashqi chegarasidan tashqiga qanday xiralashishini boshqaradi.
//
// Qaytaradi: 0 = to'liq shaffof, 1 = to'liq ko'rinadi

float outerWisps(float r, float theta, float time, float outerR) {
  // Tashqi hududning boshlanish nuqtasi
  float edgeStart = outerR * 0.55;
  float edgeDist = (r - edgeStart) / (outerR - edgeStart);
  if (edgeDist < 0.0) return 1.0; // Ichkida — to'liq ko'rinadi

  // Noise modulyator — tolalar uzunligi har yerda boshqacha
  float rotTheta = rotatedTheta(theta, r, time);
  vec3 p = vec3(
    r * 2.5,
    rotTheta * 0.15,
    time * 0.06
  );
  float wispNoise = fbm3D(p, max(u_noiseOctaves - 1, 2), u_noiseLacunarity, u_noisePersistence);
  wispNoise = wispNoise * 0.5 + 0.5;

  // Ba'zi joylarda tolalar uzoqroqqa cho'ziladi
  float wispExtent = wispNoise * 0.6; // 0-0.6 qo'shimcha masofagacha

  // Asosiy so'nish
  float mainFade = 1.0 - smoothstep(0.0, 0.7, edgeDist);

  // Nozik tolalar — ular biroz uzoqroqqa yetadi
  float wispFade = 1.0 - smoothstep(0.0, 1.0 + wispExtent, edgeDist);
  float wispFilaments = fineFilaments(r, rotTheta, time);
  float wispContribution = wispFade * wispFilaments * 0.4;

  return mainFade + wispContribution;
}


// ═══════════════════════════════════════════════════════════════════════════════
// XI. RANG XARITASI
// ═══════════════════════════════════════════════════════════════════════════════
//
// Radiusdan rangga ko'p zonali xaritalash.
// Interstellar filmidagi rang palitrasi:
//   Ichki → Tashqi: oq-oltin → oltin → amber → jigarrang → qora-qizil
//
// 6 ta rang zonasi — silliq interpolatsiya bilan.
// Temperatura va noise bilan modulyatsiya qilinadi.


// ─────────────────────────────────────────────────────────────────────────────
// XI.1. ASOSIY RANG XARITASI
// ─────────────────────────────────────────────────────────────────────────────
// t: radial pozitsiya [0=ichki, 1=tashqi]

vec3 diskBaseColor(float t) {
  // 6 ta rang nuqtasi — Interstellar palitrasi
  vec3 c0 = vec3(1.0, 0.96, 0.86);    // t=0.00 — ichki qirra: oq-oltin
  vec3 c1 = vec3(1.0, 0.82, 0.45);    // t=0.08 — yorqin oltin
  vec3 c2 = vec3(0.98, 0.65, 0.18);   // t=0.20 — to'yingan oltin
  vec3 c3 = vec3(0.85, 0.42, 0.08);   // t=0.35 — chuqur amber
  vec3 c4 = vec3(0.55, 0.20, 0.04);   // t=0.55 — qizil-jigarrang
  vec3 c5 = vec3(0.20, 0.06, 0.012);  // t=0.80 — qorong'i jigarrang
  vec3 c6 = vec3(0.06, 0.015, 0.003); // t=1.00 — deyarli ko'rinmas

  // Piecewise-linear interpolatsiya
  if (t < 0.08) return mix(c0, c1, t / 0.08);
  if (t < 0.20) return mix(c1, c2, (t - 0.08) / 0.12);
  if (t < 0.35) return mix(c2, c3, (t - 0.20) / 0.15);
  if (t < 0.55) return mix(c3, c4, (t - 0.35) / 0.20);
  if (t < 0.80) return mix(c4, c5, (t - 0.55) / 0.25);
  return mix(c5, c6, (t - 0.80) / 0.20);
}


// ─────────────────────────────────────────────────────────────────────────────
// XI.2. RANG VARIATSIYASI
// ─────────────────────────────────────────────────────────────────────────────
// Noise orqali rang temperaturasini biroz o'zgartirish.
// Bu bir tekis rangdan ko'ra tabiiyroq ko'rinish beradi.
//
// Qaytaradi: rang o'zgartirish koeffitsienti [-0.1, +0.1]

float colorVariation(float r, float theta) {
  float n = fbm3D(
    vec3(r * 1.2, theta * 0.4, 0.0),
    2, 2.0, 0.5
  );
  return n * 0.08; // ±8% rang siljishi
}


// ─────────────────────────────────────────────────────────────────────────────
// XI.3. ISSIQ TOLALAR RANGI
// ─────────────────────────────────────────────────────────────────────────────
// Eng yorqin filamentlar uchun qo'shimcha oq porlash.
// Filament intensivligi yuqori bo'lganda rang oqqa yaqinlashadi.
//
// baseColor — asosiy rang
// hotness   — qanchalik issiq (0-1)
//
// Qaytaradi: modulyatsiya qilingan rang

vec3 hotStreakTint(vec3 baseColor, float hotness, float t) {
  // Ichki hududlardagina oq porlash
  float innerMask = smoothstep(0.4, 0.0, t);

  // Issiq tolalar oq rangga yaqinlashadi
  vec3 hotColor = vec3(1.0, 0.95, 0.85);
  float blendAmount = hotness * innerMask * 0.5;

  return mix(baseColor, hotColor, blendAmount);
}


// ═══════════════════════════════════════════════════════════════════════════════
// XII. KO'P MASSHTABLI NOISE TIZIMI
// ═══════════════════════════════════════════════════════════════════════════════
//
// Hamma noise komponentlarini birlashtirish.
// Bu funksiya computeDiskColor ning "yuragi" — diskning to'liq
// tuzilmasini hisoblaydi.
//
// Qaytaradi: 2 ta qiymat:
//   .x — umumiy intensivlik (0=qorong'i, 1=yorqin)
//   .y — issiqlik darajasi (0=oddiy, 1=juda issiq)


// ─────────────────────────────────────────────────────────────────────────────
// XII.1. YAKUNIY NOISE HISOBLASH
// ─────────────────────────────────────────────────────────────────────────────

vec2 computeDiskNoise(float r, float theta, float time, float outerR) {
  // ── 1. Filament tuzilmasi (asosiy vizual element) ──
  float filaments = combinedFilaments(r, theta, time);

  // ── 2. Halqa tuzilmasi ──
  float rings = combinedRings(r, theta);

  // ── 3. Spiral qo'llar ──
  float spiral = spiralArms(r, theta, time);

  // ── 4. Issiq nuqtalar ──
  float hotSpots = combinedHotSpots(r, theta, time);

  // ── 5. Qorong'i yo'laklar ──
  float darkLanes = combinedDarkLanes(r, theta, time);

  // ── 6. Tashqi tolalar ──
  float wisps = outerWisps(r, theta, time, outerR);

  // ── 7. Ichki korona ──
  float corona = combinedCorona(r, theta, time, u_diskInnerRadius);

  // ════════════════════════════════════════════
  // BIRLASHTIRISH
  // ════════════════════════════════════════════

  // Asosiy intensivlik — filament + ring + spiral
  float baseIntensity = filaments * 0.45 + rings * 0.25 + spiral * 0.12;

  // Issiq nuqtalar qo'shimcha yorqinlik beradi
  baseIntensity += hotSpots * 0.08;

  // Normallash
  baseIntensity = clamp(baseIntensity / 0.9, 0.0, 1.0);

  // Qorong'i yo'laklar — o'rtacha (50% gacha qoraytiradi)
  baseIntensity *= mix(0.50, 1.0, darkLanes);

  // Tashqi tolalar — multiplikativ (chegarada so'ndiradi)
  baseIntensity *= wisps;

  // ── Broad density variation — breaks azimuthal uniformity ──
  // Low radial freq (0.6) + moderate azimuthal freq (1.5) = large patches
  // that vary density across the disk without adding new bands.
  // Range 0.78-1.0: only dims slightly, never removes structure.
  float densityVar = fbm3D(
    vec3(r * 0.6, theta * 1.5, time * 0.03),
    1, 2.0, 0.5
  );
  densityVar = 0.78 + 0.22 * (densityVar * 0.5 + 0.5);
  baseIntensity *= densityVar;

  // Ichki korona — additiv (qo'shimcha yorqinlik)
  baseIntensity += corona * 0.15;
  baseIntensity = clamp(baseIntensity, 0.0, 1.0);

  // Kontrast kuchaytirish — yumshoq (silliq disk uchun)
  baseIntensity = smoothstep(0.12, 0.88, baseIntensity);

  // Issiqlik — filament va hotspot asosida
  float hotness = smoothstep(0.65, 1.0, filaments) * hotSpots;

  return vec2(baseIntensity, hotness);
}


// ═══════════════════════════════════════════════════════════════════════════════
// XIII. DISK NOISE — tashqi interfeys (diskNoise)
// ═══════════════════════════════════════════════════════════════════════════════
//
// computeDiskColor dan chaqiriladigan asosiy noise funksiyasi.
// diskPos — hitPoint.xz (disk tekisligidagi pozitsiya)
// time    — u_time

float diskNoise(vec2 diskPos, float time) {
  float r = length(diskPos);
  float theta = atan(diskPos.y, diskPos.x);
  float outerR = u_diskOuterRadius * 2.5;

  // Orbital aylanish
  float rotTheta = rotatedTheta(theta, r, time);

  // Ko'p masshtabli noise
  vec2 noise = computeDiskNoise(r, rotTheta, time, outerR);

  return noise.x;
}


// ═══════════════════════════════════════════════════════════════════════════════
// XIV. YAKUNIY DISK RANGI — computeDiskColor
// ═══════════════════════════════════════════════════════════════════════════════
//
// Bu funksiya blackhole.frag dan chaqiriladi.
// Ray marching paytida har bir disk nuqtasi uchun rang hisoblaydi.
//
// hitR     — nuqtaning radiusi (length(hitPoint.xz))
// hitPoint — 3D fazoviy nuqta
//
// Qaytaradi: vec4(color.rgb, alpha)
//   color — HDR rang (tonemapping dan OLDIN)
//   alpha — shaffoflik (0=shaffof, 1=to'liq)

vec4 computeDiskColor(float hitR, vec3 hitPoint) {
  float outerR = u_diskOuterRadius * 2.5;

  // ── Fizik profillar ──
  float temp = diskTemperature(hitR, u_diskInnerRadius);
  float lum  = diskLuminosityExtended(hitR, u_diskInnerRadius, outerR);

  // ── Radial pozitsiya [0=ichki, 1=tashqi] ──
  float tLinear = clamp(
    (hitR - u_diskInnerRadius) / (outerR - u_diskInnerRadius),
    0.0, 1.0
  );
  // Nolineer xaritalash: ko'rinadigan disk (t=0-0.3) ranglar palitrasi bo'ylab
  // kengaytiriladi. pow(0.29, 0.35) ≈ 0.67 — endi amber/jigarrang ham ko'rinadi.
  float t = pow(tLinear, 0.35);

  // ══════════════════════════════════════════
  // RANG HISOBLASH
  // ══════════════════════════════════════════

  // 1. Asosiy rang xaritasi
  vec3 baseColor = diskBaseColor(t);

  // 2. Rang variatsiyasi (noise orqali)
  float angle = atan(hitPoint.z, hitPoint.x);
  float rotAngle = rotatedTheta(angle, hitR, u_time);
  float colorVar = colorVariation(hitR, rotAngle);
  float adjustedT = clamp(t + colorVar, 0.0, 1.0);
  baseColor = mix(baseColor, diskBaseColor(adjustedT), 0.5);

  // ══════════════════════════════════════════
  // NOISE / TUZILMA
  // ══════════════════════════════════════════

  // Ko'p masshtabli noise tizimi
  vec2 noiseResult = computeDiskNoise(hitR, rotAngle, u_time, outerR);
  float intensity = noiseResult.x;
  float hotness   = noiseResult.y;

  // ══════════════════════════════════════════
  // YORQINLIK MODULYATSIYASI
  // ══════════════════════════════════════════

  // Noise modulyatsiya — qorong'i bo'shliqlar 18% gacha tushadi
  // Filamentlar ko'rinadigan, lekin zebra bo'lmaydigan balans
  float nFactor = 0.18 + intensity * 0.82;

  // Issiq tolalar — rang oqqa yaqinlashadi
  vec3 finalColor = hotStreakTint(baseColor, hotness, t);

  // ══════════════════════════════════════════
  // EDGE FADING
  // ══════════════════════════════════════════

  // Ichki qirra — ISCO dan boshlash
  float innerFade = smoothstep(0.0, 0.02, t);

  // Tashqi qirra — wisps allaqachon noise ichida hisoblanadi
  // Bu yerda faqat juda tashqini to'liq o'chirish
  float outerCutoff = 1.0 - smoothstep(outerR * 0.95, outerR, hitR);

  // Vertical density — disk qalinligi
  float scaleHeight = u_diskThickness * 2.0 * (1.0 + hitR * 0.25);
  float verticalDensity = exp(-hitPoint.y * hitPoint.y / (scaleHeight * scaleHeight));

  float fade = innerFade * outerCutoff * verticalDensity;

  // ══════════════════════════════════════════
  // HDR YORQINLIK
  // ══════════════════════════════════════════
  //
  // HDR strategiya:
  //   - Pas qiymatlar → tonemapping dan keyin rang ko'rinadi
  //   - Baland qiymatlar → tonemapping oq qiladi (ichki qirra)
  //
  // Maqsad:
  //   Ichki cho'qqi:  ~5-8   → ACES → ~0.94-0.97 (issiq oq)
  //   O'rta disk:     ~0.5-2 → ACES → ~0.4-0.8  (oltin-amber)
  //   Tashqi disk:    ~0.1   → ACES → ~0.08      (qorong'i jigarrang)
  //
  // Hisob:
  //   diskLuminosity max ≈ 0.056
  //   extendedLum mid ≈ 0.015-0.025
  //   HDR multiplikator = 25 + temp * 35
  //   Ichki cho'qqi: 0.056 * 60 * 2.0 = 6.7
  //   O'rta:         0.02 * 35 * 1.0 = 0.7
  //   Tashqi:        0.008 * 28 * 1.0 = 0.22

  float finalLum = lum * nFactor * fade;

  // HDR multiplikator — temp ga proporsional
  // Ichki cho'qqi: 0.056 * 95 * 2.5 = 13.3 → ACES → ~0.98 (issiq oq)
  // O'rta disk:    0.02 * 55 * 1.0 = 1.1 → ACES → ~0.60 (oltin-amber)
  // Tashqi disk:   0.008 * 48 * 1.0 = 0.38 → ACES → ~0.30 (jigarrang)
  float hdr = 45.0 + temp * 50.0;

  // Ichki korona qo'shimcha porlash — kuchli ichki qirra
  float coronaBoost = combinedCorona(hitR, rotAngle, u_time, u_diskInnerRadius);
  float innerBoost = 1.0 + coronaBoost * 2.5;

  // Yakuniy HDR rang
  vec3 color = finalColor * finalLum * hdr * innerBoost;

  // Ichki qirra qo'shimcha oq porlash (additiv) — juda yorqin
  float edgeGlow = innerEdge(hitR, u_diskInnerRadius);
  color += vec3(1.0, 0.95, 0.82) * edgeGlow * lum * hdr * 5.0;

  // Alpha — shaffoflik
  float alpha = finalLum * fade;

  return vec4(color, alpha);
}


// ═══════════════════════════════════════════════════════════════════════════════
// XV. VOLUMETRIK DENSITY — 3D fazoviy zichlik
// ═══════════════════════════════════════════════════════════════════════════════
//
// Ray marching paytida 3D fazodagi har bir nuqtaning zichligini hisoblaydi.
// Bu volumetrik rendering uchun kerak — disk qalinligi va tuzilmasi.
//
// pos — 3D fazoviy nuqta
//
// Qaytaradi: zichlik [0, ~1]
//   0 = bo'sh (disk tashqarisida yoki bo'shliqda)
//   1 = to'liq zich (disk markazida)

float diskDensity(vec3 pos) {
  float r = length(pos.xz);
  float outerR = u_diskOuterRadius * 2.5;
  if (r < u_diskInnerRadius || r > outerR) return 0.0;

  // ── Vertical Gaussian — flared (inner thin, outer puffy) ──
  // Disk qalinligi radius bilan o'sadi (fizik jihatdan to'g'ri)
  float scaleHeight = 0.08 * r;
  float vertical = exp(-pos.y * pos.y / (2.0 * scaleHeight * scaleHeight));

  // ── Radial so'nish ──
  // Ichki qirra: silliq boshlash (ISCO dan 30% dan keyin to'liq)
  // Tashqi qirra: silliq tugash
  float radial = smoothstep(u_diskInnerRadius, u_diskInnerRadius * 1.3, r)
               * (1.0 - smoothstep(outerR * 0.7, outerR, r));

  // ── Anizotropik turbulensiya ──
  // Orbital yo'nalishda cho'zilgan — filamentli tuzilma
  float angle = atan(pos.z, pos.x);
  float rotAngle = rotatedTheta(angle, r, u_time);

  // Anizotropik koordinatalar
  vec3 p = vec3(
    r * 3.5,          // Yuqori radial chastota
    rotAngle * 0.12,  // Past azimuthal chastota
    u_time * 0.08
  );
  float turb = fbm3D(p, max(u_noiseOctaves - 1, 2), u_noiseLacunarity, u_noisePersistence);
  turb = turb * 0.5 + 0.5;

  // Yumshoq kontrast
  turb = 0.40 + 0.60 * smoothstep(0.25, 0.75, turb);

  // Halqa tuzilmasi
  float ringEffect = ringGaps(r);
  turb *= ringEffect;

  return vertical * radial * turb;
}


// ═══════════════════════════════════════════════════════════════════════════════
// XVI. VOLUMETRIK EMISSION — 3D fazoviy rang
// ═══════════════════════════════════════════════════════════════════════════════
//
// Volumetrik rendering uchun — 3D fazodagi nuqtaning emissiya rangini hisoblaydi.
//
// pos     — 3D fazoviy nuqta
// density — nuqtaning zichligi (diskDensity dan)
//
// Qaytaradi: HDR rang (vec3)

vec3 diskEmission(vec3 pos, float density) {
  float r = length(pos.xz);
  float outerR = u_diskOuterRadius * 2.5;
  float temp = diskTemperature(r, u_diskInnerRadius);
  float lum = diskLuminosityExtended(r, u_diskInnerRadius, outerR);

  // ── Rang xaritasi (nolineer, computeDiskColor bilan bir xil) ──
  float tLinear = clamp(
    (r - u_diskInnerRadius) / (outerR - u_diskInnerRadius),
    0.0, 1.0
  );
  float t = pow(tLinear, 0.35);
  vec3 col = diskBaseColor(t);

  // ── Anizotropik filament tuzilma ──
  float angle = atan(pos.z, pos.x);
  float rotAngle = rotatedTheta(angle, r, u_time);

  vec3 p = vec3(
    r * 3.5,
    rotAngle * 0.12,
    u_time * 0.08
  );
  float streaks = fbm3D(p, max(u_noiseOctaves - 1, 2), u_noiseLacunarity, u_noisePersistence);
  streaks = streaks * 0.5 + 0.5;
  streaks = smoothstep(0.2, 0.8, streaks);

  // Kontrast modullatsiya
  col *= (0.35 + 0.65 * streaks);

  // Halqa tuzilmasi
  float ringEffect = ringGaps(r);
  col *= ringEffect;

  // ── HDR yorqinlik ──
  float hdr = 45.0 + temp * 50.0;

  // Ichki korona boost
  float dist = (r - u_diskInnerRadius) / u_diskInnerRadius;
  float coronalBoost = 1.0;
  if (dist > 0.0 && dist < 0.3) {
    coronalBoost = 1.0 + exp(-dist * dist / 0.02) * 1.5;
  }

  return col * lum * hdr * density * coronalBoost;
}
