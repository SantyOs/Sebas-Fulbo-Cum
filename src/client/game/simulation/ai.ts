import {
  AWAY_CARRY_SPEED,
  FINISHER_RANGE,
  FINISHER_CORNER_MARGIN,
  FINISHER_PASS_BONUS,
  AWAY_CHASE_SPEED,
  AWAY_FORMATION_SPEED,
  CONTROL_DIST,
  DIFFICULTY,
  FIELD_H,
  FIELD_W,
  goalBottom,
  goalTop,
  GRAVITY,
  M,
  PRESS_SPEED,
  RUN_SPEED,
  SPRINT_SPEED,
  TEAMMATE_SPEED,
  WALK_SPEED,
} from "../constants";
import { clamp, dist, len } from "../math";
import {
  passPowerMul,
  passSpreadMul,
  shotPowerMul,
  shotSpreadMul,
} from "../ratings";
import type { PlayerEntity, Vec } from "../types";
import {
  castPassTarget,
  executeThrowIn,
  kickBallToward,
  passPower,
} from "./actions";
import {
  homeKeeperDistribute,
  keeperDistribute,
  practiceKeeperClear,
} from "./keepers";
import {
  driveToward,
  faceToward,
  moveToward,
  nearestOpponentDist,
  nearestTo,
  steer,
} from "./movement";
import { pokeTackle } from "./possession";
import type { MatchState } from "./state";

