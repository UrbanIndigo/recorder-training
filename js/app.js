// UI controller: navigation, the long-tone exercise, results, and the tuner.

import { RECORDERS, recorderNotes, writtenMidi, detectionRange } from './recorders.js?v=2.8';
import { noteInfo, midiToFreq, freqToMidi, describeInterval } from './music.js?v=2.8';
import { PitchListener, playReferenceTone } from './audio.js?v=2.8';
import { PitchSmoother } from './pitch.js?v=2.8';
import { LongToneSession, IN_TUNE_CENTS } from './longtone.js?v=2.8';
import { staffSvg } from './staff.js?v=2.8';
import { drawPitchChart } from './chart.js?v=2.8';
import { loadState, saveState, recordAttempt, noteHistory } from './storage.js?v=2.8';
import { initRhythmView } from './rhythm-view.js?v=2.8';
import { initEndlessView } from './endless-view.js?v=2.8';
import { initCalibration } from './calibration.js?v=2.8';
import { initChordsView } from './chords-view.js?v=2.8';
import { TapListener } from './tap-input.js?v=2.8';
import { initGameView } from './game/game.js?v=2.8';

const $ = (id) => document.getElementById(id);
const state = loadState();
if (!RECORDERS[state.recorder]) state.recorder = 'soprano';

const listener = new PitchListener();
const smoother = new PitchSmoother(5);

const recorder = () => RECORDERS[state.recorder];
/** Note name the player reads, e.g. "C" for soprano low C. */
const writtenInfo = (soundingMidi) => noteInfo(writtenMidi(recorder(), soundingMidi));
const pitchToMidi = (freq) => freqToMidi(freq, state.a4);

// ---------------------------------------------------------------- navigation

const PARENT = { home: null, pick: 'home', run: 'pick', results: 'pick', tuner: 'home', rhythm: 'home', chords: 'home', game: 'home' };
let currentView = 'home';

function show(view) {
  if (currentView === 'run') stopExercise();
  if (currentView === 'tuner') stopTuner();
  if (currentView === 'chords') chordsView.leave();
  if (currentView === 'game') gameView.leave();
  if (currentView === 'rhythm') {
    rhythmView.leave();
    endlessView.leave();
    calibration.stop();
  }
  for (const el of document.querySelectorAll('.view')) el.hidden = el.id !== `view-${view}`;
  currentView = view;
  $('back-btn').hidden = !PARENT[view];
  window.scrollTo(0, 0);
  if (view === 'pick') renderNoteGrid();
  if (view === 'tuner') startTuner();
  if (view === 'rhythm') showRhythmTab(state.rhythmTab);
  if (view === 'chords') chordsView.enter();
  if (view === 'game') gameView.enter();
}

$('back-btn').addEventListener('click', () => show(PARENT[currentView] || 'home'));
for (const card of document.querySelectorAll('[data-goto]')) {
  card.addEventListener('click', () => show(card.dataset.goto));
}

// ------------------------------------------------------------------ settings

const recorderSelect = $('recorder-select');
for (const r of Object.values(RECORDERS)) {
  recorderSelect.add(new Option(`${r.shortName} (${r.keyName})`, r.id));
}
recorderSelect.value = state.recorder;
recorderSelect.addEventListener('change', () => {
  state.recorder = recorderSelect.value;
  saveState(state);
  applyDetectorOptions();
  if (currentView === 'run' || currentView === 'results') show('pick');
  else if (currentView === 'pick') renderNoteGrid();
  rhythmView.recorderChanged();
  endlessView.recorderChanged();
});

$('a4-select').value = String(state.a4);
$('a4-select').addEventListener('change', (e) => {
  state.a4 = Number(e.target.value);
  saveState(state);
  applyDetectorOptions();
});

$('sensitivity').value = String(state.sensitivity);
$('sensitivity').addEventListener('input', (e) => {
  state.sensitivity = Number(e.target.value);
  saveState(state);
  applyDetectorOptions();
});

$('naturals-only').checked = state.naturalsOnly;
$('naturals-only').addEventListener('change', (e) => {
  state.naturalsOnly = e.target.checked;
  saveState(state);
  renderNoteGrid();
});

$('duration-select').value = String(state.duration);
$('duration-select').addEventListener('change', (e) => {
  state.duration = Number(e.target.value);
  saveState(state);
});

