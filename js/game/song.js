// Beat Ward songs: each level is a chiptune with a fixed shape (key,
// chords, sections, tempo) but its rhythms are generated fresh on every
// play, so a song can't simply be memorised. No DOM or audio code.

import { generateFromCells, METERS } from '../rhythm.js?v=3.7';

/**
 * The wards, easiest first. `cells` are rhythm patterns from rhythm.js.
 * Each ward ends in a boss fight; during choruses the boss attacks, using
 * its gimmick: 'quake' jolts the page on each bar, 'fog' hides the next
 * line of music until `fog` beats before it starts, 'both' does both.
 */
export const LEVELS = [
  {
    id: 1, name: 'CHECK-UP', blurb: 'Quarter and half notes. Tap on the beat.',
    boss: { name: 'THE SNIFFLE', body: '#6fd16f', dark: '#2f7a3a', light: '#c4f7b4', eyes: 2, scale: 2 },
    bpm: 84, meter: '4/4', hands: 1, key: 0, minor: false, prog: [0, 7, 9, 5],
    cells: { quarter: 5, half: 2, quarterRest: 1 },
    chorus: { quarter: 4, half: 1, eighths: 1 },
  },
  {
    id: 2, name: 'PULSE', blurb: 'Eighth notes join in.',
    boss: { name: 'HICCUP', body: '#ffd23f', dark: '#a8800f', light: '#fff2a8', eyes: 1, scale: 2 },
    bpm: 92, meter: '4/4', hands: 1, key: 7, minor: false, prog: [0, 5, 9, 7],
    cells: { quarter: 3, eighths: 3, half: 1, quarterRest: 1 },
    chorus: { quarter: 2, eighths: 4, restEighth: 1 },
  },
  {
    id: 3, name: 'SKIPPED BEAT', blurb: 'Syncopation and rests. Feel the off-beats.',
    boss: { name: 'ARRHYTHMIA', body: '#b56bff', dark: '#5e2a99', light: '#dcbcff', eyes: 2, scale: 2, gimmick: 'quake' },
    bpm: 96, meter: '4/4', hands: 1, key: 9, minor: true, prog: [0, 5, 7, 3],
    cells: { quarter: 2, eighths: 2, restEighth: 2, syncopation: 2, dottedQuarterEighth: 2, quarterRest: 1 },
    chorus: { eighths: 2, syncopation: 3, offbeatQuarters: 1, eighthRest: 2 },
  },
  {
    id: 4, name: 'FEVER', blurb: 'Sixteenths and dotted rhythms. Faster.',
    boss: { name: 'FEVER BUG', body: '#ff7a3d', dark: '#a8361a', light: '#ffc6a3', eyes: 2, scale: 2, gimmick: 'quake' },
    bpm: 104, meter: '4/4', hands: 1, key: 2, minor: false, prog: [0, 9, 5, 7],
    cells: { quarter: 2, eighths: 2, eighthTwoSixteenths: 2, twoSixteenthsEighth: 2, sixteenths: 1, dottedEighthSixteenth: 2 },
    chorus: { eighths: 1, sixteenths: 2, scotchSnap: 2, sixteenthEighthSixteenth: 2, dottedEighthSixteenth: 1 },
  },
  {
    id: 5, name: 'TRIPLET WARD', blurb: 'Triplets mixed with straight notes. Keep them even.',
    boss: { name: 'TRI-CLOPS', body: '#3fd6c7', dark: '#1d7a73', light: '#b4f7f0', eyes: 3, scale: 2, gimmick: 'fog', fog: 2 },
    bpm: 98, meter: '4/4', hands: 1, key: 5, minor: true, prog: [0, 8, 3, 10],
    cells: { quarter: 2, eighths: 2, triplet: 3, tripletRestMiddle: 1, quarterTriplet: 1 },
    chorus: { triplet: 3, tripletRestFirst: 2, eighths: 1, sixteenthTriplet: 1 },
  },
  {
    id: 6, name: 'TWO HANDS', blurb: 'Left hand plays the bass, right hand the tune. Sometimes together!',
    boss: { name: 'TWIN GERMS', body: '#ff5dc8', dark: '#9a2475', light: '#ffbfe9', eyes: 2, scale: 2, twin: true },
    bpm: 88, meter: '4/4', hands: 2, key: 0, minor: false, prog: [0, 9, 5, 7],
    cells: { quarter: 3, eighths: 3, half: 1, restEighth: 1 },
    chorus: { eighths: 3, syncopation: 2, quarter: 2 },
    left: { quarter: 3, half: 2, halfRest: 1 },
  },
  {
    id: 7, name: 'NIGHT SHIFT', blurb: 'Two hands in 6/8. Rock in twos and threes.',
    boss: { name: 'NIGHT TERROR', body: '#5a6bf0', dark: '#262f86', light: '#b0baff', eyes: 2, scale: 2, gimmick: 'fog', fog: 1.5 },
    bpm: 66, meter: '6/8', hands: 2, key: 4, minor: true, prog: [0, 5, 7, 0],
    cells: { c_threeEighths: 3, c_quarterEighth: 3, c_eighthQuarter: 2, c_dottedQuarter: 1, c_siciliano: 1 },
    chorus: { c_threeEighths: 2, c_siciliano: 2, c_sixteenths: 2, c_quarterEighth: 1 },
    left: { c_dottedQuarter: 4, c_quarterEighth: 1, c_dottedQuarterRest: 1 },
  },
  {
    id: 8, name: 'CODE BLUE', blurb: 'Everything, fast, both hands. Good luck, doctor.',
    boss: { name: 'CODE BLUE', body: '#3f8cff', dark: '#1b3f99', light: '#b0d2ff', eyes: 3, scale: 3, gimmick: 'both', fog: 1.5 },
    bpm: 124, meter: '4/4', hands: 2, key: 10, minor: true, prog: [0, 8, 10, 7],
    cells: { eighths: 2, sixteenths: 2, syncopation: 2, eighthTwoSixteenths: 2, triplet: 1, dottedEighthSixteenth: 2 },
    chorus: { sixteenths: 2, scotchSnap: 2, sixteenthEighthSixteenth: 2, tiedSyncopation: 1, triplet: 1 },
    left: { quarter: 3, eighths: 2, half: 1, eighthRest: 1 },
  },
];

