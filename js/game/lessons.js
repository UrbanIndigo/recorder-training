// Beat Ward tutorials: an introduction for every ward, and a lesson card
// for each rhythm a ward brings in (what it's called, how to count it).
// No DOM code.

import { introductions } from './song.js?v=3.5';

/** What each ward is about, shown first in its tutorial. */
export const WARD_INTROS = {
  1: {
    title: 'WELCOME, DOCTOR',
    text: 'The music is on your clipboard and scrolls slowly up. Keep time with the drums and play each note as it comes: press when the note starts and hold it for its length. Rests mean silence, so don’t tap. Every hit damages the boss; misses and extra taps hurt the patient.',
  },
  2: { title: 'EIGHTH NOTES', text: 'Eighth notes split a beat in two. Count "1 + 2 + 3 + 4 +": the number is on the beat, "+" (say "and") is halfway between.' },
  3: { title: 'OFF THE BEAT', text: 'Syncopation puts notes on the "+" between beats. Keep counting "1 + 2 +" steadily in your head and play exactly where the notes are, even when nothing lands on the beat.' },
  4: { title: 'SIXTEENTH NOTES', text: 'Sixteenths split a beat in four. Count "1 e + a" (say "one ee and uh"). Two beams mean sixteenths, one beam means eighths. The rhythms below mix the two.' },
  5: { title: 'TRIPLETS', text: 'A "3" over a group means three notes in one beat instead of two. Count "1 trip let 2 trip let", evenly, and don’t let them turn into a long note and two short ones.' },
  6: { title: 'TWO HANDS', text: 'Now there are two staves, joined like piano music. The top staff (pink) is your right hand: J, Space or the R pad. The bottom staff (blue) is your left hand: F or the L pad. Notes lined up above each other are played together.' },
  7: { title: '6/8 TIME', text: 'In 6/8 there are six eighth notes in a bar, felt as two big beats of three. Count "1 + a 2 + a". A dotted quarter is one whole big beat; a quarter + eighth is "1 _ a".' },
  8: { title: 'CODE BLUE', text: 'Everything you’ve learnt, faster, with both hands. One last new trick first: a tie joins two notes into one longer note, so play the first and hold through the second.' },
};

