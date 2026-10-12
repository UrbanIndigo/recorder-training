// A small piano keyboard drawn as SVG, with chosen keys highlighted.

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'];

/**
 * @param {{midi: number, label?: string, bass?: boolean}[]} marks keys to highlight
 * @param {{octaves?: number}} [opts]
 */
export function keyboardSvg(marks, { minOctaves = 2 } = {}) {
  const midis = marks.map((k) => k.midi);
  let lo = midis.length ? Math.floor(Math.min(...midis) / 12) * 12 : 48;
  let hi = midis.length ? Math.floor(Math.max(...midis) / 12) * 12 + 11 : 71;
  while ((hi + 1 - lo) / 12 < minOctaves) hi += 12;
  const W = 24, H = 96, BW = 15, BH = 60;
  const whites = [];
  for (let m = lo; m <= hi; m++) if (WHITE_PCS.includes(m % 12)) whites.push(m);
  const x = new Map();
  whites.forEach((m, i) => x.set(m, i * W));
  const byMidi = new Map(marks.map((k) => [k.midi, k]));
  const parts = [];
  for (const m of whites) {
    const mark = byMidi.get(m);
    parts.push(`<rect class="key white${mark ? (mark.bass ? ' bass' : ' on') : ''}" x="${x.get(m) + 0.5}" y="0.5" width="${W - 1}" height="${H}" rx="3"/>`);
    if (m % 12 === 0) parts.push(`<text class="key-c" x="${x.get(m) + W / 2}" y="${H - 6}">C${m / 12 - 1}</text>`);
    if (mark) parts.push(`<text class="key-label" x="${x.get(m) + W / 2}" y="${H - (m % 12 === 0 ? 20 : 8)}">${mark.label ?? NAMES[m % 12]}</text>`);
  }
  for (let m = lo; m <= hi; m++) {
    if (WHITE_PCS.includes(m % 12)) continue;
    const left = x.get(m - 1);
    if (left == null) continue;
    const mark = byMidi.get(m);
    const bx = left + W - BW / 2;
    parts.push(`<rect class="key black${mark ? (mark.bass ? ' bass' : ' on') : ''}" x="${bx}" y="0.5" width="${BW}" height="${BH}" rx="2"/>`);
    if (mark) parts.push(`<text class="key-label on-black" x="${bx + BW / 2}" y="${BH - 7}">${mark.label ?? NAMES[m % 12]}</text>`);
  }
  const width = whites.length * W + 1;
  return `<svg class="keyboard" viewBox="0 0 ${width} ${H + 1}" width="100%" role="img" aria-label="Piano keyboard">${parts.join('')}</svg>`;
}
