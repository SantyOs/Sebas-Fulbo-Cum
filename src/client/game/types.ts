import type { PlayerCustomization } from "./customization/profile";
// Core engine-domain types shared across the simulation and renderer.
// (Team data types — TeamData, Kit — live in ./teams/types.)

import type { CastTraits, Ratings } from './teams/types';

export type Vec = { x: number; y: number };
export type Team = 'home' | 'away';
export type Role = 'GK' | 'DF' | 'MF' | 'ST';

export interface PlayerEntity {
  custom?: PlayerCustomization;
  cast?: CastTraits;
  /** Fixed spot for a `still` cast player. */
  stillAt?: Vec;
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  team: Team;
  /** Formation anchor in field coordinates. */
  anchor: Vec;
  facing: Vec;
  /** Run-cycle phase, advanced by distance travelled. */
  animPhase: number;
  /** > 0 while playing the kick pose. */
  kickTimer: number;
  hair: string;
  skin: string;
  isGK: boolean;
  role: Role;
  /** Shirt number, shown on the back of the jersey. */
  num: number;
  /** Surname, shown in the FIFA-style selected-player indicator. */
  name: string;
  /** FIFA-style attribute card driving this player's in-game ability. */
  ratings: Ratings;
  /** > 0 while playing the goal-celebration pose (arms raised). */
  celebrating?: boolean;
  /** > 0 while a keeper is playing the dive/save pose (full-body lay-out). */
  diveTimer?: number;
  /** Direction of the current dive along the goal mouth (world-y sign). */
  diveDir?: number;
  /** Lockout so a keeper doesn't re-trigger a dive every frame. */
  diveCooldown?: number;
  /** > 0 while playing the grounded sliding-tackle pose (full-body lay-out). */
  slideTimer?: number;
  /** Direction the slide is committed along, in field coordinates. */
  slideDir?: Vec;
  /** True while this player is holding the ball overhead for a throw-in. */
  throwing?: boolean;
}

export interface HudState {
  homeScore: number;
  awayScore: number;
  /** In-game match seconds elapsed (counts UP, 0 -> 5400 = 90:00, beyond in keyboard extra time). */
  clock: number;
  finished: boolean;
  message: string;
  possession: Team | 'none';
  /** Active player per side, for the bottom-corner broadcast lower-thirds. */
  homePlayer: { num: number; name: string } | null;
  awayPlayer: { num: number; name: string } | null;
  /** 0..1 charge of the in-progress home kick, or null when not charging. */
  charge: number | null;
}

export type StateListener = (s: HudState) => void;
