// Draws a rhythm exercise as sheet music (SVG), with a timeline strip under
// each line where the written notes and what you played line up in time.
// Notes are spaced in proportion to their length so the timeline matches.

import { diatonicStep } from './music.js';

const GAP = 10; // staff line spacing
const STAFF_TOP = 38; // within each line block
const LINE_HEIGHT = 150;
const TIMELINE_Y = STAFF_TOP + 4 * GAP + 44;
const TIMELINE_H = 14;
const STEM = 3.3 * GAP;
const MIDDLE_STEP = 34; // B4, the middle line of the treble staff

const svgNs = 'http://www.w3.org/2000/svg';

export class RhythmSheet {
  /**
   * @param {HTMLElement} container
   * @param {object} exercise from generateExercise
   * @param {(soundingMidi: number) => number} toWritten
   */
  constructor(container, exercise, toWritten) {
    this.container = container;
    this.exercise = exercise;
    this.toWritten = toWritten;
    this.statuses = null;
    this.render();
  }

  render() {
    const ex = this.exercise;
    const width = Math.max(300, this.container.clientWidth || 340);
    const bpb = ex.beatsPerBar;
    const prefixFirst = 62; // clef + time signature
    const right = 24; // room for the last note's timeline bar
    // Eighth notes need wider beats so their flags clear each other and bar lines.
    const minPpb = ex.events.some((e) => e.beats % 1 !== 0) ? 46 : 30;
    const barsPerLine = Math.max(1, Math.min(ex.bars, Math.floor((width - prefixFirst - right) / (bpb * minPpb))));
    const ppb = (width - prefixFirst - right) / (barsPerLine * bpb);
    const inset = Math.min(13, ppb * 0.28);
    const lineCount = Math.ceil(ex.bars / barsPerLine);
    this.width = width;
    this.lines = [];
    for (let i = 0; i < lineCount; i++) {
      const startBeat = i * barsPerLine * bpb;
      const endBeat = Math.min(ex.totalBeats, startBeat + barsPerLine * bpb);
      // Every line starts at the same x so beats line up vertically.
      this.lines.push({ startBeat, endBeat, top: i * LINE_HEIGHT, x0: prefixFirst, ppb, inset });
    }
    this.height = lineCount * LINE_HEIGHT;

    const parts = [];
    this.lines.forEach((line, i) => parts.push(this.drawLine(line, i === 0)));
    parts.push(this.drawNotes());
    if (this.counting) parts.push(this.drawCounting());
    parts.push('<g class="played-layer"></g>');
    parts.push('<line class="cursor" x1="0" x2="0" y1="0" y2="0" visibility="hidden"/>');
    this.container.innerHTML = `<svg xmlns="${svgNs}" viewBox="0 0 ${width} ${this.height}" width="100%" class="sheet" role="img" aria-label="Rhythm in ${bpb}/4, ${ex.bars} bars">${parts.join('')}</svg>`;
    this.svg = this.container.firstElementChild;
    this.playedLayer = this.svg.querySelector('.played-layer');
    this.cursor = this.svg.querySelector('.cursor');
    if (this.statuses) this.setResults(this.statuses);
    if (this.lastPlayed) this.setPlayed(this.lastPlayed);
  }

  lineFor(beat) {
    return this.lines.find((l) => beat < l.endBeat - 1e-9) || this.lines.at(-1);
  }

  /** x position of a beat on its line (aligned with noteheads). */
  x(line, beat) {
    return line.x0 + (beat - line.startBeat) * line.ppb + line.inset;
  }

