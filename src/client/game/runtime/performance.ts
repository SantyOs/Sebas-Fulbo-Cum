export interface PerformanceReport {
  samples: number;
  averageFps: number;
  p95FrameMs: number;
  targetMet: boolean;
  complete: boolean;
  activeSeconds: number;
}
/** Local measurement; starts after a ten-second warm-up. */
export class FrameMetrics {
  private frames: number[] = [];
  private elapsed = 0;
  add(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const previous = this.elapsed;
    this.elapsed += seconds;
    if (this.elapsed > 10 && previous < 70) this.frames.push(seconds * 1000);
  }
  reset() {
    this.frames = [];
    this.elapsed = 0;
  }
  report(): PerformanceReport {
    const sorted = [...this.frames].sort((a, b) => a - b);
    const average = sorted.reduce((a, b) => a + b, 0) / (sorted.length || 1);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    return {
      complete: this.elapsed >= 70,
      activeSeconds: Math.min(60, Math.max(0, this.elapsed - 10)),
      samples: sorted.length,
      averageFps: average ? 1000 / average : 0,
      p95FrameMs: p95,
      targetMet:
        sorted.length > 0 &&
        this.elapsed >= 70 &&
        p95 < 20 &&
        average <= 1000 / 59.5,
    };
  }
}
