// Beat Ward's notation, drawn in pixels like a printed part: heads, stems,
// flags, beams, dots, ties, tuplet numbers and rests on a five-line staff,
// with engraved spacing (longer notes get more room, but not in proportion
// to their length) and bars justified across the line.

const EPS = 1e-6;

/** The note value as printed (tuplets and dots aside), in quarters. */
export function writtenValue(e) {
  if (e.written) return e.written;
  if (e.dots === 2) return e.beats / 1.75;
  if (e.dotted) return e.beats / 1.5;
  return e.beats;
}

/** Beams (or flags) for a written value: 1 for eighths, 2 sixteenths, 3 thirty-seconds. */
export function beamCount(v) {
  if (v <= 0.125 + EPS) return 3;
  if (v <= 0.25 + EPS) return 2;
  if (v <= 0.5 + EPS) return 1;
  return 0;
}

/**
 * Work out how one bar of one hand's score is drawn. Positions are in
 * beats; `engraveBar` turns them into pixels.
 * @returns {{glyphs, beams, tuplets}}
 *   glyphs: [{beat, rest, value, dots, flags, noteId, tieTo, barRest}]
 *   beams: [{from, to, level}] (stem to stem), or a stub {from, to} only 1 beat-pixel wide
 *   tuplets: [{from, to, n, bracket}]
 */
export function layoutScore(events, bpb) {
  const glyphs = events.map((e) => ({
    beat: e.barRest ? e.beat + bpb / 2 : e.beat,
    rest: !!e.rest,
    barRest: !!e.barRest,
    value: e.barRest ? 4 : writtenValue(e),
    dots: e.barRest ? 0 : e.dots || (e.dotted ? 1 : 0),
    flags: 0,
    noteId: e.noteId,
    tied: !!e.tied, // continues the note before (no new press)
    tieTo: null,
    tieOut: false, // tied across the bar line to the next bar's first note
  }));
  events.forEach((e, i) => {
    if (e.tieNext && events[i + 1]) glyphs[i].tieTo = i + 1;
    else if (e.tieNext) glyphs[i].tieOut = true;
  });

  // Beam groups: neighbouring notes of a cell marked for beaming, broken by rests.
  const beams = [];
  const groups = [];
  let cur = null;
  events.forEach((e, i) => {
    const beamable = !e.rest && e.beamGroup != null && beamCount(glyphs[i].value) > 0;
    if (beamable && cur && cur.id === e.beamGroup) cur.idx.push(i);
    else {
      cur = beamable ? { id: e.beamGroup, idx: [i] } : null;
      if (cur) groups.push(cur);
    }
  });
  const beamed = new Set();
  for (const grp of groups) {
    if (grp.idx.length < 2) continue;
    grp.idx.forEach((i) => beamed.add(i));
    const heads = grp.idx.map((i) => glyphs[i]);
    beams.push({ from: heads[0].beat, to: heads.at(-1).beat, level: 1 });
    const levels = heads.map((h) => beamCount(h.value));
    for (let level = 2; level <= 3; level++) {
      for (let k = 0; k < heads.length; ) {
        if (levels[k] < level) {
          k++;
          continue;
        }
        let j = k;
        while (j + 1 < heads.length && levels[j + 1] >= level) j++;
        if (j > k) beams.push({ from: heads[k].beat, to: heads[j].beat, level });
        else {
          // A lone sixteenth gets a stub pointing at the note it pairs with.
          const v = heads[k].value;
          const left = k > 0 && (k === heads.length - 1 || heads[k].beat % (2 * v) >= v - EPS);
          beams.push({ from: heads[k].beat, to: heads[k].beat, level, stub: left ? 'left' : 'right' });
        }
        k = j + 1;
      }
    }
  }
  glyphs.forEach((gl, i) => {
    if (!gl.rest && !beamed.has(i)) gl.flags = beamCount(gl.value);
  });

  // Tuplets: a number over the beam, or a bracket when the group isn't one beam.
  const tuplets = [];
  const byId = new Map();
  events.forEach((e, i) => {
    if (!e.tuplet) return;
    const key = e.tupletId ?? `${e.beat}`;
    if (!byId.has(key)) byId.set(key, []);
    byId.get(key).push(i);
  });
  for (const idx of byId.values()) {
    const all = idx.every((i) => beamed.has(i)) && new Set(idx.map((i) => events[i].beamGroup)).size === 1;
    tuplets.push({ from: glyphs[idx[0]].beat, to: glyphs[idx.at(-1)].beat, n: events[idx[0]].tuplet, bracket: !all });
  }
  return { glyphs, beams, tuplets };
}

// -------------------------------------------------------------- drawing

/** Staff line spacing in pixels. */
export const GAP = 4;
const STEM = 13; // stem length in pixels (about 3.5 spaces)

