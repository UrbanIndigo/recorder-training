// Endless rhythm training: a curriculum of rhythm patterns that unlock as
// the player gets them right, retries and reviews of rhythms they found
// hard, and tempo that rises once everything is unlocked. No DOM code.

import { generateFromCells, cellFitsMeter } from './rhythm.js?v=2.1';

/** Each step unlocks one new rhythm pattern or time signature, in teaching order. */
export const CURRICULUM = [
  { cell: 'quarter', title: 'Quarter notes', text: 'A quarter note lasts 1 beat. Tongue each one ("tu") right on the click and hold it until the next.', count: '1 2 3 4' },
  { cell: 'half', title: 'Half notes', text: 'A half note has a hollow head and lasts 2 beats. Tongue on the click, then keep blowing through the next one.', count: '1 (2) 3 (4)' },
  { cell: 'whole', title: 'Whole notes', text: 'A whole note has no stem and lasts 4 beats: a whole bar of 4/4. Take a good breath first.', count: '1 (2 3 4)' },
  { cell: 'quarterRest', title: 'Quarter rests', text: 'The squiggle is a quarter rest: 1 beat of silence. Stop the air on the beat and keep counting.', count: '1 2 (rest) 4' },
  { cell: 'halfRest', title: 'Half rests', text: 'A half rest is a small block sitting on the middle line: 2 beats of silence.', count: '1 2 (rest rest)' },
  { cell: 'barRest', title: 'Whole-bar rests', text: 'A block hanging from the fourth line fills a whole bar with silence, in any time signature. Keep counting through it so you come in on time.', count: '(1 2 3 4) | 1' },
  { cell: 'dottedHalf', title: 'Dotted half notes', text: 'A dot adds half the note’s value again, so a dotted half note lasts 3 beats.', count: '1 (2 3) 4' },
  { timeSig: '3/4', title: '3/4 time', text: 'The top number says how many beats are in each bar. In 3/4 there are 3, so count "1 2 3". Beat 1 is the loud click.', count: '1 2 3 | 1 2 3' },
  { cell: 'eighths', title: 'Eighth notes', text: 'Two eighth notes joined by a beam fit into one beat. Count "1 + 2 +" and tongue on every number and every "+".', count: '1 + 2 + ' },
  { cell: 'restEighth', title: 'Off-beat eighths', text: 'An eighth rest then an eighth note: stay silent on the beat and play on the "+".', count: '(1) + (2) +' },
  { cell: 'dottedQuarterEighth', title: 'Dotted quarter + eighth', text: 'The dotted quarter lasts 1½ beats, then the eighth fills the last half. Hold through beat 2 and play again on its "+".', count: '1 (2) + 3' },
  { timeSig: '2/4', title: '2/4 time', text: 'Two beats in each bar: count "1 2 | 1 2". It feels like a march.', count: '1 2 | 1 2' },
  { cell: 'syncopation', title: 'Syncopation', text: 'Eighth, quarter, eighth: short–long–short. The quarter note starts on the "+" of the beat, between the clicks.', count: '1 + (2) +' },
  { cell: 'eighthRest', title: 'Eighth rests', text: 'An eighth note then an eighth rest: play on the beat and stop the air on the "+". Short and clean.', count: '1 (+) 2 (+)' },
  { cell: 'tiedQuarterEighth', title: 'Ties', text: 'A curved line joining two notes of the same pitch is a tie. Play the first note and keep blowing through the second — don’t tongue it again.', count: '1 (2) +' },
  { cell: 'sixteenths', title: 'Sixteenth notes', text: 'Four sixteenth notes (two beams) fit into one beat. Count "1 e + a" and tongue every one, lightly.', count: '1 e + a' },
  { cell: 'eighthTwoSixteenths', title: 'Eighth + two sixteenths', text: 'Long–short–short in one beat. The eighth takes half the beat, then two quick sixteenths: "1 + a".', count: '1 + a' },
  { cell: 'twoSixteenthsEighth', title: 'Two sixteenths + eighth', text: 'Short–short–long in one beat: two quick sixteenths, then an eighth on the "+": "1 e +".', count: '1 e +' },
  { cell: 'dottedEighthSixteenth', title: 'Dotted eighth + sixteenth', text: 'A skipping rhythm. The dotted eighth takes three quarters of the beat and the sixteenth slips in just before the next click, on the "a".', count: '1 (e +) a' },
  { cell: 'triplet', title: 'Triplets', text: 'Three notes squeezed evenly into one beat, marked with a 3. Count "1 trip let" and keep them even, not long–short.', count: '1 trip let' },
  { cell: 'quarterHalfQuarter', title: 'Syncopated half note', text: 'Quarter, half, quarter: the half note starts on beat 2 and holds through beat 3. Feel the accent on 2 instead of 3.', count: '1 2 (3) 4' },
  { cell: 'eighthDottedQuarter', title: 'Eighth + dotted quarter', text: 'Short then long: the dotted quarter starts on the "+" and lasts 1½ beats, right up to the next beat after it.', count: '1 + (2 +)' },
  { cell: 'tiedSyncopation', title: 'Tied syncopation', text: 'Four eighths with the middle two tied: play 1, play on the "+", hold through 2, play on its "+". Don’t tongue the tied note.', count: '1 + (2) +' },
  { cell: 'offbeatQuarters', title: 'Off-beat quarters', text: 'Eighth, quarter, quarter, eighth: the quarters start on the "+" each time, so they sit between the clicks. Keep counting the "+"s.', count: '1 + (2) + (3) +' },
  { cell: 'sixteenthEighthSixteenth', title: 'Sixteenth–eighth–sixteenth', text: 'Short–long–short inside one beat: "1 e (+) a". The eighth starts on the "e".', count: '1 e (+) a' },
  { cell: 'scotchSnap', title: 'Scotch snap', text: 'A quick sixteenth right on the beat, then a long dotted eighth: a snappy short–long. The opposite of the dotted eighth + sixteenth.', count: '1 e (+ a)' },
  { cell: 'eighthRestTwoSixteenths', title: 'Eighth rest + two sixteenths', text: 'Silent on the beat, then two quick notes on "+ a". Count the rest so you don’t come in early.', count: '(1 e) + a' },
  { cell: 'sixteenthRestThree', title: 'Sixteenth rests', text: 'A sixteenth rest on the beat, then three sixteenths: "(1) e + a". Breathe in on the beat, play just after it.', count: '(1) e + a' },
  { cell: 'quarterTriplet', title: 'Quarter-note triplets', text: 'Three even notes spread across two beats. Only the first lands on a click; the other two fall between. Count "1 trip let 2 trip let": play on 1, on the "let" of 1, and on the "trip" of 2.', count: '1 (trip) let (2) trip (let)' },
  { timeSig: '6/8', cells: ['c_dottedQuarter', 'c_threeEighths', 'c_quarterEighth', 'c_dottedHalf'], title: '6/8 time', text: 'Six eighth notes in a bar, felt as two big beats of three. The click is on beats 1 and 4. Count "1 2 3 4 5 6" with the clicks on 1 and 4.', count: '1 2 3 4 5 6' },
  { cell: 'c_eighthQuarter', title: '6/8: eighth + quarter', text: 'In 6/8 a quarter note lasts two eighths. Eighth then quarter is short–long: play on 1 and 2 (or 4 and 5).', count: '1 2 (3)' },
  { cell: 'c_dottedQuarterRest', title: '6/8: dotted quarter rests', text: 'A dotted quarter rest is a whole beat of silence in 6/8: three eighths’ worth.', count: '(1 2 3) 4 5 6' },
  { cell: 'c_sixteenths', title: '6/8: sixteenths', text: 'Two sixteenths then two eighths in one beat: "1 + 2 3". Keep the sixteenths light and quick.', count: '1 + 2 3' },
  { cell: 'c_siciliano', title: '6/8: siciliano rhythm', text: 'Dotted eighth, sixteenth, eighth: a lilting, rocking rhythm found in lots of baroque recorder music.', count: '1 (+) 2 3' },
  { cells: ['tripletRestMiddle', 'tripletRestFirst'], title: 'Triplets with rests', text: 'A rest can take one third of a triplet. Keep the three even in your head — "1 trip let" — and leave the rest silent.', count: '1 (trip) let · (1) trip let' },
  { cell: 'sixteenthTriplet', title: 'Sixteenth-note triplets', text: 'Three sixteenths squeezed into half a beat (marked 3), then an eighth. Quick and even: "1-trip-let +".', count: '1-trip-let +' },
  { cell: 'quintuplet', title: 'Quintuplets', text: 'Five even notes in one beat, marked 5. Don’t count them — feel the beat and spread five notes evenly across it.', count: '1 · · · · | 2' },
  { cell: 'c_duplet', title: '6/8: duplets', text: 'In 6/8, a "2" over two eighths means two even notes across the dotted-quarter beat — like a march slipping into the dance.', count: '1 (2) + (3)' },
  { cell: 'thirtySeconds', title: 'Thirty-second notes', text: 'Three beams: four thirty-second notes fit in half a beat. Here an eighth is followed by a quick run of four. Tongue lightly ("tu-ku" if you double-tongue).', count: '1 + e + a' },
  { cell: 'dottedSixteenth32', title: 'Dotted sixteenth + thirty-second', text: 'A sharp, French-overture snap: long–short twice in each beat. The short note is very quick, right before the next one.', count: '1 (e) + (a)' },
  { cell: 'doubleDottedQuarter', title: 'Double-dotted quarter + sixteenth', text: 'Two dots add a half and then a quarter of the value: a double-dotted quarter lasts 1¾ beats, and the sixteenth slips in just before beat 3.', count: '1 (2 + a)' },
  { cell: 'doubleDottedHalf', title: 'Double-dotted half + eighth', text: 'A double-dotted half lasts 3½ beats; the eighth fills the last half of beat 4.', count: '1 (2 3 4) +' },
  { cells: ['dottedQuarterRestEighth', 'eighthRestQuarterEighth'], restStart: true, title: 'Coming in after a rest', text: 'Rests on the beat: count through the silence and come in on the "+". Rhythms can now start with a rest too.', count: '(1 2) + | (1) + (2) +' },
  { cells: ['eighthSixteenthRestSixteenth', 'sixteenthRestEighth'], title: 'Sixteenth rests in the middle', text: 'A tiny gap inside the beat: stop the air for a sixteenth, then play the next note exactly on time.', count: '1 + (e) a · 1 e (+) +' },
  { cell: 'dottedEighthRestSixteenth', title: 'Dotted eighth rest + sixteenth', text: 'Silent for three quarters of the beat, then one quick note on the "a" leading into the next beat.', count: '(1 e +) a' },
];

