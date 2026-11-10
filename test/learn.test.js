import test from 'node:test';
import assert from 'node:assert/strict';
import { nextCard, answer, mastery, deckCounts, typedMatches, choices, parseDeck, INTERVALS } from '../js/learn.js';
import { DECKS, deckCards, promptFor, customDeck } from '../js/decks.js';
import { MUSCLES, BONES, bodySvg, itemsInView, smoothPath } from '../js/anatomy.js';
import { seededRandom } from '../js/game/song.js';

const MIN = 60000;

test('spaced repetition: new cards a few at a time, misses come back soon, known cards wait', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const recs = {};
  let now = 0;
  const asked = [];
  for (let turn = 0; turn < 30; turn++) {
    const { id } = nextCard(ids, recs, now, turn);
    asked.push(id);
    answer(recs, id, id !== 'b' || recs.b?.seen >= 2, now, turn); // 'b' is missed twice, then learnt
    now += 5000;
  }
  assert.ok(ids.every((id) => asked.includes(id)), 'every card comes up');
  // 'b' comes back within a few cards after each miss.
  const bTurns = asked.map((x, i) => (x === 'b' ? i : -1)).filter((i) => i >= 0);
  assert.ok(bTurns.length >= 3);
  assert.ok(bTurns[1] - bTurns[0] <= 6);
  // A card answered right moves up and isn't due for a while.
  const r = answer({}, 'x', true, 0, 0);
  assert.equal(r.box, 1);
  assert.equal(r.due, INTERVALS[1] * MIN);
  const r2 = answer({ x: { ...r } }, 'x', false, 0, 1);
  assert.equal(r2.box, 0);
});

test('counts and mastery', () => {
  const recs = { a: { box: 4, due: Infinity, last: 0 }, b: { box: 0, due: 0, last: 0 }, c: { box: 2, due: 0, last: 0 } };
  assert.deepEqual(deckCounts(['a', 'b', 'c', 'd'], recs, 10), { due: 2, unseen: 1, total: 4 });
  assert.equal(mastery(['a', 'b', 'c', 'd'], recs), (4 + 0 + 2 + 0) / 16);
});

test('typed answers: forgiving of case, accents and small typos, strict on short words', () => {
  assert.ok(typedMatches('gastrocnemeus', ['Gastrocnemius']));
  assert.ok(typedMatches('LATS', ['Latissimus dorsi', 'lats']));
  assert.ok(typedMatches('brasilia', ['Brasília']));
  assert.ok(!typedMatches('Mu', ['Nu']));
  assert.ok(!typedMatches('femur', ['Tibia']));
  const opts = choices('Paris', ['Paris', 'Rome', 'Madrid', 'Berlin', 'Oslo'], 3, seededRandom(1));
  assert.equal(opts.length, 4);
  assert.ok(opts.includes('Paris') && new Set(opts).size === 4);
  assert.deepEqual(parseDeck('Largest planet = Jupiter\nRed planet: Mars\n\nnonsense\nH2O\twater'), [
    { q: 'Largest planet', a: 'Jupiter' }, { q: 'Red planet', a: 'Mars' }, { q: 'H2O', a: 'water' },
  ]);
});

test('anatomy data: every part is drawn, named once, and explained', () => {
  for (const list of [MUSCLES, BONES]) {
    const names = list.map((x) => x.name);
    assert.equal(new Set(names).size, names.length);
    assert.equal(new Set(list.map((x) => x.id)).size, list.length);
    for (const it of list) {
      assert.ok(it.fact && it.fact.length > 10, it.id);
      const views = ['front', 'back', 'skeleton'].filter((v) => it[v]);
      assert.ok(views.length, `${it.id} is drawn`);
      for (const v of views) for (const pts of it[v]) {
        assert.ok(pts.length >= 3);
        for (const [x, y] of pts) assert.ok(x >= 0 && x <= 200 && y >= 0 && y <= 444, `${it.id} inside the picture`);
      }
    }
  }
  for (const v of ['front', 'back', 'skeleton']) {
    const svg = bodySvg(v, { highlight: itemsInView(v)[0].id });
    assert.ok(svg.includes('an-hi'));
    assert.equal((svg.match(/data-id=/g) || []).length, itemsInView(v).length);
  }
  assert.ok(smoothPath([[0, 0], [10, 0], [10, 10]]).startsWith('M0 0C'));
});

test('decks: cards for every mode and direction, with sensible prompts', () => {
  const muscles = DECKS.find((x) => x.id === 'muscles');
  const cards = deckCards(muscles);
  // Trapezius and deltoid are drawn front and back: asked in both views.
  assert.ok(cards.some((c) => c.id === 'trapezius:name:front') && cards.some((c) => c.id === 'trapezius:name:back'));
  assert.ok(cards.findIndex((c) => c.mode === 'find') > cards.findIndex((c) => c.mode === 'name'), 'names first');
  const caps = DECKS.find((x) => x.id === 'capitals');
  const cc = deckCards(caps);
  assert.equal(cc.length, caps.cards.length * 2);
  assert.equal(promptFor(caps, cc[0]), 'Capital of France?');
  assert.equal(promptFor(caps, cc.find((c) => c.dir === 1)), 'Paris is the capital of…');
  const els = DECKS.find((x) => x.id === 'elements');
  assert.equal(promptFor(els, deckCards(els).find((c) => c.id === '25:r')), `Symbol for ${els.cards[25].a}?`);
  assert.equal(new Set(caps.cards.map((c) => c.q)).size, caps.cards.length);
  const mine = customDeck({ id: 'x', title: 'Planets', cards: [{ q: 'Red planet', a: 'Mars' }], reverse: false });
  assert.deepEqual(deckCards(mine).map((c) => [c.q, c.a]), [['Red planet', 'Mars']]);
});

test('hints reveal more of the answer each time', async () => {
  const { hintText } = await import('../js/learn.js');
  assert.equal(hintText('Latissimus dorsi', 1), 'L_________ d____');
  assert.equal(hintText('Latissimus dorsi', 2), 'Latis_____ dor__');
  assert.equal(hintText('Latissimus dorsi', 3), 'Latissimu_ dors_');
  assert.equal(hintText('Phalanges (fingers)', 1), 'P________ (f______)');
  assert.equal(hintText('Brasília', 1), 'B_______');
});
