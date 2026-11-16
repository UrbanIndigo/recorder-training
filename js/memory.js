// Rhythm memory: read some bars, then play them from memory. How far
// you've got (rhythm level, and how many bars at once, which you choose)
// and the rules for moving up and down. No DOM code, so it can be unit tested.

import { LEVELS, generateFromCells, cellFitsMeter } from './rhythm.js?v=4.4';

export const MAX_BARS = 4;
export const PASS = 80; // a score this good counts towards moving up
export const FAIL = 60; // below this counts towards moving down

export function newMemory() {
  return { level: 1, bars: 1, passes: 0, fails: 0, best: {}, rounds: 0 };
}

/**
 * Record a round's score and decide what's next. The number of bars is
 * yours to choose; what changes by itself is the rhythm level: two passes
 * in a row make the rhythms harder, two fails in a row make them easier.
 * @returns {'harder'|'easier'|null} what changed
 */
export function recordRound(m, score, maxLevel) {
  const key = `${m.level}x${m.bars}`;
  m.best[key] = Math.max(m.best[key] ?? 0, score);
  m.rounds++;
  if (score >= PASS) {
    m.fails = 0;
    m.passes++;
    if (m.passes < 2) return null;
    m.passes = 0;
    if (m.level < maxLevel) {
      m.level++;
      return 'harder';
    }
    return null;
  }
  m.passes = 0;
  if (score >= FAIL) return null;
  m.fails++;
  if (m.fails < 2) return null;
  m.fails = 0;
  if (m.level > 1) {
    m.level--;
    return 'easier';
  }
  return null;
}

/** Reading time for a round in seconds (null = take as long as you like). */
export function readingTime(setting, bars) {
  return setting === 'free' ? null : Number(setting) * bars;
}

// ------------------------------------------------------- time signature


/** The time signatures you can stick to ('mixed' = whatever the level uses, changing each time). */
export const METER_CHOICES = ['4/4', '3/4', '2/4', '6/8', 'mixed'];

/** Whether a rhythm level has rhythms in a time signature. */
export function levelFits(levelId, meter) {
  if (meter === 'mixed') return true;
  const lvl = LEVELS.find((l) => l.id === levelId);
  return !!lvl && Object.keys(lvl.cells).some((c) => cellFitsMeter(c, meter));
}

/** Step a level up or down (dir ±1), skipping levels with nothing in this time signature. */
export function stepLevel(levelId, dir, meter) {
  let id = levelId;
  for (;;) {
    const next = id + dir;
    if (next < 1 || next > LEVELS.length) return levelId;
    id = next;
    if (levelFits(id, meter)) return id;
  }
}

/**
 * A memory exercise in a chosen time signature. If the level has no
 * rhythms in it (6/8 is its own level), the nearest level that does is
 * used.
 */
export function memoryExercise({ level, meter = '4/4', pitches, bars, random = Math.random }) {
  const lvl = LEVELS.find((l) => l.id === level) || LEVELS[0];
  const meterId = meter === 'mixed' ? lvl.timeSigs[Math.floor(random() * lvl.timeSigs.length)] : meter;
  const fits = (l) => Object.keys(l.cells).some((c) => cellFitsMeter(c, meterId));
  const src = fits(lvl) ? lvl : [...LEVELS].reverse().find((l) => l.id < level && fits(l)) || LEVELS.find(fits);
  const cells = Object.fromEntries(Object.entries(src.cells).filter(([c]) => cellFitsMeter(c, meterId)));
  return { ...generateFromCells({ cells, meter: meterId, pitches, bars, random, allowRestStart: !!src.restStart }), level: lvl.id };
}

// ------------------------------------------------------------ auto rounds

/** How long you see the music in auto mode: a glance in seconds, or a number of times its length. */
export const VIEW_CHOICES = [
  ['0.5', 'A glance (½ second)'],
  ['1', '1 second'],
  ['2', '2 seconds'],
  ['x1', 'As long as the music'],
  ['x2', 'Twice as long'],
];

/**
 * When things happen in an auto round starting at time t (seconds): the
 * music shows (for a glance, or for its length in bars with soft clicks),
 * then it's hidden for a one-bar count-in, then you play. A glance happens
 * at the start of the count-in bar, so it doesn't add any waiting.
 */
export function roundTimeline(view, bars, barSec, t) {
  let countStart;
  let showEnd;
  if (String(view).startsWith('x')) {
    countStart = t + bars * Number(view.slice(1)) * barSec;
    showEnd = countStart;
  } else {
    countStart = t;
    showEnd = t + Math.min(Number(view), barSec * 0.75); // always some count-in with it hidden
  }
  const playStart = countStart + barSec;
  return { readStart: t, showEnd, countStart, playStart, playEnd: playStart + bars * barSec, readBars: Math.round((countStart - t) / barSec) };
}

/** A bar's verdict (from rhythm.js barVerdict) as one big word: PERFECT! / NICE! / OK / BAD. */
export function verdictWord(v) {
  if (v.level === 'good') return v.text === 'Great' || v.text === 'Good rest' ? 'PERFECT!' : 'NICE!';
  return v.level === 'close' ? 'OK' : 'BAD';
}
