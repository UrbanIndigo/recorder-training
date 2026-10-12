// Hearing piano chords: which notes are sounding, from the microphone
// (a spectrum, with each note's overtones removed so they aren't mistaken
// for extra notes) or exactly from a MIDI keyboard.

const LOW = 36; // C2
const HIGH = 96; // C7
// Overtones of a piano note: 2nd harmonic = octave, 3rd = octave + 5th, ...
const HARMONICS = [2, 3, 4, 5, 6, 8].map((h) => ({ semis: Math.round(12 * Math.log2(h)), weight: { 2: 0.9, 3: 0.7, 4: 0.55, 5: 0.45, 6: 0.35, 8: 0.25 }[h] }));

/**
 * Notes present in a magnitude spectrum.
 * @param {Float32Array|number[]} mags linear magnitudes, one per FFT bin
 * @param {number} binHz width of each bin
 * @returns {{notes: number[], energy: number[], bass: number|null}}
 */
export function notesFromSpectrum(mags, binHz, { threshold = 0.16 } = {}) {
  const energy = new Array(HIGH + 13).fill(0);
  for (let m = LOW; m <= HIGH + 12; m++) {
    const f = 440 * 2 ** ((m - 69) / 12);
    const lo = Math.max(1, Math.round((f * 2 ** (-0.3 / 12)) / binHz));
    const hi = Math.min(mags.length - 1, Math.round((f * 2 ** (0.3 / 12)) / binHz));
    let peak = 0;
    for (let b = lo; b <= hi; b++) peak = Math.max(peak, mags[b]);
    energy[m] = peak;
  }
  // From the bottom up, take away what each note's overtones contribute.
  const clean = energy.slice();
  for (let m = LOW; m <= HIGH; m++) {
    if (clean[m] <= 0) continue;
    for (const h of HARMONICS) {
      const t = m + h.semis;
      if (t < clean.length) clean[t] = Math.max(0, clean[t] - clean[m] * h.weight);
    }
  }
  let max = 0;
  for (let m = LOW; m <= HIGH; m++) max = Math.max(max, clean[m]);
  if (max <= 0) return { notes: [], energy: clean, bass: null };
  const notes = [];
  for (let m = LOW; m <= HIGH; m++) {
    const e = clean[m];
    // A note must stand out, and not just be spill-over from a much louder
    // note a semitone away (two real notes a semitone apart, like the B and
    // C of Cmaj7, are both kept).
    const neighbour = Math.max(clean[m - 1] || 0, clean[m + 1] || 0);
    if (e >= max * threshold && e >= neighbour * 0.5) notes.push(m);
  }
  // The bass is the lowest reasonably strong note.
  const bass = notes.find((m) => clean[m] >= max * 0.25) ?? notes[0] ?? null;
  return { notes, energy: clean, bass };
}

/** Radix-2 FFT magnitudes of a real signal (used for testing and offline). */
export function magnitudeSpectrum(signal) {
  const n = signal.length;
  const re = Float64Array.from(signal);
  const im = new Float64Array(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const ar = re[i + k + len / 2], ai = im[i + k + len / 2];
        const tr = ar * wr - ai * wi, ti = ar * wi + ai * wr;
        re[i + k + len / 2] = re[i + k] - tr;
        im[i + k + len / 2] = im[i + k] - ti;
        re[i + k] += tr;
        im[i + k] += ti;
      }
    }
  }
  const out = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) out[i] = Math.hypot(re[i], im[i]);
  return out;
}

/**
 * Listens to the mic and reports the notes it hears, about 20 times a
 * second. A long analysis window gives enough detail to tell low notes a
 * semitone apart.
 */
export class ChordListener {
  constructor() {
    this.listeners = new Set();
    this.running = false;
  }

  async start() {
    if (this.running) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    await this.ctx.resume();
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 16384;
    this.analyser.smoothingTimeConstant = 0.2;
    this.source.connect(this.analyser);
    this.db = new Float32Array(this.analyser.frequencyBinCount);
    this.mags = new Float32Array(this.analyser.frequencyBinCount);
    this.time = new Float32Array(2048);
    this.noise = 0.002;
    this.running = true;
    this.timer = setInterval(() => this.tick(), 50);
  }

  stop() {
    this.running = false;
    clearInterval(this.timer);
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.source = this.stream = this.analyser = this.ctx = null;
  }

  onNotes(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  tick() {
    if (!this.running) return;
    this.analyser.getFloatTimeDomainData(this.time);
    let sum = 0;
    for (const v of this.time) sum += v * v;
    const rms = Math.sqrt(sum / this.time.length);
    // Track the room's background level so quiet rooms and noisy ones both work.
    if (rms < this.noise) this.noise += (rms - this.noise) * 0.1;
    else this.noise = Math.min(0.05, this.noise * 1.002);
    const loud = rms > Math.max(0.003, this.noise * 4);
    let reading = { notes: [], bass: null, rms, loud };
    if (loud) {
      this.analyser.getFloatFrequencyData(this.db);
      for (let i = 0; i < this.db.length; i++) this.mags[i] = 10 ** (this.db[i] / 20);
      reading = { ...notesFromSpectrum(this.mags, this.ctx.sampleRate / this.analyser.fftSize), rms, loud };
    }
    for (const fn of this.listeners) fn(reading);
  }
}

/**
 * Reads the keys held down on a MIDI keyboard (Chrome, Edge, Android;
 * not iPhone/iPad). Reports the held notes whenever they change.
 */
export class MidiInput {
  constructor() {
    this.held = new Set();
    this.listeners = new Set();
    this.access = null;
  }

  static get supported() {
    return typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess;
  }

  /** @returns {Promise<string[]>} names of connected keyboards */
  async start() {
    this.access = await navigator.requestMIDIAccess();
    const hook = () => {
      for (const input of this.access.inputs.values()) input.onmidimessage = (e) => this.message(e.data);
    };
    hook();
    this.access.onstatechange = hook;
    return [...this.access.inputs.values()].map((i) => i.name);
  }

  inputNames() {
    return this.access ? [...this.access.inputs.values()].map((i) => i.name) : [];
  }

  message([status, note, velocity]) {
    const kind = status & 0xf0;
    if (kind === 0x90 && velocity > 0) this.held.add(note);
    else if (kind === 0x80 || (kind === 0x90 && velocity === 0)) this.held.delete(note);
    else return;
    const notes = [...this.held].sort((a, b) => a - b);
    for (const fn of this.listeners) fn({ notes, bass: notes[0] ?? null });
  }

  onNotes(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  stop() {
    if (this.access) for (const input of this.access.inputs.values()) input.onmidimessage = null;
    this.held.clear();
  }
}
