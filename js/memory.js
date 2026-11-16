// Rhythm memory: read some bars, then play them from memory. How far
// you've got (rhythm level, and how many bars at once, which you choose)
// and the rules for moving up and down. No DOM code, so it can be unit tested.

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
