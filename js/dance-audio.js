// Grooves to dance to: a forró baião (zabumba, triangle, a little bass)
// and salsa (son clave, cowbell, conga tumbao, bass). Synthesised and
// scheduled ahead on the audio clock; `onBeat` reports each beat as it's
// heard, so the screen can count along.

const AudioCtx = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;

export class Groove {
  constructor() {
    this.ctx = null;
    this.running = false;
    this.onBeat = null;
    this.volume = 0.9;
  }

  async start(style, bpm) {
    this.stop();
    this.ctx = new AudioCtx();
    await this.ctx.resume();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    const n = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = n;
    this.style = style;
    this.bpm = bpm;
    this.beatSec = 60 / bpm;
    this.startAt = this.ctx.currentTime + 0.3;
    this.latency = (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
    this.nextBeat = 0; // next beat to schedule
    this.reported = -1;
    this.running = true;
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
    this.raf = requestAnimationFrame(this.report);
  }

  stop() {
    this.running = false;
    clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  /** The beat being heard now (fractional; negative before the first). */
  beatNow() {
    if (!this.ctx) return -1;
    return (this.ctx.currentTime - this.latency - this.startAt) / this.beatSec;
  }

  /** Beat position of an input event (using its own timestamp). */
  beatAt(e) {
    const ago = e?.timeStamp != null ? Math.min(0.25, Math.max(0, performance.now() - e.timeStamp) / 1000) : 0;
    return this.beatNow() - ago / this.beatSec;
  }

  report = () => {
    if (!this.running) return;
    const b = Math.floor(this.beatNow() + 1e-6);
    if (b > this.reported) {
      this.reported = b;
      this.onBeat?.(b);
    }
    this.raf = requestAnimationFrame(this.report);
  };

  schedule() {
    if (!this.running) return;
    const ahead = this.ctx.currentTime + 0.15;
    while (this.startAt + this.nextBeat * this.beatSec < ahead) {
      const b = this.nextBeat;
      const t = this.startAt + b * this.beatSec;
      if (this.style === 'salsa') this.salsaBeat(b, t);
      else this.forroBeat(b, t);
      this.nextBeat++;
    }
  }

  // --------------------------------------------------------- instruments

  env(t, peak, decay, attack = 0.002) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    g.connect(this.master);
    return g;
  }

  tone(t, freq, type, peak, decay, { attack, bend } = {}) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (bend) o.frequency.exponentialRampToValueAtTime(bend, t + decay * 0.6);
    o.connect(this.env(t, peak, decay, attack));
    o.start(t);
    o.stop(t + decay + 0.05);
  }

  noiseHit(t, peak, decay, type, freq, q = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f).connect(this.env(t, peak, decay));
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay + 0.05);
  }

  /** One beat of baião (2/4): zabumba "dotted 8th, 16th, quarter", triangle 16ths, bass. */
  forroBeat(b, t) {
    const s = this.beatSec;
    const inBar = b % 2;
    // Zabumba: deep boom on 1, the "a" of 1, and 2; the high stick (bacalhau) on the off-beats.
    if (inBar === 0) {
      this.tone(t, 70, 'sine', 0.9, 0.35, { bend: 45 });
      this.tone(t + 0.75 * s, 75, 'sine', 0.5, 0.25, { bend: 50 });
    } else {
      this.tone(t, 72, 'sine', 0.75, 0.3, { bend: 48 });
    }
    this.noiseHit(t + 0.5 * s, 0.18, 0.05, 'highpass', 2500);
    // Triangle: closed on the 16ths, ringing open on the off-beat.
    for (let k = 0; k < 4; k++) {
      const open = k === 2;
      this.tone(t + (k * s) / 4, 3200 + (open ? 0 : 200), 'triangle', open ? 0.06 : 0.035, open ? 0.25 : 0.05);
    }
    // A simple bass under the zabumba: root and fifth.
    const root = [43, 43, 38, 38][Math.floor(b / 2) % 4];
    if (inBar === 0) this.tone(t, this.hz(root), 'triangle', 0.3, s * 0.7, { attack: 0.01 });
    else this.tone(t, this.hz(root + 7), 'triangle', 0.25, s * 0.6, { attack: 0.01 });
  }

  /** One beat of salsa (4/4, counted 1–8 over two bars, 2-3 son clave). */
  salsaBeat(b, t) {
    const s = this.beatSec;
    const pos = b % 8; // 0..7 = counts 1..8
    // Clave 2-3: the "2" bar hits counts 2 and 3; the "3" bar hits 5, 6& and 8.
    const clave = { 1: [0], 2: [0], 4: [0], 5: [0.5], 7: [0] }[pos] || [];
    for (const off of clave) this.tone(t + off * s, 2500, 'sine', 0.22, 0.06);
    // Cowbell on every beat, accented on the downbeats.
    this.tone(t, pos % 2 === 0 ? 800 : 760, 'square', pos % 2 === 0 ? 0.05 : 0.03, 0.08);
    // Conga tumbao: slap on 2 and 6, open tones on 4 and 4& (8 and 8&).
    const inBar = pos % 4;
    if (inBar === 1) this.noiseHit(t, 0.22, 0.07, 'bandpass', 900, 2);
    if (inBar === 3) {
      this.tone(t, 220, 'sine', 0.35, 0.18, { bend: 200 });
      this.tone(t + 0.5 * s, 200, 'sine', 0.35, 0.2, { bend: 185 });
    }
    // Shaker on the 8ths.
    this.noiseHit(t, 0.04, 0.04, 'highpass', 6000);
    this.noiseHit(t + 0.5 * s, 0.03, 0.04, 'highpass', 6000);
    // Bass tumbao: anticipated, on 2& and 4 of each bar.
    const root = [45, 50, 52, 45][Math.floor(b / 4) % 4];
    if (inBar === 1) this.tone(t + 0.5 * s, this.hz(root), 'triangle', 0.32, s * 1.3, { attack: 0.01 });
    if (inBar === 3) this.tone(t, this.hz(root + 7), 'triangle', 0.3, s * 0.9, { attack: 0.01 });
  }

  /** A clear tick on chosen beats (count-in, or "make your choice now"). */
  tick(beat, high = false) {
    if (!this.ctx) return;
    const t = this.startAt + beat * this.beatSec;
    if (t < this.ctx.currentTime) return;
    this.tone(t, high ? 1600 : 1200, 'sine', 0.12, 0.06);
  }

  hz(midi) {
    return 440 * 2 ** ((midi - 69) / 12);
  }
}
