// The Ear Training screen: name notes by scale degree (Degrees), sing or
// play a degree then check (Sing), write down short melodies (Melody),
// anchor songs with every syllable's degree (Songs), and progress.

import {
  ORDER, LEVELS, levelSet, degreeLabel, degreeLongName, KEYS, keyByName, tonicFor, degreeMidi, pickKey,
  newProgress, recordAnswer, degreeStats, weakest, pickDegree, streak, makeMelody, melodyLength, compareMelody,
  SONGS, INTERVAL_SONGS, fingeringFor, hintFor, judgeSung, steadyPitch,
} from './ear.js?v=3.7';
import { freqToMidi } from './music.js?v=3.7';
import { EarAudio } from './ear-audio.js?v=3.7';
import { noteInfo } from './music.js?v=3.7';
import { writtenMidi } from './recorders.js?v=3.7';

const DEFAULT_SETTINGS = {
  tab: 'recognise',
  key: 'C', // a key name, 'random-recorder' or 'random-all'
  labels: 'solfege',
  timbre: 'recorder',
  range: 'recorder', // 'recorder' (the chosen recorder's range) or 'middle'
  home: 'cadence', // 'cadence' or 'scale'
  tonicFirst: false, // play the tonic before each note (easier)
  fingering: true,
};

export function initEarView(d) {
  const { $, state } = d;
  state.ear ||= {};
  state.ear.settings = { ...DEFAULT_SETTINGS, ...state.ear.settings };
  state.ear.progress ||= newProgress();
  const S = () => state.ear.settings;
  const P = () => state.ear.progress;
  const save = () => d.save();
  const audio = new EarAudio();
  let active = false;

  // ----------------------------------------------------------- helpers

  const label = (deg) => degreeLabel(deg, S().labels);
  const longName = (deg) => degreeLongName(deg, S().labels);
  const range = () => (S().range === 'recorder' ? { low: d.recorder().lowest, high: d.recorder().highest } : { low: 55, high: 84 });
  const setNow = () => levelSet(P().level);
  const sortSet = (set) => ORDER.filter((x) => set.includes(x));

  function fingeringHtml(midi) {
    if (!S().fingering) return '';
    const rec = d.recorder();
    // Out of the recorder's range (middle range setting): show it where the recorder can play it.
    let m = midi;
    let note = '';
    while (m < rec.lowest) { m += 12; note = ' (an octave up)'; }
    while (m > rec.highest) { m -= 12; note = ' (an octave down)'; }
    const f = fingeringFor(rec, m);
    const name = noteInfo(writtenMidi(rec, m)).label; // written pitch, as in recorder music
    if (!f) return `<div class="ear-fing"><div class="ear-fing-name">${name}${note}</div><small>Beyond the fingering chart: see a full chart for this note.</small></div>`;
    return `<div class="ear-fing">${fingeringSvg(f)}<div><div class="ear-fing-name">${name}${note}</div><small>${rec.shortName} recorder, baroque fingering. ● covered, ◐ half.</small></div></div>`;
  }

  /**
   * A hint for finding a degree: a song you know (or a short path), with
   * every syllable's degree and the target marked, and a button to hear it
   * in the current key.
   */
  function showHint(box, deg, tonic) {
    const h = hintFor(deg, S().labels);
    box.hidden = false;
    box.innerHTML = `<div class="ear-hint-text">💡 ${h.text}</div>
      <div class="ear-hint-notes">${h.notes.map(([syl, g], i) => `<span class="ear-syl${i === h.target ? ' target' : ''}"><i>${syl}</i><b>${label(g)}</b></span>`).join('')}</div>
      <button class="btn small secondary">▶ Hear it</button>`;
    const cells = box.querySelectorAll('.ear-syl');
    box.querySelector('button').addEventListener('click', async () => {
      audio.stop();
      audio.clearTimers();
      const notes = h.notes.map(([, g, beats], i) => [g, i === h.target ? Math.max(2, beats) : beats]);
      audio.melody(tonic, notes, await audio.ready(), 0.4, (i) => {
        cells.forEach((c) => c.classList.remove('now'));
        cells[i]?.classList.add('now');
      });
    });
  }

  /** Hear the key: cadence or drone + scale. Returns when it's over. */
  async function playHome(tonic) {
    const t0 = await audio.ready();
    return audio.home(tonic, t0, S().home);
  }

  function msUntil(t) {
    return Math.max(0, (t - audio.ctx.currentTime) * 1000);
  }

  // ------------------------------------------------------------ setup

  const tabs = ['recognise', 'sing', 'melody', 'songs', 'progress'];
  for (const t of tabs) {
    $(`ear-tab-${t}`).addEventListener('click', () => {
      S().tab = t;
      save();
      showTab();
    });
  }
  function showTab() {
    stopMic();
    audio.stop();
    audio.clearTimers();
    for (const t of tabs) {
      $(`ear-tab-${t}`).setAttribute('aria-selected', String(S().tab === t));
      $(`ear-${t}`).hidden = S().tab !== t;
    }
    $('ear-settings').hidden = S().tab === 'progress';
    if (S().tab === 'songs') renderSongs();
    if (S().tab === 'progress') renderProgress();
  }

  // Settings
  const keySel = $('ear-key-select');
  keySel.innerHTML =
    KEYS.map((k) => `<option value="${k.name}">${k.name} major</option>`).join('') +
    '<option value="random-recorder">Random: recorder keys (C F G D B♭)</option><option value="random-all">Random: any key</option>';
  $('ear-level').innerHTML = LEVELS.map((l) => `<option value="${l.id}">Level ${l.id}</option>`).join('');
  const fields = {
    'ear-key-select': 'key', 'ear-labels': 'labels', 'ear-timbre': 'timbre', 'ear-range': 'range', 'ear-home-style': 'home',
  };
  for (const [id, k] of Object.entries(fields)) {
    $(id).addEventListener('change', (e) => {
      S()[k] = e.target.value;
      save();
      settingsChanged();
    });
  }
  $('ear-tonic-first').addEventListener('change', (e) => { S().tonicFirst = e.target.checked; save(); });
  $('ear-fingering').addEventListener('change', (e) => { S().fingering = e.target.checked; save(); });
  $('ear-auto').addEventListener('change', (e) => { P().auto = e.target.checked; save(); });
  $('ear-level').addEventListener('change', (e) => {
    P().level = Number(e.target.value);
    P().recent = [];
    save();
    settingsChanged();
  });

  function syncSettings() {
    keySel.value = S().key;
    $('ear-labels').value = S().labels;
    $('ear-timbre').value = S().timbre;
    $('ear-range').value = S().range;
    $('ear-home-style').value = S().home;
    $('ear-tonic-first').checked = S().tonicFirst;
    $('ear-fingering').checked = S().fingering;
    $('ear-auto').checked = P().auto;
    $('ear-level').value = String(P().level);
    $('ear-level-degrees').textContent = sortSet(setNow()).map(label).join(' ');
    audio.timbre = S().timbre;
  }

  function settingsChanged() {
    syncSettings();
    rq.key = null; // set up the key again next time
    sq.key = null;
    mq.key = null;
    renderRecogniseButtons();
    renderSingIdle();
    renderMelodyButtons();
    if (S().tab === 'songs') renderSongs();
  }

  // ---------------------------------------------------- drill 1: degrees

  const rq = { key: null, tonic: null, deg: null, answered: true, startedAt: 0, right: 0, total: 0, last: [] };

  function renderRecogniseButtons() {
    const set = sortSet(setNow());
    $('ear-answers').replaceChildren(
      ...set.map((deg) => {
        const b = document.createElement('button');
        b.className = 'ear-ans';
        b.dataset.deg = deg;
        b.innerHTML = `<b>${label(deg)}</b><small>${S().labels === 'solfege' ? degreeLabel(deg, 'numbers') : degreeLabel(deg, 'solfege')}</small>`;
        b.addEventListener('click', () => answerRecognise(deg));
        return b;
      }),
    );
  }

  function status() {
    $('ear-status').textContent = `${rq.key ? `Key: ${rq.key} major · ` : ''}Level ${P().level}${rq.total ? ` · ${rq.right}/${rq.total} right` : ''}`;
  }

  async function newRecognise() {
    clearTimeout(rq.timer);
    audio.stop();
    const key = pickKey(S().key);
    const set = setNow();
    const needHome = key !== rq.key;
    rq.key = key;
    rq.tonic = tonicFor(key, set, range());
    rq.deg = pickDegree(P(), set, Math.random, rq.last);
    rq.last = [...rq.last.slice(-2), rq.deg];
    rq.answered = false;
    for (const b of $('ear-answers').children) b.className = 'ear-ans';
    $('ear-feedback').textContent = '';
    $('ear-feedback').className = 'ear-feedback';
    $('ear-finger').innerHTML = '';
    $('ear-hint-box').hidden = true;
    $('ear-next').hidden = true;
    $('ear-start').hidden = true;
    $('ear-prompt').textContent = needHome ? 'Listen to the key…' : 'Which degree is this?';
    status();
    let t = await audio.ready();
    if (needHome) t = audio.home(rq.tonic, t, S().home) + 0.35;
    if (S().tonicFirst) t = audio.note(rq.tonic, t, 0.6) + 0.25;
    audio.note(degreeMidi(rq.tonic, rq.deg), t, 1.1);
    rq.startedAt = performance.now() + msUntil(t);
    setTimeout(() => {
      if (!rq.answered) $('ear-prompt').textContent = 'Which degree is this?';
    }, msUntil(t));
  }

  async function replayRecognise() {
    if (!rq.deg) return;
    audio.stop();
    let t = await audio.ready();
    if (S().tonicFirst) t = audio.note(rq.tonic, t, 0.6) + 0.25;
    audio.note(degreeMidi(rq.tonic, rq.deg), t, 1.1);
  }

  async function homeRecognise() {
    if (!rq.tonic) return;
    audio.stop();
    await playHome(rq.tonic);
  }

  async function answerRecognise(deg) {
    if (rq.answered || !rq.deg) return;
    rq.answered = true;
    const right = deg === rq.deg;
    const ms = performance.now() - rq.startedAt;
    rq.total++;
    if (right) rq.right++;
    const { levelUp } = recordAnswer(P(), { key: rq.key, degree: rq.deg, right, ms });
    save();
    for (const b of $('ear-answers').children) {
      if (b.dataset.deg === rq.deg) b.classList.add('right');
      else if (b.dataset.deg === deg) b.classList.add('wrong');
    }
    const fb = $('ear-feedback');
    const midi = degreeMidi(rq.tonic, rq.deg);
    $('ear-finger').innerHTML = fingeringHtml(midi);
    if (right) {
      fb.textContent = `✓ Yes, ${longName(rq.deg)}`;
      fb.className = 'ear-feedback good';
    } else {
      fb.textContent = `✗ That was ${longName(rq.deg)}, not ${longName(deg)}. Listen: the note, home, the note.`;
      fb.className = 'ear-feedback bad';
      showHint($('ear-hint-box'), rq.deg, rq.tonic);
      // Hear how it sits against home.
      audio.stop();
      let t = await audio.ready();
      t = audio.note(midi, t, 0.8) + 0.15;
      t = audio.note(rq.tonic, t, 0.8) + 0.15;
      audio.note(midi, t, 1);
    }
    if (levelUp) {
      fb.textContent += ` 🎉 Level ${P().level}: now ${sortSet(setNow()).map(label).join(' ')}`;
      syncSettings();
      renderRecogniseButtons();
      rq.key = null;
    }
    status();
    $('ear-next').hidden = false;
    $('ear-prompt').textContent = right ? 'Next one coming…' : 'Press Next when you’re ready.';
    if (right && !levelUp) rq.timer = setTimeout(newRecognise, 1100);
  }

  $('ear-start').addEventListener('click', newRecognise);
  $('ear-next').addEventListener('click', newRecognise);
  $('ear-replay').addEventListener('click', replayRecognise);
  $('ear-home').addEventListener('click', homeRecognise);

  // ---------------------------------------------- drill 2: sing / play it

  const sq = { key: null, tonic: null, deg: null, revealed: false, last: [] };

  function renderSingIdle() {
    if (sq.deg) return;
    $('sing-degree').textContent = '?';
  }

  async function newSing() {
    audio.stop();
    const key = pickKey(S().key);
    const set = setNow();
    const needHome = key !== sq.key;
    sq.key = key;
    sq.tonic = tonicFor(key, set, range());
    // Weak degrees come up more, judged on your singing answers.
    sq.deg = pickDegree({ stats: { recognise: P().stats.sing || {} } }, set, Math.random, sq.last);
    sq.last = [...sq.last.slice(-2), sq.deg];
    sq.revealed = false;
    $('sing-degree').textContent = label(sq.deg);
    $('sing-sub').textContent = `${longName(sq.deg)} in ${key} major`;
    stopMic();
    $('sing-finger').innerHTML = '';
    $('sing-hint-box').hidden = true;
    $('sing-grade').hidden = true;
    $('sing-reveal').hidden = false;
    $('sing-mic').hidden = false;
    $('sing-hint-btn').hidden = false;
    $('sing-mic-error').hidden = true;
    $('sing-start').textContent = 'Next ▸';
    $('sing-hint').textContent = needHome
      ? 'Listen to the key, then sing or play this degree: 🎤 to be checked by the microphone, or Reveal to check yourself.'
      : 'Sing or play it: 🎤 to be checked, or Reveal to check yourself. Stuck? Try 💡 Hint.';
    if (needHome) await playHome(sq.tonic);
  }

  async function revealSing() {
    if (!sq.deg) return;
    stopMic();
    sq.revealed = true;
    $('sing-mic').hidden = true;
    audio.stop();
    let t = await audio.ready();
    audio.note(degreeMidi(sq.tonic, sq.deg), t, 1.2);
    $('sing-finger').innerHTML = fingeringHtml(degreeMidi(sq.tonic, sq.deg));
    $('sing-grade').hidden = false;
    $('sing-reveal').hidden = true;
    $('sing-hint').textContent = 'Was yours the same note?';
  }

  function gradeSing(right) {
    if (!sq.deg || !sq.revealed) return;
    recordAnswer(P(), { drill: 'sing', key: sq.key, degree: sq.deg, right });
    save();
    newSing();
  }

  // Singing into the microphone: listen for a steady note, then judge it
  // against the degree in any octave, and play the right note to compare.
  let micUnsub = null;
  let micTimer = null;
  async function startMic() {
    if (!sq.deg || sq.revealed) return;
    audio.stop();
    $('sing-mic-error').hidden = true;
    try {
      d.listener.setOptions({ minFreq: 70, maxFreq: 2600 });
      await d.listener.start();
    } catch (err) {
      d.showMicError($('sing-mic-error'), err);
      return;
    }
    $('sing-listen').hidden = false;
    $('sing-heard').textContent = 'Listening… sing or play the note and hold it.';
    const samples = [];
    micUnsub?.();
    micUnsub = d.listener.onPitch((reading, now) => {
      $('sing-level').style.width = `${Math.min(100, Math.round(reading.rms * 400))}%`;
      if (!reading.freq || reading.clarity < 0.85) return;
      const midi = freqToMidi(reading.freq, state.a4);
      samples.push({ t: now, midi });
      const live = judgeSung(midi, sq.tonic, sq.deg, S().labels);
      $('sing-heard').textContent = `Hearing ${live.heardLabel}…`;
      const steady = steadyPitch(samples, 0.6, 12);
      if (steady != null) gotSung(steady);
    });
    clearTimeout(micTimer);
    micTimer = setTimeout(() => {
      if (micUnsub) {
        stopMic();
        $('sing-hint').textContent = 'Didn’t catch a steady note. Try again (hold it longer, closer to the mic), or use Reveal.';
      }
    }, 12000);
  }

  function stopMic() {
    clearTimeout(micTimer);
    micUnsub?.();
    micUnsub = null;
    if (d.listener.running) {
      d.listener.stop();
      d.restoreDetector?.();
    }
    $('sing-listen').hidden = true;
  }

  async function gotSung(midi) {
    stopMic();
    const r = judgeSung(midi, sq.tonic, sq.deg, S().labels);
    recordAnswer(P(), { drill: 'sing', key: sq.key, degree: sq.deg, right: r.right });
    save();
    sq.revealed = true;
    $('sing-mic').hidden = true;
    $('sing-reveal').hidden = true;
    const tune = Math.abs(r.cents) <= 15 ? 'in tune' : `${Math.abs(r.cents)} cents ${r.cents > 0 ? 'sharp' : 'flat'}`;
    $('sing-hint').innerHTML = r.right
      ? `<b class="good-text">✓ Yes, that's ${longName(sq.deg)}</b> (${tune}). Here it is to compare.`
      : `<b class="bad-text">✗ You sang ${r.heardLabel}</b>, not ${longName(sq.deg)}. Here's ${longName(sq.deg)}; try the hint.`;
    // Play the right note, after the singer stops.
    const t = await audio.ready();
    audio.note(degreeMidi(sq.tonic, sq.deg), t + 0.2, 1.2);
    $('sing-finger').innerHTML = fingeringHtml(degreeMidi(sq.tonic, sq.deg));
    $('sing-grade').hidden = true;
    $('sing-start').textContent = 'Next ▸';
    if (!r.right) showHint($('sing-hint-box'), sq.deg, sq.tonic);
  }

  $('sing-mic').addEventListener('click', startMic);
  $('sing-mic-stop').addEventListener('click', stopMic);
  $('sing-hint-btn').addEventListener('click', () => sq.deg && showHint($('sing-hint-box'), sq.deg, sq.tonic));
  $('sing-start').addEventListener('click', newSing);
  $('sing-home').addEventListener('click', async () => sq.tonic && (audio.stop(), playHome(sq.tonic)));
  $('sing-reveal').addEventListener('click', revealSing);
  $('sing-yes').addEventListener('click', () => gradeSing(true));
  $('sing-no').addEventListener('click', () => gradeSing(false));

  // ------------------------------------------------- drill 3: melodies

  const mq = { key: null, tonic: null, melody: null, answer: [], done: true };

  function renderMelodyButtons() {
    const set = sortSet(setNow());
    $('mel-answers').replaceChildren(
      ...set.map((deg) => {
        const b = document.createElement('button');
        b.className = 'ear-ans';
        b.innerHTML = `<b>${label(deg)}</b><small>${S().labels === 'solfege' ? degreeLabel(deg, 'numbers') : degreeLabel(deg, 'solfege')}</small>`;
        b.addEventListener('click', () => addMelodyNote(deg));
        return b;
      }),
    );
  }

  function renderSlots(result = null) {
    $('mel-slots').replaceChildren(
      ...(mq.melody || []).map((deg, i) => {
        const s = document.createElement('div');
        s.className = `ear-slot${result ? (result[i] ? ' right' : ' wrong') : ''}${!result && i === mq.answer.length ? ' cur' : ''}`;
        s.innerHTML = `<b>${mq.answer[i] ? label(mq.answer[i]) : '·'}</b>${result && !result[i] ? `<small>${label(deg)}</small>` : ''}`;
        return s;
      }),
    );
  }

  async function newMelody() {
    audio.stop();
    const key = pickKey(S().key);
    const set = setNow();
    const needHome = key !== mq.key;
    mq.key = key;
    mq.tonic = tonicFor(key, set, range());
    // Sometimes a phrase from a song you know (if it fits the level), otherwise a made-up one.
    const fits = SONGS.flatMap((song) => song.phrases.map((ph) => ({ song, degs: ph.map((n) => n[1]) })))
      .filter((x) => x.degs.length >= 3 && x.degs.length <= 8 && x.degs.every((g) => set.includes(g)));
    const tune = fits.length && Math.random() < 0.33 ? fits[Math.floor(Math.random() * fits.length)] : null;
    mq.from = tune?.song.title || null;
    mq.melody = tune ? tune.degs : makeMelody(set, melodyLength(P().level), Math.random);
    mq.answer = [];
    mq.done = false;
    $('mel-feedback').textContent = '';
    $('mel-feedback').className = 'ear-feedback';
    $('mel-start').textContent = 'New melody';
    $('mel-info').textContent = `${mq.melody.length} notes in ${key} major. Tap the degrees in order.`;
    renderSlots();
    let t = await audio.ready();
    if (needHome) t = audio.home(mq.tonic, t, S().home) + 0.4;
    audio.melody(mq.tonic, mq.melody, t, 0.55);
  }

  async function replayMelody() {
    if (!mq.melody) return;
    audio.stop();
    audio.melody(mq.tonic, mq.melody, await audio.ready(), 0.55);
  }

  function addMelodyNote(deg) {
    if (!mq.melody || mq.done) return;
    mq.answer.push(deg);
    audio.ready().then((t) => audio.note(degreeMidi(mq.tonic, deg), t, 0.35, { vol: 0.6 }));
    if (mq.answer.length < mq.melody.length) return renderSlots();
    mq.done = true;
    const result = compareMelody(mq.answer, mq.melody);
    mq.melody.forEach((deg2, i) => recordAnswer(P(), { drill: 'melody', key: mq.key, degree: deg2, right: result[i] }));
    save();
    renderSlots(result);
    const right = result.filter(Boolean).length;
    const fb = $('mel-feedback');
    fb.textContent = right === result.length ? `✓ All ${right} right!` : `${right}/${result.length} right. The correct degrees are shown under the wrong ones; listen again with Replay.`;
    if (mq.from) fb.textContent += ` (That was from ${mq.from}.)`;
    fb.className = `ear-feedback ${right === result.length ? 'good' : 'bad'}`;
  }

  function undoMelody() {
    if (mq.done || !mq.answer.length) return;
    mq.answer.pop();
    renderSlots();
  }

  $('mel-start').addEventListener('click', newMelody);
  $('mel-replay').addEventListener('click', replayMelody);
  $('mel-home').addEventListener('click', async () => mq.tonic && (audio.stop(), playHome(mq.tonic)));
  $('mel-undo').addEventListener('click', undoMelody);

  // ---------------------------------------------------------- songs

  function songKey() {
    return S().key.startsWith('random') ? 'C' : S().key;
  }

  function renderSongs() {
    const key = songKey();
    $('songs-key').textContent = `${key} major`;
    $('ear-song-list').replaceChildren(
      ...SONGS.map((song) => {
        const card = document.createElement('div');
        card.className = 'ear-song';
        const degs = [...new Set(song.phrases.flat().map((n) => n[1]))];
        const tonic = tonicFor(key, degs, range());
        card.innerHTML = `<div class="ear-song-head"><b>${song.title}</b><small>starts on ${longName(song.starts)}</small><button class="btn small secondary">▶ Play</button></div>`;
        const rows = song.phrases.map((ph, pi) => {
          const row = document.createElement('button');
          row.className = 'ear-phrase';
          row.title = 'Play this phrase';
          row.innerHTML = ph.map(([syl, deg], ni) => `<span class="ear-syl" data-n="${ni}"><i>${syl}</i><b>${label(deg)}</b></span>`).join('');
          row.addEventListener('click', () => playPhrases(song, tonic, [pi], card));
          return row;
        });
        card.append(...rows);
        card.querySelector('button').addEventListener('click', () => playPhrases(song, tonic, song.phrases.map((_, i) => i), card));
        return card;
      }),
    );
    $('ear-intervals').innerHTML = INTERVAL_SONGS.map(([iv, songs]) => `<tr><th>${iv}</th><td>${songs}</td></tr>`).join('');
  }

  async function playPhrases(song, tonic, which, card) {
    audio.stop();
    audio.clearTimers();
    for (const el of document.querySelectorAll('.ear-syl.now')) el.classList.remove('now');
    let t = await audio.ready();
    const beat = song.meter === 3 ? 0.42 : 0.4;
    const rows = card.querySelectorAll('.ear-phrase');
    for (const pi of which) {
      const cells = rows[pi].querySelectorAll('.ear-syl');
      const notes = song.phrases[pi].map(([, deg, beats]) => [deg, beats]);
      t = audio.melody(tonic, notes, t, beat, (i) => {
        for (const el of document.querySelectorAll('.ear-syl.now')) el.classList.remove('now');
        cells[i]?.classList.add('now');
      }) + beat * 0.5;
    }
    const timer = setTimeout(() => {
      for (const el of document.querySelectorAll('.ear-syl.now')) el.classList.remove('now');
    }, msUntil(t));
    audio.timers.push(timer);
  }

  // ------------------------------------------------------- progress

  function renderProgress() {
    const pr = P();
    const days = streak(pr);
    const todayN = pr.days[new Date().toISOString().slice(0, 10)] || 0;
    $('ear-prog-cards').innerHTML = `
      <div class="result-card"><div class="card-title">Streak</div><div class="card-value">${days} day${days === 1 ? '' : 's'}</div><div class="card-sub">practise a little every day</div></div>
      <div class="result-card"><div class="card-title">Today</div><div class="card-value">${todayN}</div><div class="card-sub">answers (aim for ~10 minutes)</div></div>
      <div class="result-card"><div class="card-title">Level</div><div class="card-value">${pr.level}</div><div class="card-sub">${sortSet(levelSet(pr.level)).map(label).join(' ')}</div></div>`;
    const keys = Object.keys(pr.stats.recognise || {});
    const sel = $('ear-prog-key');
    const keep = sel.value;
    sel.innerHTML = '<option value="">All keys</option>' + keys.map((k) => `<option value="${k}">${k} major</option>`).join('');
    sel.value = keys.includes(keep) ? keep : '';
    const st = degreeStats(pr, 'recognise', sel.value || null);
    const sing = degreeStats(pr, 'sing', sel.value || null);
    const mel = degreeStats(pr, 'melody', sel.value || null);
    const pct = (o) => (o?.n ? `${Math.round(o.acc * 100)}%` : '–');
    const rowsHtml = ORDER.filter((x) => st[x] || sing[x] || mel[x]).map((deg) => {
      const o = st[deg];
      const bar = o?.n ? `<span class="ear-bar"><span style="width:${Math.round(o.acc * 100)}%"></span></span>` : '';
      return `<tr><th>${label(deg)}</th><td>${pct(o)} ${bar}<small>${o?.n || 0}</small></td><td>${o?.n ? `${(o.avgMs / 1000).toFixed(1)} s` : '–'}</td><td>${pct(sing[deg])}</td><td>${pct(mel[deg])}</td></tr>`;
    });
    $('ear-prog-table').innerHTML = rowsHtml.length
      ? `<thead><tr><th>Degree</th><th>Naming</th><th>Speed</th><th>Sing</th><th>Melody</th></tr></thead><tbody>${rowsHtml.join('')}</tbody>`
      : '<tbody><tr><td>No answers yet. Try the Degrees drill.</td></tr></tbody>';
    const weak = weakest(pr, ORDER);
    $('ear-prog-weak').textContent = weak.length
      ? `Weakest: ${weak.map(longName).join(' and ')}. They come up more often in the drills.`
      : 'No weak degrees yet: keep going!';
  }
  $('ear-prog-key').addEventListener('change', renderProgress);
  $('ear-prog-reset').addEventListener('click', () => {
    if (!confirm('Reset all ear-training progress?')) return;
    state.ear.progress = newProgress();
    save();
    settingsChanged();
    renderProgress();
  });

  // ------------------------------------------------------- keyboard

  function degreeForKey(e, set) {
    if (e.code === 'Digit8' || e.key === '8') return set.includes("1'") ? "1'" : null;
    const n = /^Digit([1-7])$/.exec(e.code)?.[1] || (/^[1-7]$/.test(e.key) ? e.key : null);
    if (!n) return null;
    if (e.shiftKey && set.includes(`L${n}`)) return `L${n}`;
    if (set.includes(n)) return n;
    if (set.includes(`L${n}`)) return `L${n}`;
    return null;
  }

  document.addEventListener('keydown', (e) => {
    if (!active || e.repeat || e.target.closest?.('input, select, textarea') || e.metaKey || e.ctrlKey) return;
    const tab = S().tab;
    const set = setNow();
    const deg = degreeForKey(e, set);
    if (tab === 'recognise') {
      if (deg) answerRecognise(deg);
      else if (e.code === 'Space') replayRecognise();
      else if (e.key === 'c' || e.key === 'C') homeRecognise();
      else if (e.key === 'Enter') (rq.answered ? newRecognise() : null);
      else return;
    } else if (tab === 'melody') {
      if (deg) addMelodyNote(deg);
      else if (e.code === 'Space') replayMelody();
      else if (e.key === 'c' || e.key === 'C') mq.tonic && (audio.stop(), playHome(mq.tonic));
      else if (e.key === 'Backspace') undoMelody();
      else if (e.key === 'Enter') newMelody();
      else return;
    } else if (tab === 'sing') {
      if (e.code === 'Space') (sq.revealed ? null : revealSing());
      else if (e.key === 'y' && sq.revealed) gradeSing(true);
      else if (e.key === 'n' && sq.revealed) gradeSing(false);
      else if (e.key === 'c' || e.key === 'C') sq.tonic && (audio.stop(), playHome(sq.tonic));
      else if (e.key === 'Enter') newSing();
      else return;
    } else return;
    e.preventDefault();
  });

  // Start-up
  syncSettings();
  renderRecogniseButtons();
  renderMelodyButtons();
  renderSingIdle();

  return {
    enter() {
      active = true;
      audio.a4 = state.a4;
      syncSettings();
      settingsChanged();
      showTab();
    },
    leave() {
      active = false;
      stopMic();
      clearTimeout(rq.timer);
      audio.stop();
      audio.clearTimers();
    },
  };
}

