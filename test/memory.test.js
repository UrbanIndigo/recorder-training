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
