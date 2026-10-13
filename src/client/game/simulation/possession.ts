import { recordEvent } from "./events";
import { CONTROL_DIST, CONTROL_HEIGHT, M } from "../constants";
import { clamp, dist, len } from "../math";
import { duelRate, tackleReachMul } from "../ratings";
import type { PlayerEntity } from "../types";
import {
  keeperInOwnBox,
  keeperMayHandle,
  keeperParry,
  keeperReach,
  triggerKeeperDive,
} from "./keepers";
import { clampToField } from "./movement";
import { callOffside } from "./rules";
import type { MatchState } from "./state";

export function canTackle(
  state: MatchState,
  tackler: PlayerEntity,
  carrier: PlayerEntity,
  requireBallSide = true,
): boolean {
  if (requireBallSide) {
    // Shielding: is the defender on the same side as the ball, relative to
    // the carrier's body? If the carrier is between the defender and the
    // ball, the ball is screened and can't be taken cleanly.
    const ballSideX = state.ball.x - carrier.x;
    const ballSideY = state.ball.y - carrier.y;
    const tackSideX = tackler.x - carrier.x;
    const tackSideY = tackler.y - carrier.y;
    const sideDot = ballSideX * tackSideX + ballSideY * tackSideY;
    if (sideDot < 0) return false; // behind the carrier → shielded out
  }

  // Engagement: the defender must be facing toward the ball (within ~80°),
  // not turned the other way.
  const toBallX = state.ball.x - tackler.x;
  const toBallY = state.ball.y - tackler.y;
  const tb = len(toBallX, toBallY);
  const faceDot =
    (tackler.facing.x * toBallX + tackler.facing.y * toBallY) / tb;
  return faceDot > 0.15;
}

export function pokeTackle(
  state: MatchState,
  tackler: PlayerEntity,
  reach: number,
  requireBallSide = true,
): boolean {
  const carrier = state.owner;
  if (!carrier || carrier.team === tackler.team || carrier.isGK) return false;
  if (state.stealProtect > 0 || state.dispossessed === tackler) return false;
  // DEFENDING extends a tackler's effective reach — a top defender nicks it
  // from a touch further out and times the challenge better.
  if (dist(tackler, state.ball) > reach * tackleReachMul(tackler.ratings))
    return false;
  if (!canTackle(state, tackler, carrier, requireBallSide)) return false;

  const dx = tackler.x - carrier.x;
  const dy = tackler.y - carrier.y;
  const l = len(dx, dy);
  state.ball.x = tackler.x + (dx / l) * 6;
  state.ball.y = tackler.y + (dy / l) * 6;
  state.ball.vx = tackler.vx;
  state.ball.vy = tackler.vy;
  tackler.kickTimer = Math.max(tackler.kickTimer, 0.18);
  state.jostle = 0;
  return true;
}

export function updateJostle(state: MatchState, dt: number) {
  const o = state.owner;
  if (!o || o.isGK) {
    state.jostle = 0;
    return;
  }
  const opps = o.team === "home" ? state.awayPlayers : state.homePlayers;
  let challenger: PlayerEntity | null = null;
  let bestD = Infinity;
  for (const q of opps) {
    if (q.isGK || q === state.dispossessed) continue;
    const d = dist(q, o);
    // Body-contact challenge: a defender touch-tight to the carrier and
    // facing the ball is battling for it — from ANY side. You can't shield a
    // chaser off forever, so a defender glued to your back (or alongside) is
    // a valid challenger here (requireBallSide=false). Sustained contact then
    // wins it below, scaled by PHYSICALITY. The threshold is TIGHT (+3) so the
    // timer only accrues once the defender is genuinely on the carrier's back
    // (centre gap ~3px ≈ shoulders touching) — a looser gap let the steal fire
    // while the defender still hung half a metre off the back.
    if (d < o.r + q.r + 3 && d < bestD && canTackle(state, q, o, false)) {
      bestD = d;
      challenger = q;
    }
  }
  if (!challenger || state.stealProtect > 0) {
    state.jostle = Math.max(0, state.jostle - dt * 2.5);
    return;
  }
  // POSITION decides HOW FAST the duel goes. A defender dead behind the
  // carrier (ball shielded on the far side) can only nibble — he has to work
  // around toward the ball to actually win it. One alongside or goal-side
  // challenges effectively. alignment = (ball-carrier)·(tackler-carrier),
  // normalised: +1 = on the ball side (in front), 0 = directly alongside,
  // -1 = dead behind the carrier's back.
  const bsx = state.ball.x - o.x;
  const bsy = state.ball.y - o.y;
  const tsx = challenger.x - o.x;
  const tsy = challenger.y - o.y;
  const bl = len(bsx, bsy) || 1;
  const tl = len(tsx, tsy) || 1;
  const alignment = (bsx * tsx + bsy * tsy) / (bl * tl);
  // Map to an accrual factor: dead behind ≈0.22 (so a pure back-shield takes
  // ~2s of sustained tight contact — "eventually, if he stays glued", not
  // right away), alongside ≈0.6 (~0.8s), ball-side 1.0 (~0.5s).
  const posFactor = 0.22 + ((alignment + 1) / 2) * 0.78;
  // PHYSICALITY also weights the duel: a stronger challenger muscles the
  // carrier off sooner, a stronger carrier shields longer.
  state.jostle += dt * duelRate(challenger.ratings, o.ratings) * posFactor;
  if (state.jostle < 0.5) return;
  // Contact sustained long enough — the challenger muscles the ball away.
  // Pass requireBallSide=false: a body-contact battle wins from ANY side
  // (the challenger was already qualified that way above). Without this the
  // steal would be silently rejected by pokeTackle's default ball-side gate,
  // letting the carrier shield forever by keeping his back turned.
  pokeTackle(state, challenger, Infinity, false);
}

