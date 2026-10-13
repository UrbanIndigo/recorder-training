// Beat Ward songs: each level is a chiptune with a fixed shape (key,
// chords, sections, tempo) but its rhythms are generated fresh on every
// play, so a song can't simply be memorised. No DOM or audio code.

import { generateFromCells, METERS } from '../rhythm.js?v=2.8';

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
    cells: { quarter: 2, eighths: 2, sixteenths: 1, eighthTwoSixteenths: 2, twoSixteenthsEighth: 2, dottedEighthSixteenth: 2 },
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
 * @returns {{level, bpm, beatSec, meter, bars, countInBars, notes, score, drums, bass, chords, length}}
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
  const score = { R: [], L: [] }; // the written rhythm for each hand, as it's drawn
  // Add one bar of events to a hand's score, and its sounding notes to `notes`.
  const addBar = (lane, events, barStart, pitchOf) => {
    let last = null;
    for (const e of events) {
      const ev = { beat: barStart + e.beat, beats: e.beats, rest: e.rest, dotted: e.dotted, dots: e.dots, written: e.written, tuplet: e.tuplet, tupletId: e.tupletId != null ? `${barStart}:${e.tupletId}` : undefined, beamGroup: e.beamGroup != null ? `${barStart}:${e.beamGroup}` : undefined, tieNext: e.tieNext, tied: e.tied, barRest: e.barRest };
      if (!e.rest) {
        if (e.tied && last) {
          last.dur += e.beats;
        } else {
          last = { beat: barStart + e.beat, lane, midi: pitchOf(e), dur: e.beats };
          notes.push(last);
        }
        ev.note = last;
      }
      score[lane].push(ev);
    }
  };
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
    if (level.hands === 2) {
      const left = p.section === 'intro' ? barRest(bpb) : bar(level.left);
      addBar('L', left, barStart, (e) => keyBase - 24 + root + (e.beat % 2 === 0 ? 0 : 7));
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
  notes.forEach((n, i) => (n.id = i));
  for (const lane of Object.keys(score)) {
    for (const ev of score[lane]) {
      if (ev.note) ev.noteId = ev.note.id;
      delete ev.note;
    }
  }
  const totalBeats = (countInBars + plan.length) * bpb;
  return { level, seed, bpm: level.bpm, beatSec, meter, bars: plan.length, countInBars, notes, drums, bass, chords, score, length: t(totalBeats), sections: plan.map((p) => p.section) };
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
