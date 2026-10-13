// Rhythm reading: exercise generation, note-onset tracking from the mic,
// and scoring of a performance against the written rhythm. No DOM code.

import { gradeFor } from './longtone.js?v=3.1';

// ------------------------------------------------------------------ levels

/**
 * Time signatures. Positions and lengths everywhere are in quarter notes;
 * `bpb` is the bar length in quarters and `click` how many quarters each
 * metronome click is worth (6/8 clicks on the dotted quarter).
 */
export const METERS = {
  '4/4': { id: '4/4', num: 4, den: 4, bpb: 4, click: 1, compound: false },
  '3/4': { id: '3/4', num: 3, den: 4, bpb: 3, click: 1, compound: false },
  '2/4': { id: '2/4', num: 2, den: 4, bpb: 2, click: 1, compound: false },
  '6/8': { id: '6/8', num: 6, den: 8, bpb: 3, click: 1.5, compound: true },
};

/** The time signature of an exercise. */
export function meterOf(exercise) {
  return METERS[exercise.meter] || METERS[`${exercise.beatsPerBar}/4`] || METERS['4/4'];
}

// A "cell" is a beat-aligned rhythm fragment. `len` is in quarter notes;
// `fits(pos, bpb)` says where in the bar it may start. Compound cells are
// for 6/8, simple ones for 2/4, 3/4 and 4/4.
const anyBeat = () => true;
const dottedBeat = (pos) => Math.abs(pos % 1.5) < 1e-9;
const strongBeat = (pos, bpb) => (bpb === 4 ? pos % 2 === 0 : true);
const CELLS = {
  whole: { len: 4, fits: (pos, bpb) => bpb === 4 && pos === 0, events: [{ beats: 4 }] },
  dottedHalf: { len: 3, fits: (pos) => pos <= 1, events: [{ beats: 3, dotted: true }] },
  half: { len: 2, fits: strongBeat, events: [{ beats: 2 }] },
  halfRest: { len: 2, fits: strongBeat, events: [{ beats: 2, rest: true }] },
  // A whole-bar rest uses the whole-rest sign in any time signature.
  barRest: { len: 'bar', fits: (pos) => pos === 0, events: [{ beats: 'bar', rest: true, barRest: true }] },
  quarter: { len: 1, fits: anyBeat, events: [{ beats: 1 }] },
  quarterRest: { len: 1, fits: anyBeat, events: [{ beats: 1, rest: true }] },
  eighths: { len: 1, fits: anyBeat, events: [{ beats: 0.5, beam: true }, { beats: 0.5, beam: true }] },
  restEighth: { len: 1, fits: anyBeat, events: [{ beats: 0.5, rest: true }, { beats: 0.5 }] },
  eighthRest: { len: 1, fits: anyBeat, events: [{ beats: 0.5 }, { beats: 0.5, rest: true }] },
  dottedQuarterEighth: { len: 2, fits: strongBeat, events: [{ beats: 1.5, dotted: true }, { beats: 0.5 }] },
  syncopation: { len: 2, fits: strongBeat, events: [{ beats: 0.5 }, { beats: 1 }, { beats: 0.5 }] },
  // Quarter tied to an eighth: sounds like a dotted quarter, written across the beat.
  tiedQuarterEighth: {
    len: 2,
    fits: strongBeat,
    events: [{ beats: 1, tieNext: true }, { beats: 0.5, tied: true, beam: true }, { beats: 0.5, beam: true }],
  },
  sixteenths: { len: 1, fits: anyBeat, events: [0, 1, 2, 3].map(() => ({ beats: 0.25, beam: true })) },
  eighthTwoSixteenths: { len: 1, fits: anyBeat, events: [{ beats: 0.5, beam: true }, { beats: 0.25, beam: true }, { beats: 0.25, beam: true }] },
  twoSixteenthsEighth: { len: 1, fits: anyBeat, events: [{ beats: 0.25, beam: true }, { beats: 0.25, beam: true }, { beats: 0.5, beam: true }] },
  dottedEighthSixteenth: { len: 1, fits: anyBeat, events: [{ beats: 0.75, dotted: true, beam: true }, { beats: 0.25, beam: true }] },
  triplet: { len: 1, fits: anyBeat, events: [0, 1, 2].map(() => ({ beats: 1 / 3, beam: true, tuplet: 3 })) },
  // Harder syncopations.
  quarterHalfQuarter: { len: 4, fits: (pos, bpb) => bpb === 4 && pos === 0, events: [{ beats: 1 }, { beats: 2 }, { beats: 1 }] },
  eighthDottedQuarter: { len: 2, fits: strongBeat, events: [{ beats: 0.5 }, { beats: 1.5, dotted: true }] },
  tiedSyncopation: {
    len: 2,
    fits: strongBeat,
    events: [{ beats: 0.5, beam: true }, { beats: 0.5, beam: true, tieNext: true }, { beats: 0.5, beam: true, tied: true }, { beats: 0.5, beam: true }],
  },
  offbeatQuarters: { len: 3, fits: (pos, bpb) => pos + 3 <= bpb, events: [{ beats: 0.5 }, { beats: 1 }, { beats: 1 }, { beats: 0.5 }] },
  // Sixteenth variations.
  sixteenthEighthSixteenth: { len: 1, fits: anyBeat, events: [{ beats: 0.25, beam: true }, { beats: 0.5, beam: true }, { beats: 0.25, beam: true }] },
  scotchSnap: { len: 1, fits: anyBeat, events: [{ beats: 0.25, beam: true }, { beats: 0.75, dotted: true, beam: true }] },
  eighthRestTwoSixteenths: { len: 1, fits: anyBeat, events: [{ beats: 0.5, rest: true }, { beats: 0.25, beam: true }, { beats: 0.25, beam: true }] },
  sixteenthRestThree: { len: 1, fits: anyBeat, events: [{ beats: 0.25, rest: true }, { beats: 0.25, beam: true }, { beats: 0.25, beam: true }, { beats: 0.25, beam: true }] },
  quarterTriplet: { len: 2, fits: strongBeat, events: [0, 1, 2].map(() => ({ beats: 2 / 3, tuplet: 3 })) },

  // 6/8 (compound time): two dotted-quarter beats per bar.
  c_dottedQuarter: { compound: true, len: 1.5, fits: dottedBeat, events: [{ beats: 1.5, dotted: true }] },
  c_threeEighths: { compound: true, len: 1.5, fits: dottedBeat, events: [0, 1, 2].map(() => ({ beats: 0.5, beam: true })) },
  c_quarterEighth: { compound: true, len: 1.5, fits: dottedBeat, events: [{ beats: 1 }, { beats: 0.5 }] },
  c_dottedHalf: { compound: true, len: 3, fits: (pos) => pos === 0, events: [{ beats: 3, dotted: true }] },
  c_eighthQuarter: { compound: true, len: 1.5, fits: dottedBeat, events: [{ beats: 0.5 }, { beats: 1 }] },
  c_dottedQuarterRest: { compound: true, len: 1.5, fits: dottedBeat, events: [{ beats: 1.5, rest: true, dotted: true }] },
  c_sixteenths: { compound: true, len: 1.5, fits: dottedBeat, events: [{ beats: 0.25, beam: true }, { beats: 0.25, beam: true }, { beats: 0.5, beam: true }, { beats: 0.5, beam: true }] },
  c_siciliano: { compound: true, len: 1.5, fits: dottedBeat, events: [{ beats: 0.75, dotted: true, beam: true }, { beats: 0.25, beam: true }, { beats: 0.5, beam: true }] },
  // Two notes across a dotted-quarter beat, written as eighths marked "2".
  c_duplet: { compound: true, len: 1.5, fits: dottedBeat, events: [0, 1].map(() => ({ beats: 0.75, written: 0.5, beam: true, tuplet: 2 })) },

  // Tuplets. `written` is the note value printed; `beats` is how long it really lasts.
  tripletRestMiddle: { len: 1, fits: anyBeat, events: [{ beats: 1 / 3, written: 0.5, tuplet: 3 }, { beats: 1 / 3, written: 0.5, tuplet: 3, rest: true }, { beats: 1 / 3, written: 0.5, tuplet: 3 }] },
  tripletRestFirst: { len: 1, fits: anyBeat, events: [{ beats: 1 / 3, written: 0.5, tuplet: 3, rest: true }, { beats: 1 / 3, written: 0.5, tuplet: 3, beam: true }, { beats: 1 / 3, written: 0.5, tuplet: 3, beam: true }] },
  sixteenthTriplet: {
    len: 1,
    fits: anyBeat,
    events: [...[0, 1, 2].map(() => ({ beats: 1 / 6, written: 0.25, beam: true, tuplet: 3 })), { beats: 0.5, beam: true }],
  },
  quintuplet: { len: 1, fits: anyBeat, events: [0, 1, 2, 3, 4].map(() => ({ beats: 0.2, written: 0.25, beam: true, tuplet: 5 })) },
  // Fast notes.
  thirtySeconds: { len: 1, fits: anyBeat, events: [{ beats: 0.5, beam: true }, ...[0, 1, 2, 3].map(() => ({ beats: 0.125, beam: true }))] },
  dottedSixteenth32: {
    len: 1,
    fits: anyBeat,
    events: [0, 1].flatMap(() => [{ beats: 0.375, dotted: true, beam: true }, { beats: 0.125, beam: true }]),
  },
  // Double-dotted notes: two dots add half, then a quarter, of the value.
  doubleDottedQuarter: { len: 2, fits: strongBeat, events: [{ beats: 1.75, dots: 2 }, { beats: 0.25 }] },
  doubleDottedHalf: { len: 4, fits: (pos, bpb) => bpb === 4 && pos === 0, events: [{ beats: 3.5, dots: 2 }, { beats: 0.5 }] },
  // More rests.
  dottedQuarterRestEighth: { len: 2, fits: strongBeat, events: [{ beats: 1.5, rest: true, dotted: true }, { beats: 0.5 }] },
  eighthRestQuarterEighth: { len: 2, fits: strongBeat, events: [{ beats: 0.5, rest: true }, { beats: 1 }, { beats: 0.5 }] },
  eighthSixteenthRestSixteenth: { len: 1, fits: anyBeat, events: [{ beats: 0.5, beam: true }, { beats: 0.25, rest: true }, { beats: 0.25, beam: true }] },
  sixteenthRestEighth: { len: 1, fits: anyBeat, events: [{ beats: 0.25, beam: true }, { beats: 0.25, rest: true }, { beats: 0.5, beam: true }] },
  dottedEighthRestSixteenth: { len: 1, fits: anyBeat, events: [{ beats: 0.75, rest: true, dotted: true }, { beats: 0.25 }] },
};

