/**
 * AudioManager.js
 * Web Audio API — synthesises retro sound FX without asset files.
 * All sounds are procedurally generated oscillators/noise.
 */

export class AudioManager {
  /** @type {AudioContext|null} */
  _ctx = null;

  /** Lazily create AudioContext on first user gesture (browser policy). */
  _ensureContext() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this._ctx;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /** Gunshot — short noise burst with pitch drop */
  playShoot() {
    const ctx = this._ensureContext();
    const buf = this._makeNoiseBuffer(ctx, 0.08);
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 800;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    src.connect(hp).connect(gain).connect(ctx.destination);
    src.start();
  }

  /** Enemy hit fx */
  playHit() {
    const ctx = this._ensureContext();
    this._tone(ctx, 220, 'sawtooth', 0.15, 0.05);
  }

  /** Enemy death */
  playEnemyDeath() {
    const ctx = this._ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }

  /** Player takes damage */
  playPlayerHurt() {
    const ctx = this._ensureContext();
    this._tone(ctx, 110, 'square', 0.3, 0.12);
  }

  /** Level complete jingle */
  playLevelComplete() {
    const ctx = this._ensureContext();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this._tone(ctx, freq, 'sine', 0.35, 0.18), i * 160);
    });
  }

  /** Footstep tick */
  playFootstep() {
    const ctx = this._ensureContext();
    const buf = this._makeNoiseBuffer(ctx, 0.04);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    src.connect(lp).connect(gain).connect(ctx.destination);
    src.start();
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * @private
   * @param {AudioContext} ctx
   * @param {number} frequency
   * @param {OscillatorType} type
   * @param {number} peakGain
   * @param {number} duration
   */
  _tone(ctx, frequency, type, peakGain, duration) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(peakGain, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  /**
   * @private
   * @param {AudioContext} ctx
   * @param {number} durationSec
   * @returns {AudioBuffer}
   */
  _makeNoiseBuffer(ctx, durationSec) {
    const sampleRate = ctx.sampleRate;
    const length     = Math.floor(sampleRate * durationSec);
    const buffer     = ctx.createBuffer(1, length, sampleRate);
    const data       = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}