export function keeperPlan(
  state: MatchState,
  p: PlayerEntity,
): { pos: Vec; speed: number } {
  const mid = FIELD_H / 2;
  const ownGoalX = p.team === "home" ? 0 : FIELD_W;
  const sign = p.team === "home" ? 1 : -1; // +1 = "out" toward the field
  const bx = state.ball.x;
  const by = state.ball.y;
  // How deep the ball is toward this keeper's goal, along the goal-to-goal
  // axis (0 = on the goal line, larger = further upfield).
  const ballDX = Math.abs(bx - ownGoalX);

  // ---- Danger / rush detection ----
  const carrier =
    state.owner && state.owner.team !== p.team ? state.owner : null;
  const mates = (
    p.team === "home" ? state.homePlayers : state.awayPlayers
  ).filter((m) => !m.isGK);
  // Is a teammate already right on the ball (challenging)? If so, no need to
  // abandon the goal — only rush when it's genuinely the keeper's to claim.
  const defenderOnBall = mates.some((m) => dist(m, state.ball) < 64);
  // Is a defender COVERING — positioned goal-side, between the keeper and the
  // ball, and roughly in the lane? If so the situation is already handled, so
  // the keeper should hold his line rather than charging out past his own man
  // and vacating the goal. (Goal-side = nearer our goal line than the ball;
  // "in the lane" = laterally close to the keeper→ball line.)
  const kbx = bx - p.x;
  const kby = by - p.y;
  const kbLen = Math.max(1, len(kbx, kby));
  const defenderCovering = mates.some((m) => {
    const goalSide = Math.abs(m.x - ownGoalX) < ballDX - 8; // nearer our goal
    if (!goalSide) return false;
    // Perpendicular distance from the defender to the keeper→ball segment.
    const t = clamp(
      ((m.x - p.x) * kbx + (m.y - p.y) * kby) / (kbLen * kbLen),
      0,
      1,
    );
    const px = p.x + kbx * t;
    const py = p.y + kby * t;
    return len(m.x - px, m.y - py) < 70;
  });
  const manualRush = p.team === "home" && state.gkRush > 0;
  const ballInBoxX = ballDX < M(18); // ~ edge of the penalty area (depth)
  // Only commit to a rush when the ball is also CENTRAL — within the penalty
  // area's width. A ball out on the flank is near the goal LINE but no direct
  // threat, so the keeper must hold his net and play the near post instead of
  // charging sideways and leaving the goal gaping.
  const ballCentral = Math.abs(by - mid) < M(18);
  const looseClose = !state.owner && ballInBoxX && ballCentral;
  // An opponent CARRIER only triggers a rush once he's genuinely CLOSE —
  // inside the box near the penalty spot — and central. Rushing earlier (when
  // he's still way out) just left the keeper parked at the box edge, and then
  // back-pedalling toward goal as the attacker finally arrived (the "rushed
  // early then retreated" bug). Held until ~M13 he plays the angle instead,
  // then comes straight OUT to smother — keeper and attacker converging, so
  // he never moves backwards while the attacker advances.
  const carrierClose =
    !!carrier &&
    Math.abs(carrier.x - ownGoalX) < M(13) &&
    Math.abs(carrier.y - mid) < M(20);
  // Auto-rush only when it's genuinely the keeper's to claim: no teammate is
  // already on the ball AND none is covering goal-side in the lane. (A manual
  // W rush ignores this — the player explicitly commanded the charge.)
  const autoRush =
    (looseClose || carrierClose) && !defenderOnBall && !defenderCovering;
  const boxEdge = ownGoalX + sign * M(16); // don't sweep past the box

  if (manualRush || autoRush) {
    // Charge the ball to smother / claim it, anticipating its motion a touch.
    const lead = manualRush ? 0.16 : 0.12;
    const aimX = bx + state.ball.vx * lead;
    const aimY = by + state.ball.vy * lead;
    // A MANUAL W rush is an explicit "rush keeper out" command — let him chase
    // the real ball well beyond the box, across the full width of the pitch,
    // so he actually runs AT the ball instead of sliding to the box edge. The
    // AUTO sweeper rush stays inside the box (no keeper at the halfway line).
    const outLimit = manualRush ? M(40) : M(16);
    const reachEdge = ownGoalX + sign * outLimit;
    const tx =
      sign > 0
        ? clamp(aimX, ownGoalX + 12, reachEdge)
        : clamp(aimX, reachEdge, ownGoalX - 12);
    const ty = manualRush
      ? clamp(aimY, 20, FIELD_H - 20)
      : clamp(aimY, mid - M(14), mid + M(14));
    return { pos: { x: tx, y: ty }, speed: SPRINT_SPEED };
  }

  // ---- Angle play (no rush) ----
  // Come off the line more as the ball nears: ~14px when it's a long way
  // out, up to ~150px on the edge of the box.
  const comeOut = clamp(220 - ballDX * 0.26, 14, 150);
  const gx = bx - ownGoalX;
  const gy = by - mid;
  const gl = Math.max(120, len(gx, gy));
  // Fraction along the goal→ball line; bounded so lateral tracking grows as
  // the ball gets close (small/central when it's far away).
  const f = clamp(comeOut / gl, 0, 0.5);
  const tx =
    sign > 0
      ? clamp(ownGoalX + gx * f, ownGoalX + 14, boxEdge)
      : clamp(ownGoalX + gx * f, boxEdge, ownGoalX - 14);
  // Don't PERFECTLY mirror the ball's lateral angle — a real keeper holds a
  // touch more central and can't cover both corners. Tracking only ~72% of
  // the way means a well-placed shot into the open corner can beat him,
  // rather than every shot flying straight at a magnetically-positioned GK.
  const ty = clamp(mid + gy * f * 0.72, goalTop + 14, goalBottom - 14);
  // Hustle back into position when badly out of it, else glide.
  const here = { x: tx, y: ty };
  const speed = dist(p, here) > 90 ? RUN_SPEED : WALK_SPEED;
  return { pos: here, speed };
}