  drawLine(line, first) {
    const p = [];
    const top = line.top + STAFF_TOP;
    const xEnd = line.x0 + (line.endBeat - line.startBeat) * line.ppb;
    for (let k = 0; k < 5; k++) {
      p.push(`<line class="staff-line" x1="4" x2="${xEnd}" y1="${top + k * GAP}" y2="${top + k * GAP}"/>`);
    }
    p.push(`<text class="clef clef-treble" x="6" y="${top + GAP * 3.35}" style="font-size:52px">𝄞</text>`);
    if (first) {
      const tx = 46;
      p.push(`<text class="timesig" x="${tx}" y="${top + GAP * 1.85}">${this.exercise.beatsPerBar}</text>`);
      p.push(`<text class="timesig" x="${tx}" y="${top + GAP * 3.85}">4</text>`);
    }
    // Bar lines (final one doubled at the very end).
    const bpb = this.exercise.beatsPerBar;
    for (let b = line.startBeat + bpb; b <= line.endBeat + 1e-9; b += bpb) {
      const x = line.x0 + (b - line.startBeat) * line.ppb;
      if (b >= this.exercise.totalBeats - 1e-9) {
        p.push(`<line class="barline" x1="${x - 5}" x2="${x - 5}" y1="${top}" y2="${top + 4 * GAP}"/>`);
        p.push(`<rect class="barline-thick" x="${x - 3}" y="${top}" width="3" height="${4 * GAP}"/>`);
      } else {
        p.push(`<line class="barline" x1="${x}" x2="${x}" y1="${top}" y2="${top + 4 * GAP}"/>`);
      }
    }
    // Timeline strip with beat ticks.
    // The timeline is shifted by the same inset as the noteheads, so each
    // written note's bar starts right under its notehead.
    const ty = line.top + TIMELINE_Y;
    p.push(`<rect class="timeline-bg" x="${line.x0 + line.inset - 2}" y="${ty}" width="${xEnd - line.x0 + 4}" height="${TIMELINE_H}" rx="3"/>`);
    for (let b = line.startBeat; b <= line.endBeat + 1e-9; b++) {
      const x = this.x(line, b);
      const strong = (b % bpb) === 0;
      p.push(`<line class="${strong ? 'tick strong' : 'tick'}" x1="${x}" x2="${x}" y1="${ty - (strong ? 4 : 2)}" y2="${ty}"/>`);
    }
    return p.join('');
  }

  drawNotes() {
    const ex = this.exercise;
    const p = [];
    const expected = [];
    const handled = new Set();

    ex.events.forEach((e, idx) => {
      const line = this.lineFor(e.beat);
      const x = this.x(line, e.beat);
      const top = line.top + STAFF_TOP;
      const bottom = top + 4 * GAP;
      const mid = top + 2 * GAP;

      if (e.rest) {
        p.push(`<g class="rest" data-idx="${idx}">${restGlyph(e.beats, x, mid)}</g>`);
        return;
      }

      // Expected note on the timeline.
      const ty = line.top + TIMELINE_Y;
      const w = Math.max(3, e.beats * line.ppb - 3);
      expected.push(`<rect class="expected" data-idx="${idx}" x="${x}" y="${ty + 1}" width="${w}" height="${TIMELINE_H - 2}" rx="2"/>`);

      if (handled.has(idx)) return;
      const step = diatonicStep(this.toWritten(e.midi));
      const y = bottom - (step - 30) * (GAP / 2);

      if (e.beamGroup != null) {
        const group = ex.events.map((g, i) => ({ g, i })).filter(({ g }) => g.beamGroup === e.beamGroup);
        group.forEach(({ i }) => handled.add(i));
        p.push(this.drawBeamGroup(group, line, bottom));
        return;
      }

      p.push(`<g class="note" data-idx="${idx}">${noteGlyph(e, x, y, step, bottom)}</g>`);
    });
    return `<g class="expected-layer">${expected.join('')}</g>${p.join('')}`;
  }