const cellLen = (name, bpb) => (CELLS[name].len === 'bar' ? bpb : CELLS[name].len);

export const LEVELS = [
  {
    id: 1,
    name: 'Whole, half & quarter notes',
    timeSigs: ['4/4'],
    cells: { whole: 1, half: 3, quarter: 4 },
  },
  {
    id: 2,
    name: 'Rests & 3/4 time',
    timeSigs: ['4/4', '3/4'],
    cells: { whole: 0.5, dottedHalf: 1.5, half: 2, halfRest: 1, quarter: 4, quarterRest: 2 },
  },
  {
    id: 3,
    name: 'Eighth notes',
    timeSigs: ['4/4', '3/4'],
    cells: { dottedHalf: 1, half: 1.5, halfRest: 0.5, quarter: 3, quarterRest: 1.5, eighths: 4 },
  },
  {
    id: 4,
    name: 'Dotted rhythms',
    timeSigs: ['4/4', '3/4', '2/4'],
    cells: { half: 1, quarter: 2.5, quarterRest: 1, eighths: 2.5, restEighth: 1.5, dottedQuarterEighth: 3 },
  },
  {
    id: 5,
    name: 'Syncopation',
    timeSigs: ['4/4', '3/4', '2/4'],
    cells: { half: 1, quarter: 2, quarterRest: 1, eighths: 2, restEighth: 1.5, dottedQuarterEighth: 2, syncopation: 3 },
  },
  {
    id: 6,
    name: 'Sixteenth notes',
    timeSigs: ['4/4', '3/4', '2/4'],
    cells: { half: 0.5, quarter: 2, quarterRest: 1, eighths: 2, sixteenths: 2.5, eighthTwoSixteenths: 2, twoSixteenthsEighth: 2 },
  },
  {
    id: 7,
    name: 'Ties, dotted eighths & triplets',
    timeSigs: ['4/4', '3/4', '2/4'],
    cells: { quarter: 2, eighths: 1.5, eighthRest: 1, tiedQuarterEighth: 2, dottedEighthSixteenth: 2.5, triplet: 2.5, sixteenths: 1, barRest: 0.3 },
  },
  {
    id: 8,
    name: 'Advanced syncopation',
    timeSigs: ['4/4', '3/4'],
    cells: { quarter: 1, eighths: 1, quarterHalfQuarter: 1, eighthDottedQuarter: 2, tiedSyncopation: 2, offbeatQuarters: 2, syncopation: 1.5, quarterTriplet: 1.5 },
  },
  {
    id: 9,
    name: 'Tricky sixteenths',
    timeSigs: ['4/4', '3/4', '2/4'],
    cells: { quarter: 1, eighths: 1, sixteenths: 1, sixteenthEighthSixteenth: 2, scotchSnap: 2, eighthRestTwoSixteenths: 2, sixteenthRestThree: 2, dottedEighthSixteenth: 1.5 },
  },
  {
    id: 10,
    name: '6/8 time',
    timeSigs: ['6/8'],
    cells: { c_dottedQuarter: 2, c_threeEighths: 3, c_quarterEighth: 3, c_eighthQuarter: 2, c_dottedHalf: 0.7, c_dottedQuarterRest: 1, c_sixteenths: 1.5, c_siciliano: 1.5, c_duplet: 1 },
  },
  {
    id: 11,
    name: 'Tuplets',
    timeSigs: ['4/4', '3/4', '2/4'],
    cells: { quarter: 1, eighths: 1, triplet: 1.5, tripletRestMiddle: 2, tripletRestFirst: 2, sixteenthTriplet: 2, quintuplet: 1.5, quarterTriplet: 1 },
  },
  {
    id: 12,
    name: 'Fast notes & double dots',
    timeSigs: ['4/4', '3/4', '2/4'],
    cells: { quarter: 1, eighths: 1, sixteenths: 1, thirtySeconds: 2, dottedSixteenth32: 2, doubleDottedQuarter: 2, doubleDottedHalf: 1, dottedEighthSixteenth: 1 },
  },
  {
    id: 13,
    name: 'Rests everywhere',
    timeSigs: ['4/4', '3/4', '2/4'],
    restStart: true,
    cells: { quarter: 1.5, quarterRest: 1.5, eighthRest: 1, restEighth: 1, dottedQuarterRestEighth: 2, eighthRestQuarterEighth: 2, eighthSixteenthRestSixteenth: 2, sixteenthRestEighth: 2, dottedEighthRestSixteenth: 2, sixteenthRestThree: 1 },
  },
];

