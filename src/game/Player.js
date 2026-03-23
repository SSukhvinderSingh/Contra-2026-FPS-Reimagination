/**
 * Player.js
 * First-person player controller: movement, camera sync, health, shooting cooldown.
 * Reads from InputHandler; writes to the Renderer camera.
 */

import * as THREE from 'three';

const WALK_SPEED     = 6;
const SPRINT_SPEED   = 10;
const SHOOT_COOLDOWN = 0.18; // seconds between shots
const FOOTSTEP_INTERVAL = 0.38; // seconds between footstep sounds

export class Player {
  /** @type {THREE.Camera} */
  _camera;
  /** @type {import('../engine/InputHandler.js').InputHandler} */
  _input;
  /** @type {import('../engine/AudioManager.js').AudioManager} */
  _audio;

  // Stats
  maxHealth    = 100;
  health       = 100;
  score        = 0;
  shotsFired   = 0;
  shotsHit     = 0;
  killCount    = 0;

  // Internal state
  _shootTimer    = 0;
  _footstepTimer = 0;
  _isShooting    = false;

  /** @type {((origin: THREE.Vector3, dir: THREE.Vector3) => void)|null} */
  onShoot = null;

  /** @type {(() => void)|null} */
  onDeath = null;

  // Reusable vectors (avoid GC pressure in hot loop)
  _moveDir    = new THREE.Vector3();
  _camForward = new THREE.Vector3();
  _camRight   = new THREE.Vector3();
  _euler      = new THREE.Euler(0, 0, 0, 'YXZ');

  /**
   * @param {THREE.Camera} camera
   * @param {import('../engine/InputHandler.js').InputHandler} input
   * @param {import('../engine/AudioManager.js').AudioManager} audio
   */
  constructor(camera, input, audio) {
    this._camera = camera;
    this._input  = input;
    this._audio  = audio;

    this._input.bindFireCallback((isDown) => {
      this._isShooting = isDown;
    });
  }

  /** Reset player for a new level. */
  reset(spawnPosition) {
    this.health    = this.maxHealth;
    this._camera.position.copy(spawnPosition);
    this._shootTimer    = 0;
    this._footstepTimer = 0;
  }

  /**
   * Called every tick from the game loop.
   * @param {number} delta - seconds since last frame
   * @param {import('./World.js').World} world - for collision checks
   */
  update(delta, world) {
    if (!this._input.isPointerLocked) return;

    this._updateCamera();
    this._updateMovement(delta, world);
    this._updateShooting(delta);
  }

  // ─── Camera ───────────────────────────────────────────────────────────────

  /** @private */
  _updateCamera() {
    this._euler.x = this._input.pitch;
    this._euler.y = this._input.yaw;
    this._camera.quaternion.setFromEuler(this._euler);
  }

  // ─── Movement ─────────────────────────────────────────────────────────────

  /** @private */
  _updateMovement(delta, world) {
    const speed = this._input.isSprint() ? SPRINT_SPEED : WALK_SPEED;

    this._camera.getWorldDirection(this._camForward);
    this._camForward.y = 0;
    this._camForward.normalize();

    this._camRight.crossVectors(this._camForward, new THREE.Vector3(0, 1, 0)).normalize();

    this._moveDir.set(0, 0, 0);

    if (this._input.isForward())  this._moveDir.add(this._camForward);
    if (this._input.isBackward()) this._moveDir.sub(this._camForward);
    if (this._input.isRight())    this._moveDir.add(this._camRight);
    if (this._input.isLeft())     this._moveDir.sub(this._camRight);

    if (this._moveDir.lengthSq() === 0) return;

    this._moveDir.normalize().multiplyScalar(speed * delta);

    // Separate X and Z movement for axis-aligned collision sliding
    this._tryMove(this._moveDir.x, 0, 0, world);
    this._tryMove(0, 0, this._moveDir.z, world);

    // Footstep audio
    this._footstepTimer -= delta;
    if (this._footstepTimer <= 0) {
      this._audio.playFootstep();
      this._footstepTimer = FOOTSTEP_INTERVAL;
    }
  }

  /**
   * Attempt to move by dx, dy, dz — back off if collided.
   * @private
   */
  _tryMove(dx, _dy, dz, world) {
    const RADIUS = 0.4; // player collision radius

    const nextPos = this._camera.position.clone();
    nextPos.x += dx;
    nextPos.z += dz;

    if (!world || !world.isBlocked(nextPos, RADIUS)) {
      this._camera.position.x += dx;
      this._camera.position.z += dz;
    }
  }

  // ─── Shooting ─────────────────────────────────────────────────────────────

  /** @private */
  _updateShooting(delta) {
    this._shootTimer = Math.max(0, this._shootTimer - delta);

    if (this._isShooting && this._shootTimer === 0) {
      this._fireBullet();
      this._shootTimer = SHOOT_COOLDOWN;
    }
  }

  /** @private */
  _fireBullet() {
    this.shotsFired++;
    this._audio.playShoot();

    if (this.onShoot) {
      const origin = this._camera.position.clone();
      const dir    = new THREE.Vector3(0, 0, -1).applyQuaternion(this._camera.quaternion);
      this.onShoot(origin, dir);
    }
  }

  // ─── Damage ───────────────────────────────────────────────────────────────

  /**
   * @param {number} amount
   */
  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    this._audio.playPlayerHurt();

    if (this.health === 0 && this.onDeath) {
      this.onDeath();
    }
  }

  /** @returns {number} accuracy 0–100 */
  get accuracy() {
    if (this.shotsFired === 0) return 0;
    return Math.round((this.shotsHit / this.shotsFired) * 100);
  }
}
