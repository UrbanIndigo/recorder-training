import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, makeSong, judgeTap, grade, WINDOWS } from '../js/game/song.js';

test('the same seed gives the same song; a new play gives new rhythms', () => {
  for (const level of LEVELS) {
    const a = makeSong(level, 1);
    const b = makeSong(level, 1);
    const c = makeSong(level, 2);
    assert.deepEqual(a.notes.map((n) => n.time), b.notes.map((n) => n.time));
    assert.notDeepEqual(a.notes.map((n) => n.time), c.notes.map((n) => n.time), level.name);
    // Same shape each time: length, sections and chords stay put.
    assert.equal(a.length, c.length);
    assert.deepEqual(a.sections, c.sections);
    assert.deepEqual(a.chords.map((x) => x.root), c.chords.map((x) => x.root));
  }
});

test('songs are well formed', () => {
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 20; seed++) {
      const s = makeSong(level, seed);
      assert.ok(s.notes.length > 20, `${level.name} has notes`);
      // Nothing before the count-in ends or after the song ends.
      const firstBeat = s.countInBars * s.meter.bpb;
      for (const n of s.notes) {
        assert.ok(n.beat >= firstBeat - 1e-9 && n.time < s.length);
        assert.ok(n.midi > 20 && n.midi < 110);
      }
      // Within a lane, no two notes at the same moment.
      for (const lane of ['L', 'R']) {
        const times = s.notes.filter((n) => n.lane === lane).map((n) => n.time.toFixed(5));
        assert.equal(new Set(times).size, times.length);
      }
    }
  }
});

test('two-handed levels use both hands, sometimes together', () => {
  for (const level of LEVELS.filter((l) => l.hands === 2)) {
    const s = makeSong(level, 7);
    const left = s.notes.filter((n) => n.lane === 'L');
    const right = s.notes.filter((n) => n.lane === 'R');
    assert.ok(left.length > 10 && right.length > 10);
    const rightTimes = new Set(right.map((n) => n.time.toFixed(4)));
    const together = left.filter((n) => rightTimes.has(n.time.toFixed(4))).length;
    assert.ok(together >= 4, `${level.name}: ${together} chords for both hands`);
  }
  for (const level of LEVELS.filter((l) => l.hands === 1)) {
    assert.ok(makeSong(level, 3).notes.every((n) => n.lane === 'R'));
  }
});

test('later levels are harder', () => {
  const density = (level) => {
    let total = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const s = makeSong(level, seed);
      total += s.notes.length / s.length;
    }
    return total / 10;
  };
  assert.ok(density(LEVELS[0]) < density(LEVELS[3]));
  assert.ok(density(LEVELS[3]) < density(LEVELS[7]));
});

test('taps are judged by how close they are', () => {
  const notes = [{ time: 1, lane: 'R' }, { time: 1.5, lane: 'R' }, { time: 1.5, lane: 'L' }];
  assert.equal(judgeTap(notes, 'R', 1.02).judgement, 'perfect');
  assert.equal(judgeTap(notes, 'R', 1.07).judgement, 'good');
  assert.equal(judgeTap(notes, 'R', 0.88).judgement, 'ok');
  assert.equal(judgeTap(notes, 'R', 1.25), null); // between notes
  assert.equal(judgeTap(notes, 'L', 1.5).note, notes[2]); // the left hand's note
  assert.ok(judgeTap(notes, 'R', 1.5 - WINDOWS.good).offset < 0); // early
  const g = grade({ perfect: 18, good: 2, ok: 0, miss: 0 });
  assert.equal(g.letter, 'S');
  assert.equal(grade({ perfect: 5, good: 5, ok: 0, miss: 10 }).passed, false);
});

test('the written score matches the notes to play', async () => {
  const { layoutScore } = await import('../js/game/score.js');
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 10; seed++) {
      const s = makeSong(level, seed);
      const bpb = s.meter.bpb;
      for (const lane of level.hands === 2 ? ['R', 'L'] : ['R']) {
        const evs = s.score[lane];
        // Every bar is filled exactly, from the first bar after the count-in.
        const perBar = new Map();
        for (const e of evs) {
          const b = Math.floor(e.beat / bpb + 1e-9);
          perBar.set(b, (perBar.get(b) || 0) + e.beats);
        }
        assert.equal(perBar.size, s.bars, `${level.name} ${lane} bars`);
        for (const total of perBar.values()) assert.ok(Math.abs(total - bpb) < 1e-6, `${level.name} ${lane} bar sums to ${total}`);
        // Each note starts where a written (untied) note does.
        const starts = evs.filter((e) => !e.rest && !e.tied);
        const notes = s.notes.filter((n) => n.lane === lane);
        assert.equal(starts.length, notes.length);
        starts.forEach((e, i) => {
          assert.equal(s.notes[e.noteId], notes[i]);
          assert.ok(Math.abs(notes[i].beat - e.beat) < 1e-9);
        });
        // Layout: beams join notes of one value group; nothing lost.
        const lay = layoutScore(evs, bpb);
        assert.equal(lay.glyphs.length, evs.length);
        for (const bm of lay.beams) assert.ok(bm.to >= bm.from && bm.to - bm.from <= bpb);
      }
    }
  }
});

