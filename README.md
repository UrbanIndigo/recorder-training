# Recorder Trainer

**Use it here: https://urbanindigo.github.io/recorder-training/** (works on phones too — allow the microphone when asked).

A practice app for recorder players that runs in the browser. It listens through your microphone, works out which note you're playing and how in tune it is, and scores you.

Supports **sopranino, soprano (descant), alto (treble), tenor and bass** recorders. Note names are shown as written in your music. For example, soprano low C is shown as written C4, though it sounds as C5.

## Training modes

### Long Tone
Pick a note and hold it for 10 seconds (5, 15 and 20 are options too). The timer starts when you start playing. While you play you see:
- whether you're on the **right note**, or which note you're playing instead
- a needle showing how many **cents sharp or flat** you are
- a live graph of your pitch

When you finish you get a score out of 100 and a breakdown:
| | What it measures |
|---|---|
| **Right note?** | % of the time you were on the target note (it names the note you played if it was a different one, e.g. "an octave higher" when you overblow) |
| **How in tune?** | average cents sharp/flat while on the note, and % of time within ±10¢ |
| **Steadiness** | how much the pitch wobbled |
| **Held for** | how long the note kept sounding |

You also get tips based on the result. Your best score on each note is saved in the browser and shown as a coloured dot in the note picker.

### Rhythm Reading — Endless
A scrolling score that keeps going until you stop. After one bar of count-in the metronome never stops: you play one bar after another with no breaks.
- **About five bars on screen:** the last two you played (with your score and a verdict), the bar you're on (highlighted), and **just one bar ahead**. The score scrolls up a row as each bar ends.
- **Bars you get wrong come back two bars later**, marked "again" with the counting shown. The bar right below you never changes, so there are no surprises.
- New patterns unlock, and the tempo speeds up or slows down, at a bar line without stopping. Time signatures can change from bar to bar.
- **Levels up on its own.** You start with quarter notes. 45 stages unlock one at a time once you're consistently scoring well:
  - **basics:** half notes, whole notes, quarter, half and whole-bar rests, dotted halves, 3/4
  - **eighths:** eighths, off-beat eighths, dotted quarter + eighth, 2/4, syncopation, eighth rests, ties
  - **sixteenths and triplets:** sixteenths, eighth + two sixteenths, two sixteenths + eighth, dotted eighth + sixteenth, triplets
  - **harder syncopation:** quarter–half–quarter, eighth + dotted quarter, tied syncopation, off-beat quarters
  - **sixteenth variations:** sixteenth–eighth–sixteenth, Scotch snap, eighth rest + two sixteenths, sixteenth rests, quarter-note triplets
  - **6/8 time:** dotted quarters, three eighths, quarter + eighth, eighth + quarter, dotted-quarter rests, sixteenths, and the siciliano rhythm
  - **tuplets:** triplets with rests, sixteenth-note triplets, quintuplets, 6/8 duplets
  - **fast notes and double dots:** thirty-second notes, dotted sixteenth + thirty-second, double-dotted quarter + sixteenth, double-dotted half + eighth
  - **more kinds of rest:** coming in after a rest (rhythms can now start with one), sixteenth rests mid-beat, dotted eighth rest + sixteenth

  Each new rhythm gets a short explanation card with how to count it. Once everything is unlocked, the tempo creeps up instead.
- **Targets your weak spots.** It tracks how well you do on each rhythm pattern and gives you the hard ones more often. If you're struggling, it slows down.
- **A verdict for every bar.** As each bar scrolls up it gets a score and a verdict ("Great", "Early", "Late", "Too short", "Missed a note", "Played in a rest"…).
- **What to work on.** It tracks recurring problems for each rhythm pattern (rushing eighths, cutting half notes short, playing through rests…). It lists your top ones with a tip, and gives you more of those patterns.
- **Nothing gives the timing away before you play.** Notes are spaced like printed music, not by length, and there's no moving line unless you turn it on. After a bar is scored, its notes are coloured and ◂ / ▸ marks show which were early or late.
- Progress is saved. Options let you jump ahead a stage, always show counting, or start over.

