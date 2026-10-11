import test from 'node:test';
import assert from 'node:assert/strict';
import { newProgress, chooseNext, recordResult, CURRICULUM, unlocked, unlockProgress, cellScores } from '../js/progression.js';
import { scoreRhythm, soundingNotes } from '../js/rhythm.js';

function seeded(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

/** Play an exercise perfectly, or with every note `late` seconds late. */
function play(exercise, bpm, late = 0) {
  const beat = 60 / bpm;
  const played = soundingNotes(exercise)
    .map((e) => ({ start: e.beat * beat + late, end: (e.beat + e.beats) * beat - 0.04 + late, midi: e.midi }));
  return scoreRhythm(exercise, played, bpm);
}

test('a perfect player unlocks every pattern, then the tempo rises', () => {
  const p = newProgress(70);
  const rand = seeded(1);
  const unlocks = [];
  let last = null;
  let tempoUps = 0;
  for (let i = 0; i < 700; i++) {
    const next = chooseNext(p, last, [83], rand);
    assert.equal(next.kind, 'new');
    const { cells, timeSigs } = unlocked(p);
    for (const e of next.exercise.events) assert.ok(cells.includes(e.cell), `${e.cell} not unlocked`);
    assert.ok(timeSigs.includes(next.exercise.meter));
    const result = play(next.exercise, p.bpm);
    const ev = recordResult(p, next.exercise, result);
    if (ev?.type === 'unlock') unlocks.push(ev.step.title);
    if (ev?.type === 'tempo') {
      assert.ok(ev.faster);
      tempoUps++;
    }
    last = { exercise: next.exercise, result };
  }
  assert.equal(unlocks.length, CURRICULUM.length - 1);
  assert.equal(p.stage, CURRICULUM.length - 1);
  assert.ok(tempoUps > 0 && p.bpm > 70);
});

test('a failed rhythm is retried with hints, then reviewed later', () => {
  const p = newProgress(70);
  const rand = seeded(2);
  const first = chooseNext(p, null, [83], rand);
  const bad = play(first.exercise, 70, 0.25);
  assert.ok(bad.overall < 70);
  recordResult(p, first.exercise, bad);

  const retry = chooseNext(p, { exercise: first.exercise, result: bad }, [83], rand);
  assert.equal(retry.kind, 'retry');
  assert.equal(retry.hint, true);
  assert.deepEqual(retry.exercise.events, first.exercise.events);

  const bad2 = play(retry.exercise, 70, 0.25);
  recordResult(p, retry.exercise, bad2);
  assert.equal(p.review.length, 1);

  // No endless retry loop: the next one is new...
  const after = chooseNext(p, { exercise: retry.exercise, result: bad2 }, [83], rand);
  assert.equal(after.kind, 'new');
  // ...and the review comes back once it is due.
  let kind;
  for (let i = 0; i < 4 && kind !== 'review'; i++) {
    const n = chooseNext(p, null, [83], rand);
    kind = n.kind;
    recordResult(p, n.exercise, play(n.exercise, 70));
  }
  assert.equal(kind, 'review');
  assert.equal(p.review.length, 0);
});

test('struggling slows the tempo down', () => {
  const p = newProgress(80);
  const rand = seeded(3);
  let slowed = null;
  for (let i = 0; i < 6 && !slowed; i++) {
    const n = chooseNext(p, null, [83], rand);
    const ev = recordResult(p, n.exercise, scoreRhythm(n.exercise, [], 80));
    if (ev?.type === 'tempo') slowed = ev;
  }
  assert.ok(slowed && !slowed.faster);
  assert.equal(p.bpm, 75);
});

test('pattern scores and unlock progress', () => {
  const p = newProgress(70);
  const n = chooseNext(p, null, [83], seeded(4));
  const r = play(n.exercise, 70);
  for (const [cell, s] of cellScores(n.exercise, r)) {
    assert.equal(cell, 'quarter');
    assert.ok(s > 0.95);
  }
  assert.equal(unlockProgress(p), 0);
  for (let i = 0; i < 2; i++) recordResult(p, n.exercise, r);
  assert.ok(unlockProgress(p) > 0.5);
});

test('recurring problems are spotted per rhythm pattern', async () => {
  const { topIssues } = await import('../js/progression.js');
  const p = newProgress(70);
  p.stage = CURRICULUM.findIndex((st) => st.cell === 'eighths'); // eighth notes unlocked
  const rand = seeded(11);
  for (let i = 0; i < 8; i++) {
    const n = chooseNext(p, null, [83], rand);
    // Rush only the eighth notes by 90 ms.
    const beat = 60 / 70;
    const played = soundingNotes(n.exercise).map((e) => {
      const off = e.event.cell === 'eighths' ? -0.09 : 0;
      return { start: e.beat * beat + off, end: (e.beat + e.beats) * beat - 0.04 + off, midi: e.midi };
    });
    recordResult(p, n.exercise, scoreRhythm(n.exercise, played, 70));
  }
  const issues = topIssues(p);
  assert.ok(issues.length >= 1);
  assert.equal(issues[0].cell, 'eighths');
  assert.equal(issues[0].kind, 'rush');
  assert.match(issues[0].text, /Rushing eighth notes/);
});

test('saved progress from before whole-bar rests moves up a stage', async () => {
  const { migrateProgress } = await import('../js/progression.js');
  const old = { ...newProgress(70), stage: 7 };
  delete old.version;
  migrateProgress(old);
  assert.equal(CURRICULUM[old.stage].cell, 'eighths'); // was stage 8 "Eighth notes"
  const fresh = newProgress(70);
  migrateProgress(fresh);
  assert.equal(fresh.stage, 0);
});

test('a newly unlocked pattern appears in its first rhythms', () => {
  for (let stage = 1; stage < CURRICULUM.length; stage++) {
    const step = CURRICULUM[stage];
    if (!step.cell) continue;
    const p = { ...newProgress(70), stage, stageStartedAt: 0 };
    const rand = seeded(stage);
    for (let k = 0; k < 3; k++) {
      const n = chooseNext(p, null, [83], rand);
      assert.ok(n.exercise.events.some((e) => e.cell === step.cell), `${step.title} missing`);
    }
  }
});
