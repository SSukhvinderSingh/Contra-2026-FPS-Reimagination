/**
 * Weapon.js
 * First-person weapon viewmodel rendered in a separate scene/camera so it
 * never clips through walls. Handles:
 *   - Idle bob animation
 *   - Shoot kick-back & return
 *   - Muzzle flash (point light + emissive quad)
 *   - Bullet tracer line
 */

import * as THREE from 'three';

const BOB_SPEED      = 6;     // idle bob frequency
const BOB_AMOUNT_Y   = 0.008;
const BOB_AMOUNT_X   = 0.004;
const KICK_AMOUNT    = 0.06;  // recoil pushback
const KICK_RECOVERY  = 12;    // lerp speed back to rest

const MUZZLE_FLASH_DURATION = 0.06; // seconds
const TRACER_DURATION       = 0.08;

export class Weapon {
  /** @type {THREE.Scene} — separate scene so weapon draws on top */
  _weaponScene;
  /** @type {THREE.PerspectiveCamera} */
  _weaponCam;
  /** @type {THREE.WebGLRenderer} */
  _renderer;

  /** @type {THREE.Group} */
  _group;
  /** @type {THREE.PointLight} */
  _muzzleLight;
  /** @type {THREE.Mesh} */
  _muzzleFlashMesh;
  /** @type {THREE.Line} */
  _tracer;

  _bobTime       = 0;
  _kickOffset    = 0;   // current recoil offset (z-axis)
  _isMoving      = false;
  _muzzleTimer   = 0;
  _tracerTimer   = 0;

