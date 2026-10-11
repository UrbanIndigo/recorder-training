import test from 'node:test';
import assert from 'node:assert/strict';
import { LongToneSession, scoreLongTone } from '../js/longtone.js';

const FPS = 60;
function samples(duration, fn) {
  const out = [];
  for (let i = 0; i < duration * FPS; i++) out.push({ t: i / FPS, midi: fn(i / FPS) });
  return out;
}

test('a perfect held note scores 100', () => {
  const r = scoreLongTone(samples(10, () => 72), 72, 10);
  assert.equal(r.overall, 100);
  assert.equal(r.noteAccuracy, 1);
  assert.equal(r.grade.stars, 5);
  assert.equal(Math.round(r.meanCents), 0);
});

test('a consistently sharp note is right but marked sharp', () => {
  const r = scoreLongTone(samples(10, () => 72.2), 72, 10);
  assert.equal(r.noteAccuracy, 1);
  assert.equal(Math.round(r.meanCents), 20);
  assert.ok(r.overall < 90 && r.overall > 60, `score ${r.overall}`);
  assert.ok(r.tips.some((t) => t.includes('sharp')));
});

test('a wobbly note loses steadiness points', () => {
  const steady = scoreLongTone(samples(10, () => 72), 72, 10);
  const wobbly = scoreLongTone(samples(10, (t) => 72 + 0.2 * Math.sin(t * 6)), 72, 10);
  assert.ok(wobbly.stdCents > 12);
  assert.ok(wobbly.subScores.steadiness < steady.subScores.steadiness);
  assert.ok(wobbly.tips.some((t) => t.includes('wobbled')));
});

test('playing the wrong note is detected and named', () => {
  const r = scoreLongTone(samples(10, () => 74), 72, 10);
  assert.equal(r.noteAccuracy, 0);
  assert.equal(r.mostPlayed, 74);
  assert.equal(r.meanCents, null);
  assert.ok(r.overall <= 15);
  assert.ok(r.tips.some((t) => t.includes('mostly playing D')));
});

test('overblowing an octave gets a specific tip', () => {
  const r = scoreLongTone(samples(10, () => 84), 72, 10);
  assert.ok(r.tips.some((t) => t.includes('octave too high')));
});

test('gaps reduce the sustain score', () => {
  const r = scoreLongTone(samples(10, (t) => (t > 5 ? null : 72)), 72, 10);
  assert.ok(Math.abs(r.sustain - 0.5) < 0.01);
  assert.ok(r.overall < 100);
  assert.ok(r.tips.some((t) => t.includes('stopped')));
});

test('silence gives a zero score with advice', () => {
  const r = scoreLongTone(samples(10, () => null), 72, 10);
  assert.equal(r.overall, 0);
  assert.equal(r.mostPlayed, null);
  assert.ok(r.tips[0].includes('No clear note'));
});

test('session waits for sound, then runs for the duration', () => {
  const s = new LongToneSession({ targetMidi: 72, duration: 10 });
  for (let t = 0; t < 2; t += 1 / FPS) s.push(null, t);
  assert.equal(s.state, 'waiting');
  let t = 2;
  for (; s.state !== 'done' && t < 20; t += 1 / FPS) s.push(72, t);
  assert.equal(s.state, 'done');
  assert.ok(Math.abs(t - 12) < 0.1, `finished at ${t}`);
  assert.equal(s.result.overall, 100);
});

test('session ignores a brief click before the note', () => {
  const s = new LongToneSession({ targetMidi: 72, duration: 10 });
  s.push(72, 0);
  s.push(null, 0.02);
  assert.equal(s.state, 'waiting');
});
