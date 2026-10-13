// Beat Ward pixel art: a 3x5 bitmap font, sprites drawn from little
// text grids, and the hospital-ward background. Everything is drawn with
// whole-pixel rectangles on a small canvas that's scaled up crisply.

export const W = 256;
export const H = 208;

export const PAL = {
  night: '#141026',
  wall: '#2b2348',
  wallDark: '#221c3a',
  trim: '#3d3266',
  floorA: '#1d2b3a',
  floorB: '#22344a',
  window: '#0d1a3a',
  moon: '#f4e6a6',
  star: '#c9d4ff',
  monitor: '#0b1f17',
  monitorEdge: '#5a6f7d',
  ecg: '#3cff9a',
  lane: '#0e0b1c',
  laneEdge: '#4a3f7a',
  tick: '#3a3168',
  beatTick: '#6b5fb0',
  right: '#ff5d8f',
  rightLight: '#ffb3c9',
  rightDark: '#b8325e',
  left: '#4fc3ff',
  leftLight: '#b8e8ff',
  leftDark: '#2a7fb0',
  heart: '#ff3b5c',
  heartLight: '#ff9aab',
  white: '#ffffff',
  text: '#f4f1ff',
  dim: '#8a80b8',
  perfect: '#7dffb2',
  good: '#ffe066',
  ok: '#ffb066',
  miss: '#ff5d5d',
  coat: '#e8eef7',
  coatShade: '#b9c3d6',
  skin: '#f2c29b',
  hair: '#5a3825',
  scrubs: '#3fa7a0',
  shoe: '#2a2a3a',
  steth: '#4fc3ff',
};

// ------------------------------------------------------------------ font

// 3x5 glyphs, one number per row (bits left to right).
const GLYPHS = {
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7],
  F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2],
  K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7], M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2],
  P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 7, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5], Y: [5, 5, 2, 2, 2],
  Z: [7, 1, 2, 4, 7], 0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6],
  4: [5, 5, 7, 1, 1], 5: [7, 4, 6, 1, 6], 6: [3, 4, 6, 5, 2], 7: [7, 1, 2, 2, 2], 8: [2, 5, 2, 5, 2],
  9: [2, 5, 3, 1, 6], '!': [2, 2, 2, 0, 2], '%': [5, 1, 2, 4, 5], '.': [0, 0, 0, 0, 2], ':': [0, 2, 0, 2, 0],
  '-': [0, 0, 7, 0, 0], '+': [0, 2, 7, 2, 0], '/': [1, 1, 2, 4, 4], x: [0, 5, 2, 5, 0], '?': [6, 1, 2, 0, 2],
  "'": [2, 2, 0, 0, 0], ' ': [0, 0, 0, 0, 0], '<': [1, 2, 4, 2, 1], '>': [4, 2, 1, 2, 4], '*': [0, 5, 2, 5, 0],
};

export function textWidth(str, scale = 1) {
  return str.length * 4 * scale - scale;
}

/** Draw text in the pixel font. `align` is 'left', 'center' or 'right'. */
export function text(ctx, str, x, y, color, { scale = 1, align = 'left', shadow = null } = {}) {
  const s = String(str).toUpperCase();
  let cx = align === 'center' ? x - textWidth(s, scale) / 2 : align === 'right' ? x - textWidth(s, scale) : x;
  cx = Math.round(cx);
  y = Math.round(y);
  if (shadow) text(ctx, str, x + scale, y + scale, shadow, { scale, align });
  ctx.fillStyle = color;
  for (const ch of s) {
    const g = GLYPHS[ch] || GLYPHS['?'];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) if (g[r] & (4 >> c)) ctx.fillRect(cx + c * scale, y + r * scale, scale, scale);
    }
    cx += 4 * scale;
  }
}

// --------------------------------------------------------------- sprites

/** Draw a sprite from rows of characters; each character maps to a colour ('.' is clear). */
export function sprite(ctx, rows, x, y, colors, scale = 1) {
  x = Math.round(x);
  y = Math.round(y);
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const col = colors[row[c]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
    }
  });
}

export const HEART = [
  '.HH...HH.',
  'HLHH.HHHH',
  'HLHHHHHHH',
  'HHHHHHHHH',
  '.HHHHHHH.',
  '..HHHHH..',
  '...HHH...',
  '....H....',
];

