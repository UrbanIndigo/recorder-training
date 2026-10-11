// Plays a rhythm exercise (count-in, clicks and notes) so the player can
// hear how it should go.

import { scheduleClick, scheduleTone, createPlaybackContext } from './audio.js?v=1.6';
import { midiToFreq } from './music.js?v=1.6';

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
  const bpb = exercise.beatsPerBar;
  const t0 = ctx.currentTime + 0.2;
  const start = t0 + bpb * beat;
  for (let i = 0; i < bpb; i++) scheduleClick(ctx, t0 + i * beat, i === 0);
  for (let b = 0; b < exercise.totalBeats; b++) scheduleClick(ctx, start + b * beat, b % bpb === 0, 0.5);
  for (const e of exercise.events) {
    if (!e.rest) scheduleTone(ctx, midiToFreq(e.midi, a4), start + e.beat * beat, e.beats * beat - Math.min(0.07, beat * 0.15));
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
