// Rhythm reading: exercise generation, note-onset tracking from the mic,
// and scoring of a performance against the written rhythm. No DOM code.

import { gradeFor } from './longtone.js';

// ------------------------------------------------------------------ levels

// A "cell" is a beat-aligned rhythm fragment. `len` is in beats (quarter
// notes); `fits(pos, bpb)` says where in the bar it may start.
const anyBeat = () => true;
const strongBeat = (pos, bpb) => (bpb === 4 ? pos % 2 === 0 : true);
const CELLS = {
  whole: { len: 4, fits: (pos, bpb) => bpb === 4 && pos === 0, events: [{ beats: 4 }] },
  dottedHalf: { len: 3, fits: (pos) => pos <= 1, events: [{ beats: 3, dotted: true }] },
  half: { len: 2, fits: strongBeat, events: [{ beats: 2 }] },
  halfRest: { len: 2, fits: strongBeat, events: [{ beats: 2, rest: true }] },
  quarter: { len: 1, fits: anyBeat, events: [{ beats: 1 }] },
  quarterRest: { len: 1, fits: anyBeat, events: [{ beats: 1, rest: true }] },
  eighths: { len: 1, fits: anyBeat, events: [{ beats: 0.5, beam: true }, { beats: 0.5, beam: true }] },
  restEighth: { len: 1, fits: anyBeat, events: [{ beats: 0.5, rest: true }, { beats: 0.5 }] },
  dottedQuarterEighth: { len: 2, fits: strongBeat, events: [{ beats: 1.5, dotted: true }, { beats: 0.5 }] },
  syncopation: { len: 2, fits: strongBeat, events: [{ beats: 0.5 }, { beats: 1 }, { beats: 0.5 }] },
};

export const LEVELS = [
  {
    id: 1,
    name: 'Whole, half & quarter notes',
    timeSigs: [4],
    cells: { whole: 1, half: 3, quarter: 4 },
  },
  {
    id: 2,
    name: 'Rests & 3/4 time',
    timeSigs: [4, 3],
    cells: { whole: 0.5, dottedHalf: 1.5, half: 2, halfRest: 1, quarter: 4, quarterRest: 2 },
  },
  {
    id: 3,
    name: 'Eighth notes',
    timeSigs: [4, 3],
    cells: { dottedHalf: 1, half: 1.5, halfRest: 0.5, quarter: 3, quarterRest: 1.5, eighths: 4 },
  },
  {
    id: 4,
    name: 'Dotted rhythms',
    timeSigs: [4, 3, 2],
    cells: { half: 1, quarter: 2.5, quarterRest: 1, eighths: 2.5, restEighth: 1.5, dottedQuarterEighth: 3 },
  },
  {
    id: 5,
    name: 'Syncopation',
    timeSigs: [4, 3, 2],
    cells: { half: 1, quarter: 2, quarterRest: 1, eighths: 2, restEighth: 1.5, dottedQuarterEighth: 2, syncopation: 3 },
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
  const bpb = lvl.timeSigs[Math.floor(random() * lvl.timeSigs.length)];
  return { ...generateFromCells({ cells: lvl.cells, beatsPerBar: bpb, pitches, bars, random }), level: lvl.id };
}

/** The rhythm patterns ("cells") exercises are built from. */
export const CELL_NAMES = Object.keys(CELLS);

/** Can these cells fill a bar of this length? */
export function canFill(cells, bpb) {
  return Object.keys(cells).some((c) => CELLS[c].len === 1) || (bpb === 4 && 'whole' in cells);
}

/**
 * Make an exercise from weighted rhythm cells.
 * @param {object} o
 * @param {Object<string, number>} o.cells cell name -> weight
 * @param {number} o.beatsPerBar
 * @param {number[]} o.pitches sounding MIDI notes to use (stepwise order)
 */
export function generateFromCells({ cells, beatsPerBar: bpb, pitches, bars = 4, random = Math.random }) {
  const lvl = { cells };

  const barCells = [];
  for (let b = 0; b < bars; b++) {
    let cells;
    for (let attempt = 0; attempt < 30; attempt++) {
      cells = fillBar(lvl, bpb, random);
      const events = cells.flatMap((c) => CELLS[c].events);
      const notes = events.filter((e) => !e.rest);
      const ok =
        notes.length > 0 &&
        // Start on a note so there's a clear entry...
        (b > 0 || !events[0].rest) &&
        // ...and end on a note of at least a beat.
        (b < bars - 1 || (!events.at(-1).rest && events.at(-1).beats >= 1));
      if (ok) break;
    }
    barCells.push(cells);
  }

  // Lay events out in time and assign pitches with a gentle stepwise walk.
  const events = [];
  let beat = 0;
  let group = 0;
  let pitchIdx = Math.floor(pitches.length / 2);
  barCells.forEach((cells, barIndex) => {
    for (const name of cells) {
      group++;
      for (const e of CELLS[name].events) {
        const ev = { beat, beats: e.beats, rest: !!e.rest, dotted: !!e.dotted, bar: barIndex, cell: name, cellId: group };
        if (e.beam) ev.beamGroup = group;
        if (!ev.rest) {
          if (pitches.length > 1 && events.some((x) => !x.rest)) {
            const step = [-2, -1, -1, 0, 1, 1, 2][Math.floor(random() * 7)];
            pitchIdx = Math.max(0, Math.min(pitches.length - 1, pitchIdx + step));
          }
          ev.midi = pitches[pitchIdx];
        }
        events.push(ev);
        beat += e.beats;
      }
    }
  });

  return { beatsPerBar: bpb, bars, totalBeats: bars * bpb, events };
}

function fillBar(lvl, bpb, random) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const cells = [];
    let pos = 0;
    while (pos < bpb) {
      const options = Object.entries(lvl.cells).filter(
        ([name]) => pos + CELLS[name].len <= bpb && CELLS[name].fits(pos, bpb),
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
      pos += CELLS[pick].len;
    }
    if (pos === bpb) return cells;
  }
  return Array(bpb).fill('quarter');
}

