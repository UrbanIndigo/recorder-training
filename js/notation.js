// Draws a rhythm exercise as sheet music (SVG). Notes are spaced like
// printed music (short notes closer together, long notes with more room),
// so the layout doesn't give the timing away.

import { diatonicStep, noteInfo } from './music.js?v=2.7';
import { meterOf, soundingNotes } from './rhythm.js?v=2.7';

const GAP = 10; // staff line spacing
const STAFF_TOP = 34; // within each line block (room above for bar badges); more for high notes
const STEM = 3.3 * GAP;
const MIDDLE = 4; // staff position of the middle line (0 = bottom line)
const PREFIX_FIRST = 62; // clef + time signature
const PREFIX = 40; // clef
const RIGHT = 8;

const svgNs = 'http://www.w3.org/2000/svg';

/** Room an event takes, before the line is stretched to fit. */
const naturalWidth = (beats) => 10 + 22 * Math.sqrt(beats);

export class RhythmSheet {
  /**
   * @param {HTMLElement} container
   * @param {object} exercise from generateExercise
   * @param {(soundingMidi: number) => number} toWritten
   * @param {'treble'|'bass'} [clef]
   * @param {{showTimeSig?: boolean, fixedHeight?: {top: number, below: number}}} [options]
   */
  constructor(container, exercise, toWritten, clef = 'treble', options = {}) {
    this.container = container;
    this.exercise = exercise;
    this.toWritten = toWritten;
    this.clef = clef;
    // For rows in a scrolling score: show the time signature only when it
    // changes, and fix the height so every row lines up.
    this.options = { showTimeSig: true, fixedHeight: null, ...options };
    this.bottomStep = clef === 'bass' ? 18 : 30; // G2 or E4 on the bottom line
    this.statuses = null;
    this.offsets = null;
    this.barLabels = null;
    this.counting = false;
    this.render();
  }

  // ------------------------------------------------------------- layout

  /** Staff position of a note: 0 = bottom line, 4 = middle line, 8 = top line. */
  staffPos(midi) {
    return diatonicStep(this.toWritten(midi)) - this.bottomStep;
  }

  layout(width) {
    const ex = this.exercise;
    // Make room above the staff for high notes (stems down, ledger lines).
    const positions = ex.events.filter((e) => !e.rest).map((e) => this.staffPos(e.midi));
    const highest = Math.max(8, ...positions);
    this.staffTop = STAFF_TOP + Math.max(0, (highest - 8) * (GAP / 2) + (highest > 8 ? 6 : 0));
    const lowest = Math.min(0, ...positions);
    this.belowExtra = Math.max(0, (-lowest - 2) * (GAP / 2));
    if (this.options.fixedHeight) {
      this.staffTop = Math.max(this.staffTop, this.options.fixedHeight.top);
      this.belowExtra = Math.max(this.belowExtra, this.options.fixedHeight.below);
    }
    this.accidentals = accidentalsFor(ex, this.toWritten);
    const bars = [];
    for (let b = 0; b < ex.bars; b++) {
      const events = ex.events.map((e, i) => ({ e, i })).filter(({ e }) => e.bar === b);
      // Triplet notes get a little extra room for their "trip let" counting.
      const widths = events.map(({ e, i }) => (e.barRest ? naturalWidth(2) : naturalWidth(e.beats) + (e.tuplet ? 5 : 0) + (this.accidentals.has(i) ? 9 : 0)));
      bars.push({ index: b, events, widths, natural: widths.reduce((a, c) => a + c, 0) + 8 });
    }
    // Fill lines with as many bars as fit (squeezing up to 15% if needed).
    const lines = [];
    let cur = null;
    for (const bar of bars) {
      const prefix = lines.length === 0 && !cur ? PREFIX_FIRST : PREFIX;
      const avail = width - (cur ? cur.prefix : prefix) - RIGHT;
      if (cur && (cur.natural + bar.natural) * 0.85 <= avail) {
        cur.bars.push(bar);
        cur.natural += bar.natural;
      } else {
        if (cur) lines.push(cur);
        cur = { prefix: lines.length === 0 ? PREFIX_FIRST : PREFIX, bars: [bar], natural: bar.natural };
      }
    }
    lines.push(cur);

    // Place everything, stretching each line to the full width.
    this.positions = new Map(); // event index -> { x, line }
    // Extra room under the staff for counting and for the "what you played" strip.
    this.lineHeight = this.staffTop + 78 + this.belowExtra + (this.counting || this.options.fixedHeight ? 18 : 0) + (this.played ? 26 : 0);
    lines.forEach((line, li) => {
      line.top = li * this.lineHeight;
      const scale = (width - line.prefix - RIGHT) / line.natural;
      let x = line.prefix;
      line.anchors = []; // [beat, x] for the playhead and bar badges
      for (const bar of line.bars) {
        bar.startX = x;
        x += 8 * scale; // space after the bar line
        bar.events.forEach(({ e, i }, k) => {
          const w = bar.widths[k] * scale;
          const headX = e.barRest ? null : x + 7 + (this.accidentals.has(i) ? 8 : 0);
          this.positions.set(i, { x: headX, slotX: x, slotW: w, line: li });
          line.anchors.push([e.beat, x + 7]);
          x += w;
        });
        bar.endX = x;
        line.anchors.push([(bar.index + 1) * this.exercise.beatsPerBar, x]);
      }
      line.startBeat = line.bars[0].index * this.exercise.beatsPerBar;
      line.endBeat = (line.bars.at(-1).index + 1) * this.exercise.beatsPerBar;
    });
    this.lines = lines;
    this.bars = bars;
    this.height = lines.length * this.lineHeight;
  }

