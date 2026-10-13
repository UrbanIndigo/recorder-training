// Endless rhythm training as a scrolling score. One bar after another, with
// no breaks: after a single count-in the metronome keeps going and the
// score scrolls up a row as each bar ends. You see the bar you're playing,
// just one bar ahead, and the last few bars with how you did. A bar you
// fail comes back two bars later (the bar right below you never changes).
// New patterns unlock and the tempo adapts as you go.

import { CURRICULUM, newProgress, migrateProgress, chooseNext, recordResult, unlockProgress, topIssues } from './progression.js?v=2.8';
import { OnsetTracker, scoreRhythm, generateFromCells, barVerdict, resultMarks, meterOf, cellFitsMeter, soundingNotes } from './rhythm.js?v=2.8';
import { RhythmSheet } from './notation.js?v=2.8';
import { playDemo, scheduleBarClicks, clicksPerBar, clickIndex } from './rhythm-play.js?v=2.8';
import { writtenMidi, rhythmPitches, checksPitch } from './recorders.js?v=2.8';
import { bindTapPad } from './tap-input.js?v=2.8';
import { diatonicStep } from './music.js?v=2.8';

const PASS = 70; // bars scoring below this come back
const WINDOW = 6; // bars that must go well before the next unlock
// Finished bars kept in view above the current one (one fewer in tap mode,
// to leave room for the tap button).
const rowsBehind = (d) => (d.tapMode() ? 1 : 2);

