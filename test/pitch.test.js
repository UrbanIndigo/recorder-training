import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch, PitchSmoother } from '../js/pitch.js';
import { freqToMidi, midiToFreq } from '../js/music.js';

const SR = 48000;

function tone(freq, { n = 2048, amp = 0.3, harmonics = [[1, 1], [2, 0.15], [3, 0.05]], noise = 0 } = {}) {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (const [h, a] of harmonics) v += a * Math.sin((2 * Math.PI * freq * h * i) / SR);
    buf[i] = amp * v + noise * (Math.random() * 2 - 1);
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
  const buf = new Float32Array(2048).map(() => Math.random() * 0.6 - 0.3);
  assert.equal(detectPitch(buf, SR).freq, null);
});

test('smoother ignores single-frame dropouts and blips', () => {
  const s = new PitchSmoother(5);
  assert.equal(s.push(72), null); // needs two readings to start
  assert.equal(s.push(72), 72);
  assert.equal(s.push(null), 72); // one dropout is bridged
  s.push(72);
  assert.equal(s.push(84), 72); // octave blip removed by the median
  s.push(null);
  s.push(null);
  assert.equal(s.push(null), null); // sustained silence
});
