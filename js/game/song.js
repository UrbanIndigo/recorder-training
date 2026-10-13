// Beat Ward songs: each level is a chiptune with a fixed shape (key,
// chords, sections, tempo) but its rhythms are generated fresh on every
// play, so a song can't simply be memorised. No DOM or audio code.

import { generateFromCells, soundingNotes, METERS } from '../rhythm.js?v=2.6';

/** The wards, easiest first. `cells` are rhythm patterns from rhythm.js. */
export const LEVELS = [
  {
    id: 1, name: 'CHECK-UP', blurb: 'Quarter and half notes. Tap on the beat.',
    bpm: 84, meter: '4/4', hands: 1, key: 0, minor: false, prog: [0, 7, 9, 5],
    cells: { quarter: 5, half: 2, quarterRest: 1 },
    chorus: { quarter: 4, half: 1, eighths: 1 },
  },
  {
    id: 2, name: 'PULSE', blurb: 'Eighth notes join in.',
    bpm: 92, meter: '4/4', hands: 1, key: 7, minor: false, prog: [0, 5, 9, 7],
    cells: { quarter: 3, eighths: 3, half: 1, quarterRest: 1 },
    chorus: { quarter: 2, eighths: 4, restEighth: 1 },
  },
  {
    id: 3, name: 'SKIPPED BEAT', blurb: 'Syncopation and rests. Feel the off-beats.',
    bpm: 96, meter: '4/4', hands: 1, key: 9, minor: true, prog: [0, 5, 7, 3],
    cells: { quarter: 2, eighths: 2, restEighth: 2, syncopation: 2, dottedQuarterEighth: 2, quarterRest: 1 },
    chorus: { eighths: 2, syncopation: 3, offbeatQuarters: 1, eighthRest: 2 },
  },
  {
    id: 4, name: 'FEVER', blurb: 'Sixteenths and dotted rhythms. Faster.',
    bpm: 104, meter: '4/4', hands: 1, key: 2, minor: false, prog: [0, 9, 5, 7],
    cells: { quarter: 2, eighths: 2, sixteenths: 1, eighthTwoSixteenths: 2, twoSixteenthsEighth: 2, dottedEighthSixteenth: 2 },
    chorus: { eighths: 1, sixteenths: 2, scotchSnap: 2, sixteenthEighthSixteenth: 2, dottedEighthSixteenth: 1 },
  },
  {
    id: 5, name: 'TRIPLET WARD', blurb: 'Triplets mixed with straight notes. Keep them even.',
    bpm: 98, meter: '4/4', hands: 1, key: 5, minor: true, prog: [0, 8, 3, 10],
    cells: { quarter: 2, eighths: 2, triplet: 3, tripletRestMiddle: 1, quarterTriplet: 1 },
    chorus: { triplet: 3, tripletRestFirst: 2, eighths: 1, sixteenthTriplet: 1 },
  },
  {
    id: 6, name: 'TWO HANDS', blurb: 'Left hand plays the bass, right hand the tune. Sometimes together!',
    bpm: 88, meter: '4/4', hands: 2, key: 0, minor: false, prog: [0, 9, 5, 7],
    cells: { quarter: 3, eighths: 3, half: 1, restEighth: 1 },
    chorus: { eighths: 3, syncopation: 2, quarter: 2 },
    left: { quarter: 3, half: 2, halfRest: 1 },
  },
  {
    id: 7, name: 'NIGHT SHIFT', blurb: 'Two hands in 6/8. Rock in twos and threes.',
    bpm: 66, meter: '6/8', hands: 2, key: 4, minor: true, prog: [0, 5, 7, 0],
    cells: { c_threeEighths: 3, c_quarterEighth: 3, c_eighthQuarter: 2, c_dottedQuarter: 1, c_siciliano: 1 },
    chorus: { c_threeEighths: 2, c_siciliano: 2, c_sixteenths: 2, c_quarterEighth: 1 },
    left: { c_dottedQuarter: 4, c_quarterEighth: 1, c_dottedQuarterRest: 1 },
  },
  {
    id: 8, name: 'CODE BLUE', blurb: 'Everything, fast, both hands. Good luck, doctor.',
    bpm: 124, meter: '4/4', hands: 2, key: 10, minor: true, prog: [0, 8, 10, 7],
    cells: { eighths: 2, sixteenths: 2, syncopation: 2, eighthTwoSixteenths: 2, triplet: 1, dottedEighthSixteenth: 2 },
    chorus: { sixteenths: 2, scotchSnap: 2, sixteenthEighthSixteenth: 2, tiedSyncopation: 1, triplet: 1 },
    left: { quarter: 3, eighths: 2, half: 1, eighthRest: 1 },
  },
];

const SECTIONS = ['intro', 'verse', 'verse', 'chorus', 'verse', 'chorus']; // 4 bars each
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

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
 * @returns {{level, bpm, beatSec, meter, bars, countInBars, notes, drums, bass, chords, length}}
 *   notes: [{time, beat, lane: 'R'|'L', midi, dur}] times in seconds from the song start
 */
