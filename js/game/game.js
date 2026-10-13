// Beat Ward: a pixel-art rhythm game for reading rhythms. The music is on
// the doctor's clipboard as real sheet music, two lines of two bars that
// stay still like a printed page. Keep time with the drums and tap each
// note to play the tune; every hit blasts the germ boss. Later wards add a
// second staff for the left hand.

import { LEVELS, makeSong, judgeTap, grade, WINDOWS, SPEEDS, FULL_SPEED, nextSpeed } from './song.js?v=2.9';
import { W, H, PAL, text, sprite, HEART, DOCTOR, DOCTOR_COLORS, drawWard, drawMonitor, drawBoss, drawScene } from './art.js?v=2.9';
import { layoutScore, drawScore, engraveBar, drawStaff, drawBarline, drawClefAndTime } from './score.js?v=2.9';

const SCENE_H = 48; // the strip above the page: doctor, heart, boss
const PAGE = { x: 2, y: 50, w: 252, h: 156 };
const LINE_X0 = 8;
const LINE_X1 = 250;
// Each line of music (a system of two bars): its height, and where each
// staff's middle line sits in it. `lead` is how far below the top of the
// page a line starts, in lines, so the line you're playing stays in view
// as the page scrolls and the next is there to read ahead.
const LINE_ONE = { h: 46, staves: { R: 24 }, lead: 0.75 };
const LINE_TWO = { h: 66, staves: { R: 22, L: 50 }, lead: 0.88 };
const HOLD_FROM = 1; // notes this many beats or longer must be held
const HOLD_SHARE = 0.6; // ...for at least this share of their length (or all but 0.25 s, whichever is shorter)
const BARS_PER_LINE = 2;
const HEART_X = 42;
const BOSS_X = 226;
const BOSS_Y = 28;
const INK = '#1d1830';
const PAPER = '#f2e8cf';
const PAPER_EDGE = '#b9a57a';
const NOW_TINT = '#e8d9b0';
const JUDGED = { perfect: '#169c46', good: '#c48a00', ok: '#e06a0c', miss: '#e03131' };
const DAMAGE = { perfect: 1, good: 0.7, ok: 0.4 }; // same weights as the grade
const PASS = 0.65; // the boss has this share of a perfect run's damage as health
const GIMMICKS = {
  quake: 'Its attacks jolt the clipboard on every bar.',
  fog: 'Its attacks fog the next line until just before you play it: sight-read fast!',
  both: 'Its attacks jolt the clipboard and fog the next line.',
};
const LEFT_KEYS = new Set(['KeyF', 'KeyD', 'KeyS', 'ArrowLeft']);
const RIGHT_KEYS = new Set(['KeyJ', 'KeyK', 'KeyL', 'ArrowRight', 'Space', 'Enter']);

