import {
  FIELD_H,
  FIELD_W,
  KEYBOARD_MIN_CONCEDED,
  M,
  MATCH_REAL_SECS,
} from "../constants";
import { clamp } from "../math";
import { handleSwitchKey, updateControlled, updateSwitchHint } from "./actions";
import {
  computeAttackSupport,
  computeMarking,
  updateAwayActive,
  updateAwayTeam,
  updateHomeTeammates,
} from "./ai";
import { constrainKeeperWithBall, updateKeeperReactions } from "./keepers";
import { integrateBall, updateBall } from "./physics";
import { resolvePossession, separatePlayers, updateJostle } from "./possession";
import {
  awardRestart,
  handleGoals,
  resetKickoff,
  practiceResetBall,
  setMessage,
  updateCelebration,
} from "./rules";
import type { MatchState } from "./state";

export function update(state: MatchState, dt: number) {
  if (state.messageTimer > 0) {
    state.messageTimer -= dt;
    if (state.messageTimer <= 0) state.message = "";
  }
  state.receptionTime = Math.max(0, state.receptionTime - dt);
  if (state.kickerLock > 0) state.kickerLock -= dt;
  // Keep kick provenance until a touch/reset; lock duration only prevents recapture.
  if (state.ballFree > 0) state.ballFree -= dt;
  if (state.gkRush > 0) state.gkRush -= dt;
  if (state.cpuDecision > 0) state.cpuDecision -= dt;
  if (state.stealProtect > 0) state.stealProtect -= dt;
  if (state.tackleCooldown > 0) state.tackleCooldown -= dt;
  if (state.slideCooldown > 0) state.slideCooldown -= dt;
  if (state.cpuTackleCd > 0) state.cpuTackleCd -= dt;
  if (state.dispossessedTimer > 0) {
    state.dispossessedTimer -= dt;
    if (state.dispossessedTimer <= 0) state.dispossessed = null;
  }
  for (const p of [...state.homePlayers, ...state.awayPlayers]) {
    if (p.kickTimer > 0) p.kickTimer -= dt;
    if (p.diveTimer && p.diveTimer > 0) p.diveTimer -= dt;
    if (p.diveCooldown && p.diveCooldown > 0) p.diveCooldown -= dt;
    if (p.slideTimer && p.slideTimer > 0) p.slideTimer -= dt;
  }
  if (state.netRipple.left > 0)
    state.netRipple.left = Math.max(0, state.netRipple.left - dt * 0.6);
  if (state.netRipple.right > 0)
    state.netRipple.right = Math.max(0, state.netRipple.right - dt * 0.6);

  // Goal celebration: hold play, let the ball sit in the net and the scorers
  // celebrate, then restart with the conceding side kicking off.
  if (state.celebration > 0) {
    state.celebration -= dt;
    updateCelebration(state, dt);

    state.justPressed = [];
    state.justReleased = [];
    if (state.celebration <= 0 && state.practice) {
      practiceResetBall(state);
      state.scorer = null;
    }
    if (state.celebration <= 0 && state.pendingKickoff) {
      resetKickoff(state, state.pendingKickoff);
    }
    return;
  }

  // Ball out of play: it keeps coasting past the line for a beat so you can
  // SEE it go out (FIFA-style), THEN the restart (throw-in / goal kick /
  // corner) is set up. Camera keeps tracking the ball during the pause.
  if (state.outOfPlay > 0) {
    state.outOfPlay -= dt;
    // Coast the ball out of bounds with heavy drag so it slows quickly (as if
    // into the netting / crowd) and clamp it to a small margin past the line
    // so it never sails off-screen.
    integrateBall(state, dt, 3.2);
    state.ball.x = clamp(state.ball.x, -M(7), FIELD_W + M(7));
    state.ball.y = clamp(state.ball.y, -M(7), FIELD_H + M(7));

    state.justPressed = [];
    state.justReleased = [];
    if (state.outOfPlay <= 0 && state.pendingRestart) {
      const r = state.pendingRestart;
      state.pendingRestart = null;
      awardRestart(
        state,
        r.team,
        r.spotX,
        r.spotY,
        r.label,
        r.takerIsGK,
        r.isThrowIn,
      );
    }
    return;
  }

  if (state.freeze > 0) {
    state.freeze -= dt;
    state.justPressed = [];
    state.justReleased = [];
    return;
  }

  if (!state.practice && !state.fullTime) {
    state.elapsed += dt;
    const extraTime =
      state.device === "keyboard" && state.awayScore < KEYBOARD_MIN_CONCEDED;
    if (state.elapsed >= MATCH_REAL_SECS && !extraTime) {
      state.fullTime = true;
      if (state.elapsed - dt < MATCH_REAL_SECS) state.elapsed = MATCH_REAL_SECS;
      const verdict =
        state.homeScore > state.awayScore
          ? `FULL TIME — ${state.homeTeam.name.toUpperCase()} WIN!`
          : state.homeScore < state.awayScore
            ? `FULL TIME — ${state.awayTeam.name.toUpperCase()} WIN!`
            : "FULL TIME — DRAW";
      setMessage(state, verdict, 9999);
      state.freeze = 9999;
    }
  }

  state.markTimer -= dt;
  if (state.markTimer <= 0) {
    state.markTimer = 0.35;
    computeMarking(state);
    computeAttackSupport(state);
  }

  updateSwitchHint(state);
  handleSwitchKey(state);
  updateControlled(state, dt);
  updateHomeTeammates(state, dt);
  updateAwayTeam(state, dt);
  separatePlayers(state);
  for (const p of state.homePlayers.concat(state.awayPlayers))
    if (p.stillAt) {
      p.x = p.stillAt.x;
      p.y = p.stillAt.y;
      p.vx = p.vy = 0;
    }
  constrainKeeperWithBall(state);
  updateJostle(state, dt);
  resolvePossession(state);
  updateKeeperReactions(state, dt);
  updateBall(state, dt);
  handleGoals(state);

  updateAwayActive(state);

  state.justPressed = [];
  state.justReleased = [];
}