export function computeMarking(state: MatchState) {
  state.markAssign.clear();
  const owner = state.owner;
  if (!owner) return;
  const attackers =
    owner.team === "home" ? state.homePlayers : state.awayPlayers;
  const defenders =
    owner.team === "home" ? state.awayPlayers : state.homePlayers;
  const defGoalX = owner.team === "home" ? FIELD_W : 0;
  const threats = attackers
    .filter(
      (a) =>
        a !== owner && !a.isGK && Math.abs(a.x - defGoalX) < FIELD_W * 0.62,
    )
    .sort((a, b) => Math.abs(a.x - defGoalX) - Math.abs(b.x - defGoalX));
  // Don't man-mark EVERY attacker — a real defence zonally covers and leaves
  // space, so there's always an outlet to pass to. Mark only the most
  // dangerous threats, leaving at least two attackers free; the rest hold a
  // zonal block (offBallPlan). This was the main reason passing felt
  // impossible — every teammate was glued to a marker.
  const maxMarks = Math.max(1, threats.length - 2);
  const taken = new Set<string>();
  for (const threat of threats) {
    if (state.markAssign.size >= maxMarks) break;
    let best: PlayerEntity | null = null;
    // Only commit to a man-mark when genuinely close (was 320 — too eager).
    let bestD = 250;
    for (const def of defenders) {
      if (def.isGK || def === state.controlled || taken.has(def.id)) continue;
      const dd = dist(def, threat);
      if (dd < bestD) {
        bestD = dd;
        best = def;
      }
    }
    if (best) {
      taken.add(best.id);
      state.markAssign.set(best.id, threat.id);
    }
  }
}

export function markTarget(
  state: MatchState,
  d: PlayerEntity,
  threat: PlayerEntity,
): Vec {
  const goal = { x: d.team === "home" ? 0 : FIELD_W, y: FIELD_H / 2 };
  const lg = len(goal.x - threat.x, goal.y - threat.y);
  const gx = (goal.x - threat.x) / lg;
  const gy = (goal.y - threat.y) / lg;
  const lb = len(state.ball.x - threat.x, state.ball.y - threat.y);
  const bx = (state.ball.x - threat.x) / lb;
  const by = (state.ball.y - threat.y) / lb;
  const mx = gx * 0.75 + bx * 0.25;
  const my = gy * 0.75 + by * 0.25;
  const ml = len(mx, my);
  // Stand off a touch further (was 40) so the marked man can still be a
  // passing option rather than being smothered — markers shouldn't be glued.
  return clampTarget(state, {
    x: threat.x + (mx / ml) * 52,
    y: threat.y + (my / ml) * 52,
  });
}

export function clampTarget(_state: MatchState, t: Vec): Vec {
  return {
    x: clamp(t.x, 20, FIELD_W - 20),
    y: clamp(t.y, 20, FIELD_H - 20),
  };
}

export function containTarget(
  state: MatchState,
  d: PlayerEntity,
  carrier: PlayerEntity,
  gap = 90,
): Vec {
  const goal = { x: d.team === "home" ? 0 : FIELD_W, y: FIELD_H / 2 };
  const gx = goal.x - carrier.x;
  const gy = goal.y - carrier.y;
  const gl = len(gx, gy) || 1;
  return clampTarget(state, {
    x: carrier.x + (gx / gl) * gap,
    y: carrier.y + (gy / gl) * gap,
  });
}

export function pickContainer(
  state: MatchState,
  defenders: PlayerEntity[],
  carrier: PlayerEntity,
  presser: PlayerEntity | null,
): PlayerEntity | null {
  const goalX = defenders[0]?.team === "home" ? 0 : FIELD_W;
  /** How far each player is up the pitch from the defended goal. */
  const depthToGoal = (x: number) => Math.abs(x - goalX);
  const carrierDepth = depthToGoal(carrier.x);
  const pool = defenders.filter(
    (p) => !p.isGK && p !== presser && p !== state.controlled,
  );
  const goalSide = pool.filter((p) => depthToGoal(p.x) <= carrierDepth + 30);
  return nearestTo(state, goalSide.length ? goalSide : pool, carrier);
}

