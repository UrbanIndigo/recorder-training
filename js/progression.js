// Endless rhythm training: a curriculum of rhythm patterns that unlock as
// the player gets them right, retries and reviews of rhythms they found
// hard, and tempo that rises once everything is unlocked. No DOM code.

import { generateFromCells } from './rhythm.js';

/** Each step unlocks one new rhythm pattern or time signature, in teaching order. */
export const CURRICULUM = [
  { cell: 'quarter', title: 'Quarter notes', text: 'A quarter note lasts 1 beat. Tongue each one ("tu") right on the click and hold it until the next.', count: '1 2 3 4' },
  { cell: 'half', title: 'Half notes', text: 'A half note has a hollow head and lasts 2 beats. Tongue on the click, then keep blowing through the next one.', count: '1 (2) 3 (4)' },
  { cell: 'whole', title: 'Whole notes', text: 'A whole note has no stem and lasts 4 beats: a whole bar of 4/4. Take a good breath first.', count: '1 (2 3 4)' },
  { cell: 'quarterRest', title: 'Quarter rests', text: 'The squiggle is a quarter rest: 1 beat of silence. Stop the air on the beat and keep counting.', count: '1 2 (rest) 4' },
  { cell: 'halfRest', title: 'Half rests', text: 'A half rest is a small block sitting on the middle line: 2 beats of silence.', count: '1 2 (rest rest)' },
  { cell: 'dottedHalf', title: 'Dotted half notes', text: 'A dot adds half the note’s value again, so a dotted half note lasts 3 beats.', count: '1 (2 3) 4' },
  { timeSig: 3, title: '3/4 time', text: 'The top number says how many beats are in each bar. In 3/4 there are 3, so count "1 2 3". Beat 1 is the loud click.', count: '1 2 3 | 1 2 3' },
  { cell: 'eighths', title: 'Eighth notes', text: 'Two eighth notes joined by a beam fit into one beat. Count "1 + 2 +" and tongue on every number and every "+".', count: '1 + 2 + ' },
  { cell: 'restEighth', title: 'Off-beat eighths', text: 'An eighth rest then an eighth note: stay silent on the beat and play on the "+".', count: '(1) + (2) +' },
  { cell: 'dottedQuarterEighth', title: 'Dotted quarter + eighth', text: 'The dotted quarter lasts 1½ beats, then the eighth fills the last half. Hold through beat 2 and play again on its "+".', count: '1 (2) + 3' },
  { timeSig: 2, title: '2/4 time', text: 'Two beats in each bar: count "1 2 | 1 2". It feels like a march.', count: '1 2 | 1 2' },
  { cell: 'syncopation', title: 'Syncopation', text: 'Eighth, quarter, eighth: short–long–short. The quarter note starts on the "+" of the beat, between the clicks.', count: '1 + (2) +' },
];

const PHRASE_BARS = 2;
const PASS_SCORE = 70; // below this a rhythm is repeated
const MASTERED = 0.75; // per-pattern skill needed before the next unlock
const MIN_TEMPO = 45;
const MAX_TEMPO = 140;

export function newProgress(bpm = 70) {
  return {
    stage: 0, // index into CURRICULUM of the newest unlocked step
    stageStartedAt: 0, // phrase count when it unlocked
    skill: {}, // cell -> { ema, n }
    bpm,
    phrases: 0,
    recent: [], // last scores
    review: [], // [{ exercise, due }]
    lastTempoChange: 0,
    streak: 0,
    bestStreak: 0,
  };
}

/** Patterns and time signatures unlocked so far. */
export function unlocked(progress) {
  const steps = CURRICULUM.slice(0, progress.stage + 1);
  return {
    cells: steps.filter((s) => s.cell).map((s) => s.cell),
    timeSigs: [4, ...steps.filter((s) => s.timeSig).map((s) => s.timeSig)],
  };
}

/**
 * Pick the next rhythm to play.
 * @param {object} progress
 * @param {{exercise: object, result: object}|null} last the rhythm just played
 * @returns {{exercise: object, kind: 'new'|'retry'|'review', hint: boolean, focus: string|null}}
 */