export function resolvePossession(state: MatchState) {
  const prev = state.owner;

  // A ball above chest height flies over everyone — nobody can trap it
  // until it drops back down (FIFA: lofted balls sail past players). The
  // throw-in taker is the exception: he holds the ball overhead in his hands.
  if (
    state.ball.z > CONTROL_HEIGHT &&
    (!state.owner || state.owner !== state.throwInTaker)
  ) {
    state.owner = null;
    return;
  }

  // Just-kicked grace: the ball is in flight and untouchable for a beat so
  // it clears the kicker's body cluster (prevents an opponent at the
  // kicker's back from instantly "receiving" the struck ball).
  if (state.ballFree > 0) {
    state.owner = null;
    return;
  }

  const ballSpeed = Math.hypot(state.ball.vx, state.ball.vy);
  let best: PlayerEntity | null = null;
  let bestD = Infinity;
  for (const p of [...state.homePlayers, ...state.awayPlayers]) {
    if (state.kickerLock > 0 && p === state.lastKicker) continue;
    // A freshly dispossessed player can't win the ball straight back.
    if (state.dispossessed === p) continue;
    // Keepers have HANDS: a bigger gather radius so a slow ball at their feet
    // is claimed (not left for an attacker to steal), and enough reach to
    // pull in / parry a shot they get across to.
    const reach = p.isGK ? keeperReach(state, p, ballSpeed) : CONTROL_DIST;
    const d = dist(p, state.ball);
    if (d <= reach && d < bestD) {
      bestD = d;
      best = p;
    }
  }

  // Hysteresis: the current owner keeps the ball against challengers
  // unless the challenger gets meaningfully closer AND the protection
  // window from winning it has elapsed.
  if (prev && best && best !== prev && state.dispossessed !== prev) {
    const prevD = dist(prev, state.ball);
    if (prevD <= CONTROL_DIST + 4) {
      const challengerWins =
        state.stealProtect <= 0 &&
        (best.team === prev.team || bestD < prevD - 7);
      if (!challengerWins) best = prev;
    }
  }

  // Offside: if the first teammate to touch the played ball was flagged
  // offside at the moment of the pass, blow the whistle. Any other first
  // touch (a defender, or an onside teammate) resolves the phase and clears
  // the flags.
  if (best && best !== prev && state.offsideFlags.size > 0) {
    if (state.offsideFlags.has(best.id)) {
      callOffside(state, best);
      return;
    }
    state.offsideFlags.clear();
  }

  // Possession changed hands.
  if (best && best !== prev) {
    state.jostle = 0;
    if (prev && prev.team !== best.team) {
      // Tackle won: protect the winner and lock out the loser.
      state.stealProtect = 0.9;
      state.dispossessed = prev;
      state.dispossessedTimer = 1.2;
      // Turn the winner away from the tackled opponent so the dribble
      // carries the ball out on the FAR side, not back into their feet.
      const dx = best.x - prev.x;
      const dy = best.y - prev.y;
      const l = len(dx, dy);
      best.facing = { x: dx / l, y: dy / l };
      state.ball.x = best.x + (dx / l) * (best.r + state.ball.r);
      state.ball.y = best.y + (dy / l) * (best.r + state.ball.r);
    } else {
      // Clean receive (pass or loose ball) — short protection.
      state.stealProtect = 0.35;
    }
  }

  // KEEPER CATCH vs PARRY: a keeper can only gather a weak/placed shot
  // cleanly into his hands. A fiercely-struck shot is too hot to hold — he
  // gets a hand/body to it and PARRIES it away to the side (toward the
  // nearer touchline), so the ball spills wide rather than sticking to his
  // hands or rebounding straight back into the striker's path.
  // Threshold lowered 820→600 (≈ a charge-0.36 shot) so only WEAK/placed
  // shots are caught cleanly — any firmly-struck shot is parried, not held
  // (user: "the GK catches shots too easily, it should only catch weaker ones").
  // A keeper can't HANDLE a deliberate back-pass from a team-mate, so he
  // can't parry one either — let it run to his feet to be controlled.
  const backPassToKeeper =
    best?.isGK &&
    state.lastKicker?.team === best.team &&
    state.lastKicker !== best;
  if (
    best &&
    best.isGK &&
    best !== prev &&
    (!prev || prev.team !== best.team) &&
    ballSpeed > 600 &&
    !backPassToKeeper &&
    keeperInOwnBox(state, best)
  ) {
    keeperParry(state, best, ballSpeed);
    return;
  }

  // OUTFIELD BLOCK: a fiercely-struck ball can't be cleanly trapped or
  // "tackled" out of the air by a field player standing in its path — it
  // ricochets off his body/legs. So when a fast ball (a shot or a driven
  // ball) first reaches an OPPONENT of the kicker (or a loose fast ball), it
  // DEFLECTS away as a loose rebound instead of sticking to him. Slower balls
  // (settled passes, decayed shots) are still cleanly intercepted/received.
  if (
    best &&
    !best.isGK &&
    best !== prev &&
    (!prev || prev.team !== best.team) &&
    ballSpeed > 600
  ) {
    outfieldBlock(state, best, ballSpeed);
    return;
  }

  if (best && best !== prev)
    recordEvent(
      state,
      best.isGK && keeperMayHandle(state, best, state.lastKicker)
        ? "save"
        : "contact",
      best,
    );
  state.owner = best;
  if (best) {
    state.lastTouchTeam = best.team;
    // FIFA-style: when YOUR team gains possession, you control the man on the
    // ball — INCLUDING the keeper, so you can immediately clear/throw after a
    // save (previously the GK was excluded and you couldn't take over).
    if (best.team === "home") {
      state.controlled = best;
    }
    if (best.isGK) {
      // May he legally take it in his hands? Not outside his box, and not off
      // a deliberate team-mate back-pass — in those cases he controls it with
      // his FEET like an outfielder (no scoop, no box-clamp, no protected
      // catch). Otherwise it's a clean catch.
      state.gkHandling = keeperMayHandle(state, best, state.lastKicker);
      if (state.gkHandling) {
        // A keeper CATCHES cleanly: secure the ball with a longer protection
        // window so a striker can't instantly poke the held ball back out and
        // tap in the rebound. The rush (if any) has done its job.
        state.stealProtect = Math.max(state.stealProtect, 1.1);
        state.gkRush = 0;
        // Start the hold-in-hands clock fresh on a NEW catch so the keeper
        // visibly gathers and holds the ball before he distributes (instead
        // of booting it the instant he touches it with a stale timer).
        if (best !== prev) {
          state.gkHoldTimer = 0;
          // A catch is only a DIVING save if the ball was genuinely beyond
          // his standing reach — a ball gathered near his body is taken
          // standing, so he doesn't dive on every shot close to him.
          const off = state.ball.y - best.y;
          if (Math.abs(off) > M(1.7) && (best.diveTimer ?? 0) <= 0) {
            triggerKeeperDive(state, best, Math.sign(off));
          }
        }
      } else if (best !== prev) {
        // Controlling at his feet: reset the clock so he settles it before
        // playing out (no instant boot), but no hand-catch protection.
        state.gkHoldTimer = 0;
      }
    }
    dribble(state, best);
    // Receiving a pass clears the kicker lock so play flows.
    state.lastKicker = null;
    state.kickerLock = 0;
    // The pass has been collected (or intercepted) — ball gravity ends.
    state.passReceiver = null;
  }
}

