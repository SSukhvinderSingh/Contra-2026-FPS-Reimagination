/**
 * LevelManager.js
 * Orchestrates all level transitions: builds the level, manages enemies,
 * processes player shooting (raycasting), handles win/loss conditions,
 * and triggers Gemini AI events (taunts, hints, boss monologues, debrief).
 */

import * as THREE from 'three';
import { World } from '../game/World.js';
import { LEVEL_BUILDERS, LEVEL_META } from '../levels/index.js';

const TOTAL_LEVELS = 5;
const DEATH_HINT_THRESHOLD = 2; // deaths before adaptive hint fires
const EXIT_RADIUS = 2.5;
const SCORE_PER_KILL = 100;
const TAUNT_INTERVAL_MS = 20_000; // enemy taunt every 20s

export class LevelManager {
  /** @type {import('../game/World.js').World} */
  _world;
  /** @type {THREE.Scene} */
  _scene;
  /** @type {import('../game/Player.js').Player} */
  _player;
  /** @type {import('../ui/HUD.js').HUD} */
  _hud;
  /** @type {import('../ai/GeminiService.js').GeminiService} */
  _gemini;
  /** @type {import('../engine/AudioManager.js').AudioManager} */
  _audio;

  _currentLevelIndex = 0;
  /** @type {import('../game/Enemy.js').Enemy[]} */
  _enemies = [];
  /** @type {THREE.Vector3} */
  _exitPos = new THREE.Vector3();

  _deathCount = 0;
  _hintCooldown = false;
  _tauntInterval = null;

  /** @type {import('../ui/EnemyHealthBars.js').EnemyHealthBars|null} */
  _healthBars = null;

  /** @type {import('../game/Weapon.js').Weapon|null} */
  _weapon = null;

  _raycaster = new THREE.Raycaster();

  /** Callbacks wired by main.js */
  onLevelComplete = null; // () => void
  onGameOver = null; // () => void
  onVictory = null; // () => void

  /**
   * @param {THREE.Scene} scene
   * @param {import('../game/Player.js').Player} player
   * @param {import('../ui/HUD.js').HUD} hud
   * @param {import('../engine/AudioManager.js').AudioManager} audio
   * @param {import('../ai/GeminiService.js').GeminiService} gemini
   */
  constructor(scene, player, hud, audio, gemini) {
    this._scene = scene;
    this._player = player;
    this._hud = hud;
    this._audio = audio;
    this._gemini = gemini;
    this._world = new World(scene);
  }

  // ─── Level Loading ────────────────────────────────────────────────────────

  /**
   * Load a level by 0-based index.
   * @param {number} index
   */
  loadLevel(index) {
    this._currentLevelIndex = index;
    this._world.clear();
    this._clearEnemies();
    this._clearTauntInterval();

    const builder = LEVEL_BUILDERS[index];
    const meta = LEVEL_META[index];
    const result = builder(this._world, this._scene, this._audio, this._gemini);

    this._enemies = result.enemies;
    this._exitPos.copy(result.exitPos);

    // Register enemies with health bars UI
    if (this._healthBars) {
      this._healthBars.clear();
      this._enemies.forEach((e) => this._healthBars.track(e));
    }

    // Reset player
    this._player.reset(result.spawnPos);
    this._player.onShoot = (origin, dir) => this._handleShot(origin, dir);
    this._player.onDeath = () => this._handlePlayerDeath();

    // Wire enemy callbacks
    this._enemies.forEach((e) => {
      e.onDamagePlayer = (dmg) => {
        this._player.takeDamage(dmg);
        this._hud.flash();
        this._hud.setHealth(this._player.health, this._player.maxHealth);
      };
      e.onDeath = () => {
        this._player.killCount++;
        this._player.score += SCORE_PER_KILL;
        this._hud.setScore(this._player.score);
        this._hud.pushKillfeed('Enemy Eliminated');
        this._audio.playEnemyDeath();
      };

      // Boss monologue wiring
      if (e.onMonologue !== undefined) {
        e.onMonologue = (text) => this._hud.showTaunt(text);
      }
    });

    // HUD
    this._hud.setLevelName(`LEVEL ${meta.number} · ${meta.name.toUpperCase()}`);
    this._hud.setHealth(this._player.health, this._player.maxHealth);
    this._hud.setScore(this._player.score);
    this._hud.setAmmo('∞');

    // Taunt system (Level 2+)
    if (index >= 1) {
      this._startTauntInterval(meta.name);
    }
  }

  /** Get the current level's metadata. */
  get currentMeta() { return LEVEL_META[this._currentLevelIndex]; }

  /** Expose world for player collision checks. */
  get world() { return this._world; }