  render() {
    const width = Math.max(300, this.container.clientWidth || 340);
    this.width = width;
    this.layout(width);
    const parts = [];
    this.lines.forEach((line, i) => parts.push(this.drawLine(line, i === 0)));
    parts.push(this.drawNotes());
    if (this.counting) parts.push(this.drawCounting());
    parts.push('<g class="markers"></g><g class="bar-labels"></g><g class="played-strip"></g>');
    parts.push('<line class="cursor" x1="0" x2="0" y1="0" y2="0" visibility="hidden"/>');
    const ex = this.exercise;
    this.container.innerHTML = `<svg xmlns="${svgNs}" viewBox="0 0 ${width} ${this.height}" width="100%" class="sheet" role="img" aria-label="Rhythm in ${ex.beatsPerBar}/4, ${ex.bars} bars">${parts.join('')}</svg>`;
    this.svg = this.container.firstElementChild;
    this.markerLayer = this.svg.querySelector('.markers');
    this.labelLayer = this.svg.querySelector('.bar-labels');
    this.cursor = this.svg.querySelector('.cursor');
    if (this.statuses) this.setResults(this.statuses, this.offsets);
    if (this.barLabels) this.setBarLabels(this.barLabels);
    this.drawPlayed();
  }

  drawLine(line, first) {
    const p = [];
    const top = line.top + this.staffTop;
    const xEnd = line.bars.at(-1).endX;
    for (let k = 0; k < 5; k++) {
      p.push(`<line class="staff-line" x1="4" x2="${xEnd}" y1="${top + k * GAP}" y2="${top + k * GAP}"/>`);
    }
    p.push(this.clef === 'bass'
      ? `<text class="clef clef-bass" x="8" y="${top + GAP * 2.1}" style="font-size:34px">𝄢</text>`
      : `<text class="clef clef-treble" x="6" y="${top + GAP * 3.35}" style="font-size:52px">𝄞</text>`);
    if (first && this.options.showTimeSig) {
      const m = meterOf(this.exercise);
      p.push(`<text class="timesig" x="46" y="${top + GAP * 1.85}">${m.num}</text>`);
      p.push(`<text class="timesig" x="46" y="${top + GAP * 3.85}">${m.den}</text>`);
    }
    for (const bar of line.bars) {
      const x = bar.endX;
      if (bar.index === this.exercise.bars - 1) {
        p.push(`<line class="barline" x1="${x - 5}" x2="${x - 5}" y1="${top}" y2="${top + 4 * GAP}"/>`);
        p.push(`<rect class="barline-thick" x="${x - 3}" y="${top}" width="3" height="${4 * GAP}"/>`);
      } else {
        p.push(`<line class="barline" x1="${x}" x2="${x}" y1="${top}" y2="${top + 4 * GAP}"/>`);
      }
    }
    return p.join('');
  }

