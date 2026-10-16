// Plays a rhythm exercise (count-in, clicks and notes) so the player can
// hear how it should go.

import { scheduleClick, scheduleTone, createPlaybackContext } from './audio.js?v=3.6';
import { midiToFreq } from './music.js?v=3.6';
import { soundingNotes, meterOf } from './rhythm.js?v=3.6';

/**
 * @param {object} exercise
 * @param {number} bpm
 * @param {number} a4 tuning reference
 * @param {(beatPos: number) => void} onPosition called every frame; negative during the count-in
 * @param {() => void} onEnd
 * @returns {() => void} call to stop early
 */
export function playDemo(exercise, bpm, a4, onPosition, onEnd) {
  const ctx = createPlaybackContext();
  const beat = 60 / bpm;
  const m = meterOf(exercise);
  const t0 = ctx.currentTime + 0.2;
  const start = t0 + m.bpb * beat;
  scheduleBarClicks(ctx, m, t0, beat, 1, 1);
  scheduleBarClicks(ctx, m, start, beat, exercise.bars, 0.5);
  for (const n of soundingNotes(exercise)) {
    scheduleTone(ctx, midiToFreq(n.midi, a4), start + n.beat * beat, n.beats * beat - Math.min(0.07, beat * 0.15));
  }
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    const pos = (ctx.currentTime - (ctx.outputLatency || 0) - start) / beat;
    onPosition(pos);
    if (pos > exercise.totalBeats + 0.3) {
      stop();
      onEnd();
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  function stop() {
    stopped = true;
    ctx.close().catch(() => {});
  }
  return stop;
}

/**
 * Metronome clicks for `bars` bars from `time`: one per beat of the time
 * signature (dotted quarters in 6/8), louder on the downbeat.
 * @returns {AudioScheduledSourceNode[]}
 */
export function scheduleBarClicks(ctx, meter, time, beat, bars, volume = 1) {
  const perBar = Math.round(meter.bpb / meter.click);
  const out = [];
  for (let b = 0; b < bars; b++) {
    for (let k = 0; k < perBar; k++) {
      out.push(scheduleClick(ctx, time + (b * meter.bpb + k * meter.click) * beat, k === 0, volume));
    }
  }
  return out;
}

/** Number of metronome clicks in a bar of this time signature. */
export const clicksPerBar = (meter) => Math.round(meter.bpb / meter.click);

/**
 * Which click of the bar a position (in quarters from the first downbeat)
 * falls on. Negative positions are the count-in bar.
 */
export function clickIndex(pos, meter) {
  const n = clicksPerBar(meter);
  return ((Math.floor(pos / meter.click) % n) + n) % n;
}
