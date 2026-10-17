// Sound for ear training: notes in a piano-like or recorder-like voice,
// and ways to set up a key (a I–IV–V–I cadence, or a tonic drone with a
// rising scale). Everything is synthesised, so there's nothing to load and
// playback starts at once.

import { midiToFreq } from './music.js?v=3.7';
import { DEGREES } from './ear.js?v=3.7';

const AudioCtx = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;

export class EarAudio {
  constructor() {
    this.ctx = null;
    this.a4 = 440;
    this.timbre = 'piano';
    this.nodes = [];
  }

  /** Must be called from a tap or key press the first time (browsers need a gesture). */
  async ready() {
    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      const n = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = n.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = n;
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
    return this.ctx.currentTime + 0.05;
  }

  /** Stop everything that's playing or scheduled. */
  stop() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const g of this.nodes) {
      try {
        g.gain.cancelScheduledValues(now);
        g.gain.setTargetAtTime(0.0001, now, 0.02);
      } catch {
        // already finished
      }
    }
    this.nodes = [];
  }

  hz(midi) {
    return midiToFreq(midi, this.a4);
  }

  /** One note. Returns when it ends. */
  note(midi, at, dur = 0.8, { timbre = this.timbre, vol = 1 } = {}) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.connect(this.master);
    this.nodes.push(out);
    const f = this.hz(midi);
    const end = at + dur;
    if (timbre === 'recorder') {
      // A soft flute: nearly pure tone, a little second harmonic, a breath of noise at the start.
      out.gain.setValueAtTime(0.0001, at);
      out.gain.exponentialRampToValueAtTime(0.22 * vol, at + 0.04);
      out.gain.setValueAtTime(0.2 * vol, end - 0.06);
      out.gain.exponentialRampToValueAtTime(0.0001, end + 0.05);
      for (const [mult, level] of [[1, 1], [2, 0.12], [3, 0.04]]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * mult;
        const g = ctx.createGain();
        g.gain.value = level;
        o.connect(g).connect(out);
        o.start(at);
        o.stop(end + 0.1);
      }
      const chiff = ctx.createBufferSource();
      chiff.buffer = this.noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * 2;
      bp.Q.value = 3;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.0001, at);
      cg.gain.exponentialRampToValueAtTime(0.08 * vol, at + 0.01);
      cg.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
      chiff.connect(bp).connect(cg).connect(out);
      chiff.start(at, Math.random() * 0.5);
      chiff.stop(at + 0.12);
    } else {
      // A simple piano: a bright attack that decays, with a few harmonics.
      out.gain.setValueAtTime(0.0001, at);
      out.gain.exponentialRampToValueAtTime(0.3 * vol, at + 0.008);
      out.gain.exponentialRampToValueAtTime(0.12 * vol, at + 0.25);
      out.gain.exponentialRampToValueAtTime(0.0001, end + 0.4);
      for (const [mult, level, type] of [[1, 1, 'triangle'], [2, 0.35, 'sine'], [3, 0.12, 'sine'], [4, 0.05, 'sine']]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f * mult;
        const g = ctx.createGain();
        g.gain.setValueAtTime(level, at);
        g.gain.exponentialRampToValueAtTime(level * 0.3, at + 0.6);
        o.connect(g).connect(out);
        o.start(at);
        o.stop(end + 0.5);
      }
    }
    return end;
  }

  chord(midis, at, dur) {
    for (const m of midis) this.note(m, at, dur, { timbre: 'piano', vol: 0.55 });
    return at + dur;
  }

  /** I–IV–V–I in the key, voiced around the tonic, with the root in the bass. */
  cadence(tonic, at, beat = 0.6) {
    const t = tonic;
    const chords = [
      [t - 12, t, t + 4, t + 7],
      [t - 7, t, t + 5, t + 9],
      [t - 5, t - 1, t + 2, t + 7],
      [t - 12, t, t + 4, t + 7],
    ];
    chords.forEach((c, i) => this.chord(c, at + i * beat, i === 3 ? beat * 1.6 : beat * 0.95));
    return at + beat * 3 + beat * 1.6 + 0.25;
  }

  /** A tonic drone under a rising major scale. */
  droneScale(tonic, at, step = 0.28) {
    const drone = this.note(tonic - 12, at, step * 9 + 0.3, { timbre: 'recorder', vol: 0.6 });
    [0, 2, 4, 5, 7, 9, 11, 12].forEach((s, i) => this.note(tonic + s, at + i * step, step * 0.95));
    return drone + 0.15;
  }

  /** Set up the key one way or the other. */
  home(tonic, at, style = 'cadence') {
    return style === 'scale' ? this.droneScale(tonic, at) : this.cadence(tonic, at);
  }

  /** A run of degrees ([degree, beats] pairs, or plain degrees), from a tonic. */
  melody(tonic, notes, at, beat = 0.5, onNote = null) {
    let tt = at;
    notes.forEach((n, i) => {
      const [deg, beats] = Array.isArray(n) ? n : [n, 1];
      this.note(tonic + DEGREES[deg], tt, beat * beats * 0.92);
      if (onNote) {
        const when = (tt - this.ctx.currentTime) * 1000;
        const timer = setTimeout(() => onNote(i), Math.max(0, when));
        (this.timers ||= []).push(timer);
      }
      tt += beat * beats;
    });
    return tt;
  }

  clearTimers() {
    for (const t of this.timers || []) clearTimeout(t);
    this.timers = [];
  }
}
