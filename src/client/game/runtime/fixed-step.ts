/** Bounded catch-up prevents a background tab from replaying minutes of input. */
export class FixedStepClock {
  readonly dt = 1 / 60;
  private accumulator = 0;
  reset() {
    this.accumulator = 0;
  }
  advance(elapsed: number, step: (dt: number) => void) {
    this.accumulator += Math.min(Math.max(elapsed, 0), 0.1);
    let steps = 0;
    while (this.accumulator + 1e-10 >= this.dt && steps < 5) {
      step(this.dt);
      this.accumulator -= this.dt;
      steps++;
    }
    if (steps === 5 && this.accumulator >= this.dt) this.accumulator %= this.dt;
    return Math.max(0, this.accumulator / this.dt);
  }
}
