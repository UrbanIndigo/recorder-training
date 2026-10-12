// Piano Chords: asks for a chord ("G major, 1st inversion"), listens through
// the mic or a MIDI keyboard, says whether you got it (and what was wrong),
// then shows the answer on a keyboard.

import { CHORD_TYPES, GROUPS, INVERSION_NAMES, PRESETS, WHITE_ROOTS, ALL_ROOTS, nextChord, recordChord, checkChord, voicing, nameNotes, newChordStats, statsTable } from './chords.js?v=2.2';
import { ChordListener, MidiInput } from './chord-detect.js?v=2.2';
import { keyboardSvg } from './keyboard.js?v=2.2';
import { createPlaybackContext } from './audio.js?v=2.2';
import { midiToFreq } from './music.js?v=2.2';

const AUTO_NEXT_MS = 1600;

export function initChordsView(d) {
  const { $, state } = d;
  state.chords ||= { preset: 'major', custom: null, input: 'mic', stats: newChordStats(), queue: [] };
  const cs = () => state.chords;

  const mic = new ChordListener();
  const midi = MidiInput.supported ? new MidiInput() : null;
  let unsub = null;
  let chord = null;
  let shownAt = 0;
  let armed = false; // wait for silence before judging a new chord
  let solved = false;
  let revealed = false;
  let streak = { correct: 0, wrong: null, quiet: 0 };
  let session = { tried: 0, right: 0, ms: [] };
  let nextTimer = null;
  let listening = false;

  // ------------------------------------------------------------- settings

  for (const p of PRESETS) $('ch-preset').add(new Option(p.name, p.id));
  $('ch-preset').add(new Option('Custom…', 'custom'));
  $('ch-preset').value = cs().preset;

  // Custom choice: chord types grouped, inversions, roots.
  const typeBox = $('ch-types');
  for (const [group, label] of Object.entries(GROUPS)) {
    const fs = document.createElement('fieldset');
    fs.innerHTML = `<legend>${label}</legend>`;
    for (const [id, t] of Object.entries(CHORD_TYPES)) {
      if (t.group !== group) continue;
      const lab = document.createElement('label');
      lab.className = 'toggle';
      lab.innerHTML = `<input type="checkbox" value="${id}"> ${t.name}`;
      fs.append(lab);
    }
    typeBox.append(fs);
  }
  INVERSION_NAMES.forEach((n, i) => {
    const lab = document.createElement('label');
    lab.className = 'toggle';
    lab.innerHTML = `<input type="checkbox" value="${i}"> ${n}`;
    $('ch-inversions').append(lab);
  });

  function settings() {
    if (cs().preset !== 'custom') {
      const p = PRESETS.find((x) => x.id === cs().preset) || PRESETS[0];
      return { types: p.types, inversions: p.inversions, roots: p.roots === 'white' ? WHITE_ROOTS : ALL_ROOTS };
    }
    const c = cs().custom || { types: ['major'], inversions: [0], roots: 'all' };
    return { types: c.types.length ? c.types : ['major'], inversions: c.inversions.length ? c.inversions : [0], roots: c.roots === 'white' ? WHITE_ROOTS : ALL_ROOTS };
  }

  function syncCustomUi() {
    const s = settings();
    const isCustom = cs().preset === 'custom';
    $('ch-custom').hidden = !isCustom;
    for (const cb of typeBox.querySelectorAll('input')) cb.checked = s.types.includes(cb.value);
    for (const cb of $('ch-inversions').querySelectorAll('input')) cb.checked = s.inversions.includes(Number(cb.value));
    $('ch-roots').value = s.roots === WHITE_ROOTS ? 'white' : 'all';
  }

  function saveCustom() {
    cs().custom = {
      types: [...typeBox.querySelectorAll('input:checked')].map((c) => c.value),
      inversions: [...$('ch-inversions').querySelectorAll('input:checked')].map((c) => Number(c.value)),
      roots: $('ch-roots').value,
    };
    d.save();
  }

  $('ch-preset').addEventListener('change', (e) => {
    const s = settings();
    cs().preset = e.target.value;
    if (cs().preset === 'custom' && !cs().custom) cs().custom = { types: s.types, inversions: s.inversions, roots: s.roots === WHITE_ROOTS ? 'white' : 'all' };
    d.save();
    syncCustomUi();
    newChord();
  });
  for (const el of [typeBox, $('ch-inversions'), $('ch-roots')]) {
    el.addEventListener('change', () => {
      saveCustom();
      newChord();
    });
  }

  // Input: mic or MIDI keyboard.
  if (!midi) $('ch-input').querySelector('option[value="midi"]').disabled = true;
  $('ch-input').value = midi ? cs().input : 'mic';
  $('ch-input').addEventListener('change', async (e) => {
    cs().input = e.target.value;
    d.save();
    if (listening) {
      stopListening();
      await startListening();
    }
  });

  // --------------------------------------------------------------- buttons

  $('ch-start').addEventListener('click', startListening);
  $('ch-stop').addEventListener('click', stopListening);
  $('ch-next').addEventListener('click', () => newChord());
  $('ch-reveal').addEventListener('click', () => {
    if (!solved) finish(false, 'Here it is.');
  });
  $('ch-got').addEventListener('click', () => {
    if (!solved) finish(true, 'Marked as got it.');
  });
  $('ch-missed').addEventListener('click', () => {
    if (!solved) finish(false, 'Marked as missed. It’ll come back soon.');
  });
  $('ch-hear').addEventListener('click', () => playChord(voicing(chord)));
  $('ch-reset').addEventListener('click', () => {
    if ($('ch-reset').dataset.confirm !== '1') {
      $('ch-reset').dataset.confirm = '1';
      $('ch-reset').textContent = 'Tap again to clear your chord stats';
      return;
    }
    delete $('ch-reset').dataset.confirm;
    $('ch-reset').textContent = 'Clear chord stats';
    cs().stats = newChordStats();
    cs().queue = [];
    d.save();
    renderStats();
  });

  // --------------------------------------------------------------- chords

  function newChord() {
    clearTimeout(nextTimer);
    chord = nextChord(cs().stats, settings(), cs().queue, chord);
    d.save();
    solved = false;
    revealed = false;
    armed = false;
    streak = { correct: 0, wrong: null, quiet: 0 };
    // A MIDI keyboard with no keys down is ready straight away; the mic
    // waits for the last chord to stop ringing.
    if (listening && cs().input === 'midi' && midi && midi.held.size === 0) armed = true;
    shownAt = performance.now();
    $('ch-name').textContent = chord.name;
    $('ch-inversion').textContent = chord.inversionName;
    $('ch-symbol').textContent = chord.symbol;
    $('ch-again').hidden = !chord.again;
    $('ch-about').textContent = CHORD_TYPES[chord.type].about;
    $('ch-feedback').textContent = listening ? 'Play it when you’re ready.' : 'Press Start listening, then play the chord.';
    $('ch-feedback').className = 'ch-feedback';
    $('ch-answer').hidden = true;
    $('ch-got').disabled = $('ch-missed').disabled = $('ch-reveal').disabled = false;
    $('ch-prompt').classList.remove('solved', 'missed');
  }

  function reveal() {
    revealed = true;
    const v = voicing(chord);
    const marks = v.map((m, i) => ({ midi: m, bass: i === 0, label: chord.tones.find((t) => t.pc === m % 12).name }));
    $('ch-keys').innerHTML = keyboardSvg(marks);
    const order = [...chord.tones.slice(chord.inversion), ...chord.tones.slice(0, chord.inversion)];
    $('ch-notes').textContent = `${order.map((t) => t.name).join(' – ')}  (bottom to top, ${chord.bass.name} in the bass)`;
    $('ch-answer').hidden = false;
  }

  function finish(correct, message) {
    if (solved) return;
    solved = true;
    const ms = performance.now() - shownAt;
    recordChord(cs().stats, cs().queue, chord, correct, ms);
    d.save();
    session.tried++;
    if (correct) {
      session.right++;
      session.ms.push(ms);
    }
    reveal();
    $('ch-feedback').textContent = correct ? `${message} ${(ms / 1000).toFixed(1)} s` : message;
    $('ch-feedback').className = `ch-feedback ${correct ? 'good' : 'bad'}`;
    $('ch-prompt').classList.add(correct ? 'solved' : 'missed');
    $('ch-got').disabled = $('ch-missed').disabled = $('ch-reveal').disabled = true;
    renderStats();
    // Move on by itself after a right answer while listening.
    if (correct && listening) nextTimer = setTimeout(() => newChord(), AUTO_NEXT_MS);
  }

  // ------------------------------------------------------------- listening

  async function startListening() {
    $('ch-error').hidden = true;
    try {
      if (cs().input === 'midi' && midi) {
        const names = await midi.start();
        unsub = midi.onNotes(onNotes);
        $('ch-source').textContent = names.length ? `MIDI: ${names.join(', ')}` : 'No MIDI keyboard found yet. Plug one in (it will be picked up), or switch to the microphone.';
      } else {
        d.beforeListening();
        await mic.start();
        unsub = mic.onNotes(onNotes);
        $('ch-source').textContent = 'Listening with the microphone. Play clearly and hold the chord for a moment.';
      }
    } catch (err) {
      d.showMicError($('ch-error'), err);
      return;
    }
    listening = true;
    if (cs().input === 'midi' && midi && midi.held.size === 0) armed = true;
    $('ch-start').hidden = true;
    $('ch-stop').hidden = false;
    if (!solved) $('ch-feedback').textContent = 'Play it when you’re ready.';
    shownAt = performance.now();
  }

  function stopListening() {
    unsub?.();
    unsub = null;
    mic.stop();
    midi?.stop();
    listening = false;
    clearTimeout(nextTimer);
    $('ch-start').hidden = false;
    $('ch-stop').hidden = true;
    $('ch-heard').textContent = '—';
    $('ch-source').textContent = '';
  }

  /** Readings from the mic (~20 a second) or the MIDI keyboard (on every change). */
  function onNotes(reading) {
    const isMidi = cs().input === 'midi' && midi;
    const notes = reading.notes;
    // Name what's heard the way the chord is spelled (A♯, not B♭, in an A♯ chord).
    const spell = (m) => chord?.tones.find((t) => t.pc === ((m % 12) + 12) % 12)?.name ?? nameNotes([m])[0];
    const unique = [...new Set(notes)].sort((a, b) => a - b);
    $('ch-heard').textContent = unique.length ? `${unique.map(spell).join(' ')}${reading.bass != null ? `  (bass ${spell(reading.bass)})` : ''}` : '—';
    if (solved || !chord) return;
    // Don't judge a new chord on the last one still ringing (or keys still held).
    const quiet = isMidi ? notes.length === 0 : !reading.loud;
    if (!armed) {
      streak.quiet = quiet ? streak.quiet + 1 : 0;
      if (streak.quiet >= (isMidi ? 1 : 2)) armed = true;
      return;
    }
    if (notes.length < 2) {
      streak.correct = 0;
      return;
    }
    // From the mic, faint notes below the detected bass are ignored.
    const played = isMidi ? notes : notes.filter((m) => m >= reading.bass);
    const r = checkChord(chord, played, { allowExtra: isMidi ? 0 : 1 });
    if (r.correct) {
      streak.correct++;
      // MIDI is exact; the mic needs the chord to hold steady for a moment.
      if (isMidi || streak.correct >= 3) finish(true, r.message);
      return;
    }
    streak.correct = 0;
    // Tell them what's wrong once the same wrong chord has been held a while.
    const sig = nameNotes(notes).join(' ');
    if (streak.wrong?.sig === sig) streak.wrong.count++;
    else streak.wrong = { sig, count: 1 };
    if (streak.wrong.count === (isMidi ? 1 : 8) && notes.length >= Math.min(3, chord.tones.length)) {
      $('ch-feedback').textContent = r.message;
      $('ch-feedback').className = 'ch-feedback warn';
    }
  }

  // ---------------------------------------------------------------- sound

  function playChord(midis) {
    armed = false; // the mic would hear this; wait for it to die away
    streak.quiet = 0;
    const ctx = createPlaybackContext();
    const t0 = ctx.currentTime + 0.05;
    for (const m of midis) {
      const f = midiToFreq(m, 440);
      const out = ctx.createGain();
      out.gain.setValueAtTime(0, t0);
      out.gain.linearRampToValueAtTime(0.18, t0 + 0.01);
      out.gain.exponentialRampToValueAtTime(0.001, t0 + 2.2);
      out.connect(ctx.destination);
      for (const [h, a] of [[1, 1], [2, 0.4], [3, 0.15], [4, 0.08]]) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = f * h;
        g.gain.value = a;
        o.connect(g).connect(out);
        o.start(t0);
        o.stop(t0 + 2.3);
      }
    }
    setTimeout(() => ctx.close().catch(() => {}), 2600);
  }

  // ----------------------------------------------------------------- stats

  function renderStats() {
    const st = cs().stats;
    const avg = session.ms.length ? (session.ms.reduce((a, b) => a + b, 0) / session.ms.length / 1000).toFixed(1) : null;
    $('ch-session').textContent = session.tried
      ? `This session: ${session.right}/${session.tried} right${avg ? ` · average ${avg} s` : ''}`
      : st.total ? `All time: ${st.correct}/${st.total} right` : '';
    const rows = statsTable(st).slice(0, 8);
    $('ch-stats').hidden = !rows.length;
    $('ch-stats-body').replaceChildren(
      ...rows.map((r) => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td></td><td class="num"></td><td class="num"></td>';
        tr.children[0].textContent = r.label;
        tr.children[1].textContent = `${Math.round(r.accuracy * 100)}% of ${r.tries}`;
        tr.children[2].textContent = r.avgMs ? `${(r.avgMs / 1000).toFixed(1)} s` : '—';
        return tr;
      }),
    );
  }

  return {
    enter() {
      syncCustomUi();
      if (!chord) newChord();
      renderStats();
    },
    leave() {
      stopListening();
    },
  };
}

