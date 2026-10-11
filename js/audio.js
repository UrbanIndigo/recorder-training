// Microphone input and reference-tone playback.

import { detectPitch } from './pitch.js';

let sharedCtx = null;
function audioContext() {
  if (!sharedCtx) sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
  return sharedCtx;
}

export class PitchListener {
  constructor() {
    this.listeners = new Set();
    this.running = false;
    this.options = {};
  }

  /** Ask for the microphone and begin analysing. Throws if permission is refused. */
  async start() {
    if (this.running) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const ctx = audioContext();
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
    this.source = this.stream = this.analyser = null;
  }

  setOptions(options) {
    Object.assign(this.options, options);
  }

  /** @param {(reading: {freq: number|null, clarity: number, rms: number}, now: number) => void} fn */
  onPitch(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  tick = () => {
    if (!this.running) return;
    this.analyser.getFloatTimeDomainData(this.buf);
    const reading = detectPitch(this.buf, audioContext().sampleRate, this.options);
    const now = performance.now() / 1000;
    for (const fn of this.listeners) fn(reading, now);
    this.raf = requestAnimationFrame(this.tick);
  };
}

/** Play a soft, recorder-like reference tone. Resolves when it finishes. */
export function playReferenceTone(freq, seconds = 2) {
  const ctx = audioContext();
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
      resolve();
    };
  });
}
