// Ready-made decks for the Learn mode. Anatomy decks are built from
// anatomy.js (with the body diagram); the rest are question → answer
// cards. `reverse` decks are asked both ways round.

import { MUSCLES, BONES, viewsOf } from './anatomy.js?v=3.9';

const pairs = (list) => list.map(([q, a, note]) => ({ q, a, note }));

const CAPITALS = pairs([
  ['France', 'Paris'], ['Germany', 'Berlin'], ['Italy', 'Rome'], ['Spain', 'Madrid'], ['Portugal', 'Lisbon'],
  ['United Kingdom', 'London'], ['Ireland', 'Dublin'], ['Netherlands', 'Amsterdam', 'The government sits in The Hague.'],
  ['Belgium', 'Brussels'], ['Switzerland', 'Bern'], ['Austria', 'Vienna'], ['Poland', 'Warsaw'], ['Czechia', 'Prague'],
  ['Hungary', 'Budapest'], ['Greece', 'Athens'], ['Turkey', 'Ankara', 'Not Istanbul, the biggest city.'], ['Russia', 'Moscow'],
  ['Ukraine', 'Kyiv'], ['Sweden', 'Stockholm'], ['Norway', 'Oslo'], ['Denmark', 'Copenhagen'], ['Finland', 'Helsinki'],
  ['Iceland', 'Reykjavík'], ['Egypt', 'Cairo'], ['Nigeria', 'Abuja', 'Not Lagos, the biggest city.'], ['Kenya', 'Nairobi'],
  ['Morocco', 'Rabat'], ['Ethiopia', 'Addis Ababa'], ['Ghana', 'Accra'],
  ['South Africa', 'Pretoria', 'Pretoria is the seat of government; Cape Town (parliament) and Bloemfontein (courts) are capitals too.'],
  ['United States', 'Washington, D.C.'], ['Canada', 'Ottawa', 'Not Toronto.'], ['Mexico', 'Mexico City'],
  ['Brazil', 'Brasília', 'Not Rio de Janeiro or São Paulo.'], ['Argentina', 'Buenos Aires'], ['Chile', 'Santiago'], ['Peru', 'Lima'],
  ['Colombia', 'Bogotá'], ['Cuba', 'Havana'], ['China', 'Beijing'], ['Japan', 'Tokyo'], ['South Korea', 'Seoul'],
  ['India', 'New Delhi'], ['Pakistan', 'Islamabad'], ['Thailand', 'Bangkok'], ['Vietnam', 'Hanoi'], ['Philippines', 'Manila'],
  ['Australia', 'Canberra', 'Not Sydney.'], ['New Zealand', 'Wellington'], ['Saudi Arabia', 'Riyadh'], ['Iran', 'Tehran'],
  ['Mongolia', 'Ulaanbaatar'], ['Nepal', 'Kathmandu'],
]);

const ELEMENTS = pairs([
  ['H', 'Hydrogen', 'Number 1'], ['He', 'Helium', 'Number 2'], ['Li', 'Lithium', 'Number 3'], ['Be', 'Beryllium', 'Number 4'],
  ['B', 'Boron', 'Number 5'], ['C', 'Carbon', 'Number 6'], ['N', 'Nitrogen', 'Number 7'], ['O', 'Oxygen', 'Number 8'],
  ['F', 'Fluorine', 'Number 9'], ['Ne', 'Neon', 'Number 10'], ['Na', 'Sodium', 'Number 11; from Latin natrium.'],
  ['Mg', 'Magnesium', 'Number 12'], ['Al', 'Aluminium', 'Number 13'], ['Si', 'Silicon', 'Number 14'], ['P', 'Phosphorus', 'Number 15'],
  ['S', 'Sulfur', 'Number 16'], ['Cl', 'Chlorine', 'Number 17'], ['Ar', 'Argon', 'Number 18'],
  ['K', 'Potassium', 'Number 19; from Latin kalium.'], ['Ca', 'Calcium', 'Number 20'], ['Ti', 'Titanium', 'Number 22'],
  ['Cr', 'Chromium', 'Number 24'], ['Mn', 'Manganese', 'Number 25'], ['Fe', 'Iron', 'Number 26; from Latin ferrum.'],
  ['Co', 'Cobalt', 'Number 27'], ['Ni', 'Nickel', 'Number 28'], ['Cu', 'Copper', 'Number 29; from Latin cuprum.'],
  ['Zn', 'Zinc', 'Number 30'], ['Br', 'Bromine', 'Number 35'], ['Kr', 'Krypton', 'Number 36'],
  ['Ag', 'Silver', 'Number 47; from Latin argentum.'], ['Sn', 'Tin', 'Number 50; from Latin stannum.'], ['I', 'Iodine', 'Number 53'],
  ['Pt', 'Platinum', 'Number 78'], ['Au', 'Gold', 'Number 79; from Latin aurum.'], ['Hg', 'Mercury', 'Number 80; from Latin hydrargyrum.'],
  ['Pb', 'Lead', 'Number 82; from Latin plumbum.'], ['Rn', 'Radon', 'Number 86'], ['U', 'Uranium', 'Number 92'],
]);

