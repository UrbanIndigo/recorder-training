import test from 'node:test';
import assert from 'node:assert/strict';
import { generateExercise, LEVELS, OnsetTracker, scoreRhythm, calibrationExercise, calibrationOffset, soundingNotes } from '../js/rhythm.js';

function seeded(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

test('generated bars always add up and follow the level rules', () => {
  for (const lvl of LEVELS) {
    for (let s = 1; s <= 40; s++) {
      const ex = generateExercise({ level: lvl.id, pitches: [79, 81, 83], random: seeded(s) });
      assert.ok(lvl.timeSigs.includes(ex.meter));
      const near = (a, b) => Math.abs(a - b) < 1e-9;
      const sum = ex.events.reduce((a, e) => a + e.beats, 0);
      assert.ok(near(sum, ex.totalBeats));
      for (let b = 0; b < ex.bars; b++) {
        const barSum = ex.events.filter((e) => e.bar === b).reduce((a, e) => a + e.beats, 0);
        assert.ok(near(barSum, ex.beatsPerBar), `level ${lvl.id} seed ${s} bar ${b}`);
        // No event crosses a bar line.
        for (const e of ex.events.filter((x) => x.bar === b)) {
          assert.ok(e.beat + e.beats <= (b + 1) * ex.beatsPerBar + 1e-9);
        }
      }
      assert.ok(!ex.events[0].rest || ex.events[0].barRest || lvl.restStart);
      assert.equal(ex.events.at(-1).rest, false);
      // Tied notes continue the same pitch.
      ex.events.forEach((e, i) => { if (e.tied) assert.equal(e.midi, ex.events[i - 1].midi); });
      if (lvl.id === 1) assert.ok(ex.events.every((e) => !e.rest && e.beats >= 1));
      // Every note starts on the subdivision grid of its time signature.
      for (const e of ex.events) {
        const grid = [0.125, 1 / 6, 0.2].some((g) => Math.abs(e.beat / g - Math.round(e.beat / g)) < 1e-6);
        assert.ok(grid, `odd position ${e.beat}`);
      }
      if (ex.meter === '6/8') {
        // 6/8 groups in dotted quarters: no cell straddles a dotted-quarter beat.
        for (const id of new Set(ex.events.map((e) => e.cellId))) {
          const evs = ex.events.filter((e) => e.cellId === id);
          const start = evs[0].beat % 3, end = start + evs.reduce((a, e) => a + e.beats, 0);
          assert.ok(Math.abs(start % 1.5) < 1e-9 && Math.abs(end % 1.5) < 1e-9, `cell crosses a beat at ${start}`);
        }
      }
      for (const e of ex.events) if (!e.rest) assert.ok([79, 81, 83].includes(e.midi));
    }
  }
});

/**
 * Simulate a recorder player: 5 ms level readings, tongued gaps that dip but
 * don't fall silent, a reverb tail, and per-note timing errors.
 */
function perform(exercise, bpm, { offsets = () => 0, gapMs = 45, lengthFactor = 1, decay = 0.85 } = {}) {
  const beatSec = 60 / bpm;
  const notes = soundingNotes(exercise)
    .map((e, i) => ({ start: e.beat * beatSec + offsets(i), end: (e.beat + e.beats * lengthFactor) * beatSec - gapMs / 1000, midi: e.midi }));
  const tracker = new OnsetTracker();
  const gate = 0.0016;
  let level = 0.0003;
  const end = exercise.totalBeats * beatSec + 0.5;
  for (let t = -0.5; t < end; t += 0.005) {
    const playing = notes.find((n) => t >= n.start && t < n.end);
    level = playing ? 0.02 : Math.max(0.0003, level * decay); // fast attack, decaying tail
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

test('tongued notes are separated even in an echoey room', () => {
  // Level only dips to about 60% in the tongue gap.
  const ex = generateExercise({ level: 3, pitches: [83], random: seeded(7) });
  const { played, intended } = perform(ex, 80, { decay: 0.94 });
  assert.equal(played.length, intended.length);
  played.forEach((p, i) => assert.ok(Math.abs(p.start - intended[i].start) < 0.05, `note ${i} at ${p.start} vs ${intended[i].start}`));
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

/** Feed a hand-made level/pitch timeline (5 ms steps) to a tracker. */
function track(segments, gate = 0.0016) {
  const tr = new OnsetTracker();
  let t = 0;
  for (const seg of segments) {
    for (const end = t + seg.dur; t < end; t += 0.005) {
      const lvl = typeof seg.level === 'function' ? seg.level(t) : seg.level;
      tr.push(t, lvl, gate, seg.midi ?? null, seg.tonal ?? seg.midi != null);
    }
  }
  return tr.finish(t);
}

test('a loud tonguing burst does not cut the note short', () => {
  const notes = track([
    { dur: 0.2, level: 0.0003 },
    { dur: 0.03, level: 0.08, midi: 83 }, // "t" burst 4x louder than the tone
    { dur: 0.8, level: 0.02, midi: 83 },
    { dur: 0.2, level: 0.0003 },
  ]);
  assert.equal(notes.length, 1);
  assert.ok(notes[0].end - notes[0].start > 0.8);
});

test('a breathy tone with no clear pitch still counts as a note', () => {
  const notes = track([
    { dur: 0.2, level: 0.0003 },
    { dur: 0.6, level: 0.01, midi: null, tonal: true },
    { dur: 0.2, level: 0.0003 },
  ]);
  assert.equal(notes.length, 1);
});

test('a slur to a new pitch starts a new note', () => {
  const notes = track([
    { dur: 0.2, level: 0.0003 },
    { dur: 0.5, level: 0.02, midi: 83 },
    { dur: 0.5, level: 0.02, midi: 81 },
    { dur: 0.2, level: 0.0003 },
  ]);
  assert.equal(notes.length, 2);
  assert.ok(Math.abs(notes[1].start - 0.7) < 0.02);
  assert.equal(Math.round(notes[0].midi), 83);
  assert.equal(Math.round(notes[1].midi), 81);
});

test('an out-of-tune note wavering between names is not split', () => {
  const notes = track([
    { dur: 0.2, level: 0.0003 },
    { dur: 1, level: 0.02, midi: 82.5 },
    { dur: 1, level: 0.02, midi: 82.45 },
    { dur: 0.2, level: 0.0003 },
  ]);
  assert.equal(notes.length, 1);
});

test('a breath noise without tone is ignored', () => {
  const notes = track([
    { dur: 0.2, level: 0.0003 },
    { dur: 0.5, level: 0.01, midi: null, tonal: false },
    { dur: 0.2, level: 0.0003 },
  ]);
  assert.equal(notes.length, 0);
});

test('breath vibrato does not split a held note', () => {
  const notes = track([
    { dur: 0.2, level: 0.0003 },
    { dur: 2, level: (t) => 0.02 * (1 + 0.2 * Math.sin(2 * Math.PI * 5 * t)), midi: 83 },
    { dur: 0.2, level: 0.0003 },
  ]);
  assert.equal(notes.length, 1);
});

test('bar verdicts name what went wrong in each bar', async () => {
  const { barVerdicts } = await import('../js/rhythm.js');
  const ex = { beatsPerBar: 4, bars: 3, totalBeats: 12, events: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((b) => ({ beat: b, beats: 1, rest: false, midi: 83, bar: Math.floor(b / 4) })) };
  const played = ex.events
    .filter((e) => e.beat !== 10) // bar 3 misses a note
    .map((e) => ({ start: e.beat + (e.bar === 1 ? -0.09 : 0), end: e.beat + 0.9 + (e.bar === 1 ? -0.09 : 0), midi: 83 }));
  const v = barVerdicts(ex, scoreRhythm(ex, played, 60));
  assert.deepEqual(v.map((x) => x.text), ['Great', 'Early', 'Missed a note']);
});

test('fast notes (thirty-seconds, quintuplets) are tracked and scored', () => {
  for (const level of [11, 12]) {
    const ex = generateExercise({ level, pitches: [83], random: seeded(21 + level) });
    const { played, intended } = perform(ex, 60, { gapMs: 25 });
    assert.equal(played.length, intended.length, `level ${level}`);
    const r = scoreRhythm(ex, played, 60);
    assert.equal(r.missed, 0, `level ${level}`);
    assert.ok(r.overall >= 85, `level ${level} score ${r.overall}`);
  }
});

test('double-dotted and tuplet notes keep their real lengths', () => {
  const ex = generateExercise({ level: 12, pitches: [83], random: seeded(5) });
  for (const e of ex.events) {
    if (e.dots === 2) assert.ok([1.75, 3.5].some((v) => Math.abs(e.beats - v) < 1e-9));
  }
  const t = generateExercise({ level: 11, pitches: [83], random: seeded(8) });
  for (const id of new Set(t.events.filter((e) => e.tuplet).map((e) => e.tupletId))) {
    const g = t.events.filter((e) => e.tupletId === id);
    const total = g.reduce((a, e) => a + e.beats, 0);
    assert.ok([0.5, 1, 2].some((v) => Math.abs(total - v) < 1e-9), `tuplet group lasts ${total}`);
  }
});

test('whole-range rhythms use notes from the full range, mostly by step', () => {
  const pitches = Array.from({ length: 27 }, (_, i) => 72 + i);
  const ex = generateExercise({ level: 3, pitches, random: seeded(4), bars: 8 });
  const notes = ex.events.filter((e) => !e.rest).map((e) => e.midi);
  assert.ok(notes.every((m) => m >= 72 && m <= 98));
  assert.ok(new Set(notes).size > 5);
});

test('detached but on-time playing is not marked too short', async () => {
  const { barVerdict } = await import('../js/rhythm.js');
  const bpm = 120, beat = 60 / bpm;
  // Quarter notes sounding for only half their length, slightly off the beat.
  const quarters = { beatsPerBar: 4, bars: 1, totalBeats: 4, events: [0, 1, 2, 3].map((b) => ({ beat: b, beats: 1, rest: false, midi: 83, bar: 0 })) };
  const played = [0, 1, 2, 3].map((b, i) => ({ start: b * beat + [0.02, -0.03, 0.04, -0.01][i], end: b * beat + 0.5 * beat, midi: 83 }));
  const r = scoreRhythm(quarters, played, bpm);
  assert.equal(r.shortNotes, 0);
  assert.ok(r.overall >= 95, `score ${r.overall}`);
  assert.equal(barVerdict(quarters, r, 0).text, 'Great');
  // A half note held for 70% is fine; for 30% it's too short.
  const half = { beatsPerBar: 4, bars: 1, totalBeats: 4, events: [{ beat: 0, beats: 2, rest: false, midi: 83, bar: 0 }, { beat: 2, beats: 2, rest: false, midi: 83, bar: 0 }] };
  const ok = scoreRhythm(half, [{ start: 0, end: 0.7 * 2 * beat, midi: 83 }, { start: 2 * beat, end: 2 * beat + 0.3 * 2 * beat, midi: 83 }], bpm);
  assert.equal(ok.notes[0].short, false);
  assert.equal(ok.notes[1].short, true);
});
