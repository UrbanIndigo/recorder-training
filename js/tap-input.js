// Tap input for rhythm reading: hold a button (or the Space bar) for each
// note instead of playing into the microphone. It looks to the rhythm
// screens just like the microphone listener: a press is a note starting,
// a release is it ending, stamped with the exact time of the touch.

const AudioCtx = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
const MIN_NOTE = 0.06; // a very quick tap still counts as a (short) note

export class TapListener {
  constructor() {
    this.listeners = new Set();
    this.running = false;
    this.pressed = false;
    this.events = [];
    this.pressedAt = 0;
  }

  /** Start the clock the metronome runs on. No microphone is used. */
  async start() {
    if (this.running) return;
    this.ctx = new AudioCtx();
    await this.ctx.resume();
    this.running = true;
    this.tick();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.pressed = false;
    this.events = [];
  }

  /** Audio-clock time of an input event (using the event's own timestamp). */
  timeOf(e) {
    const ago = e?.timeStamp != null ? Math.max(0, performance.now() - e.timeStamp) / 1000 : 0;
    return this.ctx.currentTime - Math.min(ago, 0.2);
  }

  press(e) {
    if (!this.running || this.pressed) return;
    this.pressed = true;
    this.pressedAt = this.timeOf(e);
    this.events.push({ t: this.pressedAt, rms: 1 });
    this.framePressed = true;
  }

  release(e) {
    if (!this.running || !this.pressed) return;
    this.pressed = false;
    this.events.push({ t: Math.max(this.timeOf(e), this.pressedAt + MIN_NOTE), rms: 0 });
  }

  /** The click reaches your ears a little after it's scheduled; you tap to what you hear. */
  estimatedLatency() {
    if (!this.ctx) return 0;
    return (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
  }

  info() {
    return null;
  }

  setOptions() {}

  onPitch(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  tick = () => {
    if (!this.running) return;
    const audioTime = this.ctx.currentTime;
    // Each press and release becomes a level reading at its exact time,
    // then one for "now", so the note tracker sees clean starts and ends.
    const blocks = this.events.splice(0).sort((a, b) => a.t - b.t);
    blocks.push({ t: Math.max(audioTime, (blocks.at(-1)?.t ?? 0) + 0.005), rms: this.pressed ? 1 : 0 });
    const down = this.pressed || this.framePressed;
    this.framePressed = false;
    const reading = { freq: null, clarity: down ? 1 : 0, rms: down ? 1 : 0, gate: 0.5, audioTime, blocks };
    for (const fn of this.listeners) fn(reading, audioTime);
    this.raf = requestAnimationFrame(this.tick);
  };
}

/**
 * Wire a pad element (and the Space bar while `active()` is true) to a
 * tap listener.
 */
export function bindTapPad(pad, tap, active) {
  const down = (e) => {
    if (!active()) return;
    e.preventDefault();
    pad.setPointerCapture?.(e.pointerId);
    pad.classList.add('down');
    tap.press(e);
  };
  const up = (e) => {
    pad.classList.remove('down');
    tap.release(e);
  };
  pad.addEventListener('pointerdown', down);
  pad.addEventListener('pointerup', up);
  pad.addEventListener('pointercancel', up);
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || !active() || e.target.closest?.('input, select, textarea')) return;
    e.preventDefault();
    pad.classList.add('down');
    tap.press(e);
  });
  document.addEventListener('keyup', (e) => {
    if (e.code !== 'Space' || !active()) return;
    e.preventDefault();
    pad.classList.remove('down');
    tap.release(e);
  });
}
