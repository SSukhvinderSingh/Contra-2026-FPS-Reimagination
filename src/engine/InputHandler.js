/**
 * InputHandler.js
 * Manages keyboard state, mouse look (pointer lock), and sprint.
 * Produces a normalised movement vector consumed by Player.js.
 */

const MOUSE_SENSITIVITY = 0.0018;

export class InputHandler {
  /** @type {Set<string>} currently held keys */
  _keys = new Set();

  /** Euler angles accumulated from mouse delta */
  yaw   = 0; // horizontal rotation (radians)
  pitch = 0; // vertical   rotation (radians, clamped)

  /** @type {boolean} */
  isPointerLocked = false;

  /** @type {HTMLElement} */
  _canvas;

  /**
   * @param {HTMLElement} canvas - the game canvas element
   */
  constructor(canvas) {
    this._canvas = canvas;
    this._bindKeyboard();
    this._bindPointerLock();
    this._bindMouseMove();
  }

  // ─── Keyboard ─────────────────────────────────────────────────────────────

  /** @private */
  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      this._keys.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this._keys.delete(e.code);
    });
  }

  /** @returns {boolean} */
  isForward()  { return this._keys.has('KeyW') || this._keys.has('ArrowUp'); }
  isBackward() { return this._keys.has('KeyS') || this._keys.has('ArrowDown'); }
  isLeft()     { return this._keys.has('KeyA') || this._keys.has('ArrowLeft'); }
  isRight()    { return this._keys.has('KeyD') || this._keys.has('ArrowRight'); }
  isSprint()   { return this._keys.has('ShiftLeft') || this._keys.has('ShiftRight'); }
  isShooting() { return this._keys.has('Space'); }

  // ─── Pointer Lock ─────────────────────────────────────────────────────────

  /** @private */
  _bindPointerLock() {
    this._canvas.addEventListener('click', () => {
      if (!this.isPointerLocked) {
        this._canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this._canvas;
    });
  }

  /**
   * Programmatically release pointer lock.
   */
  releaseLock() {
    if (this.isPointerLocked) {
      document.exitPointerLock();
    }
  }

  // ─── Mouse Look ───────────────────────────────────────────────────────────

  /** @private */
  _bindMouseMove() {
    const MAX_PITCH = Math.PI / 2 - 0.05; // prevent gimbal lock

    document.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked) return;

      this.yaw   -= e.movementX * MOUSE_SENSITIVITY;
      this.pitch -= e.movementY * MOUSE_SENSITIVITY;
      this.pitch  = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
    });
  }

  // ─── Mouse click (separate from pointer lock) ─────────────────────────────

  /** @type {boolean} */
  _mouseDown = false;

  /**
   * Call once during init to track mouse button for shooting.
   * @param {(isDown: boolean) => void} onFire - callback for fire state changes
   */
  bindFireCallback(onFire) {
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.isPointerLocked) {
        this._mouseDown = true;
        onFire(true);
      }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this._mouseDown = false;
        onFire(false);
      }
    });
  }

  /** @returns {boolean} */
  get isFiring() { return this._mouseDown; }
}
