import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEGREES, ORDER, LEVELS, levelSet, degreeLabel, degreeLongName, tonicFor, degreeMidi, pickKey, RECORDER_KEYS,
  newProgress, recordAnswer, degreeStats, weakest, pickDegree, streak, makeMelody, melodyLength, compareMelody,
  SONGS, INTERVAL_SONGS, fingeringFor,
} from '../js/ear.js';
import { RECORDERS } from '../js/recorders.js';
import { seededRandom } from '../js/game/song.js';

test('degree offsets and labels follow the spec', () => {
  assert.deepEqual(['1', '2', '3', '4', '5', '6', '7', "1'", 'b3', '#4', 'b6', 'b7'].map((d) => DEGREES[d]), [0, 2, 4, 5, 7, 9, 11, 12, 3, 6, 8, 10]);
  assert.deepEqual(['L5', 'L6', 'L7'].map((d) => DEGREES[d]), [-5, -3, -1]);
  assert.equal(ORDER.length, Object.keys(DEGREES).length);
  assert.deepEqual(['1', '5', "1'", 'L5', 'b3', '#4'].map((d) => degreeLabel(d)), ['do', 'so', "do'", 'so₁', 'me', 'fi']);
  assert.deepEqual(['1', 'b7', "1'", 'L6'].map((d) => degreeLabel(d, 'numbers')), ['1', '♭7', "1'", '6₁']);
  assert.equal(degreeLongName('L5'), 'low so');
});

test('levels grow as the spec lists', () => {
  assert.deepEqual(levelSet(1), ['1', '5']);
  assert.deepEqual(levelSet(4), ['1', '2', '3', '4', '5']);
  assert.ok(levelSet(6).includes("1'") && levelSet(6).length === 8);
  assert.ok(levelSet(7).includes('L5') && !levelSet(7).includes('b3'));
  assert.ok(['b3', '#4', 'b6', 'b7'].every((d) => levelSet(8).includes(d)));
  assert.equal(LEVELS.length, 8);
});

test('the tonic is placed so every degree fits the recorder', () => {
  const sop = RECORDERS.soprano;
  const range = { low: sop.lowest, high: sop.highest };
  for (const lvl of LEVELS) {
    for (const key of RECORDER_KEYS) {
      const t = tonicFor(key, lvl.set, range);
      for (const d of lvl.set) {
        const m = degreeMidi(t, d);
        assert.ok(m >= range.low && m <= range.high, `${key} level ${lvl.id}: ${d} = ${m}`);
      }
    }
  }
  assert.equal(tonicFor('C', levelSet(1), range), 72); // C5 when nothing goes below the tonic
  assert.equal(tonicFor('C', levelSet(7), range), 84); // up an octave once low degrees come in
  assert.equal(pickKey('G'), 'G');
  assert.ok(RECORDER_KEYS.includes(pickKey('random-recorder', seededRandom(2))));
});

test('answers are tracked per degree and key, weak degrees come up more, and levels advance at 90% of 20', () => {
  const pr = newProgress();
  const date = new Date('2026-10-16T10:00:00Z');
  for (let i = 0; i < 10; i++) recordAnswer(pr, { key: 'C', degree: '5', right: i % 2 === 0, ms: 1000, date });
  for (let i = 0; i < 8; i++) recordAnswer(pr, { key: 'C', degree: '1', right: true, ms: 500, date });
  const st = degreeStats(pr);
  assert.equal(st['5'].acc, 0.5);
  assert.equal(st['1'].avgMs, 500);
  assert.deepEqual(weakest(pr, ['1', '5']), ['5']);
  const random = seededRandom(9);
  const picks = Array.from({ length: 400 }, () => pickDegree(pr, ['1', '5'], random));
  assert.ok(picks.filter((d) => d === '5').length > 250, 'the weak degree is asked more');
  assert.equal(pr.level, 1);
  let up = false;
  for (let i = 0; i < 20 && !up; i++) up = recordAnswer(pr, { key: 'C', degree: '1', right: true, ms: 400, date }).levelUp;
  assert.ok(up);
  assert.equal(pr.level, 2);
  assert.equal(streak(pr, date), 1);
  pr.days['2026-10-15'] = 3;
  assert.equal(streak(pr, date), 2);
  // Never the same degree three times running.
  const last = ['5', '5'];
  for (let i = 0; i < 50; i++) assert.notEqual(pickDegree(pr, ['1', '5'], random, last), '5');
});

test('melodies use only the degrees in play, and are compared note by note', () => {
  const random = seededRandom(4);
  for (const lvl of LEVELS) {
    for (let i = 0; i < 30; i++) {
      const len = melodyLength(lvl.id, random);
      assert.ok(len >= 3 && len <= 8);
      const m = makeMelody(lvl.set, len, random);
      assert.equal(m.length, len);
      assert.ok(m.every((d) => lvl.set.includes(d)));
    }
  }
  assert.deepEqual(compareMelody(['1', '3', '2'], ['1', '2', '2']), [true, false, true]);
});

test('reference songs match the spec and fit a recorder', () => {
  const twinkle = SONGS.find((s) => s.id === 'twinkle');
  assert.deepEqual(twinkle.phrases[0].map((n) => n[1]), ['1', '1', '5', '5', '6', '6', '5']);
  assert.deepEqual(SONGS.find((s) => s.id === 'birthday').phrases[2].map((n) => n[1]), ['L5', 'L5', '5', '3', '1', 'L7', 'L6']);
  for (const song of SONGS) {
    assert.equal(song.phrases[0][0][1], song.starts, song.title);
    for (const ph of song.phrases) for (const [syl, deg, beats] of ph) assert.ok(syl && DEGREES[deg] != null && beats > 0, `${song.title}: ${syl} ${deg}`);
  }
  assert.equal(INTERVAL_SONGS.length, 12);
});

test('fingerings: baroque chart on C and F recorders', () => {
  assert.deepEqual(fingeringFor(RECORDERS.soprano, 72), [1, 1, 1, 1, 1, 1, 1, 1]); // low C: everything covered
  assert.deepEqual(fingeringFor(RECORDERS.soprano, 79), [1, 1, 1, 1, 0, 0, 0, 0]); // G: thumb + 1 2 3
  assert.deepEqual(fingeringFor(RECORDERS.alto, 65 + 7), fingeringFor(RECORDERS.soprano, 72 + 7)); // same pattern a fifth lower
  assert.equal(fingeringFor(RECORDERS.soprano, 71), null);
});