function applyDetectorOptions() {
  // Sensitivity 0..1: how far above the background noise a note must be,
  // from 10x (only loud playing) down to 1.5x.
  const gateRatio = 10 * 0.15 ** state.sensitivity;
  listener.setOptions({ ...detectionRange(recorder(), state.a4), gateRatio });
}
applyDetectorOptions();

// --------------------------------------------------------------- note picker

let targetMidi = null;

function pickableNotes() {
  return recorderNotes(recorder()).filter((m) => !state.naturalsOnly || noteInfo(m).natural);
}

function renderNoteGrid() {
  const grid = $('note-grid');
  grid.replaceChildren();
  for (const m of pickableNotes()) {
    const w = writtenInfo(m);
    const btn = document.createElement('button');
    btn.className = `note-btn${w.natural ? '' : ' accidental'}`;
    btn.innerHTML = `<span class="n">${w.name}</span><span class="o">${w.label}</span>`;
    const hist = noteHistory(state, state.recorder, m);
    if (hist) {
      const dot = document.createElement('span');
      dot.className = 'best';
      dot.style.background = scoreColor(hist.best);
      dot.title = `Best score: ${hist.best}`;
      btn.append(dot);
      btn.setAttribute('aria-label', `${w.label}, best score ${hist.best}`);
    }
    btn.addEventListener('click', () => openExercise(m));
    grid.append(btn);
  }
}

$('random-note').addEventListener('click', () => {
  const notes = pickableNotes().filter((m) => m !== targetMidi);
  openExercise(notes[Math.floor(Math.random() * notes.length)]);
});

// ------------------------------------------------------------------ exercise

let session = null;
let unsubscribe = null;
let wakeLock = null;

function openExercise(midi) {
  targetMidi = midi;
  show('run');
  const w = writtenInfo(midi);
  const sounding = noteInfo(midi);
  $('target-staff').innerHTML = staffSvg(w.midi, recorder().clef);
  $('target-name').textContent = w.name;
  const soundsNote = recorder().octaveTransposition ? ` · sounds ${sounding.label}` : '';
  $('target-detail').textContent = `Written ${w.label}${soundsNote} · ${midiToFreq(midi, state.a4).toFixed(1)} Hz`;
  resetRunUi();
}

function resetRunUi() {
  session = null;
  $('start-btn').hidden = false;
  $('start-btn').textContent = 'Start';
  $('cancel-btn').hidden = true;
  $('play-ref').disabled = false;
  $('mic-error').hidden = true;
  $('run-status').textContent = 'Press start';
  setTimer(0, state.duration);
  setLive(null, $('live-note'), $('meter-needle'), $('live-cents'));
  drawPitchChart($('run-chart'), [], targetMidi, state.duration);
}

$('play-ref').addEventListener('click', async () => {
  const btn = $('play-ref');
  btn.disabled = true;
  await playReferenceTone(midiToFreq(targetMidi, state.a4), 2);
  if (!session) btn.disabled = false;
});

$('start-btn').addEventListener('click', startExercise);
$('cancel-btn').addEventListener('click', () => {
  stopExercise();
  resetRunUi();
});

async function startExercise() {
  $('start-btn').disabled = true;
  try {
    await startMic();
  } catch (err) {
    showMicError($('mic-error'), err);
    $('start-btn').disabled = false;
    return;
  }
  $('start-btn').disabled = false;
  $('start-btn').hidden = true;
  $('cancel-btn').hidden = false;
  $('play-ref').disabled = true;
  $('run-status').textContent = 'Start playing when ready';
  smoother.reset();
  session = new LongToneSession({ targetMidi, duration: state.duration });
  unsubscribe = listener.onPitch(onExerciseFrame);
  requestWakeLock();
}

function onExerciseFrame(reading, now) {
  if (!session) return;
  setLevel($('run-level'), reading);
  const midi = smoother.push(reading.freq ? pitchToMidi(reading.freq) : null);
  session.push(midi, now);
  setLive(midi, $('live-note'), $('meter-needle'), $('live-cents'), targetMidi);

  if (session.state === 'holding') {
    $('run-status').textContent = 'Hold it…';
    setTimer(session.elapsed(now), session.duration);
    drawPitchChart($('run-chart'), session.samples, targetMidi, session.duration);
  } else if (session.state === 'done') {
    const result = session.result;
    stopExercise();
    showResults(result);
  }
}

