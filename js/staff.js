// Draws a single written note on a five-line staff as inline SVG.

import { noteInfo, diatonicStep } from './music.js?v=1.7';

// Diatonic step of the bottom staff line: E4 in treble clef, G2 in bass clef.
const BOTTOM_LINE = { treble: 30, bass: 18 };

export function staffSvg(writtenMidi, clef = 'treble') {
  const gap = 12; // distance between staff lines
  const half = gap / 2;
  const width = 170;
  const top = 58; // leaves room for ledger notes up to two octaves above the staff
  const bottomY = top + 4 * gap;
  const noteX = 112;
  const step = diatonicStep(writtenMidi);
  const offset = step - BOTTOM_LINE[clef];
  const y = bottomY - offset * half;
  const info = noteInfo(writtenMidi);

  const parts = [];
  for (let i = 0; i < 5; i++) {
    const ly = top + i * gap;
    parts.push(`<line x1="6" x2="${width - 6}" y1="${ly}" y2="${ly}" class="staff-line"/>`);
  }
  // Ledger lines below and above the staff.
  for (let o = -2; o >= offset; o -= 2) {
    const ly = bottomY - o * half;
    parts.push(`<line x1="${noteX - 14}" x2="${noteX + 14}" y1="${ly}" y2="${ly}" class="staff-line"/>`);
  }
  for (let o = 10; o <= offset; o += 2) {
    const ly = bottomY - o * half;
    parts.push(`<line x1="${noteX - 14}" x2="${noteX + 14}" y1="${ly}" y2="${ly}" class="staff-line"/>`);
  }

  const clefGlyph = clef === 'bass'
    ? `<text x="10" y="${top + gap * 1.9}" class="clef clef-bass">𝄢</text>`
    : `<text x="8" y="${top + gap * 3.35}" class="clef clef-treble">𝄞</text>`;
  parts.push(clefGlyph);

  if (info.acc) {
    parts.push(`<text x="${noteX - 26}" y="${y + 6}" class="accidental">${info.acc}</text>`);
  }
  parts.push(`<ellipse cx="${noteX}" cy="${y}" rx="7.6" ry="5.6" transform="rotate(-20 ${noteX} ${y})" class="notehead"/>`);

  // Stem: down from notes on/above the middle line, otherwise up.
  const stemUp = offset < 4;
  const stemX = stemUp ? noteX + 6.6 : noteX - 6.6;
  const stemY2 = stemUp ? y - 3.3 * gap : y + 3.3 * gap;
  parts.push(`<line x1="${stemX}" x2="${stemX}" y1="${y + (stemUp ? -1 : 1)}" y2="${stemY2}" class="stem"/>`);

  return `<svg viewBox="0 0 ${width} 130" role="img" aria-label="Written note ${info.label}" class="staff">${parts.join('')}</svg>`;
}
