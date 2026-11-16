import test from 'node:test';
import assert from 'node:assert/strict';
import { newMemory, recordRound, readingTime } from '../js/memory.js';

test('two passes in a row make the rhythms harder; the bars stay as chosen', () => {
  const m = { ...newMemory(), bars: 3 };
  assert.equal(recordRound(m, 90, 13), null);
  assert.equal(recordRound(m, 85, 13), 'harder');
  assert.deepEqual([m.level, m.bars], [2, 3]);
  // A middling score breaks the run of passes.
  recordRound(m, 90, 13);
  recordRound(m, 70, 13);
  assert.equal(recordRound(m, 90, 13), null);
  assert.equal(recordRound(m, 90, 13), 'harder');
  assert.deepEqual([m.level, m.bars], [3, 3]);
  assert.equal(m.best['1x3'], 90);
  // Can't go past the top level.
  const top = { ...newMemory(), level: 13 };
  recordRound(top, 99, 13);
  assert.equal(recordRound(top, 99, 13), null);
  assert.equal(top.level, 13);
});

test('two fails in a row make the rhythms easier; never below level 1; bars untouched', () => {
  const m = { ...newMemory(), level: 3, bars: 2 };
  recordRound(m, 40, 13);
  assert.equal(recordRound(m, 50, 13), 'easier');
  assert.deepEqual([m.level, m.bars], [2, 2]);
  const low = newMemory();
  recordRound(low, 10, 13);
  assert.equal(recordRound(low, 10, 13), null);
  assert.deepEqual([low.level, low.bars], [1, 1]);
});

test('reading time', () => {
  assert.equal(readingTime('free', 3), null);
  assert.equal(readingTime('4', 3), 12);
});

test('time signature: sticks to the one chosen; levels without it are skipped', async () => {
  const { memoryExercise, stepLevel, levelFits } = await import('../js/memory.js');
  const { meterOf, LEVELS } = await import('../js/rhythm.js');
  const { seededRandom } = await import('../js/game/song.js');
  const r = seededRandom(5);
  for (const lvl of LEVELS) {
    for (let i = 0; i < 5; i++) {
      const ex = memoryExercise({ level: lvl.id, meter: '4/4', pitches: [71], bars: 2, random: r });
      assert.equal(meterOf(ex).id, '4/4', `level ${lvl.id}`);
      assert.equal(ex.bars, 2);
    }
  }
  assert.equal(meterOf(memoryExercise({ level: 3, meter: '6/8', pitches: [71], bars: 1, random: r })).id, '6/8');
  assert.ok(!levelFits(10, '4/4') && levelFits(10, '6/8') && levelFits(10, 'mixed'));
  assert.equal(stepLevel(9, 1, '4/4'), 11); // 10 is 6/8 only
  assert.equal(stepLevel(11, -1, '4/4'), 9);
  assert.equal(stepLevel(9, 1, 'mixed'), 10);
  assert.equal(stepLevel(13, 1, '4/4'), 13);
});

test('auto round timeline: see it, a hidden one-bar count-in, then play', async () => {
  const { roundTimeline } = await import('../js/memory.js');
  // A glance: half a second at the start of the count-in bar (2 s at 120 bpm).
  const g = roundTimeline('0.5', 1, 2, 10);
  assert.deepEqual([g.showEnd, g.countStart, g.playStart, g.playEnd, g.readBars], [10.5, 10, 12, 14, 0]);
  // As long as the music (2 bars): read 2 bars, count-in, play 2 bars.
  const x1 = roundTimeline('x1', 2, 2, 0);
  assert.deepEqual([x1.showEnd, x1.countStart, x1.playStart, x1.playEnd, x1.readBars], [4, 4, 6, 10, 2]);
  assert.equal(roundTimeline('x2', 1, 2, 0).playStart, 6);
  // A long "glance" still leaves part of the count-in with the music hidden.
  assert.ok(roundTimeline('2', 1, 2, 0).showEnd < 2);
});
