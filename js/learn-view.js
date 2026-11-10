// The Learn screen: decks of things to learn (anatomy with a body diagram,
// capitals, elements, the Greek alphabet, and your own), studied with
// spaced repetition. Anatomy decks also have an Explore mode: tap any part
// of the body to read what it is.

import { nextCard, answer, mastery, deckCounts, typedMatches, choices, parseDeck } from './learn.js?v=3.8';
import { DECKS, customDeck, deckCards, promptFor } from './decks.js?v=3.8';
import { bodySvg, itemsInView, viewsOf } from './anatomy.js?v=3.8';

const today = () => new Date().toISOString().slice(0, 10);

export function initLearnView(d) {
  const { $, state } = d;
  state.learn ||= {};
  const L = state.learn;
  L.records ||= {};
  L.custom ||= [];
  L.days ||= {};
  L.answerBy ||= 'choices';
  const save = () => d.save();
  const allDecks = () => [...DECKS, ...L.custom.map(customDeck)];
  let study = null; // the deck being studied
  let active = false;

  function show(panel) {
    for (const p of ['decks', 'study', 'explore', 'make']) $(`ln-${p}`).hidden = p !== panel;
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------- deck list

  function renderDecks() {
    show('decks');
    study = null;
    const groups = {};
    for (const deck of allDecks()) (groups[deck.group] ||= []).push(deck);
    const box = $('ln-deck-list');
    box.replaceChildren();
    for (const [group, decks] of Object.entries(groups)) {
      const h = document.createElement('h3');
      h.textContent = group;
      box.append(h);
      const grid = document.createElement('div');
      grid.className = 'ln-grid';
      for (const deck of decks) {
        const ids = deckCards(deck).map((c) => c.id);
        const recs = L.records[deck.id] || {};
        const m = mastery(ids, recs);
        const c = deckCounts(ids, recs);
        const card = document.createElement('div');
        card.className = 'ln-deck';
        card.innerHTML = `<button class="ln-deck-main"><span class="ln-icon">${deck.icon}</span><span class="ln-deck-text"><b></b><small></small></span></button>
          <div class="ln-meter"><span style="width:${Math.round(m * 100)}%"></span></div>
          <div class="ln-deck-foot"><span>${Math.round(m * 100)}% learnt · ${c.due ? `<b>${c.due} due</b> · ` : ''}${c.unseen} new</span></div>`;
        card.querySelector('b').textContent = deck.title;
        card.querySelector('small').textContent = deck.blurb;
        card.querySelector('.ln-deck-main').addEventListener('click', () => startDeck(deck));
        const foot = card.querySelector('.ln-deck-foot');
        if (deck.items && deck.modes.includes('name')) {
          const ex = document.createElement('button');
          ex.className = 'btn small secondary';
          ex.textContent = '🔍 Explore';
          ex.addEventListener('click', () => explore(deck));
          foot.append(ex);
        }
        if (deck.custom) {
          const del = document.createElement('button');
          del.className = 'btn small secondary';
          del.textContent = 'Delete';
          del.addEventListener('click', () => {
            if (!confirm(`Delete "${deck.title}"?`)) return;
            L.custom = L.custom.filter((x) => x.id !== deck.id);
            delete L.records[deck.id];
            save();
            renderDecks();
          });
          foot.append(del);
        }
        grid.append(card);
      }
      box.append(grid);
    }
    const n = L.days[today()] || 0;
    $('ln-today').textContent = n ? `${n} card${n === 1 ? '' : 's'} today · ${streak()} day streak` : 'Pick a deck to start. A few minutes a day works best.';
    $('ln-answer-by').value = L.answerBy;
  }

  function streak() {
    const day = new Date();
    if (!L.days[today()]) day.setUTCDate(day.getUTCDate() - 1);
    let n = 0;
    while (L.days[day.toISOString().slice(0, 10)]) {
      n++;
      day.setUTCDate(day.getUTCDate() - 1);
    }
    return n;
  }

  $('ln-answer-by').addEventListener('change', (e) => {
    L.answerBy = e.target.value;
    save();
  });

  // -------------------------------------------------------------- study

  function startDeck(deck) {
    const cards = deckCards(deck);
    study = { deck, cards, byId: Object.fromEntries(cards.map((c) => [c.id, c])), turn: 0, right: 0, wrong: 0, card: null, done: false };
    $('ln-study-title').textContent = `${deck.icon} ${deck.title}`;
    show('study');
    ask();
  }

  function ask() {
    const s = study;
    const recs = (L.records[s.deck.id] ||= {});
    const ids = s.cards.map((c) => c.id);
    const { id, why } = nextCard(ids, recs, Date.now(), s.turn);
    const card = s.byId[id];
    s.card = card;
    s.done = false;
    s.why = why;
    const c = deckCounts(ids, recs);
    $('ln-progress').textContent = `${Math.round(mastery(ids, recs) * 100)}% learnt · ${c.due} due · ${c.unseen} new${s.turn ? ` · this session ${s.right}/${s.turn}` : ''}`;
    $('ln-why').textContent = { new: 'New', learning: 'Learning', review: 'Review', extra: 'Extra practice' }[why];
    $('ln-why').className = `ln-why ${why}`;
    $('ln-feedback').innerHTML = '';
    $('ln-feedback').className = 'ln-feedback';
    $('ln-next').hidden = true;
    $('ln-dont-know').hidden = false;
    $('ln-type-row').hidden = true;
    $('ln-choices').replaceChildren();
    $('ln-diagram').innerHTML = '';
    $('ln-diagram').hidden = true;

    const it = card.item;
    if (card.mode === 'name') {
      $('ln-question').textContent = `What is this ${s.deck.id === 'bones' ? 'bone' : 'muscle'}?`;
      $('ln-sub').textContent = `${viewLabel(card.view)} view`;
      drawDiagram(card.view, { highlight: it.id });
      offerAnswers(it.name, itemsInView(card.view).map((x) => x.name), [it.name, ...(it.aka || [])]);
    } else if (card.mode === 'find') {
      $('ln-question').textContent = `Tap the ${it.name}`;
      $('ln-sub').textContent = `${viewLabel(card.view)} view`;
      drawDiagram(card.view, {}, true);
    } else if (card.mode === 'job') {
      $('ln-question').textContent = 'Which muscle does this?';
      $('ln-sub').textContent = it.fact;
      offerAnswers(it.name, s.deck.items.map((x) => x.name), [it.name, ...(it.aka || [])]);
    } else {
      $('ln-question').textContent = promptFor(s.deck, card);
      $('ln-sub').textContent = '';
      const pool = s.cards.filter((x) => x.dir === card.dir).map((x) => x.a);
      offerAnswers(card.a, pool, [card.a]);
    }
  }

  const viewLabel = (v) => ({ front: 'Front', back: 'Back', skeleton: 'Skeleton' })[v];

  function drawDiagram(view, opts, tappable = false) {
    const box = $('ln-diagram');
    box.hidden = false;
    box.innerHTML = bodySvg(view, opts);
    box.classList.toggle('tappable', tappable);
    if (tappable) {
      box.querySelector('svg').addEventListener('click', (e) => {
        const g = e.target.closest('[data-id]');
        if (g) checkFind(g.dataset.id);
      });
    }
  }

  /** Multiple choice or typing, as set. */
  function offerAnswers(right, pool, accepted) {
    study.accepted = accepted;
    study.rightText = right;
    if (L.answerBy === 'typing') {
      $('ln-type-row').hidden = false;
      $('ln-type').value = '';
      $('ln-type').focus({ preventScroll: true });
      return;
    }
    const opts = choices(right, pool, 3);
    $('ln-choices').replaceChildren(
      ...opts.map((o, i) => {
        const b = document.createElement('button');
        b.className = 'ln-choice';
        b.dataset.value = o;
        b.innerHTML = `<kbd>${i + 1}</kbd> `;
        b.append(o);
        b.addEventListener('click', () => checkAnswer(o === right, o));
        return b;
      }),
    );
  }

  function checkAnswer(right, given) {
    const s = study;
    if (!s || s.done) return;
    s.done = true;
    for (const b of $('ln-choices').children) {
      if (b.dataset.value === s.rightText) b.classList.add('right');
      else if (b.dataset.value === given) b.classList.add('wrong');
      b.disabled = true;
    }
    if (s.card.item && s.card.view) drawDiagram(s.card.view, { highlight: s.card.item.id, marks: { [s.card.item.id]: 'right' } });
    finish(right, given);
  }

  function checkFind(id) {
    const s = study;
    if (!s || s.done || s.card.mode !== 'find') return;
    s.done = true;
    const right = id === s.card.item.id;
    const marks = { [s.card.item.id]: 'right' };
    if (!right) marks[id] = 'wrong';
    drawDiagram(s.card.view, { marks });
    const tapped = itemsInView(s.card.view).find((x) => x.id === id);
    finish(right, tapped?.name);
  }

  function finish(right, given) {
    const s = study;
    answer((L.records[s.deck.id] ||= {}), s.card.id, right, Date.now(), s.turn);
    s.turn++;
    if (right) s.right++;
    else s.wrong++;
    L.days[today()] = (L.days[today()] || 0) + 1;
    save();
    const card = s.card;
    const name = card.item ? card.item.name : card.a;
    const fact = card.item ? card.item.fact : card.note || '';
    const fb = $('ln-feedback');
    fb.className = `ln-feedback ${right ? 'good' : 'bad'}`;
    fb.innerHTML = `<div class="ln-verdict"></div>${fact ? '<div class="ln-fact"></div>' : ''}`;
    fb.querySelector('.ln-verdict').textContent = right ? `✓ ${name}` : `✗ It's ${name}${given ? ` (not ${given})` : ''}`;
    if (fact) fb.querySelector('.ln-fact').textContent = card.mode === 'job' ? `${name}: ${fact}` : fact;
    $('ln-type-row').hidden = true;
    $('ln-dont-know').hidden = true;
    $('ln-next').hidden = false;
    $('ln-next').focus({ preventScroll: true });
  }

  $('ln-type-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = $('ln-type').value;
    if (!t.trim()) return;
    checkAnswer(typedMatches(t, study.accepted), t.trim());
  });
  $('ln-next').addEventListener('click', ask);
  $('ln-back').addEventListener('click', renderDecks);
  $('ln-dont-know').addEventListener('click', () => {
    if (study && !study.done) {
      if (study.card.mode === 'find') checkFind(null);
      else checkAnswer(false, null);
    }
  });

  // ------------------------------------------------------------ explore

  let exploreDeck = null;
  function explore(deck) {
    exploreDeck = deck;
    show('explore');
    $('ln-explore-title').textContent = `🔍 ${deck.title}`;
    const views = [...new Set(deck.items.flatMap(viewsOf))];
    $('ln-explore-views').replaceChildren(
      ...views.map((v, i) => {
        const b = document.createElement('button');
        b.className = 'tab';
        b.textContent = viewLabel(v);
        b.setAttribute('aria-selected', String(i === 0));
        b.addEventListener('click', () => {
          for (const x of $('ln-explore-views').children) x.setAttribute('aria-selected', String(x === b));
          drawExplore(v);
        });
        return b;
      }),
    );
    drawExplore(views[0]);
  }
  function drawExplore(view, picked = null) {
    const box = $('ln-explore-diagram');
    box.innerHTML = bodySvg(view, { highlight: picked });
    box.querySelector('svg').addEventListener('click', (e) => {
      const g = e.target.closest('[data-id]');
      if (!g) return;
      const it = itemsInView(view).find((x) => x.id === g.dataset.id);
      drawExplore(view, it.id);
      $('ln-explore-info').innerHTML = '<b></b><p></p>';
      $('ln-explore-info').querySelector('b').textContent = it.name + (it.aka?.length ? ` (${it.aka.slice(0, 2).join(', ')})` : '');
      $('ln-explore-info').querySelector('p').textContent = it.fact;
    });
    if (!picked) $('ln-explore-info').textContent = 'Tap any part of the body to see what it is and what it does.';
  }
  $('ln-explore-back').addEventListener('click', renderDecks);
  $('ln-explore-study').addEventListener('click', () => exploreDeck && startDeck(exploreDeck));

  // ---------------------------------------------------------- your decks

  $('ln-make-open').addEventListener('click', () => {
    show('make');
    $('ln-make-title').value = '';
    $('ln-make-text').value = '';
    $('ln-make-count').textContent = '';
  });
  $('ln-make-text').addEventListener('input', (e) => {
    const n = parseDeck(e.target.value).length;
    $('ln-make-count').textContent = n ? `${n} card${n === 1 ? '' : 's'}` : '';
  });
  $('ln-make-cancel').addEventListener('click', renderDecks);
  $('ln-make-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const cards = parseDeck($('ln-make-text').value);
    if (!cards.length) {
      $('ln-make-count').textContent = 'No cards found: put one per line, like "Largest planet = Jupiter".';
      return;
    }
    L.custom.push({ id: `custom-${Date.now()}`, title: $('ln-make-title').value.trim() || 'My deck', cards, reverse: $('ln-make-reverse').checked });
    save();
    renderDecks();
  });

  // ----------------------------------------------------------- keyboard

  document.addEventListener('keydown', (e) => {
    if (!active || !study || $('ln-study').hidden || e.metaKey || e.ctrlKey) return;
    if (e.target.closest?.('input, textarea, select, button')) return; // a focused button handles Enter itself
    if (!study.done && /^[1-4]$/.test(e.key)) {
      $('ln-choices').children[Number(e.key) - 1]?.click();
      e.preventDefault();
    } else if (study.done && e.key === 'Enter') {
      ask();
      e.preventDefault();
    }
  });

  return {
    enter() {
      active = true;
      renderDecks();
    },
    leave() {
      active = false;
    },
  };
}