### Rhythm Reading — Practice
Pick a level and practise reading rhythms. You get a random 4-bar rhythm in sheet music, at one of thirteen levels:
1. Whole, half & quarter notes
2. Rests & 3/4 time
3. Eighth notes
4. Dotted rhythms
5. Syncopation
6. Sixteenth notes
7. Ties, dotted eighths & triplets
8. Advanced syncopation
9. Tricky sixteenths
10. 6/8 time
11. Tuplets
12. Fast notes & double dots
13. Rests everywhere

Press **Hear it** to hear how it goes. Press **Play it** to hear a one-bar count-in and then play along with the metronome. Afterwards each note is coloured by timing: green is within ±60 ms, yellow is a bit off, red is off the beat, and grey means missed. ◂ / ▸ marks show which way off notes were. You also get:
- how many notes were on time
- whether you tend to **rush** or **drag**, and by how much
- whether notes were held for their full length
- missed and extra notes, including playing through a rest

**Notes to play** (both Endless and Practice):
- one note (B)
- 3 or 5 easy left-hand notes
- one octave
- the whole range of your recorder in naturals
- the whole range with sharps and flats

With more than one note, wrong pitches are marked too. The music uses ledger lines for high and low notes, and sharps, flats and naturals that last to the end of the bar. Beams slope with the melody, and bass recorder reads in bass clef. Tempo goes from 40 to 140 bpm.

**Play with the microphone or a tap button:** in Endless options, or next to the level in Practice, choose **Tap button** to hold a big pad (or the Space bar on a computer) for each note instead of playing into the mic. Press when a note starts and let go when it ends, so it judges both timing and note length. It uses each touch's exact time and allows for the speaker's delay. Pitch isn't checked in this mode.

**Timing calibration:** phones and Bluetooth headphones add a delay between the click and the mic. If you keep being told you're late, open *Timing calibration* and play 8 short notes on the clicks. The app measures the delay and allows for it.

### Piano Chords
Asks for a chord, like **G major, 1st inversion (G/B)**. You play it on the piano, tap **Show answer** to compare (keyboard picture with the bass note marked, note names, and **Hear it** to listen), then mark yourself honestly: **I got it** or **I didn't**. Then straight on to the next chord.

- **Chord types:**
  - triads: major, minor, diminished, augmented
  - suspended and added: sus2, sus4, 6, minor 6, add9
  - sevenths: dominant 7, major 7, minor 7, half-diminished, diminished 7, minor-major 7, 7sus4
  - ninths: 9, major 9, minor 9
- **Inversions and roots:** every inversion, from all 12 roots, spelled properly (E♭ minor is E♭ G♭ B♭; G♯° rather than A♭°).
- **What to practise:** pick a ready-made set (major triads → triad inversions → 7th chords → … → everything) or choose your own chord types, inversions and roots.
- **Adapts:** missed chords come back two chords later, and weaker chord types and inversions come up more often. A table shows your accuracy and speed (time until you revealed the answer) for each.
- **On a computer:** Space shows the answer, then Y/→ for got it, N/← for didn't.

### Beat Ward (game)

A pixel-art rhythm game and boss rush that trains you to read real sheet music. The music is on the doctor's clipboard: a five-line staff with a clef, time signature, bar lines and engraved spacing, plus all the notation (beams, flags, dots, ties, triplets, rests). The music stays still while you read it. Keep time with the count-in and drums and play each note: press at its start and hold it for its length. Each hit plays the tune and shoots the ward's germ boss.

- **A page that scrolls steadily:** lines of two bars scroll slowly upwards at an even speed, one line for every two bars played. The line you're playing stays near the top and the next comes up underneath to read ahead. A soft highlight shows which bar you're in. Notes turn green, yellow or orange when you hit them, and red if you miss.
- **Boss fights:** your hits wear the boss down (Perfect does the most damage). Take its HP to zero to beat it; that's the same as 65% accuracy. Misses hurt the patient, and if their health runs out they flatline.
- **Boss attacks:** each chorus is an attack, with a siren a bar before and red lights. Misses cost more during attacks, and some bosses have gimmicks:
  - Arrhythmia and Fever Bug jolt the clipboard on every bar.
  - Tri-Clops and Night Terror fog the next line until just before you reach it, so you have to sight-read fast.
  - Code Blue does both.
