// Settings and practice history, saved in the browser.

const KEY = 'recorder-trainer:v1';

const DEFAULTS = {
  recorder: 'soprano',
  a4: 440,
  sensitivity: 0.5, // 0 = only loud sounds, 1 = picks up quiet sounds
  duration: 10,
  naturalsOnly: true,
  rhythmLevel: 1,
  rhythmNotes: 1,
  bpm: 70,
  clickWhilePlaying: true,
  latencyMs: null, // measured device delay for rhythm timing; null = automatic estimate
  rhythmBest: {}, // { [level]: best score }
  rhythmTab: 'endless',
  alwaysCount: false,
  rhythmInput: 'mic', // 'mic' or 'tap' (hold a button for each note)
  showPlayhead: false, // moving line and live note bars while playing rhythms
  endless: null, // endless-mode progress (see progression.js)
  dance: null, // dance-improv moves, settings and stats (see dance-view.js)
  ear: null, // ear-training settings and progress (see ear-view.js)
  game: null, // Beat Ward progress (see game/game.js)
  chords: null, // piano chord settings and stats (see chords-view.js)
  history: {}, // { [recorderId]: { [midi]: { best, attempts: [{ score, meanCents, date }] } } }
};

export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return { ...DEFAULTS, ...saved, history: saved?.history || {}, rhythmBest: saved?.rhythmBest || {} };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode etc.) — the app still works, just without memory.
  }
}

export function recordAttempt(state, recorderId, midi, result) {
  const byRecorder = (state.history[recorderId] ||= {});
  const entry = (byRecorder[midi] ||= { best: 0, attempts: [] });
  entry.best = Math.max(entry.best, result.overall);
  entry.attempts.push({
    score: result.overall,
    meanCents: result.meanCents == null ? null : Math.round(result.meanCents),
    duration: result.duration,
    date: new Date().toISOString(),
  });
  if (entry.attempts.length > 30) entry.attempts.shift();
  return entry;
}

export function noteHistory(state, recorderId, midi) {
  return state.history[recorderId]?.[midi] || null;
}
