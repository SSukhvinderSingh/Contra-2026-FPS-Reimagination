/**
 * BossEnemy.js
 * Boss variant — larger, more health, Gemini monologue on encounter,
 * multiple attack phases. Extends Enemy.
 */

import * as THREE from 'three';
import { Enemy } from './Enemy.js';

const BOSS_HEALTH  = 160;
const BOSS_DAMAGE  = 20;
const BOSS_SPEED   = 2.5;
const PHASE2_HP    = 80;  // triggers phase 2 below this health

export class BossEnemy extends Enemy {
  /** @type {string} */
  _bossName;
  /** @type {boolean} */
  _monologuePlayed  = false;
  /** @type {boolean} */
  _phase2Triggered  = false;
  /** @type {import('../ai/GeminiService.js').GeminiService} */
  _gemini;
  /** @type {string} */
  _bossTheme;

  /** Called when monologue text is ready. @type {((text:string)=>void)|null} */
  onMonologue = null;

  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Vector3} spawnPos
   * @param {string} bossName
   * @param {string} bossTheme
   * @param {import('../engine/AudioManager.js').AudioManager} audio
   * @param {import('../ai/GeminiService.js').GeminiService} gemini
   */
  constructor(scene, spawnPos, bossName, bossTheme, audio, gemini) {
    super(scene, spawnPos, [], audio);
    this._bossName  = bossName;
    this._bossTheme = bossTheme;
    this._gemini    = gemini;

    // Override stats
    this.maxHealth = BOSS_HEALTH;
    this.health    = BOSS_HEALTH;

    // Scale up the mesh
    this.mesh.scale.set(1.8, 1.8, 1.8);
  }

  /** @override */
  _buildMesh(scene, spawnPos) {
    super._buildMesh(scene, spawnPos);

    // Boss tint — darker, more menacing
    this.mesh.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        if (child.material.color.getHex() === 0x4a6741) {
          child.material.color.set(0x1a1a2e);
        }
      }
    });

    // Add a red glowing eye indicator
    const eyeGeo  = new THREE.SphereGeometry(0.08, 6, 6);
    const eyeMat  = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 2,
    });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0, 1.35, -0.22);
    this.mesh.add(eye);
  }

  /** @override */
  update(delta, playerCamera) {
    super.update(delta, playerCamera);

    const dist = playerCamera.position.distanceTo(this.mesh.position);

    // Trigger monologue when player gets close (first time)
    if (!this._monologuePlayed && dist < 20) {
      this._monologuePlayed = true;
      this._triggerMonologue();
    }

    // Phase 2 — increase attack frequency
    if (!this._phase2Triggered && this.health <= PHASE2_HP) {
      this._phase2Triggered = true;
      // Override the attack cooldown constant (via method override)
      this._attackCooldownOverride = 0.9;
    }
  }

  /** @private */
  async _triggerMonologue() {
    if (!this._gemini || !this.onMonologue) return;
    const text = await this._gemini.getBossMonologue(this._bossName, this._bossTheme);
    this.onMonologue(text);
  }
}
