import { GoalEventCursor } from "./customization/goals";
import { birthdayAudio } from "./customization/audio";
import type { BirthdayProfile } from "./customization/profile";
import type { GraphicsQuality, MatchSnapshot } from "./contracts";
import type { KeyBindings } from "./keybindings";
import { DEFAULT_BINDINGS } from "./keybindings";
import { BrowserInput, type PauseReason } from "./input/browser";
import { ThreeRenderer } from "./rendering/three-renderer";
import { FixedStepClock } from "./runtime/fixed-step";
import { FrameMetrics } from "./runtime/performance";
import { MatchSimulation } from "./simulation";
import type { TeamData } from "./teams/types";
import type { HudState, StateListener } from "./types";

export type { TeamData } from "./teams/types";
export type { HudState } from "./types";
export { CANVAS_W, CANVAS_H } from "./constants";
export interface GameOptions {
  birthday?: BirthdayProfile;
  onGoal?: (goal: { id: number; name: string; confetti: boolean }) => void;
  practice?: boolean;
  bindings?: KeyBindings;
  quality?: GraphicsQuality;
  seed?: number;
  onReady?: () => void;
  onError?: (message: string) => void;
  onPause?: (reason: PauseReason) => void;
  onController?: (message: string) => void;
}
/** Browser lifecycle only. The simulation has no browser or rendering dependency. */
export class PitchKickGame {
  private simulation: MatchSimulation;
  private renderer: ThreeRenderer;
  private input: BrowserInput;
  private clock = new FixedStepClock();
  private metrics = new FrameMetrics();
  private previous: MatchSnapshot;
  private current: MatchSnapshot;
  private raf = 0;
  private last = 0;
  private running = false;
  private disposed = false;
  private paused = false;
  private lastHud = "";
  private hudElapsed = 0;
  private goalCursor = new GoalEventCursor();
  private unlockAudio = () => {
    void birthdayAudio.unlock().catch(() => {});
  };
  constructor(
    canvas: HTMLCanvasElement,
    private listener: StateListener,
    home: TeamData,
    away: TeamData,
    private options: GameOptions = {},
  ) {
    this.simulation = new MatchSimulation(home, away, {
      practice: options.practice,
      seed: options.seed,
    });
    this.current = this.previous = this.simulation.snapshot();
    this.renderer = new ThreeRenderer(
      canvas,
      home,
      away,
      options.quality ?? "high",
      (message) => this.fail(message),
    );
    this.renderer.setCameraZoom(options.birthday?.cameraZoom ?? 1.18);
    this.input = new BrowserInput(
      options.bindings ?? DEFAULT_BINDINGS,
      (reason) => {
        this.setPaused(true);
        options.onPause?.(reason);
      },
      (message) => options.onController?.(message),
    );
  }
  async start() {
    if (this.running || this.disposed) return;
    this.running = true;
    try {
      await this.renderer.initialize();
      if (!this.running) return;
      await this.renderer.warmup(this.current);
      if (!this.running) return;
      this.input.attach();
      window.addEventListener("pointerdown", this.unlockAudio);
      window.addEventListener("keydown", this.unlockAudio);
      this.last = performance.now();
      this.publishHud(true);
      this.options.onReady?.();
      if (document.hidden || !document.hasFocus()) {
        this.setPaused(true);
        this.options.onPause?.("focus");
      }
      this.raf = requestAnimationFrame(this.loop);
    } catch (error) {
      if (!this.disposed)
        this.fail(
          error instanceof Error
            ? error.message
            : "No se pudo iniciar el juego.",
        );
    }
  }
  stop() {
    if (this.disposed) return;
    this.running = false;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("pointerdown", this.unlockAudio);
    window.removeEventListener("keydown", this.unlockAudio);
    birthdayAudio.stop();
    this.input.dispose();
    this.renderer.dispose();
  }
  private fail(message: string) {
    this.stop();
    this.options.onError?.(message);
  }
  setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) birthdayAudio.stop();
    this.clock.reset();
    this.input.setPaused(paused);
    this.simulation.clearInput();
    this.current = this.previous = this.simulation.snapshot();
    this.last = performance.now();
  }
  setBirthday(profile: BirthdayProfile) {
    this.options.birthday = profile;
    this.renderer.setCameraZoom(profile.cameraZoom);
  }
  private goalEvents() {
    for (const goal of this.goalCursor.consume(this.current)) {
      if (this.options.birthday)
        void birthdayAudio.play(goal.sound, goal.volume, this.options.birthday);
      this.options.onGoal?.(goal);
    }
  }
  setBindings(bindings: KeyBindings) {
    this.input.setBindings(bindings);
    this.simulation.clearInput();
  }
  setQuality(quality: GraphicsQuality) {
    this.renderer.setQuality(quality);
    this.metrics.reset();
  }
  get performanceReport() {
    const metrics = this.metrics.report(),
      stats = this.renderer.statistics;
    return {
      ...metrics,
      ...stats,
      targetMet:
        metrics.targetMet && stats.width === 1920 && stats.height === 1080,
    };
  }
  resetPerformanceMeasurement() {
    this.metrics.reset();
  }
  private publishHud(force = false) {
    const hud: HudState = {
      ...this.current.hud,
      charge:
        this.current.hud.charge === null
          ? null
          : Math.round(this.current.hud.charge * 100) / 100,
    };
    const signature = JSON.stringify(hud);
    if (force || signature !== this.lastHud) {
      this.lastHud = signature;
      this.listener(hud);
    }
  }
  private loop = (now: number) => {
    if (!this.running) return;
    const elapsed = Math.max(0, (now - this.last) / 1000);
    this.last = now;
    try {
      this.input.poll();
      if (!this.paused) {
        const alpha = this.clock.advance(elapsed, (dt) => {
          this.previous = this.current;
          this.simulation.step(dt, this.input.actions.consume());
          this.current = this.simulation.snapshot();
          this.goalEvents();
        });
        this.renderer.render(
          this.previous,
          this.current,
          alpha,
          Math.min(elapsed, 0.05),
        );
        this.hudElapsed += elapsed;
        if (this.hudElapsed >= 1 / 30) {
          this.hudElapsed = 0;
          this.publishHud();
        }
        this.metrics.add(elapsed);
      } else {
        this.input.actions.clear();
      }
      this.raf = requestAnimationFrame(this.loop);
    } catch (error) {
      this.fail(
        error instanceof Error ? error.message : "Error durante el partido.",
      );
    }
  };
}
