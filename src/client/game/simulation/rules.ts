import { recordEvent } from "./events";
import {
  celebrationSecs,
  FIELD_H,
  FIELD_W,
  goalBottom,
  goalTop,
  M,
  RUN_SPEED,
  WALK_SPEED,
} from "../constants";
import { clamp } from "../math";
import type { PlayerEntity, Team, Vec } from "../types";
import { clampToField, moveToward, nearestTo } from "./movement";
import type { MatchState } from "./state";

export function resetKickoff(state: MatchState, kickingTeam: Team) {
  recordEvent(state, "restart", null, kickingTeam);
  state.receptionTime = 0;
  state.ball.x = FIELD_W / 2;
  state.ball.y = FIELD_H / 2;
  state.ball.z = 0;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.ball.vz = 0;

  for (const p of [...state.homePlayers, ...state.awayPlayers]) {
    p.x = p.anchor.x;
    p.y = p.anchor.y;
    p.vx = p.vy = 0;
    p.kickTimer = 0;
    p.celebrating = false;
    p.diveTimer = 0;
    p.diveCooldown = 0;
    p.throwing = false;
    p.facing = { x: p.team === "home" ? 1 : -1, y: 0 };
  }
  state.throwInTaker = null;
  state.outOfPlay = 0;
  state.pendingRestart = null;

  // Put the kicking team's forward on the ball.
  const fwd =
    kickingTeam === "home"
      ? state.homePlayers[state.homeTeam.kickoffFwd]
      : state.awayPlayers[state.awayTeam.kickoffFwd];
  fwd.x = FIELD_W / 2 + (kickingTeam === "home" ? -34 : 34);
  fwd.y = FIELD_H / 2;

  if (kickingTeam === "home")
    state.controlled = state.homePlayers[state.homeTeam.kickoffFwd];

  state.owner = null;
  state.lastKicker = null;
  state.lastTouchTeam = kickingTeam;
  state.kickerLock = 0;
  state.passReceiver = null;
  state.aerialReceiver = null;
  state.gkRush = 0;
  state.stealProtect = 0;
  state.dispossessed = null;
  state.dispossessedTimer = 0;
  state.markAssign.clear();
  state.markTimer = 0;
  state.chargeKey = null;
  state.chargeTime = 0;
  state.bufferTimer = 0;
  state.kickPending = false;
  state.ballFree = 0;
  state.offsideFlags.clear();
  state.tackleTimer = 0;
  state.tackleCooldown = 0;
  state.slideCooldown = 0;
  for (const pl of [...state.homePlayers, ...state.awayPlayers]) {
    pl.slideTimer = 0;
  }
  state.jostle = 0;
  state.freeze = 0.9;
  state.celebration = 0;
  state.celebrateTeam = null;
  state.pendingKickoff = null;
  state.scorer = null;

  if (state.practice) placePracticePlayers(state);
}

export function placePracticePlayers(state: MatchState) {
  const out = state.homePlayers.filter((p) => !p.isGK);
  const xs = [FIELD_W * 0.45, FIELD_W * 0.6, FIELD_W * 0.5, FIELD_W * 0.62];
  const ys = [FIELD_H * 0.22, FIELD_H * 0.4, FIELD_H * 0.6, FIELD_H * 0.78];
  out.forEach((p, i) => {
    p.x = xs[i % xs.length];
    p.y = ys[i % ys.length];
    p.anchor.x = p.x;
    p.anchor.y = p.y;
    p.vx = p.vy = 0;
    p.facing = { x: 1, y: 0 };
  });

  const hgk = state.homePlayers.find((p) => p.isGK)!;
  hgk.x = hgk.anchor.x = M(4);
  hgk.y = hgk.anchor.y = FIELD_H / 2;

  const agk = state.awayPlayers.find((p) => p.isGK)!;
  agk.x = agk.anchor.x = FIELD_W - M(4);
  agk.y = agk.anchor.y = FIELD_H / 2;

  const starter = out.length
    ? out[Math.floor(out.length / 2)]
    : state.homePlayers.find((p) => p.isGK)!;
  state.controlled = starter;
  state.ball.x = starter.x + 14;
  state.ball.y = starter.y;
  state.ball.z = 0;
  state.ball.vx = state.ball.vy = state.ball.vz = 0;
  state.owner = starter;
  state.lastTouchTeam = "home";
}