const CURRICULUM_VERSION = 4;

/** Bring saved progress up to date with the current curriculum. */
export function migrateProgress(progress) {
  if (!progress.version) {
    // Version 2 inserted whole-bar rests after half rests (index 5).
    if (progress.stage >= 5) progress.stage++;
    progress.version = 2;
  }
  // Versions 3 and 4 only added stages at the end.
  progress.version = CURRICULUM_VERSION;
  return progress;
}

const PHRASE_BARS = 2;
const PASS_SCORE = 70; // below this a rhythm is repeated
const MASTERED = 0.75; // per-pattern skill needed before the next unlock
const MIN_TEMPO = 45;
const MAX_TEMPO = 140;

export function newProgress(bpm = 70) {
  return {
    version: CURRICULUM_VERSION,
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
    cells: steps.flatMap((s) => [...(s.cell ? [s.cell] : []), ...(s.cells || [])]),
    timeSigs: ['4/4', ...steps.filter((s) => s.timeSig).map((s) => s.timeSig)],
  };
}

/**
 * Pick the next rhythm to play.
 * @param {object} progress
 * @param {{exercise: object, result: object}|null} last the rhythm just played
 * @returns {{exercise: object, kind: 'new'|'retry'|'review', hint: boolean, focus: string|null}}
 */