  /**
   * Counting under the staff: beat numbers, with "+" for notes on the
   * off-beat. Beats you hold through are shown in brackets, rests faded.
   */
  drawCounting() {
    const ex = this.exercise;
    const bpb = ex.beatsPerBar;
    const out = [];
    const label = (beat, text, cls) => {
      const line = this.lineFor(beat);
      const y = line.top + STAFF_TOP + 4 * GAP + 30;
      out.push(`<text class="count ${cls}" x="${this.x(line, beat)}" y="${y}">${text}</text>`);
    };
    for (const e of ex.events) {
      const beatInBar = e.beat - e.bar * bpb;
      const whole = Number.isInteger(beatInBar);
      label(e.beat, whole ? String(beatInBar + 1) : '+', e.rest ? 'rest' : 'start');
      // Beats held or rested through.
      for (let b = Math.floor(e.beat) + 1; b < e.beat + e.beats - 1e-9; b++) {
        label(b, e.rest ? String(b - e.bar * bpb + 1) : `(${b - e.bar * bpb + 1})`, e.rest ? 'rest' : 'hold');
      }
    }
    return `<g class="counting">${out.join('')}</g>`;
  }

  setCounting(on) {
    if (this.counting === on) return;
    this.counting = on;
    this.render();
  }

  drawBeamGroup(group, line, bottom) {
    const heads = group.map(({ g, i }) => {
      const step = diatonicStep(this.toWritten(g.midi));
      return { i, step, x: this.x(line, g.beat), y: bottom - (step - 30) * (GAP / 2) };
    });
    const avgStep = heads.reduce((s, h) => s + h.step, 0) / heads.length;
    const up = avgStep < MIDDLE_STEP;
    const tip = up ? Math.min(...heads.map((h) => h.y)) - STEM : Math.max(...heads.map((h) => h.y)) + STEM;
    const parts = heads.map((h) => {
      const sx = up ? h.x + 5.6 : h.x - 5.6;
      return `<g class="note" data-idx="${h.i}">${head(h.x, h.y, true)}${ledgers(h.x, h.step, bottom)}<line class="stem" x1="${sx}" x2="${sx}" y1="${h.y}" y2="${tip}"/></g>`;
    });
    const x1 = (up ? heads[0].x + 5.6 : heads[0].x - 5.6) - 0.7;
    const x2 = (up ? heads.at(-1).x + 5.6 : heads.at(-1).x - 5.6) + 0.7;
    const by = up ? tip : tip - 4.5;
    parts.push(`<rect class="beam" x="${x1}" y="${by}" width="${x2 - x1}" height="4.5"/>`);
    return `<g class="beam-group">${parts.join('')}</g>`;
  }

  /** Colour notes after scoring. @param {Map<number,string>} statuses event index -> status */
  setResults(statuses) {
    this.statuses = statuses;
    for (const el of this.svg.querySelectorAll('[data-idx]')) {
      const s = statuses.get(Number(el.dataset.idx));
      el.classList.remove('s-good', 's-close', 's-off', 's-missed', 's-wrong', 's-hit');
      if (s) el.classList.add(`s-${s}`);
    }
  }

  clearResults() {
    this.statuses = null;
    this.lastPlayed = null;
    for (const el of this.svg.querySelectorAll('[data-idx]')) {
      el.classList.remove('s-good', 's-close', 's-off', 's-missed', 's-wrong', 's-hit');
    }
    this.playedLayer.innerHTML = '';
  }

  /**
   * Draw what was played on the timeline.
   * @param {{start: number, end: number, status?: string}[]} notes in beats
   */
  setPlayed(notes) {
    this.lastPlayed = notes;
    const parts = [];
    for (const n of notes) {
      for (const line of this.lines) {
        const s = Math.max(n.start, line.startBeat - line.inset / line.ppb);
        const e = Math.min(n.end, line.endBeat);
        if (e <= s) continue;
        const x1 = this.x(line, s);
        const x2 = this.x(line, e);
        const ty = line.top + TIMELINE_Y;
        parts.push(`<rect class="played ${n.status ? `s-${n.status}` : ''}" x="${x1}" y="${ty + 3.5}" width="${Math.max(2, x2 - x1)}" height="${TIMELINE_H - 7}" rx="2"/>`);
      }
    }
    this.playedLayer.innerHTML = parts.join('');
  }