  /**
   * Register the weapon viewmodel so LevelManager can trigger fire FX.
   * @param {import('../game/Weapon.js').Weapon} weapon
   */
  setWeapon(weapon) {
    this._weapon = weapon;
  }

  /**
   * Register the health bars UI system.
   * @param {import('../ui/EnemyHealthBars.js').EnemyHealthBars} healthBars
   */
  setHealthBars(healthBars) {
    this._healthBars = healthBars;
  }

  // ─── Game Loop Tick ───────────────────────────────────────────────────────

  /**
   * Called every frame by the renderer tick.
   * @param {number} delta
   */
  update(delta) {
    const cam = this._player.camera;

    // Update all living enemies
    for (const enemy of this._enemies) {
      if (!enemy.isDead) {
        enemy.update(delta, cam);
      }
    }

    // Check if player reached exit
    const distToExit = cam.position.distanceTo(this._exitPos);
    const allDead = this._enemies.every((e) => e.isDead);

    if (distToExit < EXIT_RADIUS && allDead) {
      this._triggerLevelComplete();
    }
  }

  // ─── Shooting ────────────────────────────────────────────────────────────

  /**
   * @private
   * @param {THREE.Vector3} origin
   * @param {THREE.Vector3} direction
   */
  _handleShot(origin, direction) {
    // Always trigger weapon fire FX
    if (this._weapon) this._weapon.fire();

    // Clone direction to avoid mutating the player's look vector
    this._raycaster.set(origin, direction.clone().normalize());

    // Build a map from every living enemy's mesh child → enemy instance.
    // We need this to identify WHICH enemy was hit after intersectObjects.
    /** @type {Map<THREE.Mesh, import('./Enemy.js').Enemy>} */
    const meshToEnemy = new Map();
    const shootableMeshes = [];

    for (const enemy of this._enemies) {
      if (!enemy.isDead) {
        enemy.mesh.traverse((child) => {
          if (child.isMesh) {
            meshToEnemy.set(child, enemy);
            shootableMeshes.push(child);
          }
        });
      }
    }

    if (shootableMeshes.length === 0) return;

    // intersectObjects returns results sorted nearest-first.
    // We only care about the very first (closest) hit.
    const hits = this._raycaster.intersectObjects(shootableMeshes, false);

    if (hits.length > 0) {
      const hitEnemy = meshToEnemy.get(hits[0].object);
      if (hitEnemy && !hitEnemy.isDead) {
        const dmg = 25;
        hitEnemy.takeDamage(dmg);
        this._player.shotsHit++;
        this._hud.showDamageNumber(dmg);
      }
    }
  }

  // ─── Level Complete ───────────────────────────────────────────────────────

  /** @private */
  _triggerLevelComplete() {
    // Guard: only fire once
    if (this._levelCompleting) return;
    this._levelCompleting = true;

    this._clearTauntInterval();
    this._audio.playLevelComplete();
    this._hud.showCompleteBanner(
      this._currentLevelIndex >= TOTAL_LEVELS - 1 ? 'RED FALCON DESTROYED' : 'SECTOR CLEARED'
    );

    // Brief delay so banner shows before screen transitions
    setTimeout(() => {
      this._levelCompleting = false;
      if (this._currentLevelIndex >= TOTAL_LEVELS - 1) {
        if (this.onVictory) this.onVictory();
      } else {
        if (this.onLevelComplete) this.onLevelComplete();
      }
    }, 2000);
  }

  // ─── Player Death ─────────────────────────────────────────────────────────

  /** @private */
  async _handlePlayerDeath() {
    this._deathCount++;

    // Adaptive hint after repeated deaths
    if (this._deathCount >= DEATH_HINT_THRESHOLD && !this._hintCooldown) {
      this._hintCooldown = true;
      const hint = await this._gemini.getAdaptiveHint(this._deathCount, this.currentMeta.name);
      this._hud.showHint(hint, 8000);
      setTimeout(() => { this._hintCooldown = false; }, 30_000);
    }

    if (this.onGameOver) this.onGameOver();
  }

  // ─── Taunt System ─────────────────────────────────────────────────────────

  /** @private */
  _startTauntInterval(levelName) {
    this._tauntInterval = setInterval(async () => {
      const livingEnemy = this._enemies.find((e) => !e.isDead);
      if (!livingEnemy) return;
      const taunt = await this._gemini.getEnemyTaunt(levelName);
      this._hud.showTaunt(taunt);
    }, TAUNT_INTERVAL_MS);
  }

  /** @private */
  _clearTauntInterval() {
    if (this._tauntInterval) {
      clearInterval(this._tauntInterval);
      this._tauntInterval = null;
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  /** @private */
  _clearEnemies() {
    for (const e of this._enemies) {
      e.destroy(this._scene);
    }
    this._enemies = [];
  }

  resetDeathCount() {
    this._deathCount = 0;
  }
}
