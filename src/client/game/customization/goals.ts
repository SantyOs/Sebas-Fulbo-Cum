import type { MatchSnapshot } from "../contracts";
export interface GoalPresentation {
  id: number;
  name: string;
  confetti: boolean;
  sound: string;
  volume: number;
}
/** Consume monotonically identified events exactly once, even across catch-up frames. */
export class GoalEventCursor {
  private last = 0;
  consume(snapshot: MatchSnapshot): GoalPresentation[] {
    const goals: GoalPresentation[] = [];
    for (const event of snapshot.events) {
      if (event.id <= this.last) continue;
      this.last = event.id;
      if (event.kind !== "goal") continue;
      const scorer =
        snapshot.players.find(
          (p) => p.id === event.playerId && p.team === event.team,
        ) ?? snapshot.players.find((p) => p.team === event.team && !p.isGK);
      const celebration = scorer?.custom?.celebration;
      goals.push({
        id: event.id,
        name: scorer?.name ?? "GOL",
        confetti: celebration?.confetti ?? true,
        sound: celebration?.sound ?? "party",
        volume: celebration?.volume ?? 0.8,
      });
    }
    return goals;
  }
}
