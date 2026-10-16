// Ear training by scale degree: hear a key, then name notes by their place
// in it (do re mi, or 1–7). Degrees, levels, keys, question choice,
// progress, melodies, reference songs and recorder fingerings. No DOM or
// audio code, so it can be unit tested.

/** Semitones above the tonic. Low degrees ("L5") sit below it. */
export const DEGREES = {
  L5: -5, L6: -3, L7: -1,
  1: 0, 2: 2, b3: 3, 3: 4, 4: 5, '#4': 6, 5: 7, b6: 8, 6: 9, b7: 10, 7: 11, "1'": 12,
};

/** Every degree, low to high. */
export const ORDER = ['L5', 'L6', 'L7', '1', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7', "1'"];

const SOLFEGE = {
  L5: 'so', L6: 'la', L7: 'ti', 1: 'do', 2: 're', b3: 'me', 3: 'mi', 4: 'fa', '#4': 'fi', 5: 'so', b6: 'le', 6: 'la', b7: 'te', 7: 'ti', "1'": 'do',
};

/**
 * How a degree is shown. Low degrees get a mark below (so₁ / 5₁), the
 * octave a mark above (do' / 1').
 * @param style 'solfege' | 'numbers'
 */
export function degreeLabel(deg, style = 'solfege') {
  const low = deg.startsWith('L');
  if (style === 'solfege') {
    const s = SOLFEGE[deg];
    return low ? `${s}₁` : deg === "1'" ? "do'" : s;
  }
  const n = low ? deg.slice(1) : deg;
  const pretty = n.replace('b', '♭').replace('#', '♯');
  return low ? `${pretty}₁` : pretty;
}

/** Spoken-style name for feedback ("low so", "flat 3"). */
export function degreeLongName(deg, style = 'solfege') {
  const low = deg.startsWith('L');
  const base = degreeLabel(low ? deg.slice(1) : deg, style).replace('₁', '');
  return low ? `low ${base}` : base;
}

/** The levels: which degrees are in play. */
export const LEVELS = [
  { id: 1, set: ['1', '5'] },
  { id: 2, set: ['1', '3', '5'] },
  { id: 3, set: ['1', '2', '3', '5'] },
  { id: 4, set: ['1', '2', '3', '4', '5'] },
  { id: 5, set: ['1', '2', '3', '4', '5', '6'] },
  { id: 6, set: ['1', '2', '3', '4', '5', '6', '7', "1'"] },
  { id: 7, set: ['L5', 'L6', 'L7', '1', '2', '3', '4', '5', '6', '7', "1'"] },
  { id: 8, set: ['L5', 'L6', 'L7', '1', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7', "1'"] },
];

export const levelSet = (level) => LEVELS[Math.max(1, Math.min(LEVELS.length, level)) - 1].set;

/** Keys, with the recorder-friendly ones first. Value: pitch class (C = 0). */
export const KEYS = [
  { name: 'C', pc: 0 }, { name: 'F', pc: 5 }, { name: 'G', pc: 7 }, { name: 'D', pc: 2 }, { name: 'B♭', pc: 10 },
  { name: 'A', pc: 9 }, { name: 'E♭', pc: 3 }, { name: 'E', pc: 4 }, { name: 'A♭', pc: 8 }, { name: 'B', pc: 11 },
  { name: 'D♭', pc: 1 }, { name: 'F♯', pc: 6 },
];
export const RECORDER_KEYS = ['C', 'F', 'G', 'D', 'B♭'];
export const keyByName = (name) => KEYS.find((k) => k.name === name) || KEYS[0];

/**
 * Where to put the tonic so every degree in the set fits in the range
 * (a recorder's, or a comfortable middle range). Picks the lowest octave
 * that fits; if none fits, the one that sticks out least.
 */
export function tonicFor(keyName, set, range = { low: 55, high: 84 }) {
  const pc = keyByName(keyName).pc;
  const offs = set.map((d) => DEGREES[d]);
  const lo = Math.min(...offs);
  const hi = Math.max(...offs);
  let best = null;
  for (let t = pc + 24; t <= 108; t += 12) {
    const over = Math.max(0, range.low - (t + lo)) + Math.max(0, t + hi - range.high);
    if (!best || over < best.over) best = { t, over };
    if (over === 0) return t;
  }
  return best.t;
}

/** MIDI note of a degree for a tonic. */
export const degreeMidi = (tonic, deg) => tonic + DEGREES[deg];

/** Pick a key for a question: fixed, or random among recorder keys or all keys. */
export function pickKey(setting, random = Math.random) {
  if (setting === 'random-recorder') return RECORDER_KEYS[Math.floor(random() * RECORDER_KEYS.length)];
  if (setting === 'random-all') return KEYS[Math.floor(random() * KEYS.length)].name;
  return keyByName(setting).name;
}

// ------------------------------------------------------------- progress

export function newProgress() {
  return {
    level: 1,
    auto: true, // move up a level automatically
    recent: [], // right/wrong of the last answers at this level
    stats: {}, // drill -> key -> degree -> {n, right, ms}
    days: {}, // 'YYYY-MM-DD' -> questions answered
  };
}

/** Accuracy and speed of each degree (in one key, or all keys), for a drill. */
export function degreeStats(progress, drill = 'recognise', key = null) {
  const out = {};
  const byKey = progress.stats[drill] || {};
  for (const [k, degs] of Object.entries(byKey)) {
    if (key && k !== key) continue;
    for (const [d, s] of Object.entries(degs)) {
      const o = (out[d] ||= { n: 0, right: 0, ms: 0 });
      o.n += s.n;
      o.right += s.right;
      o.ms += s.ms;
    }
  }
  for (const o of Object.values(out)) {
    o.acc = o.n ? o.right / o.n : 0;
    o.avgMs = o.n ? o.ms / o.n : 0;
  }
  return out;
}

/** The weakest degrees of a set (lowest accuracy, needing a few answers first). */
export function weakest(progress, set, n = 2, drill = 'recognise') {
  const st = degreeStats(progress, drill);
  return set
    .filter((d) => st[d]?.n >= 3)
    .sort((a, b) => st[a].acc - st[b].acc || st[b].avgMs - st[a].avgMs)
    .filter((d) => st[d].acc < 0.95)
    .slice(0, n);
}

/**
 * The next degree to ask: half the time one of the two weakest, otherwise
 * any in the set; never the same one three times running.
 */
export function pickDegree(progress, set, random = Math.random, last = []) {
  const weak = weakest(progress, set);
  let pool = weak.length && random() < 0.5 ? weak : set;
  if (last.length >= 2 && last.at(-1) === last.at(-2)) pool = pool.filter((d) => d !== last.at(-1));
  if (!pool.length) pool = set.filter((d) => d !== last.at(-1));
  return pool[Math.floor(random() * pool.length)];
}

const today = (date = new Date()) => date.toISOString().slice(0, 10);

/**
 * Record an answer. Moves up a level (when auto) after 90% or better over
 * the last 20 questions at the current level.
 * @returns {{levelUp: boolean}}
 */
export function recordAnswer(progress, { drill = 'recognise', key, degree, right, ms = 0, date = new Date() }) {
  const k = ((progress.stats[drill] ||= {})[key] ||= {});
  const s = (k[degree] ||= { n: 0, right: 0, ms: 0 });
  s.n++;
  if (right) s.right++;
  s.ms += Math.min(ms, 20000);
  progress.days[today(date)] = (progress.days[today(date)] || 0) + 1;
  if (drill !== 'recognise') return { levelUp: false };
  progress.recent.push(!!right);
  if (progress.recent.length > 20) progress.recent.shift();
  if (progress.auto && progress.level < LEVELS.length && progress.recent.length >= 20 && progress.recent.filter(Boolean).length >= 18) {
    progress.level++;
    progress.recent = [];
    return { levelUp: true };
  }
  return { levelUp: false };
}

/** Days in a row with some practice, ending today (or yesterday, if not yet today). */
export function streak(progress, date = new Date()) {
  let d = new Date(date);
  if (!progress.days[today(d)]) d.setUTCDate(d.getUTCDate() - 1);
  let n = 0;
  while (progress.days[today(d)]) {
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}

// -------------------------------------------------------------- melodies

/**
 * A short melody from the degrees in play: mostly steps between
 * neighbouring degrees of the set, the odd leap, often starting and
 * ending on the tonic.
 */
export function makeMelody(set, length, random = Math.random) {
  const sorted = [...set].sort((a, b) => DEGREES[a] - DEGREES[b]);
  const home = sorted.indexOf('1');
  let i = random() < 0.6 ? home : Math.floor(random() * sorted.length);
  const out = [sorted[i]];
  while (out.length < length) {
    const leap = random() < 0.2;
    const step = (random() < 0.5 ? -1 : 1) * (leap ? 2 + Math.floor(random() * 2) : 1);
    let j = i + step;
    if (j < 0 || j >= sorted.length) j = i - step;
    i = Math.max(0, Math.min(sorted.length - 1, j));
    out.push(sorted[i]);
  }
  if (length >= 4 && random() < 0.5) out[out.length - 1] = '1';
  return out;
}

/** Melody length for a level: 3 notes at first, up to 8. */
export const melodyLength = (level, random = Math.random) => Math.min(8, 3 + Math.floor((level - 1) / 2) + (level >= 6 ? Math.floor(random() * 2) : 0));

/** Which notes of an answer are right. */
export const compareMelody = (answer, target) => target.map((d, i) => answer[i] === d);

// ------------------------------------------------------- reference songs

// Anchor songs (public domain) with the scale degree of every syllable.
// Each note: [syllable, degree, beats].
const p = (syl, degs, beats) => syl.split(' ').map((s, i) => [s, degs[i], beats?.[i] ?? 1]);

export const SONGS = [
  {
    id: 'twinkle', title: 'Twinkle Twinkle Little Star', starts: '1', meter: 4,
    phrases: [
      p('Twin- kle twin- kle lit- tle star', ['1', '1', '5', '5', '6', '6', '5'], [1, 1, 1, 1, 1, 1, 2]),
      p('How I won- der what you are', ['4', '4', '3', '3', '2', '2', '1'], [1, 1, 1, 1, 1, 1, 2]),
      p('Up a- bove the world so high', ['5', '5', '4', '4', '3', '3', '2'], [1, 1, 1, 1, 1, 1, 2]),
      p('Like a dia- mond in the sky', ['5', '5', '4', '4', '3', '3', '2'], [1, 1, 1, 1, 1, 1, 2]),
    ],
  },
  {
    id: 'mary', title: 'Mary Had a Little Lamb', starts: '3', meter: 4,
    phrases: [
      p('Ma- ry had a lit- tle lamb', ['3', '2', '1', '2', '3', '3', '3'], [1, 1, 1, 1, 1, 1, 2]),
      p('lit- tle lamb', ['2', '2', '2'], [1, 1, 2]),
      p('lit- tle lamb', ['3', '5', '5'], [1, 1, 2]),
      p('Ma- ry had a lit- tle lamb', ['3', '2', '1', '2', '3', '3', '3'], [1, 1, 1, 1, 1, 1, 2]),
      p('its fleece was white as snow', ['3', '2', '2', '3', '2', '1'], [1, 1, 1, 1, 1, 3]),
    ],
  },
  {
    id: 'frere', title: 'Frère Jacques', starts: '1', meter: 4,
    phrases: [
      p('Frè- re Jac- ques', ['1', '2', '3', '1']),
      p('Frè- re Jac- ques', ['1', '2', '3', '1']),
      p('Dor- mez vous', ['3', '4', '5'], [1, 1, 2]),
      p('Dor- mez vous', ['3', '4', '5'], [1, 1, 2]),
      p('Son- nez les ma- ti- nes', ['5', '6', '5', '4', '3', '1'], [0.5, 0.5, 0.5, 0.5, 1, 1]),
      p('Son- nez les ma- ti- nes', ['5', '6', '5', '4', '3', '1'], [0.5, 0.5, 0.5, 0.5, 1, 1]),
      p('Din dan don', ['1', 'L5', '1'], [1, 1, 2]),
      p('Din dan don', ['1', 'L5', '1'], [1, 1, 2]),
    ],
  },
  {
    id: 'birthday', title: 'Happy Birthday', starts: 'L5', meter: 3,
    phrases: [
      p('Hap- py birth- day to you', ['L5', 'L5', 'L6', 'L5', '1', 'L7'], [0.75, 0.25, 1, 1, 1, 2]),
      p('Hap- py birth- day to you', ['L5', 'L5', 'L6', 'L5', '2', '1'], [0.75, 0.25, 1, 1, 1, 2]),
      p('Hap- py birth- day dear friend —', ['L5', 'L5', '5', '3', '1', 'L7', 'L6'], [0.75, 0.25, 1, 1, 1, 1, 2]),
      p('Hap- py birth- day to you', ['4', '4', '3', '1', '2', '1'], [0.75, 0.25, 1, 1, 1, 2]),
    ],
  },
  {
    id: 'saints', title: 'When the Saints Go Marching In', starts: '1', meter: 4,
    phrases: [
      p('Oh when the saints', ['1', '3', '4', '5'], [1, 1, 1, 4]),
      p('Oh when the saints', ['1', '3', '4', '5'], [1, 1, 1, 4]),
      p('Oh when the saints go march- ing in', ['1', '3', '4', '5', '3', '1', '3', '2'], [1, 1, 1, 2, 1, 1, 1, 3]),
      p('Oh Lord I want to be in that num- ber', ['3', '3', '2', '1', '1', '3', '5', '5', '5', '4'], [1, 1, 1, 2, 1, 1, 1, 1, 1, 3]),
      p('When the saints go march- ing in', ['3', '4', '5', '3', '1', '2', '1'], [1, 1, 1, 1, 1, 1, 3]),
    ],
  },
  {
    id: 'grace', title: 'Amazing Grace', starts: 'L5', meter: 3,
    phrases: [
      p('A- maz- ing grace how sweet the sound', ['L5', '1', '3', '3', '2', '1', 'L6', 'L5'], [1, 2, 0.5, 0.5, 2, 1, 2, 1]),
      p('That saved a wretch like me', ['L5', '1', '3', '3', '2', '5'], [1, 2, 0.5, 0.5, 2, 3]),
      p('I once was lost but now am found', ['5', '3', '1', '3', '2', '1', 'L6', 'L5'], [1, 2, 0.5, 0.5, 2, 1, 2, 1]),
      p('Was blind but now I see', ['L5', '1', '3', '3', '2', '1'], [1, 2, 0.5, 0.5, 2, 3]),
    ],
  },
];

/** Interval anchor songs: titles only. */
export const INTERVAL_SONGS = [
  ['Minor 2nd', 'Jaws; Für Elise'],
  ['Major 2nd', 'Happy Birthday'],
  ['Minor 3rd', 'Greensleeves'],
  ['Major 3rd', 'When the Saints Go Marching In'],
  ['Perfect 4th', 'Here Comes the Bride; Amazing Grace'],
  ['Tritone', 'The Simpsons theme'],
  ['Perfect 5th', 'Twinkle Twinkle; Star Wars'],
  ['Minor 6th', 'The Entertainer'],
  ['Major 6th', 'My Bonnie Lies over the Ocean'],
  ['Minor 7th', 'Star Trek (original series)'],
  ['Major 7th', 'Take On Me'],
  ['Octave', 'Over the Rainbow'],
];

// --------------------------------------------------------- fingerings

/**
 * Baroque fingerings, by semitones above the recorder's lowest note (the
 * same patterns on C and F recorders). Each is [thumb, holes 1–7]:
 * 1 covered, 0 open, 0.5 half (a pinched thumb, or one of a double hole).
 */
const FINGERINGS = [
  [1, 1, 1, 1, 1, 1, 1, 1], // C
  [1, 1, 1, 1, 1, 1, 1, 0.5], // C♯
  [1, 1, 1, 1, 1, 1, 1, 0], // D
  [1, 1, 1, 1, 1, 1, 0.5, 0], // D♯
  [1, 1, 1, 1, 1, 1, 0, 0], // E
  [1, 1, 1, 1, 1, 0, 1, 1], // F
  [1, 1, 1, 1, 0, 1, 1, 0], // F♯
  [1, 1, 1, 1, 0, 0, 0, 0], // G
  [1, 1, 1, 0, 1, 1, 0.5, 0], // G♯
  [1, 1, 1, 0, 0, 0, 0, 0], // A
  [1, 1, 0, 1, 1, 0, 0, 0], // B♭
  [1, 1, 0, 0, 0, 0, 0, 0], // B
  [1, 0, 1, 0, 0, 0, 0, 0], // C'
  [0, 1, 1, 0, 0, 0, 0, 0], // C♯'
  [0, 0, 1, 0, 0, 0, 0, 0], // D'
  [0, 0, 1, 1, 1, 1, 1, 0], // D♯'
  [0.5, 1, 1, 1, 1, 1, 0, 0], // E'
  [0.5, 1, 1, 1, 1, 0, 1, 0], // F'
  [0.5, 1, 1, 1, 0, 1, 0, 0], // F♯'
  [0.5, 1, 1, 1, 0, 0, 0, 0], // G'
  [0.5, 1, 1, 0, 1, 0, 0, 0], // G♯'
  [0.5, 1, 1, 0, 0, 0, 0, 0], // A'
];

/** The fingering for a sounding note on a recorder, or null if out of the chart's range. */
export function fingeringFor(recorder, midi) {
  return FINGERINGS[midi - recorder.lowest] || null;
}
