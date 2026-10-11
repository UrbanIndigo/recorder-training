// Endless rhythm training: rhythms keep coming with a continuous metronome.
// After each one the player gets a beat to see the score and a bar of clicks
// to read the next. Hard rhythms are repeated with counting shown, new
// patterns unlock as the player improves, and the tempo adapts.

import { CURRICULUM, newProgress, migrateProgress, chooseNext, recordResult, unlockProgress, cellTitle, topIssues } from './progression.js?v=1.8';
import { OnsetTracker, scoreRhythm, generateFromCells, barVerdict, barVerdicts, resultMarks, playedBeats, meterOf, cellFitsMeter } from './rhythm.js?v=1.8';
import { RhythmSheet } from './notation.js?v=1.8';
import { playDemo, scheduleBarClicks, clicksPerBar, clickIndex } from './rhythm-play.js?v=1.8';
import { writtenMidi } from './recorders.js?v=1.8';

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
  $('en-read').value = String(state.readBars || 1);
  $('en-read').addEventListener('change', (e) => {
    state.readBars = Number(e.target.value);
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
    if (!run) start();
  });
  $('en-intro-hear').addEventListener('click', () => {
    // A short example built mostly from the newly unlocked pattern.
    const step = CURRICULUM[progress().stage];
    const newCells = step.cell ? [step.cell] : step.cells || [];
    const meter = step.timeSig || (newCells.some((c) => cellFitsMeter(c, '6/8')) ? '6/8' : '4/4');
    const cells = meter === '6/8' ? { c_dottedQuarter: 0.5 } : { quarter: 0.5 };
    for (const c of newCells) cells[c] = 3;
    hear(generateFromCells({ cells, meter, pitches: pitches(), bars: 2 }), true);
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
      sheet.setPlayed(last.played);
    }
    const label = {
      new: 'Next rhythm',
      retry: next.focus ? `Try that again — watch the ${cellTitle(next.focus)}` : 'Try that again',
      review: 'Review: one you found tricky earlier',
    }[next.kind];
    $('en-meta').textContent = `${label} · ${meterOf(next.exercise).id}`;
    $('en-meta').classList.toggle('retry', next.kind !== 'new');
    if (!run) renderBeats(meterOf(next.exercise), null);
  }

  function newRhythm() {
    show(chooseNext(progress(), null, pitches()));
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
  //
  // The metronome never stops or skips: each rhythm is followed straight
  // away by the count-in bar(s) of the next one, starting exactly on the
  // next downbeat. To manage that, the next rhythm is picked a moment
  // before the current one ends (from a provisional score), and the final
  // score is worked out once the last note has had time to finish.

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
    run = { ctx, latency, tracker: new OnsetTracker(), cycle: null, next: null };
    run.cycle = makeCycle(current, ctx.currentTime + 0.3, readBars());
    setBusy(true);
    $('en-intro-hear').hidden = true;
    $('en-continue').textContent = 'Got it';
    d.requestWakeLock();
    run.unsub = d.listener.onPitch(onFrame);
  }

  const readBars = () => state.readBars || 1;

  /** Schedule count-in bar(s) and the rhythm, starting at `countStart` (audio time). */
  function makeCycle(choice, countStart, countBars, { countScheduled = false, beat = 60 / progress().bpm } = {}) {
    const ex = choice.exercise;
    const m = meterOf(ex);
    const start = countStart + countBars * m.bpb * beat;
    const end = start + ex.totalBeats * beat;
    if (!countScheduled) scheduleBarClicks(run.ctx, m, countStart, beat, countBars, 1);
    const playClicks = state.clickWhilePlaying ? scheduleBarClicks(run.ctx, m, start, beat, ex.bars, 0.7) : [];
    return {
      choice,
      exercise: ex,
      meter: m,
      beat,
      countStart,
      countBars,
      start,
      end,
      playClicks,
      labels: Array(ex.bars).fill(null),
      cleared: false,
      queueAt: end - 0.25, // pick the next rhythm just before this one ends
      decideAt: end + 0.3 + run.latency, // final score once the last note is done
    };
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
    const cycle = run.cycle;

    // The beat display follows the next rhythm once its count-in has begun.
    const shown = run.next && heard >= (run.next.leadIn?.start ?? run.next.countStart) ? run.next : cycle;
    const m = shown.meter;
    const pos = (heard - shown.start) / shown.beat;
    const lead = shown.leadIn;
    if (pos < 0 && lead && heard < shown.countStart && heard >= lead.start) {
      // A count-in bar already under way when this rhythm was swapped in.
      renderBeats(lead.meter, clickIndex((heard - lead.start) / shown.beat, lead.meter), true);
      setStatus('Read ahead…');
      if (shown === cycle) sheet.setCursor(null);
    } else if (pos < 0) {
      const barsLeft = Math.ceil(-pos / m.bpb - 1e-9);
      const idx = heard < shown.countStart ? -1 : clickIndex(pos, m);
      renderBeats(m, idx, true);
      const last = barsLeft === 1 && idx === clicksPerBar(m) - 1;
      setStatus(heard < shown.countStart ? 'Get ready…' : last ? 'Breathe in… play!' : barsLeft > 1 ? 'Read ahead…' : `Read ahead… ${idx + 1}`);
      if (shown === cycle) sheet.setCursor(null);
    } else {
      renderBeats(m, clickIndex(pos, m));
      if (shown === cycle) {
        if (!cycle.cleared) {
          sheet.clearResults();
          cycle.cleared = true;
        }
        setStatus(pos < cycle.exercise.totalBeats ? 'Play!' : 'How did that go…');
        if (state.showPlayhead) sheet.setCursor(Math.min(pos, cycle.exercise.totalBeats));
      }
    }

    // Judge each bar as soon as it's over, while the player carries on.
    const ex = cycle.exercise;
    for (let b = 0; b < ex.bars - 1; b++) {
      if (cycle.labels[b]) continue;
      if (now < cycle.start + (b + 1) * cycle.meter.bpb * cycle.beat + 0.25 + run.latency) break;
      const ev = evaluate(cycle, now);
      cycle.labels[b] = barVerdict(ex, ev.result, b);
      sheet.setBarLabels(cycle.labels);
      const done = ([idx]) => ex.events[idx].bar <= b;
      sheet.setResults(new Map([...ev.statuses].filter(done)), new Map([...ev.offsets].filter(done)));
      const strip = ev.played;
      strip.upToBar = b;
      sheet.setPlayed(strip);
    }

    if (!run.next && now >= cycle.queueAt) queueNext(now);
    if (now >= cycle.decideAt) decide(now);
  }

  /**
   * Score what has been played in a rhythm so far. A provisional score
   * treats a note that's still sounding as lasting to the end.
   */
  function evaluate(cycle, now, provisional = false) {
    const { tracker, latency } = run;
    const ex = cycle.exercise;
    const endSec = ex.totalBeats * cycle.beat;
    const relS = (t) => t - latency - cycle.start;
    const played = tracker
      .snapshot(now)
      .map((n) => ({ start: relS(n.start), end: provisional && n.open ? endSec : Math.min(relS(n.end), endSec + 0.2), midi: n.midi }))
      .filter((n) => n.start >= -0.5 * cycle.beat && n.start < endSec);
    const result = scoreRhythm(ex, played, 60 / cycle.beat, { checkPitch: state.rhythmNotes > 1 });
    return { result, ...resultMarks(ex, result), played: playedBeats(result, played, cycle.beat) };
  }

  /** Pick the next rhythm and schedule it to start right on the next downbeat. */
  function queueNext(now) {
    const cycle = run.cycle;
    const provisional = evaluate(cycle, now, true).result;
    const choice = chooseNext(progress(), { exercise: cycle.exercise, result: provisional }, pitches());
    run.next = makeCycle(choice, cycle.end, readBars());
  }

  function decide(now) {
    const { cycle, tracker } = run;
    const ex = cycle.exercise;
    const { result, statuses, offsets, played } = evaluate(cycle, now);
    tracker.notes = tracker.notes.filter((n) => n.end > now - 2); // keep the tracker small

    const event = recordResult(progress(), ex, result);
    d.save();
    session.count++;
    session.total += result.overall;
    last = { exercise: ex, result, statuses, offsets, played };
    showFeedback(result, event, cycle.choice.kind, barVerdicts(ex, result));
    renderStage();
    renderIssues();
    if (cycle.choice.introduced) $('en-intro').hidden = true;

    let next = run.next || makeCycle(chooseNext(progress(), last, pitches()), cycle.end, readBars());
    if (event?.type === 'unlock') {
      session.unlocked.push(event.step.title);
      next = introduce(next, event.step);
    } else {
      // The next rhythm was picked from a provisional score. If the final
      // score disagrees about repeating this one, swap it.
      const failed = result.overall < 70 && !ex.retry;
      const isRetry = next.choice.kind === 'retry';
      if (failed !== isRetry) next = swapQueued(next, chooseNext(progress(), last, pitches()));
    }
    run.cycle = next;
    run.next = null;
    show(next.choice);
  }

  /**
   * Replace a queued rhythm that hasn't started yet. Its count-in keeps
   * going; if the time signature changes, one bar of count-in in the new
   * time signature follows, so the beat carries straight on.
   */
  function swapQueued(queued, choice) {
    for (const src of queued.playClicks) src.stop();
    // A review taken off the list for the discarded rhythm goes back on it.
    if (queued.choice.kind === 'review') progress().review.unshift({ exercise: queued.choice.exercise, due: progress().phrases });
    const sameMeter = meterOf(choice.exercise).id === queued.meter.id;
    const cycle = sameMeter
      ? makeCycle(choice, queued.countStart, queued.countBars, { countScheduled: true, beat: queued.beat })
      : makeCycle(choice, queued.start, 1, { beat: queued.beat });
    if (!sameMeter) cycle.leadIn = { start: queued.countStart, meter: queued.meter };
    return cycle;
  }

  /**
   * A new pattern was just unlocked. Swap the queued rhythm for one that
   * features it, adding a bar of count-in so there's time to read it; the
   * count-in already under way carries on, so the beat never breaks.
   */
  function introduce(queued, step) {
    for (const src of queued.playClicks) src.stop();
    const choice = chooseNext(progress(), null, pitches());
    choice.introduced = true;
    $('en-intro-title').textContent = step.title;
    $('en-intro-text').textContent = step.text;
    $('en-intro-count').textContent = step.count;
    $('en-intro').hidden = false;
    const cycle = makeCycle(choice, queued.start, 1, { beat: queued.beat });
    cycle.leadIn = { start: queued.countStart, meter: queued.meter };
    return cycle;
  }

  function endRun() {
    if (!run) return;
    run.unsub?.();
    run = null;
    d.listener.stop(); // also silences any clicks still scheduled
    d.releaseWakeLock();
    setBusy(false);
    $('en-intro-hear').hidden = false;
    $('en-continue').textContent = 'Continue';
    sheet?.setCursor(null);
    renderBeats(meterOf(current.exercise), null);
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
      const m = meterOf(exercise);
      if (pos < 0) {
        renderBeats(m, pos < -m.bpb ? -1 : clickIndex(pos, m), true);
        demoSheet.setCursor(null);
      } else {
        renderBeats(m, clickIndex(pos, m));
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
    if (current) renderBeats(meterOf(current.exercise), null);
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