  headY(i) {
    const e = this.exercise.events[i];
    const line = this.lines[this.positions.get(i).line];
    const bottom = line.top + this.staffTop + 4 * GAP;
    return bottom - (this.staffPos(e.midi)) * (GAP / 2);
  }

  drawNotes() {
    this.beamTips = new Map();
    const ex = this.exercise;
    const p = [];
    const handled = new Set();
    ex.events.forEach((e, idx) => {
      if (handled.has(idx)) return;
      const pos = this.positions.get(idx);
      const line = this.lines[pos.line];
      const top = line.top + this.staffTop;
      const mid = top + 2 * GAP;
      if (e.rest) {
        if (e.barRest) {
          const bar = this.bars[e.bar];
          const cx = (bar.startX + bar.endX) / 2;
          p.push(`<g class="rest" data-idx="${idx}"><rect class="rest-fill" x="${cx - 6}" y="${top + GAP}" width="12" height="${GAP / 2}"/></g>`);
        } else {
          const dot = e.dotted ? `<circle class="dot" cx="${pos.x + 9}" cy="${mid - GAP / 2}" r="1.9"/>` : '';
          p.push(`<g class="rest" data-idx="${idx}">${restGlyph(writtenValue(e), pos.x, mid)}${dot}</g>`);
        }
        return;
      }
      if (e.beamGroup != null) {
        const group = ex.events.map((g, i) => ({ g, i })).filter(({ g }) => g.beamGroup === e.beamGroup);
        group.forEach(({ i }) => handled.add(i));
        p.push(this.drawBeamGroup(group, top + 4 * GAP));
        return;
      }
      const step = this.staffPos(e.midi);
      p.push(`<g class="note" data-idx="${idx}">${this.accGlyph(idx, pos.x, this.headY(idx))}${noteGlyph(e, pos.x, this.headY(idx), step, top + 4 * GAP)}</g>`);
    });
    p.push(this.drawTies());
    p.push(this.drawTupletBrackets());
    return p.join('');
  }

  accGlyph(idx, x, y) {
    const a = this.accidentals.get(idx);
    return a ? `<text class="accidental" x="${x - 15}" y="${y + 5}">${a}</text>` : '';
  }

