/**
 * EnemyHealthBars.js
 * CSS-based floating health bars above enemies.
 * Projects enemy 3D world position → 2D screen using the main camera,
 * then positions absolutely-placed DOM elements accordingly.
 * This approach is more reliable than Three.js sprites for UI text.
 */

import * as THREE from 'three';

const BAR_WIDTH  = 50; // px
const BAR_HEIGHT = 5;  // px

export class EnemyHealthBars {
  /** @type {Map<import('../game/Enemy.js').Enemy, HTMLElement>} */
  _bars = new Map();

  /** @type {HTMLElement} */
  _container;

  /** @type {THREE.Vector3} */
  _worldPos = new THREE.Vector3();

  constructor() {
    this._container = document.createElement('div');
    this._container.id = 'enemy-health-container';
    this._container.style.cssText = `
      position: absolute; inset: 0;
      pointer-events: none; overflow: hidden; z-index: 6;
    `;
    document.getElementById('game-container').appendChild(this._container);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Register a new enemy for health bar tracking.
   * @param {import('../game/Enemy.js').Enemy} enemy
   */
  track(enemy) {
    const bar = this._createBar();
    this._bars.set(enemy, bar);
    this._container.appendChild(bar);
  }

  /**
   * Remove all tracked bars (call on level clear).
   */
  clear() {
    this._container.innerHTML = '';
    this._bars.clear();
  }

  /**
   * Update positions & values each frame.
   * @param {THREE.Camera} camera
   */
  update(camera) {
    const hw = window.innerWidth  / 2;
    const hh = window.innerHeight / 2;

    for (const [enemy, barEl] of this._bars) {
      if (enemy.isDead) {
        barEl.style.display = 'none';
        continue;
      }

      // Project world position (above head) → NDC → screen
      this._worldPos.copy(enemy.mesh.position);
      this._worldPos.y += 2.1; // float above head

      this._worldPos.project(camera);

      // Behind camera or too far → hide
      if (this._worldPos.z > 1) {
        barEl.style.display = 'none';
        continue;
      }

      const sx = this._worldPos.x * hw + hw;
      const sy = -this._worldPos.y * hh + hh;

      // Clamp so bars don't go entirely off screen
      if (sx < -BAR_WIDTH || sx > window.innerWidth + BAR_WIDTH ||
          sy < 0          || sy > window.innerHeight) {
        barEl.style.display = 'none';
        continue;
      }

      barEl.style.display = 'block';
      barEl.style.left = `${sx - BAR_WIDTH / 2}px`;
      barEl.style.top  = `${sy}px`;

      // Update fill width
      const pct = Math.max(0, (enemy.health / enemy.maxHealth) * 100);
      const fill = barEl.querySelector('.ehb-fill');
      fill.style.width = `${pct}%`;
      fill.style.background = pct > 50 ? '#ff2233' : pct > 25 ? '#ffb300' : '#ff0000';
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /** @private */
  _createBar() {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
      position: absolute;
      width: ${BAR_WIDTH}px;
      height: ${BAR_HEIGHT}px;
      background: rgba(0,0,0,0.6);
      border: 1px solid rgba(255,34,51,0.4);
      border-radius: 2px;
      overflow: hidden;
    `;
    const fill = document.createElement('div');
    fill.className = 'ehb-fill';
    fill.style.cssText = `
      width: 100%; height: 100%;
      background: #ff2233;
      transition: width 0.15s ease;
    `;
    wrap.appendChild(fill);
    return wrap;
  }
}
