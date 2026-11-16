// Rhythm Memory: read a bar (or several), then the music is hidden and you
// play it from memory. Auto mode runs it as one continuous loop on a
// steady click: read, play, next, with each round marked while you read
// the next. Step mode does one round at a time. You choose how many bars;
// passing makes the rhythms harder, struggling makes them easier.

import { LEVELS, generateExercise, OnsetTracker, meterOf, scoreRhythm, barVerdicts, resultMarks, playedBeats } from './rhythm.js?v=4.1';
import { RhythmSheet } from './notation.js?v=4.1';
import { scheduleBarClicks, clicksPerBar, clickIndex } from './rhythm-play.js?v=4.1';
import { writtenMidi, rhythmPitches, checksPitch } from './recorders.js?v=4.1';
import { bindTapPad } from './tap-input.js?v=4.1';
import { newMemory, recordRound, readingTime, PASS, MAX_BARS } from './memory.js?v=4.1';

const CHANGE_TEXT = {
  harder: (m) => `🚀 Two in a row! Harder rhythms: ${LEVELS[m.level - 1].name}.`,
  easier: (m) => `Easing off: back to ${LEVELS[m.level - 1].name}.`,
};

export function initMemoryView(d) {
  const { $, state } = d;
  state.memory ||= newMemory();
  state.memory.readTime ||= 'free';
  state.memory.notes ||= '1';
  state.memory.mode ||= 'auto'; // 'auto' (continuous) or 'step' (one at a time)
  state.memory.readX ||= '1'; // auto: read for 1× or 2× the music's length
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
  $('mm-mode').addEventListener('change', (e) => {
    stop();
    M().mode = e.target.value;
    d.save();
    syncControls();
    if (M().mode === 'step') newRound();
    else autoIdle();
  });
  $('mm-readx').addEventListener('change', (e) => {
    M().readX = e.target.value;
    d.save();
  });
  $('mm-auto-start').addEventListener('click', () => startAuto());
  $('mm-auto-stop').addEventListener('click', () => stopAuto(true));
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
    $('mm-mode').value = M().mode;
    $('mm-readx').value = M().readX;
    $('mm-bpm').textContent = String(state.bpm);
    const auto = M().mode === 'auto';
    for (const el of document.querySelectorAll('#rh-memory .mm-step-only')) el.hidden = auto;
    for (const el of document.querySelectorAll('#rh-memory .mm-auto-only')) el.hidden = !auto;
    if (!auto) $('mm-results').hidden = phase !== 'marked';
    // Buttons: each mode's own, depending on whether something's running.
    const running = active?.kind === 'perform';
    $('mm-ready').hidden = auto || phase !== 'reading' || running;
    $('mm-stop').hidden = auto || !running;
    $('mm-auto-start').hidden = !auto || !!autoRun;
    $('mm-auto-stop').hidden = !auto || !autoRun;
    // While the loop runs, keep the music at the top: settings tuck away.
    document.querySelector('#rh-memory .rh-controls').hidden = !!autoRun;
    document.querySelector('#rh-memory .mm-intro').hidden = !!autoRun;
    syncInput();
    const lvl = LEVELS[M().level - 1];
    $('mm-stage').textContent = `Level ${lvl.id}: ${lvl.name} · remember ${M().bars} bar${M().bars > 1 ? 's' : ''}`;
    $('mm-dots').textContent = M().passes ? '● pass so far: one more to move up' : '';
  }
  function syncInput() {
    const tap = d.tapMode();
    const auto = !!autoRun;
    $('mm-input').value = state.rhythmInput || 'mic';
    $('mm-tap').hidden = !tap || (phase !== 'playing' && !auto);
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
    if (run && run === autoRun) {
      autoRun = null;
      phase = 'idle';
    }
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

  // ---------------------------------------------------------- auto mode

  let autoRun = null;

  function autoIdle() {
    phase = 'idle';
    exercise = generateExercise({ level: M().level, pitches: pitches(), bars: M().bars });
    sheet = new RhythmSheet($('mm-sheet'), exercise, (m) => writtenMidi(d.recorder(), m), d.recorder().clef);
    $('mm-sheet').hidden = false;
    $('mm-hidden').hidden = true;
    $('mm-phase').textContent = '';
    $('mm-phase').className = 'mm-phase';
    $('mm-auto-start').hidden = false;
    $('mm-auto-stop').hidden = true;
    setStatus('Press Start. Each round: read the music while the click plays, then it disappears and you play it straight away. Then a new one appears.');
  }

  async function startAuto() {
    stop();
    $('mm-error').hidden = true;
    try {
      await d.startMic();
    } catch (err) {
      d.showMicError($('mm-error'), err);
      return;
    }
    const ctx = d.listener.ctx;
    autoRun = { kind: 'perform', ctx, beat: 60 / state.bpm, bpm: state.bpm, latency: d.rhythmLatency(), tracker: new OnsetTracker(), rounds: [], scores: [], shown: null, cancelled: false };
    active = autoRun;
    phase = 'reading';
    d.requestWakeLock();
    $('mm-auto-start').hidden = true;
    $('mm-auto-stop').hidden = false;
    $('mm-history').replaceChildren();
    $('mm-last').hidden = true;
    $('mm-auto-summary').hidden = true;
    syncInput();
    scheduleRound(generateExercise({ level: M().level, pitches: pitches(), bars: M().bars }), ctx.currentTime + 0.4);
    autoRun.unsub = d.listener.onPitch(onAutoFrame);
    syncControls();
    $('mm-stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Put a round on the timeline: reading, then playing, with the click all the way through. */
  function scheduleRound(ex, t) {
    const r = autoRun;
    const m = meterOf(ex);
    const barSec = m.bpb * r.beat;
    const readBars = ex.bars * Number(M().readX);
    const round = { ex, m, readStart: t, playStart: t + readBars * barSec, scored: false };
    round.playEnd = round.playStart + ex.bars * barSec;
    // Reading: soft clicks, with the last bar as a clear count-in.
    if (readBars > 1) scheduleBarClicks(r.ctx, m, t, r.beat, readBars - 1, 0.6);
    scheduleBarClicks(r.ctx, m, round.playStart - barSec, r.beat, 1, 1);
    scheduleBarClicks(r.ctx, m, round.playStart, r.beat, ex.bars, state.clickWhilePlaying ? 0.7 : 0.25);
    r.rounds.push(round);
  }

  function onAutoFrame(reading) {
    const r = autoRun;
    if (!r || r.cancelled) return;
    d.setLevel($('mm-mic'), reading);
    const midi = reading.freq ? d.pitchToMidi(reading.freq) : null;
    const tonal = midi != null || (reading.clarity >= 0.4 && reading.rms >= reading.gate);
    for (const b of reading.blocks) r.tracker.push(b.t, b.rms, reading.gate, midi, tonal);
    const now = reading.audioTime;
    const heard = now - (r.ctx.outputLatency || 0);
    const round = [...r.rounds].reverse().find((x) => heard >= x.readStart);
    if (round) {
      const playing = heard >= round.playStart;
      if (r.shown !== round || r.phase !== playing) showPhase(round, playing);
      const from = playing ? round.playStart : round.readStart;
      const pos = (heard - from) / r.beat;
      renderBeats(clickIndex(pos % round.m.bpb, round.m), !playing && heard >= round.playStart - round.m.bpb * r.beat);
      if (!playing) {
        const toGo = Math.ceil((round.playStart - heard) / r.beat);
        $('mm-phase-sub').textContent = toGo <= clicksPerBar(round.m) ? `play in ${toGo}…` : 'read it';
      } else {
        const bar = Math.min(round.ex.bars, Math.floor(pos / round.m.bpb) + 1);
        $('mm-phase-sub').textContent = round.ex.bars > 1 ? `bar ${bar} of ${round.ex.bars}` : 'from memory';
        [...$('mm-hidden').children].forEach((c, i) => c.classList.toggle('now', i === bar - 1));
        // Line up the next round to start the moment this one ends.
        if (!round.next) {
          round.next = true;
          scheduleRound(generateExercise({ level: M().level, pitches: pitches(), bars: M().bars }), round.playEnd);
        }
      }
    }
    // Mark each round once its last note has had time to finish.
    for (const x of r.rounds) {
      if (x.scored || now < x.playEnd + r.latency + 0.3) continue;
      scoreAutoRound(x, now);
    }
    r.rounds = r.rounds.filter((x) => !x.scored || x.playEnd > heard - 20);
    r.tracker.notes = r.tracker.notes.filter((n) => n.end > now - 20);
  }

  function showPhase(round, playing) {
    const r = autoRun;
    r.shown = round;
    r.phase = playing;
    phase = playing ? 'playing' : 'reading';
    $('mm-phase').textContent = playing ? '▶ PLAY' : '👀 READ';
    $('mm-phase').className = `mm-phase ${playing ? 'play' : 'read'}`;
    if (playing) {
      $('mm-sheet').hidden = true;
      $('mm-hidden').hidden = false;
      $('mm-hidden').replaceChildren(...Array.from({ length: round.ex.bars }, (_, i) => Object.assign(document.createElement('span'), { textContent: `bar ${i + 1}` })));
    } else {
      exercise = round.ex;
      $('mm-hidden').hidden = true;
      $('mm-sheet').hidden = false;
      sheet = new RhythmSheet($('mm-sheet'), round.ex, (m) => writtenMidi(d.recorder(), m), d.recorder().clef);
    }
    setStatus(playing ? 'Play it from memory!' : 'Read it: it disappears when the count-in ends.');
  }

  function scoreAutoRound(round, now) {
    const r = autoRun;
    round.scored = true;
    const lat = r.latency;
    const endSec = round.ex.totalBeats * r.beat;
    const played = r.tracker
      .snapshot(now)
      .filter((n) => n.start - lat >= round.playStart - 0.5 * r.beat && n.start - lat < round.playEnd - 0.1 * r.beat)
      .map((n) => ({ start: n.start - lat - round.playStart, end: Math.min(n.end - lat - round.playStart, endSec + 0.2), midi: n.midi }));
    const result = scoreRhythm(round.ex, played, r.bpm, { checkPitch: checksPitch(M().notes) && !d.tapMode() });
    const change = recordRound(M(), result.overall, LEVELS.length);
    d.save();
    r.scores.push(result.overall);
    // The round you just played, marked, under the one you're reading now.
    $('mm-last').hidden = false;
    const last = new RhythmSheet($('mm-last-sheet'), round.ex, (m) => writtenMidi(d.recorder(), m), d.recorder().clef);
    const { statuses, offsets } = resultMarks(round.ex, result);
    last.setResults(statuses, offsets);
    last.setBarLabels(barVerdicts(round.ex, result));
    $('mm-last-score').textContent = String(result.overall);
    $('mm-last-score').className = `mm-last-score ${result.overall >= PASS ? 'good' : result.overall >= 60 ? 'close' : 'far'}`;
    $('mm-last-text').textContent = change ? CHANGE_TEXT[change](M()) : result.overall >= PASS ? 'Remembered! One more like that to move up.' : `${result.onTime}/${result.total} on time, ${result.missed} missed.`;
    const chip = document.createElement('span');
    chip.className = `mm-chip ${result.overall >= PASS ? 'good' : result.overall >= 60 ? 'close' : 'far'}`;
    chip.textContent = String(result.overall);
    $('mm-history').append(chip);
    syncControls();
  }

  function stopAuto(showSummary) {
    const r = autoRun;
    if (!r) return;
    autoRun = null;
    if (active === r) stop();
    phase = 'idle';
    if (showSummary && r.scores.length) {
      const avg = Math.round(r.scores.reduce((a, b) => a + b, 0) / r.scores.length);
      const passed = r.scores.filter((x) => x >= PASS).length;
      $('mm-auto-summary').hidden = false;
      $('mm-auto-summary').textContent = `${r.scores.length} rounds · average ${avg} · ${passed} remembered. You're now on: ${$('mm-stage').textContent}.`;
    }
    autoIdle();
    syncControls();
  }

  // For automated tests only (?debug in the URL): lets a simulated player see the notes.
  if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) window.__memory = () => ({ exercise, run: active, auto: autoRun });

  return {
    enter() {
      syncControls();
      if (M().mode === 'auto') {
        if (!autoRun) autoIdle();
      } else if (!exercise) newRound();
      else if (!$('mm-sheet').hidden) sheet.render();
    },
    leave() {
      if (autoRun) return stopAuto(false);
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
      if (autoRun) return stopAuto(true);
      if (active) {
        stop();
        reread();
      }
    },
  };
}
