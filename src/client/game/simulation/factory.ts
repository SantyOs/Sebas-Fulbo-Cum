import {
  FIELD_H,
  FIELD_W,
  HAIR_COLORS,
  PLAYER_R,
  SKIN_TONES,
} from "../constants";
import { chooseKits } from "../teams/kits";
import type { Kit } from "../teams/types";
import type { PlayerEntity, Team, Vec } from "../types";
import type { MatchState } from "./state";

export function makePlayer(
  state: MatchState,
  team: Team,
  frac: Vec,
  i: number,
): PlayerEntity {
  const squad = (team === "home" ? state.homeTeam : state.awayTeam).players[i];
  const result: PlayerEntity = {
    id: `${team}-${squad.sourceId ?? squad.num}`,
    x: frac.x * FIELD_W,
    y: frac.y * FIELD_H,
    vx: 0,
    vy: 0,
    r: PLAYER_R,
    team,
    anchor: { x: frac.x * FIELD_W, y: frac.y * FIELD_H },
    facing: { x: team === "home" ? 1 : -1, y: 0 },
    animPhase: state.random() * Math.PI * 2,
    kickTimer: 0,
    hair: HAIR_COLORS[(i + (team === "away" ? 2 : 0)) % HAIR_COLORS.length],
    skin: SKIN_TONES[(i + (team === "away" ? 1 : 0)) % SKIN_TONES.length],
    isGK: squad.role === "GK",
    role: squad.role,
    num: squad.num,
    name: squad.name,
    custom: squad.custom,
    cast: squad.cast,
    ratings: squad.ratings,
  };
  if (squad.cast?.still) result.stillAt = { ...result.anchor };
  if (squad.custom) {
    result.skin = squad.custom.skin;
    result.hair = squad.custom.hairColor;
  }
  return result;
}

export function kitFor(state: MatchState, p: PlayerEntity): Kit {
  const t = p.team === "home" ? state.homeTeam : state.awayTeam;
  if (p.isGK) return t.gkKit;
  // The visiting (away) side wears its change kit so the two outfield kits
  // never clash with the home colours.
  return chooseKits(state.homeTeam, state.awayTeam)[p.team];
}