function stopExercise() {
  unsubscribe?.();
  unsubscribe = null;
  session = null;
  listener.stop();
  releaseWakeLock();
}

document.addEventListener('visibilitychange', () => {
  // Timing can't be trusted while the page is in the background.
  if (document.hidden && session) {
    stopExercise();
    resetRunUi();
  }
  if (document.hidden && rhythmView.busy) rhythmView.stopIfRunning();
  if (document.hidden && endlessView.busy) endlessView.stopIfRunning();
  if (document.hidden && calibration.busy) calibration.stop();
  if (document.hidden && gameView.busy) gameView.stopIfRunning();
});

function setTimer(elapsed, duration) {
  const remaining = Math.max(0, duration - elapsed);
  $('timer-seconds').textContent = String(Math.ceil(remaining - 1e-6));
  const circumference = 2 * Math.PI * 52;
  $('timer-fill').style.strokeDashoffset = String(circumference * (1 - elapsed / duration));
}

/**
 * Update a live note label, needle and cents readout.
 * With a target, the needle shows cents from the target; without one
 * (tuner), cents from the nearest note.
 */
function setLive(midi, noteEl, needleEl, centsEl, target = null) {
  if (midi == null) {
    noteEl.textContent = target == null ? '—' : 'Listening…';
    noteEl.className = noteEl.className.replace(/\b(on|off)\b/g, '').trim();
    needleEl.classList.remove('visible');
    centsEl.innerHTML = '&nbsp;';
    return null;
  }
  const nearest = Math.round(midi);
  const ref = target ?? nearest;
  const cents = (midi - ref) * 100;
  const played = writtenInfo(nearest);

  if (target != null) {
    const onNote = nearest === target;
    noteEl.textContent = onNote
      ? `✓ You're on ${played.name}`
      : `You're playing ${played.name} — ${describeInterval(nearest - target)}`;
    noteEl.classList.toggle('on', onNote);
    noteEl.classList.toggle('off', !onNote);
  }

  const clamped = Math.max(-50, Math.min(50, cents));
  needleEl.style.left = `${50 + clamped}%`;
  needleEl.classList.add('visible');
  needleEl.classList.toggle('good', Math.abs(cents) <= IN_TUNE_CENTS);
  needleEl.classList.toggle('close', Math.abs(cents) > IN_TUNE_CENTS && Math.abs(cents) <= 25);
  needleEl.classList.toggle('far', Math.abs(cents) > 25);
  centsEl.textContent = centsText(cents);
  return played;
}

/** Mic level bar on a log scale (about 60 dB), with a mark at the noise gate. */
function setLevel(el, reading) {
  const pos = (v) => Math.max(0, Math.min(100, ((Math.log10(Math.max(v, 1e-6)) + 3.5) / 3) * 100));
  el.querySelector('.level-fill').style.width = `${pos(reading.rms)}%`;
  el.querySelector('.level-gate').style.left = `${pos(reading.gate)}%`;
  el.classList.toggle('heard', reading.rms >= reading.gate);
}

function centsText(cents) {
  const c = Math.round(cents);
  if (Math.abs(c) <= 3) return `${c > 0 ? '+' : ''}${c}¢ · spot on`;
  if (Math.abs(c) <= IN_TUNE_CENTS) return `${c > 0 ? '+' : ''}${c}¢ · in tune`;
  return `${c > 0 ? '+' : ''}${c}¢ · ${c > 0 ? 'sharp' : 'flat'}`;
}

// ------------------------------------------------------------------- results

let lastResult = null;

