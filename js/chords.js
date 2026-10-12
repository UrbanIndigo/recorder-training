// Chord theory for the piano chord trainer: chord types, correct spelling,
// inversions, a voicing to show on the keyboard, and choosing the next
// chord to practise. No DOM code.

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const ACC = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };

/**
 * Chord types. Each tone is [semitones above the root, letter steps above
 * the root], so tones are spelled properly (a minor third is always a
 * third: E♭ minor is E♭ G♭ B♭).
 */
export const CHORD_TYPES = {
  major: { name: 'major', symbol: '', group: 'triads', tones: [[0, 0], [4, 2], [7, 4]], about: 'Root, major 3rd, perfect 5th: bright and stable.' },
  minor: { name: 'minor', symbol: 'm', group: 'triads', tones: [[0, 0], [3, 2], [7, 4]], about: 'Root, minor 3rd, perfect 5th: lower the major chord’s middle note by a semitone.' },
  dim: { name: 'diminished', symbol: '°', group: 'triads', tones: [[0, 0], [3, 2], [6, 4]], about: 'Two minor 3rds stacked: root, minor 3rd, diminished 5th. Tense.' },
  aug: { name: 'augmented', symbol: '+', group: 'triads', tones: [[0, 0], [4, 2], [8, 4]], about: 'Two major 3rds stacked: root, major 3rd, augmented 5th. Dreamy and unsettled.' },
  sus2: { name: 'sus2', symbol: 'sus2', group: 'sus', tones: [[0, 0], [2, 1], [7, 4]], about: 'The 3rd is replaced by the 2nd: root, major 2nd, perfect 5th. Open, neither major nor minor.' },
  sus4: { name: 'sus4', symbol: 'sus4', group: 'sus', tones: [[0, 0], [5, 3], [7, 4]], about: 'The 3rd is replaced by the 4th: root, perfect 4th, perfect 5th. Wants to resolve to major.' },
  six: { name: '6', symbol: '6', group: 'sus', tones: [[0, 0], [4, 2], [7, 4], [9, 5]], about: 'A major chord with an added major 6th.' },
  minor6: { name: 'minor 6', symbol: 'm6', group: 'sus', tones: [[0, 0], [3, 2], [7, 4], [9, 5]], about: 'A minor chord with an added major 6th.' },
  add9: { name: 'add9', symbol: 'add9', group: 'sus', tones: [[0, 0], [4, 2], [7, 4], [14, 8]], about: 'A major chord with the 9th (the 2nd, an octave up) added.' },
  dom7: { name: '7 (dominant 7th)', symbol: '7', group: 'sevenths', tones: [[0, 0], [4, 2], [7, 4], [10, 6]], about: 'A major chord plus a minor 7th. Pulls strongly to the chord a 5th below.' },
  maj7: { name: 'major 7th', symbol: 'maj7', group: 'sevenths', tones: [[0, 0], [4, 2], [7, 4], [11, 6]], about: 'A major chord plus a major 7th (a semitone below the octave). Soft and jazzy.' },
  min7: { name: 'minor 7th', symbol: 'm7', group: 'sevenths', tones: [[0, 0], [3, 2], [7, 4], [10, 6]], about: 'A minor chord plus a minor 7th.' },
  halfdim: { name: 'half-diminished (m7♭5)', symbol: 'ø7', group: 'sevenths', tones: [[0, 0], [3, 2], [6, 4], [10, 6]], about: 'A diminished triad plus a minor 7th.' },
  dim7: { name: 'diminished 7th', symbol: '°7', group: 'sevenths', tones: [[0, 0], [3, 2], [6, 4], [9, 6]], about: 'Three minor 3rds stacked. Every note is the same distance apart.' },
  minMaj7: { name: 'minor-major 7th', symbol: 'm(maj7)', group: 'sevenths', tones: [[0, 0], [3, 2], [7, 4], [11, 6]], about: 'A minor chord plus a major 7th. Dark and dramatic.' },
  sus7: { name: '7sus4', symbol: '7sus4', group: 'sevenths', tones: [[0, 0], [5, 3], [7, 4], [10, 6]], about: 'A sus4 chord plus a minor 7th.' },
  dom9: { name: '9', symbol: '9', group: 'ninths', tones: [[0, 0], [4, 2], [7, 4], [10, 6], [14, 8]], about: 'A dominant 7th with the 9th added on top. The 5th is often left out.', optional: [2] },
  maj9: { name: 'major 9th', symbol: 'maj9', group: 'ninths', tones: [[0, 0], [4, 2], [7, 4], [11, 6], [14, 8]], about: 'A major 7th with the 9th added. The 5th is often left out.', optional: [2] },
  min9: { name: 'minor 9th', symbol: 'm9', group: 'ninths', tones: [[0, 0], [3, 2], [7, 4], [10, 6], [14, 8]], about: 'A minor 7th with the 9th added. The 5th is often left out.', optional: [2] },
};

