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
Rhythm training that keeps going until you stop. The metronome never stops or skips a beat. Each 2-bar rhythm is followed straight away by a bar of count-in (or two, if you set a longer reading time) while you read the next one. Even when a new pattern unlocks, the beat carries on: you get an extra bar to read it and the explanation appears alongside.

- **Levels up on its own.** You start with quarter notes. 45 stages unlock one at a time once you're consistently scoring well:
  - **basics:** half notes, whole notes, quarter, half and whole-bar rests, dotted halves, 3/4
  - **eighths:** eighths, off-beat eighths, dotted quarter + eighth, 2/4, syncopation, eighth rests, ties
  - **sixteenths and triplets:** sixteenths, eighth + two sixteenths, two sixteenths + eighth, dotted eighth + sixteenth, triplets
  - **harder syncopation:** quarter–half–quarter, eighth + dotted quarter, tied syncopation, off-beat quarters
  - **sixteenth variations:** sixteenth–eighth–sixteenth, Scotch snap, eighth rest + two sixteenths, sixteenth rests, quarter-note triplets
  - **6/8 time:** dotted quarters, three eighths, quarter + eighth, eighth + quarter, dotted-quarter rests, sixteenths, and the siciliano rhythm
  - **tuplets:** triplets with rests, sixteenth-note triplets, quintuplets, 6/8 duplets
  - **fast notes and double dots:** thirty-second notes, dotted sixteenth + thirty-second, double-dotted quarter + sixteenth, double-dotted half + eighth
  - **more kinds of rest:** coming in after a rest (rhythms can now start with one), sixteenth rests mid-beat, dotted eighth rest + sixteenth Each new rhythm gets a short explanation card with how to count it, and you can hear an example. Once everything is unlocked, the tempo creeps up instead.
- **Repeats what you get wrong.** Score under 70 and the same rhythm comes straight back, with the counting shown, your last attempt coloured on the notes, and the tricky pattern named. Miss it again and it goes into a review list that comes back a few rhythms later.
- **Targets your weak spots.** It tracks how well you do on each rhythm pattern and gives you the hard ones more often. If you're struggling, it slows down.
- **A verdict for every bar.** As each bar finishes you get "Great", "Early", "Late", "Too short", "Missed a note" or "Played in a rest" above it while you carry on, plus a bar-by-bar summary after each rhythm.
- **What to work on.** It tracks recurring problems for each rhythm pattern (rushing eighths, cutting half notes short, playing through rests…). It lists your top ones with a tip, and gives you more of those patterns.
- **Nothing gives the timing away before you play.** Notes are spaced like printed music, not by length, and there's no moving line unless you turn it on. After a bar is scored, its notes are coloured, ◂ / ▸ marks show which were early or late, and a strip under the bar shows what you played against the written lengths.
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

You can play on one note (B) or use 3 or 5 easy left-hand notes. With more than one note, wrong pitches are marked too. Tempo goes from 40 to 140 bpm.

**Timing calibration:** phones and Bluetooth headphones add a delay between the click and the mic. If you keep being told you're late, open *Timing calibration* and play 8 short notes on the clicks. The app measures the delay and allows for it.

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
- `progression.js`: endless-mode curriculum, skill tracking, retries, review and tempo changes (no DOM code, unit tested)
- `endless-view.js`: the Endless screen (continuous metronome loop)
- `rhythm-view.js`: the Practice screen
- `rhythm-play.js`: plays a rhythm back so you can hear it
- `recorders.js`: instrument ranges and transpositions
- `music.js`: note names and pitch maths
- `audio.js`: microphone input and the reference tone
- `staff.js`, `chart.js`: note-on-staff SVG and the pitch graph
- `storage.js`: settings and history in `localStorage`
- `app.js`: UI wiring