/**
 * Make a random exercise.
 * @param {object} o
 * @param {number} o.level 1-5
 * @param {number[]} o.pitches sounding MIDI notes to use (stepwise order)
 * @param {number} [o.bars]
 * @param {() => number} [o.random]
 */
export function generateExercise({ level, pitches, bars = 4, random = Math.random }) {
  const lvl = LEVELS.find((l) => l.id === level) || LEVELS[0];
  const meter = lvl.timeSigs[Math.floor(random() * lvl.timeSigs.length)];
  return { ...generateFromCells({ cells: lvl.cells, meter, pitches, bars, random, allowRestStart: !!lvl.restStart }), level: lvl.id };
}

/** The rhythm patterns ("cells") exercises are built from. */
export const CELL_NAMES = Object.keys(CELLS);

/**
 * Make an exercise from weighted rhythm cells.
 * @param {object} o
 * @param {Object<string, number>} o.cells cell name -> weight
 * @param {number} o.beatsPerBar
 * @param {number[]} o.pitches sounding MIDI notes to use (stepwise order)
 */
/**
 * `standalone` rhythms start on a note and end on a long note so they make
 * sense on their own; bars for a continuous stream don't need that.
 * `startPitch` continues the melody from a previous bar.
 */
export function generateFromCells({ cells, meter: meterId = '4/4', pitches, bars = 4, random = Math.random, allowRestStart = false, standalone = true, startPitch = null }) {
  const meter = METERS[meterId];
  const bpb = meter.bpb;
  // Only cells that belong to this kind of time signature.
  const lvl = { cells: Object.fromEntries(Object.entries(cells).filter(([c]) => !!CELLS[c].compound === meter.compound)) };

  const barCells = [];
  for (let b = 0; b < bars; b++) {
    let cells;
    let ok = false;
    for (let attempt = 0; attempt < 60 && !ok; attempt++) {
      cells = fillBar(lvl, bpb, random);
      const events = cells.flatMap((c) => CELLS[c].events);
      const notes = events.filter((e) => !e.rest);
      const lastBeats = events.at(-1).beats === 'bar' ? bpb : events.at(-1).beats;
      ok =
        (notes.length > 0 || events[0].barRest) &&
        // Start on a note so there's a clear entry...
        (!standalone || b > 0 || !events[0].rest || events[0].barRest || allowRestStart) &&
        // ...and end on a note of at least a beat.
        (!standalone || b < bars - 1 || (!events.at(-1).rest && !events.at(-1).tied && lastBeats >= 1));
    }
    // Busy levels rarely end on a long note by chance: finish on a quarter.
    if (!ok && standalone && b === bars - 1) {
      cells = meter.compound
        ? [...fillBar(lvl, bpb, random, bpb - 1.5), 'c_dottedQuarter']
        : [...fillBar(lvl, bpb, random, bpb - 1), 'quarter'];
    }
    barCells.push(cells);
  }

  // Lay events out in time and assign pitches with a gentle stepwise walk.
  const events = [];
  let beat = 0;
  let group = 0;
  let pitchIdx = startPitch != null && pitches.includes(startPitch) ? pitches.indexOf(startPitch) : Math.floor(pitches.length / 2);
  barCells.forEach((cells, barIndex) => {
    for (const name of cells) {
      group++;
      const cellStart = beat;
      for (const e of CELLS[name].events) {
        const beats = e.beats === 'bar' ? bpb : e.beats;
        const ev = { beat, beats, rest: !!e.rest, dotted: !!e.dotted, bar: barIndex, cell: name, cellId: group };
        if (e.beam) ev.beamGroup = group;
        if (e.tuplet) {
          ev.tuplet = e.tuplet;
          ev.tupletId = group;
        }
        if (e.written) ev.written = e.written;
        if (e.dots) ev.dots = e.dots;
        if (e.tieNext) ev.tieNext = true;
        if (e.tied) ev.tied = true; // continues the previous note: same pitch, no new tongue
        if (e.barRest) ev.barRest = true;
        if (ev.tied) {
          ev.midi = events.at(-1).midi;
        } else if (!ev.rest) {
          if (pitches.length > 1 && events.some((x) => !x.rest)) {
            // Mostly steps, with the odd leap when there are lots of notes.
            let step = [-2, -1, -1, 0, 1, 1, 2][Math.floor(random() * 7)];
            if (pitches.length > 7 && random() < 0.2) step = (random() < 0.5 ? -1 : 1) * (3 + Math.floor(random() * 3));
            pitchIdx = pitchIdx + step;
            if (pitchIdx < 0 || pitchIdx >= pitches.length) pitchIdx = pitchIdx - 2 * step; // bounce off the ends
            pitchIdx = Math.max(0, Math.min(pitches.length - 1, pitchIdx));
          }
          ev.midi = pitches[pitchIdx];
        }
        events.push(ev);
        beat += beats;
      }
      beat = cellStart + cellLen(name, bpb); // keep triplet positions exact
    }
  });

  return { meter: meter.id, beatsPerBar: bpb, bars, totalBeats: bars * bpb, events };
}

