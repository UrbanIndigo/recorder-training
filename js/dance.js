// Dance improv training: practise thinking of your next partner-dance move
// on the beat, with variety. Move libraries (your own, plus starter lists
// for forró and salsa), cues, scoring for speed and variety, free-recall
// matching. No DOM or audio code, so it can be unit tested.

/** Kinds of move, so cues can ask for one and variety can reward changing kind. */
export const CATEGORIES = {
  basic: 'Basic step',
  turn: 'Partner turn',
  leaderTurn: 'Leader turn',
  position: 'Position change',
  travel: 'Travelling',
  pause: 'Pause / stop',
  styling: 'Styling / footwork',
  combo: 'Combo / pattern',
};

/** Dance styles: the groove, tempo and how counts are grouped. */
export const STYLES = {
  forro: { id: 'forro', name: 'Forró', bpm: 100, minBpm: 70, maxBpm: 140, beatsPerBar: 2, note: 'Baião groove: zabumba and triangle. Counted in 8s (four bars of 2/4).' },
  salsa: { id: 'salsa', name: 'Salsa', bpm: 180, minBpm: 140, maxBpm: 220, beatsPerBar: 4, note: 'Son clave (2-3), cowbell, congas and bass. Counted 1–8 over two bars.' },
};

const m = (name, category, counts = 8, alias = '') => ({ name, category, counts, alias });

/**
 * Starter moves. Names vary between teachers and scenes: rename them to
 * what you were taught, and add your own.
 */
export const STARTERS = {
  forro: [
    m('Base (dois pra lá, dois pra cá)', 'basic', 8, 'basic side to side'),
    m('Frente e trás', 'basic', 8, 'forward and back basic'),
    m('Caminhada', 'travel', 8, 'walk travel'),
    m('Giro simples', 'turn', 8, 'simple turn follower turn'),
    m('Giro do cavalheiro', 'leaderTurn', 8, 'leader turn'),
    m('Giro duplo', 'turn', 8, 'double turn'),
    m('Pião', 'turn', 8, 'spin together couple turn'),
    m('Abertura', 'position', 8, 'opening open position'),
    m('Volta ao fechado', 'position', 4, 'back to closed close'),
    m('Trava', 'pause', 4, 'block stop check'),
    m('Balanço', 'styling', 8, 'sway rock'),
    m('Sacada', 'styling', 8, 'displacement'),
  ],
  salsa: [
    m('Basic', 'basic', 8),
    m('Side basic', 'basic', 8),
    m('Cross-body lead', 'position', 8, 'cbl cross body'),
    m('Right turn', 'turn', 8, 'outside turn'),
    m('Left turn', 'turn', 8, 'inside turn'),
    m('Cross-body lead with inside turn', 'combo', 8, 'cbl inside turn'),
    m('Copa', 'turn', 8),
    m('Hammerlock', 'combo', 16),
    m('Leader spot turn', 'leaderTurn', 8, 'leader turn'),
    m('Hand change behind the back', 'combo', 8, 'hand change'),
    m('Dile que no', 'position', 8, 'dile que no'),
    m('Enchufla', 'turn', 8),
    m('Sombrero', 'combo', 16),
    m('Open break', 'pause', 4, 'break'),
    m('Shines (Suzie Q)', 'styling', 8, 'shine suzie q footwork'),
  ],
};

/**
 * Cues: some ask for a kind of move (checked), some add a twist to whatever
 * you choose (up to you, but they double your options).
 */
export const CUES = [
  { text: 'A turn', categories: ['turn', 'leaderTurn'] },
  { text: 'Change position', categories: ['position'] },
  { text: 'Travel', categories: ['travel'] },
  { text: 'A pause', categories: ['pause'] },
  { text: 'Styling or footwork', categories: ['styling'] },
  { text: 'A combo', categories: ['combo'] },
  { text: 'Something you haven’t done yet', fresh: true },
  { text: 'Twist: the other direction', twist: true },
  { text: 'Twist: the other hand', twist: true },
  { text: 'Twist: add a pause in the middle', twist: true },
  { text: 'Twist: half time (slow it right down)', twist: true },
  { text: 'Twist: travel while you do it', twist: true },
];

/** A cue that can actually be answered with this library (and isn't the same as last time). */
export function pickCue(moves, random = Math.random, last = null) {
  const have = new Set(moves.map((x) => x.category));
  const ok = CUES.filter((c) => c !== last && (!c.categories || c.categories.some((k) => have.has(k))));
  return ok[Math.floor(random() * ok.length)] || null;
}

// --------------------------------------------------------------- scoring

/**
 * How quickly you chose, 0..1. `early`: beats before the move had to start
 * (the window opens `window` beats before); negative means late.
 */
export function speedScore(early, window = 4, grace = 2) {
  if (early >= 0) return 0.5 + 0.5 * Math.min(1, early / window);
  if (-early <= grace) return 0.5 * (1 - -early / grace);
  return 0;
}

