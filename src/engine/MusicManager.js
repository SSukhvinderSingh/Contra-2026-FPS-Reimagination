/**
 * MusicManager.js
 * Procedural retro synth background music using Web Audio API.
 * Generates a looping 140BPM military march: square-wave melody,
 * sawtooth bass, kick / snare / hi-hat. No audio files needed.
 */

export class MusicManager {
  /** @type {AudioContext|null} */
  _ctx = null;
  /** @type {GainNode|null} */
  _masterGain = null;
  /** @type {number[]} */
  _timeouts = [];
  /** @type {boolean} */
  _playing = false;

  _bpm      = 140;
  _beatSec  = 60 / 140;
  _loopBars = 8;

  // Main melody — MIDI notes, 8th-note grid (null = rest)
  _melody = [
    64,null,64,null, 63,null,64,null,
    66,null,66,null, 64,null,63,null,
    61,null,61,null, 63,null,64,null,
    63,null,null,null,63,null,null,null,
    64,null,64,null, 63,null,64,null,
    66,null,68,null, 69,null,68,null,
    66,null,64,null, 63,null,61,null,
    59,null,null,null,null,null,null,null,
  ];

  // Bass root per bar (MIDI)
  _bass = [52, 54, 49, 51, 52, 54, 56, 47];

  // 16th-note drum patterns
  _kickPat  = [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0];
  _snarePat = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0];
  _hatPat   = [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0];

  // ─── Public API ───────────────────────────────────────────────────────────

  /** Start music — safe to call from a user-gesture handler. */
  start() {
    if (this._playing) return;
    this._playing = true;
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.setValueAtTime(0.18, this._ctx.currentTime);
    this._masterGain.connect(this._ctx.destination);
    this._scheduleLoop();
  }

  /** Fade out and stop. */
  stop() {
    if (!this._playing || !this._ctx) return;
    this._playing = false;
    this._masterGain?.gain.linearRampToValueAtTime(0, this._ctx.currentTime + 0.8);
    this._timeouts.forEach(clearTimeout);
    this._timeouts = [];
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /** @private */
  _scheduleLoop() {
    if (!this._playing) return;
    const ctx          = this._ctx;
    const now          = ctx.currentTime + 0.05;
    const sixteenth    = this._beatSec / 4;
    const totalSteps   = this._loopBars * 16;

    // Melody (8th-note spacing)
    this._melody.forEach((note, i) => {
      if (note === null) return;
      this._playMelodyNote(ctx, note, now + i * (this._beatSec / 2), this._beatSec * 0.4);
    });

    // Bass (1 note per bar)
    this._bass.forEach((note, bar) => {
      this._playBassNote(ctx, note, now + bar * this._beatSec * 4, this._beatSec * 3.8);
    });

    // Drums (16th-note grid)
    for (let s = 0; s < totalSteps; s++) {
      const t   = now + s * sixteenth;
      const idx = s % 16;
      if (this._kickPat[idx])  this._playKick(ctx, t);
      if (this._snarePat[idx]) this._playSnare(ctx, t);
      if (this._hatPat[idx])   this._playHat(ctx, t);
    }

    const loopMs = totalSteps * sixteenth * 1000;
    const id = setTimeout(() => this._scheduleLoop(), loopMs - 150);
    this._timeouts.push(id);
  }

  /** @private MIDI note → Hz */
  _midiHz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  /** @private Square-wave melody lead */
  _playMelodyNote(ctx, midi, t, dur) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = this._midiHz(midi);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
    gain.gain.setValueAtTime(0.25, t + dur * 0.7);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(gain).connect(this._masterGain);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  /** @private Sawtooth bass (one octave down) */
  _playBassNote(ctx, midi, t, dur) {
    const osc  = ctx.createOscillator();
    const lp   = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = this._midiHz(midi - 12);
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(lp).connect(gain).connect(this._masterGain);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  /** @private Sine pitch-drop kick */
  _playKick(ctx, t) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain).connect(this._masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /** @private Filtered noise snare */
  _playSnare(ctx, t) {
    const buf  = this._noise(ctx, 0.15);
    const src  = ctx.createBufferSource();
    const hp   = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = buf;
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.connect(hp).connect(gain).connect(this._masterGain);
    src.start(t);
  }

  /** @private Short noise hi-hat */
  _playHat(ctx, t) {
    const buf  = this._noise(ctx, 0.04);
    const src  = ctx.createBufferSource();
    const hp   = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = buf;
    hp.type = 'highpass';
    hp.frequency.value = 8000;
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.connect(hp).connect(gain).connect(this._masterGain);
    src.start(t);
  }

  /** @private Create a white-noise AudioBuffer */
  _noise(ctx, dur) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
}