export function computeAttackSupport(state: MatchState) {
  state.attackRole.clear();
  const owner = state.owner;
  if (!owner) return;
  const dir = owner.team === "home" ? 1 : -1;
  const ownGoalX = owner.team === "home" ? 0 : FIELD_W;
  /** Distance up the pitch (attacking direction) from own goal. */
  const depth = (x: number) => (x - ownGoalX) * dir;
  const ballD = depth(owner.x);
  const team = owner.team === "home" ? state.homePlayers : state.awayPlayers;
  const mates = team.filter((p) => p !== owner && !p.isGK);

  // RUNNERS: the up-to-2 most advanced non-defenders that are level with or
  // ahead of the carrier make penetrating runs in behind.
  const runners = mates
    .filter((p) => p.role !== "DF" && depth(p.x) > ballD - 120)
    .sort((a, b) => depth(b.x) - depth(a.x))
    .slice(0, 2);
  for (const p of runners) state.attackRole.set(p.id, "run");

  // WIDTH: remaining non-defenders whose formation lane hugs a touchline
  // stay wide to stretch the defence.
  for (const p of mates) {
    if (state.attackRole.has(p.id) || p.role === "DF") continue;
    if (Math.abs(p.anchor.y - FIELD_H / 2) > FIELD_H * 0.2) {
      state.attackRole.set(p.id, "width");
    }
  }

  // SHORT: the up-to-2 nearest remaining mates behind/level with the carrier
  // check back toward the ball as a safe passing outlet.
  const shortMen = mates
    .filter((p) => !state.attackRole.has(p.id) && depth(p.x) <= ballD + 60)
    .sort((a, b) => dist(a, owner) - dist(b, owner))
    .slice(0, 2);
  for (const p of shortMen) state.attackRole.set(p.id, "short");

  // Everyone else holds shape (recycle / cover the counter).
  for (const p of mates) {
    if (!state.attackRole.has(p.id)) state.attackRole.set(p.id, "hold");
  }
}

