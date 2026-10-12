import test from 'node:test';
import assert from 'node:assert/strict';
import { notesFromSpectrum, magnitudeSpectrum } from '../js/chord-detect.js';
import { makeChord, voicing, checkChord } from '../js/chords.js';

const SR = 48000;
const N = 16384;
let seed = 3;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

/** A rough piano: overtones that fade, slightly sharp (as real strings are), weak low fundamentals. */
function piano(midis) {
  const buf = new Float32Array(N);
  for (const m of midis) {
    const f0 = 440 * 2 ** ((m - 69) / 12);
    const amp = 0.8 + 0.4 * rand();
    for (let h = 1; h <= 10; h++) {
      const f = f0 * h * Math.sqrt(1 + 0.0004 * h * h);
      if (f > SR / 2) break;
      const a = amp * (h === 1 ? 1 : 0.8 / h ** 1.1) * (m < 52 && h === 1 ? 0.5 : 1);
      const ph = rand() * 6.28;
      const w = (2 * Math.PI * f) / SR;
      for (let i = 0; i < N; i++) buf[i] += a * Math.sin(ph + w * i);
    }
  }
  for (let i = 0; i < N; i++) buf[i] = buf[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N)) + 0.01 * (rand() - 0.5);
  return magnitudeSpectrum(buf);
}

const hear = (midis) => notesFromSpectrum(piano(midis), SR / N).notes;

test('hears triads, sevenths and their inversions from the mic', () => {
  for (const [root, type, inv] of [[7, 'major', 0], [7, 'major', 1], [7, 'major', 2], [2, 'minor', 1], [0, 'maj7', 1], [7, 'dom7', 3], [11, 'halfdim', 0], [7, 'sus4', 2], [3, 'dim7', 2]]) {
    const c = makeChord(root, type, inv);
    const r = checkChord(c, hear(voicing(c)), { allowExtra: 1 });
    assert.ok(r.correct, `${c.symbol}: ${r.message}`);
  }
});

test('does not accept the wrong inversion or the wrong chord', () => {
  const g1 = makeChord(7, 'major', 1); // G/B
  assert.equal(checkChord(g1, hear(voicing(makeChord(7, 'major', 0))), { allowExtra: 1 }).bassOk, false);
  const gm = makeChord(7, 'minor', 0);
  const r = checkChord(gm, hear(voicing(makeChord(7, 'major', 0))), { allowExtra: 1 });
  assert.equal(r.correct, false); // B♭ missing
});