/** Can this rhythm pattern be used in this time signature? */
export function cellFitsMeter(cell, meterId) {
  const c = CELLS[cell];
  const m = METERS[meterId];
  if (!c || !m || !!c.compound !== m.compound) return false;
  const len = cellLen(cell, m.bpb);
  for (let pos = 0; pos + len <= m.bpb + 1e-9; pos += 0.5) if (c.fits(pos, m.bpb)) return true;
  return false;
}

/** Fill `length` beats of a bar of `bpb` beats (normally the whole bar). */
function fillBar(lvl, bpb, random, length = bpb) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const cells = [];
    let pos = 0;
    while (pos < length - 1e-9) {
      const options = Object.entries(lvl.cells).filter(
        ([name]) => pos + cellLen(name, bpb) <= length + 1e-9 && CELLS[name].fits(pos, bpb),
      );
      if (!options.length) break;
      const total = options.reduce((s, [, w]) => s + w, 0);
      let r = random() * total;
      let pick = options[0][0];
      for (const [name, w] of options) {
        r -= w;
        if (r <= 0) {
          pick = name;
          break;
        }
      }
      cells.push(pick);
      pos += cellLen(pick, bpb);
    }
    if (Math.abs(pos - length) < 1e-9) return cells;
  }
  if (CELLS.c_dottedQuarter && Object.keys(lvl.cells).some((c) => CELLS[c].compound)) return Array(Math.round(length / 1.5)).fill('c_dottedQuarter');
  return Array(length).fill('quarter');
}