export function makeSong(level, seed = Date.now()) {
  const random = seededRandom(seed);
  const meter = METERS[level.meter];
  const bpb = meter.bpb;
  const beatSec = 60 / level.bpm;
  const countInBars = 1;
  const keyBase = 60 + level.key; // middle-C octave

  // Generate one bar of rhythm for a hand from weighted cells.
  const bar = (cells) => generateFromCells({ cells, meter: meter.id, pitches: [72], bars: 1, random, standalone: false }).events;

  // Verse bars are made once and repeated with variations; choruses likewise,
  // so the song has a recognisable shape but changes every play.
  const verse = Array.from({ length: 4 }, () => bar(level.cells));
  const chorus = Array.from({ length: 4 }, () => bar(level.chorus));
  const plan = [];
  let verseCount = 0;
  for (const section of SECTIONS) {
    for (let i = 0; i < 4; i++) {
      if (section === 'intro') plan.push({ section, right: null });
      else if (section === 'verse') plan.push({ section, right: verseCount > 0 && random() < 0.4 ? bar(level.cells) : verse[i] });
      else plan.push({ section, right: random() < 0.3 ? bar(level.chorus) : chorus[i] });
    }
    if (section === 'verse') verseCount++;
  }
  // The intro gently brings the right hand in on simple beats.
  for (let i = 0; i < 4; i++) plan[i].right = i < 2 ? null : bar({ quarter: 3, half: 1 });

  const notes = [];
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
    if (p.right) {
      for (const n of soundingNotes({ events: p.right })) {
        const scale = level.minor ? MINOR : MAJOR;
        melodyIdx = Math.max(0, Math.min(9, melodyIdx + [-2, -1, -1, 0, 1, 1, 2][Math.floor(random() * 7)]));
        const onBeat = Math.abs(n.beat % 1) < 1e-6;
        // Strong beats land on a chord tone.
        let deg = melodyIdx;
        if (onBeat) {
          const want = tones.map((t) => scale.indexOf(t % 12) + 7 * Math.floor(t / 12));
          deg = want.reduce((a, w) => (Math.abs(w - melodyIdx) < Math.abs(a - melodyIdx) ? w : a), want[0]);
        }
        const midi = keyBase + 12 + scale[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7);
        notes.push({ beat: barStart + n.beat, lane: 'R', midi, dur: n.beats });
      }
    }
    // Left hand (two-handed levels): the bassline, from the verse on.
    if (level.hands === 2 && p.section !== 'intro') {
      const left = bar(level.left);
      const ln = soundingNotes({ events: left });
      // Make sure the left hand lands on beat 1 so the hands sometimes play together.
      if (!ln.some((n) => n.beat === 0) && !left[0].rest) ln.unshift({ beat: 0, beats: 1 });
      for (const n of ln) notes.push({ beat: barStart + n.beat, lane: 'L', midi: keyBase - 24 + root + (n.beat % 2 === 0 ? 0 : 7), dur: n.beats });
    }
    // Backing: drums every bar, plus a quiet bass on one-hand levels.
    const clicks = Math.round(bpb / meter.click);
    for (let k = 0; k < clicks; k++) {
      const beat = barStart + k * meter.click;
      drums.push({ beat, type: k === 0 ? 'kick' : meter.compound || k % 2 === 0 ? 'kick' : 'snare' });
    }
    for (let h = 0; h < bpb - 1e-9; h += 0.5) drums.push({ beat: barStart + h, type: 'hat' });
    if (level.hands === 1 || p.section === 'intro') bass.push({ beat: barStart, midi: keyBase - 24 + root, dur: bpb * 0.9 });
  });
  // Count-in: four sticks.
  for (let k = 0; k < Math.round(bpb / meter.click); k++) drums.push({ beat: k * meter.click, type: 'stick' });

  const t = (beat) => beat * beatSec;
  for (const n of notes) n.time = t(n.beat);
  for (const x of drums) x.time = t(x.beat);
  for (const x of bass) x.time = t(x.beat);
  notes.sort((a, b) => a.time - b.time || (a.lane < b.lane ? -1 : 1));
  const totalBeats = (countInBars + plan.length) * bpb;
  return { level, seed, bpm: level.bpm, beatSec, meter, bars: plan.length, countInBars, notes, drums, bass, chords, length: t(totalBeats), sections: plan.map((p) => p.section) };
}

// ---------------------------------------------------------------- judging

export const WINDOWS = { perfect: 0.045, good: 0.09, ok: 0.14 };

/**
 * Judge a tap against the notes still waiting in a lane.
 * @returns {{note, judgement: 'perfect'|'good'|'ok', offset: number}|null}
 */
export function judgeTap(notes, lane, time) {
  let best = null;
  for (const n of notes) {
    if (n.judged || n.lane !== lane) continue;
    const off = time - n.time;
    if (off < -WINDOWS.ok) break; // notes are in time order; the rest are later
    if (Math.abs(off) <= WINDOWS.ok && (!best || Math.abs(off) < Math.abs(best.offset))) best = { note: n, offset: off };
  }
  if (!best) return null;
  const a = Math.abs(best.offset);
  best.judgement = a <= WINDOWS.perfect ? 'perfect' : a <= WINDOWS.good ? 'good' : 'ok';
  return best;
}

/** Final accuracy (0..1) and grade for a finished song. */
export function grade(counts) {
  const total = counts.perfect + counts.good + counts.ok + counts.miss;
  const acc = total ? (counts.perfect + 0.7 * counts.good + 0.4 * counts.ok) / total : 0;
  const letter = acc >= 0.95 ? 'S' : acc >= 0.88 ? 'A' : acc >= 0.78 ? 'B' : acc >= 0.65 ? 'C' : 'D';
  return { acc, letter, passed: acc >= 0.65 };
}
