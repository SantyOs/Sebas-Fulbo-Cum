import { recordEvent } from "./events";
import { CONTROL_DIST, FIELD_H, FIELD_W, GRAVITY, M } from "../constants";
import { clamp, dist } from "../math";
import type { PlayerEntity } from "../types";
import { kickBallToward, passPower } from "./actions";
import { nearestOpponentDist, nearestTo } from "./movement";
import type { MatchState } from "./state";

export function keeperInOwnBox(_state: MatchState, gk: PlayerEntity): boolean {
  const ownGoalX = gk.team === "home" ? 0 : FIELD_W;
  const depth = M(16.5); // penalty area depth
  const halfW = M(20.16); // half its width
  const mid = FIELD_H / 2;
  const inX =
    gk.team === "home" ? gk.x <= ownGoalX + depth : gk.x >= ownGoalX - depth;
  return inX && Math.abs(gk.y - mid) <= halfW;
}

export function keeperMayHandle(
  state: MatchState,
  gk: PlayerEntity,
  fromKicker: PlayerEntity | null,
): boolean {
  if (!keeperInOwnBox(state, gk)) return false;
  const backPass =
    !!fromKicker && fromKicker.team === gk.team && !fromKicker.isGK;
  return !backPass;
}

export function homeKeeperDistribute(state: MatchState, dt: number) {
  const gk = state.owner;
  if (!gk) return;
  state.gkHoldTimer += dt;
  if (state.gkHoldTimer < 0.7) return; // brief hold before clearing
  state.gkHoldTimer = 0;
  keeperDistribute(state, gk);
}

