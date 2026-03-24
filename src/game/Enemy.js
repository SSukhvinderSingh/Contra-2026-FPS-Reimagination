/**
 * Enemy.js
 * Base enemy class — patrol AI, player detection, attack logic.
 * Uses instanced BoxGeometry for the enemy body + separate head box.
 */

import * as THREE from 'three';

const PATROL_SPEED    = 2.2;
const CHASE_SPEED     = 3.8;
const DETECT_RANGE    = 18;
const ATTACK_RANGE    = 10;
const ATTACK_COOLDOWN = 1.8; // seconds
const ENEMY_DAMAGE    = 12;
const BODY_COLOR      = 0x4a6741;
const HEAD_COLOR      = 0xd4a07a;

export class Enemy {
  /** @type {THREE.Group} */
  mesh;

  /** @type {'patrol'|'chase'|'attack'|'dead'} */
  _state = 'patrol';

  maxHealth = 40;
  health    = 40;

  /** @type {THREE.Vector3[]} patrol waypoints */
  _waypoints = [];
  _waypointIdx = 0;

  _attackTimer = 0;

  /** Called when this enemy deals damage to the player. @type {((dmg:number)=>void)|null} */
  onDamagePlayer = null;

  /** Called when this enemy is killed. @type {(()=>void)|null} */
  onDeath = null;

  /** @type {import('../engine/AudioManager.js').AudioManager} */
  _audio;

  /** Raycaster used for line-of-sight check before attacking. */
  _losRaycaster = new THREE.Raycaster();
  /** @type {THREE.Mesh[]} Wall meshes the LOS ray tests against. */
  _wallMeshes = [];

