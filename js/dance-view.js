// Dance Improv screen. Flow: a groove plays and, near the end of each move,
// you have four counts to choose the next one (tap, type or say it); you're
// scored on how early you decided and how varied you are. Recall: name as
// many of your moves as you can from memory. Moves: your own library.

import { STYLES, STARTERS, CATEGORIES, pickCue, speedScore, varietyScore, meetsCue, pickPoints, summarise, matchMove, recallResult } from './dance.js?v=3.7';
import { Groove } from './dance-audio.js?v=3.7';

const WINDOW = 4; // counts to choose the next move
const GRACE = 2; // counts after the "1" before you freeze
const INTRO = 8;
const ICONS = { basic: '👣', turn: '🌀', leaderTurn: '↻', position: '↔', travel: '➜', pause: '✋', styling: '✨', combo: '🔗' };

const DEFAULTS = {
  tab: 'flow',
  style: 'forro',
  bpm: { forro: 100, salsa: 180 },
  minutes: 3,
  cues: true,
  shuffle: true,
  hide: false,
  voice: false,
  countdown: true,
  voiceLang: 'en-US',
};

export function initDanceView(d) {
  const { $, state } = d;
  state.dance ||= {};
  const D = state.dance;
  D.settings = { ...DEFAULTS, ...D.settings, bpm: { ...DEFAULTS.bpm, ...D.settings?.bpm } };
  D.libraries ||= {};
  D.usage ||= {};
  D.sessions ||= [];
  D.recalls ||= [];
  const S = () => D.settings;
  const save = () => d.save();
  const style = () => STYLES[S().style];
  const moves = () => (D.libraries[S().style] ||= STARTERS[S().style].map((x) => ({ ...x })));
  const groove = new Groove();
  let active = false;

  // ------------------------------------------------------------- tabs

  const TABS = ['flow', 'recall', 'moves', 'stats'];
  for (const t of TABS) {
    $(`dn-tab-${t}`).addEventListener('click', () => {
      S().tab = t;
      save();
      showTab();
    });
  }
  function showTab() {
    if (S().tab !== 'flow') stopFlow(false);
    if (S().tab !== 'recall') stopRecall(false);
    for (const t of TABS) {
      $(`dn-tab-${t}`).setAttribute('aria-selected', String(S().tab === t));
      $(`dn-${t}`).hidden = S().tab !== t;
    }
    if (S().tab === 'moves') renderMoves();
    if (S().tab === 'stats') renderStats();
    if (S().tab === 'flow') renderFlowIdle();
  }

  // Style and settings
  $('dn-style').innerHTML = Object.values(STYLES).map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
  $('dn-style').addEventListener('change', (e) => {
    stopFlow(false);
    S().style = e.target.value;
    save();
    syncSettings();
    showTab();
  });
  $('dn-bpm').addEventListener('input', (e) => {
    S().bpm[S().style] = Number(e.target.value);
    $('dn-bpm-num').textContent = e.target.value;
    save();
  });
  $('dn-voice-lang').addEventListener('change', (e) => { S().voiceLang = e.target.value; save(); });
  $('dn-minutes').addEventListener('change', (e) => { S().minutes = Number(e.target.value); save(); });
  for (const [id, k] of [['dn-cues', 'cues'], ['dn-shuffle', 'shuffle'], ['dn-hide', 'hide'], ['dn-voice', 'voice'], ['dn-countdown', 'countdown']]) {
    $(id).addEventListener('change', (e) => {
      S()[k] = e.target.checked;
      save();
      if (k === 'hide' || k === 'shuffle') renderTiles();
    });
  }
  const SpeechRec = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  if (!SpeechRec) {
    $('dn-voice').disabled = true;
    $('dn-voice-label').title = 'Speech recognition isn’t available in this browser (try Chrome or Safari).';
    $('dn-voice-note').textContent = '(not available in this browser)';
  }

  function syncSettings() {
    const st = style();
    $('dn-style').value = st.id;
    $('dn-bpm').min = st.minBpm;
    $('dn-bpm').max = st.maxBpm;
    $('dn-bpm').value = S().bpm[st.id];
    $('dn-bpm-num').textContent = S().bpm[st.id];
    $('dn-minutes').value = String(S().minutes);
    $('dn-cues').checked = S().cues;
    $('dn-shuffle').checked = S().shuffle;
    $('dn-hide').checked = S().hide;
    $('dn-voice').checked = S().voice && !!SpeechRec;
    $('dn-countdown').checked = S().countdown;
    $('dn-voice-lang').value = S().voiceLang;
    $('dn-style-note').textContent = st.note;
  }

  // ------------------------------------------------------------- flow

  let flow = null;

  function renderFlowIdle() {
    if (flow) return;
    $('dn-count').textContent = '–';
    $('dn-now').textContent = `${moves().length} moves ready.`;
    $('dn-next').textContent = 'Press Start and dance. Near the end of each move, choose your next one before the 1.';
    $('dn-next').className = 'dn-next';
    $('dn-cue').classList.remove('show');
    $('dn-bar-fill').style.width = '0%';
    $('dn-start').hidden = false;
    $('dn-stop').hidden = true;
    renderTiles();
  }

  function renderTiles() {
    const list = [...moves()];
    if (S().shuffle) list.sort(() => Math.random() - 0.5);
    const box = $('dn-tiles');
    box.hidden = S().hide;
    box.replaceChildren(
      ...list.map((mv) => {
        const b = document.createElement('button');
        b.className = 'dn-tile';
        b.dataset.name = mv.name;
        b.innerHTML = `<span class="dn-ic">${ICONS[mv.category] || '•'}</span><span>${esc(mv.name)}</span>`;
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          choose(mv.name, e);
        });
        return b;
      }),
    );
    $('dn-hidden-note').hidden = !S().hide;
  }

  async function startFlow() {
    if (!moves().length) {
      $('dn-next').textContent = 'Add some moves first (My moves tab).';
      return;
    }
    stopRecall(false);
    const st = style();
    flow = {
      bpm: S().bpm[st.id],
      current: { move: null, start: 0, end: INTRO },
      window: null,
      pending: null,
      picks: [],
      recent: [],
      lastCue: null,
      endBeat: S().minutes > 0 ? Math.round(S().minutes * S().bpm[st.id]) : Infinity,
      ending: false,
    };
    groove.onBeat = onBeat;
    await groove.start(st.id, flow.bpm);
    $('dn-start').hidden = true;
    $('dn-stop').hidden = false;
    $('dn-summary').hidden = true;
    $('dn-score').textContent = '';
    $('dn-now').textContent = 'Get ready…';
    $('dn-next').textContent = 'First move coming up.';
    if (S().voice && SpeechRec) startVoice();
  }

  function stopFlow(showSummary = true) {
    if (!flow) return;
    const f = flow;
    flow = null;
    groove.stop();
    stopVoice();
    if (showSummary && f.picks.length) finishFlow(f);
    renderFlowIdle();
  }

  function onBeat(b) {
    const f = flow;
    if (!f) return;
    $('dn-count').textContent = String((((b % 8) + 8) % 8) + 1);
    $('dn-count').classList.toggle('one', b % 8 === 0);
    const cur = f.current;
    // Progress through the current move.
    if (cur.move) $('dn-bar-fill').style.width = `${Math.min(100, ((b - cur.start + 1) / (cur.end - cur.start)) * 100)}%`;
    if (f.window) {
      const left = f.window.boundary - b;
      if (!f.pending && left > 0) {
        $('dn-next').textContent = `NEXT? ${left}`;
        $('dn-next').className = `dn-next live${left === 1 ? ' last' : ''}`;
      }
    }
    if (b === cur.end) {
      if (f.ending) return stopFlow(true);
      if (f.pending) startMove(f.pending.move, b, f.pending.twist);
      else {
        $('dn-next').textContent = 'Quick!';
        $('dn-next').className = 'dn-next live last';
      }
    } else if (f.window && !f.pending && b >= cur.end + GRACE) {
      // Nothing chosen two counts after the 1: you froze, so back to the basic.
      const basic = moves().find((x) => x.category === 'basic') || moves()[0];
      f.picks.push({ move: basic.name, frozen: true, speed: 0, variety: 0, points: 0, early: -GRACE - 1 });
      toast('Froze! Back to the basic. Keep thinking ahead.', 'bad');
      startMove(basic.name, cur.end, null, true); // counted from the 1, so the phrasing stays square
    }
    // Time to decide: from four counts before the (possibly new) move ends.
    // Short moves (4 counts) open it on their first count.
    const now = f.current;
    if (!now.windowOpened && b >= now.end - WINDOW && !f.ending) {
      now.windowOpened = true;
      openWindow(now.end);
      const left = now.end - b;
      $('dn-next').textContent = `NEXT? ${left}`;
      $('dn-next').className = `dn-next live${left === 1 ? ' last' : ''}`;
    }
  }

  function openWindow(boundary) {
    const f = flow;
    const cue = S().cues && f.picks.length > 0 && Math.random() < 0.45 ? pickCue(moves(), Math.random, f.lastCue) : null;
    f.lastCue = cue;
    f.window = { boundary, cue };
    f.pending = null;
    $('dn-cue').classList.toggle('show', !!cue);
    if (cue) $('dn-cue').textContent = cue.twist ? `${cue.text} (to any move)` : `Cue: ${cue.text}`;
    if (S().shuffle && !S().hide) renderTiles();
    for (const t of $('dn-tiles').children) t.classList.remove('picked');
    $('dn-type').value = '';
    if (S().countdown) for (let k = boundary - WINDOW; k < boundary; k++) groove.tick(k, k === boundary - 1);
  }

  /** You chose a move (tap, typed or spoken). */
  function choose(name, e) {
    const f = flow;
    if (!f) return;
    if (!f.window || f.pending) {
      if (!f.window) toast('Not yet: wait for NEXT?', '');
      return;
    }
    const beat = groove.beatAt(e);
    const early = f.window.boundary - beat;
    if (early > WINDOW + 0.5) return;
    const speed = speedScore(early, WINDOW, GRACE);
    const v = varietyScore(name, f.recent, moves());
    const cueMet = meetsCue(f.window.cue, name, f.recent, moves());
    const points = pickPoints({ speed, variety: v.score, cueMet });
    const pick = { move: name, speed, variety: v.score, points, early, cueMet, reason: v.reason };
    f.picks.push(pick);
    f.pending = { move: name, twist: f.window.cue?.twist ? f.window.cue.text.replace('Twist: ', '') : null };
    use(name, early);
    for (const t of $('dn-tiles').children) t.classList.toggle('picked', t.dataset.name === name);
    const speedText = early >= 0 ? `⚡ ${early.toFixed(1)} counts early` : `🐢 ${(-early).toFixed(1)} late`;
    const varText = v.score >= 1 ? '🎨 new!' : v.score === 0 ? '🔁 same again' : `🎨 ${v.reason}`;
    $('dn-next').textContent = `Next: ${name}`;
    $('dn-next').className = 'dn-next chosen';
    toast(`${speedText} · ${varText}${cueMet ? ' · ✓ cue' : ''} · +${points}`, points >= 80 ? 'good' : points < 40 ? 'bad' : '');
    $('dn-score').textContent = `${Math.round(f.picks.reduce((a, p) => a + p.points, 0))} pts · ${new Set(f.picks.filter((p) => !p.frozen).map((p) => p.move)).size} different moves`;
    // Late picks start straight away (counted from the 1 you missed, to keep the phrasing).
    if (early < 0) startMove(name, f.window.boundary, f.pending.twist);
  }

  function startMove(name, beat, twist = null, frozen = false) {
    const f = flow;
    const mv = moves().find((x) => x.name === name) || { name, counts: 8 };
    f.current = { move: name, start: beat, end: beat + mv.counts };
    f.recent.push(name);
    f.window = null;
    f.pending = null;
    $('dn-cue').classList.remove('show');
    $('dn-now').innerHTML = `${frozen ? '<span class="dn-frozen">❄</span> ' : ''}<b>${esc(name)}</b>${twist ? ` <span class="dn-twist">+ ${esc(twist)}</span>` : ''} <small>${mv.counts} counts</small>`;
    $('dn-next').textContent = 'Dance it… and think about what comes next.';
    $('dn-next').className = 'dn-next';
    $('dn-bar-fill').style.width = '0%';
    if (beat + mv.counts >= f.endBeat) f.ending = true;
  }

  function use(name, early) {
    const u = ((D.usage[S().style] ||= {})[name] ||= { n: 0, early: 0 });
    u.n++;
    u.early += early;
    u.last = new Date().toISOString().slice(0, 10);
    save();
  }

  function finishFlow(f) {
    const sum = summarise(f.picks, moves());
    D.sessions.push({ date: new Date().toISOString(), style: S().style, bpm: f.bpm, grade: sum.grade, points: Math.round(sum.points), distinct: sum.distinct, picks: sum.picks, frozen: sum.frozen });
    if (D.sessions.length > 200) D.sessions.shift();
    save();
    const box = $('dn-summary');
    box.hidden = false;
    const tips = [];
    if (sum.frozen) tips.push(`You froze ${sum.frozen} time${sum.frozen > 1 ? 's' : ''}: start thinking of the next move as soon as one begins.`);
    if (sum.repeats) tips.push(`${sum.repeats} straight repeat${sum.repeats > 1 ? 's' : ''}: try a different kind of move each time (turn, position change, styling…).`);
    if (sum.avgEarly < 1 && !sum.frozen) tips.push('Most choices came at the last moment: aim to know your next move by count 5.');
    box.innerHTML = `<div class="dn-grade g-${sum.grade}">${sum.grade}</div>
      <div><b>${Math.round(sum.points)}</b> points per move · ${sum.distinct} different moves out of ${moves().length} · ${sum.picks} choices</div>
      <div class="dn-sub">Speed ${Math.round(sum.speed * 100)}% · Variety ${Math.round(sum.variety * 100)}% · Longest run without a repeat: ${sum.bestStreak}</div>
      ${tips.map((t) => `<p>💡 ${t}</p>`).join('')}
      ${sum.unused.length ? `<p class="dn-sub">Moves you didn't use: ${sum.unused.map(esc).join(', ')}. Try to fit them in next time.</p>` : '<p>🎉 You used every move in your list!</p>'}`;
  }

  // Typing a move
  $('dn-type').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const mv = matchMove(e.target.value, moves());
    if (mv) choose(mv.name, e);
    else toast(`No move matches "${e.target.value}"`, 'bad');
    e.target.value = '';
    filterTiles('');
  });
  $('dn-type').addEventListener('input', (e) => filterTiles(e.target.value));
  function filterTiles(q) {
    const n = q.trim().toLowerCase();
    for (const t of $('dn-tiles').children) t.hidden = n && !t.dataset.name.toLowerCase().includes(n);
  }

  // Saying a move
  let rec = null;
  function startVoice() {
    stopVoice();
    rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = S().voiceLang;
    rec.onresult = (ev) => {
      const res = ev.results[ev.results.length - 1];
      const heard = res[0].transcript;
      $('dn-heard').textContent = `🎙 “${heard.trim()}”`;
      const mv = matchMove(heard, moves()) || matchMove(heard.split(/\s+/).slice(-3).join(' '), moves());
      if (mv && flow?.window && !flow.pending) choose(mv.name, { timeStamp: performance.now() });
    };
    rec.onend = () => {
      if (flow && S().voice && rec) {
        try {
          rec.start();
        } catch {
          // already restarting
        }
      }
    };
    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed') $('dn-heard').textContent = '🎙 Microphone blocked: allow it to say your moves.';
    };
    try {
      rec.start();
      $('dn-heard').textContent = '🎙 Listening: say your next move.';
    } catch {
      $('dn-heard').textContent = '';
    }
  }
  function stopVoice() {
    if (!rec) return;
    const r = rec;
    rec = null;
    try {
      r.stop();
    } catch {
      // not running
    }
    $('dn-heard').textContent = '';
  }

  let toastTimer = null;
  function toast(text, kind) {
    const el = $('dn-toast');
    el.textContent = text;
    el.className = `dn-toast ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.textContent = ''), 2500);
  }

  $('dn-start').addEventListener('click', startFlow);
  $('dn-stop').addEventListener('click', () => stopFlow(true));

  // ------------------------------------------------------------ recall

  let recall = null;
  function startRecall() {
    stopFlow(false);
    recall = { typed: [], end: Date.now() + Number($('dn-recall-secs').value) * 1000 };
    $('dn-recall-input').disabled = false;
    $('dn-recall-input').value = '';
    $('dn-recall-input').focus();
    $('dn-recall-start').hidden = true;
    $('dn-recall-result').hidden = true;
    $('dn-recall-chips').replaceChildren();
    tickRecall();
  }
  function tickRecall() {
    if (!recall) return;
    const left = Math.max(0, Math.ceil((recall.end - Date.now()) / 1000));
    $('dn-recall-timer').textContent = `${left}s`;
    if (left <= 0) return stopRecall(true);
    recall.timer = setTimeout(tickRecall, 200);
  }
  $('dn-recall-input').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !recall) return;
    e.preventDefault();
    const text = e.target.value.trim();
    e.target.value = '';
    if (!text) return;
    recall.typed.push(text);
    const mv = matchMove(text, moves());
    const chip = document.createElement('span');
    const dup = mv && recall.typed.slice(0, -1).some((t) => matchMove(t, moves())?.name === mv.name);
    chip.className = `dn-chip${mv ? (dup ? ' dup' : ' ok') : ' new'}`;
    chip.textContent = mv ? (dup ? `${mv.name} (again)` : mv.name) : `${text}?`;
    $('dn-recall-chips').append(chip);
  });
  function stopRecall(show) {
    if (!recall) return;
    clearTimeout(recall.timer);
    const r = recall;
    recall = null;
    $('dn-recall-input').disabled = true;
    $('dn-recall-start').hidden = false;
    $('dn-recall-timer').textContent = '';
    if (!show) return;
    const res = recallResult(r.typed, moves());
    D.recalls.push({ date: new Date().toISOString(), style: S().style, remembered: res.remembered.length, total: moves().length });
    save();
    const box = $('dn-recall-result');
    box.hidden = false;
    box.innerHTML = `<p><b>You remembered ${res.remembered.length} of ${moves().length} moves.</b></p>
      ${res.forgotten.length ? `<p>Forgotten: ${res.forgotten.map(esc).join(', ')}. Say them out loud a couple of times, then try Flow and use them.</p>` : '<p>🎉 Every single one!</p>'}
      ${res.unknown.length ? `<p>Not in your list: ${res.unknown.map((u) => `<button class="btn small secondary dn-add-unknown" data-name="${esc(u)}">+ ${esc(u)}</button>`).join(' ')}</p>` : ''}`;
    for (const b of box.querySelectorAll('.dn-add-unknown')) {
      b.addEventListener('click', () => {
        moves().push({ name: b.dataset.name, category: 'combo', counts: 8, alias: '' });
        save();
        b.disabled = true;
        b.textContent = `✓ ${b.dataset.name} added`;
      });
    }
  }
  $('dn-recall-start').addEventListener('click', startRecall);

  // ------------------------------------------------------------- moves

  function renderMoves() {
    const list = $('dn-move-list');
    list.replaceChildren(
      ...moves().map((mv, i) => {
        const row = document.createElement('div');
        row.className = 'dn-move';
        row.innerHTML = `<input class="dn-move-name" aria-label="Move name">
          <select aria-label="Kind of move">${Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${ICONS[k]} ${v}</option>`).join('')}</select>
          <select aria-label="Length">${[4, 8, 16].map((c) => `<option value="${c}">${c} counts</option>`).join('')}</select>
          <button class="btn small secondary" aria-label="Remove">✕</button>`;
        const [name, cat, counts] = [row.querySelector('input'), ...row.querySelectorAll('select')];
        name.value = mv.name;
        cat.value = mv.category;
        counts.value = String(mv.counts);
        name.addEventListener('change', () => {
          const v = name.value.trim();
          if (v) mv.name = v;
          save();
        });
        cat.addEventListener('change', () => { mv.category = cat.value; save(); });
        counts.addEventListener('change', () => { mv.counts = Number(counts.value); save(); });
        row.querySelector('button').addEventListener('click', () => {
          moves().splice(i, 1);
          save();
          renderMoves();
        });
        return row;
      }),
    );
    $('dn-moves-title').textContent = `${style().name} moves (${moves().length})`;
  }
  $('dn-add').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('dn-add-name').value.trim();
    if (!name) return;
    moves().push({ name, category: $('dn-add-cat').value, counts: Number($('dn-add-counts').value), alias: '' });
    $('dn-add-name').value = '';
    save();
    renderMoves();
  });
  $('dn-add-cat').innerHTML = Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${ICONS[k]} ${v}</option>`).join('');
  $('dn-reset').addEventListener('click', () => {
    if (!confirm(`Replace your ${style().name} moves with the starter list?`)) return;
    D.libraries[S().style] = STARTERS[S().style].map((x) => ({ ...x }));
    save();
    renderMoves();
  });

  // ------------------------------------------------------------- stats

  function renderStats() {
    const sessions = D.sessions.filter((s) => s.style === S().style).slice(-10).reverse();
    $('dn-sessions').innerHTML = sessions.length
      ? `<thead><tr><th>When</th><th>Grade</th><th>Pts/move</th><th>Different</th><th>Froze</th><th>BPM</th></tr></thead><tbody>${sessions
        .map((s) => `<tr><td>${new Date(s.date).toLocaleDateString()}</td><td>${s.grade}</td><td>${s.points}</td><td>${s.distinct}/${s.picks}</td><td>${s.frozen}</td><td>${s.bpm}</td></tr>`).join('')}</tbody>`
      : '<tbody><tr><td>No Flow sessions yet.</td></tr></tbody>';
    const usage = D.usage[S().style] || {};
    const rows = moves().map((mv) => ({ mv, u: usage[mv.name] })).sort((a, b) => (b.u?.n || 0) - (a.u?.n || 0));
    $('dn-usage').innerHTML = `<thead><tr><th>Move</th><th>Used</th><th>Decided</th></tr></thead><tbody>${rows
      .map(({ mv, u }) => `<tr class="${u?.n ? '' : 'dn-never'}"><td>${ICONS[mv.category] || ''} ${esc(mv.name)}</td><td>${u?.n || 'never'}</td><td>${u?.n ? `${(u.early / u.n).toFixed(1)} counts early` : '–'}</td></tr>`).join('')}</tbody>`;
    const never = rows.filter((r) => !r.u?.n).map((r) => r.mv.name);
    $('dn-never').textContent = never.length ? `Never used yet: ${never.join(', ')}.` : 'You’ve used every move in your list.';
    const rc = D.recalls.filter((r) => r.style === S().style).slice(-5).reverse();
    $('dn-recall-history').textContent = rc.length ? `Recent recall sprints: ${rc.map((r) => `${r.remembered}/${r.total}`).join(', ')}` : '';
  }

  // ------------------------------------------------------------ start-up

  syncSettings();
  renderTiles();

  return {
    enter() {
      active = true;
      syncSettings();
      showTab();
    },
    leave() {
      active = false;
      stopFlow(false);
      stopRecall(false);
    },
    get busy() {
      return !!flow;
    },
    stopIfRunning() {
      stopFlow(true);
    },
  };
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