  drawBeamGroup(group, bottom) {
    const heads = group.map(({ g, i }) => ({ i, e: g, step: this.staffPos(g.midi), x: this.positions.get(i).x, y: this.headY(i) }));
    const avgStep = heads.reduce((s, h) => s + h.step, 0) / heads.length;
    const up = avgStep < MIDDLE;
    const stemX = (h) => (up ? h.x + 5.6 : h.x - 5.6);
    // The beam slopes gently with the melody (at most a staff space), and
    // sits so that every stem is at least a normal length.
    const first = heads[0], last = heads.at(-1);
    const dx = stemX(last) - stemX(first) || 1;
    const rise = Math.max(-GAP, Math.min(GAP, last.y - first.y));
    const slope = heads.length > 1 ? rise / dx : 0;
    const along = (h) => slope * (stemX(h) - stemX(first));
    const offset = up
      ? Math.min(...heads.map((h) => h.y - STEM - along(h)))
      : Math.max(...heads.map((h) => h.y + STEM - along(h)));
    const tipAt = (x) => offset + slope * (x - stemX(first));
    this.beamTips.set(group[0].g.beamGroup, { up, tip: up ? Math.min(...heads.map((h) => tipAt(stemX(h)))) : Math.max(...heads.map((h) => tipAt(stemX(h)))) });
    const parts = heads.map((h) => {
      const dot = dotsGlyph(h.e, h.x, h.y, h.step);
      return `<g class="note" data-idx="${h.i}">${this.accGlyph(h.i, h.x, h.y)}${head(h.x, h.y, true)}${ledgers(h.x, h.step, bottom)}${dot}<line class="stem" x1="${stemX(h)}" x2="${stemX(h)}" y1="${h.y}" y2="${tipAt(stemX(h))}"/></g>`;
    });
    // A beam is a sloped band; extra levels stack towards the noteheads.
    const beam = (x1, x2, level) => {
      const shift = up ? level * 7 : -level * 7 - 4.5;
      const a = x1 - 0.7, b = x2 + 0.7;
      const ya = tipAt(a) + shift, yb = tipAt(b) + shift;
      return `<polygon class="beam" points="${a},${ya} ${b},${yb} ${b},${yb + 4.5} ${a},${ya + 4.5}"/>`;
    };
    // Primary beam across the group.
    parts.push(beam(stemX(heads[0]), stemX(heads.at(-1)), 0));
    // Extra beams for sixteenths (2) and thirty-seconds (3): joined across
    // neighbours, or a short stub pointing towards the note it pairs with.
    const levels = heads.map((h) => beamCount(writtenValue(h.e)));
    for (let level = 2; level <= 3; level++) {
      for (let k = 0; k < heads.length; ) {
        if (levels[k] < level) {
          k++;
          continue;
        }
        let j = k;
        while (j + 1 < heads.length && levels[j + 1] >= level) j++;
        if (j > k) parts.push(beam(stemX(heads[k]), stemX(heads[j]), level - 1));
        else {
          const x = stemX(heads[k]);
          const v = writtenValue(heads[k].e);
          const pairedLeft = k === heads.length - 1 || (heads[k].e.beat % (2 * v)) >= v - 1e-6;
          parts.push(pairedLeft && k > 0 ? beam(x - 8, x, level - 1) : beam(x, x + 8, level - 1));
        }
        k = j + 1;
      }
    }
    return `<g class="beam-group">${parts.join('')}</g>`;
  }

  drawTies() {
    const out = [];
    this.exercise.events.forEach((e, i) => {
      if (!e.tieNext) return;
      const a = this.positions.get(i);
      const b = this.positions.get(i + 1);
      if (!b || a.line !== b.line) return;
      const y = this.headY(i);
      const below = this.staffPos(e.midi) < MIDDLE; // stems up, so tie underneath
      const dy = below ? 1 : -1;
      const x1 = a.x + 5, x2 = b.x - 5, mx = (x1 + x2) / 2;
      out.push(`<path class="tie" data-idx="${i}" d="M${x1} ${y + dy * 6} Q${mx} ${y + dy * 14} ${x2} ${y + dy * 6} Q${mx} ${y + dy * 11} ${x1} ${y + dy * 6} Z"/>`);
    });
    return out.join('');
  }

  /**
   * Tuplet numbers: over the beam for notes beamed together, or with a
   * bracket when the group isn't one beam (unbeamed notes, or a rest inside).
   */
  drawTupletBrackets() {
    const out = [];
    const groups = new Map();
    this.exercise.events.forEach((e, i) => {
      if (!e.tuplet) return;
      const key = e.tupletId ?? e.cellId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(i);
    });
    for (const idxs of groups.values()) {
      const evs = idxs.map((i) => this.exercise.events[i]);
      const first = this.positions.get(idxs[0]);
      const last = this.positions.get(idxs.at(-1));
      if (first.line !== last.line) continue;
      const n = evs[0].tuplet;
      const xOf = (i) => this.positions.get(i).x ?? this.positions.get(i).slotX + 7;
      const beamed = evs.every((e) => !e.rest && e.beamGroup != null && e.beamGroup === evs[0].beamGroup);
      if (beamed) {
        const { up, tip } = this.beamTips.get(evs[0].beamGroup);
        const cx = (xOf(idxs[0]) + xOf(idxs.at(-1))) / 2 + (up ? 5.6 : -5.6);
        // Over the beam, or over the noteheads when stems point down
        // (keeps it clear of the counting underneath).
        const y = up ? tip - 5 : Math.min(...idxs.map((i) => this.headY(i))) - 9;
        out.push(`<text class="tuplet" x="${cx}" y="${y}">${n}</text>`);
      } else {
        const line = this.lines[first.line];
        const y = line.top + this.staffTop - 8;
        const x1 = xOf(idxs[0]) - 6, x2 = xOf(idxs.at(-1)) + 8, mx = (x1 + x2) / 2;
        out.push(`<path class="bracket" d="M${x1} ${y + 5} V${y} H${mx - 7} M${mx + 7} ${y} H${x2} V${y + 5}"/><text class="tuplet" x="${mx}" y="${y + 4}">${n}</text>`);
      }
    }
    return out.join('');
  }

