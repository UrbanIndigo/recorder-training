// Pitch maths and note naming. MIDI note numbers are used throughout
// (C4 = 60, A4 = 69); fractional values represent pitches between notes.

const PITCH_CLASSES = [
  { name: 'C', letter: 'C', acc: '' },
  { name: 'C♯', letter: 'C', acc: '♯' },
  { name: 'D', letter: 'D', acc: '' },
  { name: 'E♭', letter: 'E', acc: '♭' },
  { name: 'E', letter: 'E', acc: '' },
  { name: 'F', letter: 'F', acc: '' },
  { name: 'F♯', letter: 'F', acc: '♯' },
  { name: 'G', letter: 'G', acc: '' },
  { name: 'G♯', letter: 'G', acc: '♯' },
  { name: 'A', letter: 'A', acc: '' },
  { name: 'B♭', letter: 'B', acc: '♭' },
  { name: 'B', letter: 'B', acc: '' },
];

const LETTERS = 'CDEFGAB';

export function noteInfo(midi) {
  const m = Math.round(midi);
  const pc = PITCH_CLASSES[((m % 12) + 12) % 12];
  const octave = Math.floor(m / 12) - 1;
  return { ...pc, midi: m, octave, label: `${pc.name}${octave}`, natural: pc.acc === '' };
}

/** Position on the staff: one step per letter name (C4 = 28). */
export function diatonicStep(midi) {
  const { letter, octave } = noteInfo(midi);
  return LETTERS.indexOf(letter) + 7 * octave;
}

export function midiToFreq(midi, a4 = 440) {
  return a4 * 2 ** ((midi - 69) / 12);
}

export function freqToMidi(freq, a4 = 440) {
  return 69 + 12 * Math.log2(freq / a4);
}

/** Describe an interval in semitones in plain words, e.g. "2 semitones higher". */
export function describeInterval(semitones) {
  const n = Math.abs(semitones);
  const dir = semitones > 0 ? 'higher' : 'lower';
  if (n === 0) return 'the same note';
  if (n === 12) return `an octave ${dir}`;
  if (n === 24) return `two octaves ${dir}`;
  return `${n} semitone${n === 1 ? '' : 's'} ${dir}`;
}
