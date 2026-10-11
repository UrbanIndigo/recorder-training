// Microphone input and reference-tone playback.

import { detectPitch, NoiseGate } from './pitch.js?v=1.8';

const AudioCtx = window.AudioContext || window.webkitAudioContext;

export class PitchListener {
  constructor() {
    this.listeners = new Set();
    this.running = false;
    this.options = {};
    this.gate = new NoiseGate();
  }

  /** Ask for the microphone and begin analysing. Throws if permission is refused. */
  async start() {
    if (this.running) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    // A fresh context, created only once the mic is open. Some phones (notably
    // iPhones) switch the hardware sample rate when recording starts; a context
    // created earlier keeps reporting the old rate, which throws every pitch
    // reading off by about a semitone.
    const ctx = (this.ctx = new AudioCtx());
    await ctx.resume();
    this.source = ctx.createMediaStreamSource(this.stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.source.connect(this.analyser);
    this.buf = new Float32Array(this.analyser.fftSize);
    this.running = true;
    this.tick();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.source = this.stream = this.analyser = this.ctx = null;
    this.lastAudioTime = null;
  }

  /** Sample rates in use, for the diagnostics line. */
  info() {
    if (!this.running) return null;
    const track = this.stream.getAudioTracks()[0];
    return { contextRate: this.ctx.sampleRate, micRate: track?.getSettings?.().sampleRate ?? null };
  }

  setOptions({ gateRatio, ...options }) {
    if (gateRatio != null) this.gate.ratio = gateRatio;
    Object.assign(this.options, options);
  }

  /** @param {(reading: {freq: number|null, clarity: number, rms: number, gate: number}, now: number) => void} fn */
  onPitch(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Short (~5 ms) level readings covering the audio that arrived since the
   * last frame, each stamped with its audio-clock time. Used for timing
   * note starts more finely than the screen's frame rate.
   */
  levelBlocks(audioTime) {
    const sr = this.ctx.sampleRate;
    const size = 256;
    const last = this.lastAudioTime ?? audioTime - 1 / 60;
    this.lastAudioTime = audioTime;
    const fresh = Math.min(this.buf.length, Math.max(size, Math.round((audioTime - last) * sr)));
    const blocks = [];
    // Walk back from the newest sample so the latest audio is always included.
    for (let end = this.buf.length; end - size >= this.buf.length - fresh; end -= size) {
      let sum = 0;
      for (let i = end - size; i < end; i++) sum += this.buf[i] * this.buf[i];
      blocks.push({ t: audioTime - (this.buf.length - end) / sr, rms: Math.sqrt(sum / size) });
    }
    return blocks.reverse();
  }

  /**
   * Best guess at the round-trip delay (speaker out + mic in), in seconds.
   * Timing results subtract this unless the player has calibrated.
   */
  estimatedLatency() {
    if (!this.ctx) return 0.05;
    const out = (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
    const input = this.stream?.getAudioTracks()[0]?.getSettings?.().latency || 0.01;
    return out + input;
  }

  tick = () => {
    if (!this.running) return;
    this.analyser.getFloatTimeDomainData(this.buf);
    const reading = detectPitch(this.buf, this.ctx.sampleRate, this.options);
    reading.gate = this.gate.threshold;
    if (!this.gate.update(reading.rms)) reading.freq = null;
    reading.audioTime = this.ctx.currentTime;
    reading.blocks = this.levelBlocks(reading.audioTime);
    const now = performance.now() / 1000;
    for (const fn of this.listeners) fn(reading, now);
    this.raf = requestAnimationFrame(this.tick);
  };
}

/** Play a soft, recorder-like reference tone. Resolves when it finishes. */
export function playReferenceTone(freq, seconds = 2) {
  // Own short-lived context, so it can't be left at a stale sample rate.
  const ctx = new AudioCtx();
  ctx.resume();
  const t0 = ctx.currentTime + 0.02;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t0);
  out.gain.linearRampToValueAtTime(0.25, t0 + 0.06);
  out.gain.setValueAtTime(0.25, t0 + seconds - 0.15);
  out.gain.linearRampToValueAtTime(0, t0 + seconds);
  out.connect(ctx.destination);

  // Mostly fundamental with a touch of second and third harmonic.
  const partials = [
    [1, 1],
    [2, 0.12],
    [3, 0.06],
  ];
  const oscs = partials.map(([mult, level]) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = freq * mult;
    g.gain.value = level;
    osc.connect(g).connect(out);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.05);
    return osc;
  });
  return new Promise((resolve) => {
    oscs[0].onended = () => {
      out.disconnect();
      ctx.close().catch(() => {});
      resolve();
    };
  });
}

/**
 * Schedule a metronome click: a short burst of filtered noise. Noise has no
 * pitch, so the pitch detector ignores it if the mic hears it.
 */
export function scheduleClick(ctx, time, accent = false, volume = 1) {
  const len = Math.floor(ctx.sampleRate * 0.03);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len / 6));
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = accent ? 3200 : 2200;
  filter.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.value = (accent ? 1.4 : 0.9) * volume;
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(time);
  return src;
}

/** Schedule a soft recorder-like note. */
export function scheduleTone(ctx, freq, time, seconds) {
  const out = ctx.createGain();
  const end = time + seconds;
  out.gain.setValueAtTime(0, time);
  out.gain.linearRampToValueAtTime(0.22, time + 0.025);
  out.gain.setValueAtTime(0.22, Math.max(time + 0.03, end - 0.04));
  out.gain.linearRampToValueAtTime(0, end);
  out.connect(ctx.destination);
  for (const [mult, level] of [[1, 1], [2, 0.12], [3, 0.05]]) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = freq * mult;
    g.gain.value = level;
    osc.connect(g).connect(out);
    osc.start(time);
    osc.stop(end + 0.02);
  }
}

/** A fresh context for playback (see the note in PitchListener.start). */
export function createPlaybackContext() {
  const ctx = new AudioCtx();
  ctx.resume();
  return ctx;
}
