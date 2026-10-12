import test from 'node:test';
import assert from 'node:assert/strict';
import { noteInfo, diatonicStep, midiToFreq, freqToMidi, describeInterval } from '../js/music.js';
import { RECORDERS, recorderNotes, writtenMidi } from '../js/recorders.js';

test('note naming', () => {
  assert.equal(noteInfo(60).label, 'C4');
  assert.equal(noteInfo(70).label, 'B♭4');
  assert.equal(noteInfo(78).label, 'F♯5');
  assert.equal(noteInfo(71.6).label, 'C5');
});

test('frequency conversion', () => {
  assert.equal(midiToFreq(69), 440);
  assert.ok(Math.abs(midiToFreq(72) - 523.25) < 0.01);
  assert.ok(Math.abs(freqToMidi(415, 415) - 69) < 1e-9);
});

test('staff positions', () => {
  assert.equal(diatonicStep(64), 30); // E4: bottom line of treble staff
  assert.equal(diatonicStep(77), 38); // F5: top line
  assert.equal(diatonicStep(61), diatonicStep(60)); // C♯ sits on C
});

test('soprano is written an octave below sounding', () => {
  const s = RECORDERS.soprano;
  assert.equal(noteInfo(writtenMidi(s, s.lowest)).label, 'C4');
  assert.equal(recorderNotes(s).length, 27);
  assert.equal(noteInfo(writtenMidi(RECORDERS.alto, RECORDERS.alto.lowest)).label, 'F4');
});

test('interval descriptions', () => {
  assert.equal(describeInterval(2), '2 semitones higher');
  assert.equal(describeInterval(-1), '1 semitone lower');
  assert.equal(describeInterval(12), 'an octave higher');
});

test('rhythm note sets cover the whole recorder range', async () => {
  const { rhythmPitches, RECORDERS: R } = await import('../js/recorders.js');
  const s = R.soprano;
  assert.deepEqual(rhythmPitches(s, '3').map((m) => noteInfo(writtenMidi(s, m)).name), ['G', 'A', 'B']);
  const octave = rhythmPitches(s, 'octave').map((m) => noteInfo(writtenMidi(s, m)).label);
  assert.deepEqual(octave, ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']);
  const range = rhythmPitches(s, 'range');
  assert.equal(range[0], s.lowest);
  assert.equal(range.at(-1), s.highest);
  assert.ok(range.every((m) => noteInfo(m).natural));
  assert.equal(rhythmPitches(s, 'chromatic').length, 27);
  // Alto (in F): its bottom octave of naturals starts on F.
  const alto = rhythmPitches(R.alto, 'octave').map((m) => noteInfo(m).name);
  assert.equal(alto[0], 'F');
});

test('accidentals follow the bar rules', async () => {
  const { accidentalsFor } = await import('../js/notation.js');
  // F, F#, F#, F (natural), | F#  (written pitches, C recorder at pitch)
  const ev = (beat, midi, bar) => ({ beat, beats: 1, rest: false, midi, bar });
  const ex = { events: [ev(0, 65, 0), ev(1, 66, 0), ev(2, 66, 0), ev(3, 65, 0), ev(4, 66, 1)] };
  const acc = accidentalsFor(ex, (m) => m);
  assert.deepEqual([...acc.entries()], [[1, '♯'], [3, '♮'], [4, '♯']]);
});