export function dribble(state: MatchState, owner: PlayerEntity) {
  // A throw-in taker holds the ball OVERHEAD in both hands (FIFA throw-in
  // pose), ready to throw it back into play. Lifted well above the head so it
  // reads as a two-handed throw, not a kick.
  if (owner === state.throwInTaker) {
    const handZ = M(2.1);
    state.ball.x +=
      (owner.x - state.ball.x) * (1 - Math.pow(1 - 0.4, state.dt * 60));
    state.ball.y +=
      (owner.y - state.ball.y) * (1 - Math.pow(1 - 0.4, state.dt * 60));
    state.ball.z +=
      (handZ - state.ball.z) * (1 - Math.pow(1 - 0.3, state.dt * 60));
    state.ball.vz = 0;
    state.ball.vx = owner.vx;
    state.ball.vy = owner.vy;
    return;
  }

  // A keeper SCOOPS the ball up into his HANDS, held at chest height just in
  // front of his body. The ball rises from the ground (a quick gather/pickup
  // animation) and is glued there — it never squirts out in front toward an
  // onrushing striker. Held at M(0.95) (below CONTROL_HEIGHT so he keeps it).
  if (owner.isGK && state.gkHandling) {
    // Held tight against the chest — a small forward offset so the ball reads
    // as cradled in his hands, not floating out in front of him.
    const hold = owner.r * 0.25;
    const tx = owner.x + owner.facing.x * hold;
    const ty = owner.y + owner.facing.y * hold;
    const handZ = M(0.95);
    // Lerp toward the hand position + height: the ball arcs up off the grass
    // into the keeper's grasp, reading as a clean catch/pickup.
    state.ball.x +=
      (tx - state.ball.x) * (1 - Math.pow(1 - 0.4, state.dt * 60));
    state.ball.y +=
      (ty - state.ball.y) * (1 - Math.pow(1 - 0.4, state.dt * 60));
    state.ball.z +=
      (handZ - state.ball.z) * (1 - Math.pow(1 - 0.35, state.dt * 60));
    state.ball.vz = 0;
    state.ball.vx = owner.vx;
    state.ball.vy = owner.vy;
    return;
  }
  // While protected (just won a tackle / received), keep the ball glued
  // to the feet instead of pushed out in front where it can be poked.
  const sprintTouch = Math.max(
    0,
    Math.min(1, (Math.hypot(owner.vx, owner.vy) - 125) / 65),
  );
  const ahead =
    state.stealProtect > 0
      ? owner.r + state.ball.r - 2
      : owner.r +
        state.ball.r +
        4 +
        M(0.3) * sprintTouch * (0.5 + 0.5 * Math.sin(owner.animPhase));
  const targetX = owner.x + owner.facing.x * ahead;
  const targetY = owner.y + owner.facing.y * ahead;
  const snap =
    1 - Math.pow(1 - (state.stealProtect > 0 ? 0.55 : 0.3), state.dt * 60);
  state.ball.x += (targetX - state.ball.x) * snap;
  state.ball.y += (targetY - state.ball.y) * snap;
  state.ball.z = 0;
  state.ball.vz = 0;
  state.ball.vx = owner.vx;
  state.ball.vy = owner.vy;
}