export function practiceResetBall(state: MatchState) {
  state.lastKicker = null;
  state.kickerLock = 0;
  state.passReceiver = null;
  state.aerialReceiver = null;
  state.ballFree = 0;
  state.gkHoldTimer = 0;
  placePracticePlayers(state);
}

export function setMessage(state: MatchState, msg: string, secs: number) {
  state.message = msg;
  state.messageTimer = secs;
}

export function snapshotOffside(state: MatchState, kicker: PlayerEntity) {
  state.offsideFlags.clear();
  if (state.practice) return; // no offside in free-form practice
  const team = kicker.team;
  const mates = team === "home" ? state.homePlayers : state.awayPlayers;
  const opps = team === "home" ? state.awayPlayers : state.homePlayers;
  // Project positions onto the attacking axis so "more forward" is always a
  // larger number (home attacks +x, away attacks -x).
  const atk = team === "home" ? 1 : -1;
  const fwd = (x: number) => x * atk;

  // Offside line = the second-deepest defender along the attack axis.
  const oppFwd = opps.map((o) => fwd(o.x)).sort((a, b) => b - a);
  const line = oppFwd.length >= 2 ? oppFwd[1] : (oppFwd[0] ?? Infinity);
  const ballFwd = fwd(state.ball.x);
  const halfFwd = fwd(FIELD_W / 2);
  // A player level with the defender / ball is onside — small tolerance.
  const TOL = 6;

  for (const m of mates) {
    if (m === kicker || m.isGK) continue;
    const mf = fwd(m.x);
    if (mf > line + TOL && mf > ballFwd + TOL && mf > halfFwd) {
      state.offsideFlags.add(m.id);
    }
  }
}

export function callOffside(state: MatchState, offsider: PlayerEntity) {
  const atkTeam = offsider.team;
  const defTeam: Team = atkTeam === "home" ? "away" : "home";
  const defs = defTeam === "home" ? state.homePlayers : state.awayPlayers;
  const defAtk = defTeam === "home" ? 1 : -1;

  // Free kick spot: where the offside player was when the ball reached him.
  const spotX = clamp(offsider.x, 40, FIELD_W - 40);
  const spotY = clamp(offsider.y, 28, FIELD_H - 28);

  // Stop the ball dead at the spot.
  state.ball.x = spotX;
  state.ball.y = spotY;
  state.ball.z = 0;
  state.ball.vx = state.ball.vy = state.ball.vz = 0;

  // Reposition for the restart like a real free kick: everyone KEEPS their
  // current spot (play just stopped where it was) — we only clear momentum
  // and turn them upfield. The one exception is the OFFENDING attacking
  // team: any of their players standing ahead of the ball is pulled BACK
  // onside (to the own-half side of the spot) so they're clearly behind the
  // restart and out of the kicker's way. The defending team holds its shape.
  const atkDir = atkTeam === "home" ? 1 : -1; // attackers' attacking axis
  for (const p of [...state.homePlayers, ...state.awayPlayers]) {
    if (p.team === atkTeam && !p.isGK) {
      // Distance the player is AHEAD of the ball along the attack axis.
      const ahead = (p.x - spotX) * atkDir;
      if (ahead > -20) {
        // Drop them back behind the ball, keeping their vertical lane.
        p.x = clamp(spotX - atkDir * (28 + ahead), p.r, FIELD_W - p.r);
      }
    }
    p.vx = p.vy = 0;
    p.kickTimer = 0;
    p.facing = { x: p.team === "home" ? 1 : -1, y: 0 };
  }

  // Nearest outfield defender takes the kick; drop him onto the ball facing
  // upfield so he can play out.
  const taker =
    nearestTo(
      state,
      defs.filter((p) => !p.isGK),
      { x: spotX, y: spotY },
    ) ?? defs[1];
  taker.x = clamp(spotX - defAtk * 16, taker.r, FIELD_W - taker.r);
  taker.y = spotY;
  taker.vx = taker.vy = 0;
  taker.facing = { x: defAtk, y: 0 };

  // Attackers must retreat the regulation free-kick distance (9.15 m).
  pushOpponentsFromSpot(state, defTeam, { x: spotX, y: spotY }, M(9.15));

  recordEvent(state, "restart", taker);
  state.owner = taker;
  state.controlled =
    defTeam === "home" ? taker : state.homePlayers[state.homeTeam.kickoffFwd];

  // Pan the camera to the restart and hold play for a beat.

  setMessage(state, "OFFSIDE", 1.6);
  state.freeze = 1.1;

  // Clear all transient ball/possession state so play restarts cleanly.
  state.offsideFlags.clear();
  state.lastKicker = null;
  state.kickerLock = 0;
  state.stealProtect = 1.2;
  state.dispossessed = null;
  state.dispossessedTimer = 0;
  state.markAssign.clear();
  state.markTimer = 0;
  state.ballFree = 0;
  state.jostle = 0;
  state.tackleTimer = 0;
  state.tackleCooldown = 0;
  state.chargeKey = null;
  state.chargeTime = 0;
  state.bufferTimer = 0;
  state.kickPending = false;
}