- **A tutorial for every ward:** the first time you play a ward, it opens with a card on what's new, then a lesson for each new rhythm. Each lesson shows four bars of the rhythm with the counting written under the notes ("1 e + a", T/L for triplet "trip-let"). **Hear it** plays it for you; **Try it** is your go, with feedback (notes on time, early or late, long notes let go too soon, extra taps). Replay it any time with **Tutorial for this ward** in the menu.
- **Easing in during the song:** new rhythms arrive one at a time, and the counting is pencilled in under each new rhythm's first few bars.
- **Unlimited mode (∞):** an endless, adaptive run.
  - **Placement first:** the opening lines jump you up a ladder of 21 rhythms (quarter notes up to triplets and tied syncopations) until you start to struggle. Lines are written ahead on the assumption you'll keep passing, so a strong player reaches the top in about a minute. Notes written during placement can't hurt the patient, and you're told "YOUR LEVEL: n".
  - **Then it adapts line by line:** every clean line adds the next rhythm (two near-perfect lines in a row skip one ahead), announced as **NEW: …** with its counting under its first bars. While you're on a streak, the lines written ahead already bring in the next rhythm. A shaky line (under 75%) eases off, and it waits for two clean lines before trying harder again. Rhythms you play badly come up more often.
  - **Rounds:** play comes in short rounds of four lines. After a good round the tempo goes up (+5 BPM, or +8 for a near-perfect round, more once every rhythm is in play); after a bad one it comes down.
  - **Read ahead (optional):** with 👁 READ AHEAD on, the bar you're playing is covered as it starts ("FROM MEMORY"), so you must have read it before you got there, the way good sight-readers look ahead. It's revealed, with your notes marked, as soon as it's over.
  - **The run:** one germ after another, until the patient flatlines. The results show your level, the hardest rhythm you reached, top tempo, germs beaten and the rhythms to work on. Your best run is saved.
- **One or two hands, for everything:** every ward (and Unlimited) has a 1 hand / 2 hands choice. One-hand wards played with two hands add a simple left-hand bass part on its own staff; two-hand wards can be played right hand only.
- **Ties across the bar line:** from ward 3 (and in Unlimited, once syncopation is in play), a note is sometimes tied over the bar line into the next bar. Hold it through.
- **Eight wards**, from quarter notes at 84 BPM up to sixteenths, dotted rhythms, triplets and 6/8 at 124 BPM. Any ward can be played at any time.
- **BPM control:** set any tempo for a ward (40–200 BPM) with the slider or the −/+ buttons. New wards start at 70% of their tempo so you can learn the new rhythms, and each win nudges the BPM up by 15% until full tempo. A ✓ marks wards beaten at full tempo.
- **Fresh rhythms every play:** each song keeps its key, chords, tempo and verse/chorus shape, but its rhythms are generated anew each time (verses repeat with variations), so you read them rather than memorise them.
- **Two hands:** from ward 6 the music is on two staves, joined like piano music. Left hand (blue, F key or the L pad) plays the bass; right hand (pink, J/Space or the R pad) plays the tune. They often land together.
- **You hear what you hold:** pressing sounds the note for as long as you hold it, with a little vibrato on long notes. A stray press sounds too, more quietly.
- **Note lengths count:** quarter notes and longer must be held for most of their value. Let go too soon and the hit drops a grade (**TOO SHORT**). The sound lasts as long as you hold, and after you play, a bar under the staff shows how long you held each note. Quicker notes can just be tapped.
- **No mashing:** a tap with no note to play is an **EXTRA**. It breaks your combo, hurts the patient, heals the boss and counts against your accuracy.
- **Phones:** each held note belongs to the finger that started it, so tapping fast notes with two thumbs on one pad works. A tap goes to the earliest note still waiting (unless a later one is clearly closer), so a steady audio delay doesn't make taps jump to the next fast note. If your hits are steadily early or late, the results screen offers **FIX TIMING**, which corrects the audio offset in one tap.
- **Judging:** Perfect within 45 ms, Good within 90 ms, OK within 140 ms. At the end you get a grade (S–D) plus counts of early and late hits. If your hits are always early or late, nudge the audio offset.
- **On a phone,** turn it sideways: the game fills the screen with a pad on each side.