export function offBallPlan(
  state: MatchState,
  p: PlayerEntity,
  baseSpeed: number,
): { pos: Vec; speed: number } {
  if (p.isGK) return keeperPlan(state, p);
  const dir = p.team === "home" ? 1 : -1;
  const ownGoalX = p.team === "home" ? 0 : FIELD_W;
  /** Distance from own goal along the attacking direction (0..FIELD_W). */
  const depth = (x: number) => (x - ownGoalX) * dir;
  const fromDepth = (d: number) => ownGoalX + d * dir;
  const ballD = depth(state.ball.x);
  const W = FIELD_W;
  const owner = state.owner;
  const phase: "attack" | "defend" | "loose" = !owner
    ? "loose"
    : owner.team === p.team
      ? "attack"
      : "defend";

  // Per-line target depth, tracking the ball. [DF, MF, ST] per phase.
  let lineD: number;
  if (phase === "defend") {
    lineD =
      p.role === "DF"
        ? clamp(ballD - 200, 170, W * 0.52) // never parked on the goal line
        : p.role === "MF"
          ? clamp(ballD - 20, 340, W * 0.68)
          : clamp(ballD + 230, W * 0.4, W * 0.75); // STs stay up as the outlet
  } else if (phase === "attack") {
    lineD =
      p.role === "DF"
        ? clamp(ballD - 420, 280, W * 0.58)
        : p.role === "MF"
          ? clamp(ballD - 150, 450, W * 0.8)
          : clamp(ballD + 170, 720, W - 170);
  } else {
    lineD =
      p.role === "DF"
        ? clamp(ballD - 300, 220, W * 0.55)
        : p.role === "MF"
          ? clamp(ballD - 80, 400, W * 0.74)
          : clamp(ballD + 200, 640, W * 0.85);
  }
  // Keep the formation's internal stagger (full-backs/wingers slightly
  // higher than the centre of their line).
  const roleCenter = p.role === "DF" ? 0.15 : p.role === "MF" ? 0.33 : 0.52;
  lineD += (depth(p.anchor.x) / W - roleCenter) * W * 1.6;

  // Width: hold the lane from the formation, pulled toward the ball side.
  const ySqueeze = phase === "defend" ? 0.4 : 0.28;
  const t = {
    x: fromDepth(lineD),
    y: p.anchor.y + (state.ball.y - FIELD_H / 2) * ySqueeze,
  };

  // DEFEND: man-marking overrides the zonal block.
  if (phase === "defend") {
    const markId = state.markAssign.get(p.id);
    const mark = markId ? state.playerById.get(markId) : undefined;
    if (mark) {
      return { pos: markTarget(state, p, mark), speed: PRESS_SPEED * 0.95 };
    }
    return { pos: clampTarget(state, t), speed: baseSpeed };
  }

  // ATTACK — role-based support (computeAttackSupport) so the team offers a
  // MIX of options instead of everyone sprinting at goal. `t` already holds
  // the zonal line target, which is what `hold` players use.
  if (phase === "attack" && owner) {
    let speed = baseSpeed;
    const role = state.attackRole.get(p.id) ?? "hold";
    // Which touchline this player's formation lane favours.
    const laneSide = p.anchor.y < FIELD_H / 2 ? -1 : 1;

    if (role === "run") {
      // Penetrate in behind, ahead of the carrier, staggered into this
      // player's lane so two runners don't converge on the same spot.
      t.x = clamp(owner.x + dir * 300, 200, FIELD_W - 120);
      t.y = clamp(
        FIELD_H / 2 +
          laneSide * FIELD_H * 0.22 +
          (state.ball.y - FIELD_H / 2) * 0.2,
        70,
        FIELD_H - 70,
      );
      speed = RUN_SPEED;
    } else if (role === "short") {
      // Check back toward the ball — slightly behind the carrier and off to
      // one side — to give a safe, supporting pass option.
      t.x = clamp(owner.x - dir * 150, 120, FIELD_W - 120);
      t.y = clamp(owner.y + laneSide * 150, 70, FIELD_H - 70);
      speed = Math.max(baseSpeed, RUN_SPEED * 0.8);
    } else if (role === "width") {
      // Hold the touchline a touch ahead of the ball to stretch the block.
      t.x = fromDepth(clamp(ballD + 90, W * 0.25, W - 200));
      t.y = clamp(FIELD_H / 2 + laneSide * FIELD_H * 0.4, 80, FIELD_H - 80);
      speed = Math.max(baseSpeed, RUN_SPEED * 0.7);
    }
    // `hold`: keep the zonal `t` (defenders + deep mids stay back to recycle
    // and screen the counter).

    // Get open: drift away from the nearest opponent near the spot so
    // there's always a clean passing option. A wider bubble (was 95) makes
    // off-ball players actively peel into space instead of standing on a
    // marker — passing lanes open up.
    const pos = clampTarget(state, t);
    const opps = p.team === "home" ? state.awayPlayers : state.homePlayers;
    const near = nearestTo(state, opps, pos);
    if (near) {
      const d = dist(near, pos);
      if (d < 130) {
        const push = 130 - d;
        pos.x += ((pos.x - near.x) / (d || 1)) * push;
        pos.y += ((pos.y - near.y) / (d || 1)) * push;
      }
    }
    return { pos: clampTarget(state, pos), speed };
  }

  // LOOSE
  return { pos: clampTarget(state, t), speed: baseSpeed };
}

export function practiceSupportPlan(
  state: MatchState,
  p: PlayerEntity,
): { pos: Vec; speed: number } {
  const ref = state.controlled ?? { x: state.ball.x, y: state.ball.y };
  // Horizontal bias from the player's staged slot: deeper slots offer a
  // back option, advanced slots an outlet ahead — but always within a
  // short pass and well short of the keeper's goal line.
  const fwd = clamp(p.anchor.x - FIELD_W * 0.5, -M(12), M(12));
  let t = {
    x: clamp(ref.x + fwd, M(25), FIELD_W - M(24)),
    y: clamp(
      p.anchor.y + (state.ball.y - FIELD_H / 2) * 0.15,
      M(6),
      FIELD_H - M(6),
    ),
  };
  // Don't crowd the carrier — hold at least a passing distance away.
  const dx = t.x - ref.x;
  const dy = t.y - ref.y;
  const d = Math.hypot(dx, dy);
  const MIN = M(9);
  if (d < MIN && d > 0.1) {
    t = {
      x: clamp(ref.x + (dx / d) * MIN, M(25), FIELD_W - M(24)),
      y: clamp(ref.y + (dy / d) * MIN, M(6), FIELD_H - M(6)),
    };
  }
  return { pos: clampTarget(state, t), speed: TEAMMATE_SPEED };
}

