// Monophonic pitch detection using the YIN algorithm
// (de Cheveigné & Kawahara, 2002). Recorders produce a strong, fairly pure
// fundamental, which YIN tracks reliably.

/**
 * @param {Float32Array} buf time-domain samples
 * @param {number} sampleRate
 * @returns {{freq: number|null, clarity: number, rms: number}}
 */
export function detectPitch(buf, sampleRate, opts = {}) {
  const { minFreq = 150, maxFreq = 4000, threshold = 0.15, maxAperiodicity = 0.5, minRms = 0 } = opts;
  const n = buf.length;

  let sumSq = 0;
  for (let i = 0; i < n; i++) sumSq += buf[i] * buf[i];
  const rms = Math.sqrt(sumSq / n);
  if (rms < minRms) return { freq: null, clarity: 0, rms };

  const maxTau = Math.min(Math.floor(sampleRate / minFreq), Math.floor(n / 2));
  const minTau = Math.max(2, Math.floor(sampleRate / maxFreq));
  const w = n - maxTau;

  // Difference function, then cumulative mean normalised difference.
  const d = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0;
    for (let j = 0; j < w; j++) {
      const diff = buf[j] - buf[j + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  const cmnd = new Float32Array(maxTau + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    running += d[tau];
    cmnd[tau] = running > 0 ? (d[tau] * tau) / running : 1;
  }

  // First dip under the threshold (walked down to its local minimum);
  // otherwise fall back to the global minimum if it is reasonably clear.
  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= maxTau && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau === -1) {
    let best = minTau;
    for (let t = minTau + 1; t <= maxTau; t++) if (cmnd[t] < cmnd[best]) best = t;
    if (cmnd[best] > maxAperiodicity) return { freq: null, clarity: 1 - cmnd[best], rms };
    tau = best;
  }

  // Parabolic interpolation on the raw difference for sub-sample accuracy.
  let betterTau = tau;
  if (tau > 1 && tau < maxTau) {
    const a = d[tau - 1], b = d[tau], c = d[tau + 1];
    const denom = a - 2 * b + c;
    if (denom !== 0) betterTau = tau + (a - c) / (2 * denom);
  }

  const freq = sampleRate / betterTau;
  if (freq < minFreq || freq > maxFreq) return { freq: null, clarity: 0, rms };
  return { freq, clarity: 1 - cmnd[tau], rms };
}

/**
 * Decides whether a frame is loud enough to be someone playing, relative to
 * the room's background noise rather than a fixed level. Phone microphones
 * (with automatic gain turned off, as it must be for accurate pitch) record
 * much more quietly than laptop ones, so a fixed cut-off misses real notes.
 */
export class NoiseGate {
  constructor({ ratio = 4, minLevel = 0.0004 } = {}) {
    this.ratio = ratio; // how far above the background a note must be
    this.minLevel = minLevel;
    this.noise = 0.001; // background estimate (RMS)
  }

  /** @returns {boolean} true if this frame counts as sound */
  update(rms) {
    // The estimate drops quickly to quiet frames and creeps up slowly, so a
    // long held note barely moves it.
    if (rms < this.noise) this.noise += (rms - this.noise) * 0.1;
    else this.noise = Math.min(0.05, this.noise * 1.001);
    return rms >= this.threshold;
  }

  get threshold() {
    return Math.max(this.minLevel, this.noise) * this.ratio;
  }
}

/**
 * Smooths a stream of pitch readings (in MIDI units) with a short median
 * filter, and bridges brief dropouts (a breathy moment the detector can't
 * read) so a held note isn't counted as stopping.
 */
export class PitchSmoother {
  constructor(size = 5, bridgeFrames = 12) {
    this.size = size;
    this.bridgeFrames = bridgeFrames;
    this.values = [];
    this.silentFrames = 0;
  }

  /** @param {number|null} midi  @returns {number|null} */
  push(midi) {
    if (midi == null) {
      this.silentFrames++;
      if (this.silentFrames > this.bridgeFrames) this.values = [];
      return this.values.length < 2 ? null : median(this.values);
    }
    this.silentFrames = 0;
    this.values.push(midi);
    if (this.values.length > this.size) this.values.shift();
    return this.values.length >= 2 ? median(this.values) : null;
  }

  reset() {
    this.values = [];
    this.silentFrames = 0;
  }
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
