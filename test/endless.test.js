import test from 'node:test';
import assert from 'node:assert/strict';
import { LADDER, newSkill, unlocked, weightsFor, makeLine, lineResult, updateSkill, endRound, weakest, START_BPM } from '../js/game/endless.js';
import { seededRandom } from '../js/game/song.js';

// A simulated player who plays every rhythm up to `limit` on the ladder well, and the rest badly.
function play(skill, limit, lines, random) {
  for (let i = 0; i < lines; i++) {
    const bars = makeLine(skill, random);
    const notes = bars.flat().filter((e) => !e.rest && !e.tied).map((e) => ({ cell: e.cell, judged: LADDER.indexOf(e.cell) < limit ? 'perfect' : 'miss' }));
    updateSkill(skill, lineResult(notes));
  }
}

test('lines use only the rhythms in play, and fill their bars', () => {
  const skill = newSkill();
  skill.k = 9;
  const random = seededRandom(3);
  for (let i = 0; i < 30; i++) {
    for (const bar of makeLine(skill, random)) {
      assert.ok(Math.abs(bar.reduce((a, e) => a + e.beats, 0) - 4) < 1e-6);
      for (const e of bar) assert.ok(unlocked(skill).includes(e.cell), e.cell);
    }
  }
});

test('placement: a strong player jumps up fast, a beginner stays on the basics', () => {
  const pro = newSkill();
  play(pro, LADDER.length, 12, seededRandom(1));
  assert.equal(pro.assessing, false);
  assert.equal(Math.floor(pro.k), LADDER.length);
  const beginner = newSkill();
  play(beginner, 0, 6, seededRandom(2));
  assert.equal(beginner.assessing, false);
  assert.ok(beginner.k <= 3);
});

test('placement finds roughly where a player starts to struggle, then adapts', () => {
  const skill = newSkill();
  play(skill, 9, 6, seededRandom(4)); // fine up to the 9th rhythm
  assert.equal(skill.assessing, false);
  assert.ok(skill.k >= 6 && skill.k <= 11, `placed at ${skill.k}`);
  // Keeps trying harder rhythms, but backs off when they go badly.
  play(skill, 9, 40, seededRandom(5));
  assert.ok(skill.k >= 7 && skill.k <= 12, `settled at ${skill.k}`);
  // The rhythms it can't play are flagged and come up more.
  const weak = weakest(skill);
  assert.ok(weak.length && weak.every((c) => LADDER.indexOf(c) >= 9), weak.join());
  const w = weightsFor(skill);
  const weakOne = weak.find((c) => w[c] != null);
  if (weakOne) assert.ok(w[weakOne] > w.quarter);
});

test('new rhythms are announced and tempo follows the round', () => {
  const skill = newSkill();
  skill.assessing = false;
  const msgs = [];
  for (let i = 0; i < 2; i++) msgs.push(...updateSkill(skill, { acc: 0.9, perCell: {} }));
  assert.deepEqual(msgs.filter((m) => m.kind === 'new').map((m) => m.cell), ['quarterRest', 'eighths']); // one per clean line
  msgs.length = 0;
  for (let i = 0; i < 2; i++) msgs.push(...updateSkill(skill, { acc: 1, perCell: {} }));
  assert.equal(msgs.filter((m) => m.kind === 'new').length, 3); // near-perfect twice: skips ahead
  assert.equal(endRound(skill), 8);
  assert.equal(skill.bpm, START_BPM + 8);
  for (let i = 0; i < 3; i++) updateSkill(skill, { acc: 0.4, perCell: {} });
  assert.equal(endRound(skill), -6);
  assert.ok(lineResult([{ judged: 'perfect' }, { judged: 'miss' }], 2).acc < 0.5);
});

test('placement copes with lines written ahead of time', () => {
  // As in the game: lines are made about three lines before they're played.
  for (const limit of [4, 9, 14]) {
    const skill = newSkill();
    const random = seededRandom(limit);
    const queue = [];
    for (let i = 0; i < 40; i++) {
      queue.push(makeLine(skill, random, queue.length));
      if (queue.length < 3) continue;
      const bars = queue.shift();
      const notes = bars.flat().filter((e) => !e.rest && !e.tied).map((e) => ({ cell: e.cell, judged: LADDER.indexOf(e.cell) < limit ? 'perfect' : 'miss' }));
      updateSkill(skill, lineResult(notes));
    }
    assert.equal(skill.assessing, false);
    assert.ok(Math.abs(skill.k - limit) <= 3, `limit ${limit}: settled at ${skill.k}`);
  }
});

test('writing ahead: placement and clean streaks look ahead, a slip does not', async () => {
  const { writingLevel } = await import('../js/game/endless.js');
  const skill = newSkill();
  assert.equal(writingLevel(skill, 2), 8); // placement: 2 + 3 per waiting line
  skill.assessing = false;
  skill.k = 6;
  assert.equal(writingLevel(skill, 2), 6);
  updateSkill(skill, { acc: 0.95, perCell: {}, top: 5 });
  assert.equal(writingLevel(skill, 2), Math.floor(skill.k) + 1);
  updateSkill(skill, { acc: 0.3, perCell: {}, top: 5 });
  assert.equal(writingLevel(skill, 2), skill.k);
});
