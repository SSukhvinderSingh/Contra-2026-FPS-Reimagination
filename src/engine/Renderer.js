/**
 * Renderer.js
 * Sets up the Three.js scene, camera, renderer, lighting, and basic FPS geometry.
 * Responsible for the render loop tick — game systems hook into onTick.
 */

import * as THREE from 'three';

const FOV          = 75;
const NEAR_CLIP    = 0.1;
const FAR_CLIP     = 500;

export class Renderer {
  /** @type {THREE.WebGLRenderer} */
  renderer;
  /** @type {THREE.Scene} */
  scene;
  /** @type {THREE.PerspectiveCamera} */
  camera;
  /** @type {THREE.Clock} */
  _clock;
  /** @type {Function[]} */
  _tickCallbacks = [];
  /** @type {boolean} */
  _running = false;

  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this._initRenderer(canvas);
    this._initScene();
    this._initCamera();
    this._initLights();
    this._handleResize();
  }

  /** @private */
  _initRenderer(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping       = THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this._clock = new THREE.Clock();
  }

  /** @private */
  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x050508, 10, 60);
    this.scene.background = new THREE.Color(0x050508);
  }

  /** @private */
  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, NEAR_CLIP, FAR_CLIP);
    // Eye height for FPS — 1.7 units (approx 1.7m)
    this.camera.position.set(0, 1.7, 0);
  }

  /** @private */
  _initLights() {
    // Ambient — very low, creates dark atmosphere
    const ambient = new THREE.AmbientLight(0x111122, 0.8);
    this.scene.add(ambient);

    // Directional — sun-like, for shadows
    const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far  = 100;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -30;
    sun.shadow.camera.right = sun.shadow.camera.top   =  30;
    this.scene.add(sun);
  }

  /** @private */
  _handleResize() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  /**
   * Register a tick callback that receives the delta time in seconds.
   * @param {(delta: number) => void} fn
   */
  onTick(fn) {
    this._tickCallbacks.push(fn);
  }

  /** Start the render loop. */
  start() {
    this._running = true;
    this._clock.start();
    this._loop();
  }

  /** Stop the render loop. */
  stop() {
    this._running = false;
  }

  /** @private */
  _loop() {
    if (!this._running) return;
    requestAnimationFrame(() => this._loop());
    const delta = Math.min(this._clock.getDelta(), 0.05); // cap at 50ms
    for (const fn of this._tickCallbacks) fn(delta);
    this.renderer.render(this.scene, this.camera);
  }
}
