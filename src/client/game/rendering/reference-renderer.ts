import type { GameRenderer, MatchSnapshot } from "../contracts";
import { CANVAS_W, CANVAS_H, FIELD_W, FIELD_H } from "../constants";
import { clamp } from "../math";
import { CAM_MIN, CAM_MAX, CAM_Y_MIN, CAM_Y_MAX } from "../projection";
import { renderScene } from "../render";

/** Temporary migration reference. Not imported by the shipped game. */
export class ReferenceRenderer implements GameRenderer {
  private context: CanvasRenderingContext2D;
  private x = FIELD_W / 2;
  private y = FIELD_H / 2;
  constructor(private canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D unavailable");
    this.context = context;
  }
  async initialize() {
    this.resize();
  }
  resize() {
    this.canvas.width = CANVAS_W;
    this.canvas.height = CANVAS_H;
  }
  render(
    _previous: MatchSnapshot,
    current: MatchSnapshot,
    _alpha: number,
    dt: number,
  ) {
    const targetX = clamp(
      current.ball.x + current.ball.vx * 0.25,
      CAM_MIN,
      CAM_MAX,
    );
    const targetY = clamp(
      current.ball.y + current.ball.vy * 0.18,
      CAM_Y_MIN,
      CAM_Y_MAX,
    );
    this.x += (targetX - this.x) * (1 - Math.exp(-2.6 * dt));
    this.y += (targetY - this.y) * (1 - Math.exp(-1.8 * dt));
    renderScene(this.context, {
      camX: this.x,
      camY: this.y,
      ball: current.ball,
      players: [...current.players]
        .sort((a, b) => (a.team === b.team ? 0 : a.team === "away" ? -1 : 1))
        .map((p) => ({ p, kit: p.kit })),
      controlled:
        current.players.find((p) => p.id === current.controlledId) ?? null,
      switchHint:
        current.players.find((p) => p.id === current.switchHintId) ?? null,
      netRipple: current.netRipple,
    });
  }
  dispose() {
    this.context.clearRect(0, 0, CANVAS_W, CANVAS_H);
  }
}