export function chooseNext(progress, last, pitches, random = Math.random, { bars = PHRASE_BARS, standalone = true, startPitch = null } = {}) {
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
    if ((newest.cell === c || newest.cells?.includes(c)) && sinceUnlock < 6) weights[c] += 10;
  }
  // Pick the time signature. A newly unlocked one, or one a newly unlocked
  // pattern needs, is used straight away for a few rhythms.
  const fresh = sinceUnlock < 4;
  const newCells = newest.cell ? [newest.cell] : newest.timeSig ? [] : newest.cells || [];
  let meter;
  if (newest.timeSig && fresh) meter = newest.timeSig;
  else if (newCells.length && fresh) {
    const fit = timeSigs.filter((m) => newCells.some((c) => cellFitsMeter(c, m)));
    meter = fit.includes('4/4') && random() < 0.5 ? '4/4' : fit[Math.floor(random() * fit.length)];
  } else meter = random() < 0.4 ? '4/4' : timeSigs[Math.floor(random() * timeSigs.length)];
  meter ||= '4/4';

  const allowRestStart = CURRICULUM.slice(0, progress.stage + 1).some((st) => st.restStart);

  // Make sure a just-unlocked pattern actually appears in its first rhythms.
  const mustInclude = fresh ? newCells.filter((c) => cellFitsMeter(c, meter)) : [];
  let exercise;
  for (let attempt = 0; attempt < 40; attempt++) {
    exercise = generateFromCells({ cells: weights, meter, pitches, bars, random, allowRestStart, standalone, startPitch });
    if (!mustInclude.length || exercise.events.some((e) => mustInclude.includes(e.cell))) break;
  }
  const hint = newCells.length > 0 && sinceUnlock < 2 && exercise.events.some((e) => newCells.includes(e.cell));
  return { exercise, kind: 'new', hint, focus: null };
}