// The doctor, two frames: standing, and tapping (arm out).
export const DOCTOR = [
  [
    '....hhhh....',
    '...hhhhhh...',
    '...hssssh...',
    '...seseses..',
    '...ssssss...',
    '....ssss....',
    '..ccccccccc.',
    '.ccccbccccc.',
    '.cccbcbcccc.',
    '.sccccbcccs.',
    '..ccccbccc..',
    '..ccccccccc.',
    '...gg...gg..',
    '...gg...gg..',
    '..kkk...kkk.',
  ],
  [
    '....hhhh....',
    '...hhhhhh...',
    '...hssssh...',
    '...seseses..',
    '...ssssss...',
    '....ssss..s.',
    '..cccccccccs',
    '.ccccbccccc.',
    '.cccbcbccc..',
    '.sccccbccc..',
    '..ccccbccc..',
    '..ccccccccc.',
    '...gg...gg..',
    '...gg...gg..',
    '..kkk...kkk.',
  ],
];

export const DOCTOR_COLORS = {
  h: PAL.hair, s: PAL.skin, e: '#2a1b12', c: PAL.coat, b: PAL.steth, g: PAL.scrubs, k: PAL.shoe,
};

// ------------------------------------------------------------ background

const STARS = Array.from({ length: 14 }, (_, i) => [((i * 37) % 44) + 12, ((i * 23) % 26) + 12]);

/** The ward: wall, window with the moon, floor tiles, a bed. */
export function drawWard(ctx, beatPhase) {
  ctx.fillStyle = PAL.night;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = PAL.wall;
  ctx.fillRect(0, 0, W, 96);
  // Wainscot stripe
  ctx.fillStyle = PAL.trim;
  ctx.fillRect(0, 60, W, 2);
  ctx.fillStyle = PAL.wallDark;
  ctx.fillRect(0, 62, W, 34);
  // Window
  ctx.fillStyle = PAL.trim;
  ctx.fillRect(8, 8, 52, 40);
  ctx.fillStyle = PAL.window;
  ctx.fillRect(10, 10, 48, 36);
  ctx.fillStyle = PAL.trim;
  ctx.fillRect(33, 10, 2, 36);
  ctx.fillRect(10, 27, 48, 2);
  for (const [sx, sy] of STARS) {
    ctx.fillStyle = (sx + Math.floor(beatPhase * 2)) % 3 === 0 ? PAL.white : PAL.star;
    ctx.fillRect(sx, sy, 1, 1);
  }
  ctx.fillStyle = PAL.moon;
  ctx.fillRect(44, 14, 6, 6);
  ctx.fillRect(45, 13, 4, 8);
  ctx.fillStyle = PAL.window;
  ctx.fillRect(47, 14, 3, 4);
  // Floor tiles
  for (let y = 96; y < H; y += 8) {
    for (let x = 0; x < W; x += 8) {
      ctx.fillStyle = ((x + y) / 8) % 2 ? PAL.floorA : PAL.floorB;
      ctx.fillRect(x, y, 8, 8);
    }
  }
  ctx.fillStyle = PAL.trim;
  ctx.fillRect(0, 95, W, 1);
}

/** The strip above the sheet music during play: ward wall and floor. */
export function drawScene(ctx, beatPhase, height) {
  ctx.fillStyle = PAL.wall;
  ctx.fillRect(0, 0, W, height);
  ctx.fillStyle = PAL.trim;
  ctx.fillRect(0, 22, W, 1);
  ctx.fillStyle = PAL.wallDark;
  ctx.fillRect(0, 23, W, height - 33);
  for (let y = height - 10; y < height; y += 5) {
    for (let x = 0; x < W; x += 8) {
      ctx.fillStyle = ((x / 8 + (y - height) / 5) & 1) ? PAL.floorA : PAL.floorB;
      ctx.fillRect(x, y, 8, 5);
    }
  }
  ctx.fillStyle = PAL.trim;
  ctx.fillRect(0, height - 11, W, 1);
}

/** The heart monitor in the corner: a green trace that blips on every beat. */
export function drawMonitor(ctx, songBeat, flat) {
  const x0 = 186, y0 = 8, w = 62, h = 34;
  ctx.fillStyle = PAL.monitorEdge;
  ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
  ctx.fillStyle = PAL.monitor;
  ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = PAL.monitorEdge;
  ctx.fillRect(x0 + w / 2 - 6, y0 + h + 2, 12, 6);
  const mid = y0 + 20;
  for (let i = 0; i < w; i++) {
    // Each pixel column is a moment in the recent past; a blip near each beat.
    const beat = songBeat - (w - i) / 24;
    const f = beat - Math.floor(beat);
    let dy = 0;
    if (!flat && beat > 0) {
      if (f < 0.05) dy = -Math.round(f * 200);
      else if (f < 0.1) dy = Math.round((f - 0.05) * 260) - 10;
      else if (f < 0.14) dy = 3 - Math.round((f - 0.1) * 75);
    }
    ctx.fillStyle = i > w - 3 ? PAL.white : PAL.ecg;
    ctx.fillRect(x0 + i, mid + dy, 1, 1);
  }
  text(ctx, flat ? '---' : 'BPM', x0 + 3, y0 + 3, PAL.ecg);
}