  /**
   * After a bar has been played: a strip under it showing the written note
   * lengths (outlines) and what was actually played (filled), against the beat.
   * @param {{start: number, end: number, status?: string}[]|null} notes in beats
   */
  setPlayed(notes) {
    const had = !!this.played;
    this.played = notes && notes.length ? notes : notes ? [] : null;
    if (had !== !!this.played) {
      this.render();
      return;
    }
    this.drawPlayed();
  }

  drawPlayed() {
    const layer = this.svg.querySelector('.played-strip');
    if (!layer) return;
    if (!this.played) {
      layer.innerHTML = '';
      return;
    }
    const ex = this.exercise;
    const m = meterOf(ex);
    const out = [];
    const upTo = this.played.upToBar ?? ex.bars - 1;
    for (const bar of this.bars) {
      if (bar.index > upTo) continue;
      const line = this.lines.find((ln) => ln.bars.includes(bar));
      const y = line.top + this.staffTop + 4 * GAP + this.belowExtra + (this.counting ? 50 : 30);
      const b0 = bar.index * m.bpb;
      const x0 = bar.startX + 6, x1 = bar.endX - 4;
      const x = (beat) => x0 + ((beat - b0) / m.bpb) * (x1 - x0);
      out.push(`<rect class="strip-bg" x="${x0}" y="${y}" width="${x1 - x0}" height="12" rx="3"/>`);
      for (let c = 0; c <= m.bpb + 1e-9; c += m.click) out.push(`<line class="strip-tick" x1="${x(b0 + c)}" x2="${x(b0 + c)}" y1="${y - 3}" y2="${y}"/>`);
      for (const n of soundingNotes(ex)) {
        if (n.event.bar !== bar.index) continue;
        out.push(`<rect class="strip-written" x="${x(n.beat)}" y="${y + 1}" width="${Math.max(2, (n.beats / m.bpb) * (x1 - x0) - 2)}" height="10" rx="2"/>`);
      }
      for (const p of this.played) {
        const s0 = Math.max(p.start, b0 - 0.25), e0 = Math.min(p.end, b0 + m.bpb);
        if (e0 <= s0) continue;
        out.push(`<rect class="strip-played ${p.status ? `s-${p.status}` : ''}" x="${x(s0)}" y="${y + 3.5}" width="${Math.max(2, x(e0) - x(s0))}" height="5" rx="2"/>`);
      }
    }
    layer.innerHTML = out.join('');
  }