### Ear Training (scale degrees)

Hear a key, then name notes by their **scale degree** (do re mi, or 1–7), not by interval: hear it, know which degree it is, find it on your recorder.

- **Setting the key:** every drill starts by setting up the key with a I–IV–V–I cadence (or a tonic drone with a rising scale). **⌂ Key** (or C) plays it again whenever you need reminding of home.
- **Degrees (main drill):** after the key, one note plays; pick its degree on the big buttons (or keys 1–7, 8 = high do, Shift+5/6/7 = low). A wrong answer replays the note, then home, then the note again, so you hear how it sits.
  - Eight levels: do so → do mi so → … → the full scale with high do → low so la ti → chromatic me fi le te.
  - It moves up a level automatically at 90% over the last 20 (you can turn that off or pick a level).
  - Half the questions come from your two weakest degrees.
- **Sing:** a degree is shown; sing or play it.
  - **🎤 Sing it:** the microphone checks you. Any octave counts, since voices are usually an octave or two from the recorder. It says which degree you actually sang and how in tune you were, then plays the right note to compare.
  - **Reveal:** check yourself instead (✓ / ✗).
  - **💡 Hint:** a song you know that has the note, with the degree of every syllable and the note marked, e.g. so: "Think of the start of Twinkle Twinkle: it's on 'twin'" (do do **so**). **▶ Hear it** plays it in the current key, so you can sing up to the note. Degrees no anchor song has (ti, high do, the chromatic ones) get a short path instead ("sing up the scale and stop one short"). Hints also appear after a wrong answer in the Degrees drill.
- **Melody:** hear 3–8 notes (sometimes a phrase from a song you know), then tap their degrees in order. Mistakes are shown with the right answer.
- **Songs:** Twinkle Twinkle, Mary Had a Little Lamb, Frère Jacques, Happy Birthday, When the Saints and Amazing Grace, with the degree of every syllable. Play a whole song or tap a line; the current note lights up. They play in whichever key is set. There's also a list of interval anchor songs (titles only).
- **Options:** fixed key or a random key each question (recorder keys C F G D B♭, or any). Labels as solfège or numbers. Recorder-like or piano sound. Notes kept in your recorder's range (or a middle range). Play home before each note (easier). Show the **recorder fingering** (baroque) for each answer.
- **Stats:** accuracy and response time for each degree (all keys or one key), for naming, singing and melodies. Also your weakest degrees, today's answers and a day streak.

### Dance Improv (forró, salsa)

For partner-dance leaders who know moves but can't think of them in the moment. It trains pulling your next move out of memory on the beat, with variety.

- **Flow:** a groove plays: forró baião (zabumba, triangle, bass) or salsa (2-3 son clave, cowbell, conga tumbao, bass), at a tempo you choose. Dance, or mark it. Four counts before each move ends, **NEXT?** counts down; choose your next move before the 1 by tapping it, typing it, or **saying it out loud** (speech recognition, in English, Portuguese or Spanish).
  - **Speed:** deciding early scores more.
  - **Variety:** repeating the last move scores nothing; a move you haven't used this session scores best; changing kind of move (turn, position change, styling…) adds a bit; going back to a basic now and then is fine.
  - **Freezing:** if you haven't chosen two counts after the 1, you froze, and it's back to the basic.
  - **Cues and twists:** cues like "a turn", "change position" or "something you haven't done yet" earn a bonus. Twists like "the other direction", "the other hand" or "half time" can be added to any move, so a small vocabulary gives lots of options.
  - **Buttons:** move buttons shuffle each time, so you read rather than reach. You can hide the list entirely and pick from memory.
  - **At the end:** a grade, speed and variety scores, your longest run without a repeat, tips, and the moves you didn't use.