/** The BPM range the tempo control allows. */
export const MIN_BPM = 40;
export const MAX_BPM = 200;

/**
 * The tempo to offer next for a ward. A new ward starts at 70% of its
 * tempo so its new rhythms can be learnt; each win moves it up by 15%
 * of the ward's tempo, up to full speed. `wonAt` is the fastest BPM the
 * boss has been beaten at (or null).
 */
export function nextBpm(level, wonAt) {
  if (wonAt == null) return Math.round(level.bpm * 0.7);
  if (wonAt >= level.bpm) return wonAt;
  return Math.min(level.bpm, wonAt + Math.round(level.bpm * 0.15));
}

const SECTIONS = ['intro', 'verse', 'verse', 'chorus', 'verse', 'chorus']; // 4 bars each
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

/**
 * When each of a ward's new rhythms (ones no easier ward uses) first
 * appears: the bar number, spread over the first verse to the first chorus
 * (bars 4 to 15), in the order the level lists them.
 */
export function introductions(level) {
  const seen = new Set(LEVELS.filter((l) => l.id < level.id).flatMap((l) => [...Object.keys(l.cells), ...Object.keys(l.chorus)]));
  const fresh = [...new Set([...Object.keys(level.cells), ...Object.keys(level.chorus)])].filter((c) => !seen.has(c));
  return new Map(fresh.map((c, i) => [c, 4 + Math.floor((i * 12) / fresh.length)]));
}

/**
 * Add one bar of a hand's rhythm to a score (as it's drawn) and its
 * sounding notes to `notes` (tied notes join into one). Score events point
 * at their note through `note`.
 */
export function writeBar(notes, score, lane, events, barStart, pitchOf) {
  let last = null;
  for (const e of events) {
    const ev = { beat: barStart + e.beat, beats: e.beats, cell: e.cell, rest: e.rest, dotted: e.dotted, dots: e.dots, written: e.written, tuplet: e.tuplet, tupletId: e.tupletId != null ? `${barStart}:${e.tupletId}` : undefined, beamGroup: e.beamGroup != null ? `${barStart}:${e.beamGroup}` : undefined, tieNext: e.tieNext, tied: e.tied, barRest: e.barRest };
    if (!e.rest) {
      // A tie can come in from the previous bar.
      if (e.tied && !last) last = notes.findLast((n) => n.lane === lane) || null;
      if (e.tied && last) {
        last.dur += e.beats;
      } else {
        last = { beat: barStart + e.beat, lane, midi: pitchOf(e), dur: e.beats, cell: e.cell };
        notes.push(last);
      }
      ev.note = last;
    }
    score[lane].push(ev);
  }
}

/**
 * Tie the last note of one bar across the bar line to the first note of
 * the next (copies; the originals are untouched). Returns null when the
 * bars don't allow it (a rest either side, tuplets, or a tie already there).
 */
export function tieAcross(barA, barB) {
  const a = barA.at(-1);
  const b = barB[0];
  const ok = (e) => e && !e.rest && !e.tuplet && !e.barRest;
  if (!ok(a) || !ok(b) || a.tieNext || b.tied || a.beats > 2 || b.beats > 2) return null;
  return [[...barA.slice(0, -1), { ...a, tieNext: true }], [{ ...b, tied: true }, ...barB.slice(1)]];
}