export function checkOutOfPlay(state: MatchState) {
  const b = state.ball;
  const last = state.lastTouchTeam;

  // Practice: no throw-ins / corners / goal kicks. A ball that leaves the
  // pitch (other than a shot crossing the keeper's goal line, left for
  // handleGoals) is simply respawned in the middle to keep free play going.
  if (state.practice) {
    const inMouth = b.y > goalTop && b.y < goalBottom;
    if (b.x > FIELD_W && inMouth && b.z <= M(2.44)) return; // a goal — leave it
    if (b.x < 0 || b.x > FIELD_W || b.y < 0 || b.y > FIELD_H) {
      practiceResetBall(state);
    }
    return;
  }

  // ---- Touchlines → throw-in ----
  if (b.y < 0 || b.y > FIELD_H) {
    const outY = b.y < 0 ? 0 : FIELD_H;
    const toTeam: Team = last === "home" ? "away" : "home";
    const spotX = clamp(b.x, M(3), FIELD_W - M(3));
    // No banner text for a throw-in — it's taken with the hands (see
    // executeThrowIn) and doesn't need an on-screen announcement.
    queueRestart(state, toTeam, spotX, outY, "", false, true);
    return;
  }

  // ---- Goal lines → goal kick / corner (or a scored goal: leave it) ----
  if (b.x < 0 || b.x > FIELD_W) {
    const leftLine = b.x < 0;
    const inMouth = b.y > goalTop && b.y < goalBottom;
    // A ball in the mouth and under the bar is a GOAL — handleGoals scores it.
    if (inMouth && b.z <= M(2.44)) return;
    // Left line (x=0) is HOME's goal (home defends, away attacks); right line
    // (x=FIELD_W) is AWAY's goal.
    const attackingTeam: Team = leftLine ? "away" : "home";
    const defendingTeam: Team = leftLine ? "home" : "away";
    const goalX = leftLine ? 0 : FIELD_W;
    if (last === attackingTeam) {
      // Attacker put it out → goal kick to the defending keeper.
      const dir = leftLine ? 1 : -1;
      const spotX = goalX + dir * M(5.5); // edge of the 6-yard box
      const spotY = clamp(b.y, FIELD_H / 2 - M(6), FIELD_H / 2 + M(6));
      queueRestart(
        state,
        defendingTeam,
        spotX,
        spotY,
        "GOAL KICK",
        true,
        false,
      );
    } else {
      // Defender put it out (or unknown) → corner to the attacking side.
      const cornerY = b.y < FIELD_H / 2 ? M(1) : FIELD_H - M(1);
      const name = (
        attackingTeam === "home" ? state.homeTeam : state.awayTeam
      ).name.toUpperCase();
      queueRestart(
        state,
        attackingTeam,
        goalX,
        cornerY,
        `CORNER · ${name}`,
        false,
        false,
      );
    }
  }
}

