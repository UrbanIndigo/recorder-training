// A small flashcard engine with spaced repetition, for learning anything:
// cards move up through boxes when you get them right (coming back after
// longer and longer gaps) and drop to the start when you miss them (coming
// back a few cards later). No DOM code, so it can be unit tested.

/** How long until a card in each box is due again, in minutes. */
export const INTERVALS = [0, 10, 60 * 24, 60 * 24 * 3, 60 * 24 * 7, 60 * 24 * 21];
export const MAX_BOX = INTERVALS.length - 1;
const MIN = 60 * 1000;
const NEW_AT_ONCE = 4; // how many new or missed cards to juggle before adding more
const GAP = 3; // a missed card comes back after this many others

/** A fresh record for one card. */
const fresh = () => ({ box: 0, due: 0, seen: 0, right: 0, wrong: 0, last: -99 });

/**
 * The next card to ask, from a deck's cards (ids) and their records:
 * 1. missed or new cards being learnt, once a few others have gone by;
 * 2. cards that are due for review, most overdue first;
 * 3. a new card, if not too many are being learnt at once;
 * 4. otherwise (all caught up) the weakest card, so you can keep going.
 * @param {string[]} ids card ids in deck order
 * @param {Record<string, object>} records card id -> record
 * @param {number} turn how many cards have been asked so far this session
 */
export function nextCard(ids, records, now = Date.now(), turn = 0, random = Math.random) {
  const rec = (id) => records[id];
  const learning = ids.filter((id) => rec(id) && rec(id).box === 0);
  const ready = learning.filter((id) => turn - rec(id).last > GAP).sort((a, b) => rec(a).last - rec(b).last);
  if (ready.length) return { id: ready[0], why: 'learning' };
  const due = ids
    .filter((id) => rec(id) && rec(id).box > 0 && rec(id).due <= now && turn - rec(id).last > 1)
    .sort((a, b) => rec(a).due - rec(b).due);
  if (due.length) return { id: due[0], why: 'review' };
  const unseen = ids.filter((id) => !rec(id));
  if (unseen.length && learning.length < NEW_AT_ONCE) return { id: unseen[0], why: 'new' };
  if (learning.length) {
    // Waiting on the gap: take the one seen longest ago.
    const wait = [...learning].sort((a, b) => rec(a).last - rec(b).last)[0];
    if (turn - rec(wait).last > 1) return { id: wait, why: 'learning' };
  }
  if (unseen.length) return { id: unseen[0], why: 'new' };
  // Everything is learnt and nothing is due: practise the weakest.
  const pool = ids.filter((id) => turn - rec(id).last > 1);
  if (!pool.length) return { id: ids[Math.floor(random() * ids.length)], why: 'extra' };
  const score = (id) => rec(id).box + (rec(id).right - rec(id).wrong * 2) / 10 + random() * 0.5;
  pool.sort((a, b) => score(a) - score(b));
  return { id: pool[0], why: 'extra' };
}

/** Record an answer: right moves the card up a box (due later), wrong sends it back to the start. */
export function answer(records, id, right, now = Date.now(), turn = 0) {
  const r = (records[id] ||= fresh());
  r.seen++;
  r.last = turn;
  if (right) {
    r.right++;
    r.box = Math.min(MAX_BOX, r.box + 1);
  } else {
    r.wrong++;
    r.box = 0;
  }
  r.due = now + INTERVALS[r.box] * MIN;
  return r;
}

/** How well a deck is known, 0..1 (box 4 or more counts as known). */
export function mastery(ids, records) {
  if (!ids.length) return 0;
  return ids.reduce((a, id) => a + Math.min(4, records[id]?.box || 0), 0) / (ids.length * 4);
}

/** How many cards are due now, and how many haven't been seen yet. */
export function deckCounts(ids, records, now = Date.now()) {
  let due = 0;
  let unseen = 0;
  for (const id of ids) {
    const r = records[id];
    if (!r) unseen++;
    else if (r.box === 0 || r.due <= now) due++;
  }
  return { due, unseen, total: ids.length };
}

// --------------------------------------------------------------- answers

const norm = (s) =>
  String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9α-ω ]+/g, ' ').replace(/\s+/g, ' ').trim();

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
    }
  }
  return dp[a.length][b.length];
}

/**
 * Whether a typed answer is right: ignores case, accents and punctuation,
 * forgives small typos (more for longer words), and accepts any of the
 * given alternatives (e.g. "quads" for quadriceps).
 */
export function typedMatches(typed, answers) {
  const t = norm(typed);
  if (!t) return false;
  return answers.some((a) => {
    const n = norm(a);
    if (n === t) return true;
    const allowed = n.length <= 3 ? 0 : n.length <= 6 ? 1 : 2;
    return editDistance(n, t) <= allowed;
  });
}

/** Up to `n` wrong options to go with the right one, shuffled in. */
export function choices(right, pool, n = 3, random = Math.random) {
  const others = [...new Set(pool.filter((x) => x !== right))];
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const opts = [right, ...others.slice(0, n)];
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  return opts;
}

/** Your own deck from pasted lines: "front = back" (or a tab, " - ", or ":" between them). */
export function parseDeck(text) {
  const cards = [];
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^(.+?)\s*(?:=|\t| - |: )\s*(.+)$/.exec(line.trim());
    if (m) cards.push({ q: m[1].trim(), a: m[2].trim() });
  }
  return cards;
}