export function outfieldBlock(
  state: MatchState,
  blocker: PlayerEntity,
  ballSpeed: number,
) {
  recordEvent(state, "contact", blocker);
  state.lastTouchTeam = blocker.team;
  // Deflect roughly back off the body, scattered to a random side.
  const baseAng = Math.atan2(-state.ball.vy, -state.ball.vx);
  const ang = baseAng + (state.random() - state.random()) * 1.3;
  const speed = clamp(ballSpeed * 0.4, 140, 420);
  state.ball.vx = Math.cos(ang) * speed;
  state.ball.vy = Math.sin(ang) * speed;
  state.ball.vz = M(1.0) * state.random();
  // Nudge the ball off the blocker's body so it doesn't re-collide instantly.
  state.ball.x = blocker.x + Math.cos(ang) * (blocker.r + state.ball.r + 4);
  state.ball.y = blocker.y + Math.sin(ang) * (blocker.r + state.ball.r + 4);
  // Loose rebound — nobody owns it; brief lockout so it spills clear.
  state.owner = null;
  state.ballFree = 0.3;
  state.lastKicker = null;
  state.kickerLock = 0;
  state.passReceiver = null;
}

export function separatePlayers(state: MatchState) {
  const all = [...state.homePlayers, ...state.awayPlayers];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const minD = a.r + b.r - 4; // slight overlap allowed for shoulder contact
      if (d > 0 && d < minD) {
        const push = (minD - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        clampToField(state, a);
        clampToField(state, b);
      }
    }
  }
}