export const GROUPS = {
  triads: 'Triads (major, minor, diminished, augmented)',
  sus: 'Suspended & added (sus2, sus4, 6, m6, add9)',
  sevenths: '7th chords',
  ninths: '9th chords',
};

export const INVERSION_NAMES = ['root position', '1st inversion', '2nd inversion', '3rd inversion'];

/** How many inversions to practise: the 9th of a 9 chord isn't put in the bass. */
export function inversionsOf(type) {
  const t = CHORD_TYPES[type];
  return t.group === 'ninths' || type === 'add9' ? 3 : t.tones.length;
}

// Roots, spelled the usual way. Diminished chords sound and read better
// from sharps (G♯° not A♭°), augmented ones from flats (G♭+ not F♯+).
const ROOT_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const ROOT_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const ROOT_AUG = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const MINOR_SHARP_PCS = new Set([1, 6, 8]); // C♯m, F♯m, G♯m rather than D♭m, G♭m, A♭m

export function rootName(pc, type) {
  const t = CHORD_TYPES[type];
  const isDim = t.tones.some(([s]) => s === 6) && t.tones.some(([s]) => s === 3);
  const isMinor = t.tones.some(([s, l]) => s === 3 && l === 2);
  if (isDim) return ROOT_SHARP[pc];
  if (type === 'aug') return ROOT_AUG[pc];
  if (isMinor && MINOR_SHARP_PCS.has(pc)) return ROOT_SHARP[pc];
  return ROOT_FLAT[pc];
}

function parseName(name) {
  const letter = name[0];
  const acc = name.slice(1);
  const shift = { '': 0, '♯': 1, '♭': -1, '𝄪': 2, '𝄫': -2 }[acc];
  return { letterIdx: LETTERS.indexOf(letter), pc: (LETTER_PC[LETTERS.indexOf(letter)] + shift + 12) % 12 };
}

/** Note names of a chord, root first, spelled properly. */
export function spellChord(rootPc, type) {
  const root = parseName(rootName(rootPc, type));
  return CHORD_TYPES[type].tones.map(([semis, steps]) => {
    const letterIdx = (root.letterIdx + steps) % 7;
    const pc = (root.pc + semis) % 12;
    let diff = pc - LETTER_PC[letterIdx];
    if (diff > 6) diff -= 12;
    if (diff < -6) diff += 12;
    return { name: LETTERS[letterIdx] + ACC[diff], pc, letter: LETTERS[letterIdx] };
  });
}

/**
 * A chord to practise.
 * @returns {{rootPc, type, inversion, root, tones, bass, symbol, name}}
 */
export function makeChord(rootPc, type, inversion) {
  const tones = spellChord(rootPc, type);
  const t = CHORD_TYPES[type];
  const root = tones[0].name;
  const bass = tones[inversion];
  const symbol = `${root}${t.symbol}${inversion ? `/${bass.name}` : ''}`;
  const name = `${root} ${t.name}`;
  return { rootPc, type, inversion, root, tones, bass, symbol, name, inversionName: INVERSION_NAMES[inversion] };
}

/**
 * A close-position voicing to show: the bass note in the octave below
 * middle C, the other notes stacked closely above it.
 * @returns {number[]} MIDI notes, lowest first
 */
export function voicing(chord) {
  const order = [...chord.tones.slice(chord.inversion), ...chord.tones.slice(0, chord.inversion)];
  let prev = 48 + order[0].pc; // C3..B3
  if (prev > 55) prev -= 12; // keep it from sitting too high
  const notes = [prev];
  for (const t of order.slice(1)) {
    let m = prev - (((prev % 12) - t.pc + 12) % 12) + 12;
    while (m <= prev) m += 12;
    notes.push(m);
    prev = m;
  }
  return notes;
}

// -------------------------------------------------------------- practice

