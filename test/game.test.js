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