/**
 * Record how a rhythm went and move the player on.
 * @returns {{type: 'unlock', step: object}|{type: 'tempo', bpm: number, faster: boolean}|null}
 */
/**
 * Record how a rhythm went and move the player on. `window` is how many
 * recent results must average 80+ to unlock the next step (and how many
 * results since the last unlock are needed): 3 two-bar rhythms by default,
 * more when scoring bar by bar.
 */
export function recordResult(progress, exercise, result, { window = 3 } = {}) {
  progress.phrases++;
  progress.recent.push(result.overall);
  if (progress.recent.length > Math.max(8, window)) progress.recent.shift();
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

  const recent3 = progress.recent.slice(-window);
  const avg3 = recent3.reduce((a, b) => a + b, 0) / recent3.length;
  const sinceUnlock = progress.phrases - progress.stageStartedAt;

  if (recent3.length === window && avg3 >= 80 && sinceUnlock >= window && allMastered(progress)) {
    if (progress.stage < CURRICULUM.length - 1) {
      progress.stage++;
      progress.stageStartedAt = progress.phrases;
      progress.recent = [];
      return { type: 'unlock', step: CURRICULUM[progress.stage] };
    }
    if (progress.bpm < MAX_TEMPO && progress.phrases - progress.lastTempoChange >= window + 1) {
      progress.bpm = Math.min(MAX_TEMPO, progress.bpm + 5);
      progress.lastTempoChange = progress.phrases;
      progress.recent = [];
      return { type: 'tempo', bpm: progress.bpm, faster: true };
    }
  }
  if (recent3.length === window && avg3 < 45 && progress.bpm > MIN_TEMPO && progress.phrases - progress.lastTempoChange >= window) {
    progress.bpm = Math.max(MIN_TEMPO, progress.bpm - 5);
    progress.lastTempoChange = progress.phrases;
    progress.recent = [];
    return { type: 'tempo', bpm: progress.bpm, faster: false };
  }
  return null;
}

/** How close the player is to the next unlock, 0..1, for a progress bar. */
export function unlockProgress(progress, { window = 3 } = {}) {
  const { cells } = unlocked(progress);
  const skills = cells.map((c) => Math.min(1, (progress.skill[c]?.ema ?? 0.5) / MASTERED));
  const skillPart = skills.reduce((a, b) => a + b, 0) / skills.length;
  const phrasePart = Math.min(1, (progress.phrases - progress.stageStartedAt) / window);
  const recent = progress.recent.slice(-window);
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
      if (n.beats >= 1) {
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