/** A simple left-hand part for wards written for one hand, when played with two. */
export function defaultLeft(level) {
  return level.meter === '6/8' ? { c_dottedQuarter: 4, c_quarterEighth: 1, c_dottedQuarterRest: 1 } : { half: 3, quarter: 2, halfRest: 1 };
}

/** A small, fast, seedable random number generator. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The triad on a chord root (in semitones above the key), in this key. */
function chordTones(level, root) {
  const scale = level.minor ? MINOR : MAJOR;
  const idx = scale.indexOf(root % 12);
  if (idx === -1) return [root, root + 4, root + 7];
  return [0, 2, 4].map((k) => {
    const j = idx + k;
    return scale[j % 7] + 12 * Math.floor(j / 7);
  });
}

/**
 * Build a song for a level. The same seed gives the same song.
 * @returns {{level, bpm, beatSec, meter, bars, countInBars, notes, score, drums, bass, chords, length}}
 *   notes: [{time, beat, lane: 'R'|'L', midi, dur}] times in seconds from the song start
 */
export function makeSong(level, seed = Date.now(), { speed = 1, bpm: chosenBpm = null, lesson = null, hands: chosenHands = null } = {}) {
  const random = seededRandom(seed);
  const meter = METERS[level.meter];
  const bpb = meter.bpb;
  const bpm = chosenBpm ?? Math.round(level.bpm * speed);
  const beatSec = 60 / bpm;
  const countInBars = 1;
  const keyBase = 60 + level.key; // middle-C octave

  // Generate one bar of rhythm for a hand from weighted cells.
  const bar = (cells) => generateFromCells({ cells, meter: meter.id, pitches: [72], bars: 1, random, standalone: false }).events;

  // Ease in: the ward's new rhythms arrive one at a time over the first
  // half of the song, each used a lot in the bars just after it arrives.
  const intro = introductions(level);
  const cellsFor = (weights, b) => {
    const out = {};
    for (const [c, w] of Object.entries(weights)) {
      const at = intro.get(c);
      if (at == null || b >= at) out[c] = at != null && b - at < 2 ? w + 2 : w;
    }
    if (!Object.keys(out).length && weights !== level.cells) return cellsFor(level.cells, b);
    if (!Object.keys(out).length) out[[...intro.keys()][0]] = 1;
    return out;
  };

  // Bars repeat with variations (verse 3 echoes verse 2; the second chorus
  // echoes the first), so the song has a shape but changes every play.
  const plan = [];
  SECTIONS.forEach((section, si) => {
    for (let i = 0; i < 4; i++) {
      const b = si * 4 + i;
      const earlier = plan[b - 8];
      let right = null;
      if (section === 'verse') right = si === 4 && random() < 0.6 ? earlier.right : bar(cellsFor(level.cells, b));
      else if (section === 'chorus') right = si === 5 && random() < 0.7 ? earlier.right : bar(cellsFor(level.chorus, b));
      plan.push({ section, right });
    }
  });
  // The intro gently brings the right hand in on simple beats.
  for (let i = 0; i < 4; i++) plan[i].right = i < 2 ? null : bar({ quarter: 3, half: 1 });
  // A tutorial lesson: a few bars practising one rhythm (or both hands) instead of a song.
  const hands = lesson ? lesson.hands : chosenHands ?? level.hands;
  const leftCells = level.left || defaultLeft(level);
  // From ward 3, now and then a note is tied across the bar line (within a line of two bars).
  if (!lesson && level.id >= 3) {
    for (let b = 4; b + 1 < plan.length; b += 2) {
      if (random() > 0.25 || !plan[b].right || !plan[b + 1].right) continue;
      const tied = tieAcross(plan[b].right, plan[b + 1].right);
      if (tied) [plan[b].right, plan[b + 1].right] = tied;
    }
  }
  if (lesson) {
    plan.length = 0;
    for (let i = 0; i < lesson.bars; i++) plan.push({ section: 'lesson', right: bar(lesson.right), left: lesson.left ? bar(lesson.left) : null });
  }

  const notes = [];
  const score = { R: [], L: [] }; // the written rhythm for each hand, as it's drawn
  const addBar = (lane, events, barStart, pitchOf) => writeBar(notes, score, lane, events, barStart, pitchOf);
  const barRest = (bpb) => [{ beat: 0, beats: bpb, rest: true, barRest: true }];
  const drums = [];
  const bass = [];
  const chords = [];
  let melodyIdx = 2;
  plan.forEach((p, b) => {
    const barStart = (countInBars + b) * bpb;
    const root = level.prog[b % level.prog.length];
    const tones = chordTones(level, root);
    chords.push({ bar: b, root, tones });
    // Right hand: the tune, using chord tones and stepping around them.
    const scale = level.minor ? MINOR : MAJOR;
    addBar('R', p.right || barRest(bpb), barStart, (e) => {
      melodyIdx = Math.max(0, Math.min(9, melodyIdx + [-2, -1, -1, 0, 1, 1, 2][Math.floor(random() * 7)]));
      // Strong beats land on a chord tone.
      let deg = melodyIdx;
      if (Math.abs(e.beat % 1) < 1e-6) {
        const want = tones.map((t) => scale.indexOf(t % 12) + 7 * Math.floor(t / 12));
        deg = want.reduce((a, w) => (Math.abs(w - melodyIdx) < Math.abs(a - melodyIdx) ? w : a), want[0]);
      }
      return keyBase + 12 + scale[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7);
    });
    // Left hand (two-handed levels): the bassline, from the verse on.
    if (hands === 2) {
      const left = p.section === 'intro' ? barRest(bpb) : p.left || bar(leftCells);
      addBar('L', left, barStart, (e) => keyBase - 24 + root + (e.beat % 2 === 0 ? 0 : 7));
    }
    // Backing: drums every bar, plus a quiet bass on one-hand levels.
    const clicks = Math.round(bpb / meter.click);
    for (let k = 0; k < clicks; k++) {
      const beat = barStart + k * meter.click;
      drums.push({ beat, type: k === 0 ? 'kick' : meter.compound || k % 2 === 0 ? 'kick' : 'snare' });
    }
    for (let h = 0; h < bpb - 1e-9; h += 0.5) drums.push({ beat: barStart + h, type: 'hat' });
    if (hands === 1 || p.section === 'intro') bass.push({ beat: barStart, midi: keyBase - 24 + root, dur: bpb * 0.9 });
  });
  // Count-in: four sticks.
  for (let k = 0; k < Math.round(bpb / meter.click); k++) drums.push({ beat: k * meter.click, type: 'stick' });

  const t = (beat) => beat * beatSec;
  for (const n of notes) n.time = t(n.beat);
  for (const x of drums) x.time = t(x.beat);
  for (const x of bass) x.time = t(x.beat);
  notes.sort((a, b) => a.time - b.time || (a.lane < b.lane ? -1 : 1));
  notes.forEach((n, i) => (n.id = i));
  for (const lane of Object.keys(score)) {
    for (const ev of score[lane]) {
      if (ev.note) ev.noteId = ev.note.id;
      delete ev.note;
    }
  }
  const totalBeats = (countInBars + plan.length) * bpb;
  return { level, seed, speed, hands, bpm, beatSec, meter, bars: plan.length, countInBars, notes, drums, bass, chords, score, length: t(totalBeats), sections: plan.map((p) => p.section) };
}

