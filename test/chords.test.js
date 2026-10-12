import test from 'node:test';
import assert from 'node:assert/strict';
import { makeChord, spellChord, voicing, checkChord, CHORD_TYPES, inversionsOf, nextChord, recordChord, newChordStats, ALL_ROOTS } from '../js/chords.js';

const names = (rootPc, type) => spellChord(rootPc, type).map((t) => t.name).join(' ');

test('chords are spelled properly', () => {
  assert.equal(names(7, 'major'), 'G B D');
  assert.equal(names(3, 'minor'), 'E♭ G♭ B♭');
  assert.equal(names(1, 'minor'), 'C♯ E G♯');
  assert.equal(names(8, 'dim'), 'G♯ B D');
  assert.equal(names(6, 'aug'), 'G♭ B♭ D');
  assert.equal(names(7, 'sus2'), 'G A D');
  assert.equal(names(7, 'sus4'), 'G C D');
  assert.equal(names(7, 'dom7'), 'G B D F');
  assert.equal(names(5, 'maj7'), 'F A C E');
  assert.equal(names(11, 'halfdim'), 'B D F A');
  assert.equal(names(1, 'dim7'), 'C♯ E G B♭');
  assert.equal(names(0, 'add9'), 'C E G D');
  assert.equal(names(2, 'min9'), 'D F A C E');
  assert.equal(names(10, 'six'), 'B♭ D F G');
});

test('inversions put the right note in the bass', () => {
  const g1 = makeChord(7, 'major', 1);
  assert.equal(g1.symbol, 'G/B');
  assert.equal(g1.inversionName, '1st inversion');
  const g2 = makeChord(7, 'major', 2);
  assert.equal(g2.symbol, 'G/D');
  assert.deepEqual(voicing(g2), [50, 55, 59]); // D3 G3 B3
  assert.deepEqual(voicing(makeChord(7, 'dom7', 3)), [53, 55, 59, 62]); // F3 G3 B3 D4
  for (const type of Object.keys(CHORD_TYPES)) {
    for (let inv = 0; inv < inversionsOf(type); inv++) {
      const c = makeChord(0, type, inv);
      const v = voicing(c);
      assert.equal(v[0] % 12, c.bass.pc, `${type} ${inv}`);
      assert.ok(v.every((m, i) => i === 0 || m > v[i - 1]));
      assert.equal(checkChord(c, v).correct, true, `${c.symbol} voicing should check as correct`);
    }
  }
});

test('checking says what is wrong', () => {
  const g1 = makeChord(7, 'major', 1); // G/B
  assert.equal(checkChord(g1, [59, 62, 67]).correct, true); // B D G
  assert.equal(checkChord(g1, [47, 59, 62, 67, 71]).correct, true); // doubled, spread out
  const rootPos = checkChord(g1, [55, 59, 62]); // G B D: root position
  assert.equal(rootPos.correct, false);
  assert.match(rootPos.message, /wrong inversion/);
  assert.match(rootPos.message, /root position/);
  const missing = checkChord(g1, [59, 67]);
  assert.match(missing.message, /missing D/);
  const extra = checkChord(g1, [59, 62, 65, 67]);
  assert.match(extra.message, /F/);
  assert.equal(checkChord(g1, [59, 62, 65, 67], { allowExtra: 1 }).correct, true);
  // The 5th of a 9 chord may be left out.
  assert.equal(checkChord(makeChord(7, 'dom9', 0), [43, 59, 65, 69]).correct, true); // G B F A
});

test('missed chords come back two chords later; weak ones come up more', () => {
  const stats = newChordStats();
  const queue = [];
  const settings = { types: ['major', 'minor'], inversions: [0, 1, 2], roots: ALL_ROOTS };
  const first = nextChord(stats, settings, queue, null);
  recordChord(stats, queue, first, false, 4000);
  const a = nextChord(stats, settings, queue, first);
  recordChord(stats, queue, a, true, 2000);
  const b = nextChord(stats, settings, queue, a);
  recordChord(stats, queue, b, true, 2000);
  const again = nextChord(stats, settings, queue, b);
  assert.equal(again.symbol, first.symbol);
  assert.equal(again.again, true);
  // Only offered inversions that exist: a triad has no 3rd inversion.
  const s2 = { types: ['major'], inversions: [3], roots: [0] };
  assert.equal(nextChord(newChordStats(), s2, [], null).type, 'major');
});