export const WHITE_ROOTS = [0, 2, 4, 5, 7, 9, 11];
export const ALL_ROOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** Ready-made sets to practise, from easy to everything. */
export const PRESETS = [
  { id: 'major', name: 'Major triads', types: ['major'], inversions: [0], roots: 'white' },
  { id: 'majmin', name: 'Major & minor triads', types: ['major', 'minor'], inversions: [0], roots: 'all' },
  { id: 'inversions', name: 'Triad inversions', types: ['major', 'minor'], inversions: [0, 1, 2], roots: 'all' },
  { id: 'triads', name: 'All triads + inversions', types: ['major', 'minor', 'dim', 'aug'], inversions: [0, 1, 2], roots: 'all' },
  { id: 'sus', name: 'Sus & added chords', types: ['sus2', 'sus4', 'six', 'minor6', 'add9'], inversions: [0, 1, 2], roots: 'all' },
  { id: 'sevenths', name: '7th chords', types: ['dom7', 'maj7', 'min7', 'halfdim', 'dim7'], inversions: [0], roots: 'all' },
  { id: 'seventhInv', name: '7th chord inversions', types: ['dom7', 'maj7', 'min7', 'halfdim', 'dim7', 'minMaj7', 'sus7'], inversions: [0, 1, 2, 3], roots: 'all' },
  { id: 'everything', name: 'Everything', types: Object.keys(CHORD_TYPES), inversions: [0, 1, 2, 3], roots: 'all' },
];

export function newChordStats() {
  return { items: {}, total: 0, correct: 0 }; // items: key -> { tries, right, ema, avgMs }
}

const itemKey = (type, inversion) => `${type}|${inversion}`;

/**
 * Pick the next chord: weak chord types and inversions come up more often,
 * and a missed chord comes back a couple of chords later.
 * @param {{types: string[], inversions: number[], roots: number[]}} settings
 */
export function nextChord(stats, settings, queue, lastChord, random = Math.random) {
  const due = queue.findIndex((q) => q.due <= stats.total);
  if (due !== -1) {
    const [q] = queue.splice(due, 1);
    return { ...makeChord(q.rootPc, q.type, q.inversion), again: true };
  }
  const items = [];
  for (const type of settings.types) {
    for (const inv of settings.inversions) {
      if (inv >= inversionsOf(type)) continue;
      const s = stats.items[itemKey(type, inv)];
      const weight = 1 + 3 * (1 - (s ? s.ema : 0.5)) + (s ? 0 : 1.5);
      items.push({ type, inv, weight });
    }
  }
  if (!items.length) items.push({ type: 'major', inv: 0, weight: 1 });
  for (let attempt = 0; attempt < 10; attempt++) {
    let r = random() * items.reduce((a, i) => a + i.weight, 0);
    let pick = items[0];
    for (const it of items) {
      r -= it.weight;
      if (r <= 0) {
        pick = it;
        break;
      }
    }
    const rootPc = settings.roots[Math.floor(random() * settings.roots.length)];
    const chord = makeChord(rootPc, pick.type, pick.inv);
    if (!lastChord || chord.symbol !== lastChord.symbol || items.length * settings.roots.length === 1) return chord;
  }
  return makeChord(settings.roots[0], items[0].type, items[0].inv);
}

/** Record an attempt. Missed chords are queued to come back 2 chords later. */
export function recordChord(stats, queue, chord, correct, ms) {
  stats.total++;
  if (correct) stats.correct++;
  const s = (stats.items[itemKey(chord.type, chord.inversion)] ||= { tries: 0, right: 0, ema: 0.5, avgMs: null });
  s.tries++;
  if (correct) {
    s.right++;
    s.avgMs = s.avgMs == null ? ms : Math.round(s.avgMs * 0.7 + ms * 0.3);
  }
  s.ema = s.ema * 0.7 + (correct ? 0.3 : 0);
  if (!correct && !chord.again) queue.push({ rootPc: chord.rootPc, type: chord.type, inversion: chord.inversion, due: stats.total + 2 });
}

/** Per chord type and inversion: accuracy and speed, weakest first. */
export function statsTable(stats) {
  return Object.entries(stats.items)
    .map(([key, s]) => {
      const [type, inv] = key.split('|');
      return { type, inversion: Number(inv), label: `${CHORD_TYPES[type].name}, ${INVERSION_NAMES[inv]}`, accuracy: s.right / s.tries, tries: s.tries, avgMs: s.avgMs };
    })
    .sort((a, b) => a.accuracy - b.accuracy || b.tries - a.tries);
}
