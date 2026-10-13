// Beat Ward: a pixel-art rhythm game. Notes slide along a track to the
// patient's heart; tap as each arrives and you play the tune. Later wards
// add a second track for the left hand.

import { LEVELS, makeSong, judgeTap, grade, WINDOWS } from './song.js?v=2.6';
import { W, H, PAL, text, sprite, HEART, NOTE, TARGET, DOCTOR, DOCTOR_COLORS, drawWard, drawMonitor } from './art.js?v=2.6';

const HIT_X = 64; // where notes should be hit (the heart)
const PX_PER_BEAT = 34; // the same spacing at every tempo, so rhythms always look alike
const LANES_ONE = { R: 82 };
const LANES_TWO = { L: 70, R: 102 };
const LEFT_KEYS = new Set(['KeyF', 'KeyD', 'KeyS', 'ArrowLeft']);
const RIGHT_KEYS = new Set(['KeyJ', 'KeyK', 'KeyL', 'ArrowRight', 'Space', 'Enter']);

export function initGameView(d) {
  const { $, state } = d;
  state.game ||= { unlocked: 1, best: {}, offsetMs: 0 };
  const gs = () => state.game;

  const canvas = $('game-canvas');
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;

  let active = false;
  let run = null;
  let idleRaf = null;
  let selected = Math.min(gs().unlocked, LEVELS.length) - 1;

  // ------------------------------------------------------------------ menu

  function renderMenu() {
    const list = $('game-levels');
    list.replaceChildren(
      ...LEVELS.map((lvl, i) => {
        const b = document.createElement('button');
        const locked = lvl.id > gs().unlocked;
        const best = gs().best[lvl.id];
        b.className = `game-level${i === selected ? ' sel' : ''}${locked ? ' locked' : ''}`;
        b.disabled = locked;
        b.innerHTML = `<span class="gl-num">${lvl.id}</span><span class="gl-name"></span><span class="gl-best"></span>`;
        b.querySelector('.gl-name').textContent = locked ? 'LOCKED' : lvl.name + (lvl.hands === 2 ? ' ✋✋' : '');
        b.querySelector('.gl-best').textContent = best ? `${best.letter} ${Math.round(best.acc * 100)}%` : '';
        b.addEventListener('click', () => {
          selected = i;
          renderMenu();
        });
        b.addEventListener('dblclick', () => startLevel(LEVELS[i]));
        return b;
      }),
    );
    const lvl = LEVELS[selected];
    $('game-blurb').textContent = `${lvl.blurb} ${lvl.bpm} BPM · ${lvl.meter}${lvl.hands === 2 ? ' · TWO HANDS' : ''}`;
    $('game-offset').textContent = `${gs().offsetMs > 0 ? '+' : ''}${gs().offsetMs} ms`;
  }

  $('game-play').addEventListener('click', () => startLevel(LEVELS[selected]));
  $('game-retry').addEventListener('click', () => startLevel(run?.level || LEVELS[selected]));
  $('game-next').addEventListener('click', () => {
    selected = Math.min(LEVELS.length - 1, selected + 1);
    startLevel(LEVELS[selected]);
  });
  $('game-menu-btn').addEventListener('click', showMenu);
  $('game-quit').addEventListener('click', () => {
    endRun();
    showMenu();
  });
  $('game-offset-down').addEventListener('click', () => setOffset(gs().offsetMs - 10));
  $('game-offset-up').addEventListener('click', () => setOffset(gs().offsetMs + 10));
  function setOffset(ms) {
    gs().offsetMs = Math.max(-200, Math.min(200, ms));
    d.save();
    renderMenu();
  }

  function showMenu() {
    $('game-menu').hidden = false;
    $('game-results').hidden = true;
    $('game-pads').hidden = true;
    $('game-quit').hidden = true;
    renderMenu();
    idle();
  }

  /** The title-screen animation behind the menu. */
  function idle() {
    cancelAnimationFrame(idleRaf);
    const t0 = performance.now();
    const frame = () => {
      if (!active || run) return;
      const beat = (performance.now() - t0) / 700;
      drawWard(g, beat);
      drawMonitor(g, beat, false);
      const pulse = beat % 1 < 0.15 ? 3 : 2;
      sprite(g, HEART, HIT_X - (9 * pulse) / 2, 82 - (8 * pulse) / 2, { H: PAL.heart, L: PAL.heartLight }, pulse);
      sprite(g, DOCTOR[beat % 2 < 1 ? 0 : 1], 14, 104 + (beat % 1 < 0.5 ? 0 : 1), DOCTOR_COLORS, 2);
      text(g, 'BEAT WARD', 160, 64, PAL.text, { scale: 3, align: 'center', shadow: PAL.trim });
      text(g, 'A RHYTHM CLINIC', 160, 84, PAL.dim, { align: 'center' });
      idleRaf = requestAnimationFrame(frame);
    };
    frame();
  }

  // ----------------------------------------------------------------- audio

  function makeAudio() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const env = (t, peak, decay, attack = 0.003) => {
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(peak, t + attack);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      gn.connect(master);
      return gn;
    };
    const noiseHit = (t, peak, decay, type, freq) => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      src.connect(f).connect(env(t, peak, decay));
      src.start(t, Math.random() * 0.5);
      src.stop(t + decay + 0.02);
    };
    const tone = (t, freq, type, peak, decay, attack) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.connect(env(t, peak, decay, attack));
      o.start(t);
      o.stop(t + decay + 0.02);
      return o;
    };
    const hz = (m) => 440 * 2 ** ((m - 69) / 12);
    return {
      ctx,
      kick(t) {
        const o = tone(t, 150, 'sine', 0.6, 0.2);
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      },
      snare(t) {
        noiseHit(t, 0.28, 0.13, 'bandpass', 1900);
        tone(t, 190, 'triangle', 0.12, 0.08);
      },
      hat(t) {
        noiseHit(t, 0.05, 0.04, 'highpass', 7500);
      },
      stick(t) {
        tone(t, 1400, 'square', 0.06, 0.04);
      },
      bass(t, midi, dur) {
        tone(t, hz(midi), 'triangle', 0.2, Math.max(0.2, dur), 0.01);
      },
      pad(t, midis, dur) {
        for (const m of midis) tone(t, hz(m), 'triangle', 0.035, dur, 0.05);
      },
      lead(t, midi, dur) {
        tone(t, hz(midi), 'square', 0.07, Math.min(0.45, Math.max(0.12, dur)));
        tone(t, hz(midi) * 1.004, 'square', 0.035, Math.min(0.45, Math.max(0.12, dur)));
      },
      low(t, midi, dur) {
        tone(t, hz(midi), 'square', 0.06, Math.min(0.4, Math.max(0.15, dur)));
        tone(t, hz(midi) / 2, 'triangle', 0.2, Math.min(0.5, Math.max(0.2, dur)));
      },
      miss(t) {
        const o = tone(t, 160, 'sawtooth', 0.05, 0.18);
        o.frequency.exponentialRampToValueAtTime(70, t + 0.18);
      },
    };
  }

  // ------------------------------------------------------------------ play

  async function startLevel(level) {
    endRun();
    cancelAnimationFrame(idleRaf);
    const audio = makeAudio();
    await audio.ctx.resume();
    const song = makeSong(level, Date.now());
    const startAt = audio.ctx.currentTime + 0.6;
    for (const x of song.drums) audio[x.type](startAt + x.time);
    for (const x of song.bass) audio.bass(startAt + x.time, x.midi, x.dur * song.beatSec);
    // A soft chord on every bar under the tune.
    song.chords.forEach((c) => {
      const t = startAt + (song.countInBars + c.bar) * song.meter.bpb * song.beatSec;
      audio.pad(t, c.tones.map((x) => 60 + level.key + x), song.meter.bpb * song.beatSec * 0.95);
    });
    run = {
      level,
      song,
      audio,
      startAt,
      latency: (audio.ctx.outputLatency || 0) + (audio.ctx.baseLatency || 0),
      notes: song.notes.map((n) => ({ ...n })),
      lanes: level.hands === 2 ? LANES_TWO : LANES_ONE,
      counts: { perfect: 0, good: 0, ok: 0, miss: 0 },
      early: 0,
      late: 0,
      combo: 0,
      maxCombo: 0,
      score: 0,
      health: 100,
      popups: [],
      particles: [],
      shake: 0,
      tapAt: { L: -9, R: -9 },
      ended: false,
    };
    $('game-menu').hidden = true;
    $('game-results').hidden = true;
    $('game-quit').hidden = false;
    $('game-pads').hidden = false;
    $('game-pads').classList.toggle('two', level.hands === 2);
    loop();
  }

  /** Song time as you hear it, in seconds (negative during the lead-in). */
  function songTime() {
    return run.audio.ctx.currentTime - run.startAt - run.latency - gs().offsetMs / 1000;
  }

  function loop() {
    if (!run || run.ended) return;
    const t = songTime();
    // Notes that slipped past are misses.
    for (const n of run.notes) {
      if (n.judged) continue;
      if (n.time > t - WINDOWS.ok) break;
      n.judged = 'miss';
      n.missAt = t;
      run.counts.miss++;
      run.combo = 0;
      run.health = Math.max(0, run.health - 9);
      run.shake = 4;
      popup(n.lane, 'MISS', PAL.miss);
      run.audio.miss(run.audio.ctx.currentTime);
    }
    if (run.health <= 0) return finish(true);
    if (t > run.song.length + 0.4) return finish(false);
    render(t);
    requestAnimationFrame(loop);
  }

  function input(lane, e) {
    if (!run || run.ended) return;
    if (run.level.hands === 1) lane = 'R';
    const ago = e?.timeStamp != null ? Math.min(0.2, Math.max(0, performance.now() - e.timeStamp) / 1000) : 0;
    const t = songTime() - ago;
    run.tapAt[lane] = t;
    const r = judgeTap(run.notes, lane, t);
    if (!r) return; // a stray tap: no penalty
    const n = r.note;
    n.judged = r.judgement;
    run.counts[r.judgement]++;
    run.combo++;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    run.score += { perfect: 300, good: 150, ok: 60 }[r.judgement] * (1 + Math.min(run.combo, 50) / 50);
    run.health = Math.min(100, run.health + (r.judgement === 'perfect' ? 3 : r.judgement === 'good' ? 1.5 : 0.5));
    if (r.judgement !== 'perfect') r.offset < 0 ? run.early++ : run.late++;
    const word = r.judgement === 'perfect' ? 'PERFECT' : `${r.judgement === 'good' ? 'GOOD' : 'OK'} ${r.offset < 0 ? 'EARLY' : 'LATE'}`;
    popup(lane, word, PAL[r.judgement]);
    burst(lane, r.judgement === 'perfect' ? 14 : 8, lane === 'L' ? PAL.left : PAL.right);
    // You play the music: the note sounds when you hit it.
    const now = run.audio.ctx.currentTime;
    if (lane === 'R') run.audio.lead(now, n.midi, n.dur * run.song.beatSec);
    else run.audio.low(now, n.midi, n.dur * run.song.beatSec);
  }

  function popup(lane, word, color) {
    run.popups = run.popups.filter((p) => p.lane !== lane);
    run.popups.push({ lane, word, color, born: performance.now() });
  }

  function burst(lane, count, color) {
    const y = run.lanes[lane];
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const v = 0.6 + Math.random() * 1.2;
      run.particles.push({ x: HIT_X, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.4, life: 24, color });
    }
  }

  // ---------------------------------------------------------------- render

  function render(t) {
    const { song } = run;
    const beat = t / song.beatSec;
    g.save();
    if (run.shake > 0) {
      g.translate(Math.round((Math.random() - 0.5) * run.shake), Math.round((Math.random() - 0.5) * run.shake));
      run.shake *= 0.85;
      if (run.shake < 0.5) run.shake = 0;
    }
    drawWard(g, beat);
    drawMonitor(g, beat, false);

    // Tracks, with a tick on every beat (brighter on bar lines).
    for (const [lane, y] of Object.entries(run.lanes)) {
      const color = lane === 'L' ? PAL.left : PAL.right;
      g.fillStyle = PAL.laneEdge;
      g.fillRect(HIT_X - 14, y - 8, W - HIT_X + 14, 17);
      g.fillStyle = PAL.lane;
      g.fillRect(HIT_X - 14, y - 7, W - HIT_X + 14, 15);
      const firstBeat = Math.ceil(beat - 2);
      for (let k = firstBeat; k < beat + (W - HIT_X) / PX_PER_BEAT + 1; k++) {
        if (k < 0) continue;
        const x = HIT_X + (k - beat) * PX_PER_BEAT;
        const bar = Math.abs(k % song.meter.bpb) < 1e-9;
        const click = Math.abs((k % song.meter.bpb) % song.meter.click) < 1e-9;
        if (x < HIT_X - 12 || x > W) continue;
        g.fillStyle = bar ? PAL.beatTick : PAL.tick;
        if (click || bar) g.fillRect(Math.round(x), y - (bar ? 7 : 5), 1, bar ? 15 : 11);
      }
      // The hit marker, flashing when you tap.
      const tapped = t - run.tapAt[lane] < 0.08;
      sprite(g, TARGET, HIT_X - 4, y - 6, { X: tapped ? PAL.white : color });
      if (run.level.hands === 2) text(g, lane, HIT_X - 22, y - 2, color);
    }

    // Notes.
    for (const n of run.notes) {
      const x = HIT_X + ((n.time - t) / song.beatSec) * PX_PER_BEAT;
      if (x > W + 8) break;
      if (x < HIT_X - 30) continue;
      const y = run.lanes[n.lane];
      if (n.judged && n.judged !== 'miss') continue;
      const missed = n.judged === 'miss';
      const color = missed ? PAL.dim : n.lane === 'L' ? PAL.left : PAL.right;
      const light = missed ? PAL.tick : n.lane === 'L' ? PAL.leftLight : PAL.rightLight;
      const dark = missed ? PAL.lane : n.lane === 'L' ? PAL.leftDark : PAL.rightDark;
      sprite(g, NOTE, x - 4, y - 3 + (missed ? Math.round((t - n.missAt) * 20) : 0), { X: color, L: light, D: dark });
    }

    // The patient's heart, beating (bigger on each beat and when hit).
    const lanes = Object.values(run.lanes);
    const heartY = run.level.hands === 2 ? (lanes[0] + lanes[1]) / 2 : lanes[0];
    const f = beat - Math.floor(beat);
    const hit = Math.min(...Object.keys(run.lanes).map((l) => t - run.tapAt[l]));
    const big = beat >= 0 && (f < 0.12 || hit < 0.1);
    const hs = big ? 3 : 2;
    if (run.level.hands === 1) sprite(g, HEART, HIT_X - (9 * hs) / 2, heartY - (8 * hs) / 2 - 12, { H: PAL.heart, L: PAL.heartLight }, hs);
    else sprite(g, HEART, HIT_X - 27 - (9 * hs) / 2, heartY - (8 * hs) / 2, { H: PAL.heart, L: PAL.heartLight }, hs);

    // The doctor, tapping along.
    const tapping = hit < 0.12;
    sprite(g, DOCTOR[tapping ? 1 : 0], 6, 104 + (beat >= 0 && f > 0.5 ? 1 : 0), DOCTOR_COLORS, 2);

    // Particles and pop-up words.
    for (const p of run.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.life--;
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
    run.particles = run.particles.filter((p) => p.life > 0);
    const nowMs = performance.now();
    for (const pu of run.popups) {
      const age = (nowMs - pu.born) / 600;
      if (age > 1) continue;
      const y = run.lanes[pu.lane] - 14 - age * 10;
      text(g, pu.word, HIT_X + 26, y, pu.color, { shadow: PAL.night });
    }
    run.popups = run.popups.filter((pu) => nowMs - pu.born < 600);
    g.restore();

    // HUD: level, score, combo, health, progress.
    g.fillStyle = 'rgba(20,16,38,0.85)';
    g.fillRect(0, 0, W, 8);
    text(g, `${run.level.id} ${run.level.name}`, 2, 2, PAL.dim);
    text(g, String(Math.round(run.score)).padStart(6, '0'), W - 2, 2, PAL.text, { align: 'right' });
    if (run.combo >= 4) text(g, `${run.combo} COMBO`, W / 2, 12, run.combo >= 20 ? PAL.perfect : PAL.good, { align: 'center', shadow: PAL.night });
    // Health: a heart and a bar.
    sprite(g, HEART, 70, 132, { H: PAL.heart, L: PAL.heartLight });
    g.fillStyle = PAL.lane;
    g.fillRect(82, 134, 62, 5);
    g.fillStyle = run.health > 30 ? PAL.perfect : PAL.miss;
    g.fillRect(83, 135, Math.round(60 * (run.health / 100)), 3);
    // Progress through the song.
    g.fillStyle = PAL.trim;
    g.fillRect(150, 135, 100, 3);
    g.fillStyle = PAL.text;
    g.fillRect(150, 135, Math.max(0, Math.min(100, Math.round((t / song.length) * 100))), 3);

    // Count-in: big beat numbers, then GO.
    const countBeats = song.countInBars * song.meter.bpb;
    if (beat < countBeats + 0.6) {
      const clicks = Math.round(song.meter.bpb / song.meter.click);
      const k = Math.floor(beat / song.meter.click);
      const label = beat < 0 ? 'READY' : k < clicks ? String(k + 1) : 'GO!';
      text(g, label, W / 2 + 30, 44, PAL.text, { scale: 4, align: 'center', shadow: PAL.trim });
    }
  }

  // --------------------------------------------------------------- results

  function finish(failed) {
    run.ended = true;
    const r = grade(run.counts);
    const level = run.level;
    const passed = !failed && r.passed;
    const prev = gs().best[level.id];
    const isBest = !failed && (!prev || r.acc > prev.acc);
    if (isBest) gs().best[level.id] = { acc: r.acc, letter: r.letter };
    if (passed) gs().unlocked = Math.max(gs().unlocked, Math.min(LEVELS.length, level.id + 1));
    d.save();
    // Let the music ring out briefly, then stop.
    const audio = run.audio;
    setTimeout(() => audio.ctx.close().catch(() => {}), failed ? 300 : 900);
    // Final frame: the monitor flatlines if the patient was lost.
    drawMonitor(g, songTime() / run.song.beatSec, failed);

    $('game-pads').hidden = true;
    $('game-quit').hidden = true;
    $('game-results').hidden = false;
    $('game-grade').textContent = failed ? 'X' : r.letter;
    $('game-grade').className = `game-grade g-${failed ? 'X' : r.letter}`;
    $('game-verdict').textContent = failed ? 'FLATLINED! TRY AGAIN' : passed ? (isBest ? 'NEW BEST!' : 'PATIENT SAVED') : 'NEEDS MORE PRACTICE';
    $('game-acc').textContent = `${Math.round(r.acc * 100)}%`;
    $('game-counts').textContent = `PERFECT ${run.counts.perfect} · GOOD ${run.counts.good} · OK ${run.counts.ok} · MISS ${run.counts.miss}`;
    $('game-extra').textContent = `MAX COMBO ${run.maxCombo} · EARLY ${run.early} · LATE ${run.late}`;
    const hint = run.early > run.late * 2 && run.early > 3 ? 'You tend to rush: wait for the note to reach the heart.'
      : run.late > run.early * 2 && run.late > 3 ? 'You tend to be late: tap as the note touches the heart.'
        : run.counts.miss > run.counts.perfect ? 'Try listening to the drums and counting the beats.' : '';
    $('game-hint').textContent = hint;
    $('game-next').hidden = !passed || level.id >= LEVELS.length;
  }

  function endRun() {
    if (!run) return;
    run.ended = true;
    run.audio.ctx.close().catch(() => {});
    run = null;
  }

  // ----------------------------------------------------------------- input

  const press = (lane) => (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('down');
    input(lane, e);
  };
  const lift = (e) => e.currentTarget.classList.remove('down');
  for (const [id, lane] of [['game-left', 'L'], ['game-right', 'R'], ['game-one', 'R']]) {
    $(id).addEventListener('pointerdown', press(lane));
    $(id).addEventListener('pointerup', lift);
    $(id).addEventListener('pointercancel', lift);
    $(id).addEventListener('contextmenu', (e) => e.preventDefault());
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (!run) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    input(e.clientX - rect.left < rect.width / 2 ? 'L' : 'R', e);
  });
  document.addEventListener('keydown', (e) => {
    if (!active || e.repeat || e.target.closest?.('input, select, textarea')) return;
    if (!run) {
      if (e.code === 'Enter' && !$('game-menu').hidden) startLevel(LEVELS[selected]);
      return;
    }
    if (e.code === 'Escape') {
      endRun();
      showMenu();
      return;
    }
    const lane = LEFT_KEYS.has(e.code) ? 'L' : RIGHT_KEYS.has(e.code) ? 'R' : null;
    if (!lane) return;
    e.preventDefault();
    input(lane, e);
  });

  return {
    enter() {
      active = true;
      showMenu();
    },
    leave() {
      active = false;
      endRun();
      cancelAnimationFrame(idleRaf);
    },
    get busy() {
      return !!run;
    },
    stopIfRunning() {
      if (run) {
        endRun();
        showMenu();
      }
    },
  };
}