/** Exercise of steady quarter notes, used to measure the device's delay. */
export function calibrationExercise(midi) {
  const events = [];
  for (let i = 0; i < 8; i++) events.push({ beat: i, beats: 1, rest: false, dotted: false, bar: i >> 2, midi });
  return { level: 0, meter: '4/4', beatsPerBar: 4, bars: 2, totalBeats: 8, events };
}

/**
 * The notes you actually tongue, with tied notes merged into one longer
 * note. @returns {{event: object, beat: number, beats: number, midi: number}[]}
 */
export function soundingNotes(exercise) {
  const out = [];
  for (const e of exercise.events) {
    if (e.rest) continue;
    if (e.tied && out.length) out.at(-1).beats += e.beats;
    else out.push({ event: e, beat: e.beat, beats: e.beats, midi: e.midi });
  }
  return out;
}

// ----------------------------------------------------------- onset tracking

const CONFIRM_SECONDS = 0.15; // a tone must be heard this soon after a rise in level
const UNVOICED_END_SECONDS = 0.4; // no tone at all for this long and the note has ended
const RELEASE_RATIO = 0.25; // level falling below this fraction of the note's level ends it
const ATTACK_SECONDS = 0.05; // ignore the tonguing burst when judging a note's level
const PITCH_CHANGE_SECONDS = 0.05; // a new pitch held this long starts a new note (slurs)
const DIP_RATIO = 0.72; // a dip below this fraction of the note's level...
const REATTACK_RISE = 1.45; // ...followed by a rise of this much is a new tongued note
const MIN_NOTE_SECONDS = 0.05;

/**
 * Turns a stream of short level readings into notes with start and end
 * times. A note starts when the level rises above the noise gate and a
 * tone is heard; it ends when the level drops well below the note's
 * steady level (tonguing between notes, or stopping). Moving to a new
 * pitch without tonguing also starts a new note.
 */
export class OnsetTracker {
  constructor() {
    this.notes = [];
    this.current = null;
    this.candidate = null;
    this.belowSince = null;
    this.env = 0; // smoothed level
    this.rearm = 0; // after a tongued release, the level must climb back past this
  }