- **Recall:** 30–90 seconds to type every move you can remember, with no list to look at (free recall is what makes moves come to mind on the floor). It forgives typos and missing accents, shows what you forgot, and offers to add anything new.
- **Moves:** your own move list for each dance, with the kind of move and how many counts it takes. There are starter lists for forró (base, frente e trás, caminhada, giro simples, giro do cavalheiro, pião, abertura, trava, sacada…) and salsa (cross-body lead, right and left turns, copa, hammerlock, dile que no, enchufla…). Rename them to what you were taught.
- **Stats:** recent sessions, how often you use each move, and how early you decide on it. Moves you never use are highlighted.

### Tuner
Play anything and see the note, frequency and cents offset.

### Settings
- Tuning reference: A = 440 Hz (modern), 442 Hz, or 415 Hz (baroque)
- Microphone sensitivity

## Running it

The microphone only works on `https://` pages or `localhost`.

```sh
npm start        # serves on http://localhost:8080
```

Any static web server works; there's no build step. To use it on your phone, host the folder on any static HTTPS host. For GitHub Pages: repo **Settings → Pages → Deploy from branch**.

For best results, turn off other noise and keep the device roughly half a metre to a metre away from the recorder.

## Development

```sh
npm test
node scripts/set-version.mjs 1.7   # before pushing a change
```

Every file URL carries the version number, so after an update browsers fetch fresh copies instead of mixing old and new files. Run the version script whenever you change the app. If the app ever fails to start, it shows a message with a Reload button.

Code layout (`js/`):
- `pitch.js`: YIN pitch detection plus a median smoother
- `longtone.js`: long-tone session state machine, scoring and tips (no DOM code, unit tested)
- `rhythm.js`: rhythm generation by level, note start/stop tracking, and timing scoring (no DOM code, unit tested)
- `notation.js`: draws rhythm exercises as sheet music (beams, ties, triplets, rests, counting)
- `calibration.js`: measures the click-to-mic delay
- `tap-input.js`: the tap button / Space bar input for rhythm reading
- `dance.js`: dance improv: starter moves, cues, speed and variety scoring, forgiving move-name matching (no DOM code, unit tested)
- `dance-audio.js`, `dance-view.js`: the forró and salsa grooves, and the Dance Improv screen
- `ear.js`: ear training: degrees, levels, keys, question choice, progress, melodies, songs, fingerings (no DOM code, unit tested)
- `ear-audio.js`, `ear-view.js`: ear-training sound (cadences, piano and recorder voices) and screen
- `chords.js`: chord types, spelling, inversions, checking, and which chord to practise next (no DOM code, unit tested)
- `keyboard.js`, `chords-view.js`: the keyboard picture and the Piano Chords screen
- `game/song.js`: Beat Ward levels, song generation (seeded) and judging (no DOM code, unit tested)
- `game/endless.js`: Unlimited mode's skill model: placement, adapting, weak spots, tempo (unit tested)
- `game/lessons.js`: the tutorials: ward introductions, a card for each rhythm, counting (unit tested)
- `game/score.js`: pixel notation with engraved spacing (layout and spacing are unit tested)
- `game/art.js`, `game/game.js`: the pixel art and bosses, synth and game loop
- `progression.js`: endless-mode curriculum, skill tracking, retries, review and tempo changes (no DOM code, unit tested)
- `endless-view.js`: the Endless screen (scrolling score, one bar at a time)
- `rhythm-view.js`: the Practice screen
- `rhythm-play.js`: plays a rhythm back so you can hear it
- `recorders.js`: instrument ranges and transpositions
- `music.js`: note names and pitch maths
- `audio.js`: microphone input and the reference tone
- `staff.js`, `chart.js`: note-on-staff SVG and the pitch graph
- `storage.js`: settings and history in `localStorage`
- `app.js`: UI wiring