  /** Move the playhead to a beat (or hide it with null). */
  setCursor(beat) {
    if (beat == null || beat < 0 || beat > this.exercise.totalBeats) {
      this.cursor.setAttribute('visibility', 'hidden');
      return;
    }
    const line = this.lineFor(beat);
    const x = this.x(line, beat);
    this.cursor.setAttribute('x1', x);
    this.cursor.setAttribute('x2', x);
    this.cursor.setAttribute('y1', line.top + STAFF_TOP - 16);
    this.cursor.setAttribute('y2', line.top + TIMELINE_Y + TIMELINE_H + 2);
    this.cursor.setAttribute('visibility', 'visible');
  }
}

function head(x, y, filled) {
  return `<ellipse class="${filled ? 'head' : 'head hollow'}" cx="${x}" cy="${y}" rx="6.2" ry="4.5" transform="rotate(-20 ${x} ${y})"/>`;
}

function ledgers(x, step, bottom) {
  const out = [];
  for (let s = 28; s >= step; s -= 2) {
    const y = bottom - (s - 30) * (GAP / 2);
    out.push(`<line class="staff-line" x1="${x - 10}" x2="${x + 10}" y1="${y}" y2="${y}"/>`);
  }
  for (let s = 40; s <= step; s += 2) {
    const y = bottom - (s - 30) * (GAP / 2);
    out.push(`<line class="staff-line" x1="${x - 10}" x2="${x + 10}" y1="${y}" y2="${y}"/>`);
  }
  return out.join('');
}

function noteGlyph(e, x, y, step, bottom) {
  const base = e.dotted ? e.beats / 1.5 : e.beats; // undotted value
  const filled = base <= 1;
  const out = [head(x, y, filled), ledgers(x, step, bottom)];
  if (base < 4) {
    const up = step < MIDDLE_STEP;
    const sx = up ? x + 5.6 : x - 5.6;
    const tip = up ? y - STEM : y + STEM;
    out.push(`<line class="stem" x1="${sx}" x2="${sx}" y1="${y}" y2="${tip}"/>`);
    if (base === 0.5) {
      out.push(up
        ? `<path class="flag" d="M${sx} ${tip} c1 6 8 9 7.5 17 c2.5 -7 -3 -11 -7.5 -12 z"/>`
        : `<path class="flag" d="M${sx} ${tip} c1 -6 8 -9 7.5 -17 c2.5 7 -3 11 -7.5 12 z"/>`);
    }
  }
  if (e.dotted) {
    const onLine = (step - 30) % 2 === 0;
    out.push(`<circle class="dot" cx="${x + 11}" cy="${onLine ? y - GAP / 2 : y}" r="1.9"/>`);
  }
  return out.join('');
}

function restGlyph(beats, x, mid) {
  if (beats >= 2) {
    // Half rest: a block sitting on the middle line.
    return `<rect class="rest-fill" x="${x - 6}" y="${mid - GAP / 2}" width="12" height="${GAP / 2}"/>`;
  }
  if (beats >= 1) {
    return `<path class="rest-stroke" d="M${x - 3} ${mid - 14} L${x + 3} ${mid - 6.5} L${x - 2} ${mid - 1} L${x + 3.5} ${mid + 5.5} Q${x - 4.5} ${mid + 3} ${x + 0.5} ${mid + 14}"/>`;
  }
  return `<circle class="rest-fill" cx="${x - 2.5}" cy="${mid - 5}" r="2.4"/><path class="rest-stroke thin" d="M${x - 2.5} ${mid - 3.2} Q${x + 1} ${mid - 2.5} ${x + 4.5} ${mid - 7} L${x - 0.5} ${mid + 9}"/>`;
}