// ---------------------------------------------------------------- judging

export const WINDOWS = { perfect: 0.045, good: 0.09, ok: 0.14 };

/**
 * Judge a tap against the notes still waiting in a lane.
 * @returns {{note, judgement: 'perfect'|'good'|'ok', offset: number}|null}
 */
export function judgeTap(notes, lane, time) {
  // The earliest note still waiting gets the tap, unless a later one is
  // clearly closer: a steady delay (a phone's audio, say) then can't make
  // a tap jump to the next fast note and leave this one missed.
  let best = null;
  for (const n of notes) {
    if (n.judged || n.lane !== lane) continue;
    const off = time - n.time;
    if (off < -WINDOWS.ok) break; // notes are in time order; the rest are later
    if (Math.abs(off) > WINDOWS.ok) continue;
    if (!best) best = { note: n, offset: off };
    else if (Math.abs(off) < Math.abs(best.offset) - 0.06) best = { note: n, offset: off };
  }
  if (!best) return null;
  const a = Math.abs(best.offset);
  best.judgement = a <= WINDOWS.perfect ? 'perfect' : a <= WINDOWS.good ? 'good' : 'ok';
  return best;
}

/** Final accuracy (0..1) and grade for a finished song. Extra taps (with no note) count against it. */
export function grade(counts) {
  const total = counts.perfect + counts.good + counts.ok + counts.miss + (counts.extra || 0);
  const acc = total ? (counts.perfect + 0.7 * counts.good + 0.4 * counts.ok) / total : 0;
  const letter = acc >= 0.95 ? 'S' : acc >= 0.88 ? 'A' : acc >= 0.78 ? 'B' : acc >= 0.65 ? 'C' : 'D';
  return { acc, letter, passed: acc >= 0.65 };
}