  /**
   * @param {number} t time in seconds
   * @param {number} rms short-window level
   * @param {number} gate level counted as sound
   * @param {number|null} midi detected pitch, if one could be read
   * @param {boolean} [tonal] a tone is present even if no exact pitch was read
   */
  push(t, rms, gate, midi, tonal = midi != null) {
    this.env += (rms - this.env) * 0.35;
    const cur = this.current;
    if (cur) {
      const age = t - cur.start;
      if (tonal) cur.lastVoiced = t;
      if (midi != null) {
        cur.pitches.push(midi);
        if (age > ATTACK_SECONDS) this.checkPitchChange(t, midi);
        if (this.current !== cur) return;
      }
      // The tonguing burst at the start can be far louder than the note
      // itself, so the note's level is only measured after it.
      if (age > ATTACK_SECONDS) cur.level = cur.level == null ? this.env : Math.max(cur.level * 0.9995, this.env);
      if (cur.level != null) {
        // Re-attack: in a room with echo the level may never fall far
        // between tongued notes, but it dips and then jumps back up.
        if (this.env < cur.level * DIP_RATIO) {
          if (!cur.dip) cur.dip = { start: t, min: this.env, minT: t };
          else if (this.env < cur.dip.min) Object.assign(cur.dip, { min: this.env, minT: t });
        } else if (cur.dip) {
          const dip = cur.dip;
          // Tongued attacks rise fast; breath vibrato swells slowly.
          if (this.env > dip.min * REATTACK_RISE && t - dip.minT <= 0.06) {
            this.close(dip.start);
            this.open(dip.minT, midi);
            this.current.level = this.env;
            return;
          }
          // A slow swell back up, not a new attack.
          if (t - dip.start > 0.3 || t - dip.minT > 0.06 || this.env >= cur.level * 0.97) cur.dip = null;
        }
        const releaseLevel = Math.max(gate, cur.level * RELEASE_RATIO);
        if (rms < releaseLevel) {
          if (this.belowSince == null) this.belowSince = t;
          // Two readings in a row, so one noisy reading doesn't split a note.
          else if (t - this.belowSince > 0.004) {
            this.close(this.belowSince);
            this.rearm = releaseLevel * 1.5;
            return;
          }
        } else {
          this.belowSince = null;
        }
      } else if (rms < gate) {
        this.close(t);
        return;
      }
      if (t - cur.lastVoiced > UNVOICED_END_SECONDS) this.close(cur.lastVoiced);
      return;
    }

    // The re-attack level fades within about a quarter of a second.
    this.rearm *= 0.985;
    if (rms < gate) this.rearm = 0;
    if (rms >= Math.max(gate, this.rearm)) {
      if (!this.candidate) this.candidate = { start: t };
      if (tonal) {
        this.open(this.candidate.start, midi);
        this.candidate = null;
      } else if (t - this.candidate.start > CONFIRM_SECONDS) {
        this.candidate = null; // a click or breath noise, not a note
      }
    } else {
      this.candidate = null;
    }
  }

  open(start, midi) {
    this.current = { start, level: null, pitches: midi != null ? [midi] : [], lastVoiced: start, ref: null, change: null, dip: null };
    this.belowSince = null;
  }

  checkPitchChange(t, midi) {
    const cur = this.current;
    if (cur.ref == null) {
      cur.ref = Math.round(midi);
      return;
    }
    // Needs a clear move (not an out-of-tune note wavering between two names).
    if (Math.abs(midi - cur.ref) < 0.75) {
      cur.change = null;
      return;
    }
    if (!cur.change || cur.change.midi !== Math.round(midi)) cur.change = { t, midi: Math.round(midi) };
    else if (t - cur.change.t >= PITCH_CHANGE_SECONDS) {
      const at = cur.change.t;
      cur.pitches = cur.pitches.filter((m) => Math.abs(m - cur.ref) < 0.75);
      this.close(at);
      this.open(at, midi);
      this.current.ref = Math.round(midi);
      this.current.level = this.env;
    }
  }

  close(end) {
    const cur = this.current;
    this.current = null;
    this.belowSince = null;
    if (end - cur.start < MIN_NOTE_SECONDS) return;
    this.notes.push({ start: cur.start, end, midi: median(cur.pitches) });
  }

  /** Close any sounding note and return all notes. */
  finish(t) {
    if (this.current) this.close(t);
    return this.notes;
  }

  /** Notes so far, including one still sounding (ending at `t`). */
  snapshot(t) {
    const out = [...this.notes];
    if (this.current) out.push({ start: this.current.start, end: t, midi: median(this.current.pitches), open: true });
    return out;
  }
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[s.length >> 1];
}

// ------------------------------------------------------------------ scoring

export const ON_TIME_MS = 60;

/**
 * How much of a note's written length it must sound for: nothing for
 * quarter notes and shorter (separating them is normal), about half for a
 * dotted quarter, 60% for half notes and longer.
 */
function lengthNeeded(beats) {
  if (beats <= 1 + 1e-9) return 0;
  if (beats < 2) return 0.45;
  return 0.6;
}
export const CLOSE_MS = 120;