export function queueRestart(
  state: MatchState,
  team: Team,
  spotX: number,
  spotY: number,
  label: string,
  takerIsGK: boolean,
  isThrowIn: boolean,
) {
  // Don't freeze the ball at the line — let it carry on past the boundary and
  // roll/fly out (like real football / FIFA) while the out-of-play pause runs.
  // It keeps its velocity; updateOutOfPlay coasts it with extra drag so it
  // slows quickly (into the netting / crowd) and stays in view.
  state.owner = null;
  state.aerialReceiver = null;
  state.pendingRestart = { team, spotX, spotY, label, takerIsGK, isThrowIn };
  state.outOfPlay = 1.2;
}

export function awardRestart(
  state: MatchState,
  team: Team,
  spotX: number,
  spotY: number,
  label: string,
  takerIsGK: boolean,
  isThrowIn = false,
) {
  const players = team === "home" ? state.homePlayers : state.awayPlayers;
  const atkDir = team === "home" ? 1 : -1;

  state.ball.x = spotX;
  state.ball.y = spotY;
  state.ball.z = 0;
  state.ball.vx = state.ball.vy = state.ball.vz = 0;

  for (const p of [...state.homePlayers, ...state.awayPlayers]) {
    p.vx = p.vy = 0;
    p.kickTimer = 0;
    p.diveTimer = 0;
    p.diveCooldown = 0;
    p.throwing = false;
    p.facing = { x: p.team === "home" ? 1 : -1, y: 0 };
  }

  const pool = takerIsGK
    ? players.filter((p) => p.isGK)
    : players.filter((p) => !p.isGK);
  const taker = nearestTo(state, pool, { x: spotX, y: spotY }) ?? players[1];
  taker.x = clamp(spotX - atkDir * 14, taker.r, FIELD_W - taker.r);
  taker.y = clamp(spotY, taker.r, FIELD_H - taker.r);
  taker.vx = taker.vy = 0;
  taker.facing = { x: atkDir, y: 0 };

  // A throw-in is taken with the HANDS: arm the taker so he holds the ball
  // overhead and releases a hand throw (see dribble + executeThrowIn).
  state.throwInTaker = isThrowIn ? taker : null;
  taker.throwing = isThrowIn;

  // Opponents must retreat the regulation distance from the restart (FIFA:
  // 2 m for a throw-in, 9.15 m for a corner, and well clear of the box for a
  // goal kick). Push any encroaching opponent radially off the spot.
  const keepOut = isThrowIn ? M(4) : takerIsGK ? M(11) : M(9.15);
  pushOpponentsFromSpot(state, team, { x: spotX, y: spotY }, keepOut);

  recordEvent(state, "restart", taker);
  state.owner = taker;
  state.controlled =
    team === "home" ? taker : state.homePlayers[state.homeTeam.kickoffFwd];

  if (label) setMessage(state, label, 1.6);
  state.freeze = 0.9;

  // Clear transient ball/possession state so play restarts cleanly.
  state.lastKicker = null;
  state.lastTouchTeam = team;
  state.kickerLock = 0;
  state.stealProtect = 1.0;
  state.dispossessed = null;
  state.dispossessedTimer = 0;
  state.offsideFlags.clear();
  state.markAssign.clear();
  state.markTimer = 0;
  state.ballFree = 0;
  state.jostle = 0;
  state.tackleTimer = 0;
  state.tackleCooldown = 0;
  state.gkRush = 0;
  state.chargeKey = null;
  state.chargeTime = 0;
  state.bufferTimer = 0;
  state.kickPending = false;
  state.passReceiver = null;
}

export function pushOpponentsFromSpot(
  state: MatchState,
  keepTeam: Team,
  spot: Vec,
  minDist: number,
) {
  for (const p of [...state.homePlayers, ...state.awayPlayers]) {
    if (p.team === keepTeam || p.isGK) continue;
    let dx = p.x - spot.x;
    let dy = p.y - spot.y;
    let d = Math.hypot(dx, dy);
    if (d >= minDist) continue;
    if (d < 0.001) {
      // Standing right on the spot — shove toward their own goal.
      dx = p.team === "home" ? -1 : 1;
      dy = 0;
      d = 1;
    }
    p.x = spot.x + (dx / d) * minDist;
    p.y = spot.y + (dy / d) * minDist;
    clampToField(state, p);
  }
}

