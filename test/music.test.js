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