export function chooseNext(progress, last, pitches, random = Math.random) {
  if (last && last.result.overall < PASS_SCORE && !last.exercise.retry) {
    return { exercise: { ...last.exercise, retry: true }, kind: 'retry', hint: true, focus: weakestCell(last.exercise, last.result) };
  }
  const dueIdx = progress.review.findIndex((r) => r.due <= progress.phrases);
  if (dueIdx !== -1) {
    const [item] = progress.review.splice(dueIdx, 1);
    return { exercise: { ...item.exercise, retry: false, reviewed: true }, kind: 'review', hint: false, focus: null };
  }

  const { cells, timeSigs } = unlocked(progress);
  const newest = CURRICULUM[progress.stage];
  const sinceUnlock = progress.phrases - progress.stageStartedAt;

  // Weak patterns come up more often; a just-unlocked one dominates at first.
  const weights = {};
  const severity = issueSeverityByCell(progress);
  for (const c of cells) {
    const sk = progress.skill[c];
    weights[c] = 1 + 3 * (1 - (sk ? sk.ema : 0.5)) + 3 * (severity[c] || 0);
    if (newest.cell === c && sinceUnlock < 6) weights[c] += 4;
  }
  // A newly unlocked time signature is used straight away for a few phrases.
  let bpb;
  if (newest.timeSig && sinceUnlock < 4) bpb = newest.timeSig;
  else bpb = random() < 0.5 ? 4 : timeSigs[Math.floor(random() * timeSigs.length)];
  // Only use cells that can sit in this time signature.
  if (bpb !== 4) delete weights.whole;

  const exercise = generateFromCells({ cells: weights, beatsPerBar: bpb, pitches, bars: PHRASE_BARS, random });
  const hint = newest.cell != null && sinceUnlock < 2 && exercise.events.some((e) => e.cell === newest.cell);
  return { exercise, kind: 'new', hint, focus: null };
}

/**
 * Record how a rhythm went and move the player on.
 * @returns {{type: 'unlock', step: object}|{type: 'tempo', bpm: number, faster: boolean}|null}
 */
export function recordResult(progress, exercise, result) {
  progress.phrases++;
  progress.recent.push(result.overall);
  if (progress.recent.length > 8) progress.recent.shift();
  progress.streak = result.overall >= PASS_SCORE ? progress.streak + 1 : 0;
  progress.bestStreak = Math.max(progress.bestStreak, progress.streak);

  for (const [cell, score] of cellScores(exercise, result)) {
    const sk = (progress.skill[cell] ||= { ema: 0.5, n: 0 });
    sk.ema = sk.ema * 0.65 + score * 0.35;
    sk.n++;
  }
  updateIssues(progress, exercise, result);

  // Failed a retry too: come back to it a few rhythms later.
  if (exercise.retry && result.overall < PASS_SCORE) {
    const { retry, reviewed, ...plain } = exercise;
    progress.review.push({ exercise: plain, due: progress.phrases + 3 });
    if (progress.review.length > 5) progress.review.shift();
  }

  const recent3 = progress.recent.slice(-3);
  const avg3 = recent3.reduce((a, b) => a + b, 0) / recent3.length;
  const sinceUnlock = progress.phrases - progress.stageStartedAt;

  if (recent3.length === 3 && avg3 >= 80 && sinceUnlock >= 4 && allMastered(progress)) {
    if (progress.stage < CURRICULUM.length - 1) {
      progress.stage++;
      progress.stageStartedAt = progress.phrases;
      progress.recent = [];
      return { type: 'unlock', step: CURRICULUM[progress.stage] };
    }
    if (progress.bpm < MAX_TEMPO && progress.phrases - progress.lastTempoChange >= 4) {
      progress.bpm = Math.min(MAX_TEMPO, progress.bpm + 5);
      progress.lastTempoChange = progress.phrases;
      progress.recent = [];
      return { type: 'tempo', bpm: progress.bpm, faster: true };
    }
  }
  if (recent3.length === 3 && avg3 < 45 && progress.bpm > MIN_TEMPO && progress.phrases - progress.lastTempoChange >= 3) {
    progress.bpm = Math.max(MIN_TEMPO, progress.bpm - 5);
    progress.lastTempoChange = progress.phrases;
    progress.recent = [];
    return { type: 'tempo', bpm: progress.bpm, faster: false };
  }
  return null;
}

/** How close the player is to the next unlock, 0..1, for a progress bar. */
export function unlockProgress(progress) {
  const { cells } = unlocked(progress);
  const skills = cells.map((c) => Math.min(1, (progress.skill[c]?.ema ?? 0.5) / MASTERED));
  const skillPart = skills.reduce((a, b) => a + b, 0) / skills.length;
  const phrasePart = Math.min(1, (progress.phrases - progress.stageStartedAt) / 4);
  const recent = progress.recent.slice(-3);
  const scorePart = recent.length ? Math.min(1, recent.reduce((a, b) => a + b, 0) / recent.length / 80) : 0;
  return Math.min(skillPart, phrasePart, scorePart);
}

function allMastered(progress) {
  return unlocked(progress).cells.every((c) => {
    const sk = progress.skill[c];
    return sk && sk.n >= 2 && sk.ema >= MASTERED;
  });
}

/** Score (0..1) for each pattern instance in the rhythm. */
export function cellScores(exercise, result) {
  const byCell = new Map(); // cellId -> { cell, scores[] }
  const add = (e, score) => {
    if (!byCell.has(e.cellId)) byCell.set(e.cellId, { cell: e.cell, scores: [] });
    byCell.get(e.cellId).scores.push(score);
  };
  for (const n of result.notes) add(n.event, n.score);
  const hit = new Set(result.restHits);
  for (const e of exercise.events) if (e.rest) add(e, hit.has(e) ? 0 : 1);
  return [...byCell.values()].map(({ cell, scores }) => [cell, scores.reduce((a, b) => a + b, 0) / scores.length]);
}