  /**
   * Counting under the staff: "1 e + a" for sixteenths, "1 trip let" for
   * triplets. Beats you hold through are shown in brackets, rests faded.
   */
  drawCounting() {
    const ex = this.exercise;
    const bpb = ex.beatsPerBar;
    const out = [];
    const label = (beat, x, li, text, cls) => {
      const y = this.lines[li].top + this.staffTop + 4 * GAP + this.belowExtra + 30;
      out.push(`<text class="count ${cls}" x="${x}" y="${y}">${text}</text>`);
    };
    ex.events.forEach((e, i) => {
      const pos = this.positions.get(i);
      const beatInBar = e.beat - e.bar * bpb;
      const text = meterOf(ex).compound ? compoundSyllable(beatInBar) : countSyllable(beatInBar);
      const x = pos.x ?? pos.slotX + pos.slotW / 2;
      if (!text) return; // fast notes between the syllables aren't labelled
      if (e.tied) label(e.beat, x, pos.line, `(${text})`, 'hold');
      else label(e.beat, x, pos.line, e.barRest ? `(${Array.from({ length: bpb }, (_, k) => k + 1).join(' ')})` : text, e.rest ? 'rest' : 'start');
      // Counts held through by long notes (beats; eighths in 6/8).
      const unit = meterOf(ex).compound ? 0.5 : 1;
      if (e.barRest || e.beats < 1 - 1e-9 || e.beats <= unit + 1e-9) return;
      const holds = [];
      for (let b = (Math.floor(e.beat / unit + 1e-9) + 1) * unit; b < e.beat + e.beats - 1e-9; b += unit) {
        holds.push({ b, n: Math.round((b - e.bar * bpb) / unit) + 1 });
      }
      if (!holds.length) return;
      const cls = e.rest ? 'rest' : 'hold';
      if (pos.slotW / (holds.length + 1) < 20) {
        // Not enough room for each count: show them together, e.g. "(5 6)".
        const text = holds.map((h) => h.n).join(' ');
        label(holds[0].b, pos.slotX + 7 + pos.slotW * 0.55, pos.line, e.rest ? text : `(${text})`, cls);
      } else {
        for (const h of holds) {
          const frac = (h.b - e.beat) / e.beats;
          label(h.b, pos.slotX + 7 + frac * pos.slotW, pos.line, e.rest ? String(h.n) : `(${h.n})`, cls);
        }
      }
    });
    return `<g class="counting">${out.join('')}</g>`;
  }

  setCounting(on) {
    if (this.counting === on) return;
    this.counting = on;
    this.render();
  }

  // ------------------------------------------------------------ results

  /**
   * Colour notes after scoring, and mark notes that were early or late.
   * @param {Map<number,string>} statuses event index -> status
   * @param {Map<number,number>} [offsets] event index -> timing error in ms
   */
  setResults(statuses, offsets = null) {
    this.statuses = statuses;
    this.offsets = offsets;
    const all = new Map(statuses);
    // Tied continuations take their first note's colour.
    this.exercise.events.forEach((e, i) => {
      if (e.tied && all.has(i - 1)) all.set(i, all.get(i - 1));
      if (e.tieNext && all.has(i)) all.set(`tie${i}`, all.get(i));
    });
    for (const el of this.svg.querySelectorAll('[data-idx]')) {
      const idx = Number(el.dataset.idx);
      const s = el.classList.contains('tie') ? all.get(`tie${idx}`) : all.get(idx);
      el.classList.remove('s-good', 's-close', 's-off', 's-missed', 's-wrong', 's-hit');
      if (s) el.classList.add(`s-${s}`);
    }
    // ◂ early / ▸ late, only for notes that were noticeably off.
    const marks = [];
    if (offsets) {
      for (const [idx, ms] of offsets) {
        const s = statuses.get(idx);
        if (s !== 'close' && s !== 'off') continue;
        const pos = this.positions.get(idx);
        const line = this.lines[pos.line];
        const y = line.top + this.staffTop + 4 * GAP + this.belowExtra + (this.counting ? 42 : 22);
        marks.push(`<text class="marker s-${s}" x="${pos.x}" y="${y}">${ms < 0 ? '◂' : '▸'}</text>`);
      }
    }
    this.markerLayer.innerHTML = marks.join('');
  }

  clearResults() {
    this.statuses = null;
    this.offsets = null;
    this.barLabels = null;
    for (const el of this.svg.querySelectorAll('[data-idx]')) {
      el.classList.remove('s-good', 's-close', 's-off', 's-missed', 's-wrong', 's-hit');
    }
    this.markerLayer.innerHTML = '';
    this.labelLayer.innerHTML = '';
    if (this.played) this.setPlayed(null);
  }

