// Timing calibration: the player plays a short note on each of 8 clicks and
// we measure the delay between the click and the mic on this device. Works
// from either Rhythm Reading tab; it has its own small display.

import { calibrationExercise, calibrationOffset, OnsetTracker } from './rhythm.js?v=3.5';
import { scheduleClick } from './audio.js?v=3.5';

const BPM = 80;

export function initCalibration(d) {
  const { $, state } = d;
  let run = null;

  $('rh-calibrate').addEventListener('click', () => (run ? stop(true) : start()));
  $('rh-cal-reset').addEventListener('click', () => {
    state.latencyMs = null;
    d.save();
    showSaved();
  });

  function showSaved(justSaved = false) {
    $('rh-cal-result').textContent = state.latencyMs == null
      ? 'Using an automatic estimate of your device’s delay.'
      : `${justSaved ? 'Saved. ' : ''}Your device’s delay is set to ${state.latencyMs} ms.`;
    $('rh-cal-reset').hidden = state.latencyMs == null;
  }

  function setBeat(n, counting) {
    const el = $('cal-beats');
    if (el.childElementCount !== 4) {
      el.replaceChildren(...[1, 2, 3, 4].map((i) => Object.assign(document.createElement('span'), { textContent: String(i) })));
    }
    [...el.children].forEach((c, i) => {
      c.classList.toggle('on', i === n);
      c.classList.toggle('count', counting && i === n);
    });
  }

  async function start() {
    d.beforeCalibrate(); // stop anything else using the mic
    try {
      await d.startMic();
    } catch (err) {
      d.showMicError($('rh-cal-result'), err);
      return;
    }
    const ctx = d.listener.ctx;
    const ex = calibrationExercise(d.recorder().lowest + 11);
    const beat = 60 / BPM;
    const t0 = ctx.currentTime + 0.3;
    const begin = t0 + 4 * beat;
    const end = begin + ex.totalBeats * beat;
    for (let i = 0; i < 4 + ex.totalBeats; i++) scheduleClick(ctx, t0 + i * beat, i % 4 === 0);
    run = { tracker: new OnsetTracker() };
    $('rh-calibrate').textContent = 'Stop';
    $('cal-beats').hidden = false;
    run.unsub = d.listener.onPitch((reading) => {
      const midi = reading.freq ? d.pitchToMidi(reading.freq) : null;
      const tonal = midi != null || (reading.clarity >= 0.4 && reading.rms >= reading.gate);
      for (const b of reading.blocks) run.tracker.push(b.t, b.rms, reading.gate, midi, tonal);
      const now = reading.audioTime;
      const pos = (now - (ctx.outputLatency || 0) - begin) / beat;
      if (pos < 0) {
        const n = Math.floor(pos + 4);
        setBeat(n, true);
        $('rh-cal-result').textContent = n >= 0 ? `Count-in: ${n + 1}… then play a short note on every click` : 'Get ready…';
      } else if (pos < ex.totalBeats) {
        setBeat(Math.floor(pos) % 4, false);
        $('rh-cal-result').textContent = `Play on every click: ${Math.floor(pos) + 1} of ${ex.totalBeats}`;
      }
      if (now > end + 0.5) finish(now, begin);
    });
  }

  function finish(now, begin) {
    const played = run.tracker
      .finish(now)
      .map((n) => ({ start: n.start - begin, end: n.end - begin, midi: n.midi }));
    stop();
    const ex = calibrationExercise(0);
    const offset = calibrationOffset(ex, played, BPM);
    if (offset == null) {
      $('rh-cal-result').textContent = 'Not enough notes were heard to measure. Play a short, clear note on every click and try again.';
      return;
    }
    state.latencyMs = Math.round(Math.max(0, Math.min(0.4, offset)) * 1000);
    d.save();
    showSaved(true);
  }

  function stop(byUser = false) {
    if (!run) return;
    run.unsub?.();
    run = null;
    d.listener.stop(); // also silences clicks still scheduled
    $('rh-calibrate').textContent = 'Calibrate timing';
    $('cal-beats').hidden = true;
    if (byUser) showSaved();
  }

  showSaved();
  return {
    stop: () => stop(true),
    get busy() {
      return !!run;
    },
  };
}
