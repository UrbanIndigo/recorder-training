import test from 'node:test';
import assert from 'node:assert/strict';
import { newMemory, recordRound, readingTime, MAX_BARS } from '../js/memory.js';

test('two passes in a row add a bar; after four bars the rhythms get harder', () => {
  const m = newMemory();
  assert.equal(recordRound(m, 90, 13), null);
  assert.equal(recordRound(m, 85, 13), 'more-bars');
  assert.equal(m.bars, 2);
  // A middling score breaks the run of passes.
  recordRound(m, 90, 13);
  recordRound(m, 70, 13);
  assert.equal(recordRound(m, 90, 13), null);
  assert.equal(recordRound(m, 90, 13), 'more-bars');
  while (m.bars < MAX_BARS) { recordRound(m, 95, 13); recordRound(m, 95, 13); }
  recordRound(m, 95, 13);
  assert.equal(recordRound(m, 95, 13), 'harder');
  assert.deepEqual([m.level, m.bars], [2, 1]);
  assert.equal(m.best['1x4'], 95);
});

test('two fails in a row ease off; never below level 1, one bar', () => {
  const m = newMemory();
  m.bars = 3;
  recordRound(m, 40, 13);
  assert.equal(recordRound(m, 50, 13), 'fewer-bars');
  assert.equal(m.bars, 2);
  const low = newMemory();
  recordRound(low, 10, 13);
  assert.equal(recordRound(low, 10, 13), null);
  assert.deepEqual([low.level, low.bars], [1, 1]);
  const lvl3 = { ...newMemory(), level: 3 };
  recordRound(lvl3, 20, 13);
  assert.equal(recordRound(lvl3, 20, 13), 'easier');
  assert.deepEqual([lvl3.level, lvl3.bars], [2, 2]);
  // Can't go past the top level.
  const top = { ...newMemory(), level: 13, bars: 4 };
  recordRound(top, 99, 13);
  assert.equal(recordRound(top, 99, 13), null);
  assert.equal(top.level, 13);
});

test('reading time', () => {
  assert.equal(readingTime('free', 3), null);
  assert.equal(readingTime('4', 3), 12);
});