export function updateHomeTeammates(state: MatchState, dt: number) {
  const awayCarrier =
    state.owner && state.owner.team === "away" ? state.owner : null;
  // One teammate actively presses the CPU carrier (or races to a loose
  // ball the CPU last touched) — the user only controls one player, so
  // without this the team never defends. Everyone else marks/keeps shape.
  let presser: PlayerEntity | null = null;
  const candidates = state.homePlayers.filter(
    (p) => p !== state.controlled && !p.isGK && state.owner !== p,
  );
  if (awayCarrier) {
    presser = nearestTo(state, candidates, awayCarrier);
  } else if (!state.owner && state.lastKicker?.team === "away") {
    presser = nearestTo(state, candidates, state.ball);
  }

  // Second-man containment: a covering defender steps out to jockey
  // goal-side of the carrier (FIFA-style) so the user is squeezed into
  // passing instead of dribbling unopposed past a backpedalling block.
  const container = awayCarrier
    ? pickContainer(state, state.homePlayers, awayCarrier, presser)
    : null;

  for (const p of state.homePlayers) {
    if (p === state.controlled) continue;
    if (state.owner === p) {
      if (p.isGK) {
        // Your keeper distributes automatically: pass to the most open
        // teammate (control stays where it is — no auto-switch).
        steer(state, p, 0, 0, dt);
        homeKeeperDistribute(state, dt);
        continue;
      }
      // A teammate has the ball but you haven't switched to them:
      // they shield it and wait for you (press Q to take over).
      steer(state, p, 0, 0, dt);
      faceToward(state, p, 1, 0, dt);
      continue;
    }
    if (p === presser) {
      // Drive straight at the carrier (no slow-in) to barge into a challenge;
      // chase a loose ball with anticipation instead.
      if (awayCarrier) {
        driveToward(state, p, awayCarrier, PRESS_SPEED, dt);
      } else {
        const t = clampTarget(state, {
          x: state.ball.x + state.ball.vx * 0.18,
          y: state.ball.y + state.ball.vy * 0.18,
        });
        moveToward(state, p, t, PRESS_SPEED, dt);
      }
      continue;
    }
    if (p === container && awayCarrier) {
      // Jockey into a goal-side contain spot (moveToward slow-in lets him
      // settle and hold the line rather than diving in — that's the presser's
      // job). Forces the carrier wide or into a pass.
      moveToward(
        state,
        p,
        containTarget(state, p, awayCarrier),
        PRESS_SPEED,
        dt,
      );
      continue;
    }
    const plan = state.practice
      ? practiceSupportPlan(state, p)
      : offBallPlan(state, p, TEAMMATE_SPEED);
    // Jog into position, but RUN when badly out of position.
    const sp =
      dist(p, plan.pos) > 240 ? Math.max(plan.speed, RUN_SPEED) : plan.speed;
    moveToward(state, p, plan.pos, sp, dt);
  }

  // Your AI teammates also commit tackles on the away carrier (so you aren't
  // forced to switch + tackle manually for every challenge). Same realism
  // gate + shared cooldown as the CPU side.
  if (awayCarrier && state.cpuTackleCd <= 0) {
    for (const p of state.homePlayers) {
      if (p.isGK || p === state.controlled) continue;
      if (pokeTackle(state, p, CONTROL_DIST + 10)) {
        state.cpuTackleCd = 0.55;
        break;
      }
    }
  }
}