export function initGameView(d) {
  const { $, state } = d;
  state.game ||= { best: {}, offsetMs: 0 };
  const gs = () => state.game;
  // cleared: the fastest speed step each ward's boss has been beaten at.
  // speed: the step picked for each ward (it moves up after each win).
  if (!gs().cleared) {
    gs().cleared = {};
    // Older saves only knew which wards were unlocked: count those as cleared at full speed.
    for (let id = 1; id < (gs().unlocked || 1); id++) gs().cleared[id] = FULL_SPEED;
  }
  gs().speed ||= {};
  const speedOf = (id) => gs().speed[id] ?? nextSpeed(gs().cleared[id]);

  const canvas = $('game-canvas');
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;

  let active = false;
  let run = null;
  let idleRaf = null;
  // Start on the first ward not yet cleared at full speed.
  let selected = Math.max(0, LEVELS.findIndex((l) => !(gs().cleared[l.id] >= FULL_SPEED)));

  // ------------------------------------------------------------------ menu

  function renderMenu() {
    const list = $('game-levels');
    list.replaceChildren(
      ...LEVELS.map((lvl, i) => {
        const b = document.createElement('button');
        const best = gs().best[lvl.id];
        const cleared = gs().cleared[lvl.id];
        b.className = `game-level${i === selected ? ' sel' : ''}${cleared >= FULL_SPEED ? ' done' : ''}`;
        b.innerHTML = `<span class="gl-num">${cleared >= FULL_SPEED ? '✓' : lvl.id}</span><span class="gl-name"></span><span class="gl-best"></span>`;
        b.querySelector('.gl-name').textContent = lvl.name + (lvl.hands === 2 ? ' ✋✋' : '');
        b.querySelector('.gl-best').textContent = best ? `${best.letter}${cleared != null ? ` @${Math.round(SPEEDS[cleared] * 100)}%` : ''}` : '';
        b.addEventListener('click', () => {
          selected = i;
          renderMenu();
        });
        b.addEventListener('dblclick', () => startLevel(LEVELS[i]));
        return b;
      }),
    );
    const lvl = LEVELS[selected];
    const sp = speedOf(lvl.id);
    $('game-speeds').replaceChildren(
      ...SPEEDS.map((v, k) => {
        const b = document.createElement('button');
        b.className = `game-btn game-speed${k === sp ? ' sel' : ''}${gs().cleared[lvl.id] >= k ? ' done' : ''}`;
        b.textContent = `${Math.round(v * 100)}%`;
        b.title = gs().cleared[lvl.id] >= k ? 'Cleared at this speed' : '';
        b.addEventListener('click', () => {
          gs().speed[lvl.id] = k;
          d.save();
          renderMenu();
        });
        return b;
      }),
    );
    $('game-blurb').textContent = `${lvl.blurb} ${Math.round(lvl.bpm * SPEEDS[sp])} BPM · ${lvl.meter}${lvl.hands === 2 ? ' · TWO HANDS' : ''}. BOSS: ${lvl.boss.name}. ${GIMMICKS[lvl.boss.gimmick] || ''}`;
    $('game-offset').textContent = `${gs().offsetMs > 0 ? '+' : ''}${gs().offsetMs} ms`;
  }

  $('game-play').addEventListener('click', () => startLevel(LEVELS[selected]));
  $('game-retry').addEventListener('click', () => startLevel(run?.level || LEVELS[selected]));
  $('game-next').addEventListener('click', () => {
    // After a win below full speed, go again faster; otherwise on to the next ward.
    if (!(gs().cleared[LEVELS[selected].id] >= FULL_SPEED)) return startLevel(LEVELS[selected]);
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
    document.body.classList.remove('game-playing');
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
      sprite(g, HEART, 64 - (9 * pulse) / 2, 82 - (8 * pulse) / 2, { H: PAL.heart, L: PAL.heartLight }, pulse);
      sprite(g, DOCTOR[beat % 2 < 1 ? 0 : 1], 14, 104 + (beat % 1 < 0.5 ? 0 : 1), DOCTOR_COLORS, 2);
      text(g, 'BEAT WARD', 160, 64, PAL.text, { scale: 3, align: 'center', shadow: PAL.trim });
      text(g, 'A RHYTHM CLINIC', 160, 84, PAL.dim, { align: 'center' });
      const boss = LEVELS[selected].boss;
      const bob = beat % 1 < 0.5 ? 0 : 1;
      if (boss.twin) {
        drawBoss(g, boss, 196, 114 + bob, { frame: Math.floor(beat) });
        drawBoss(g, boss, 234, 114 - bob, { frame: Math.floor(beat) + 1 });
      } else drawBoss(g, boss, 222, (boss.scale === 3 ? 108 : 114) + bob, { frame: Math.floor(beat) });
      text(g, 'VS', 178, 100, PAL.miss, { shadow: PAL.night });
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
      /** A note that sounds until released (at most a few seconds). */
      voice(t, midi, low) {
        const gn = ctx.createGain();
        gn.gain.setValueAtTime(0.0001, t);
        gn.gain.exponentialRampToValueAtTime(low ? 0.09 : 0.08, t + 0.005);
        gn.gain.setTargetAtTime(low ? 0.05 : 0.045, t + 0.04, 0.15);
        gn.connect(master);
        const oscs = low
          ? [[hz(midi), 'square', 0.6], [hz(midi) / 2, 'triangle', 2.5]]
          : [[hz(midi), 'square', 1], [hz(midi) * 1.004, 'square', 0.5]];
        const nodes = oscs.map(([f, type, level]) => {
          const o = ctx.createOscillator();
          o.type = type;
          o.frequency.value = f;
          const lv = ctx.createGain();
          lv.gain.value = level;
          o.connect(lv).connect(gn);
          o.start(t);
          o.stop(t + 4);
          return o;
        });
        let done = false;
        return {
          release(at) {
            if (done) return;
            done = true;
            gn.gain.cancelScheduledValues(at);
            gn.gain.setTargetAtTime(0.0001, at, 0.03);
            for (const o of nodes) o.stop(at + 0.25);
          },
        };
      },
      lead(t, midi, dur) {
        tone(t, hz(midi), 'square', 0.07, Math.min(0.45, Math.max(0.12, dur)));
        tone(t, hz(midi) * 1.004, 'square', 0.035, Math.min(0.45, Math.max(0.12, dur)));
      },
      low(t, midi, dur) {
        tone(t, hz(midi), 'square', 0.06, Math.min(0.4, Math.max(0.15, dur)));
        tone(t, hz(midi) / 2, 'triangle', 0.2, Math.min(0.5, Math.max(0.2, dur)));
      },
      ko(t) {
        [76, 72, 67, 64, 60, 55].forEach((m, i) => tone(t + i * 0.07, hz(m), 'square', 0.08, 0.12));
        noiseHit(t, 0.3, 0.6, 'lowpass', 900);
      },
      warn(t) {
        tone(t, 880, 'square', 0.05, 0.08);
        tone(t + 0.12, 880, 'square', 0.05, 0.08);
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
    selected = LEVELS.indexOf(level);
    const speedStep = speedOf(level.id);
    const song = makeSong(level, Date.now(), { speed: SPEEDS[speedStep] });
    const startAt = audio.ctx.currentTime + 0.6;
    for (const x of song.drums) audio[x.type](startAt + x.time);
    for (const x of song.bass) audio.bass(startAt + x.time, x.midi, x.dur * song.beatSec);
    // A soft chord on every bar under the tune.
    song.chords.forEach((c) => {
      const t = startAt + (song.countInBars + c.bar) * song.meter.bpb * song.beatSec;
      audio.pad(t, c.tones.map((x) => 60 + level.key + x), song.meter.bpb * song.beatSec * 0.95);
    });
    // A warning siren a bar before each boss attack (the choruses).
    attackBars(song).forEach((b, i, all) => {
      if (i === 0 || all[i - 1] !== b - 1) audio.warn(startAt + (song.countInBars + b - 1) * song.meter.bpb * song.beatSec);
    });
    const layout = level.hands === 2 ? LINE_TWO : LINE_ONE;
    const staves = layout.staves;
    run = {
      level,
      song,
      speedStep,
      line: layout,
      holding: { L: null, R: null },
      voices: { L: null, R: null },
      short: 0,
      pageBars: engravePage(song, Object.keys(staves)),
      bossHp: PASS * song.notes.length,
      damage: 0,
      koAt: null,
      bolts: [],
      bossFlash: 0,
      audio,
      startAt,
      latency: (audio.ctx.outputLatency || 0) + (audio.ctx.baseLatency || 0),
      notes: song.notes.map((n) => ({ ...n })),
      lanes: staves,
      counts: { perfect: 0, good: 0, ok: 0, miss: 0, extra: 0 },
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
    document.body.classList.add('game-playing'); // full screen in landscape
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
      run.health = Math.max(0, run.health - (inAttack(n.beat) ? 12 : 9));
      run.shake = 4;
      popup(n.lane, 'MISS', PAL.miss);
      run.audio.miss(run.audio.ctx.currentTime);
    }
    for (const lane of ['L', 'R']) {
      const h = run.holding[lane];
      if (h && !h.note.holdOk && t - h.note.pressAt >= holdNeeded(h.note)) h.note.holdOk = true;
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
    const now = run.audio.ctx.currentTime;
    run.voices[lane]?.release(now);
    if (!r) {
      run.voices[lane] = null;
      run.holding[lane] = null;
      // A tap with no note to play is an extra: it breaks the combo, hurts the
      // patient a little and heals the boss, so mashing doesn't pay. Taps
      // during the count-in are fine.
      if (t > run.song.countInBars * run.song.meter.bpb * run.song.beatSec - 0.3) {
        run.counts.extra++;
        run.combo = 0;
        run.health = Math.max(0, run.health - 4);
        run.damage = Math.max(0, run.damage - 0.5);
        popup(lane, 'EXTRA', PAL.miss);
      }
      return;
    }
    const n = r.note;
    n.judged = r.judgement;
    n.pressAt = t;
    // You play the music: the note sounds for as long as you hold it.
    run.voices[lane] = run.audio.voice(now, n.midi, lane === 'L');
    run.holding[lane] = { note: n };
    if (!holdNeeded(n)) n.holdOk = true;
    run.counts[r.judgement]++;
    run.combo++;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    run.score += { perfect: 300, good: 150, ok: 60 }[r.judgement] * (1 + Math.min(run.combo, 50) / 50);
    run.health = Math.min(100, run.health + (r.judgement === 'perfect' ? 3 : r.judgement === 'good' ? 1.5 : 0.5));
    run.damage += DAMAGE[r.judgement];
    run.bolts.push({ lane, x: HEART_X + 10, color: PAL[r.judgement], big: r.judgement === 'perfect' });
    if (run.koAt == null && run.damage >= run.bossHp - 1e-9) {
      run.koAt = t;
      run.shake = 6;
      run.audio.ko(run.audio.ctx.currentTime);
      for (const [x, y] of bossSpots()) burstAt(x, y, 40, run.level.boss.body);
    }
    if (r.judgement !== 'perfect') r.offset < 0 ? run.early++ : run.late++;
    const word = r.judgement === 'perfect' ? 'PERFECT' : `${r.judgement === 'good' ? 'GOOD' : 'OK'} ${r.offset < 0 ? 'EARLY' : 'LATE'}`;
    popup(lane, word, PAL[r.judgement]);
    burstAt(HEART_X, BOSS_Y, r.judgement === 'perfect' ? 14 : 8, lane === 'L' ? PAL.left : PAL.right);
  }

  function popup(lane, word, color) {
    run.popups = run.popups.filter((p) => p.lane !== lane);
    run.popups.push({ lane, word, color, born: performance.now() });
  }

  function burstAt(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const v = 0.6 + Math.random() * 1.2;
      run.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.4, life: 24, color });
    }
  }

  /**
   * Lay out every bar of the song as it sits on the page: two bars to a
   * line, a clef at the start of each line (and the time signature on the
   * first), notes engraved and justified, both hands aligned.
   */
  function engravePage(song, lanes) {
    const { bpb } = song.meter;
    const out = [];
    for (let b = 0; b < song.bars; b++) {
      const start = (song.countInBars + b) * bpb;
      const line = Math.floor(b / BARS_PER_LINE);
      const clefW = line === 0 ? 17 : 8;
      const x0 = LINE_X0 + 3 + clefW + 3;
      const w = (LINE_X1 - x0) / BARS_PER_LINE;
      const x = x0 + (b % BARS_PER_LINE) * w;
      const events = Object.fromEntries(lanes.map((l) => [l, song.score[l].filter((e) => e.beat >= start - 1e-9 && e.beat < start + bpb - 1e-9)]));
      out.push({
        bar: b,
        line,
        start,
        x,
        w,
        xOf: engraveBar(Object.values(events), start, bpb, x, w),
        layouts: Object.fromEntries(lanes.map((l) => [l, layoutScore(events[l], bpb)])),
      });
    }
    return out;
  }

  /**
   * How far the page has scrolled, in lines: it moves up steadily, one
   * line for every line of music played.
   */
  function scrollPosition(beat) {
    const { bpb } = run.song.meter;
    const pos = (beat - run.song.countInBars * bpb) / (bpb * BARS_PER_LINE);
    return pos - run.line.lead;
  }

  /** Bars (counting from the first after the count-in) where the boss attacks. */
  function attackBars(song) {
    return song.sections.map((sec, b) => (sec === 'chorus' ? b : -1)).filter((b) => b >= 0);
  }

  function barAt(beat) {
    return Math.floor(beat / run.song.meter.bpb + 1e-9) - run.song.countInBars;
  }

  function inAttack(beat) {
    return run.song.sections[barAt(beat)] === 'chorus';
  }

  /**
   * Under the staff, once you've played a note: a bar showing how long you
   * held it (red where a long note was let go too soon).
   */
  function drawHeld(pb, lane, y, t) {
    const { beatSec } = run.song;
    const barEnd = pb.start + run.song.meter.bpb;
    for (const n of run.notes) {
      if (n.lane !== lane || n.pressAt == null || n.beat < pb.start - 1e-9 || n.beat >= barEnd - 1e-9) continue;
      const until = n.releaseAt ?? t;
      const b0 = n.pressAt / beatSec;
      const b1 = Math.min(until / beatSec, n.beat + n.dur, barEnd);
      const x0 = Math.round(pb.xOf(Math.max(pb.start, b0)));
      const x1 = Math.round(pb.xOf(Math.max(b0, b1)));
      g.fillStyle = JUDGED[n.judged] || INK;
      g.fillRect(x0 - 2, y, Math.max(2, x1 - x0 + 2), 2);
      if (n.short) {
        // The part of the note that should still have been held.
        const xe = Math.round(pb.xOf(Math.min(n.beat + n.dur, barEnd)));
        g.fillStyle = JUDGED.miss;
        for (let x = x1 + 1; x < xe - 2; x += 2) g.fillRect(x, y, 1, 2);
      }
    }
  }

  /** How long a note must be held, in seconds (0 for short notes, which can just be tapped). */
  function holdNeeded(n) {
    if (n.dur < HOLD_FROM - 1e-9) return 0;
    const sec = n.dur * run.song.beatSec;
    return Math.min(sec * HOLD_SHARE, sec - 0.25);
  }

  /** Letting go of a note: check it was held long enough. */
  function release(lane, e) {
    if (!run || run.ended) return;
    if (run.level.hands === 1) lane = 'R';
    const ago = e?.timeStamp != null ? Math.min(0.2, Math.max(0, performance.now() - e.timeStamp) / 1000) : 0;
    const t = songTime() - ago;
    run.voices[lane]?.release(run.audio.ctx.currentTime);
    run.voices[lane] = null;
    const h = run.holding[lane];
    run.holding[lane] = null;
    if (!h) return;
    const n = h.note;
    n.releaseAt = t;
    if (n.holdOk || t - n.pressAt >= holdNeeded(n)) return;
    // Let go too soon: the hit drops a grade.
    n.short = true;
    run.short++;
    const worse = n.judged === 'perfect' ? 'good' : 'ok';
    run.counts[n.judged]--;
    run.counts[worse]++;
    run.damage -= DAMAGE[n.judged] - DAMAGE[worse];
    n.judged = worse;
    popup(lane, 'TOO SHORT', PAL.ok);
  }

  /** Where the boss is drawn: one germ, or twins side by side. */
  function bossSpots() {
    return run.level.boss.twin ? [[208, BOSS_Y + 1], [238, BOSS_Y - 1]] : [[BOSS_X, BOSS_Y]];
  }

  // ---------------------------------------------------------------- render

  function render(t) {
    const { song, level } = run;
    const boss = level.boss;
    const { bpb } = song.meter;
    const beat = t / song.beatSec;
    const bar = barAt(beat);
    const attack = beat >= 0 && inAttack(beat);
    const nextAttack = !attack && beat >= 0 && song.sections[bar + 1] === 'chorus';
    const quake = boss.gimmick === 'quake' || boss.gimmick === 'both';
    const fog = boss.gimmick === 'fog' || boss.gimmick === 'both' ? boss.fog : 0;
    const ko = run.koAt != null;

    // ---- the page: lines of music scrolling steadily up, the one you're
    // playing near the top and the next coming up beneath it.
    const lines = Math.ceil(song.bars / BARS_PER_LINE);
    const curLine = Math.max(0, Math.min(lines - 1, Math.floor(Math.max(0, bar) / BARS_PER_LINE)));
    const scroll = scrollPosition(beat);
    const SLOT_H = run.line.h;
    let jolt = 0;
    if (quake && attack && (beat % bpb) < 0.2) jolt = Math.round((Math.random() - 0.5) * 4);
    g.fillStyle = PAPER_EDGE;
    g.fillRect(0, PAGE.y - 2, W, H - PAGE.y + 2);
    g.fillStyle = PAPER;
    g.fillRect(PAGE.x, PAGE.y + jolt, PAGE.w, PAGE.h);
    const colorOf = (gl) => {
      if (gl?.noteId != null) {
        const j = run.notes[gl.noteId].judged;
        if (j) return JUDGED[j];
      }
      return INK;
    };
    g.save();
    g.beginPath();
    g.rect(PAGE.x, PAGE.y + jolt, PAGE.w, PAGE.h);
    g.clip();
    for (let line = Math.floor(scroll); line <= Math.floor(scroll) + 4; line++) {
      if (line < 0 || line >= lines) continue;
      const top = Math.round(PAGE.y + (line - scroll) * SLOT_H) + jolt;
      const bars = run.pageBars.filter((pb) => pb.line === line);
      const lineStart = bars[0].start;
      // The bar you're in gets a soft highlight, so you don't lose your place.
      for (const pb of bars) {
        if (pb.bar === bar) {
          g.fillStyle = NOW_TINT;
          g.fillRect(Math.round(pb.x), top + 2, Math.round(pb.w), SLOT_H - 4);
        }
      }
      const ys = Object.entries(run.lanes).map(([lane, dy]) => [lane, top + dy]);
      for (const [lane, y] of ys) {
        drawStaff(g, LINE_X0, LINE_X1, y, INK);
        const clefColor = level.hands === 2 ? (lane === 'L' ? PAL.leftDark : PAL.rightDark) : INK;
        drawClefAndTime(g, LINE_X0 + 3, y, clefColor, song.meter.id, line === 0);
        for (const pb of bars) {
          drawScore(g, pb.layouts[lane], y, pb.xOf, colorOf);
          drawBarline(g, Math.round(pb.x + pb.w), y, INK, pb.bar === song.bars - 1);
          drawHeld(pb, lane, y + 11, t);
        }
      }
      // Lines that start the system: one joining the staves, and a brace for two hands.
      g.fillStyle = INK;
      g.fillRect(LINE_X0, ys[0][1] - 8, 1, ys.at(-1)[1] - ys[0][1] + 17);
      if (ys.length > 1) {
        g.fillRect(LINE_X0 - 3, ys[0][1] - 8, 2, ys.at(-1)[1] - ys[0][1] + 17);
        for (const pb of bars) g.fillRect(Math.round(pb.x + pb.w), ys[0][1] + 8, 1, ys.at(-1)[1] - ys[0][1] - 16);
      }
      // Boss fog: the next line stays hidden until just before you reach it.
      if (fog && line > curLine && inAttack(lineStart) && beat < lineStart - fog) {
        for (let yy = top + 1; yy < top + SLOT_H - 1; yy++) {
          for (let xx = PAGE.x; xx < PAGE.x + PAGE.w; xx++) {
            g.fillStyle = (xx * 7 + yy * 3 + Math.floor(beat * 4)) % 11 === 0 ? '#7d6fa8' : (xx + yy) % 2 ? '#4a3f78' : '#3b3260';
            g.fillRect(xx, yy, 1, 1);
          }
        }
        text(g, `${boss.name} FOG!`, W / 2, top + SLOT_H / 2 - 2, PAL.text, { align: 'center' });
      }
    }
    g.restore();

    // ---- the scene above the page.
    g.save();
    g.beginPath();
    g.rect(0, 0, W, SCENE_H);
    g.clip();
    if (run.shake > 0) {
      g.translate(Math.round((Math.random() - 0.5) * run.shake), Math.round((Math.random() - 0.5) * run.shake));
      run.shake *= 0.85;
      if (run.shake < 0.5) run.shake = 0;
    }
    drawScene(g, beat, SCENE_H);
    if (attack) {
      g.fillStyle = beat % 1 < 0.15 ? 'rgba(255,40,80,0.28)' : 'rgba(255,40,80,0.14)';
      g.fillRect(0, 0, W, SCENE_H);
    }
    // The patient's heart, beating with the music and when you hit a note.
    const f = beat - Math.floor(beat);
    const hit = Math.min(t - run.tapAt.L, t - run.tapAt.R);
    const hs = beat >= 0 && (f < 0.12 || hit < 0.1) ? 3 : 2;
    sprite(g, HEART, HEART_X - (9 * hs) / 2, BOSS_Y - (8 * hs) / 2, { H: PAL.heart, L: PAL.heartLight }, hs);
    sprite(g, DOCTOR[hit < 0.12 ? 1 : 0], 6, 14 + (beat >= 0 && f > 0.5 ? 1 : 0), DOCTOR_COLORS, 2);
    // Your shots flying at the boss.
    const bossLeft = (boss.twin ? 208 : BOSS_X) - 16;
    for (const b of run.bolts) {
      b.x += 7;
      const y = BOSS_Y + (b.lane === 'L' ? 3 : -2);
      g.fillStyle = b.color;
      g.fillRect(Math.round(b.x), y, b.big ? 6 : 4, b.big ? 3 : 2);
      g.fillStyle = PAL.white;
      g.fillRect(Math.round(b.x) + (b.big ? 4 : 2), y, 2, 1);
    }
    if (run.bolts.some((b) => b.x >= bossLeft) && !ko) run.bossFlash = 3;
    run.bolts = run.bolts.filter((b) => b.x < bossLeft);
    // The boss.
    const mood = ko ? 'ko' : run.bossFlash > 0 ? 'hurt' : attack || nextAttack ? 'angry' : 'idle';
    bossSpots().forEach(([bx, by], i) => {
      const bob = ko ? Math.round(Math.sin(t * 3 + i) * 2) : beat >= 0 && (beat + i * 0.5) % 1 < 0.5 ? 0 : 1;
      const jitter = attack && !ko ? Math.round((Math.random() - 0.5) * 2) : 0;
      drawBoss(g, boss, bx + jitter, by + bob, { frame: Math.floor(beat * (attack ? 2 : 1)) + i, mood, flash: run.bossFlash === 3 && !ko, scale: 2 });
    });
    if (run.bossFlash > 0) run.bossFlash--;
    if (ko && t - run.koAt < 3) {
      for (let k = 0; k < 3; k++) {
        const age = ((t - run.koAt) * 1.5 + k / 3) % 1;
        g.fillStyle = 'rgba(200,200,220,0.5)';
        g.fillRect(BOSS_X - 6 + k * 6, BOSS_Y - 14 - age * 10, 3, 3);
      }
    }
    for (const p of run.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.life--;
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
    run.particles = run.particles.filter((p) => p.life > 0);
    g.restore();

    // Judgement words, one per hand.
    const nowMs = performance.now();
    for (const pu of run.popups) {
      const age = (nowMs - pu.born) / 600;
      if (age > 1) continue;
      const x = level.hands === 2 ? (pu.lane === 'L' ? 100 : 156) : 128;
      text(g, pu.word, x, 34 - Math.round(age * 3), pu.color, { align: 'center', shadow: PAL.night });
    }
    run.popups = run.popups.filter((pu) => nowMs - pu.born < 600);

    // HUD: level and score; combo; health bars; progress.
    g.fillStyle = 'rgba(20,16,38,0.85)';
    g.fillRect(0, 0, W, 8);
    text(g, `${level.id} ${level.name}`, 2, 2, PAL.dim);
    text(g, String(Math.round(run.score)).padStart(6, '0'), W - 2, 2, PAL.text, { align: 'right' });
    if (run.combo >= 4) text(g, `${run.combo} COMBO`, 60, 11, run.combo >= 20 ? PAL.perfect : PAL.good, { shadow: PAL.night });
    text(g, ko ? `${boss.name} KO!` : boss.name, 202, 11, ko ? PAL.perfect : boss.light, { align: 'right', shadow: PAL.night });
    g.fillStyle = PAL.lane;
    g.fillRect(60, 41, 62, 5);
    g.fillStyle = run.health > 30 ? PAL.perfect : PAL.miss;
    g.fillRect(61, 42, Math.round(60 * (run.health / 100)), 3);
    g.fillStyle = PAL.lane;
    g.fillRect(140, 41, 62, 5);
    g.fillStyle = boss.body;
    const hpLeft = Math.max(0, 1 - run.damage / run.bossHp);
    g.fillRect(141 + Math.round(60 * (1 - hpLeft)), 42, Math.round(60 * hpLeft), 3);
    g.fillStyle = PAL.trim;
    g.fillRect(0, SCENE_H, W, 1);
    g.fillStyle = PAL.text;
    g.fillRect(0, SCENE_H, Math.max(0, Math.min(W, Math.round((t / song.length) * W))), 1);

    // Banners: count-in, attack warnings, the knockout.
    const countBeats = song.countInBars * bpb;
    if (beat < countBeats + 0.6) {
      const clicks = Math.round(bpb / song.meter.click);
      const k = Math.floor(beat / song.meter.click);
      const label = beat < 0 ? 'READY' : k < clicks ? String(k + 1) : 'GO!';
      text(g, label, 128, 16, PAL.text, { scale: 3, align: 'center', shadow: PAL.trim });
    } else if (ko && t - run.koAt < 2.5) {
      text(g, 'BOSS DOWN!', 128, 18, PAL.perfect, { scale: 2, align: 'center', shadow: PAL.night });
    } else if (nextAttack && beat % 1 < 0.6) {
      text(g, '! ATTACK !', 128, 18, PAL.miss, { scale: 2, align: 'center', shadow: PAL.night });
    }
  }

  // --------------------------------------------------------------- results

  function finish(failed) {
    run.ended = true;
    const r = grade(run.counts);
    const level = run.level;
    for (const lane of ['L', 'R']) release(lane);
    const bossDown = run.koAt != null || run.damage >= run.bossHp - 1e-9;
    const passed = !failed && bossDown;
    const prev = gs().best[level.id];
    const isBest = !failed && (!prev || r.acc > prev.acc);
    if (isBest) gs().best[level.id] = { acc: r.acc, letter: r.letter };
    let fasterNext = false;
    if (passed) {
      const prevCleared = gs().cleared[level.id];
      if (prevCleared == null || run.speedStep > prevCleared) gs().cleared[level.id] = run.speedStep;
      // Speed up for next time (until full speed; beyond that it's the player's choice).
      if (run.speedStep < FULL_SPEED) {
        gs().speed[level.id] = run.speedStep + 1;
        fasterNext = true;
      }
    }
    d.save();
    // Let the music ring out briefly, then stop.
    const audio = run.audio;
    setTimeout(() => audio.ctx.close().catch(() => {}), failed ? 300 : 900);
    // Final frame: the monitor flatlines if the patient was lost.

    $('game-pads').hidden = true;
    $('game-quit').hidden = true;
    $('game-results').hidden = false;
    $('game-grade').textContent = failed ? 'X' : r.letter;
    $('game-grade').className = `game-grade g-${failed ? 'X' : r.letter}`;
    const name = level.boss.name;
    $('game-verdict').textContent = failed ? `FLATLINED! ${name} WINS` : passed ? `${name} DEFEATED!${isBest ? ' NEW BEST' : ''}` : `${name} GOT AWAY (${Math.round((1 - run.damage / run.bossHp) * 100)}% HP LEFT)`;
    $('game-acc').textContent = `${Math.round(r.acc * 100)}% AT ${Math.round(SPEEDS[run.speedStep] * 100)}% SPEED`;
    $('game-counts').textContent = `PERFECT ${run.counts.perfect} · GOOD ${run.counts.good} · OK ${run.counts.ok} · MISS ${run.counts.miss} · EXTRA ${run.counts.extra}`;
    $('game-extra').textContent = `MAX COMBO ${run.maxCombo} · EARLY ${run.early} · LATE ${run.late} · TOO SHORT ${run.short}`;
    const hint = fasterNext ? `Next time: ${Math.round(SPEEDS[run.speedStep + 1] * 100)}% speed.`
      : run.counts.extra > 5 ? 'Extra taps cost you: only tap the notes that are written.'
      : run.short > 3 && run.short > (run.early + run.late) / 2 ? 'Hold long notes for their full value: count through them.'
      : run.early > run.late * 2 && run.early > 3 ? 'You tend to rush: count steadily with the drums.'
        : run.late > run.early * 2 && run.late > 3 ? 'You tend to be late: read a beat ahead so you are ready.'
          : run.counts.miss > run.counts.perfect ? (run.speedStep > 0 ? 'Try a slower speed from the menu, and count the beats.' : 'Count the beats with the drums, and read ahead.') : '';
    $('game-hint').textContent = hint;
    $('game-next').hidden = !passed || (!fasterNext && level.id >= LEVELS.length);
    $('game-next').textContent = fasterNext ? 'FASTER ▶' : 'NEXT WARD';
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
  const lift = (lane) => (e) => {
    e.currentTarget.classList.remove('down');
    release(lane, e);
  };
  for (const [id, lane] of [['game-left', 'L'], ['game-right', 'R'], ['game-one', 'R']]) {
    $(id).addEventListener('pointerdown', (e) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      press(lane)(e);
    });
    $(id).addEventListener('pointerup', lift(lane));
    $(id).addEventListener('pointercancel', lift(lane));
    $(id).addEventListener('contextmenu', (e) => e.preventDefault());
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (!run) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const lane = e.clientX - rect.left < rect.width / 2 ? 'L' : 'R';
    canvasLanes.set(e.pointerId, lane);
    canvas.setPointerCapture?.(e.pointerId);
    input(lane, e);
  });
  const canvasLanes = new Map();
  const canvasUp = (e) => {
    const lane = canvasLanes.get(e.pointerId);
    canvasLanes.delete(e.pointerId);
    if (lane) release(lane, e);
  };
  canvas.addEventListener('pointerup', canvasUp);
  canvas.addEventListener('pointercancel', canvasUp);
  document.addEventListener('keyup', (e) => {
    if (!active || !run) return;
    const lane = LEFT_KEYS.has(e.code) ? 'L' : RIGHT_KEYS.has(e.code) ? 'R' : null;
    if (lane) release(lane, e);
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
      document.body.classList.remove('game-playing');
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
