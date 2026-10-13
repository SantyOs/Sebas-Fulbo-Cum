import { CONTROL_DIST, CONTROL_HEIGHT, FIELD_W, FIELD_H } from "../constants";
import { keeperReach } from "./keepers";
import { resolvePossession } from "./possession";
import { sweepCircle } from "./sweep";
import { BALL_DECAY, BOUNCE, GRAVITY } from "../constants";
import { checkOutOfPlay } from "./rules";
import type { MatchState } from "./state";

export function updateBall(state: MatchState, dt: number) {
  if (state.owner) return; // dribble handles it

  const start = { ...state.ball };
  integrateBall(state, dt);
  const end = { ...state.ball };
  // Evaluate the earliest field crossing at its actual height and lateral
  // position, not at an overshot endpoint (which may already be outside a post).
  let boundary = 1;
  for (const [axis, limit] of [
    ["x", FIELD_W],
    ["y", FIELD_H],
  ] as const) {
    const delta = end[axis] - start[axis];
    if (delta > 0 && start[axis] <= limit && end[axis] > limit)
      boundary = Math.min(boundary, (limit - start[axis]) / delta);
    if (delta < 0 && start[axis] >= 0 && end[axis] < 0)
      boundary = Math.min(boundary, -start[axis] / delta);
  }
  let contact = boundary;
  let hit = false;
  if (state.ballFree <= 0 || state.lastKicker) {
    const speed = Math.hypot(start.vx, start.vy);
    for (const p of [...state.homePlayers, ...state.awayPlayers]) {
      if (
        p === state.dispossessed ||
        (state.kickerLock > 0 && p === state.lastKicker)
      )
        continue;
      const radius = p.isGK ? keeperReach(state, p, speed) : CONTROL_DIST;
      const t = sweepCircle(start, end, p, radius);
      if (t === null || t > contact) continue;
      const z = start.z + (end.z - start.z) * t;
      if (z > CONTROL_HEIGHT) continue;
      // The short kick grace protects the kicker's body cluster, not
      // defenders further down the lane.
      if (
        state.ballFree > 0 &&
        state.lastKicker &&
        Math.hypot(p.x - state.lastKicker.x, p.y - state.lastKicker.y) <
          CONTROL_DIST * 2
      )
        continue;
      contact = t;
      hit = true;
    }
  }
  if (hit || boundary < 1) {
    const t = Math.min(1, contact + 1e-7);
    state.ball.x = start.x + (end.x - start.x) * t;
    state.ball.y = start.y + (end.y - start.y) * t;
    state.ball.z = Math.max(0, start.z + (end.z - start.z) * t);
    if (hit) {
      // Reuse the established trapping, keeper, deflection and offside rules.
      state.ballFree = 0;
      resolvePossession(state);
      if (state.owner || state.freeze > 0 || state.ballFree > 0) return;
    }
  }

  // The ball leaving the field of play is no longer a wall to bounce off —
  // it goes OUT and the correct restart (throw-in / goal kick / corner) is
  // awarded. A ball crossing the goal line inside the mouth & under the bar
  // is left alone for handleGoals to score.
  checkOutOfPlay(state);
}

export function integrateBall(state: MatchState, dt: number, dragMul = 1) {
  state.ball.x += state.ball.vx * dt;
  state.ball.y += state.ball.vy * dt;

  // ---- Height (z) integration: gravity + ground bounce ----
  const airborne = state.ball.z > 0.01 || state.ball.vz > 0.01;
  if (airborne) {
    state.ball.vz -= GRAVITY * dt;
    state.ball.z += state.ball.vz * dt;
    if (state.ball.z <= 0) {
      // Landed: the protected aerial pass is over — it's a normal loose ball
      // now (whoever is at the drop can contest it).
      state.aerialReceiver = null;
      // Landed: bounce with restitution; settle when the hop gets tiny.
      state.ball.z = 0;
      if (state.ball.vz < 0) state.ball.vz = -state.ball.vz * BOUNCE;
      if (state.ball.vz < GRAVITY * 0.03) state.ball.vz = 0;
      // A bounce scrubs a little pace off the roll.
      state.ball.vx *= 0.86;
      state.ball.vy *= 0.86;
    }
  }

  // Horizontal friction: almost none while flying, full rolling drag on
  // the grass. A lofted ball carries; a grounded ball decays as before.
  const decay = airborne
    ? Math.exp(-BALL_DECAY * 0.12 * dragMul * dt)
    : Math.exp(-BALL_DECAY * dragMul * dt);
  state.ball.vx *= decay;
  state.ball.vy *= decay;
  if (!airborne && Math.hypot(state.ball.vx, state.ball.vy) < 4) {
    state.ball.vx = 0;
    state.ball.vy = 0;
  }
}
