// Recorder family. Ranges are the standard baroque-fingering ranges, in
// sounding pitch (MIDI). `octaveTransposition` is how many semitones the
// instrument sounds above the written note (soprano music is written an
// octave lower than it sounds, for example).

export const RECORDERS = {
  sopranino: {
    id: 'sopranino',
    name: 'Sopranino',
    shortName: 'Sopranino',
    keyName: 'F',
    lowest: 77, // F5
    highest: 103, // G7
    octaveTransposition: 12,
    clef: 'treble',
  },
  soprano: {
    id: 'soprano',
    name: 'Soprano (descant)',
    shortName: 'Soprano',
    keyName: 'C',
    lowest: 72, // C5
    highest: 98, // D7
    octaveTransposition: 12,
    clef: 'treble',
  },
  alto: {
    id: 'alto',
    name: 'Alto (treble)',
    shortName: 'Alto',
    keyName: 'F',
    lowest: 65, // F4
    highest: 91, // G6
    octaveTransposition: 0,
    clef: 'treble',
  },
  tenor: {
    id: 'tenor',
    name: 'Tenor',
    shortName: 'Tenor',
    keyName: 'C',
    lowest: 60, // C4
    highest: 86, // D6
    octaveTransposition: 0,
    clef: 'treble',
  },
  bass: {
    id: 'bass',
    name: 'Bass',
    shortName: 'Bass',
    keyName: 'F',
    lowest: 53, // F3
    highest: 79, // G5
    octaveTransposition: 12,
    clef: 'bass',
  },
};

export const DEFAULT_RECORDER = 'soprano';

/** All sounding notes the recorder can play, lowest first. */
export function recorderNotes(recorder) {
  const notes = [];
  for (let m = recorder.lowest; m <= recorder.highest; m++) notes.push(m);
  return notes;
}

export function writtenMidi(recorder, soundingMidi) {
  return soundingMidi - recorder.octaveTransposition;
}

/** Frequency window for the pitch detector, with some headroom. */
export function detectionRange(recorder, a4 = 440) {
  const f = (m) => a4 * 2 ** ((m - 69) / 12);
  return { minFreq: f(recorder.lowest) / 1.5, maxFreq: f(recorder.highest) * 2.1 };
}

/**
 * Notes to use in rhythm reading.
 * '1' / '3' / '5': one to five easy left-hand notes (written B; G A B;
 * G A B C D on a C recorder — the same fingerings on an F recorder);
 * 'octave': naturals over the bottom octave; 'range': every natural note
 * the recorder can play; 'chromatic': every note, sharps and flats too.
 */
export function rhythmPitches(recorder, setting) {
  const easy = { 1: [11], 3: [7, 9, 11], 5: [7, 9, 11, 12, 14] }[setting];
  if (easy) return easy.map((o) => recorder.lowest + o);
  const all = recorderNotes(recorder);
  const natural = (m) => [0, 2, 4, 5, 7, 9, 11].includes((((m - recorder.octaveTransposition) % 12) + 12) % 12);
  if (setting === 'octave') return all.filter((m) => m <= recorder.lowest + 12 && natural(m));
  if (setting === 'range') return all.filter(natural);
  if (setting === 'chromatic') return all;
  return [recorder.lowest + 11];
}

/** Whether rhythm reading should also check you played the right notes. */
export const checksPitch = (setting) => String(setting) !== '1';