export function keeperDistribute(state: MatchState, gk: PlayerEntity) {
  const atk = gk.team === "home" ? 1 : -1;
  const ownGoalX = gk.team === "home" ? 0 : FIELD_W;
  const mates = gk.team === "home" ? state.homePlayers : state.awayPlayers;

  let best: PlayerEntity | null = null;
  let bestScore = -Infinity;
  for (const m of mates) {
    if (m === gk || m.isGK) continue;
    const d = dist(gk, m);
    const forward = (m.x - ownGoalX) * atk; // how far up the pitch (px)
    const open = nearestOpponentDist(state, m);
    // Reward distance up the pitch most (kick it long), then open space.
    // Heavily penalize a teammate right next to the keeper (don't roll it
    // square in the box) or one who is tightly marked.
    const score =
      forward * 0.6 +
      Math.min(open, 220) +
      (d < M(20) ? -1500 : 0) +
      (open < M(6) ? -700 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  if (!best) return;

  const aim = {
    x: clamp(best.x + best.vx * 0.2, 20, FIELD_W - 20),
    y: clamp(best.y + best.vy * 0.2, 20, FIELD_H - 20),
  };
  const d = dist(state.ball, aim);
  if (d > M(22)) {
    // A proper lofted goal kick / clearance — flies over midfield and drops
    // on the target, instead of a grounded pass that dies short.
    const T = clamp(0.6 + d / M(70), 0.6, 1.5);
    const vz = 0.5 * GRAVITY * T;
    const hspeed = Math.min((d / T) * 1.12, 1600);
    kickBallToward(state, aim, hspeed, gk, vz, 0.06);
    // A lofted clearance flies over midfield — only the target mate gathers
    // it on the way down, opponents can't pluck it out of the air.
    state.aerialReceiver = best;
  } else {
    kickBallToward(state, aim, passPower(state, d, 300, 1300), gk);
  }
}

export function practiceKeeperClear(state: MatchState, gk: PlayerEntity) {
  const out = state.homePlayers.filter((p) => !p.isGK);
  const target =
    nearestTo(state, out, { x: FIELD_W * 0.5, y: FIELD_H / 2 }) ??
    ({ x: FIELD_W * 0.5, y: FIELD_H / 2 } as { x: number; y: number });
  const aim = { x: target.x, y: target.y };
  const d = dist(state.ball, aim);
  const T = clamp(0.6 + d / M(70), 0.6, 1.4);
  const vz = 0.5 * GRAVITY * T;
  const hspeed = Math.min((d / T) * 1.1, 1500);
  kickBallToward(state, aim, hspeed, gk, vz, 0.05);
}

export function keeperReach(
  state: MatchState,
  gk: PlayerEntity,
  ballSpeed: number,
): number {
  // Slow/loose ball — normal big gather radius.
  if (ballSpeed < 340) return CONTROL_DIST + 34;
  // How far away was the shot struck? The farther the shot's origin, the more
  // time the keeper had to set himself and dive across.
  const shooter = state.lastKicker;
  const shotDist = shooter ? dist(shooter, gk) : 520;
  // Reaction buffer grows with shot distance, shrinks with shot pace. A
  // point-blank blast → almost no buffer (he can only save what's hit at him);
  // a 25-yarder → a real dive range across the goal.
  // Pace penalty STRENGTHENED (starts at 520 not 680, scales 0.04 not 0.02,
  // caps at 34 not 16) so a fiercely-struck shot collapses his reach toward his
  // body — the hardest, well-placed shots now BEAT him for a goal instead of
  // being magnetically reached (user: "GK catches strong shots too easily").
  const distBuf = clamp((shotDist - 120) * 0.05, 0, 26);
  const pacePenalty = clamp((ballSpeed - 520) * 0.04, 0, 34);
  const buffer = Math.max(0, distBuf - pacePenalty);
  return gk.r + state.ball.r + buffer;
}

export function updateKeeperReactions(state: MatchState, dt: number) {
  void dt;
  if (state.owner) return; // ball is held — no shot in flight
  const ballSpeed = Math.hypot(state.ball.vx, state.ball.vy);
  if (ballSpeed < 420) return; // only react to genuine shots
  for (const gk of [...state.homePlayers, ...state.awayPlayers].filter(
    (p) => p.isGK,
  )) {
    if (!gk) continue;
    if ((gk.diveTimer ?? 0) > 0 || (gk.diveCooldown ?? 0) > 0) continue;
    const ownGoalX = gk.team === "home" ? 0 : FIELD_W;
    // Ball must be travelling toward THIS keeper's goal.
    const towardGoal =
      gk.team === "home" ? state.ball.vx < -60 : state.ball.vx > 60;
    if (!towardGoal) continue;
    // Only once the shot is near his goal and close to him laterally.
    const ballDX = Math.abs(state.ball.x - ownGoalX);
    if (ballDX > M(20)) continue;
    const d = dist(gk, state.ball);
    if (d > 95) continue; // react as it arrives in his vicinity
    const off = state.ball.y - gk.y;
    // Within standing reach (a step + arm) → no dive needed, he gathers
    // standing. Only a ball genuinely beyond his standing reach makes him
    // throw himself across — so he doesn't dive on every shot near him.
    if (Math.abs(off) < M(1.7)) continue;
    triggerKeeperDive(state, gk, Math.sign(off));
  }
}

export function triggerKeeperDive(
  _state: MatchState,
  gk: PlayerEntity,
  dir: number,
) {
  gk.diveTimer = 0.6;
  gk.diveDir = dir || 1;
  gk.diveCooldown = 0.9;
  // A modest lunge toward the ball's path — extends his frame so the dive
  // looks committed without magically vacuuming the ball in.
  gk.vy += dir * 90;
}

export function keeperParry(
  state: MatchState,
  gk: PlayerEntity,
  ballSpeed: number,
) {
  recordEvent(state, "save", gk);
  state.lastTouchTeam = gk.team;
  const outSign = gk.team === "home" ? 1 : -1; // away from own goal
  const mid = FIELD_H / 2;
  // How far off-centre the shot came in (before we reposition the ball) —
  // determines whether the parry is a dive or a standing block.
  const incomingOff = state.ball.y - gk.y;
  // Spill toward the NEARER touchline so the rebound goes wide, not central.
  const side = state.ball.y < mid ? -1 : 1;
  const speed = clamp(ballSpeed * 0.42, 200, 380);
  // Mostly lateral with an outward component — the ball squirts off to the
  // side and away from goal.
  state.ball.vx = outSign * speed * 0.5;
  state.ball.vy = side * speed * 0.9;
  state.ball.vz = M(1.8);
  state.ball.z = Math.max(state.ball.z, 0.4);
  // Nudge the ball off the keeper's body to that side so it doesn't re-gather
  // on the same frame.
  state.ball.x = gk.x + outSign * (gk.r + state.ball.r + 5);
  state.ball.y += side * (gk.r + 4);
  // Keeper throws himself toward the shot — but only a true DIVE if the ball
  // came in beyond his standing reach. A fierce shot straight at him is parried
  // standing (no dive), so he doesn't dive on every save.
  gk.facing = { x: outSign, y: side };
  if (Math.abs(incomingOff) > M(1.7) && (gk.diveTimer ?? 0) <= 0) {
    triggerKeeperDive(state, gk, Math.sign(incomingOff));
  }
  // Nobody owns the parried ball; lock out an instant re-gather so it spills
  // clear (a striker has to run onto the loose rebound).
  state.owner = null;
  state.ballFree = 0.45;
  state.lastKicker = null;
  state.kickerLock = 0;
  state.passReceiver = null;
}

export function constrainKeeperWithBall(state: MatchState) {
  const gk = state.owner;
  if (!gk || !gk.isGK) return;
  // Only a keeper HOLDING the ball in his hands is bound to his box. When he
  // is controlling it at his FEET (outside the box, or off a team-mate
  // back-pass) he may move freely like any outfielder — don't snap him back
  // into the area (that snap looked like he teleported/disappeared).
  if (!state.gkHandling) return;
  const ownGoalX = gk.team === "home" ? 0 : FIELD_W;
  const depth = M(16.5); // penalty area is 16.5 m deep
  const halfW = M(20.16); // ...and 40.32 m wide
  const mid = FIELD_H / 2;
  if (gk.team === "home") {
    gk.x = clamp(gk.x, gk.r, ownGoalX + depth);
  } else {
    gk.x = clamp(gk.x, ownGoalX - depth, FIELD_W - gk.r);
  }
  gk.y = clamp(
    gk.y,
    Math.max(gk.r, mid - halfW),
    Math.min(FIELD_H - gk.r, mid + halfW),
  );
}
