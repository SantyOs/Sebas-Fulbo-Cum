import type { MatchSnapshot } from "../contracts";
import { CELEBRATION_SECS, celebrationSecs } from "../constants";

/** Presentation clock: receives active frame time, never advances the match. */
export class GoalFocus {
  private last = 0;
  private elapsed = CELEBRATION_SECS;
  private playerId?: string;
  private goalTick = 0;
  private duration = CELEBRATION_SECS;
  update(snapshot: MatchSnapshot, dt: number) {
    this.elapsed += dt;
    for (const event of snapshot.events) {
      if (event.id <= this.last) continue;
      this.last = event.id;
      if (event.kind === "restart") this.playerId = undefined;
      if (event.kind !== "goal") continue;
      const scorer =
        snapshot.players.find(
          (p) => p.id === event.playerId && p.team === event.team,
        ) ?? snapshot.players.find((p) => p.team === event.team && !p.isGK);
      this.playerId =
        scorer?.custom?.celebration.closeup === false ? undefined : scorer?.id;
      this.goalTick = event.tick;
      this.duration = celebrationSecs(scorer, event.freeGoal);
      this.elapsed = 0;
    }
    this.elapsed = Math.max(this.elapsed, (snapshot.tick - this.goalTick) / 60);
    if (!this.playerId || this.elapsed >= this.duration) return null;
    const blend = Math.max(
      0,
      Math.min(1, this.elapsed / 0.65, (this.duration - this.elapsed) / 0.6),
    );
    return { playerId: this.playerId, weight: blend * blend * (3 - 2 * blend) };
  }
}