/**
 * Compare played notes with the written rhythm.
 * @param {object} exercise from generateExercise
 * @param {{start: number, end: number, midi: number|null}[]} played times in
 *   seconds relative to the first beat of the exercise (latency already removed)
 * @param {number} bpm
 * @param {{checkPitch?: boolean}} [opts]
 */
export function scoreRhythm(exercise, played, bpm, { checkPitch = false } = {}) {
  const beatSec = 60 / bpm;
  const expected = soundingNotes(exercise);
  const onsets = expected.map((x) => x.beat * beatSec);

  // Each written note claims the closest unclaimed played note near it.
  const used = new Set();
  const notes = expected.map(({ event: e, beats }, i) => {
    const start = onsets[i];
    const gapPrev = i > 0 ? start - onsets[i - 1] : Infinity;
    const gapNext = i < onsets.length - 1 ? onsets[i + 1] - start : Infinity;
    const window = Math.min(0.5 * beatSec, 0.6 * gapPrev, 0.6 * gapNext, 0.35);
    let best = -1;
    played.forEach((p, j) => {
      if (used.has(j)) return;
      const d = Math.abs(p.start - start);
      if (d <= window && (best === -1 || d < Math.abs(played[best].start - start))) best = j;
    });

    const expectedDur = beats * beatSec;
    const result = { event: e, beats, expectedStart: start, expectedEnd: start + expectedDur };
    if (best === -1) return { ...result, status: 'missed', score: 0 };
    used.add(best);
    const p = played[best];
    const errorMs = (p.start - start) * 1000;
    const held = p.end - p.start;
    const lengthRatio = held / expectedDur;

    // Full marks within 50 ms of the beat, fading to nothing at 250 ms.
    const timingScore = clamp(1 - (Math.abs(errorMs) - 50) / 200, 0, 1);
    // Detached (tongued, slightly separated) playing is fine: quarter notes
    // and shorter don't need holding, longer notes about half their length.
    const lengthNeed = lengthNeeded(beats);
    const lengthScore = lengthNeed ? clamp(lengthRatio / lengthNeed, 0, 1) : 1;
    const wrongPitch = checkPitch && p.midi != null && Math.round(p.midi) !== e.midi;
    let score = 0.85 * timingScore + 0.15 * lengthScore;
    if (wrongPitch) score *= 0.5;

    const timing = Math.abs(errorMs) <= ON_TIME_MS ? 'good' : Math.abs(errorMs) <= CLOSE_MS ? 'close' : 'off';
    return {
      ...result,
      played: p,
      status: timing,
      errorMs,
      lengthRatio,
      short: lengthNeed > 0 && lengthRatio < lengthNeed,
      wrongPitch,
      score,
    };
  });

  const extras = played.filter((_, j) => !used.has(j));
  const restHits = exercise.events
    .filter((e) => e.rest)
    .filter((r) => {
      const s = r.beat * beatSec, end = s + r.beats * beatSec;
      return played.some((p) => p.start < end - 0.08 && p.end > s + 0.08 + 0.15 * beatSec);
    });

  const matched = notes.filter((n) => n.played);
  const errors = matched.map((n) => n.errorMs);
  const meanErrorMs = errors.length ? avg(errors) : null;
  const meanAbsErrorMs = errors.length ? avg(errors.map(Math.abs)) : null;
  const onTime = notes.filter((n) => n.status === 'good').length;
  const missed = notes.filter((n) => n.status === 'missed').length;
  const shortNotes = matched.filter((n) => n.short && n.beats >= 1);
  const wrongPitches = matched.filter((n) => n.wrongPitch).length;

  const base = notes.length ? avg(notes.map((n) => n.score)) * 100 : 0;
  const overall = Math.round(clamp(base - 6 * extras.length - 6 * restHits.length, 0, 100));

  const result = {
    bpm,
    notes,
    extras,
    restHits,
    overall,
    grade: gradeFor(overall),
    total: notes.length,
    onTime,
    missed,
    meanErrorMs,
    meanAbsErrorMs,
    shortNotes: shortNotes.length,
    wrongPitches,
  };
  result.tips = rhythmTips(result, shortNotes);
  return result;
}

