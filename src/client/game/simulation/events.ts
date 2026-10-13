import type { MatchEventKind } from "../contracts";
import type { PlayerEntity, Team } from "../types";
import type { MatchState } from "./state";

export function recordEvent(
  state: MatchState,
  kind: MatchEventKind,
  player?: PlayerEntity | null,
  team?: Team,
) {
  state.events.push({
    id: ++state.eventSequence,
    tick: state.tick,
    time: state.time,
    kind,
    playerId: player?.id,
    team: team ?? player?.team,
  });
  if (state.events.length > 32) state.events.shift();
}