/** A recorder's holes, front view, with the thumb hole beside them. */
export function fingeringSvg(f) {
  const hole = (cx, cy, r, v) => {
    if (v === 1) return `<circle cx="${cx}" cy="${cy}" r="${r}" class="fh-on"/>`;
    if (v === 0.5) return `<circle cx="${cx}" cy="${cy}" r="${r}" class="fh-off"/><path d="M${cx} ${cy - r} A${r} ${r} 0 0 0 ${cx} ${cy + r} Z" class="fh-on"/>`;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" class="fh-off"/>`;
  };
  const ys = [22, 38, 54, 76, 92, 108, 124];
  let out = '<svg class="ear-fing-svg" viewBox="0 0 60 150" aria-label="Fingering">';
  out += '<rect x="20" y="4" width="20" height="142" rx="9" class="fh-body"/>';
  out += `<text x="6" y="12" class="fh-t">T</text>${hole(9, 22, 5, f[0])}`;
  ys.forEach((y, i) => {
    const v = f[i + 1];
    if (i >= 5) {
      // Holes 6 and 7 are double holes: half covers the small one.
      const left = v >= 0.5 ? 1 : 0;
      const right = v === 1 ? 1 : 0;
      out += hole(26.5, y, 3, left) + hole(33.5, y, 3, right);
    } else out += hole(30, y, 5, v);
  });
  out += '<line x1="16" y1="65" x2="44" y2="65" class="fh-split"/></svg>';
  return out;
}
