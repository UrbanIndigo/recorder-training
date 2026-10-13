// Piano Chords: asks for a chord ("G major, 1st inversion"). You play it,
// reveal the answer, compare, and mark honestly whether you got it.

import { CHORD_TYPES, GROUPS, INVERSION_NAMES, PRESETS, WHITE_ROOTS, ALL_ROOTS, nextChord, recordChord, voicing, newChordStats, statsTable } from './chords.js?v=3.2';
import { keyboardSvg } from './keyboard.js?v=3.2';
import { createPlaybackContext } from './audio.js?v=3.2';
import { midiToFreq } from './music.js?v=3.2';

export function initChordsView(d) {
  const { $, state } = d;
  state.chords ||= { preset: 'major', custom: null, stats: newChordStats(), queue: [] };
  const cs = () => state.chords;

  let chord = null;
  let shownAt = 0;
  let thinkMs = 0;
  let revealed = false;
  let session = { tried: 0, right: 0, ms: [] };
  let active = false;

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
    $('ch-custom').hidden = cs().preset !== 'custom';
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

  // --------------------------------------------------------------- buttons

  $('ch-reveal').addEventListener('click', reveal);
  $('ch-prompt').addEventListener('click', (e) => {
    if (!revealed && !e.target.closest('details')) reveal();
  });
  $('ch-got').addEventListener('click', () => mark(true));
  $('ch-missed').addEventListener('click', () => mark(false));
  $('ch-skip').addEventListener('click', () => newChord());
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

  // Keyboard shortcuts on a computer: Space/Enter reveals, then Y or →
  // for "got it", N or ← for "didn't".
  document.addEventListener('keydown', (e) => {
    if (!active || e.target.closest?.('select, input, button, summary')) return;
    if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      reveal();
    } else if (revealed && (e.key === 'y' || e.key === 'ArrowRight')) mark(true);
    else if (revealed && (e.key === 'n' || e.key === 'ArrowLeft')) mark(false);
  });

  // ------------------------------------------------------------------ flow

  function newChord() {
    chord = nextChord(cs().stats, settings(), cs().queue, chord);
    d.save();
    revealed = false;
    shownAt = performance.now();
    $('ch-name').textContent = chord.name;
    $('ch-inversion').textContent = chord.inversionName;
    $('ch-symbol').textContent = chord.symbol;
    $('ch-again').hidden = !chord.again;
    $('ch-about').textContent = CHORD_TYPES[chord.type].about;
    $('ch-prompt').classList.remove('revealed');
    $('ch-answer').hidden = true;
    $('ch-before').hidden = false;
    $('ch-after').hidden = true;
    $('ch-time').textContent = '';
  }

  /** Show the answer to compare with what you played. */
  function reveal() {
    if (revealed) return;
    revealed = true;
    thinkMs = performance.now() - shownAt;
    const v = voicing(chord);
    const marks = v.map((m, i) => ({ midi: m, bass: i === 0, label: chord.tones.find((t) => t.pc === m % 12).name }));
    $('ch-keys').innerHTML = keyboardSvg(marks);
    const order = [...chord.tones.slice(chord.inversion), ...chord.tones.slice(0, chord.inversion)];
    $('ch-notes').textContent = order.map((t) => t.name).join(' – ');
    $('ch-bass').textContent = `${chord.bass.name} in the bass · the other notes can be in any order or octave`;
    $('ch-time').textContent = `${(thinkMs / 1000).toFixed(1)} s`;
    $('ch-prompt').classList.add('revealed');
    $('ch-answer').hidden = false;
    $('ch-before').hidden = true;
    $('ch-after').hidden = false;
  }

  /** Mark yourself, then straight on to the next chord. */
  function mark(correct) {
    if (!revealed) return;
    recordChord(cs().stats, cs().queue, chord, correct, thinkMs);
    d.save();
    session.tried++;
    if (correct) {
      session.right++;
      session.ms.push(thinkMs);
    }
    renderStats();
    newChord();
  }

  // ---------------------------------------------------------------- sound

  function playChord(midis) {
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
      active = true;
      syncCustomUi();
      if (!chord) newChord();
      renderStats();
    },
    leave() {
      active = false;
    },
  };
}