/** Natural width given to a note or rest that lasts `d` quarters before the next one starts. */
function naturalWidth(d) {
  return 6 + 10 * Math.sqrt(d);
}

/**
 * Engraved spacing for one bar, shared by every hand so notes that sound
 * together line up. Widths grow with duration (but less than in
 * proportion), then the bar is justified to fill `width`.
 * @param barEvents arrays of events (one per hand) in this bar
 * @returns beat -> x (beats between onsets are interpolated)
 */
export function engraveBar(barEvents, barStart, bpb, x, width, { padLeft = 6, padRight = 3 } = {}) {
  const onsets = [...new Set(barEvents.flat().filter((e) => !e.barRest).map((e) => +(e.beat - barStart).toFixed(6)))].sort((a, b) => a - b);
  if (!onsets.length || onsets[0] > EPS) onsets.unshift(0);
  const widths = onsets.map((o, i) => naturalWidth((onsets[i + 1] ?? bpb) - o));
  const total = widths.reduce((a, b) => a + b, 0);
  const k = (width - padLeft - padRight) / total;
  const knots = [];
  let cx = x + padLeft;
  onsets.forEach((o, i) => {
    knots.push([o, cx]);
    cx += widths[i] * k;
  });
  knots.push([bpb, x + width - padRight]);
  return (beat) => {
    const b = beat - barStart;
    for (let i = 0; i < knots.length - 1; i++) {
      const [b0, x0] = knots[i];
      const [b1, x1] = knots[i + 1];
      if (b <= b1 + EPS) return x0 + ((x1 - x0) * Math.max(0, b - b0)) / (b1 - b0 || 1);
    }
    return knots.at(-1)[1];
  };
}
const QUARTER_REST = ['X..', '.X.', '.XX', 'XXX', 'XX.', '.X.', '..X', '.XX', 'XX.', 'X..', '.X.'];
const EIGHTH_REST = ['XX..X', 'XXXX.', '...X.', '..X..', '..X..', '.X...'];
const SIXTEENTH_REST = ['..XX.X', '..XXX.', 'XX.X..', 'XXXX..', '..X...', '.X....', '.X....'];

function px(ctx, x, y, w = 1, h = 1) {
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function rows(ctx, pattern, x, y) {
  pattern.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) if (r[i] === 'X') px(ctx, x + i, y + j);
  });
}

/**
 * Draw a laid-out score onto a staff line at `y`.
 * @param xOf beat -> pixel x
 * @param colorOf glyph -> ink colour (judged notes are coloured)
 */
export function drawScore(ctx, layout, y, xOf, colorOf, { minX = -Infinity, maxX = Infinity } = {}) {
  // y is the middle line of the staff; notes sit on it.
  const { glyphs, beams, tuplets } = layout;
  const visible = (x) => x > minX - 12 && x < maxX + 12;
  const stemTop = y - 1 - STEM;

  glyphs.forEach((gl, i) => {
    const x = Math.round(xOf(gl.beat));
    if (!visible(x)) return;
    ctx.fillStyle = colorOf(gl);
    if (gl.rest) {
      if (gl.barRest || gl.value >= 4 - EPS) {
        // Whole rest: a wide block hanging below the 4th line (it fills the top of the space).
        px(ctx, x - 4, y - GAP + 1, 9, 2);
        px(ctx, x - 5, y - GAP, 11, 1); // a short ledger-like lip so it reads as hanging
      } else if (gl.value >= 2 - EPS) {
        // Half rest: a narrower block sitting on top of the middle line.
        px(ctx, x - 3, y - 2, 7, 2);
      }
      else if (gl.value >= 1 - EPS) rows(ctx, QUARTER_REST, x - 1, y - 6);
      else if (gl.value >= 0.5 - EPS) rows(ctx, EIGHTH_REST, x - 2, y - 4);
      else rows(ctx, SIXTEENTH_REST, x - 3, y - 4);
    } else {
      const hollow = gl.value >= 2 - EPS;
      if (gl.value >= 4 - EPS) {
        // Whole note: a wider open head, no stem.
        px(ctx, x - 2, y - 2, 5, 1);
        px(ctx, x - 2, y + 2, 5, 1);
        px(ctx, x - 3, y - 1, 2, 3);
        px(ctx, x + 2, y - 1, 2, 3);
      } else {
        if (hollow) {
          px(ctx, x - 1, y - 2, 3, 1);
          px(ctx, x - 1, y + 2, 3, 1);
          px(ctx, x - 2, y - 1, 1, 3);
          px(ctx, x + 2, y - 1, 1, 3);
        } else {
          px(ctx, x - 1, y - 2, 3, 1);
          px(ctx, x - 2, y - 1, 5, 3);
          px(ctx, x - 1, y + 2, 3, 1);
        }
        px(ctx, x + 2, stemTop, 1, STEM + 1);
        for (let f = 0; f < gl.flags; f++) {
          const t = stemTop + f * 3;
          px(ctx, x + 3, t + 1);
          px(ctx, x + 4, t + 2);
          px(ctx, x + 5, t + 3, 1, 2);
          px(ctx, x + 4, t + 5);
        }
      }
    }
    for (let k = 0; k < gl.dots; k++) px(ctx, x + 5 + k * 3, y - 3, 2, 2);
    // A tie: a shallow arc under the heads to the next note.
    if (gl.tieTo != null) drawTie(ctx, x, Math.round(xOf(glyphs[gl.tieTo].beat)), y);
  });

  for (const b of beams) {
    const a = Math.round(xOf(b.from)) + 2;
    const z = Math.round(xOf(b.to)) + 2;
    if (!visible(a) && !visible(z)) continue;
    const g0 = glyphs.find((gl) => Math.abs(gl.beat - b.from) < EPS && !gl.rest);
    ctx.fillStyle = colorOf(g0);
    const by = stemTop + (b.level - 1) * 3;
    if (b.stub === 'left') px(ctx, a - 3, by, 4, 2);
    else if (b.stub === 'right') px(ctx, a, by, 4, 2);
    else px(ctx, a, by, z - a + 1, 2);
  }

  for (const t of tuplets) {
    const a = Math.round(xOf(t.from));
    const z = Math.round(xOf(t.to));
    if (!visible(a) && !visible(z)) continue;
    const g0 = glyphs.find((gl) => Math.abs(gl.beat - t.from) < EPS);
    ctx.fillStyle = colorOf(g0);
    const mid = Math.round((a + z) / 2) + 1;
    const ty = stemTop - 7;
    if (t.bracket) {
      px(ctx, a - 2, ty + 2, 1, 3);
      px(ctx, z + 3, ty + 2, 1, 3);
      px(ctx, a - 2, ty + 2, mid - 3 - (a - 2), 1);
      px(ctx, mid + 3, ty + 2, z + 3 - (mid + 3) + 1, 1);
    }
    digit(ctx, t.n, mid - 1, ty);
  }
}

