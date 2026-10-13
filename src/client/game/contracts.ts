import type { GameAction } from "./keybindings";
import type { HudState, PlayerEntity, Team, Vec } from "./types";
import type { Kit } from "./teams/types";

export interface InputFrame {
  move: Vec;
  held: ReadonlySet<GameAction>;
  pressed: readonly GameAction[];
  released: readonly GameAction[];
}
export const emptyInput = (): InputFrame => ({
  move: { x: 0, y: 0 },
  held: new Set(),
  pressed: [],
  released: [],
});
export interface BallState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  r: number;
}
export type MatchEventKind =
  | "pass"
  | "shot"
  | "contact"
  | "save"
  | "goal"
  | "restart";
export interface MatchEvent {
  id: number;
  tick: number;
  time: number;
  kind: MatchEventKind;
  playerId?: string;
  team?: Team;
  /** Teammate whose pass this contact received. */
  fromId?: string;
}
export interface MatchSnapshot {
  tick: number;
  ball: Readonly<BallState>;
  players: readonly (Readonly<PlayerEntity> & { kit: Kit })[];
  controlledId: string;
  switchHintId: string | null;
  ownerId: string | null;
  handling: boolean;
  hud: Readonly<HudState>;
  events: readonly MatchEvent[];
  netRipple: Readonly<{ left: number; right: number }>;
}
export type GraphicsQuality = "medium" | "high";
export interface GameRenderer {
  initialize(): Promise<void>;
  render(
    previous: MatchSnapshot,
    current: MatchSnapshot,
    alpha: number,
    dt: number,
  ): void;
  resize(): void;
  dispose(): void;
}