  // Reuse vectors
  _toPlayer = new THREE.Vector3();
  _toTarget = new THREE.Vector3();
  _losDir   = new THREE.Vector3();

  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Vector3} spawnPos
   * @param {THREE.Vector3[]} waypoints
   * @param {import('../engine/AudioManager.js').AudioManager} audio
   */
  constructor(scene, spawnPos, waypoints, audio) {
    this._audio = audio;
    this._waypoints = waypoints.length > 0 ? waypoints : [spawnPos.clone()];
    this._buildMesh(scene, spawnPos);
  }

  // ─── Mesh ─────────────────────────────────────────────────────────────────

  /** @private */
  _buildMesh(scene, spawnPos) {
    this.mesh = new THREE.Group();

    // Clone materials per-instance so mutating color on one enemy
    // NEVER affects any other enemy (shared prototype trap).
    this._bodyMat   = new THREE.MeshStandardMaterial({ color: BODY_COLOR, roughness: 0.8 });
    this._headMat   = new THREE.MeshStandardMaterial({ color: HEAD_COLOR, roughness: 0.7 });
    this._helmetMat = new THREE.MeshStandardMaterial({ color: 0x2a3a28, roughness: 0.9 });
    this._gunMat    = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.4), this._bodyMat);
    body.position.y = 0.5;
    body.castShadow = true;
    this.mesh.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), this._headMat);
    head.position.y = 1.25;
    head.castShadow = true;
    this.mesh.add(head);

    // Helmet
    const helmet = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.15, 0.45),
      this._helmetMat
    );
    helmet.position.y = 1.55;
    this.mesh.add(helmet);

    // Gun barrel stub
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.5),
      this._gunMat
    );
    gun.position.set(0.3, 0.85, -0.3);
    this.mesh.add(gun);

    this.mesh.position.copy(spawnPos);
    scene.add(this.mesh);
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  /**
   * @param {number} delta
   * @param {THREE.Camera} playerCamera
   */
  update(delta, playerCamera) {
    if (this._state === 'dead') return;

    const playerPos = playerCamera.position;
    this._toPlayer.subVectors(playerPos, this.mesh.position);
    const distToPlayer = this._toPlayer.length();

    this._resolveState(distToPlayer);
    this._executeState(delta, playerPos, distToPlayer);

    this._attackTimer = Math.max(0, this._attackTimer - delta);
  }

  /** @private */
  _resolveState(dist) {
    if (dist <= ATTACK_RANGE) {
      this._state = 'attack';
    } else if (dist <= DETECT_RANGE) {
      this._state = 'chase';
    } else {
      this._state = 'patrol';
    }
  }

  /** @private */
  _executeState(delta, playerPos, dist) {
    switch (this._state) {
      case 'patrol': this._patrol(delta); break;
      case 'chase':  this._chase(delta, playerPos); break;
      case 'attack': this._attack(delta, playerPos); break;
    }
  }

  /** @private */
  _patrol(delta) {
    if (this._waypoints.length < 2) return;

    const target = this._waypoints[this._waypointIdx];
    this._toTarget.subVectors(target, this.mesh.position);
    this._toTarget.y = 0;

    if (this._toTarget.length() < 0.5) {
      this._waypointIdx = (this._waypointIdx + 1) % this._waypoints.length;
      return;
    }

    const step = this._toTarget.normalize().multiplyScalar(PATROL_SPEED * delta);
    this.mesh.position.add(step);
    this._faceDirection(this._toTarget);
  }

  /** @private */
  _chase(delta, playerPos) {
    this._toTarget.subVectors(playerPos, this.mesh.position);
    this._toTarget.y = 0;
    const step = this._toTarget.normalize().multiplyScalar(CHASE_SPEED * delta);
    this.mesh.position.add(step);
    this._faceDirection(this._toTarget);
  }

  /** @private */
  _attack(_delta, playerPos) {
    this._faceDirection(new THREE.Vector3().subVectors(playerPos, this.mesh.position));

    if (this._attackTimer === 0) {
      // Only damage player if no wall blocks the bullet path
      if (this._hasLineOfSight(playerPos)) {
        this._audio.playShoot();
        if (this.onDamagePlayer) this.onDamagePlayer(ENEMY_DAMAGE);
      }
      this._attackTimer = ATTACK_COOLDOWN;
    }
  }

  /**
   * True when the enemy has a clear bullet path to the player.
   * Raycasts from torso to playerPos and returns false if any wall
   * mesh intersects the ray before it reaches the player.
   * @private
   * @param {THREE.Vector3} playerPos
   * @returns {boolean}
   */
  _hasLineOfSight(playerPos) {
    if (this._wallMeshes.length === 0) return true;

    const origin = this.mesh.position.clone().setY(this.mesh.position.y + 0.8);
    const dist   = origin.distanceTo(playerPos);

    this._losDir.subVectors(playerPos, origin).normalize();
    this._losRaycaster.set(origin, this._losDir);
    this._losRaycaster.far = dist; // don't test past the player

    const hits = this._losRaycaster.intersectObjects(this._wallMeshes, false);
    return hits.length === 0; // no walls between enemy and player → clear shot
  }

  /**
   * Register the level's wall meshes so this enemy performs LOS checks.
   * Must be called after level geometry is built.
   * @param {THREE.Mesh[]} meshes
   */
  setWallMeshes(meshes) {
    this._wallMeshes = meshes;
  }

  /** @private */
  _faceDirection(dir) {
    if (dir.lengthSq() === 0) return;
    const angle = Math.atan2(dir.x, dir.z);
    this.mesh.rotation.y = angle;
  }

  // ─── Damage ───────────────────────────────────────────────────────────────

  /**
   * @param {number} amount
   */
  takeDamage(amount) {
    if (this._state === 'dead') return;
    this.health -= amount;

    // Flash red briefly
    this._flashHit();
    this._audio.playHit();

    if (this.health <= 0) {
      this._die();
    }
  }

  /** @private */
  _flashHit() {
    this.mesh.traverse((child) => {
      if (child.isMesh) {
        const origColor = child.material.color.clone();
        child.material.color.set(0xff0000);
        setTimeout(() => {
          if (child.material) child.material.color.copy(origColor);
        }, 80);
      }
    });
  }

  /** @private */
  _die() {
    this._state = 'dead';
    this._audio.playEnemyDeath();
    // Tip the body over
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.position.y = 0.3;
    if (this.onDeath) this.onDeath();
  }

  /** Remove from scene. */
  destroy(scene) {
    scene.remove(this.mesh);
  }

  /** @returns {boolean} */
  get isDead() { return this._state === 'dead'; }

  /** AABB check — is a ray origin+dir hitting this enemy? */
  intersectsRay(raycaster) {
    if (this.isDead) return false;
    // Tight sphere (0.45) prevents adjacent-patrol enemies from chain-dying.
    // Centre raised to torso height (y+0.8).
    const sphere = new THREE.Sphere(
      this.mesh.position.clone().setY(this.mesh.position.y + 0.8),
      0.45
    );
    return raycaster.ray.intersectsSphere(sphere, new THREE.Vector3()) !== null;
  }
}