/** Exercise of steady quarter notes, used to measure the device's delay. */
export function calibrationExercise(midi) {
  const events = [];
  for (let i = 0; i < 8; i++) events.push({ beat: i, beats: 1, rest: false, dotted: false, bar: i >> 2, midi });
  return { level: 0, beatsPerBar: 4, bars: 2, totalBeats: 8, events };
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
  const expected = exercise.events.filter((e) => !e.rest);
  const onsets = expected.map((e) => e.beat * beatSec);

  // Each written note claims the closest unclaimed played note near it.
  const used = new Set();
  const notes = expected.map((e, i) => {
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

    const expectedDur = e.beats * beatSec;
    const result = { event: e, expectedStart: start, expectedEnd: start + expectedDur };
    if (best === -1) return { ...result, status: 'missed', score: 0 };
    used.add(best);
    const p = played[best];
    const errorMs = (p.start - start) * 1000;
    const held = p.end - p.start;
    const lengthRatio = held / expectedDur;

    const timingScore = clamp(1 - (Math.abs(errorMs) - 30) / 170, 0, 1);
    const lengthScore = clamp(lengthRatio / 0.75, 0, 1);
    const wrongPitch = checkPitch && p.midi != null && Math.round(p.midi) !== e.midi;
    let score = 0.7 * timingScore + 0.3 * lengthScore;
    if (wrongPitch) score *= 0.5;

    const timing = Math.abs(errorMs) <= ON_TIME_MS ? 'good' : Math.abs(errorMs) <= CLOSE_MS ? 'close' : 'off';
    return {
      ...result,
      played: p,
      status: timing,
      errorMs,
      lengthRatio,
      short: lengthRatio < 0.7,
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
  const shortNotes = matched.filter((n) => n.short && n.event.beats >= 1);
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
    const long = shortNotes.filter((n) => n.event.beats >= 2).length;
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
  if (notes.some((n) => n.short && n.event.beats >= 1)) return { text: 'Too short', level: 'close' };
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
