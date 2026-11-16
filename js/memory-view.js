// Rhythm Memory: read a bar (or several), then the music is hidden and you
// play it from memory after a count-in. It's marked note by note when the
// music comes back. Pass and you remember more bars at once; after four
// bars the rhythms get harder.

import { LEVELS, generateExercise, OnsetTracker, meterOf, scoreRhythm, barVerdicts, resultMarks, playedBeats } from './rhythm.js?v=4.0';
import { RhythmSheet } from './notation.js?v=4.0';
import { scheduleBarClicks, clicksPerBar, clickIndex } from './rhythm-play.js?v=4.0';
import { writtenMidi, rhythmPitches, checksPitch } from './recorders.js?v=4.0';
import { bindTapPad } from './tap-input.js?v=4.0';
import { newMemory, recordRound, readingTime, PASS, MAX_BARS } from './memory.js?v=4.0';

const CHANGE_TEXT = {
  'more-bars': (m) => `🎉 Two in a row! Now remember ${m.bars} bars at once.`,
  harder: (m) => `🚀 Level up: ${LEVELS[m.level - 1].name}. Back to one bar while you get used to them.`,
  'fewer-bars': (m) => `Easing off: ${m.bars} bar${m.bars > 1 ? 's' : ''} at a time for now.`,
  easier: (m) => `Easing off: back to ${LEVELS[m.level - 1].name}, ${m.bars} bars.`,
};

