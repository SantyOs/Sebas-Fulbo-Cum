import { ACCEL, FIELD_H, FIELD_W, TURN_RATE } from "../constants";
import { clamp, dist, len } from "../math";
import { paceAccelMul, paceMul } from "../ratings";
import type { PlayerEntity, Vec } from "../types";
import type { MatchState } from "./state";

export function nearestTo(
  _state: MatchState,
  players: PlayerEntity[],
  pt: { x: number; y: number },
  exclude?: PlayerEntity,
): PlayerEntity | null {
  let best: PlayerEntity | null = null;
  let bestD = Infinity;
  for (const p of players) {
    if (p === exclude) continue;
    const d = dist(p, pt);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

export function nearestOpponentDist(
  state: MatchState,
  p: PlayerEntity,
): number {
  const opps = p.team === "home" ? state.awayPlayers : state.homePlayers;
  let best = Infinity;
  for (const o of opps) best = Math.min(best, dist(p, o));
  return best;
}

export function steer(
  state: MatchState,
  p: PlayerEntity,
  targetVx: number,
  targetVy: number,
  dt: number,
  accel: number = ACCEL,
) {
  // PACE drives top speed: a quicker player reaches a higher target velocity
  // for the same intent. Applying it here means every movement path (human
  // input, chasing, formation runs) inherits the player's pace uniformly.
  const pace = paceMul(p.ratings);
  targetVx *= pace;
  targetVy *= pace;
  // ...and lends a little extra acceleration/agility off the mark.
  const k = 1 - Math.exp(-accel * paceAccelMul(p.ratings) * dt);
  p.vx += (targetVx - p.vx) * k;
  p.vy += (targetVy - p.vy) * k;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  const sp = Math.hypot(p.vx, p.vy);
  if (sp > 25) faceToward(state, p, p.vx / sp, p.vy / sp, dt);
  p.animPhase += sp * dt * 0.055;

  clampToField(state, p);
}

export function faceToward(
  _state: MatchState,
  p: PlayerEntity,
  dx: number,
  dy: number,
  dt: number,
) {
  const cur = Math.atan2(p.facing.y, p.facing.x);
  const tgt = Math.atan2(dy, dx);
  let diff = tgt - cur;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const ang = cur + clamp(diff, -TURN_RATE * dt, TURN_RATE * dt);
  p.facing = { x: Math.cos(ang), y: Math.sin(ang) };
}

export function moveToward(
  state: MatchState,
  p: PlayerEntity,
  t: Vec,
  speed: number,
  dt: number,
) {
  const dx = t.x - p.x;
  const dy = t.y - p.y;
  const d = len(dx, dy);
  // Slow into the target so AI players don't orbit/jitter.
  const sp = d < 36 ? speed * (d / 36) : speed;
  steer(state, p, (dx / d) * sp, (dy / d) * sp, dt);
}

export function driveToward(
  state: MatchState,
  p: PlayerEntity,
  t: Vec,
  speed: number,
  dt: number,
) {
  const dx = t.x - p.x;
  const dy = t.y - p.y;
  const d = len(dx, dy) || 1;
  steer(state, p, (dx / d) * speed, (dy / d) * speed, dt);
}

export function clampToField(
  _state: MatchState,
  m: { x: number; y: number; r: number },
) {
  m.x = Math.max(m.r, Math.min(FIELD_W - m.r, m.x));
  m.y = Math.max(m.r, Math.min(FIELD_H - m.r, m.y));
}
