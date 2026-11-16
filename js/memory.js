// Rhythm memory: read some bars, then play them from memory. How far
// you've got (rhythm level × how many bars at once) and the rules for
// moving up and down. No DOM code, so it can be unit tested.

export const MAX_BARS = 4;
export const PASS = 80; // a score this good counts towards moving up
export const FAIL = 60; // below this counts towards moving down

export function newMemory() {
  return { level: 1, bars: 1, passes: 0, fails: 0, best: {}, rounds: 0 };
}

/**
 * Record a round's score and decide what's next. Two passes in a row add
 * a bar to remember; at four bars, the rhythms get harder and you start
 * again from one bar. Two fails in a row take a bar away (or, at one bar,
 * go back a rhythm level, at two bars).
 * @returns {'more-bars'|'harder'|'fewer-bars'|'easier'|null} what changed
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
    if (m.bars < MAX_BARS) {
      m.bars++;
      return 'more-bars';
    }
    if (m.level < maxLevel) {
      m.level++;
      m.bars = 1;
      return 'harder';
    }
    return null;
  }
  m.passes = 0;
  if (score >= FAIL) return null;
  m.fails++;
  if (m.fails < 2) return null;
  m.fails = 0;
  if (m.bars > 1) {
    m.bars--;
    return 'fewer-bars';
  }
  if (m.level > 1) {
    m.level--;
    m.bars = 2;
    return 'easier';
  }
  return null;
}

/** Reading time for a round in seconds (null = take as long as you like). */
export function readingTime(setting, bars) {
  return setting === 'free' ? null : Number(setting) * bars;
}
