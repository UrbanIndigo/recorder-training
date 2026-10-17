import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTERS, CATEGORIES, CUES, pickCue, speedScore, varietyScore, meetsCue, pickPoints, summarise, matchMove, recallResult } from '../js/dance.js';
import { seededRandom } from '../js/game/song.js';

const moves = STARTERS.salsa;

test('starter moves are well formed', () => {
  for (const list of Object.values(STARTERS)) {
    for (const mv of list) {
      assert.ok(mv.name && CATEGORIES[mv.category], mv.name);
      assert.ok(mv.counts % 4 === 0);
    }
    assert.equal(new Set(list.map((x) => x.name)).size, list.length);
  }
});

test('speed: deciding early is best, late costs, frozen scores nothing', () => {
  assert.equal(speedScore(4), 1);
  assert.equal(speedScore(0), 0.5);
  assert.ok(speedScore(2) > speedScore(1));
  assert.equal(speedScore(-1), 0.25);
  assert.equal(speedScore(-3), 0);
});

test('variety: repeats score nothing, new moves best, basics now and then are fine', () => {
  assert.equal(varietyScore('Right turn', ['Basic', 'Right turn'], moves).score, 0);
  assert.equal(varietyScore('Copa', ['Basic', 'Right turn'], moves).score, 1);
  assert.equal(varietyScore('Basic', ['Right turn'], moves).score, 0.5);
  assert.ok(varietyScore('Side basic', ['Basic'], moves).score < 0.2);
  assert.equal(varietyScore('Right turn', ['Right turn', 'Copa', 'Basic'], moves).score, 0.35 + 0.1);
  assert.ok(varietyScore('Right turn', ['Right turn', 'Copa', 'Basic', 'Hammerlock', 'Enchufla'], moves).score >= 0.8);
});

test('cues fit the library and are checked', () => {
  const r = seededRandom(3);
  const onlyBasics = [{ name: 'Basic', category: 'basic', counts: 8 }];
  for (let i = 0; i < 50; i++) {
    const c = pickCue(onlyBasics, r);
    assert.ok(!c.categories, 'no category cue the library can’t answer');
  }
  const turnCue = CUES.find((c) => c.text === 'A turn');
  assert.ok(meetsCue(turnCue, 'Copa', [], moves));
  assert.ok(!meetsCue(turnCue, 'Basic', [], moves));
  const fresh = CUES.find((c) => c.fresh);
  assert.ok(meetsCue(fresh, 'Copa', ['Basic'], moves));
  assert.ok(!meetsCue(fresh, 'Basic', ['Basic'], moves));
  assert.equal(pickPoints({ speed: 1, variety: 1, cueMet: true }), 125);
});

test('session summary: variety, streaks, unused moves and a grade', () => {
  const picks = [
    { move: 'Basic', speed: 1, variety: 0.5, points: 75, early: 3 },
    { move: 'Right turn', speed: 1, variety: 1, points: 100, early: 4 },
    { move: 'Right turn', speed: 0.5, variety: 0, points: 25, early: 0 },
    { move: 'Basic', frozen: true, speed: 0, variety: 0, points: 0, early: -3 },
  ];
  const s = summarise(picks, moves);
  assert.equal(s.distinct, 2);
  assert.equal(s.repeats, 1);
  assert.equal(s.frozen, 1);
  assert.equal(s.bestStreak, 2);
  assert.ok(s.unused.includes('Copa') && !s.unused.includes('Basic'));
  assert.equal(s.grade, 'C'); // average 50
});

test('typed or spoken move names are matched forgivingly', () => {
  const forro = STARTERS.forro;
  assert.equal(matchMove('giro simples', forro).name, 'Giro simples');
  assert.equal(matchMove('Giro simpels', forro).name, 'Giro simples'); // typo
  assert.equal(matchMove('piao', forro).name, 'Pião'); // no accent
  assert.equal(matchMove('leader turn', forro).name, 'Giro do cavalheiro'); // English alias
  assert.equal(matchMove('cross body', moves).name, 'Cross-body lead');
  assert.equal(matchMove('hammer', moves).name, 'Hammerlock');
  assert.equal(matchMove('banana', moves), null);
  const r = recallResult(['copa', 'right turn', 'the worm'], moves);
  assert.deepEqual(r.remembered, ['Right turn', 'Copa']);
  assert.ok(r.forgotten.includes('Basic'));
  assert.deepEqual(r.unknown, ['the worm']);
});

test('spoken phrases with extra words still find the move', () => {
  assert.equal(matchMove('okay next giro simples', STARTERS.forro).name, 'Giro simples');
  assert.equal(matchMove('um the copa', moves).name, 'Copa');
});