const GREEK = pairs([
  ['α Α', 'Alpha'], ['β Β', 'Beta'], ['γ Γ', 'Gamma'], ['δ Δ', 'Delta'], ['ε Ε', 'Epsilon'], ['ζ Ζ', 'Zeta'],
  ['η Η', 'Eta'], ['θ Θ', 'Theta'], ['ι Ι', 'Iota'], ['κ Κ', 'Kappa'], ['λ Λ', 'Lambda'], ['μ Μ', 'Mu'],
  ['ν Ν', 'Nu'], ['ξ Ξ', 'Xi'], ['ο Ο', 'Omicron'], ['π Π', 'Pi'], ['ρ Ρ', 'Rho'], ['σ Σ', 'Sigma', 'Written ς at the end of a word.'],
  ['τ Τ', 'Tau'], ['υ Υ', 'Upsilon'], ['φ Φ', 'Phi'], ['χ Χ', 'Chi'], ['ψ Ψ', 'Psi'], ['ω Ω', 'Omega'],
]);

/**
 * The built-in decks. Diagram decks list anatomy items and the ways to ask
 * about them: 'name' (it's lit up: what is it?), 'find' (tap it), 'job'
 * (what it does → which one).
 */
export const DECKS = [
  { id: 'muscles', title: 'Muscles', icon: '💪', blurb: 'Name the main surface muscles, and find them on the body.', items: MUSCLES, modes: ['name', 'find'], group: 'Anatomy' },
  { id: 'bones', title: 'Bones', icon: '🦴', blurb: 'The main bones of the skeleton.', items: BONES, modes: ['name', 'find'], group: 'Anatomy' },
  { id: 'muscle_jobs', title: 'What does it do?', icon: '🏋️', blurb: 'Which muscle does that job? Bends the elbow, points the foot…', items: MUSCLES.filter((m) => m.id !== 'achilles'), modes: ['job'], group: 'Anatomy' },
  { id: 'capitals', title: 'World capitals', icon: '🌍', blurb: 'Capital cities, both ways round.', cards: CAPITALS, reverse: true, prompt: ['Capital of {q}?', '{a} is the capital of…'], group: 'Random knowledge' },
  { id: 'elements', title: 'Chemical elements', icon: '⚗️', blurb: 'Symbols and names, both ways round.', cards: ELEMENTS, reverse: true, prompt: ['Which element is {q}?', 'Symbol for {a}?'], group: 'Random knowledge' },
  { id: 'greek', title: 'Greek alphabet', icon: 'Ω', blurb: 'The 24 letters, as used in maths and science.', cards: GREEK, prompt: ['Which letter is {q}?'], group: 'Random knowledge' },
];

/** A user's own deck, made from pasted "question = answer" lines. */
export function customDeck(d) {
  return { id: d.id, title: d.title, icon: '📝', blurb: `${d.cards.length} cards you made.`, cards: d.cards, reverse: !!d.reverse, prompt: ['{q}', '{a}'], group: 'Your decks', custom: true };
}

/**
 * Every card in a deck, as {id, mode, ...}: for anatomy decks, one per
 * item per mode (and per view, for muscles drawn front and back, so you
 * learn both); for question decks, one per card per direction.
 */
export function deckCards(deck) {
  if (deck.items) {
    const out = [];
    for (const it of deck.items) {
      for (const mode of deck.modes) {
        if (mode === 'job') out.push({ id: `${it.id}:job`, mode, item: it });
        else for (const view of viewsOf(it)) out.push({ id: `${it.id}:${mode}:${view}`, mode, item: it, view });
      }
    }
    // Learn names first, then finding, so a new item is met before you hunt for it.
    return out.sort((a, b) => (a.mode === 'find') - (b.mode === 'find'));
  }
  // Each card one way round first; the other way once you've met them all.
  const fwd = deck.cards.map((c, i) => ({ id: `${i}:f`, mode: 'text', q: c.q, a: c.a, note: c.note, dir: 0 }));
  const rev = deck.reverse ? deck.cards.map((c, i) => ({ id: `${i}:r`, mode: 'text', q: c.a, a: c.q, note: c.note, dir: 1 })) : [];
  return [...fwd, ...rev];
}

/** The prompt text for a question card. */
export function promptFor(deck, card) {
  const tpl = deck.prompt?.[card.dir] ?? '{q}';
  return tpl.replace('{q}', card.q).replace('{a}', card.q);
}