  // Rest position of the weapon group (local to weapon scene)
  _restPos = new THREE.Vector3(0.22, -0.22, -0.45);

  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.PerspectiveCamera} mainCamera - used to sync weapon camera
   */
  constructor(renderer, mainCamera) {
    this._renderer   = renderer;
    this._mainCamera = mainCamera;
    this._init();
  }

  /** @private */
  _init() {
    // Dedicated weapon scene + camera (FOV 60 for tight viewmodel)
    this._weaponScene = new THREE.Scene();
    this._weaponCam   = new THREE.PerspectiveCamera(
      60, window.innerWidth / window.innerHeight, 0.01, 20
    );

    window.addEventListener('resize', () => {
      this._weaponCam.aspect = window.innerWidth / window.innerHeight;
      this._weaponCam.updateProjectionMatrix();
    });

    this._buildWeaponMesh();
    this._buildMuzzleFlash();
    this._buildTracer();
    this._buildLights();
  }

  /** @private */
  _buildWeaponMesh() {
    this._group = new THREE.Group();
    this._group.position.copy(this._restPos);

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a, roughness: 0.3, metalness: 0.9,
    });
    const greyMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a, roughness: 0.6, metalness: 0.5,
    });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff1122, roughness: 0.4 });

    // ── Body ─────────────────────────────────────────────────────────
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.28), metalMat);
    body.position.set(0, 0, 0);
    this._group.add(body);

    // ── Barrel ────────────────────────────────────────────────────────
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.22);
    this._group.add(barrel);

    // ── Grip ─────────────────────────────────────────────────────────
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.06), greyMat);
    grip.position.set(0, -0.09, 0.05);
    grip.rotation.x = 0.15;
    this._group.add(grip);

    // ── Slide rail ───────────────────────────────────────────────────
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.015, 0.26), metalMat);
    slide.position.set(0, 0.048, -0.01);
    this._group.add(slide);

    // ── Red dot sight ─────────────────────────────────────────────────
    const sightBase = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.018, 0.03), greyMat);
    sightBase.position.set(0, 0.062, -0.06);
    this._group.add(sightBase);

    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 6), redMat);
    dot.position.set(0, 0.062, -0.06);
    this._group.add(dot);

    // ── Muzzle tip marker (where flash will spawn) ────────────────────
    this._muzzleTip = new THREE.Object3D();
    this._muzzleTip.position.set(0, 0.02, -0.34);
    this._group.add(this._muzzleTip);

    this._weaponScene.add(this._group);
  }

  /** @private */
  _buildMuzzleFlash() {
    // Flat quad that faces the camera — quick emissive burst
    const geo = new THREE.PlaneGeometry(0.06, 0.06);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffdd44,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this._muzzleFlashMesh = new THREE.Mesh(geo, mat);
    this._muzzleFlashMesh.position.set(0, 0.02, -0.36);
    this._group.add(this._muzzleFlashMesh);

    // Point light at the muzzle
    this._muzzleLight = new THREE.PointLight(0xffaa22, 0, 2.5);
    this._muzzleLight.position.set(0, 0.02, -0.36);
    this._group.add(this._muzzleLight);
  }

  /** @private */
  _buildTracer() {
    const mat = new THREE.LineBasicMaterial({
      color: 0xffee44,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -20)];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    this._tracer = new THREE.Line(geo, mat);
    this._tracer.position.set(0, 0.02, -0.34);
    this._group.add(this._tracer);
  }

  /** @private */
  _buildLights() {
    // Ambient for weapon scene so it's always visible
    this._weaponScene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const front = new THREE.DirectionalLight(0xffffff, 0.8);
    front.position.set(0.5, 1, -1);
    this._weaponScene.add(front);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Fire — trigger recoil, muzzle flash, tracer.
   */
  fire() {
    this._kickOffset = KICK_AMOUNT;

    // Muzzle flash
    this._muzzleFlashMesh.material.opacity = 0.9;
    this._muzzleLight.intensity = 3;
    this._muzzleTimer = MUZZLE_FLASH_DURATION;

    // Random rotation for flash variety
    this._muzzleFlashMesh.rotation.z = Math.random() * Math.PI;
    this._muzzleFlashMesh.scale.setScalar(0.8 + Math.random() * 0.5);

    // Tracer
    this._tracer.material.opacity = 0.7;
    this._tracerTimer = TRACER_DURATION;
  }

  /**
   * Notify weapon of movement state for bob.
   * @param {boolean} isMoving
   */
  setMoving(isMoving) {
    this._isMoving = isMoving;
  }

  /**
   * Update called every frame.
   * @param {number} delta
   */
  update(delta) {
    // ── Bob ──────────────────────────────────────────────────────────
    if (this._isMoving) {
      this._bobTime += delta * BOB_SPEED;
    } else {
      this._bobTime += delta * (BOB_SPEED * 0.3);
    }
    const bobScale = this._isMoving ? 1 : 0.2;
    const bobY = Math.sin(this._bobTime)     * BOB_AMOUNT_Y * bobScale;
    const bobX = Math.sin(this._bobTime * 2) * BOB_AMOUNT_X * bobScale;

    // ── Recoil recovery ───────────────────────────────────────────────
    this._kickOffset = THREE.MathUtils.lerp(this._kickOffset, 0, KICK_RECOVERY * delta);

    this._group.position.set(
      this._restPos.x + bobX,
      this._restPos.y + bobY,
      this._restPos.z + this._kickOffset,
    );

    // ── Muzzle flash decay ────────────────────────────────────────────
    if (this._muzzleTimer > 0) {
      this._muzzleTimer -= delta;
      const t = Math.max(0, this._muzzleTimer / MUZZLE_FLASH_DURATION);
      this._muzzleFlashMesh.material.opacity = t * 0.9;
      this._muzzleLight.intensity = t * 3;
      if (this._muzzleTimer <= 0) {
        this._muzzleFlashMesh.material.opacity = 0;
        this._muzzleLight.intensity = 0;
      }
    }

    // ── Tracer decay ──────────────────────────────────────────────────
    if (this._tracerTimer > 0) {
      this._tracerTimer -= delta;
      this._tracer.material.opacity = Math.max(0, this._tracerTimer / TRACER_DURATION) * 0.7;
    }

    // ── Sync weapon camera to main camera ─────────────────────────────
    this._weaponCam.quaternion.copy(this._mainCamera.quaternion);
  }

  /**
   * Render the weapon scene on top of the main render.
   * Call AFTER the main renderer.render().
   */
  renderOnTop() {
    this._renderer.autoClear = false;
    this._renderer.clearDepth();
    this._renderer.render(this._weaponScene, this._weaponCam);
    this._renderer.autoClear = true;
  }
}
