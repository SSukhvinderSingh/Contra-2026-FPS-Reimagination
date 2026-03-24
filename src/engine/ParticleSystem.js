/**
 * ParticleSystem.js
 * Canvas-based bullet-tracer and debris particle system for the landing/title screens.
 * Renders onto a full-screen 2D canvas sitting behind all overlays.
 */

const TRACER_COUNT  = 18;   // horizontal bullet streaks
const SPARK_COUNT   = 35;   // small floating debris particles
const TWINKLE_COUNT = 50;   // faint distant stars/static

/** @param {number} min @param {number} max @returns {number} */
const rand = (min, max) => Math.random() * (max - min) + min;

class Tracer {
  constructor(w, h) { this.reset(w, h); }

  reset(w, h) {
    this.x     = rand(-50, 0);
    this.y     = rand(0, h);
    this.speed = rand(600, 1800);
    this.len   = rand(60, 220);
    this.alpha = rand(0.3, 0.9);
    this.w     = w;
  }

  update(dt) { this.x += this.speed * dt; }
  isDone()   { return this.x - this.len > this.w; }

  draw(ctx) {
    const grad = ctx.createLinearGradient(this.x - this.len, 0, this.x, 0);
    grad.addColorStop(0, `rgba(255,34,51,0)`);
    grad.addColorStop(0.6, `rgba(255,180,80,${this.alpha})`);
    grad.addColorStop(1, `rgba(255,255,255,${this.alpha})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth   = rand(0.8, 2.2);
    ctx.beginPath();
    ctx.moveTo(this.x - this.len, this.y);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
  }
}

class Spark {
  constructor(w, h) { this.reset(w, h); this.x = rand(0, w); this.y = rand(0, h); }

  reset(w, h) {
    this.x    = rand(0, w);
    this.y    = rand(-10, 0);
    this.vy   = rand(20, 70);
    this.vx   = rand(-15, 15);
    this.size = rand(1.5, 3.5);
    this.alpha = rand(0.2, 0.7);
    this.life  = rand(3, 9);
    this.age   = 0;
    this.hue   = Math.random() > 0.5 ? '255,34,51' : '255,180,60';
  }

  update(dt, w, h) {
    this.age += dt;
    this.x   += this.vx * dt;
    this.y   += this.vy * dt;
    if (this.age > this.life || this.y > h + 10) this.reset(w, h);
  }

  draw(ctx) {
    const t = Math.min(this.age / this.life, 1);
    const a = this.alpha * (1 - t * 0.6);
    ctx.fillStyle = `rgba(${this.hue},${a.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Twinkle {
  constructor(w, h) {
    this.x     = rand(0, w);
    this.y     = rand(0, h);
    this.r     = rand(0.5, 1.5);
    this.phase = rand(0, Math.PI * 2);
    this.speed = rand(0.8, 2.5);
  }

  draw(ctx, t) {
    const a = (Math.sin(t * this.speed + this.phase) + 1) * 0.5 * 0.35 + 0.05;
    ctx.fillStyle = `rgba(180,180,220,${a.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class ParticleSystem {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this._canvas = canvas;
    this._ctx    = canvas.getContext('2d');
    this._tracers  = [];
    this._sparks   = [];
    this._twinkles = [];
    this._rafId    = null;
    this._lastTime = 0;
    this._elapsed  = 0;

    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._build();
  }

  _resize() {
    this._canvas.width  = window.innerWidth;
    this._canvas.height = window.innerHeight;
  }

  _build() {
    const { width: w, height: h } = this._canvas;
    this._tracers  = Array.from({ length: TRACER_COUNT  }, () => new Tracer(w, h));
    this._sparks   = Array.from({ length: SPARK_COUNT   }, () => new Spark(w, h));
    this._twinkles = Array.from({ length: TWINKLE_COUNT }, () => new Twinkle(w, h));
  }

  start() {
    if (this._rafId) return;
    const loop = (ts) => {
      this._rafId  = requestAnimationFrame(loop);
      const dt     = Math.min((ts - this._lastTime) / 1000, 0.05);
      this._lastTime = ts;
      this._elapsed  += dt;
      this._tick(dt);
    };
    this._rafId = requestAnimationFrame((ts) => { this._lastTime = ts; loop(ts); });
  }

  stop() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  _tick(dt) {
    const { width: w, height: h } = this._canvas;
    const ctx = this._ctx;

    ctx.clearRect(0, 0, w, h);

    // Subtle dark vignette background overlay
    const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, h * 0.85);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,8,0.45)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // Twinkles
    for (const t of this._twinkles) t.draw(ctx, this._elapsed);

    // Sparks
    for (const s of this._sparks) { s.update(dt, w, h); s.draw(ctx); }

    // Tracers
    for (const tr of this._tracers) {
      tr.update(dt);
      tr.draw(ctx);
      if (tr.isDone()) tr.reset(w, h);
    }

    // Scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1);
    }
  }
}
