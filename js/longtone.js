// Long-tone exercise: wait for the player to start, record pitch for a fixed
// duration, then score it. No DOM code here, so it can be unit tested.

import { noteInfo, describeInterval } from './music.js?v=3.0';

/** Pitch readings in the first moment of a note are unsettled; skip them when judging tuning. */
export const SETTLE_SECONDS = 0.3;
/** Within this many cents counts as "in tune". */
export const IN_TUNE_CENTS = 10;
/** Sound must continue this long before the timer starts. */
const START_SECONDS = 0.15;

export class LongToneSession {
  constructor({ targetMidi, duration = 10 }) {
    this.targetMidi = targetMidi;
    this.duration = duration;
    this.state = 'waiting'; // waiting -> holding -> done
    this.samples = [];
    this.soundSince = null;
    this.startTime = null;
    this.result = null;
  }

  /**
   * Feed one pitch reading.
   * @param {number|null} midi detected pitch (fractional MIDI) or null for silence
   * @param {number} now time in seconds
   */
  push(midi, now) {
    if (this.state === 'waiting') {
      if (midi == null) {
        this.soundSince = null;
        return;
      }
      if (this.soundSince == null) this.soundSince = now;
      if (now - this.soundSince < START_SECONDS) return;
      this.state = 'holding';
      this.startTime = this.soundSince;
    }
    if (this.state !== 'holding') return;

    const t = now - this.startTime;
    if (t >= this.duration) {
      this.finish();
      return;
    }
    this.samples.push({ t, midi });
  }

  elapsed(now) {
    if (this.state === 'waiting') return 0;
    if (this.state === 'done') return this.duration;
    return Math.min(this.duration, now - this.startTime);
  }

  finish() {
    if (this.state === 'done') return this.result;
    this.state = 'done';
    this.result = scoreLongTone(this.samples, this.targetMidi, this.duration);
    return this.result;
  }
}

/**
 * Score a held note.
 * @param {{t: number, midi: number|null}[]} samples
 */
export function scoreLongTone(samples, targetMidi, duration) {
  const total = samples.length;
  const voiced = samples.filter((s) => s.midi != null);
  const sustain = total ? voiced.length / total : 0;

  // 1. Right note? Fraction of sounding time on the target note.
  const settled = voiced.filter((s) => s.t >= SETTLE_SECONDS);
  const judged = settled.length ? settled : voiced;
  const onNote = judged.filter((s) => Math.round(s.midi) === targetMidi);
  const noteAccuracy = judged.length ? onNote.length / judged.length : 0;

  // Which note was played most?
  const counts = new Map();
  for (const s of judged) {
    const m = Math.round(s.midi);
    counts.set(m, (counts.get(m) || 0) + 1);
  }
  let mostPlayed = null;
  for (const [m, c] of counts) if (mostPlayed == null || c > counts.get(mostPlayed)) mostPlayed = m;

  // 2. How in tune? Cents from target while on the right note.
  const cents = onNote.map((s) => (s.midi - targetMidi) * 100);
  const meanCents = cents.length ? avg(cents) : null;
  const meanAbsCents = cents.length ? avg(cents.map(Math.abs)) : null;
  const stdCents = cents.length ? Math.sqrt(avg(cents.map((c) => (c - meanCents) ** 2))) : null;
  const inTuneCount = cents.filter((c) => Math.abs(c) <= IN_TUNE_CENTS).length;
  const timeInTune = judged.length ? inTuneCount / judged.length : 0;

  // Sub-scores out of 100.
  const noteScore = noteAccuracy * 100;
  const tuningScore = meanAbsCents == null ? 0 : clamp(100 - (meanAbsCents - 3) * 3.5, 0, 100);
  const steadinessScore = stdCents == null ? 0 : clamp(100 - (stdCents - 2) * 4, 0, 100);
  const sustainScore = sustain * 100;

  // Tuning and steadiness only count for the time spent on the right note.
  const overall = Math.round(
    0.25 * noteScore +
      0.4 * tuningScore * noteAccuracy +
      0.2 * steadinessScore * noteAccuracy +
      0.15 * sustainScore,
  );

  const result = {
    targetMidi,
    duration,
    samples,
    overall,
    grade: gradeFor(overall),
    sustain,
    noteAccuracy,
    mostPlayed,
    meanCents,
    meanAbsCents,
    stdCents,
    timeInTune,
    subScores: {
      note: Math.round(noteScore),
      tuning: Math.round(tuningScore),
      steadiness: Math.round(steadinessScore),
      sustain: Math.round(sustainScore),
    },
  };
  result.tips = tipsFor(result);
  return result;
}

export function gradeFor(score) {
  if (score >= 90) return { label: 'Excellent!', stars: 5 };
  if (score >= 75) return { label: 'Great', stars: 4 };
  if (score >= 60) return { label: 'Good', stars: 3 };
  if (score >= 40) return { label: 'Getting there', stars: 2 };
  return { label: 'Keep practising', stars: 1 };
}

/** Practical advice based on the result. */
export function tipsFor(r) {
  const tips = [];
  const target = noteInfo(r.targetMidi);

  if (r.mostPlayed == null) {
    tips.push('No clear note was heard. Get closer to the microphone and play a little louder.');
    return tips;
  }

  if (r.sustain < 0.85) {
    tips.push('The note stopped or broke up partway through. Take a full, relaxed breath before you start and keep the air flowing until the timer ends.');
  }

  if (r.noteAccuracy < 0.6 && r.mostPlayed !== r.targetMidi) {
    const diff = r.mostPlayed - r.targetMidi;
    const played = noteInfo(r.mostPlayed).name;
    if (diff === 12) {
      tips.push(`You were mostly an octave too high (overblowing). Blow more gently, with slow warm air, to keep ${target.name} in the low register.`);
    } else if (diff === -12) {
      tips.push(`You were mostly an octave too low. For high notes, pinch the thumb hole (leave a small gap) and use a little more air.`);
    } else {
      tips.push(`You were mostly playing ${played}, ${describeInterval(diff)} than ${target.name}. Check your fingering, and that every hole is fully covered.`);
    }
  } else if (r.noteAccuracy < 0.9) {
    tips.push(`You slipped off ${target.name} some of the time. Make sure your fingers fully seal the holes — a tiny leak can make the note jump.`);
  }

  if (r.meanCents != null) {
    if (r.meanCents > IN_TUNE_CENTS) {
      tips.push(`On average you were sharp (${Math.round(r.meanCents)} cents high). On a recorder, more air raises the pitch — try blowing a little softer.`);
    } else if (r.meanCents < -IN_TUNE_CENTS) {
      tips.push(`On average you were flat (${Math.round(-r.meanCents)} cents low). Try slightly firmer, faster air to bring the pitch up.`);
    }
    if (r.stdCents > 12) {
      tips.push('The pitch wobbled. Breathe from low in your body and keep the airstream really steady — imagine the note as a straight line.');
    }
  }

  if (!tips.length) tips.push('Lovely, steady and in tune. Try a harder note, or a longer hold.');
  return tips;
}

function avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
