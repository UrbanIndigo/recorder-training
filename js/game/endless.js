// Beat Ward's unlimited mode: an endless stream of rhythm that adapts to
// you. It starts by placing you (quick jumps up a ladder of rhythms until
// you start to struggle), then keeps adjusting: clean playing adds the next
// rhythm, struggling eases off, weak rhythms come up more often, and the
// tempo rises (or falls) round by round. No DOM or audio code.

import { generateFromCells } from '../rhythm.js?v=3.6';

/** Rhythms from easiest to hardest (4/4, one hand). */
export const LADDER = [
  'quarter', 'half', 'quarterRest', 'eighths', 'restEighth', 'eighthRest', 'syncopation',
  'dottedQuarterEighth', 'offbeatQuarters', 'eighthTwoSixteenths', 'twoSixteenthsEighth', 'sixteenths',
  'dottedEighthSixteenth', 'scotchSnap', 'sixteenthEighthSixteenth', 'triplet', 'tripletRestMiddle',
  'quarterTriplet', 'tripletRestFirst', 'sixteenthTriplet', 'tiedSyncopation',
];

export const BARS_PER_LINE = 2;
export const LINES_PER_ROUND = 4;
export const START_BPM = 72;
export const MIN_BPM = 50;
export const MAX_BPM = 180;
const START_K = 2; // quarters and halves
const DAMAGE = { perfect: 1, good: 0.7, ok: 0.4, miss: 0 };

export function newSkill() {
  return {
    k: START_K, // how many rhythms of the ladder are in play
    bpm: START_BPM,
    mastery: {}, // rhythm -> 0..1, how well it's been played lately
    introducedAt: { quarter: 0, half: 0 }, // rhythm -> line it first appeared on
    line: 0, // lines played
    assessing: true,
    streak: 0, // clean lines in a row
    round: [], // accuracy of each line this round
    peak: START_K,
  };
}

/** The rhythms in play. */
export function unlocked(skill) {
  return LADDER.slice(0, Math.floor(skill.k));
}

/** The hardest rhythm in play: what the level means. */
export function levelName(skill) {
  return unlocked(skill).at(-1);
}

/**
 * How often each rhythm comes up: weak ones more, a newly added one a lot
 * for its first few lines, and the basics less once there's more to read.
 */
export function weightsFor(skill) {
  const cells = unlocked(skill);
  const out = {};
  cells.forEach((c, i) => {
    const m = skill.mastery[c];
    let w = 1 + 2 * (1 - (m ?? 0.5));
    if (skill.line - (skill.introducedAt[c] ?? -99) < 3 && i >= START_K) w += 3;
    if (cells.length > 6 && i < 3) w *= 0.5;
    out[c] = w;
  });
  return out;
}

/**
 * The rhythm level to write the next line at. Lines are written a couple
 * of lines before they're played, so while things are going well it looks
 * ahead: in placement it assumes each waiting line will be passed (3 steps
 * each); on a clean streak, one rhythm ahead (never two new ones at once).
 */
export function writingLevel(skill, ahead = 0) {
  const k = skill.assessing ? skill.k + 3 * ahead : (skill.streak > 0 || skill.lastClean) && !skill.hold ? skill.k + Math.min(1, ahead) : skill.k;
  return Math.min(LADDER.length, k);
}

/** The next line of music: two bars of events, made from the rhythms in play. `ahead`: lines written but not yet played. */
export function makeLine(skill, random, ahead = 0) {
  const k = writingLevel(skill, ahead);
  const introducedAt = { ...skill.introducedAt };
  for (const c of LADDER.slice(Math.floor(skill.k), Math.floor(k))) introducedAt[c] ??= skill.line; // new to this line: feature it
  const cells = weightsFor({ ...skill, k, introducedAt });
  return Array.from({ length: BARS_PER_LINE }, () => generateFromCells({ cells, meter: '4/4', pitches: [72], bars: 1, random, standalone: false }).events);
}

/**
 * How a line went. `notes` are the line's notes ({cell, judged}); extra
 * taps count against it.
 * @returns {{acc, perCell: {cell: acc}, top: number}} top: the hardest rhythm in the line (ladder index)
 */