export function initEndlessView(d) {
  const { $, state } = d;
  if (!state.endless) state.endless = newProgress(state.bpm);
  migrateProgress(state.endless);
  const progress = () => state.endless;

  let run = null;
  let preview = []; // the first two bars, shown before starting
  let rows = []; // { bar, el, sheet }
  let rowHeight = 120;
  let demoStop = null;
  let session = null;

  // ---------------------------------------------------------------- options

  $('en-notes').value = String(state.rhythmNotes);
  $('en-notes').addEventListener('change', (e) => {
    state.rhythmNotes = e.target.value;
    d.save();
    if (!run) resetPreview();
  });
  // Play with the microphone or a tap button (shared by both rhythm tabs).
  function syncInput() {
    const tap = d.tapMode();
    $('en-input').value = state.rhythmInput || 'mic';
    $('en-tap').hidden = !tap;
    measureRows();
    placeRows();
    $('en-mic-row').hidden = tap;
  }
  $('en-input').addEventListener('change', (e) => {
    state.rhythmInput = e.target.value;
    d.save();
    syncInput();
  });
  bindTapPad($('en-tap'), d.tap, () => d.tapMode() && !!run);
  syncInput();

  $('en-click').checked = state.clickWhilePlaying;
  $('en-click').addEventListener('change', (e) => {
    state.clickWhilePlaying = e.target.checked;
    d.save();
  });
  $('en-playhead').checked = !!state.showPlayhead;
  $('en-playhead').addEventListener('change', (e) => {
    state.showPlayhead = e.target.checked;
    d.save();
  });
  $('en-count').checked = !!state.alwaysCount;
  $('en-count').addEventListener('change', (e) => {
    state.alwaysCount = e.target.checked;
    d.save();
    for (const r of rows) r.sheet.setCounting(state.alwaysCount || !!r.bar.hint);
  });
  CURRICULUM.forEach((step, i) => $('en-jump').add(new Option(`${i + 1}. ${step.title}`, String(i))));
  $('en-jump').addEventListener('change', (e) => {
    const p = progress();
    p.stage = Number(e.target.value);
    p.stageStartedAt = p.phrases;
    p.recent = [];
    d.save();
    renderStage();
    if (!run) resetPreview();
  });
  $('en-reset').addEventListener('click', () => {
    if ($('en-reset').dataset.confirm !== '1') {
      $('en-reset').dataset.confirm = '1';
      $('en-reset').textContent = 'Tap again to reset all progress';
      return;
    }
    delete $('en-reset').dataset.confirm;
    $('en-reset').textContent = 'Start over from stage 1';
    stop();
    state.endless = newProgress(state.bpm);
    d.save();
    renderStage();
    renderIssues();
    resetPreview();
  });

  $('en-start').addEventListener('click', start);
  $('en-stop').addEventListener('click', () => stop(true));
  $('en-continue').addEventListener('click', () => {
    $('en-intro').hidden = true;
  });
  $('en-intro-hear').addEventListener('click', () => {
    // A short example built mostly from the newest pattern.
    const step = CURRICULUM[progress().stage];
    const newCells = step.cell ? [step.cell] : step.cells || [];
    const meter = step.timeSig || (newCells.some((c) => cellFitsMeter(c, '6/8')) ? '6/8' : '4/4');
    const cells = meter === '6/8' ? { c_dottedQuarter: 0.5 } : { quarter: 0.5 };
    for (const c of newCells) cells[c] = 3;
    hear(generateFromCells({ cells, meter, pitches: pitches(), bars: 2 }));
  });

  window.addEventListener('resize', () => {
    for (const r of rows) r.sheet.render();
    measureRows();
    placeRows();
  });

  // ------------------------------------------------------------ the bars

  function pitches() {
    return rhythmPitches(d.recorder(), String(state.rhythmNotes));
  }

  /** Make the next bar: a failed bar coming back if one is due, else a fresh one. */
  function nextBar(prev) {
    let choice;
    if (run?.retryQueue.length) {
      const failed = run.retryQueue.shift();
      choice = { exercise: { ...failed.exercise, retry: true }, kind: 'retry', hint: true };
    } else {
      const lastPitch = prev ? soundingNotes(prev.exercise).at(-1)?.midi ?? null : null;
      choice = chooseNext(progress(), null, pitches(), Math.random, { bars: 1, standalone: false, startPitch: lastPitch });
    }
    return { id: (prev?.id ?? -1) + 1, kind: choice.kind, hint: choice.hint, exercise: choice.exercise, meter: meterOf(choice.exercise) };
  }

  /** Rows all share one height, tall enough for the notes in use. */
  function fixedHeight() {
    const r = d.recorder();
    const bottom = r.clef === 'bass' ? 18 : 30;
    const ps = pitches().map((m) => diatonicStep(writtenMidi(r, m)) - bottom);
    const hi = Math.max(8, ...ps);
    const lo = Math.min(0, ...ps);
    return { top: 34 + Math.max(0, (hi - 8) * 5 + (hi > 8 ? 6 : 0)), below: Math.max(0, (-lo - 2) * 5) };
  }

  function addRow(bar, prevBar) {
    const el = document.createElement('div');
    el.className = 'stream-row future';
    el.innerHTML = '<div class="row-side"><span class="row-num"></span><span class="row-tag"></span><span class="row-score"></span></div><div class="row-sheet"></div>';
    el.querySelector('.row-num').textContent = String(bar.id + 1);
    $('en-track').append(el);
    const sheet = new RhythmSheet(el.querySelector('.row-sheet'), bar.exercise, (m) => writtenMidi(d.recorder(), m), d.recorder().clef, {
      showTimeSig: !prevBar || prevBar.meter.id !== bar.meter.id,
      fixedHeight: fixedHeight(),
    });
    sheet.setCounting(state.alwaysCount || !!bar.hint);
    if (bar.kind === 'retry') el.querySelector('.row-tag').textContent = 'again';
    else if (bar.kind === 'review') el.querySelector('.row-tag').textContent = 'review';
    const row = { bar, el, sheet };
    rows.push(row);
    bar.row = row;
    // Keep the page light: forget rows well out of view.
    while (rows.length > 8) rows.shift().el.remove();
    measureRows();
    placeRows();
    return row;
  }

  function measureRows() {
    const first = rows[0]?.el;
    if (first) rowHeight = first.offsetHeight + 6;
    $('en-stream').style.height = `${Math.round(rowHeight * (rowsBehind(d) + 2.45))}px`;
  }

  /** Position rows, and scroll so the current bar sits third from the top. */
  function placeRows(currentId = run?.currentId ?? 0) {
    const id = Math.max(0, currentId);
    for (const r of rows) {
      r.el.style.top = `${r.bar.id * rowHeight}px`;
      const rel = r.bar.id - id;
      r.el.className = `stream-row ${rel < 0 ? 'past' : rel === 0 ? 'current' : rel === 1 ? 'next' : 'future'}`;
    }
    const lastId = rows.at(-1)?.bar.id ?? 0;
    $('en-placeholder').style.top = `${(lastId + 1) * rowHeight}px`;
    $('en-placeholder').style.height = `${rowHeight - 6}px`;
    $('en-track').style.transform = `translateY(${-Math.max(0, id - rowsBehind(d)) * rowHeight}px)`;
  }

  function clearRows() {
    for (const r of rows) r.el.remove();
    rows = [];
  }

  /** Before starting: show the first bar and the one after it. */
  function resetPreview() {
    clearRows();
    const b0 = nextBar(null);
    const b1 = nextBar(b0);
    preview = [b0, b1];
    addRow(b0, null);
    addRow(b1, b0);
    placeRows(0);
    renderBeats(b0.meter, null);
  }

  // -------------------------------------------------------------- display

  function renderStage() {
    const p = progress();
    const step = CURRICULUM[p.stage];
    $('en-stage-label').textContent = p.stage === CURRICULUM.length - 1 ? `Stage ${p.stage + 1} of ${CURRICULUM.length} · all rhythms unlocked` : `Stage ${p.stage + 1} of ${CURRICULUM.length}`;
    $('en-stage-name').textContent = step.title;
    $('en-bpm').textContent = String(p.bpm);
    $('en-streak').textContent = p.streak >= 2 ? `🔥 ${p.streak} bars in a row` : p.bestStreak ? `best streak ${p.bestStreak}` : '';
    $('en-progress-fill').style.width = `${Math.round(unlockProgress(p, { window: WINDOW }) * 100)}%`;
    $('en-progress-label').textContent = p.stage < CURRICULUM.length - 1 ? `Next unlock: ${CURRICULUM[p.stage + 1].title}` : 'Next: faster tempo';
    $('en-jump').value = String(p.stage);
  }

  /** The beat counter: one circle per click of the bar. */
  function renderBeats(meter, current, counting = false) {
    const n = clicksPerBar(meter);
    const el = $('en-beats');
    if (el.childElementCount !== n) {
      el.replaceChildren(...Array.from({ length: n }, (_, i) => Object.assign(document.createElement('span'), { textContent: String(i + 1) })));
    }
    [...el.children].forEach((c, i) => {
      c.classList.toggle('on', i === current);
      c.classList.toggle('count', counting && i === current);
    });
  }

  function setStatus(text) {
    $('en-status').textContent = text;
  }

  function setBusy(busy) {
    $('en-start').hidden = busy;
    $('en-stop').hidden = !busy;
    $('en-notes').disabled = busy;
    $('en-input').disabled = busy;
    $('en-jump').disabled = busy;
    $('en-intro-hear').hidden = busy;
  }

  /** The player's recurring problems, with a tip for each. */
  function renderIssues() {
    const issues = topIssues(progress());
    $('en-issues').hidden = !issues.length;
    $('en-issues-list').replaceChildren(
      ...issues.map((i) => {
        const li = document.createElement('li');
        li.append(i.text);
        li.append(Object.assign(document.createElement('span'), { className: 'tip', textContent: i.tip }));
        return li;
      }),
    );
  }

  function showLatest(bar, result, verdict, event) {
    const chip = $('en-chip');
    chip.textContent = String(result.overall);
    chip.style.background = d.scoreColor(result.overall);
    const bits = [`Bar ${bar.id + 1}: ${verdict.text}`];
    if (result.overall < PASS && !bar.exercise.retry) bits.push('it comes back in 2 bars');
    if (bar.kind === 'retry' && result.overall >= PASS) bits.push('nailed it this time!');
    if (event?.type === 'tempo') bits.push(event.faster ? `speeding up to ${event.bpm} bpm` : `slowing to ${event.bpm} bpm`);
    $('en-feedback-text').textContent = bits.join(' · ');
    $('en-feedback').hidden = false;
  }

  /**
   * A new pattern was unlocked. While playing, a one-line note keeps the
   * score where it is; the full explanation card appears when you stop.
   */
  function showIntro(step) {
    $('en-intro-title').textContent = step.title;
    $('en-intro-text').textContent = step.text;
    $('en-intro-count').textContent = step.count;
    if (run) {
      run.pendingIntro = true;
      $('en-feedback-text').textContent = `New: ${step.title} — count ${step.count}`;
      $('en-chip').textContent = 'NEW';
      $('en-chip').style.background = 'var(--accent)';
    } else {
      $('en-intro').hidden = false;
    }
  }

  // ------------------------------------------------------------- running

  async function start() {
    stopDemo();
    $('en-error').hidden = true;
    $('en-summary').hidden = true;
    try {
      await d.startMic();
    } catch (err) {
      d.showMicError($('en-error'), err);
      return;
    }
    session = { count: 0, total: 0, unlocked: [] };
    const ctx = d.listener.ctx;
    const latency = d.rhythmLatency();
    run = { ctx, latency, tracker: new OnsetTracker(), bars: [], currentId: -1, retryQueue: [] };
    if (preview.length !== 2) resetPreview();
    const [b0, b1] = preview;
    preview = [];
    // One count-in bar, then the bars follow each other with no gaps.
    const beat = 60 / progress().bpm;
    run.countStart = ctx.currentTime + 0.3;
    scheduleBarClicks(ctx, b0.meter, run.countStart, beat, 1, 1);
    schedule(b0, run.countStart + b0.meter.bpb * beat);
    schedule(b1, b0.end);
    placeRows(0);
    setBusy(true);
    $('en-transport').scrollIntoView({ behavior: 'smooth', block: 'start' });
    d.requestWakeLock();
    run.unsub = d.listener.onPitch(onFrame);
  }

  /** Fix a bar's place in time and schedule its clicks. */
  function schedule(bar, startTime) {
    const beat = 60 / progress().bpm;
    bar.beat = beat;
    bar.start = startTime;
    bar.end = startTime + bar.meter.bpb * beat;
    if (state.clickWhilePlaying) scheduleBarClicks(run.ctx, bar.meter, bar.start, beat, 1, 0.7);
    const prev = run.bars.at(-1);
    bar.windowStart = bar.start - 0.5 * beat;
    run.bars.push(bar);
    if (prev) setBoundary(prev, bar);
  }

  /**
   * Which played notes belong to which bar: the line between two bars sits
   * halfway between the last note of one and the first note of the next,
   * so a slightly early or late note still counts for the right bar.
   */
  function setBoundary(prev, next) {
    const lastOnset = soundingNotes(prev.exercise).at(-1)?.beat ?? 0;
    const firstNext = soundingNotes(next.exercise)[0]?.beat ?? next.meter.bpb;
    const a = prev.start + lastOnset * prev.beat;
    const b = next.start + firstNext * next.beat;
    prev.windowEnd = Math.min((a + b) / 2, b - 0.03);
    next.windowStart = prev.windowEnd;
  }

  function onFrame(reading) {
    if (!run) return;
    const { tracker } = run;
    d.setLevel($('en-mic'), reading);
    const midi = reading.freq ? d.pitchToMidi(reading.freq) : null;
    const tonal = midi != null || (reading.clarity >= 0.4 && reading.rms >= reading.gate);
    for (const b of reading.blocks) tracker.push(b.t, b.rms, reading.gate, midi, tonal);
    $('en-heard').textContent = midi != null ? `♪ ${d.writtenInfo(Math.round(midi)).name}` : tonal ? '♪' : '—';
    const now = reading.audioTime;
    const heard = now - (run.ctx.outputLatency || 0);

    // Which bar is being played; scroll the score when it changes.
    let cur = -1;
    for (const b of run.bars) if (heard >= b.start) cur = b.id;
    const first = run.bars[0];
    if (cur === -1) {
      const pos = (heard - first.start) / first.beat;
      const idx = heard < run.countStart ? null : clickIndex(pos, first.meter);
      renderBeats(first.meter, idx, true);
      setStatus(idx === clicksPerBar(first.meter) - 1 ? 'Breathe in… play!' : 'Count-in…');
    } else {
      if (cur !== run.currentId) {
        run.currentId = cur;
        placeRows(cur);
        setStatus('Keep going…');
      }
      const bar = run.bars.find((b) => b.id === cur);
      const pos = (heard - bar.start) / bar.beat;
      renderBeats(bar.meter, clickIndex(pos, bar.meter));
      for (const r of rows) r.sheet.setCursor(state.showPlayhead && r.bar === bar ? Math.min(pos, bar.meter.bpb) : null);
    }

    // Score each bar once its last note has had time to finish, then line
    // up the bar after next (the next one is already on screen).
    for (const bar of run.bars) {
      if (bar.scored) continue;
      if (bar.windowEnd == null || now < Math.max(bar.end, bar.windowEnd) + 0.3 + run.latency) break;
      scoreBar(bar, now);
      if (!run) return;
      const last = run.bars.at(-1);
      const added = nextBar(last);
      schedule(added, last.end);
      addRow(added, last);
    }
    run.bars = run.bars.filter((b) => !b.scored || b.end > heard - 8);
    tracker.notes = tracker.notes.filter((n) => n.end > now - 6);
  }

  function scoreBar(bar, now) {
    bar.scored = true;
    const ex = bar.exercise;
    const endSec = ex.totalBeats * bar.beat;
    const lat = run.latency;
    // Note times are as the mic heard them; remove the delay before comparing.
    const played = run.tracker
      .snapshot(now)
      .filter((n) => n.start - lat >= bar.windowStart && n.start - lat < bar.windowEnd)
      .map((n) => ({ start: n.start - lat - bar.start, end: Math.min(n.end - lat - bar.start, endSec + 0.2), midi: n.midi }));
    const result = scoreRhythm(ex, played, 60 / bar.beat, { checkPitch: checksPitch(state.rhythmNotes) && !d.tapMode() });
    const { statuses, offsets } = resultMarks(ex, result);
    const verdict = barVerdict(ex, result, 0);
    if (bar.row?.el.isConnected) {
      bar.row.sheet.setResults(statuses, offsets);
      bar.row.sheet.setBarLabels([verdict]);
      const score = bar.row.el.querySelector('.row-score');
      score.textContent = String(result.overall);
      score.style.background = d.scoreColor(result.overall);
    }

    // A failed bar comes back as the bar after next.
    if (result.overall < PASS && !ex.retry) run.retryQueue.push({ exercise: ex });
    const event = recordResult(progress(), ex, result, { window: WINDOW });
    d.save();
    session.count++;
    session.total += result.overall;
    showLatest(bar, result, verdict, event);
    renderStage();
    renderIssues();
    if (event?.type === 'unlock') {
      session.unlocked.push(event.step.title);
      showIntro(event.step);
    }
  }

  function endRun() {
    if (!run) return;
    run.unsub?.();
    run = null;
    d.listener.stop(); // also silences any clicks still scheduled
    d.releaseWakeLock();
    setBusy(false);
    for (const r of rows) r.sheet.setCursor(null);
    d.setLevel($('en-mic'), { rms: 0, gate: 0 });
    $('en-heard').textContent = '—';
  }

  function stop(byUser = false) {
    stopDemo();
    const wasRunning = !!run;
    const pendingIntro = run?.pendingIntro;
    endRun();
    if (pendingIntro) $('en-intro').hidden = false;
    if (byUser && wasRunning) {
      setStatus('Stopped. Press Start for a fresh run.');
      if (session?.count) {
        const avg = Math.round(session.total / session.count);
        const unlockedText = session.unlocked.length ? ` · unlocked: ${session.unlocked.join(', ')}` : '';
        $('en-summary').textContent = `This run: ${session.count} bar${session.count === 1 ? '' : 's'} · average score ${avg}${unlockedText}`;
        $('en-summary').hidden = false;
      }
      session = null;
    }
  }

  // ---------------------------------------------------------------- demo

  function hear(exercise) {
    stopDemo();
    $('en-intro-hear').disabled = true;
    setStatus('Listen to how it sounds…');
    demoStop = playDemo(exercise, progress().bpm, state.a4, () => {}, () => {
      demoStop = null;
      $('en-intro-hear').disabled = false;
      setStatus('Press Start when you’re ready.');
    });
  }

  function stopDemo() {
    if (!demoStop) return;
    demoStop();
    demoStop = null;
    $('en-intro-hear').disabled = false;
  }

  return {
    enter() {
      syncInput();
      $('en-playhead').checked = !!state.showPlayhead;
      renderStage();
      renderIssues();
      if (!run) {
        resetPreview();
        setStatus(`Press Start. After one bar of clicks, play each bar as it reaches the highlighted row${d.tapMode() ? ' (hold the button for each note)' : ''}. Tempo ${progress().bpm} bpm.`);
      }
    },
    leave() {
      stop(true);
    },
    recorderChanged() {
      if (!run) resetPreview();
    },
    get busy() {
      return !!run;
    },
    stopIfRunning() {
      stop(true);
    },
  };
}
