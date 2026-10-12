// Rhythm Reading screen: show a rhythm, play it back, count in, listen to
// the player, and show how their timing compared.

import { LEVELS, generateExercise, OnsetTracker, meterOf, scoreRhythm, barVerdicts, resultMarks, playedBeats, ON_TIME_MS } from './rhythm.js?v=1.9';
import { RhythmSheet } from './notation.js?v=1.9';
import { playDemo, scheduleBarClicks, clicksPerBar, clickIndex } from './rhythm-play.js?v=1.9';
import { writtenMidi } from './recorders.js?v=1.9';

// Easy left-hand notes, as semitones above the recorder's lowest note. On a
// C recorder these are written G A B C D; on an F recorder, C D E F G — the
// same fingerings either way.
const NOTE_SETS = { 1: [11], 3: [7, 9, 11], 5: [7, 9, 11, 12, 14] };
const MIN_BPM = 40;
const MAX_BPM = 140;

export function initRhythmView(d) {
  const { $, state } = d;
  let exercise = null;
  let sheet = null;
  let active = null; // the current demo or performance

  // ---------------------------------------------------------------- controls

  for (const lvl of LEVELS) $('rh-level').add(new Option(`${lvl.id}. ${lvl.name}`, String(lvl.id)));
  $('rh-level').value = String(state.rhythmLevel);
  $('rh-level').addEventListener('change', (e) => {
    state.rhythmLevel = Number(e.target.value);
    d.save();
    newExercise();
  });

  $('rh-notes').value = String(state.rhythmNotes);
  $('rh-notes').addEventListener('change', (e) => {
    state.rhythmNotes = Number(e.target.value);
    d.save();
    newExercise();
  });

  const setBpm = (bpm) => {
    state.bpm = Math.max(MIN_BPM, Math.min(MAX_BPM, bpm));
    $('rh-bpm').textContent = String(state.bpm);
    d.save();
  };
  setBpm(state.bpm);
  $('rh-slower').addEventListener('click', () => setBpm(state.bpm - 5));
  $('rh-faster').addEventListener('click', () => setBpm(state.bpm + 5));

  $('rh-playhead').addEventListener('change', (e) => {
    state.showPlayhead = e.target.checked;
    d.save();
  });

  $('rh-click').checked = state.clickWhilePlaying;
  $('rh-click').addEventListener('change', (e) => {
    state.clickWhilePlaying = e.target.checked;
    d.save();
  });

  $('rh-new').addEventListener('click', newExercise);
  $('rh-hear').addEventListener('click', hearIt);
  $('rh-play').addEventListener('click', perform);
  $('rh-stop').addEventListener('click', () => stop(true));
  $('rh-again').addEventListener('click', perform);
  $('rh-next').addEventListener('click', () => {
    newExercise();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener('resize', () => sheet?.render());

  // --------------------------------------------------------------- exercise

  function pitches() {
    const r = d.recorder();
    return NOTE_SETS[state.rhythmNotes].map((o) => r.lowest + o);
  }

  function newExercise() {
    stop();
    exercise = generateExercise({ level: state.rhythmLevel, pitches: pitches() });
    showExercise();
  }

  function showExercise() {
    sheet = new RhythmSheet($('rh-sheet'), exercise, (m) => writtenMidi(d.recorder(), m));
    const names = [...new Set(pitches().map((m) => d.writtenInfo(m).name))].join(' ');
    const best = state.rhythmBest[state.rhythmLevel];
    $('rh-meta').textContent = `${exercise.bars} bars of ${meterOf(exercise).id} · notes: ${names}${best != null ? ` · best on this level: ${best}` : ''}`;
    $('rh-results').hidden = true;
    renderBeats(null);
    setStatus(`Press Play when ready. You'll hear a bar of clicks (${clicksPerBar(meterOf(exercise))}) to count you in.`);
  }

  function renderBeats(current, counting = false) {
    const n = clicksPerBar(meterOf(exercise));
    const el = $('rh-beats');
    if (el.childElementCount !== n) {
      el.replaceChildren(...Array.from({ length: n }, (_, i) => Object.assign(document.createElement('span'), { textContent: String(i + 1) })));
    }
    [...el.children].forEach((c, i) => {
      c.classList.toggle('on', i === current);
      c.classList.toggle('count', counting && i === current);
    });
  }

  function setStatus(text) {
    $('rh-status').textContent = text;
  }

  function setBusy(busy) {
    $('rh-play').hidden = busy;
    $('rh-hear').hidden = busy;
    $('rh-new').hidden = busy;
    $('rh-stop').hidden = !busy;
    for (const id of ['rh-level', 'rh-notes', 'rh-slower', 'rh-faster', 'rh-again', 'rh-next']) $(id).disabled = busy;
  }

  // ---------------------------------------------------------------- hear it

  function hearIt() {
    stop();
    sheet.clearResults();
    $('rh-results').hidden = true;
    setBusy(true);
    setStatus('Listen and follow the music…');
    const run = { kind: 'demo', cancelled: false };
    active = run;
    run.cancel = playDemo(exercise, state.bpm, state.a4, followBeat, () => {
      if (run.cancelled) return;
      stop();
      setStatus('Your turn — press Play when ready.');
    });
  }

  /** Move the playhead and beat counter to a position in beats (negative = count-in). */
  function followBeat(pos) {
    const m = meterOf(exercise);
    if (pos < 0) {
      const count = pos < -m.bpb ? -1 : clickIndex(pos, m);
      renderBeats(count, true);
      sheet.setCursor(null);
      if (active?.kind !== 'demo') setStatus(count >= clicksPerBar(m) - 1 ? 'Breathe in… play!' : `Count-in: ${count + 1}`);
    } else {
      renderBeats(clickIndex(pos, m));
      // While the player is reading, the moving line is optional (it gives the timing away).
      if (active?.kind === 'demo' || state.showPlayhead) sheet.setCursor(Math.min(pos, exercise.totalBeats));
    }
  }

  // ---------------------------------------------------------------- perform

  async function perform() {
    stop();
    $('rh-error').hidden = true;
    try {
      await d.startMic();
    } catch (err) {
      d.showMicError($('rh-error'), err);
      return;
    }
    sheet.clearResults();
    $('rh-results').hidden = true;

    const ctx = d.listener.ctx;
    const beat = 60 / state.bpm;
    const m = meterOf(exercise);
    const t0 = ctx.currentTime + 0.3;
    const start = t0 + m.bpb * beat;
    const end = start + exercise.totalBeats * beat;
    scheduleBarClicks(ctx, m, t0, beat, 1);
    if (state.clickWhilePlaying) {
      scheduleBarClicks(ctx, m, start, beat, exercise.bars, 0.7);
    }
    const latency = state.latencyMs != null ? state.latencyMs / 1000 : d.listener.estimatedLatency();

    const run = { kind: 'perform', tracker: new OnsetTracker(), start, beat, latency, cancelled: false };
    active = run;
    setBusy(true);
    d.requestWakeLock();

    run.unsub = d.listener.onPitch((reading) => {
      if (run.cancelled) return;
      d.setLevel($('rh-mic'), reading);
      const midi = reading.freq ? d.pitchToMidi(reading.freq) : null;
      const tonal = midi != null || (reading.clarity >= 0.4 && reading.rms >= reading.gate);
      for (const b of reading.blocks) run.tracker.push(b.t, b.rms, reading.gate, midi, tonal);
      const now = reading.audioTime;
      const pos = (now - (ctx.outputLatency || 0) - start) / beat;
      followBeat(pos);
      if (pos >= 0) setStatus('Playing…');
      $('rh-heard').textContent = midi != null ? `♪ ${d.writtenInfo(Math.round(midi)).name}` : tonal ? '♪' : '—';
      if (now > end + latency + 0.35) finish(run, now);
    });
  }

  function finish(run, now) {
    const played = run.tracker
      .finish(now)
      .map((n) => ({ start: n.start - run.latency - run.start, end: n.end - run.latency - run.start, midi: n.midi }))
      .filter((n) => n.start >= -0.5 * run.beat); // ignore warm-up toots during the count-in
    const ex = exercise;
    stop();

    const result = scoreRhythm(ex, played, state.bpm, { checkPitch: state.rhythmNotes > 1 });
    const { statuses, offsets } = resultMarks(ex, result);
    sheet.setResults(statuses, offsets);
    sheet.setBarLabels(barVerdicts(ex, result));
    sheet.setPlayed(playedBeats(result, played, run.beat));

    const prev = state.rhythmBest[ex.level];
    state.rhythmBest[ex.level] = Math.max(prev ?? 0, result.overall);
    d.save();
    showResults(result, prev);
  }

  function showResults(r, prevBest) {
    const ring = $('rh-score-ring');
    ring.style.setProperty('--pct', String(r.overall));
    ring.style.setProperty('--ring', d.scoreColor(r.overall));
    $('rh-score-value').textContent = String(r.overall);
    $('rh-grade').textContent = r.grade.label;
    $('rh-stars').textContent = '★'.repeat(r.grade.stars) + '☆'.repeat(5 - r.grade.stars);
    $('rh-stars').setAttribute('aria-label', `${r.grade.stars} out of 5 stars`);
    const best = prevBest == null ? 'First try on this level' : r.overall > prevBest ? `New best! (was ${prevBest})` : `Best: ${Math.max(prevBest, r.overall)}`;
    $('rh-score-note').textContent = `Level ${exercise.level} · ${state.bpm} bpm · ${best}`;

    $('rh-ontime').textContent = `${r.onTime}/${r.total}`;
    $('rh-ontime-sub').textContent = `notes within ±${ON_TIME_MS} ms`;
    card('rh-card-ontime', r.onTime / r.total >= 0.85 ? 'good' : r.onTime / r.total >= 0.6 ? 'close' : 'far');

    const m = r.meanErrorMs;
    if (m == null) {
      $('rh-tendency').textContent = '—';
      $('rh-tendency-sub').textContent = 'no notes heard';
      card('rh-card-tendency', 'far');
    } else {
      const ms = Math.round(Math.abs(m));
      $('rh-tendency').textContent = Math.abs(m) <= 25 ? 'Steady' : m < 0 ? 'Rushing' : 'Dragging';
      $('rh-tendency-sub').textContent = Math.abs(m) <= 25 ? `within ${Math.max(ms, 1)} ms of the beat on average` : `${ms} ms ${m < 0 ? 'early' : 'late'} on average`;
      card('rh-card-tendency', Math.abs(m) <= 25 ? 'good' : Math.abs(m) <= 60 ? 'close' : 'far');
    }

    const heard = r.total - r.missed;
    const full = heard - r.shortNotes;
    $('rh-lengths').textContent = `${full}/${heard}`;
    $('rh-lengths-sub').textContent = 'notes held for their full length';
    card('rh-card-lengths', !heard ? 'far' : full / heard >= 0.85 ? 'good' : full / heard >= 0.6 ? 'close' : 'far');

    $('rh-missed').textContent = `${r.missed} / ${r.extras.length}`;
    $('rh-missed-sub').textContent = 'missed notes / extra notes';
    card('rh-card-missed', r.missed + r.extras.length === 0 ? 'good' : r.missed + r.extras.length <= 2 ? 'close' : 'far');

    $('rh-tips').replaceChildren(...r.tips.map((t) => Object.assign(document.createElement('li'), { textContent: t })));
    $('rh-results').hidden = false;
    setStatus('Here’s how you did. The strip under each bar shows when you played.');
    $('rh-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function card(id, level) {
    $(id).classList.remove('good', 'close', 'far');
    $(id).classList.add(level);
  }

  // ------------------------------------------------------------------ stop

  function stop(byUser = false) {
    const run = active;
    active = null;
    if (!run) return;
    run.cancelled = true;
    run.unsub?.();
    run.cancel?.();
    if (run.kind !== 'demo') {
      // Silence any clicks still scheduled by restarting the mic context.
      d.listener.stop();
      d.releaseWakeLock();
    }
    setBusy(false);
    d.setLevel($('rh-mic'), { rms: 0, gate: 0 });
    $('rh-heard').textContent = '—';
    sheet?.setCursor(null);
    renderBeats(null);
    if (byUser) setStatus('Stopped. Press Play to try again.');
  }

  return {
    enter() {
      $('rh-playhead').checked = !!state.showPlayhead;
      if (!exercise) newExercise();
      else sheet.render();
    },
    leave() {
      stop();
    },
    recorderChanged() {
      if (exercise) newExercise();
    },
    get busy() {
      return !!active && active.kind !== 'demo';
    },
    stopIfRunning() {
      if (active) stop(true);
    },
  };
}