/** Name and how-to for each rhythm used in the game. */
export const CELL_INFO = {
  quarter: { name: 'QUARTER NOTE', text: 'A filled note with a stem: one beat long. Play on the count and hold until the next.' },
  half: { name: 'HALF NOTE', text: 'An open note with a stem: two beats long. Play on "1" and hold through "2".' },
  quarterRest: { name: 'QUARTER REST', text: 'The squiggle is a rest: one beat of silence. Keep counting, but don’t play.' },
  eighths: { name: 'TWO EIGHTH NOTES', text: 'Joined by one beam: two notes in one beat. Play on "1" and on "+".' },
  restEighth: { name: 'EIGHTH REST + EIGHTH', text: 'A short rest on the beat, then a note on the "+". Count "1 +" and play only on "+".' },
  eighthRest: { name: 'EIGHTH + EIGHTH REST', text: 'A short note on the beat, then silence on the "+". Play on "1", let go on "+".' },
  syncopation: { name: 'SYNCOPATION', text: 'Eighth – quarter – eighth: "1 + _ +". The long middle note starts on the "+" and carries over the next beat.' },
  dottedQuarterEighth: { name: 'DOTTED QUARTER + EIGHTH', text: 'A dot adds half the note’s length: a dotted quarter is 1½ beats. Play on "1", hold through "2", then a quick note on "2 +".' },
  offbeatQuarters: { name: 'OFF-BEAT QUARTERS', text: 'Quarter notes that start on the "+": "1 + _ + _ +". Each note crosses a beat, so count carefully.' },
  sixteenths: { name: 'FOUR SIXTEENTHS', text: 'Two beams: four even notes in one beat. "1 e + a".' },
  eighthTwoSixteenths: { name: 'EIGHTH + TWO SIXTEENTHS', text: 'Long – short – short: "1 _ + a". The beam over all three, plus a second beam on the last two.' },
  twoSixteenthsEighth: { name: 'TWO SIXTEENTHS + EIGHTH', text: 'Short – short – long: "1 e + _". The second beam is on the first two notes.' },
  dottedEighthSixteenth: { name: 'DOTTED EIGHTH + SIXTEENTH', text: 'Long – short: "1 _ _ a". The dotted eighth takes three quarters of the beat; the sixteenth sneaks in just before the next beat.' },
  scotchSnap: { name: 'SCOTCH SNAP', text: 'Short – long: "1 e _ _". A quick sixteenth on the beat, then a dotted eighth. The reverse of the dotted eighth + sixteenth.' },
  sixteenthEighthSixteenth: { name: 'SIXTEENTH – EIGHTH – SIXTEENTH', text: 'Short – long – short: "1 e _ a". Stubs of a second beam on the outside notes mark the two sixteenths.' },
  triplet: { name: 'EIGHTH-NOTE TRIPLET', text: 'Three even notes in one beat: "1 trip let".' },
  tripletRestMiddle: { name: 'TRIPLET WITH A REST', text: 'A triplet with its middle note silent: play "1" and "let", skip "trip".' },
  quarterTriplet: { name: 'QUARTER-NOTE TRIPLET', text: 'Three even notes across two beats: slower than eighth triplets. Think of six triplet eighths and play every other one.' },
  tripletRestFirst: { name: 'TRIPLET, REST FIRST', text: 'A triplet starting with silence: skip the beat, play "trip let".' },
  sixteenthTriplet: { name: 'SIXTEENTH TRIPLET + EIGHTH', text: 'Three very quick notes in the first half of the beat, then an eighth on the "+". A flick: "1-trip-let +".' },
  c_threeEighths: { name: 'THREE EIGHTHS (6/8)', text: 'One big beat in 6/8 split in three: "1 + a".' },
  c_quarterEighth: { name: 'QUARTER + EIGHTH (6/8)', text: 'Long – short in one big beat: "1 _ a". A lilting, skipping feel.' },
  c_eighthQuarter: { name: 'EIGHTH + QUARTER (6/8)', text: 'Short – long: "1 + _". The quarter starts on the "+".' },
  c_dottedQuarter: { name: 'DOTTED QUARTER (6/8)', text: 'One whole big beat: play on "1" and hold through "+ a".' },
  c_siciliano: { name: 'SICILIANO', text: 'Dotted eighth, sixteenth, eighth: a gentle limp, "1 _ a +". Common in slow 6/8 dances.' },
  c_sixteenths: { name: 'SIXTEENTHS IN 6/8', text: 'The first eighth of the beat split in two: "1 e + a" squeezed into the start of the big beat.' },
  tiedSyncopation: { name: 'TIED SYNCOPATION', text: 'The curved tie joins two notes into one: play the first and hold through the second. "1 + _ +".' },
};

/**
 * A ward's tutorial: the introduction, then one lesson per new rhythm.
 * Ward 6 (two hands) gets a two-handed practice instead.
 */
export function tutorialFor(level) {
  const steps = [{ kind: 'intro', ...WARD_INTROS[level.id] }];
  for (const cell of introductions(level).keys()) {
    steps.push({ kind: 'cell', cell, title: CELL_INFO[cell]?.name || cell.toUpperCase(), text: CELL_INFO[cell]?.text || '' });
  }
  if (level.hands === 2 && steps.length === 1) {
    steps.push({ kind: 'hands', title: 'BOTH HANDS', text: 'Try the two staves together. Read down as well as across: where notes line up, press both.' });
  }
  return steps;
}

/** Cells for a lesson's practice bars: mostly the new rhythm, with plain beats around it. */
export function lessonCells(level, step) {
  const compound = level.meter === '6/8';
  const plain = compound ? 'c_dottedQuarter' : 'quarter';
  if (step.kind === 'cell') return { [step.cell]: step.cell === plain ? 1 : 3, [plain]: step.cell === plain ? 0.001 : 2 };
  return level.cells;
}

/** How to count a note starting `beatInBar` quarters into the bar: "1", "e", "+", "a", "trip", "let". */
export function countLabel(beatInBar, compound) {
  if (compound) {
    // 6/8: two big beats of three eighths, "1 + a 2 + a".
    const eighths = beatInBar * 2;
    const whole = Math.round(eighths);
    if (Math.abs(eighths - whole) > 0.02) return 'e';
    return [String(Math.floor(whole / 3) + 1), '+', 'a'][whole % 3];
  }
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
