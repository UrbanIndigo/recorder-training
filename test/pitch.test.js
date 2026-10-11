import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch, PitchSmoother, NoiseGate } from '../js/pitch.js';
import { freqToMidi, midiToFreq } from '../js/music.js';

const SR = 48000;

// Repeatable noise, so results don't vary run to run.
let seed = 12345;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

function tone(freq, { n = 2048, amp = 0.3, harmonics = [[1, 1], [2, 0.15], [3, 0.05]], noise = 0 } = {}) {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (const [h, a] of harmonics) v += a * Math.sin((2 * Math.PI * freq * h * i) / SR);
    buf[i] = amp * v + noise * (rand() * 2 - 1);
  }
  return buf;
}

test('detects recorder-range pitches to within 2 cents', () => {
  // Bass low F3 up to sopranino high G7.
  for (const midi of [53, 60, 65, 72, 79, 84, 91, 98, 103]) {
    const f = midiToFreq(midi);
    const { freq } = detectPitch(tone(f), SR, { minFreq: 100, maxFreq: 5000 });
    assert.ok(freq, `no pitch for midi ${midi}`);
    const cents = (freqToMidi(freq) - midi) * 100;
    assert.ok(Math.abs(cents) < 2, `midi ${midi}: off by ${cents.toFixed(2)} cents`);
  }
});

test('detects slightly sharp notes accurately', () => {
  const f = midiToFreq(72.15); // C5 + 15 cents
  const { freq } = detectPitch(tone(f, { noise: 0.02 }), SR, { minFreq: 300, maxFreq: 3000 });
  const cents = (freqToMidi(freq) - 72) * 100;
  assert.ok(Math.abs(cents - 15) < 2, `got ${cents}`);
});

test('reports silence below the loudness gate', () => {
  const r = detectPitch(tone(523, { amp: 0.001 }), SR, { minRms: 0.01 });
  assert.equal(r.freq, null);
});

test('reports no pitch for noise', () => {
  const buf = new Float32Array(2048).map(() => rand() * 0.6 - 0.3);
  assert.equal(detectPitch(buf, SR).freq, null);
});

test('smoother ignores single-frame dropouts and blips', () => {
  const s = new PitchSmoother(5);
  assert.equal(s.push(72), null); // needs two readings to start
  assert.equal(s.push(72), 72);
  assert.equal(s.push(null), 72); // one dropout is bridged
  s.push(72);
  assert.equal(s.push(84), 72); // octave blip removed by the median
  for (let i = 0; i < 12; i++) assert.equal(s.push(null), 72); // short gaps bridged
  assert.equal(s.push(null), null); // sustained silence
});

test('detects a quiet, breathy note', () => {
  // Phone-mic level with breath noise mixed in.
  const f = midiToFreq(78); // soprano F♯
  const { freq } = detectPitch(tone(f, { amp: 0.004, noise: 0.0015 }), SR, { minFreq: 300, maxFreq: 4000 });
  assert.ok(freq, 'no pitch detected');
  assert.ok(Math.abs((freqToMidi(freq) - 78) * 100) < 5);
});

test('noise gate adapts to the room and lets quiet playing through', () => {
  const gate = new NoiseGate({ ratio: 4 });
  for (let i = 0; i < 120; i++) gate.update(0.0003); // quiet room
  assert.equal(gate.update(0.0003), false);
  assert.equal(gate.update(0.003), true); // soft playing on a phone mic
  // Holding a note for 10 s barely moves the background estimate.
  for (let i = 0; i < 600; i++) gate.update(0.003);
  assert.equal(gate.update(0.003), true);

  const noisy = new NoiseGate({ ratio: 4 });
  for (let i = 0; i < 120; i++) noisy.update(0.004); // noisy room
  for (let i = 0; i < 600; i++) noisy.update(0.004);
  assert.equal(noisy.update(0.005), false);
});