// ----------------------------------------------------------------- bosses

// A germ: 18x16, with spikes (S), body (B), shading (D) and a shine (L).
const GERM = [
  [
    '....S...SS...S....',
    '.....S.BBBB.S.....',
    '..S.BBBBBBBBBB.S..',
    '...BBBBBBBBBBBB...',
    '..BBLLBBBBBBBBBB..',
    '.BBLLBBBBBBBBBBBB.',
    'SBBLBBBBBBBBBBBBBS',
    '.BBBBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBBBB.',
    'SBBBBBBBBBBBBBBBBS',
    '.BBBBBBBBBBBBBBBD.',
    '..BBBBBBBBBBBBBD..',
    '...BBBBBBBBBBDD...',
    '..S.DBBBBBBDD.S...',
    '.....S.DDDD.S.....',
    '....S...SS...S....',
  ],
  [
    '...S....SS....S...',
    '....SS.BBBB.SS....',
    '....BBBBBBBBBB....',
    '.S.BBBBBBBBBBBB.S.',
    '..BBLLBBBBBBBBBB..',
    'SBBLLBBBBBBBBBBBBS',
    '.BBLBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBBBB.',
    'SBBBBBBBBBBBBBBBDS',
    '..BBBBBBBBBBBBBD..',
    '.S.BBBBBBBBBBDD.S.',
    '....DBBBBBBDD.....',
    '....SS.DDDD.SS....',
    '...S....SS....S...',
  ],
];

/**
 * Draw a boss centred on (cx, cy).
 * @param mood 'idle' | 'angry' | 'hurt' | 'ko'
 */
export function drawBoss(ctx, boss, cx, cy, { frame = 0, mood = 'idle', flash = false, scale = boss.scale || 2 } = {}) {
  const s = scale;
  const x = Math.round(cx - 9 * s);
  const y = Math.round(cy - 8 * s);
  const ko = mood === 'ko';
  const colors = flash
    ? { S: PAL.white, B: PAL.white, D: PAL.white, L: PAL.white }
    : ko
      ? { S: '#3a3550', B: '#6e6890', D: '#4c4668', L: '#9a94b8' }
      : { S: boss.dark, B: boss.body, D: boss.dark, L: boss.light };
  sprite(ctx, GERM[((frame % 2) + 2) % 2], x, y, colors, s);
  if (flash) return;
  // Face, in germ pixels.
  const P = (gx, gy, w = 1, h = 1, c = PAL.night) => {
    ctx.fillStyle = c;
    ctx.fillRect(x + gx * s, y + gy * s, w * s, h * s);
  };
  const eyeXs = boss.eyes === 1 ? [7] : boss.eyes === 3 ? [3, 7, 11] : [4, 10];
  const ew = boss.eyes === 1 ? 4 : 3;
  for (const ex of eyeXs) {
    if (ko) {
      // X eyes
      P(ex, 5, 1, 1); P(ex + 2, 5, 1, 1); P(ex + 1, 6, 1, 1); P(ex, 7, 1, 1); P(ex + 2, 7, 1, 1);
      continue;
    }
    if (mood === 'hurt') {
      P(ex, 6, ew, 1);
      continue;
    }
    P(ex, 5, ew, 3, PAL.white);
    P(ex + Math.floor(ew / 2), 6, 1, 2, PAL.night);
    if (mood === 'angry') {
      // Brows slanting in towards the middle.
      const inward = ex + ew / 2 < 9;
      P(ex, inward ? 3 : 4, 1, 1);
      P(ex + 1, 4, ew - 2 || 1, 1);
      P(ex + ew - 1, inward ? 4 : 3, 1, 1);
    }
  }
  // Mouth
  if (ko) P(6, 10, 6, 1);
  else if (mood === 'angry') {
    P(5, 10, 8, 2);
    P(6, 10, 1, 1, PAL.white); P(8, 10, 1, 1, PAL.white); P(10, 10, 1, 1, PAL.white);
  } else if (mood === 'hurt') P(7, 10, 4, 2);
  else {
    P(6, 10, 1, 1); P(7, 11, 4, 1); P(11, 10, 1, 1);
  }
}
