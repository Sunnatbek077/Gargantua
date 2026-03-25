/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Entry Point
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Ilovani ishga tushirish:
 *   1. Shader fayllarini yuklash
 *   2. App yaratish va initsializatsiya
 *   3. Loading ekranini yashirish
 *
 * Bog'liqliklar: App, ShaderLoader
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import App from './core/App.js';
import ShaderLoader from './utils/ShaderLoader.js';
import PhysicsConfig from '../config/physics.config.js';

// ─────────────────────────────────────────────────────────────────────────────
// LOADING UI
// ─────────────────────────────────────────────────────────────────────────────

const loadingOverlay = document.getElementById('loading-overlay');
const loadingStatus = document.getElementById('loading-status');

function setLoadingStatus(text) {
  if (loadingStatus) loadingStatus.textContent = text;
}

function hideLoadingScreen() {
  if (!loadingOverlay) return;
  loadingOverlay.style.opacity = '0';
  setTimeout(() => {
    loadingOverlay.style.display = 'none';
  }, 800);
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────────────────────────────────────

async function bootstrap() {
  try {
    // ── 1. Shader'larni yuklash ──
    setLoadingStatus('Shader\'lar yuklanmoqda...');
    const shaderLoader = new ShaderLoader('../src/shaders/');
    const shaders = await shaderLoader.loadAll();

    // ── 2. App yaratish ──
    setLoadingStatus('Sahna qurilmoqda...');
    const app = new App('#canvas', {
      quality: 'medium',
      autoStart: false,
    });

    // ── 3. Init ──
    setLoadingStatus('Render boshlanmoqda...');
    await app.init(shaders);

    // ── 4. HUD va Controls ulash ──
    const qSlider = document.getElementById('q-slider');
    const qVal = document.getElementById('q-val');
    if (qSlider) {
      qSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        qVal.textContent = val.toFixed(2);
        app.setBlackHoleParams({ charge: val });
      });
    }

    app.onUpdate(() => {
      document.getElementById('hud-th').textContent = `Hawking Temp (T_H): ${PhysicsConfig.blackHole.hawkingTemperature.toExponential(4)} K`;
      document.getElementById('hud-s').textContent  = `Entropy (S): ${PhysicsConfig.blackHole.entropyBekenstein.toExponential(4)} J/K`;
      document.getElementById('hud-tev').textContent= `Evap Time (t_ev): ${PhysicsConfig.blackHole.evaporationTime.toExponential(4)} yrs`;
      document.getElementById('hud-p').textContent  = `Hawking Power (P): ${PhysicsConfig.blackHole.hawkingPower.toExponential(4)} W`;
      document.getElementById('hud-r').textContent  = `Horizons (r+, r-): ${PhysicsConfig.blackHole.rOuterHorizon.toFixed(3)}, ${PhysicsConfig.blackHole.rInnerHorizon.toFixed(3)} Rs`;
      document.getElementById('hud-bondi').textContent = `Bondi Rate (Ṁ): ${PhysicsConfig.astrophysics.bondiAccretionRate.toExponential(4)} kg/s`;
    });

    hideLoadingScreen();
    app.start();

    // ── 5. Global havola (DevTools uchun) ──
    window.gargantua = app;

    console.log(
      '%c🌌 GARGANTUA tayyor — window.gargantua orqali boshqaring',
      'color: #ffaa50; font-weight: bold;'
    );

  } catch (error) {
    console.error('GARGANTUA ishga tushirishda xato:', error);
    setLoadingStatus(`Xato: ${error.message}`);
    if (loadingOverlay) {
      loadingOverlay.style.background = 'rgba(20, 0, 0, 0.95)';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ISHGA TUSHIRISH
// ─────────────────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
