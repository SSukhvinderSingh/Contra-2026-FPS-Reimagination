/**
 * HUD.js
 * Manages all 2D overlay UI during gameplay:
 * health bar, score, kill feed, enemy taunts, and adaptive hints.
 */

export class HUD {
  _healthBar    = document.getElementById('hud-health-bar');
  _healthVal    = document.getElementById('hud-health-val');
  _scoreEl      = document.getElementById('hud-score');
  _ammoEl       = document.getElementById('hud-ammo');
  _killfeed     = document.getElementById('hud-killfeed');
  _tauntEl      = document.getElementById('hud-taunt');
  _hintEl       = document.getElementById('hud-hint');
  _levelNameEl  = document.getElementById('hud-level-name');
  _damageFlash  = null;

  constructor() {
    // Inject damage flash element lazily
    this._damageFlash = document.getElementById('damage-flash');
    if (!this._damageFlash) {
      this._damageFlash = document.createElement('div');
      this._damageFlash.id = 'damage-flash';
      document.getElementById('game-container')?.appendChild(this._damageFlash);
    }
  }

  // ─── Health ───────────────────────────────────────────────────────────────

  /**
   * @param {number} current
   * @param {number} max
   */
  setHealth(current, max) {
    const pct = Math.max(0, (current / max) * 100);
    this._healthBar.style.width = `${pct}%`;
    this._healthVal.textContent = Math.ceil(current);

    // Colour shift: green → amber → red
    if (pct > 50) {
      this._healthBar.style.background = 'linear-gradient(90deg, #ff2233, #ff6644)';
    } else if (pct > 25) {
      this._healthBar.style.background = 'linear-gradient(90deg, #cc7700, #ffb300)';
    } else {
      this._healthBar.style.background = 'linear-gradient(90deg, #330000, #ff2233)';
    }
  }

  // ─── Score ────────────────────────────────────────────────────────────────

  /** @param {number} score */
  setScore(score) {
    this._scoreEl.textContent = String(score).padStart(6, '0');
  }

  // ─── Ammo ─────────────────────────────────────────────────────────────────

  /** @param {number|'∞'} ammo */
  setAmmo(ammo) {
    this._ammoEl.textContent = ammo;
  }

  // ─── Level name ───────────────────────────────────────────────────────────

  /** @param {string} name */
  setLevelName(name) {
    this._levelNameEl.textContent = name;
  }

  // ─── Kill Feed ────────────────────────────────────────────────────────────

  /** @param {string} message e.g. "Enemy Eliminated" */
  pushKillfeed(message) {
    const item = document.createElement('div');
    item.className = 'killfeed-item';
    item.textContent = `✖ ${message}`;
    this._killfeed.prepend(item);

    // Auto-remove after animation
    setTimeout(() => item.remove(), 2000);
  }

  // ─── Enemy Taunt ──────────────────────────────────────────────────────────

  /**
   * Show an enemy taunt line for a few seconds.
   * @param {string} text
   */
  showTaunt(text) {
    this._tauntEl.textContent = `"${text}"`;
    this._tauntEl.classList.add('visible');
    clearTimeout(this._tauntTimer);
    this._tauntTimer = setTimeout(() => {
      this._tauntEl.classList.remove('visible');
    }, 4000);
  }

  // ─── Adaptive Hint ────────────────────────────────────────────────────────

  /**
   * Show a hint from Gemini.
   * @param {string} text
   * @param {number} [durationMs=7000]
   */
  showHint(text, durationMs = 7000) {
    this._hintEl.textContent = `💡 ${text}`;
    this._hintEl.classList.add('visible');
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => {
      this._hintEl.classList.remove('visible');
    }, durationMs);
  }

  // ─── Damage Flash ─────────────────────────────────────────────────────────

  flash() {
    this._damageFlash.classList.remove('active');
    // Force reflow to restart animation
    void this._damageFlash.offsetWidth;
    this._damageFlash.classList.add('active');
  }
}
