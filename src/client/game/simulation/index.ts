import type { InputFrame, MatchSnapshot } from "../contracts";
import type { TeamData } from "../teams/types";
import { kitFor } from "./factory";
import { getHud } from "./hud";
import { seededRandom } from "./random";
import { resetKickoff } from "./rules";
import { MatchState } from "./state";
import { update } from "./update";

export class MatchSimulation {
  readonly state: MatchState;
  constructor(
    home: TeamData,
    away: TeamData,
    options: { practice?: boolean; seed?: number; random?: () => number } = {},
  ) {
    this.state = new MatchState(
      home,
      away,
      options.practice ?? false,
      options.random ?? seededRandom(options.seed ?? 2026),
    );
    resetKickoff(this.state, "home");
  }
  step(dt: number, input: InputFrame) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.05)
      throw new Error("Simulation step must be between 0 and 0.05 seconds");
    const s = this.state;
    s.dt = dt;
    s.tick++;
    s.time += dt;
    s.moveInput = { ...input.move };
    s.keys = new Set(input.held);
    s.justPressed = [...input.pressed];
    s.justReleased = [...input.released];
    update(s, dt);
  }
  clearInput() {
    const s = this.state;
    s.keys.clear();
    s.justPressed = [];
    s.justReleased = [];
    s.moveInput = { x: 0, y: 0 };
    s.chargeKey = null;
    s.chargeTime = 0;
    s.kickPending = false;
    s.bufferTimer = 0;
  }
  snapshot(): MatchSnapshot {
    const s = this.state;
    return {
      tick: s.tick,
      ball: { ...s.ball },
      players: [...s.homePlayers, ...s.awayPlayers].map((p) => ({
        ...p,
        anchor: { ...p.anchor },
        facing: { ...p.facing },
        slideDir: p.slideDir && { ...p.slideDir },
        kit: kitFor(s, p),
      })),
      controlledId: s.controlled.id,
      switchHintId: s.switchHint?.id ?? null,
      ownerId: s.owner?.id ?? null,
      handling: s.gkHandling,
      hud: getHud(s),
      events: s.events.map((e) => ({ ...e })),
      netRipple: { ...s.netRipple },
    };
  }
}
