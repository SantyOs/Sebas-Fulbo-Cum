import { MATCH_DISPLAY_SECS, MATCH_REAL_SECS } from "../constants";
import { chargeLevel } from "./actions";
import type { MatchState } from "./state";
import type { HudState } from "../types";

export function getHud(state: MatchState): HudState {
  return {
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    clock: Math.floor((state.elapsed / MATCH_REAL_SECS) * MATCH_DISPLAY_SECS),
    finished: state.fullTime,
    message: state.message,
    possession: state.owner ? state.owner.team : "none",
    homePlayer: state.controlled
      ? { num: state.controlled.num, name: state.controlled.name }
      : null,
    awayPlayer: state.awayActive
      ? { num: state.awayActive.num, name: state.awayActive.name }
      : null,
    charge: chargeLevel(state),
  };
}
