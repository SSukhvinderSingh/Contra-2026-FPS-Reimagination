/**
 * HUD.js
 * Manages all 2D overlay UI during gameplay:
 * health bar, score, kill feed, enemy taunts, adaptive hints,
 * floating damage numbers, and level complete banner.
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
  _tauntTimer   = null;
  _hintTimer    = null;

  constructor() {
    this._damageFlash = document.getElementById('damage-flash');
    if (!this._damageFlash) {
      this._damageFlash = document.createElement('div');
      this._damageFlash.id = 'damage-flash';
      document.getElementById('game-container')?.appendChild(this._damageFlash);
    }
  }

  // --- Health ------------------------------------------------------------------

  /**
   * @param {number} current
   * @param {number} max
   */
  setHealth(current, max) {
    const pct = Math.max(0, (current / max) * 100);
    this._healthBar.style.width = `${pct}%`;
    this._healthVal.textContent = Math.ceil(current);

    if (pct > 50) {
      this._healthBar.style.background = 'linear-gradient(90deg, #ff2233, #ff6644)';
    } else if (pct > 25) {
      this._healthBar.style.background = 'linear-gradient(90deg, #cc7700, #ffb300)';
    } else {
      this._healthBar.style.background = 'linear-gradient(90deg, #330000, #ff2233)';
    }
  }

  // --- Score ------------------------------------------------------------------

  /** @param {number} score */
  setScore(score) {
    this._scoreEl.textContent = String(score).padStart(6, '0');
  }

  // --- Ammo -------------------------------------------------------------------

  /** @param {number|string} ammo */
  setAmmo(ammo) {
    this._ammoEl.textContent = ammo;
  }

  // --- Level Name -------------------------------------------------------------

  /** @param {string} name */
  setLevelName(name) {
    this._levelNameEl.textContent = name;
  }

  // --- Kill Feed --------------------------------------------------------------

  /** @param {string} message */
  pushKillfeed(message) {
    const item = document.createElement('div');
    item.className = 'killfeed-item';
    item.textContent = `x ${message}`;
    this._killfeed.prepend(item);
    setTimeout(() => item.remove(), 2000);
  }

  // --- Enemy Taunt ------------------------------------------------------------

  /** @param {string} text */
  showTaunt(text) {
    this._tauntEl.textContent = `"${text}"`;
    this._tauntEl.classList.add('visible');
    clearTimeout(this._tauntTimer);
    this._tauntTimer = setTimeout(() => {
      this._tauntEl.classList.remove('visible');
    }, 4000);
  }

  // --- Adaptive Hint ----------------------------------------------------------

  /**
   * @param {string} text
   * @param {number} [durationMs=7000]
   */
  showHint(text, durationMs = 7000) {
    this._hintEl.textContent = `Tip: ${text}`;
    this._hintEl.classList.add('visible');
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => {
      this._hintEl.classList.remove('visible');
    }, durationMs);
  }

  // --- Damage Flash -----------------------------------------------------------

  flash() {
    this._damageFlash.classList.remove('active');
    void this._damageFlash.offsetWidth; // force reflow
    this._damageFlash.classList.add('active');
  }

  // --- Floating Damage Number -------------------------------------------------

  /**
   * Spawn a floating "-25" number near screen centre that drifts up and fades.
   * @param {number} damage
   */
  showDamageNumber(damage) {
    const el = document.createElement('div');
    el.className = 'damage-number';
    el.textContent = `-${damage}`;

    const cx = window.innerWidth  / 2 + (Math.random() - 0.5) * 70;
    const cy = window.innerHeight / 2 + (Math.random() - 0.5) * 30;
    el.style.left = `${cx}px`;
    el.style.top  = `${cy}px`;

    document.getElementById('game-container').appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  // --- Level Complete Banner --------------------------------------------------

  /**
   * Flash a big banner message that auto-removes after 2.5s.
   * @param {string} [text='SECTOR CLEARED']
   */
  showCompleteBanner(text = 'SECTOR CLEARED') {
    const el = document.createElement('div');
    el.className = 'complete-banner';
    el.textContent = text;
    document.getElementById('game-container').appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }
}
