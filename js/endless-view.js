// Endless rhythm training: rhythms keep coming with a continuous metronome.
// After each one the player gets a beat to see the score and a bar of clicks
// to read the next. Hard rhythms are repeated with counting shown, new
// patterns unlock as the player improves, and the tempo adapts.

import { CURRICULUM, newProgress, migrateProgress, chooseNext, recordResult, unlockProgress, cellTitle, topIssues } from './progression.js?v=1.7';
import { OnsetTracker, scoreRhythm, generateFromCells, barVerdict, barVerdicts, resultMarks } from './rhythm.js?v=1.7';
import { RhythmSheet } from './notation.js?v=1.7';
import { scheduleClick } from './audio.js?v=1.7';
import { playDemo } from './rhythm-play.js?v=1.7';
import { writtenMidi } from './recorders.js?v=1.7';

const NOTE_SETS = { 1: [11], 3: [7, 9, 11], 5: [7, 9, 11, 12, 14] };

export function initEndlessView(d) {
  const { $, state } = d;
  if (!state.endless) state.endless = newProgress(state.bpm);
  migrateProgress(state.endless);
  const progress = () => state.endless;

  let current = null; // { exercise, kind, hint, focus }
  let last = null; // { exercise, result, statuses, offsets }
  let sheet = null;
  let run = null;
  let demoStop = null;
  let session = null;

  // ---------------------------------------------------------------- options

  $('en-notes').value = String(state.rhythmNotes);
  $('en-notes').addEventListener('change', (e) => {
    state.rhythmNotes = Number(e.target.value);
    d.save();
    if (!run) newRhythm();
  });
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
    sheet?.setCounting(state.alwaysCount || !!current?.hint);
  });
  CURRICULUM.forEach((step, i) => $('en-jump').add(new Option(`${i + 1}. ${step.title}`, String(i))));
  $('en-jump').addEventListener('change', (e) => {
    const p = progress();
    p.stage = Number(e.target.value);
    p.stageStartedAt = p.phrases;
    p.recent = [];
    d.save();
    renderStage();
    if (!run) newRhythm();
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
    last = null;
    renderStage();
    newRhythm();
  });

  $('en-start').addEventListener('click', start);
  $('en-stop').addEventListener('click', () => stop(true));
  $('en-hear').addEventListener('click', () => hear(current.exercise));
  $('en-continue').addEventListener('click', () => {
    $('en-intro').hidden = true;
    start();
  });
  $('en-intro-hear').addEventListener('click', () => {
    // A short example built mostly from the newly unlocked pattern.
    const step = CURRICULUM[progress().stage];
    const cells = { quarter: 0.5 };
    if (step.cell) cells[step.cell] = 3;
    hear(generateFromCells({ cells, beatsPerBar: step.timeSig || 4, pitches: pitches(), bars: 2 }), true);
  });

  window.addEventListener('resize', () => sheet?.render());

  // -------------------------------------------------------------- display

  function pitches() {
    const r = d.recorder();
    return NOTE_SETS[state.rhythmNotes].map((o) => r.lowest + o);
  }

  function renderStage() {
    const p = progress();
    const step = CURRICULUM[p.stage];
    $('en-stage-label').textContent = p.stage === CURRICULUM.length - 1 ? `Stage ${p.stage + 1} of ${CURRICULUM.length} · all rhythms unlocked` : `Stage ${p.stage + 1} of ${CURRICULUM.length}`;
    $('en-stage-name').textContent = step.title;
    $('en-bpm').textContent = String(p.bpm);
    $('en-streak').textContent = p.streak >= 2 ? `🔥 ${p.streak} in a row` : p.bestStreak ? `best streak ${p.bestStreak}` : '';
    const pct = Math.round(unlockProgress(p) * 100);
    $('en-progress-fill').style.width = `${pct}%`;
    $('en-progress-label').textContent = p.stage < CURRICULUM.length - 1
      ? `Next unlock: ${CURRICULUM[p.stage + 1].title}`
      : 'Next: faster tempo';
    $('en-jump').value = String(p.stage);
  }

  function show(next) {
    current = next;
    sheet = new RhythmSheet($('en-sheet'), next.exercise, (m) => writtenMidi(d.recorder(), m));
    sheet.setCounting(state.alwaysCount || next.hint);
    if (next.kind === 'retry' && last) {
      sheet.setResults(last.statuses, last.offsets);
      sheet.setBarLabels(barVerdicts(last.exercise, last.result));
    }
    const label = {
      new: 'Next rhythm',
      retry: next.focus ? `Try that again — watch the ${cellTitle(next.focus)}` : 'Try that again',
      review: 'Review: one you found tricky earlier',
    }[next.kind];
    $('en-meta').textContent = `${label} · ${next.exercise.beatsPerBar}/4`;
    $('en-meta').classList.toggle('retry', next.kind !== 'new');
    renderBeats(null);
  }

  function newRhythm() {
    show(chooseNext(progress(), null, pitches()));
  }

  function renderBeats(currentBeat, counting = false) {
    const bpb = current.exercise.beatsPerBar;
    const el = $('en-beats');
    if (el.childElementCount !== bpb) {
      el.replaceChildren(...Array.from({ length: bpb }, (_, i) => Object.assign(document.createElement('span'), { textContent: String(i + 1) })));
    }
    [...el.children].forEach((c, i) => {
      c.classList.toggle('on', i === currentBeat);
      c.classList.toggle('count', counting && i === currentBeat);
    });
  }

  function setStatus(text) {
    $('en-status').textContent = text;
  }

  function setBusy(busy) {
    $('en-start').hidden = busy;
    $('en-hear').hidden = busy;
    $('en-stop').hidden = !busy;
    $('en-notes').disabled = busy;
    $('en-jump').disabled = busy;
  }

  function showFeedback(result, event, kind, verdicts) {
    const chip = $('en-chip');
    chip.textContent = String(result.overall);
    chip.style.background = d.scoreColor(result.overall);
    const bits = [`${result.grade.label} — ${result.onTime}/${result.total} on time`];
    const m = result.meanErrorMs;
    if (m != null && Math.abs(m) > 40) bits.push(m < 0 ? `rushing ${Math.round(-m)} ms` : `dragging ${Math.round(m)} ms`);
    if (kind === 'retry' && result.overall >= 70) bits.push('nailed it this time!');
    if (event?.type === 'tempo') bits.push(event.faster ? `speeding up to ${event.bpm} bpm` : `slowing to ${event.bpm} bpm`);
    $('en-feedback-text').textContent = bits.join(' · ');
    $('en-bars').replaceChildren(
      ...verdicts.map((v, i) => Object.assign(document.createElement('span'), {
        className: `en-bar ${v.level}`,
        textContent: `Bar ${i + 1}: ${v.text}`,
      })),
    );
    $('en-feedback').hidden = false;
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
    if (!session) session = { count: 0, total: 0, unlocked: [] };
    const ctx = d.listener.ctx;
    const latency = state.latencyMs != null ? state.latencyMs / 1000 : d.listener.estimatedLatency();
    run = { ctx, latency, tracker: new OnsetTracker(), cycle: null, cleared: false };
    setBusy(true);
    d.requestWakeLock();
    scheduleCycle(ctx.currentTime + 0.3);
    run.unsub = d.listener.onPitch(onFrame);
  }

  /** Count-in bar, then the rhythm, starting at `countStart` (audio time). */
  function scheduleCycle(countStart) {
    const ex = current.exercise;
    const beat = 60 / progress().bpm;
    const bpb = ex.beatsPerBar;
    const start = countStart + bpb * beat;
    const end = start + ex.totalBeats * beat;
    for (let i = 0; i < bpb; i++) scheduleClick(run.ctx, countStart + i * beat, i === 0);
    if (state.clickWhilePlaying) {
      for (let b = 0; b < ex.totalBeats; b++) scheduleClick(run.ctx, start + b * beat, b % bpb === 0, 0.7);
    }
    run.cycle = { exercise: ex, kind: current.kind, countStart, start, end, beat, decideAt: end + 0.3 + run.latency };
    run.cleared = false;
  }

  function onFrame(reading) {
    if (!run) return;
    const { cycle, tracker } = run;
    d.setLevel($('en-mic'), reading);
    const midi = reading.freq ? d.pitchToMidi(reading.freq) : null;
    const tonal = midi != null || (reading.clarity >= 0.4 && reading.rms >= reading.gate);
    for (const b of reading.blocks) tracker.push(b.t, b.rms, reading.gate, midi, tonal);
    $('en-heard').textContent = midi != null ? `♪ ${d.writtenInfo(Math.round(midi)).name}` : tonal ? '♪' : '—';
    const now = reading.audioTime;
    const pos = (now - (run.ctx.outputLatency || 0) - cycle.start) / cycle.beat;
    const ex = cycle.exercise;
    const bpb = ex.beatsPerBar;

    if (pos < 0) {
      const beatNo = Math.floor(pos + bpb);
      if (beatNo >= 0) {
        renderBeats(beatNo, true);
        setStatus(beatNo >= bpb - 1 ? 'Breathe in… play!' : `Read ahead… ${beatNo + 1}`);
      } else {
        renderBeats(null);
        setStatus('Get ready…');
      }
      sheet.setCursor(null);
    } else {
      if (!run.cleared) {
        sheet.clearResults();
        run.cleared = true;
        run.labels = Array(ex.bars).fill(null);
      }
      renderBeats(Math.floor(pos) % bpb);
      setStatus(pos < ex.totalBeats ? 'Play!' : 'How did that go…');
      if (state.showPlayhead) sheet.setCursor(Math.min(pos, ex.totalBeats));
      // Judge each bar as soon as it's over, while the player carries on.
      for (let b = 0; b < ex.bars - 1; b++) {
        if (run.labels[b]) continue;
        if (now < cycle.start + (b + 1) * bpb * cycle.beat + 0.25 + run.latency) break;
        const ev = evaluate(now);
        run.labels[b] = barVerdict(ex, ev.result, b);
        sheet.setBarLabels(run.labels);
        // Colour the notes of the bars judged so far.
        const done = ([idx]) => ex.events[idx].bar <= b;
        sheet.setResults(new Map([...ev.statuses].filter(done)), new Map([...ev.offsets].filter(done)));
      }
    }

    if (now >= cycle.decideAt) decide(now);
  }

  /** Score what has been played in the current rhythm so far. */
  function evaluate(now) {
    const { cycle, tracker, latency } = run;
    const ex = cycle.exercise;
    const relS = (t) => t - latency - cycle.start;
    const played = tracker
      .snapshot(now)
      .map((n) => ({ start: relS(n.start), end: Math.min(relS(n.end), ex.totalBeats * cycle.beat + 0.2), midi: n.midi }))
      .filter((n) => n.start >= -0.5 * cycle.beat && n.start < ex.totalBeats * cycle.beat);
    const result = scoreRhythm(ex, played, 60 / cycle.beat, { checkPitch: state.rhythmNotes > 1 });
    return { result, ...resultMarks(ex, result) };
  }

  function decide(now) {
    const { cycle, tracker } = run;
    const ex = cycle.exercise;
    const { result, statuses, offsets } = evaluate(now);
    // Forget old notes so the tracker doesn't grow forever.
    tracker.notes = tracker.notes.filter((n) => n.end > now - 2);

    const event = recordResult(progress(), ex, result);
    d.save();
    session.count++;
    session.total += result.overall;
    last = { exercise: ex, result, statuses, offsets };
    showFeedback(result, event, cycle.kind, barVerdicts(ex, result));
    renderStage();
    renderIssues();

    if (event?.type === 'unlock') {
      session.unlocked.push(event.step.title);
      pause(event.step);
      return;
    }

    show(chooseNext(progress(), last, pitches()));
    // Next count-in starts on the first beat after now, keeping the pulse.
    const k = Math.max(1, Math.ceil((now + 0.05 - cycle.end) / cycle.beat));
    scheduleCycle(cycle.end + k * cycle.beat);
  }

  function pause(step) {
    endRun();
    $('en-intro-title').textContent = step.title;
    $('en-intro-text').textContent = step.text;
    $('en-intro-count').textContent = step.count;
    $('en-intro').hidden = false;
    $('en-start').hidden = true; // Continue on the card starts again
    $('en-hear').hidden = true;
    setStatus('');
    // The next rhythm features the new pattern, with counting shown.
    show(chooseNext(progress(), null, pitches()));
    $('en-intro').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function endRun() {
    if (!run) return;
    run.unsub?.();
    run = null;
    d.listener.stop(); // also silences any clicks still scheduled
    d.releaseWakeLock();
    setBusy(false);
    sheet?.setCursor(null);
    renderBeats(null);
    d.setLevel($('en-mic'), { rms: 0, gate: 0 });
    $('en-heard').textContent = '—';
  }

  function stop(byUser = false) {
    stopDemo();
    const wasRunning = !!run;
    endRun();
    if (byUser && wasRunning) {
      setStatus('Stopped. Press Start to carry on.');
      if (session?.count) {
        const avg = Math.round(session.total / session.count);
        const unlockedText = session.unlocked.length ? ` · unlocked: ${session.unlocked.join(', ')}` : '';
        $('en-summary').textContent = `This session: ${session.count} rhythm${session.count === 1 ? '' : 's'} · average score ${avg}${unlockedText}`;
        $('en-summary').hidden = false;
      }
      session = null;
      // Don't leave a half-finished retry hanging: offer a fresh rhythm next time.
      if (current?.kind === 'retry') newRhythm();
    }
  }

  // ---------------------------------------------------------------- demo

  function hear(exercise, isExample = false) {
    stopDemo();
    const demoSheet = isExample ? null : sheet;
    $('en-hear').disabled = true;
    $('en-intro-hear').disabled = true;
    setStatus(isExample ? 'Listen to how it sounds…' : 'Listen and follow the music…');
    demoStop = playDemo(exercise, progress().bpm, state.a4, (pos) => {
      if (!demoSheet) return;
      if (pos < 0) {
        renderBeats(Math.floor(pos + exercise.beatsPerBar), true);
        demoSheet.setCursor(null);
      } else {
        renderBeats(Math.floor(pos) % exercise.beatsPerBar);
        demoSheet.setCursor(Math.min(pos, exercise.totalBeats));
      }
    }, () => {
      demoStop = null;
      finishDemo();
      setStatus(isExample ? 'Press Continue when you’re ready.' : 'Press Start when you’re ready.');
    });
  }

  function stopDemo() {
    if (!demoStop) return;
    demoStop();
    demoStop = null;
    finishDemo();
  }

  function finishDemo() {
    $('en-hear').disabled = false;
    $('en-intro-hear').disabled = false;
    sheet?.setCursor(null);
    if (current) renderBeats(null);
  }

  return {
    enter() {
      $('en-playhead').checked = !!state.showPlayhead;
      renderStage();
      renderIssues();
      if (!current) newRhythm();
      else sheet.render();
      if (!run) setStatus(`Press Start. You'll hear a bar of clicks, then play what you see. Tempo ${progress().bpm} bpm.`);
    },
    leave() {
      stop(true);
    },
    recorderChanged() {
      if (!run && current) newRhythm();
    },
    get busy() {
      return !!run;
    },
    stopIfRunning() {
      stop(true);
    },
  };
}

