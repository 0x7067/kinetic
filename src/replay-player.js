import { sampleRun } from './replay.js';

/** One bounded replay at a time. Pausing never changes the saved layout. */
export class ReplayPlayer {
  constructor({ onFrame, onChange, onEnd }) {
    this.onFrame = onFrame; this.onChange = onChange; this.onEnd = onEnd;
    this.run = null; this.time = 0; this.playing = false; this.speed = 1;
    this.resolve = null; this.animation = null;
  }
  load(run) {
    this.cancel(); this.run = run; this.time = 0;
    this.seek(0);
  }
  seek(time) {
    if (!this.run) return;
    this.time = Math.max(0, Math.min(this.run.duration, time));
    this.onFrame(sampleRun(this.run, this.time), this.run);
    this.onChange(this);
  }
  pause() {
    cancelAnimationFrame(this.animation); this.playing = false;
    this.onChange(this);
  }
  play(speed = 1) {
    if (!this.run || this.playing) return this.pending || Promise.resolve(false);
    this.speed = speed; this.playing = true; this.onChange(this);
    if (!this.resolve) this.pending = new Promise(resolve => { this.resolve = resolve; });
    let previous;
    const tick = now => {
      if (!this.playing) return;
      const dt = previous === undefined ? 0 : Math.min(.2, (now - previous) / 1000);
      previous = now;
      this.seek(this.time + dt * this.speed);
      if (this.time >= this.run.duration) {
        this.playing = false; this.onChange(this); this.onEnd(this.run);
        const resolve = this.resolve; this.resolve = null; resolve?.(true); return;
      }
      this.animation = requestAnimationFrame(tick);
    };
    this.animation = requestAnimationFrame(tick);
    return this.pending;
  }
  cancel() {
    this.pause(); const resolve = this.resolve; this.resolve = null; resolve?.(false);
  }
  clear() { this.cancel(); this.run = null; this.time = 0; this.onChange(this); }
}
