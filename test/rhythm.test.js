import test from 'node:test';
import assert from 'node:assert/strict';
import { generateExercise, LEVELS, OnsetTracker, scoreRhythm, calibrationExercise, calibrationOffset } from '../js/rhythm.js';

function seeded(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

test('generated bars always add up and follow the level rules', () => {
  for (const lvl of LEVELS) {
    for (let s = 1; s <= 40; s++) {
      const ex = generateExercise({ level: lvl.id, pitches: [79, 81, 83], random: seeded(s) });
      assert.ok(lvl.timeSigs.includes(ex.beatsPerBar));
      const sum = ex.events.reduce((a, e) => a + e.beats, 0);
      assert.equal(sum, ex.totalBeats);
      for (let b = 0; b < ex.bars; b++) {
        const barSum = ex.events.filter((e) => e.bar === b).reduce((a, e) => a + e.beats, 0);
        assert.equal(barSum, ex.beatsPerBar, `level ${lvl.id} seed ${s} bar ${b}`);
        // No event crosses a bar line.
        for (const e of ex.events.filter((x) => x.bar === b)) {
          assert.ok(e.beat + e.beats <= (b + 1) * ex.beatsPerBar + 1e-9);
        }
      }
      assert.equal(ex.events[0].rest, false);
      assert.equal(ex.events.at(-1).rest, false);
      if (lvl.id === 1) assert.ok(ex.events.every((e) => !e.rest && e.beats >= 1));
      for (const e of ex.events) if (!e.rest) assert.ok([79, 81, 83].includes(e.midi));
    }
  }
});

/**
 * Simulate a recorder player: 5 ms level readings, tongued gaps that dip but
 * don't fall silent, a reverb tail, and per-note timing errors.
 */
function perform(exercise, bpm, { offsets = () => 0, gapMs = 45, lengthFactor = 1 } = {}) {
  const beatSec = 60 / bpm;
  const notes = exercise.events
    .filter((e) => !e.rest)
    .map((e, i) => ({ start: e.beat * beatSec + offsets(i), end: (e.beat + e.beats * lengthFactor) * beatSec - gapMs / 1000, midi: e.midi }));
  const tracker = new OnsetTracker();
  const gate = 0.0016;
  let level = 0.0003;
  const end = exercise.totalBeats * beatSec + 0.5;
  for (let t = -0.5; t < end; t += 0.005) {
    const playing = notes.find((n) => t >= n.start && t < n.end);
    level = playing ? 0.02 : Math.max(0.0003, level * 0.85); // fast attack, decaying tail
    const voiced = playing || level > 0.004 ? (playing?.midi ?? notes[0].midi) + 0.05 : null;
    tracker.push(t, level, gate, voiced);
  }
  return { played: tracker.finish(end), intended: notes };
}

test('tracker separates tongued repeated notes', () => {
  const ex = generateExercise({ level: 3, pitches: [83], random: seeded(7) });
  const { played, intended } = perform(ex, 80);
  assert.equal(played.length, intended.length);
  played.forEach((p, i) => assert.ok(Math.abs(p.start - intended[i].start) < 0.012));
});

test('an accurate performance scores highly', () => {
  const ex = generateExercise({ level: 2, pitches: [83], random: seeded(3) });
  const { played } = perform(ex, 70);
  const r = scoreRhythm(ex, played, 70);
  assert.equal(r.missed, 0);
  assert.equal(r.extras.length, 0);
  assert.equal(r.onTime, r.total);
  assert.ok(r.overall >= 90, `score ${r.overall}`);
});

test('consistently early playing is reported as rushing', () => {
  const ex = generateExercise({ level: 1, pitches: [83], random: seeded(5) });
  const { played } = perform(ex, 70, { offsets: () => -0.09 });
  const r = scoreRhythm(ex, played, 70);
  assert.ok(r.meanErrorMs < -70);
  assert.ok(r.tips.some((t) => t.includes('rush')));
  assert.ok(r.overall < 90);
});

test('cut-short long notes are flagged', () => {
  const ex = { beatsPerBar: 4, bars: 1, totalBeats: 4, events: [{ beat: 0, beats: 2, rest: false, midi: 83 }, { beat: 2, beats: 2, rest: false, midi: 83 }] };
  const { played } = perform(ex, 60, { lengthFactor: 0.4 });
  const r = scoreRhythm(ex, played, 60);
  assert.equal(r.shortNotes, 2);
  assert.ok(r.tips.some((t) => t.includes('cut short')));
});

test('playing through a rest is penalised', () => {
  const ex = { beatsPerBar: 4, bars: 1, totalBeats: 4, events: [
    { beat: 0, beats: 1, rest: false, midi: 83 },
    { beat: 1, beats: 2, rest: true },
    { beat: 3, beats: 1, rest: false, midi: 83 },
  ] };
  const played = [{ start: 0, end: 2.9, midi: 83 }, { start: 3, end: 3.9, midi: 83 }];
  const r = scoreRhythm(ex, played, 60);
  assert.equal(r.restHits.length, 1);
  assert.ok(r.tips.some((t) => t.includes('rest')));
});

test('missing everything scores zero', () => {
  const ex = generateExercise({ level: 1, pitches: [83], random: seeded(9) });
  const r = scoreRhythm(ex, [], 70);
  assert.equal(r.overall, 0);
  assert.equal(r.missed, r.total);
});

test('wrong pitches count when pitch checking is on', () => {
  const ex = { beatsPerBar: 4, bars: 1, totalBeats: 4, events: [0, 1, 2, 3].map((b) => ({ beat: b, beats: 1, rest: false, midi: 83 })) };
  const played = [0, 1, 2, 3].map((b) => ({ start: b, end: b + 0.9, midi: b === 2 ? 81 : 83 }));
  assert.equal(scoreRhythm(ex, played, 60, { checkPitch: true }).wrongPitches, 1);
  assert.equal(scoreRhythm(ex, played, 60).wrongPitches, 0);
});

test('calibration finds a constant device delay', () => {
  const ex = calibrationExercise(83);
  const { played } = perform(ex, 80, { offsets: (i) => 0.11 + (i % 2 ? 0.01 : -0.01) });
  const off = calibrationOffset(ex, played, 80);
  assert.ok(Math.abs(off - 0.11) < 0.015, `offset ${off}`);
});