test('notation layout: beams, flags, stubs and tuplets', async () => {
  const { layoutScore } = await import('../js/game/score.js');
  const lay = layoutScore([
    { beat: 0, beats: 0.5, beamGroup: 'a' }, { beat: 0.5, beats: 0.5, beamGroup: 'a' }, // beamed eighths
    { beat: 1, beats: 0.5 }, { beat: 1.5, beats: 0.5, rest: true }, // flagged eighth, rest
    { beat: 2, beats: 0.75, dotted: true, beamGroup: 'b' }, { beat: 2.75, beats: 0.25, beamGroup: 'b' }, // dotted eighth + sixteenth
    ...[0, 1, 2].map((k) => ({ beat: 3 + k / 3, beats: 1 / 3, written: 0.5, tuplet: 3, tupletId: 't', beamGroup: 'c' })),
  ], 4);
  assert.equal(lay.glyphs[2].flags, 1);
  assert.equal(lay.glyphs[0].flags, 0);
  assert.equal(lay.glyphs[4].dots, 1);
  assert.deepEqual(lay.beams.filter((b) => b.level === 1).map((b) => [b.from, b.to]), [[0, 0.5], [2, 2.75], [3, 3 + 2 / 3]]);
  assert.deepEqual(lay.beams.filter((b) => b.level === 2).map((b) => b.stub), ['left']);
  assert.deepEqual(lay.tuplets.map((t) => [t.n, t.bracket]), [[3, false]]);
});

test('engraved spacing: in order, inside the bar, longer notes get more room but not in proportion', async () => {
  const { engraveBar } = await import('../js/game/score.js');
  const bar = [{ beat: 8, beats: 2 }, { beat: 10, beats: 0.5 }, { beat: 10.5, beats: 0.5 }, { beat: 11, beats: 1 }];
  const xOf = engraveBar([bar], 8, 4, 20, 100);
  const xs = bar.map((e) => xOf(e.beat));
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] > xs[i - 1]);
  assert.ok(xs[0] >= 20 && xOf(12) <= 120);
  const half = xs[1] - xs[0];
  const eighth = xs[2] - xs[1];
  assert.ok(half > eighth && half < 4 * eighth);
  // A bar rest's middle lands mid-bar.
  const empty = engraveBar([[{ beat: 0, beats: 4, rest: true, barRest: true }]], 0, 4, 0, 100);
  assert.ok(Math.abs(empty(2) - 51.5) < 2);
});

test('speeds: new wards start slow and step up to full speed', async () => {
  const { SPEEDS, FULL_SPEED, nextSpeed } = await import('../js/game/song.js');
  assert.equal(SPEEDS[nextSpeed(null)], 0.7);
  assert.equal(nextSpeed(0), 1);
  assert.equal(nextSpeed(1), FULL_SPEED);
  assert.equal(nextSpeed(FULL_SPEED), FULL_SPEED); // 115% is opt-in
  const slow = makeSong(LEVELS[3], 5, { speed: 0.7 });
  const full = makeSong(LEVELS[3], 5);
  // Same rhythms, just slower.
  assert.deepEqual(slow.notes.map((n) => n.beat), full.notes.map((n) => n.beat));
  assert.ok(slow.length > full.length * 1.4);
  assert.equal(slow.bpm, Math.round(LEVELS[3].bpm * 0.7));
});

test('extra taps count against the grade', () => {
  const clean = grade({ perfect: 10, good: 0, ok: 0, miss: 0 });
  const mashed = grade({ perfect: 10, good: 0, ok: 0, miss: 0, extra: 30 });
  assert.equal(clean.letter, 'S');
  assert.ok(mashed.acc < 0.3 && !mashed.passed);
});

test('wards ease in: new rhythms arrive one at a time', async () => {
  const { introductions } = await import('../js/game/song.js');
  const fever = LEVELS[3];
  const intro = introductions(fever);
  assert.equal([...intro.keys()][0], 'eighthTwoSixteenths');
  assert.ok(!intro.has('quarter') && !intro.has('eighths'));
  const bars = [...intro.values()];
  for (let i = 1; i < bars.length; i++) assert.ok(bars[i] > bars[i - 1]);
  assert.ok(bars[0] === 4 && bars.at(-1) <= 15);
  // In the first verse, no sixteenth-note pairs yet beyond the first new rhythm.
  for (let seed = 1; seed <= 20; seed++) {
    const s = makeSong(fever, seed);
    const firstVerse = s.score.R.filter((e) => e.beat >= 4 * 5 && e.beat < 4 * 6); // bar 4 after the 1-bar count-in
    assert.ok(firstVerse.every((e) => e.beats >= 0.25 - 1e-9));
    const cellsAt = (b) => new Set(s.score.R.filter((e) => Math.floor(e.beat / 4) === b + 1).map((e) => e.cell));
    for (const [c, at] of intro) for (let b = 0; b < at; b++) assert.ok(!cellsAt(b).has(c), `${c} before bar ${at}`);
  }
});