  /**
   * Show a verdict badge above bars, e.g. "Great" or "Early".
   * @param {({text: string, level: string}|null)[]} labels one per bar
   */
  setBarLabels(labels) {
    this.barLabels = labels;
    const parts = [];
    labels.forEach((l, b) => {
      if (!l) return;
      const bar = this.bars[b];
      const line = this.lines.find((ln) => ln.bars.includes(bar));
      const x = bar.startX + 6;
      const y = line.top + 4;
      const icon = l.level === 'good' ? '✓ ' : l.level === 'far' ? '✗ ' : '';
      const text = icon + l.text;
      const w = text.length * 6.4 + 14;
      parts.push(`<g class="bar-label ${l.level}"><rect x="${x}" y="${y}" width="${w}" height="18" rx="9"/><text x="${x + 7}" y="${y + 13}">${text}</text></g>`);
    });
    this.labelLayer.innerHTML = parts.join('');
  }

  /** Move the (optional) playhead to a beat, or hide it with null. */
  setCursor(beat) {
    if (beat == null || beat < 0 || beat > this.exercise.totalBeats) {
      this.cursor.setAttribute('visibility', 'hidden');
      return;
    }
    const line = this.lines.find((l) => beat < l.endBeat - 1e-9) || this.lines.at(-1);
    const a = line.anchors;
    let x = a.at(-1)[1];
    for (let k = 0; k < a.length - 1; k++) {
      if (beat >= a[k][0] && beat <= a[k + 1][0]) {
        const f = (beat - a[k][0]) / (a[k + 1][0] - a[k][0] || 1);
        x = a[k][1] + f * (a[k + 1][1] - a[k][1]);
        break;
      }
    }
    this.cursor.setAttribute('x1', x);
    this.cursor.setAttribute('x2', x);
    this.cursor.setAttribute('y1', line.top + this.staffTop - 12);
    this.cursor.setAttribute('y2', line.top + this.staffTop + 4 * GAP + 12);
    this.cursor.setAttribute('visibility', 'visible');
  }
}

/**
 * Which notes need a sharp, flat or natural sign. No key signature; an
 * accidental lasts until the end of the bar for that line or space, and a
 * natural cancels it. Tied continuations never repeat the sign.
 * @returns {Map<number, string>} event index -> '♯' | '♭' | '♮'
 */
export function accidentalsFor(exercise, toWritten) {
  const out = new Map();
  let bar = -1;
  let inForce = new Map();
  exercise.events.forEach((e, i) => {
    if (e.bar !== bar) {
      bar = e.bar;
      inForce = new Map();
    }
    if (e.rest || e.tied) return;
    const info = noteInfo(toWritten(e.midi));
    const key = `${info.letter}${info.octave}`;
    const current = inForce.get(key) || '';
    if (info.acc !== current) out.set(i, info.acc || '♮');
    inForce.set(key, info.acc);
  });
  return out;
}

/** 6/8 is counted in eighths, "1 2 3 4 5 6", with "+" for sixteenths. */
function compoundSyllable(beatInBar) {
  const eighths = beatInBar * 2;
  const whole = Math.round(eighths);
  if (Math.abs(eighths - whole) < 0.02) return String(whole + 1);
  return '+';
}

/** "1", "e", "+", "a" for sixteenths; "trip", "let" for triplets. */
function countSyllable(beatInBar) {
  const whole = Math.floor(beatInBar + 1e-9);
  const f = beatInBar - whole;
  const near = (v) => Math.abs(f - v) < 0.02;
  if (near(0)) return String(whole + 1);
  if (near(0.25)) return 'e';
  if (near(0.5)) return '+';
  if (near(0.75)) return 'a';
  if (near(1 / 3)) return 'trip';
  if (near(2 / 3)) return 'let';
  return '';
}

function head(x, y, filled) {
  return `<ellipse class="${filled ? 'head' : 'head hollow'}" cx="${x}" cy="${y}" rx="6.2" ry="4.5" transform="rotate(-20 ${x} ${y})"/>`;
}

function ledgers(x, step, bottom) {
  const out = [];
  for (let s = -2; s >= step; s -= 2) {
    const y = bottom - s * (GAP / 2);
    out.push(`<line class="staff-line" x1="${x - 10}" x2="${x + 10}" y1="${y}" y2="${y}"/>`);
  }
  for (let s = 10; s <= step; s += 2) {
    const y = bottom - s * (GAP / 2);
    out.push(`<line class="staff-line" x1="${x - 10}" x2="${x + 10}" y1="${y}" y2="${y}"/>`);
  }
  return out.join('');
}