function weakestCell(exercise, result) {
  let worst = null;
  for (const [cell, score] of cellScores(exercise, result)) if (!worst || score < worst[1]) worst = [cell, score];
  return worst ? worst[0] : null;
}

/** A friendly name for a pattern, for messages. */
export function cellTitle(cell) {
  return CURRICULUM.find((s) => s.cell === cell)?.title.toLowerCase() ?? cell;
}

// ----------------------------------------------------------------- issues

const CELL_TIPS = {
  quarter: 'Tongue right on each click.',
  half: 'Keep blowing through the second click.',
  whole: 'Keep blowing through all four clicks.',
  quarterRest: 'Stop the air on the rest’s click and wait for the next.',
  halfRest: 'Stay silent for two whole clicks.',
  dottedHalf: 'Hold it for three clicks.',
  eighths: 'Say “1 + 2 +” and tongue on every syllable.',
  restEighth: 'Silent on the number, play on the “+”.',
  dottedQuarterEighth: 'Hold through the next click, then play on its “+”.',
  syncopation: 'The long note starts between the clicks — count the “+”.',
};

/**
 * Track recurring problems per rhythm pattern: rushing or dragging,
 * cutting notes short, missing notes, and playing through rests.
 */
function updateIssues(progress, exercise, result) {
  progress.issues ||= {};
  const groups = new Map();
  const group = (cell) => {
    if (!groups.has(cell)) groups.set(cell, { errors: [], short: 0, long: 0, missed: 0, notes: 0, rests: 0, restHits: 0 });
    return groups.get(cell);
  };
  for (const n of result.notes) {
    const g = group(n.event.cell);
    g.notes++;
    if (n.status === 'missed') g.missed++;
    else {
      g.errors.push(n.errorMs);
      if (n.event.beats >= 1) {
        g.long++;
        if (n.short) g.short++;
      }
    }
  }
  const hits = new Set(result.restHits);
  for (const e of exercise.events) {
    if (!e.rest) continue;
    const g = group(e.cell);
    g.rests++;
    if (hits.has(e)) g.restHits++;
  }
  const a = 0.3;
  for (const [cell, g] of groups) {
    const is = (progress.issues[cell] ||= { timing: 0, short: 0, missed: 0, restHit: 0, n: 0 });
    is.n++;
    if (g.errors.length) is.timing = is.timing * (1 - a) + a * (g.errors.reduce((x, y) => x + y, 0) / g.errors.length);
    if (g.long) is.short = is.short * (1 - a) + a * (g.short / g.long);
    if (g.notes) is.missed = is.missed * (1 - a) + a * (g.missed / g.notes);
    if (g.rests) is.restHit = is.restHit * (1 - a) + a * (g.restHits / g.rests);
  }
}

/**
 * The player's biggest recurring problems, worst first.
 * @returns {{cell: string, kind: string, severity: number, text: string, tip: string}[]}
 */
export function topIssues(progress, max = 3) {
  const out = [];
  for (const [cell, is] of Object.entries(progress.issues || {})) {
    if (is.n < 2) continue;
    const name = cellTitle(cell);
    if (is.missed > 0.25) out.push({ cell, kind: 'missed', severity: is.missed, text: `Missing notes in ${name}`, tip: CELL_TIPS[cell] });
    if (is.restHit > 0.3) out.push({ cell, kind: 'rest', severity: is.restHit, text: `Playing through ${name}`, tip: 'A rest means silence: stop the air on the beat and count through it.' });
    if (is.timing < -45) out.push({ cell, kind: 'rush', severity: Math.min(1, -is.timing / 150), text: `Rushing ${name} (about ${Math.round(-is.timing)} ms early)`, tip: `Let the click land before you play. ${CELL_TIPS[cell] || ''}`.trim() });
    if (is.timing > 45) out.push({ cell, kind: 'drag', severity: Math.min(1, is.timing / 150), text: `Late on ${name} (about ${Math.round(is.timing)} ms)`, tip: `Breathe in early so you’re ready on the beat. ${CELL_TIPS[cell] || ''}`.trim() });
    if (is.short > 0.3) out.push({ cell, kind: 'short', severity: is.short * 0.8, text: `Cutting ${name} short`, tip: CELL_TIPS[cell] || 'Hold each note right up to the next one.' });
  }
  return out.sort((x, y) => y.severity - x.severity).slice(0, max);
}

function issueSeverityByCell(progress) {
  const out = {};
  for (const i of topIssues(progress, 10)) out[i.cell] = Math.max(out[i.cell] || 0, i.severity);
  return out;
}