function showResults(result) {
  lastResult = result;
  const prev = noteHistory(state, state.recorder, result.targetMidi)?.best ?? null;
  const entry = recordAttempt(state, state.recorder, result.targetMidi, result);
  saveState(state);

  show('results');
  const target = writtenInfo(result.targetMidi);

  const ring = $('score-ring');
  ring.style.setProperty('--pct', String(result.overall));
  ring.style.setProperty('--ring', scoreColor(result.overall));
  $('score-value').textContent = String(result.overall);
  $('score-grade').textContent = result.grade.label;
  $('score-stars').textContent = '★'.repeat(result.grade.stars) + '☆'.repeat(5 - result.grade.stars);
  $('score-stars').setAttribute('aria-label', `${result.grade.stars} out of 5 stars`);
  const best = prev == null ? 'First try on this note' : result.overall > prev ? `New best! (was ${prev})` : `Best: ${entry.best}`;
  $('score-note').textContent = `${target.label} · ${result.duration} s hold · ${best}`;

  // Right note?
  const notePct = Math.round(result.noteAccuracy * 100);
  $('res-note').textContent = `${notePct}%`;
  if (result.mostPlayed == null) {
    $('res-note-sub').textContent = 'No clear note heard';
  } else if (result.mostPlayed === result.targetMidi) {
    $('res-note-sub').textContent = `of the time on ${target.name}`;
  } else {
    const played = writtenInfo(result.mostPlayed);
    $('res-note-sub').textContent = `Mostly played ${played.name} (${describeInterval(result.mostPlayed - result.targetMidi)})`;
  }
  setCardLevel('card-note', notePct >= 90 ? 'good' : notePct >= 60 ? 'close' : 'far');

  // How in tune?
  if (result.meanCents == null) {
    $('res-tune').textContent = '—';
    $('res-tune-sub').textContent = `Never settled on ${target.name}`;
    setCardLevel('card-tune', 'far');
  } else {
    const c = Math.round(result.meanCents);
    const word = Math.abs(c) <= IN_TUNE_CENTS ? 'in tune on average' : c > 0 ? 'sharp on average' : 'flat on average';
    $('res-tune').textContent = `${c > 0 ? '+' : ''}${c}¢`;
    $('res-tune-sub').textContent = `${word} · within ±${IN_TUNE_CENTS}¢ ${Math.round(result.timeInTune * 100)}% of the time`;
    const abs = result.meanAbsCents;
    setCardLevel('card-tune', abs <= IN_TUNE_CENTS ? 'good' : abs <= 25 ? 'close' : 'far');
  }

  // Steadiness
  if (result.stdCents == null) {
    $('res-steady').textContent = '—';
    $('res-steady-sub').textContent = 'Not enough time on the note';
    setCardLevel('card-steady', 'far');
  } else {
    const s = result.stdCents;
    $('res-steady').textContent = `±${Math.round(s)}¢`;
    $('res-steady-sub').textContent = s < 5 ? 'Rock steady' : s < 10 ? 'Steady' : s < 20 ? 'A bit wobbly' : 'Wobbly';
    setCardLevel('card-steady', s < 10 ? 'good' : s < 20 ? 'close' : 'far');
  }

  // Held for
  $('res-sustain').textContent = `${(result.sustain * result.duration).toFixed(1)} s`;
  $('res-sustain-sub').textContent = `of ${result.duration} s with sound`;
  setCardLevel('card-sustain', result.sustain >= 0.95 ? 'good' : result.sustain >= 0.8 ? 'close' : 'far');

  $('tips').replaceChildren(...result.tips.map((t) => Object.assign(document.createElement('li'), { textContent: t })));
  requestAnimationFrame(() => drawPitchChart($('result-chart'), result.samples, result.targetMidi, result.duration));
}

function setCardLevel(id, level) {
  $(id).classList.remove('good', 'close', 'far');
  $(id).classList.add(level);
}

function scoreColor(score) {
  const css = getComputedStyle(document.documentElement);
  const name = score >= 75 ? '--good' : score >= 50 ? '--warn' : '--bad';
  return css.getPropertyValue(name).trim();
}

$('again-btn').addEventListener('click', () => openExercise(lastResult.targetMidi));
$('choose-btn').addEventListener('click', () => show('pick'));
$('next-btn').addEventListener('click', () => {
  const notes = pickableNotes();
  const i = notes.indexOf(lastResult.targetMidi);
  openExercise(notes[(i + 1) % notes.length]);
});

window.addEventListener('resize', () => {
  if (currentView === 'results' && lastResult) {
    drawPitchChart($('result-chart'), lastResult.samples, lastResult.targetMidi, lastResult.duration);
  }
});

// --------------------------------------------------------------------- tuner

let tunerUnsub = null;