export function initMemoryView(d) {
  const { $, state } = d;
  state.memory ||= newMemory();
  state.memory.readTime ||= 'free';
  state.memory.notes ||= '1';
  const M = () => state.memory;
  let exercise = null;
  let sheet = null;
  let active = null; // reading timer or performance
  let phase = 'idle'; // idle → reading → playing → marked

  // ----------------------------------------------------------- controls

  for (const lvl of LEVELS) $('mm-level').add(new Option(`${lvl.id}. ${lvl.name}`, String(lvl.id)));
  for (let b = 1; b <= MAX_BARS; b++) $('mm-bars').add(new Option(`${b} bar${b > 1 ? 's' : ''}`, String(b)));
  $('mm-level').addEventListener('change', (e) => {
    M().level = Number(e.target.value);
    M().passes = M().fails = 0;
    d.save();
    newRound();
  });
  $('mm-bars').addEventListener('change', (e) => {
    M().bars = Number(e.target.value);
    M().passes = M().fails = 0;
    d.save();
    newRound();
  });
  $('mm-time').addEventListener('change', (e) => {
    M().readTime = e.target.value;
    d.save();
  });
  $('mm-notes').addEventListener('change', (e) => {
    M().notes = e.target.value;
    d.save();
    newRound();
  });
  $('mm-input').addEventListener('change', (e) => {
    state.rhythmInput = e.target.value;
    d.save();
    syncInput();
  });
  bindTapPad($('mm-tap'), d.tap, () => d.tapMode() && active?.kind === 'perform');

  function syncControls() {
    $('mm-level').value = String(M().level);
    $('mm-bars').value = String(M().bars);
    $('mm-time').value = M().readTime;
    $('mm-notes').value = M().notes;
    $('mm-bpm').textContent = String(state.bpm);
    syncInput();
    const lvl = LEVELS[M().level - 1];
    $('mm-stage').textContent = `Level ${lvl.id}: ${lvl.name} · remember ${M().bars} bar${M().bars > 1 ? 's' : ''}`;
    $('mm-dots').textContent = M().passes ? '● pass so far: one more to move up' : '';
  }
  function syncInput() {
    const tap = d.tapMode();
    $('mm-input').value = state.rhythmInput || 'mic';
    $('mm-tap').hidden = !tap || phase !== 'playing';
    $('mm-mic-row').hidden = tap;
  }

  // Tempo, shared with the Practice tab.
  const setBpm = (bpm) => {
    state.bpm = Math.max(40, Math.min(140, bpm));
    $('mm-bpm').textContent = String(state.bpm);
    d.save();
  };
  $('mm-slower').addEventListener('click', () => setBpm(state.bpm - 5));
  $('mm-faster').addEventListener('click', () => setBpm(state.bpm + 5));

  $('mm-ready').addEventListener('click', () => perform());
  $('mm-next').addEventListener('click', () => newRound());
  $('mm-again').addEventListener('click', () => reread());
  $('mm-stop').addEventListener('click', () => {
    stop();
    reread();
  });
  window.addEventListener('resize', () => !$('mm-sheet').hidden && sheet?.render());

  // ------------------------------------------------------------- rounds

  function pitches() {
    return rhythmPitches(d.recorder(), String(M().notes));
  }

  function newRound() {
    stop();
    exercise = generateExercise({ level: M().level, pitches: pitches(), bars: M().bars });
    syncControls();
    reread();
  }

  /** Show the music to read (a new round, or the same one again). */
  function reread() {
    stop();
    phase = 'reading';
    $('mm-sheet').hidden = false;
    $('mm-hidden').hidden = true;
    $('mm-results').hidden = true;
    sheet = new RhythmSheet($('mm-sheet'), exercise, (m) => writtenMidi(d.recorder(), m), d.recorder().clef);
    $('mm-ready').hidden = false;
    $('mm-stop').hidden = true;
    syncInput();
    const secs = readingTime(M().readTime, exercise.bars);
    if (secs == null) {
      setStatus(`Read it until you know it, then press "I've got it". You'll get a count-in of ${clicksPerBar(meterOf(exercise))} and play it from memory.`);
      return;
    }
    // Timed reading: count down, then it's hidden.
    const until = performance.now() + secs * 1000;
    const run = { kind: 'reading', cancelled: false };
    active = run;
    const tick = () => {
      if (run.cancelled) return;
      const left = Math.ceil((until - performance.now()) / 1000);
      if (left <= 0) return perform();
      setStatus(`Read it… ${left}s`);
      run.timer = setTimeout(tick, 200);
    };
    tick();
  }

  function setStatus(text) {
    $('mm-status').textContent = text;
  }

  function renderBeats(current, counting = false) {
    const n = clicksPerBar(meterOf(exercise));
    const el = $('mm-beats');
    if (el.childElementCount !== n) el.replaceChildren(...Array.from({ length: n }, (_, i) => Object.assign(document.createElement('span'), { textContent: String(i + 1) })));
    [...el.children].forEach((c, i) => {
      c.classList.toggle('on', i === current);
      c.classList.toggle('count', counting && i === current);
    });
  }

  // --------------------------------------------------------- performing

  async function perform() {
    stop();
    $('mm-error').hidden = true;
    try {
      await d.startMic();
    } catch (err) {
      d.showMicError($('mm-error'), err);
      phase = 'reading';
      return;
    }
    // Hide the music: now it's from memory.
    phase = 'playing';
    $('mm-sheet').hidden = true;
    $('mm-hidden').hidden = false;
    $('mm-hidden').replaceChildren(...Array.from({ length: exercise.bars }, (_, i) => Object.assign(document.createElement('span'), { textContent: `bar ${i + 1}` })));
    $('mm-ready').hidden = true;
    $('mm-stop').hidden = false;
    syncInput();

    const ctx = d.listener.ctx;
    const beat = 60 / state.bpm;
    const m = meterOf(exercise);
    const t0 = ctx.currentTime + 0.3;
    const start = t0 + m.bpb * beat;
    const end = start + exercise.totalBeats * beat;
    scheduleBarClicks(ctx, m, t0, beat, 1);
    if (state.clickWhilePlaying) scheduleBarClicks(ctx, m, start, beat, exercise.bars, 0.7);
    const latency = d.rhythmLatency();
    const run = { kind: 'perform', tracker: new OnsetTracker(), ctx, start, beat, latency, cancelled: false };
    active = run;
    d.requestWakeLock();
    run.unsub = d.listener.onPitch((reading) => {
      if (run.cancelled) return;
      d.setLevel($('mm-mic'), reading);
      const midi = reading.freq ? d.pitchToMidi(reading.freq) : null;
      const tonal = midi != null || (reading.clarity >= 0.4 && reading.rms >= reading.gate);
      for (const b of reading.blocks) run.tracker.push(b.t, b.rms, reading.gate, midi, tonal);
      const now = reading.audioTime;
      const pos = (now - (ctx.outputLatency || 0) - start) / beat;
      if (pos < 0) {
        const count = pos < -m.bpb ? -1 : clickIndex(pos, m);
        renderBeats(count, true);
        setStatus(count >= clicksPerBar(m) - 1 ? 'Go! From memory…' : `Count-in: ${count + 1}`);
      } else {
        renderBeats(clickIndex(pos, m));
        const bar = Math.min(exercise.bars, Math.floor(pos / m.bpb) + 1);
        setStatus(`Playing from memory: bar ${bar} of ${exercise.bars}`);
        [...$('mm-hidden').children].forEach((c, i) => c.classList.toggle('now', i === bar - 1));
      }
      if (now > end + latency + 0.35) finish(run, now);
    });
  }

  function finish(run, now) {
    const played = run.tracker
      .finish(now)
      .map((n) => ({ start: n.start - run.latency - run.start, end: n.end - run.latency - run.start, midi: n.midi }))
      .filter((n) => n.start >= -0.5 * run.beat);
    stop();
    phase = 'marked';
    const result = scoreRhythm(exercise, played, state.bpm, { checkPitch: checksPitch(M().notes) && !d.tapMode() });
    // Bring the music back, marked.
    $('mm-hidden').hidden = true;
    $('mm-sheet').hidden = false;
    sheet.render();
    const { statuses, offsets } = resultMarks(exercise, result);
    sheet.setResults(statuses, offsets);
    sheet.setBarLabels(barVerdicts(exercise, result));
    sheet.setPlayed(playedBeats(result, played, run.beat));
    const change = recordRound(M(), result.overall, LEVELS.length);
    d.save();

    const ring = $('mm-score-ring');
    ring.style.setProperty('--pct', String(result.overall));
    ring.style.setProperty('--ring', d.scoreColor(result.overall));
    $('mm-score-value').textContent = String(result.overall);
    $('mm-verdict').textContent = result.overall >= PASS ? 'Remembered!' : result.overall >= 60 ? 'Nearly' : 'Not quite';
    $('mm-detail').textContent = `${result.onTime}/${result.total} notes on time · ${result.missed} missed · ${result.extras.length} extra`;
    $('mm-change').textContent = change ? CHANGE_TEXT[change](M()) : result.overall >= PASS ? 'One more pass in a row to move up.' : '';
    $('mm-tips').replaceChildren(...result.tips.slice(0, 2).map((t) => Object.assign(document.createElement('li'), { textContent: t })));
    $('mm-results').hidden = false;
    $('mm-ready').hidden = true;
    syncControls();
    setStatus('Here’s the music again, marked: green on time, amber a bit off, red off the beat, grey missed.');
  }

  function stop() {
    const run = active;
    active = null;
    if (!run) return;
    run.cancelled = true;
    clearTimeout(run.timer);
    run.unsub?.();
    if (run.kind === 'perform') {
      d.listener.stop();
      d.releaseWakeLock();
    }
    $('mm-stop').hidden = true;
    d.setLevel($('mm-mic'), { rms: 0, gate: 0 });
    if (exercise) renderBeats(null);
  }

  // For automated tests only (?debug in the URL): lets a simulated player see the notes.
  if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) window.__memory = () => ({ exercise, run: active });

  return {
    enter() {
      syncControls();
      if (!exercise) newRound();
      else if (!$('mm-sheet').hidden) sheet.render();
    },
    leave() {
      if (active) {
        stop();
        if (phase === 'playing') reread();
      }
    },
    recorderChanged() {
      if (exercise) newRound();
    },
    get busy() {
      return active?.kind === 'perform';
    },
    stopIfRunning() {
      if (active) {
        stop();
        reread();
      }
    },
  };
}