export function lineResult(notes, extras = 0) {
  const per = {};
  const top = Math.max(-1, ...notes.map((n) => LADDER.indexOf(n.cell)));
  let sum = 0;
  for (const n of notes) {
    const d = DAMAGE[n.judged] ?? 0;
    sum += d;
    (per[n.cell] ||= []).push(d);
  }
  const acc = notes.length + extras ? sum / (notes.length + extras * 0.5) : 1;
  const perCell = Object.fromEntries(Object.entries(per).map(([c, v]) => [c, v.reduce((a, b) => a + b, 0) / v.length]));
  return { acc: Math.max(0, Math.min(1, acc)), perCell, top };
}

/**
 * Learn from a finished line, and decide what comes next.
 * @returns {{kind: 'assessed'|'new'|'easier', cell?: string}[]} what changed, to tell the player
 */
export function updateSkill(skill, result) {
  const out = [];
  for (const [c, a] of Object.entries(result.perCell)) {
    const m = skill.mastery[c];
    skill.mastery[c] = m == null ? a : m * 0.6 + a * 0.4;
  }
  skill.line++;
  skill.round.push(result.acc);
  const before = Math.floor(skill.k);
  if (skill.assessing) {
    // Placement: big jumps while it's easy; the first real slip ends it.
    // Lines are written a little ahead, so only move up once a line has
    // actually tested the hardest rhythms in play.
    const tested = result.top == null || result.top >= Math.floor(skill.k) - 2;
    if (result.acc >= 0.8) {
      if (tested && skill.k < LADDER.length) skill.k = Math.min(LADDER.length, skill.k + 3);
    } else {
      skill.assessing = false;
      skill.k = Math.max(START_K, skill.k - (result.acc < 0.6 ? 2 : 1));
      out.push({ kind: 'assessed' });
    }
    if (skill.k >= LADDER.length && skill.assessing) {
      skill.assessing = false;
      out.push({ kind: 'assessed' });
    }
  } else if (result.acc >= 0.88) {
    // Every clean line brings in the next rhythm; two near-perfect lines in a row skip one ahead.
    skill.lastClean = true;
    // After easing off, wait for two clean lines before trying harder again.
    if (skill.hold > 0) skill.hold--;
    // Only lines that included the newest rhythm count (lines are written a little ahead).
    else if (result.top == null || result.top >= Math.floor(skill.k) - 1) {
      skill.streak = result.acc >= 0.97 ? skill.streak + 1 : 0;
      const step = skill.streak >= 2 ? 2 : 1;
      if (step === 2) skill.streak = 0;
      skill.k = Math.min(LADDER.length, skill.k + step);
    }
  } else {
    skill.streak = 0;
    skill.lastClean = false;
    if (result.acc < 0.75 && skill.k > START_K + 1) {
      skill.k -= 1;
      skill.hold = 2;
      out.push({ kind: 'easier' });
    }
  }
  const after = Math.floor(skill.k);
  for (let i = before; i < after; i++) {
    const c = LADDER[i];
    if (skill.introducedAt[c] == null) {
      skill.introducedAt[c] = skill.line;
      if (!skill.assessing) out.push({ kind: 'new', cell: c });
    }
  }
  skill.peak = Math.max(skill.peak, after);
  return out;
}

/** At the end of a round: speed up after a good one, slow down after a bad one. Returns the change in BPM. */
export function endRound(skill) {
  const avg = skill.round.length ? skill.round.reduce((a, b) => a + b, 0) / skill.round.length : 0;
  skill.round = [];
  const before = skill.bpm;
  // Once the rhythms are all in play, tempo is the only way up.
  const maxed = skill.k >= LADDER.length;
  if (avg >= 0.95) skill.bpm += maxed ? 12 : 8;
  else if (avg >= 0.85) skill.bpm += maxed ? 8 : 5;
  else if (avg < 0.65) skill.bpm -= 6;
  skill.bpm = Math.max(MIN_BPM, Math.min(MAX_BPM, skill.bpm));
  return skill.bpm - before;
}

/** The rhythms played worst, for the end-of-run summary. */
export function weakest(skill, n = 3) {
  return Object.entries(skill.mastery)
    .filter(([, m]) => m < 0.8)
    .sort((a, b) => a[1] - b[1])
    .slice(0, n)
    .map(([c]) => c);
}