const DIGITS = { 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6], 5: [7, 4, 6, 1, 6], 6: [3, 4, 6, 5, 2] };
function digit(ctx, n, x, y) {
  const g = DIGITS[n] || DIGITS[3];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r] & (4 >> c)) px(ctx, x + c, y + r);
}

/** A five-line staff from x0 to x1 around middle line y. */
export function drawStaff(ctx, x0, x1, y, color) {
  ctx.fillStyle = color;
  for (let k = -2; k <= 2; k++) px(ctx, x0, y + k * GAP, x1 - x0, 1);
}

/** A bar line (or a final double bar). */
export function drawBarline(ctx, x, y, color, final = false) {
  ctx.fillStyle = color;
  if (final) {
    px(ctx, x - 4, y - 2 * GAP, 1, 4 * GAP + 1);
    px(ctx, x - 2, y - 2 * GAP, 2, 4 * GAP + 1);
  } else px(ctx, x, y - 2 * GAP, 1, 4 * GAP + 1);
}

/** The neutral (percussion) clef and the time signature at the start of a line. Returns their width. */
export function drawClefAndTime(ctx, x, y, color, meter, showTime) {
  ctx.fillStyle = color;
  px(ctx, x, y - GAP, 2, 2 * GAP + 1);
  px(ctx, x + 3, y - GAP, 2, 2 * GAP + 1);
  if (!showTime) return 8;
  const [top, bottom] = meter.split('/');
  bigDigit(ctx, top, x + 9, y - 2 * GAP);
  bigDigit(ctx, bottom, x + 9, y + 1);
  return 17;
}

// Time-signature digits: 5x8, each filling two spaces.
const BIG = {
  2: ['.XXX.', 'X...X', '....X', '...X.', '..X..', '.X...', 'X....', 'XXXXX'],
  3: ['XXXX.', '....X', '....X', '.XXX.', '....X', '....X', '....X', 'XXXX.'],
  4: ['...X.', '..XX.', '.X.X.', 'X..X.', 'XXXXX', '...X.', '...X.', '...X.'],
  6: ['..XX.', '.X...', 'X....', 'XXXX.', 'X...X', 'X...X', 'X...X', '.XXX.'],
  8: ['.XXX.', 'X...X', 'X...X', '.XXX.', 'X...X', 'X...X', 'X...X', '.XXX.'],
};
function bigDigit(ctx, d, x, y) {
  rows(ctx, BIG[d] || BIG[4], x, y);
}

/** A tie: a shallow arc under two noteheads (also used across bar lines). */
export function drawTie(ctx, x1, x2, y) {
  px(ctx, x1, y + 4);
  px(ctx, x1 + 1, y + 5, Math.max(1, x2 - x1 - 1), 1);
  px(ctx, x2, y + 4);
}