export function updateAwayTeam(state: MatchState, dt: number) {
  if (state.practice) {
    updatePracticeAway(state, dt);
    return;
  }
  const carrier =
    state.owner && state.owner.team === "away" ? state.owner : null;
  // The keeper isn't a generic chaser — his own keeperPlan decides when to
  // hold the line vs. rush out (and keeps him inside the box).
  const level = DIFFICULTY[state.difficulty];
  const outfield = state.awayPlayers.filter((p) => !p.isGK);
  const chaser =
    carrier ?? nearestTo(state, outfield, state.ball) ?? state.awayPlayers[1];

  // When the USER has the ball, the nearest CPU defender steps right onto him
  // and commits a tackle — a defender in front of you should actually try to
  // win it, not back off and let you stroll past.
  const userCarrier =
    state.owner && state.owner.team === "home" && !state.owner.isGK
      ? state.owner
      : null;

  // FIFA second-man defending: while `chaser` presses the ball, a `container`
  // steps out to jockey goal-side of the carrier — cutting his forward lane
  // so he can't just run, forcing a pass/turn. Only when the user is on the
  // ball (when the CPU has it, the chaser IS the carrier).
  const container = userCarrier
    ? pickContainer(state, outfield, userCarrier, chaser)
    : null;

  for (const p of state.awayPlayers) {
    if (p === carrier) {
      updateAwayCarrier(state, p, dt);
    } else if (p === chaser) {
      // Chase to engage. When hunting the user's carrier, DRIVE straight at
      // the man at full pace (no slow-in) so the defender barges into body
      // contact and wins the jostle, instead of hovering a few px behind. A
      // loose ball is chased with slight anticipation.
      if (userCarrier) {
        driveToward(state, p, userCarrier, AWAY_CHASE_SPEED * level.speed, dt);
      } else {
        const t = {
          x: clamp(state.ball.x + state.ball.vx * 0.18, p.r, FIELD_W - p.r),
          y: clamp(state.ball.y + state.ball.vy * 0.18, p.r, FIELD_H - p.r),
        };
        moveToward(state, p, t, AWAY_CHASE_SPEED * level.speed, dt);
      }
    } else if (p === container && userCarrier) {
      // Jockey into the containing spot (moveToward eases in so he holds the
      // line rather than barging through — the chaser is the committed one).
      moveToward(
        state,
        p,
        containTarget(state, p, userCarrier),
        PRESS_SPEED * level.speed,
        dt,
      );
    } else {
      const plan = offBallPlan(state, p, AWAY_FORMATION_SPEED * level.speed);
      const sp =
        dist(p, plan.pos) > 240 ? Math.max(plan.speed, RUN_SPEED) : plan.speed;
      moveToward(state, p, plan.pos, sp, dt);
    }
  }

  // CPU tackling: any away outfielder who has got the ball into range pokes
  // it off the user (on a shared cooldown so it isn't a frame-by-frame
  // vacuum). pokeTackle already enforces the realism gate (must be ball-side
  // and facing the ball — can't tackle from behind).
  if (userCarrier && state.cpuTackleCd <= 0) {
    for (const p of state.awayPlayers) {
      if (p.isGK) continue;
      if (pokeTackle(state, p, CONTROL_DIST + 10)) {
        state.cpuTackleCd = level.tackleCd;
        break;
      }
    }
  }
}

export function updatePracticeAway(state: MatchState, dt: number) {
  const gk = state.awayPlayers.find((p) => p.isGK)!;
  if (!gk) return;
  if (state.owner === gk) {
    updateAwayCarrier(state, gk, dt);
  } else {
    const plan = offBallPlan(state, gk, AWAY_FORMATION_SPEED);
    moveToward(state, gk, plan.pos, plan.speed, dt);
  }
}