/** The note value as printed (tuplets and dots aside), in quarters. */
function writtenValue(e) {
  if (e.written) return e.written;
  if (e.dots === 2) return e.beats / 1.75;
  if (e.dotted) return e.beats / 1.5;
  return e.beats;
}

/** Beams (or flags) for a written value: 1 for eighths, 2 sixteenths, 3 thirty-seconds. */
function beamCount(v) {
  if (v <= 0.125 + 1e-9) return 3;
  if (v <= 0.25 + 1e-9) return 2;
  return 1;
}

function noteGlyph(e, x, y, step, bottom) {
  const v = writtenValue(e);
  const filled = v <= 1;
  const out = [head(x, y, filled), ledgers(x, step, bottom)];
  if (v < 4) {
    const up = step < MIDDLE;
    const sx = up ? x + 5.6 : x - 5.6;
    const tip = up ? y - STEM : y + STEM;
    out.push(`<line class="stem" x1="${sx}" x2="${sx}" y1="${y}" y2="${tip}"/>`);
    if (v <= 0.5 + 1e-9) {
      for (let f = 0; f < beamCount(v); f++) {
        const t = up ? tip + f * 7 : tip - f * 7;
        out.push(up
          ? `<path class="flag" d="M${sx} ${t} c1 6 8 9 7.5 17 c2.5 -7 -3 -11 -7.5 -12 z"/>`
          : `<path class="flag" d="M${sx} ${t} c1 -6 8 -9 7.5 -17 c2.5 7 -3 11 -7.5 12 z"/>`);
      }
    }
  }
  out.push(dotsGlyph(e, x, y, step));
  return out.join('');
}

/** One dot, or two for double-dotted notes. */
function dotsGlyph(e, x, y, step) {
  const n = e.dots || (e.dotted ? 1 : 0);
  const onLine = ((step % 2) + 2) % 2 === 0;
  const cy = onLine ? y - GAP / 2 : y;
  let out = '';
  for (let k = 0; k < n; k++) out += `<circle class="dot" cx="${x + 11 + k * 5}" cy="${cy}" r="1.9"/>`;
  return out;
}

function restGlyph(beats, x, mid) {
  if (beats <= 0.25 + 1e-9) {
    // Sixteenth rest: an eighth rest with a second hook.
    return `<circle class="rest-fill" cx="${x - 1.5}" cy="${mid - 5}" r="2.2"/><circle class="rest-fill" cx="${x - 3.5}" cy="${mid + 1}" r="2.2"/><path class="rest-stroke thin" d="M${x - 1.5} ${mid - 3.3} Q${x + 2} ${mid - 2.5} ${x + 5} ${mid - 7} L${x - 1.5} ${mid + 13} M${x - 3.5} ${mid + 2.7} Q${x} ${mid + 3.5} ${x + 3.2} ${mid - 0.5}"/>`;
  }
  if (beats >= 2) {
    // Half rest: a block sitting on the middle line.
    return `<rect class="rest-fill" x="${x - 6}" y="${mid - GAP / 2}" width="12" height="${GAP / 2}"/>`;
  }
  if (beats >= 1) {
    return `<path class="rest-stroke" d="M${x - 3} ${mid - 14} L${x + 3} ${mid - 6.5} L${x - 2} ${mid - 1} L${x + 3.5} ${mid + 5.5} Q${x - 4.5} ${mid + 3} ${x + 0.5} ${mid + 14}"/>`;
  }
  return `<circle class="rest-fill" cx="${x - 2.5}" cy="${mid - 5}" r="2.4"/><path class="rest-stroke thin" d="M${x - 2.5} ${mid - 3.2} Q${x + 1} ${mid - 2.5} ${x + 4.5} ${mid - 7} L${x - 0.5} ${mid + 9}"/>`;
}