/**
 * How varied a pick is, given what came before (move names, most recent
 * last), 0..1. Repeating the last move scores nothing; a recent one a
 * little; going back to a basic is fine now and then; a move not yet used
 * this session scores best; changing kind of move adds a bit.
 */
export function varietyScore(pick, recent, moves) {
  const byName = Object.fromEntries(moves.map((x) => [x.name, x]));
  const cat = byName[pick]?.category;
  const prev = recent.at(-1);
  if (pick === prev) return { score: 0, reason: 'same as last' };
  let score;
  let reason;
  if (cat === 'basic') {
    score = byName[prev]?.category === 'basic' ? 0.1 : 0.5;
    reason = 'back to basic';
  } else if (recent.slice(-3).includes(pick)) {
    score = 0.35;
    reason = 'used just now';
  } else if (!recent.includes(pick)) {
    score = 1;
    reason = 'new this session';
  } else {
    score = 0.8;
    reason = 'good change';
  }
  if (prev && byName[prev] && byName[prev].category !== cat && cat !== 'basic') score = Math.min(1, score + 0.1);
  return { score, reason };
}

/** Whether a pick answers a cue (twists always count; they're up to you). */
export function meetsCue(cue, pick, recent, moves) {
  if (!cue) return false;
  if (cue.twist) return true;
  if (cue.fresh) return !recent.includes(pick);
  const cat = moves.find((x) => x.name === pick)?.category;
  return cue.categories.includes(cat);
}

/** Points for one pick: half speed, half variety, plus a bonus for answering the cue. */
export function pickPoints({ speed, variety, cueMet }) {
  return Math.round(100 * (0.5 * speed + 0.5 * variety)) + (cueMet ? 25 : 0);
}

/** A session's summary and grade. picks: [{move, speed, variety, points, early, frozen}] */
export function summarise(picks, moves) {
  const real = picks.filter((p) => !p.frozen);
  const names = real.map((p) => p.move);
  const distinct = new Set(names).size;
  let streakNow = 0;
  let bestStreak = 0;
  const seen = [];
  for (const n of names) {
    streakNow = seen.at(-1) === n ? 0 : streakNow + 1;
    bestStreak = Math.max(bestStreak, streakNow);
    seen.push(n);
  }
  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const points = avg(picks.map((p) => p.points));
  const grade = points >= 90 ? 'S' : points >= 80 ? 'A' : points >= 65 ? 'B' : points >= 50 ? 'C' : 'D';
  const unused = moves.filter((x) => !names.includes(x.name)).map((x) => x.name);
  return {
    picks: picks.length,
    frozen: picks.length - real.length,
    distinct,
    repeats: names.filter((n, i) => i > 0 && names[i - 1] === n).length,
    bestStreak,
    avgEarly: avg(real.map((p) => p.early)),
    speed: avg(picks.map((p) => p.speed)),
    variety: avg(picks.map((p) => p.variety)),
    points,
    grade,
    unused,
  };
}

// --------------------------------------------------------------- recall

const norm = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Typing distance between two words (insertions, deletions, changes, swapped neighbours). */
function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // Two neighbouring letters swapped counts as one typo.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
    }
  }
  return dp[a.length][b.length];
}

const wordMatch = (w, t) => w === t || (w.length >= 4 && t.length >= 4 && editDistance(w, t) <= 1);

/**
 * The move a typed or spoken phrase means, allowing small typos, missing
 * accents and either name (Portuguese or English alias). Null if unsure.
 */
export function matchMove(text, moves) {
  const said = norm(text);
  if (!said) return null;
  const saidWords = said.split(' ');
  let best = null;
  for (const mv of moves) {
    for (const name of [mv.name, mv.alias].filter(Boolean)) {
      const n = norm(name);
      if (n === said) return mv;
      const words = n.split(' ').filter((w) => w.length > 1);
      const hits = words.filter((w) => saidWords.some((t) => wordMatch(w, t))).length;
      // Most of the name's words were said, or the phrase starts the name.
      let score = words.length ? hits / words.length : 0;
      if (n.startsWith(said) && said.length >= 3) score = Math.max(score, 0.75 + said.length / (n.length * 10));
      if (!best || score > best.score) best = { mv, score };
    }
  }
  return best && best.score >= 0.6 ? best.mv : null;
}

/** Free recall: which moves were remembered, which forgotten, and anything new typed. */
export function recallResult(typed, moves) {
  const found = new Set();
  const unknown = [];
  for (const t of typed) {
    const mv = matchMove(t, moves);
    if (mv) found.add(mv.name);
    else if (norm(t)) unknown.push(t);
  }
  return {
    remembered: moves.filter((x) => found.has(x.name)).map((x) => x.name),
    forgotten: moves.filter((x) => !found.has(x.name)).map((x) => x.name),
    unknown,
  };
}