export function updateAwayCarrier(
  state: MatchState,
  p: PlayerEntity,
  dt: number,
) {
  const level = DIFFICULTY[state.difficulty];
  // Taking a throw-in: stand and throw it back into play by hand (after a
  // short beat so the hold reads on screen), to the most open teammate.
  if (p === state.throwInTaker) {
    steer(state, p, 0, 0, dt);
    if (state.cpuDecision > 0) return;
    executeThrowIn(state, p, false);
    return;
  }

  // The keeper doesn't dribble out — he CATCHES, holds the ball in his hands
  // for a beat (so the save + gather reads on screen), then clears upfield.
  if (p.isGK) {
    steer(state, p, 0, 0, dt);
    // Hold the caught ball in hands before distributing — without this the
    // keeper booted it the instant he gathered, so a save looked like an
    // immediate clearance (never a visible catch).
    state.gkHoldTimer += dt;
    if (state.gkHoldTimer < 1.1) return;
    if (state.cpuDecision > 0) return;
    state.gkHoldTimer = 0;
    state.cpuDecision = level.decision;
    if (state.practice) practiceKeeperClear(state, p);
    else keeperDistribute(state, p);
    return;
  }

  // Dribble toward the player's (left) goal.
  const t = { x: 36, y: FIELD_H / 2 + (p.y - FIELD_H / 2) * 0.35 };
  moveToward(state, p, t, AWAY_CARRY_SPEED * level.speed, dt);

  if (state.cpuDecision > 0) return;
  state.cpuDecision = level.decision;

  const pressure = nearestOpponentDist(state, p);

  // Shoot when in range.
  if (p.x < (p.cast?.finisher ? FINISHER_RANGE : 300)) {
    state.nextKickKind = "shot";
    const keeper = state.homePlayers.find((m) => m.isGK);
    const gy = p.cast?.finisher
      ? (keeper?.y ?? FIELD_H / 2) <= FIELD_H / 2
        ? goalBottom - FINISHER_CORNER_MARGIN
        : goalTop + FINISHER_CORNER_MARGIN
      : clamp(p.y, goalTop + 24, goalBottom - 24);
    // SHOOTING applies to the CPU too — a weak forward hits it softer and
    // less accurately, a clinical one rifles it in.
    kickBallToward(
      state,
      { x: 0, y: gy },
      600 * shotPowerMul(p.ratings),
      p,
      // Same apex-height model as the human shot: aim for a low ~M(0.7) peak
      // so the CPU's strike is a driven, mostly-rising effort (loft solved
      // from the new realistic GRAVITY) rather than a fixed up-and-over lob.
      Math.sqrt(2 * GRAVITY * M(0.7)),
      0.05 * shotSpreadMul(p.ratings) * level.aim,
    );
    return;
  }

  // Pass when pressured and a teammate is further forward + open; a cast
  // favourite is also fed the ball unpressured.
  const favorite = castPassTarget(
    state,
    state.awayPlayers.filter((m) => m !== p && !m.isGK),
  );
  const finisherOpen = state.awayPlayers.some(
    (m) =>
      m !== p &&
      m.cast?.finisher &&
      m.x < p.x - 40 &&
      nearestOpponentDist(state, m) >= 90,
  );
  if (pressure < 85 || favorite || finisherOpen) {
    let best: PlayerEntity | null = favorite;
    let bestScore = -Infinity;
    for (const m of favorite ? [] : state.awayPlayers) {
      if (m === p) continue;
      if (m.x > p.x - 40) continue; // must be more advanced (closer to left goal)
      const openness = nearestOpponentDist(state, m);
      if (openness < 90) continue;
      const score =
        openness -
        dist(p, m) * 0.2 +
        (m.cast?.finisher ? FINISHER_PASS_BONUS : 0);
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    if (best) {
      const d = dist(state.ball, best);
      kickBallToward(
        state,
        { x: best.x + best.vx * 0.2, y: best.y + best.vy * 0.2 },
        passPower(state, d, 260, 780) * passPowerMul(p.ratings),
        p,
        0,
        0.03 * passSpreadMul(p.ratings) * level.aim,
      );
    }
  }
}

export function updateAwayActive(state: MatchState) {
  if (state.owner && state.owner.team === "away") {
    state.awayActive = state.owner;
    return;
  }
  const outfield = state.awayPlayers.filter((p) => !p.isGK);
  state.awayActive = nearestTo(state, outfield, state.ball) ?? state.awayActive;
}