function rhythmTips(r, shortNotes) {
  const tips = [];
  if (r.total && r.missed === r.total) {
    tips.push('No notes were heard. Check the Mic bar moves when you play, and start playing on beat 1 after the count-in.');
    return tips;
  }
  if (r.meanErrorMs != null) {
    if (r.meanErrorMs < -40) {
      tips.push(`You tend to rush: on average ${Math.round(-r.meanErrorMs)} ms early. Listen for the click and let it arrive before you play — count "1 and 2 and" in your head.`);
    } else if (r.meanErrorMs > 40) {
      tips.push(`You tend to drag: on average ${Math.round(r.meanErrorMs)} ms late. Breathe in during the count-in so you're ready to tongue right on the beat.`);
    }
  }
  if (r.missed > 0 && r.missed < r.total) {
    tips.push(`${r.missed} note${r.missed === 1 ? ' was' : 's were'} missed. If you played them, tongue each note clearly ("tu") so they don't blur into one.`);
  }
  if (shortNotes.length) {
    const long = shortNotes.filter((n) => n.beats >= 2).length;
    tips.push(long
      ? 'Some long notes were cut short. Keep the air going for the whole value — a half note lasts until the next beat 3 or 1.'
      : 'Some notes were cut short. Hold each note right up to the next one.');
  }
  if (r.restHits.length) {
    tips.push('You played through a rest. A rest means silence: stop the air on the beat and count through it.');
  } else if (r.extras.length) {
    tips.push('Some extra notes were heard that aren’t written. Watch for long notes — a held note is one tongue, not several.');
  }
  if (r.wrongPitches) {
    tips.push(`${r.wrongPitches} note${r.wrongPitches === 1 ? ' was' : 's were'} the wrong pitch. Look ahead to the next note while you play the current one.`);
  }
  if (!tips.length) {
    tips.push(r.bpm < 100 ? 'Rock solid! Try a faster tempo or the next level.' : 'Rock solid! Try the next level.');
  }
  return tips;
}

/**
 * What to show on the music after scoring: a status per event index
 * (good/close/off/missed/wrong, or 'hit' for a rest played through) and
 * the timing error in ms for each note that was heard.
 */
export function resultMarks(exercise, result) {
  const statuses = new Map();
  const offsets = new Map();
  for (const n of result.notes) {
    const idx = exercise.events.indexOf(n.event);
    statuses.set(idx, n.status === 'missed' ? 'missed' : n.wrongPitch ? 'wrong' : n.status);
    if (n.played) offsets.set(idx, n.errorMs);
  }
  for (const r of result.restHits) statuses.set(exercise.events.indexOf(r), 'hit');
  return { statuses, offsets };
}

/**
 * What was played, in beats, each with the status of the written note it
 * matched ('off' for extra notes). For the strip under each bar.
 */
export function playedBeats(result, played, beatSec) {
  const status = new Map();
  for (const n of result.notes) {
    if (n.played) status.set(n.played, n.wrongPitch ? 'wrong' : n.status);
  }
  return played.map((p) => ({ start: p.start / beatSec, end: p.end / beatSec, status: status.get(p) || 'off' }));
}

/**
 * A short verdict for each bar ("Great", "Early", "Missed a note"...).
 * @returns {{text: string, level: 'good'|'close'|'far'}[]}
 */
export function barVerdicts(exercise, result) {
  const out = [];
  for (let b = 0; b < exercise.bars; b++) out.push(barVerdict(exercise, result, b));
  return out;
}

export function barVerdict(exercise, result, b) {
  const notes = result.notes.filter((n) => n.event.bar === b);
  const restHit = result.restHits.some((r) => r.bar === b);
  if (!notes.length) return restHit ? { text: 'Played in the rest', level: 'far' } : { text: 'Good rest', level: 'good' };
  const missed = notes.filter((n) => n.status === 'missed').length;
  if (missed === notes.length) return { text: 'Missed', level: 'far' };
  if (missed) return { text: missed === 1 ? 'Missed a note' : `Missed ${missed} notes`, level: missed / notes.length > 0.34 ? 'far' : 'close' };
  if (restHit) return { text: 'Played in a rest', level: 'far' };
  if (notes.some((n) => n.wrongPitch)) return { text: 'Wrong note', level: 'close' };
  const errs = notes.map((n) => n.errorMs);
  const mean = errs.reduce((a, c) => a + c, 0) / errs.length;
  const spread = Math.max(...errs) - Math.min(...errs);
  if (mean < -50) return { text: 'Early', level: mean < -100 ? 'far' : 'close' };
  if (mean > 50) return { text: 'Late', level: mean > 100 ? 'far' : 'close' };
  if (spread > 160) return { text: 'Uneven', level: 'close' };
  if (notes.some((n) => n.short && n.beats >= 1)) return { text: 'Too short', level: 'close' };
  if (notes.every((n) => n.status === 'good')) return { text: 'Great', level: 'good' };
  return { text: 'Good', level: notes.every((n) => n.status !== 'off') ? 'good' : 'close' };
}

/** Median timing error (seconds) from a calibration run, or null if unreliable. */
export function calibrationOffset(exercise, played, bpm) {
  const beatSec = 60 / bpm;
  const errs = [];
  for (const e of exercise.events) {
    const start = e.beat * beatSec;
    const near = played.filter((p) => Math.abs(p.start - start) < 0.45 * beatSec);
    if (near.length) errs.push(near.reduce((a, b) => (Math.abs(a.start - start) < Math.abs(b.start - start) ? a : b)).start - start);
  }
  if (errs.length < 5) return null;
  errs.sort((a, b) => a - b);
  return errs[errs.length >> 1];
}

function avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