export function handleGoals(state: MatchState) {
  if (state.celebration > 0) return;
  const inMouth = state.ball.y > goalTop && state.ball.y < goalBottom;
  if (!inMouth) return;
  // Over the bar — a ball higher than the crossbar (2.44 m) isn't a goal.
  if (state.ball.z > M(2.44)) return;

  // Practice: count strikes into the keeper's (right-hand) goal and flash a
  // quick GOAL!, then respawn — no celebration / kickoff sequence.
  if (state.practice) {
    if (state.ball.x >= FIELD_W - 2) {
      state.homeScore += 1;
      recordEvent(state, "goal", state.lastKicker, "home");
      setMessage(state, "GOAL!", celebrationSecs(state.lastKicker));
      state.celebration = celebrationSecs(state.lastKicker);
      state.scorer = state.lastKicker;
      state.owner = null;
      state.ball.vx = state.ball.vy = state.ball.vz = 0;
    } else if (state.ball.x <= 2) {
      practiceResetBall(state);
    }
    return;
  }

  if (state.ball.x <= 2) {
    state.awayScore += 1;
    startCelebration(
      state,
      "away",
      `${state.awayTeam.name.toUpperCase()} SCORE`,
      "home",
      "left",
    );
  } else if (state.ball.x >= FIELD_W - 2) {
    state.homeScore += 1;
    startCelebration(state, "home", "G O A L !", "away", "right");
  }
}

export function startCelebration(
  state: MatchState,
  scoringTeam: Team,
  msg: string,
  nextKickoff: Team,
  side: "left" | "right",
) {
  recordEvent(state, "goal", state.lastKicker, scoringTeam);
  state.celebration = celebrationSecs(state.lastKicker);
  state.celebrateTeam = scoringTeam;
  state.pendingKickoff = nextKickoff;
  setMessage(state, msg, state.celebration);
  state.netRipple[side] = 1;

  // Nestle the ball into the back of the net so the strike clearly counts.
  state.ball.vx = state.ball.vy = state.ball.vz = 0;
  state.ball.z = 0;
  state.ball.x = side === "left" ? -M(1.4) : FIELD_W + M(1.4);
  state.ball.y = clamp(state.ball.y, goalTop + 14, goalBottom - 14);

  // The scorer is the scoring side's last kicker; teammates mob them.
  state.scorer =
    state.lastKicker && state.lastKicker.team === scoringTeam
      ? state.lastKicker
      : null;
  const team = scoringTeam === "home" ? state.homePlayers : state.awayPlayers;
  for (const p of team) if (!p.isGK) p.celebrating = true;
  state.owner = null;
}

export function updateCelebration(state: MatchState, dt: number) {
  if (!state.celebrateTeam) return;
  const scoredRight = state.celebrateTeam === "home";
  const cornerX = scoredRight ? FIELD_W - M(16) : M(16);
  const cornerY = FIELD_H * 0.82;

  for (const p of [...state.homePlayers, ...state.awayPlayers]) {
    if (p === state.scorer || p.cast?.still) {
      p.vx = p.vy = 0;
      continue;
    }
    if (p.celebrating) {
      // Scoring side: wheel away to the corner / mob the scorer.
      let tx = cornerX;
      let ty = cornerY;
      if (state.scorer && p !== state.scorer) {
        tx = state.scorer.x + (scoredRight ? -34 : 34);
        ty = state.scorer.y - 6;
      }
      moveToward(state, p, { x: tx, y: ty }, RUN_SPEED * 0.62, dt);
    } else {
      // Everyone else (the conceding team + the scoring keeper): walk back
      // toward their formation anchor at a slow, dejected pace instead of
      // standing frozen. The conceding keeper drifts toward the ball in the
      // net as if collecting it to restart quickly.
      const concededTeam = (p.team === "home") !== scoredRight; // true if p just conceded
      let target = p.anchor;
      if (p.isGK && concededTeam) {
        target = { x: state.ball.x, y: state.ball.y };
      }
      moveToward(state, p, target, WALK_SPEED * 0.6, dt);
    }
  }
}