async function startTuner() {
  $('tuner-error').hidden = true;
  setLive(null, $('tuner-note'), $('tuner-needle'), $('tuner-cents'));
  $('tuner-detail').textContent = 'Play a note…';
  try {
    await startMic();
  } catch (err) {
    showMicError($('tuner-error'), err);
    return;
  }
  if (currentView !== 'tuner') return;
  const info = listener.info();
  $('tuner-diag').textContent = info
    ? `Mic ${info.micRate ? `${info.micRate} Hz` : 'rate unknown'} · analysing at ${info.contextRate} Hz · A = ${state.a4} Hz`
    : '';
  smoother.reset();
  tunerUnsub = listener.onPitch((reading) => {
    setLevel($('tuner-level'), reading);
    const midi = smoother.push(reading.freq ? pitchToMidi(reading.freq) : null);
    const played = setLive(midi, $('tuner-note'), $('tuner-needle'), $('tuner-cents'));
    if (played) {
      $('tuner-note').textContent = played.name;
      const sounding = noteInfo(midi);
      const soundsNote = recorder().octaveTransposition ? ` · sounds ${sounding.label}` : '';
      $('tuner-detail').textContent = `Written ${played.label}${soundsNote} · ${reading.freq.toFixed(1)} Hz`;
    }
  });
}

function stopTuner() {
  tunerUnsub?.();
  tunerUnsub = null;
  listener.stop();
}

// ---------------------------------------------------------------- mic helpers

async function startMic() {
  if (!navigator.mediaDevices?.getUserMedia) {
    const err = new Error('insecure');
    err.name = 'InsecureContext';
    throw err;
  }
  await listener.start();
}

function showMicError(el, err) {
  const messages = {
    NotAllowedError: 'Microphone access was blocked. Allow the microphone for this page in your browser settings, then try again.',
    NotFoundError: 'No microphone was found. Plug one in or check your device settings.',
    InsecureContext: 'The microphone only works when this page is opened over https:// or from localhost.',
  };
  el.textContent = messages[err.name] || `Couldn't start the microphone (${err.message || err.name}).`;
  el.hidden = false;
}

async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    wakeLock = null;
  }
}

function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

// Rhythm reading can listen with the mic or use a tap button. The rhythm
// screens and calibration share the mic: starting one stops the other.
const tapListener = new TapListener();
const tapMode = () => state.rhythmInput === 'tap';
const startRhythmMic = async () => {
  if (calibration.busy) calibration.stop();
  if (tapMode()) {
    listener.stop();
    await tapListener.start();
  } else {
    tapListener.stop();
    await startMic();
  }
};
const rhythmDeps = {
  $,
  state,
  save: () => saveState(state),
  get listener() {
    return tapMode() ? tapListener : listener;
  },
  tap: tapListener,
  tapMode,
  /** Delay to allow for: measured (mic), estimated (mic), or the speaker's (tap). */
  rhythmLatency: () => (tapMode() ? tapListener.estimatedLatency() : state.latencyMs != null ? state.latencyMs / 1000 : listener.estimatedLatency()),
  startMic: startRhythmMic,
  showMicError,
  recorder,
  writtenInfo,
  pitchToMidi,
  setLevel,
  scoreColor,
  requestWakeLock,
  releaseWakeLock,
};

const rhythmView = initRhythmView(rhythmDeps);

const endlessView = initEndlessView(rhythmDeps);

const calibration = initCalibration({
  $,
  state,
  save: () => saveState(state),
  listener,
  startMic,
  showMicError,
  recorder,
  pitchToMidi,
  beforeCalibrate: () => {
    rhythmView.leave();
    endlessView.leave();
  },
});

const chordsView = initChordsView({ $, state, save: () => saveState(state) });
const gameView = initGameView({ $, state, save: () => saveState(state) });

// Rhythm Reading has two tabs: Endless (adaptive) and Practice (pick a level).
function showRhythmTab(tab) {
  state.rhythmTab = tab;
  saveState(state);
  const endless = tab === 'endless';
  $('rh-endless').hidden = !endless;
  $('rh-practice').hidden = endless;
  $('tab-endless').setAttribute('aria-selected', String(endless));
  $('tab-practice').setAttribute('aria-selected', String(!endless));
  if (endless) {
    rhythmView.leave();
    endlessView.enter();
  } else {
    endlessView.leave();
    rhythmView.enter();
  }
}
$('tab-endless').addEventListener('click', () => showRhythmTab('endless'));
$('tab-practice').addEventListener('click', () => showRhythmTab('practice'));

show('home');
window.appReady = true;
