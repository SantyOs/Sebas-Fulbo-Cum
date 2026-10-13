import { recordEvent } from "./events";
import {
  ACCEL,
  BALL_DECAY,
  CHARGE_FULL,
  CONTROL_DIST,
  DRIBBLE_ACCEL,
  DRIBBLE_MULT,
  FIELD_H,
  FIELD_W,
  goalBottom,
  goalTop,
  GRAVITY,
  JOCKEY_SPEED,
  KICK_BUFFER,
  M,
  RUN_SPEED,
  SLIDE_LUNGE_SPEED,
  SPRINT_SPEED,
  TACKLE_LUNGE_SPEED,
  WALK_SPEED,
} from "../constants";
import { clamp, dist, distToSegment, len } from "../math";
import {
  dribbleKeepMul,
  dribbleTurnMul,
  passPowerMul,
  passSpreadMul,
  shotPowerMul,
  shotSpreadMul,
} from "../ratings";
import type { PlayerEntity, Vec } from "../types";
import { moveToward, nearestTo, steer } from "./movement";
import { pokeTackle } from "./possession";
import { snapshotOffside } from "./rules";
import type { MatchState } from "./state";
const KICK_KEYS = new Set(["throughPass", "shortPass", "longPass", "shot"]);

export function switchScore(state: MatchState, p: PlayerEntity): number {
  const carrier =
    state.owner && state.owner.team === "away" ? state.owner : null;

  if (carrier) {
    // Direction of the attack: blend "toward our goal" with the
    // carrier's actual movement.
    const goal = { x: 0, y: FIELD_H / 2 };
    const gl = len(goal.x - carrier.x, goal.y - carrier.y);
    let dirX = (goal.x - carrier.x) / gl;
    let dirY = (goal.y - carrier.y) / gl;
    const sp = len(carrier.vx, carrier.vy);
    if (sp > 40) {
      dirX = dirX * 0.5 + (carrier.vx / sp) * 0.5;
      dirY = dirY * 0.5 + (carrier.vy / sp) * 0.5;
      const dl = len(dirX, dirY);
      dirX /= dl;
      dirY /= dl;
    }
    const intercept = {
      x: carrier.x + dirX * 70,
      y: carrier.y + dirY * 70,
    };

    let score = dist(p, intercept);
    // Goal-side (between carrier and our goal) is what defending is
    // about — reward it; punish being behind the play.
    if (p.x < carrier.x - 5) score -= 55;
    else if (p.x > carrier.x + 15) score += 60;
    return score;
  }

  // Loose ball (or our own possession): closest to where the ball is
  // heading wins.
  const ahead = {
    x: clamp(state.ball.x + state.ball.vx * 0.35, 0, FIELD_W),
    y: clamp(state.ball.y + state.ball.vy * 0.35, 0, FIELD_H),
  };
  return dist(p, ahead);
}

export function bestSwitchCandidate(
  state: MatchState,
  exclude: PlayerEntity,
): PlayerEntity | null {
  let best: PlayerEntity | null = null;
  let bestScore = Infinity;
  for (const p of state.homePlayers) {
    if (p === exclude) continue;
    // The keeper is never auto-suggested (FIFA-style) unless he has the
    // ball or it's right next to him.
    if (p.isGK && state.owner !== p && dist(p, state.ball) > 160) continue;
    const s = switchScore(state, p);
    if (s < bestScore) {
      bestScore = s;
      best = p;
    }
  }
  return best;
}

export function updateSwitchHint(state: MatchState) {
  if (
    state.owner &&
    state.owner.team === "home" &&
    state.owner !== state.controlled
  ) {
    state.switchHint = state.owner;
    return;
  }
  const candidate = bestSwitchCandidate(state, state.controlled);
  // Only suggest a switch when the candidate is meaningfully better
  // positioned than the player you already control.
  if (
    candidate &&
    switchScore(state, candidate) + 25 < switchScore(state, state.controlled)
  ) {
    state.switchHint = candidate;
  } else {
    state.switchHint = null;
  }
}

export function handleSwitchKey(state: MatchState) {
  if (!state.justPressed.includes("switchPlayer")) return;
  // Q doubles as the LOB MODIFIER (Q+W = aerial through ball). When we have
  // the ball — or a pass key is held/charging — Q is being used to modify a
  // kick, so it must NOT switch players away from the carrier.
  const usingAsModifier =
    state.owner === state.controlled ||
    !!state.chargeKey ||
    [...KICK_KEYS].some((k) => state.keys.has(k));
  if (usingAsModifier) return;
  const target =
    state.switchHint ?? bestSwitchCandidate(state, state.controlled);
  if (target) {
    state.controlled = target;
    state.switchHint = null;
  }
}

export function updateControlled(state: MatchState, dt: number) {
  // Practice: you never take over the keeper. A pass back to your own GK
  // switches control to him in the normal flow (control follows your pass),
  // but the keeper is auto-managed (he holds then clears upfield like a CPU
  // GK). Hand control to the nearest outfielder so he isn't a stuck,
  // user-controlled dead end and the team keeps offering support.
  if (state.practice && state.controlled.isGK) {
    const out = state.homePlayers.filter((q) => !q.isGK);
    const alt = nearestTo(state, out, state.ball);
    if (alt) state.controlled = alt;
  }

  const p = state.controlled;
  const owns = state.owner === p;
  const carrier =
    state.owner && state.owner.team === "away" ? state.owner : null;
  // The ball is loose and travelling from our own kick (a pass/shot in
  // flight) — i.e. it's "incoming" to our team. In this state a kick key
  // is buffered as a first-time shot/pass, NOT a tackle.
  const incoming =
    !owns && state.owner === null && state.lastKicker?.team === "home";

  // True while we're already committed to a slide — locks out other inputs
  // (you can't change your mind mid-slide; that's the FIFA risk).
  const sliding = (p.slideTimer ?? 0) > 0;

  // A without the ball = sliding tackle (FIFA: A/circle is the long pass on
  // the ball, the slide tackle off it). A fully committed, long-range lunge
  // along your current heading. Wins the ball over more ground than a standing
  // tackle, but leaves you grounded and out of the play through the recovery if
  // you mistime it. Suppressed while our own pass is incoming (where A is a
  // buffered first-time long ball) and while already sliding.
  if (
    !owns &&
    !incoming &&
    !sliding &&
    state.slideCooldown <= 0 &&
    state.justPressed.includes("longPass")
  ) {
    // Slide along where we're already running; if we're near-stationary,
    // slide straight at the ball's anticipated position instead.
    let sx = p.vx;
    let sy = p.vy;
    if (len(sx, sy) < 40) {
      sx = state.ball.x + state.ball.vx * 0.12 - p.x;
      sy = state.ball.y + state.ball.vy * 0.12 - p.y;
    }
    const sl = len(sx, sy) || 1;
    p.slideDir = { x: sx / sl, y: sy / sl };
    p.slideTimer = 0.7;
    state.slideCooldown = 1.5;
    p.facing = { ...p.slideDir };
  }

  // W without the ball = "rush keeper out" (FIFA): send your goalkeeper
  // charging off his line to claim/smother the ball. Only meaningful when
  // we're defending (not while our own pass is incoming, where W is a
  // buffered first-time through-ball).
  if (!owns && !incoming && !sliding) {
    // A tap commits the keeper to a charge; HOLDING W keeps him out (FIFA's
    // hold-to-rush) so he doesn't back-pedal to his line mid-charge.
    if (state.justPressed.includes("throughPass")) state.gkRush = 1.5;
    else if (state.keys.has("throughPass"))
      state.gkRush = Math.max(state.gkRush, 0.25);
  }

  // D without the ball = standing tackle (FIFA: a committed lunge at
  // the ball — winning it cleanly if it's in reach, leaving you beaten
  // for a moment if you whiff). Suppressed while our own pass is incoming.
  if (
    !owns &&
    !incoming &&
    !sliding &&
    state.tackleCooldown <= 0 &&
    state.justPressed.includes("shot")
  ) {
    const bx = state.ball.x + state.ball.vx * 0.1 - p.x;
    const by = state.ball.y + state.ball.vy * 0.1 - p.y;
    const l = len(bx, by);
    state.tackleDir = { x: bx / l, y: by / l };
    state.tackleTimer = 0.22;
    state.tackleCooldown = 0.8;
    p.kickTimer = Math.max(p.kickTimer, 0.22);
  }

  const containing = state.keys.has("contain") && !owns;

  if (sliding) {
    // Sliding tackle. The first ~0.3s is the committed lunge: the body
    // skims along slideDir at a decaying fraction of SLIDE_LUNGE_SPEED and
    // pokes the ball loose over a longer reach than a standing tackle. The
    // remaining ~0.4s is the grounded recovery: no steering, no input, no
    // tackle — you're a sitting duck if you missed (FIFA's slide risk).
    const dir = p.slideDir ?? { x: p.facing.x, y: p.facing.y };
    const t = p.slideTimer ?? 0;
    if (t > 0.4) {
      // Lunge phase: ease the burst off as the slide plays out so it reads
      // as a body skidding to a halt rather than a constant-speed dash.
      const frac = 0.45 + 0.55 * ((t - 0.4) / 0.3);
      steer(
        state,
        p,
        dir.x * SLIDE_LUNGE_SPEED * frac,
        dir.y * SLIDE_LUNGE_SPEED * frac,
        dt,
        ACCEL * 1.6,
      );
      pokeTackle(state, p, CONTROL_DIST + 30, false);
    } else {
      // Recovery phase: friction the body to a stop, no control.
      steer(state, p, 0, 0, dt);
    }
  } else if (state.tackleTimer > 0) {
    // Mid-lunge: burst toward the ball and poke it loose on contact.
    state.tackleTimer -= dt;
    steer(
      state,
      p,
      state.tackleDir.x * TACKLE_LUNGE_SPEED,
      state.tackleDir.y * TACKLE_LUNGE_SPEED,
      dt,
    );
    pokeTackle(state, p, CONTROL_DIST + 18);
  } else if (containing && carrier) {
    // FIFA contain (hold C): auto-jockey goal-side of the carrier and
    // automatically poke the ball when it comes into reach.
    const gx = -carrier.x;
    const gy = FIELD_H / 2 - carrier.y;
    const gl = len(gx, gy);
    const spot = {
      x: carrier.x + (gx / gl) * 30,
      y: carrier.y + (gy / gl) * 30,
    };
    const speed = state.keys.has("sprint") ? SPRINT_SPEED * 0.94 : JOCKEY_SPEED;
    moveToward(state, p, spot, speed, dt);
    if (state.tackleCooldown <= 0 && pokeTackle(state, p, CONTROL_DIST + 8)) {
      state.tackleCooldown = 0.5;
    }
  } else if (containing) {
    // Contain with a loose ball — just hunt it down.
    const speed = state.keys.has("sprint") ? SPRINT_SPEED * 0.94 : JOCKEY_SPEED;
    moveToward(state, p, { x: state.ball.x, y: state.ball.y }, speed, dt);
  } else {
    const { x: dx, y: dy } = state.moveInput;
    const hasInput = dx !== 0 || dy !== 0;

    // Build the user's intended heading (unit vector, or zero).
    let ix = 0;
    let iy = 0;
    if (hasInput) {
      const l = len(dx, dy);
      ix = dx / l;
      iy = dy / l;
    }

    const sprint = state.keys.has("sprint");
    let speed = (sprint ? SPRINT_SPEED : WALK_SPEED) * Math.min(1, len(dx, dy));
    // Carrying the ball slows you down (real dribble penalty) — you can't
    // knock it and outrun the whole pitch. A free defender can run you down.
    // DRIBBLING reduces the penalty: a great dribbler keeps more of his pace.
    if (owns) speed *= dribbleKeepMul(p.ratings, DRIBBLE_MULT);
    let hx = ix;
    let hy = iy;

    // FIFA-style "ball gravity": while OUR pass is in flight to this exact
    // receiver, predict whether continuing the user's CURRENT run will
    // actually intercept the ball. If it will (they're already on a path to
    // meet it), leave their run alone. If it WON'T — e.g. they're holding a
    // direction that runs them away/ahead and the ball can't catch them —
    // override toward the meeting point so they don't miss it. With no arrow
    // held, the receiver fully takes over and collects the ball.
    if (incoming && p === state.passReceiver && state.receptionTime > 0) {
      // FIFA auto-receive: instead of asking "will the user's current run
      // happen to intercept the ball?" (which oscillates — the moment we
      // nudge toward the ball the run looks fine again, so the receiver
      // parks short and never collects it), we solve for the EARLIEST point
      // on the ball's path the receiver can actually run onto, then commit
      // to it. The user's input only biases the APPROACH ANGLE — it can
      // never steer the receiver away from a ball they'd otherwise miss.
      const airborne = state.ball.z > 0.01 || state.ball.vz > 0.01;
      const k = airborne ? BALL_DECAY * 0.12 : BALL_DECAY;
      let bx = state.ball.x;
      let by = state.ball.y;
      let bvx = state.ball.vx;
      let bvy = state.ball.vy;
      const stepT = 0.05;
      const decayStep = Math.exp(-k * stepT);
      // Displacement over one step for the current velocity (∫v dt).
      const dispK = k > 1e-3 ? (1 - decayStep) / k : stepT;
      // Pace we will actually run to meet it at.
      const runSpeed = sprint ? SPRINT_SPEED : RUN_SPEED;
      // March the ball forward; the first point the receiver can reach in
      // time (running straight at it) is the interception. If they can never
      // catch it within the window, chase where it ends up (last sim point) —
      // covers a pass that stops SHORT, so the receiver always goes to get it.
      let meetX = bx;
      let meetY = by;
      for (let t = 0; t <= 2.5; t += stepT) {
        meetX = bx;
        meetY = by;
        const gap = len(bx - p.x, by - p.y);
        const tReach = Math.max(0, gap - CONTROL_DIST) / runSpeed;
        if (tReach <= t) break; // we can be here as the ball arrives
        bx += bvx * dispK;
        by += bvy * dispK;
        bvx *= decayStep;
        bvy *= decayStep;
      }

      const ax = meetX - p.x;
      const ay = meetY - p.y;
      const al = len(ax, ay);
      // Once the ball is essentially at our feet, hand full control back to
      // the user; until then, drive to the meeting point.
      if (al > CONTROL_DIST) {
        const ux = ax / al;
        const uy = ay / al;
        // A little user steer (to choose which side to take it on) but the
        // run to the ball dominates so the receiver never drifts off it.
        const inputW = hasInput ? 0.3 : 0;
        hx = ux * (1 - inputW) + ix * inputW;
        hy = uy * (1 - inputW) + iy * inputW;
        if (!sprint) speed = RUN_SPEED;
      }
    }

    let tvx = 0;
    let tvy = 0;
    const hl = len(hx, hy);
    if (hl > 0.001) {
      tvx = (hx / hl) * speed;
      tvy = (hy / hl) * speed;
    }
    // The ball-carrier is heavier on the turn (DRIBBLE_ACCEL) — can't jink as
    // sharply as a free runner. DRIBBLING sharpens the turn back up for the
    // skilful, so a great dribbler keeps close control while jinking.
    steer(
      state,
      p,
      tvx,
      tvy,
      dt,
      owns ? DRIBBLE_ACCEL * dribbleTurnMul(p.ratings) : ACCEL,
    );
  }

  // FIFA-style kick charging + input buffering. Pressing a kick key starts
  // the power gauge; releasing executes the kick. Crucially you may press it
  // WHILE the ball is still travelling to you (`incoming`) — the input is
  // buffered and fires the instant you receive the ball (a first-time
  // shot/pass), instead of being dropped.
  if (!state.chargeKey && (owns || incoming)) {
    for (const code of state.justPressed) {
      if (KICK_KEYS.has(code)) {
        state.chargeKey = code;
        state.chargeTime = 0;
        state.chargeLofted = state.keys.has("switchPlayer");
        state.kickPending = false;
        state.bufferTimer = owns ? 0 : KICK_BUFFER;
        break;
      }
    }
  }

  if (state.chargeKey) {
    const released = state.justReleased.includes(state.chargeKey);
    if (owns) {
      // We have the ball: fire on release, or immediately if a buffered
      // first-time kick was already released during the transition.
      if (state.kickPending || released) {
        const t = clamp(state.chargeTime / CHARGE_FULL, 0, 1);
        const code = state.chargeKey;
        const lofted = state.chargeLofted || state.keys.has("switchPlayer");
        state.chargeKey = null;
        state.kickPending = false;
        doHomeKick(state, code, t, lofted);
      } else {
        state.chargeTime = Math.min(state.chargeTime + dt, CHARGE_FULL);
      }
    } else if (state.owner && state.owner.team === "away") {
      // An opponent intercepted before we received it — drop the buffer.
      state.chargeKey = null;
      state.kickPending = false;
    } else {
      // Ball still in transit: keep buffering within the window. Charge
      // while held; once released, mark pending so it fires on first touch.
      state.bufferTimer -= dt;
      if (state.bufferTimer <= 0) {
        state.chargeKey = null;
        state.kickPending = false;
      } else if (released) {
        state.kickPending = true;
      } else if (!state.kickPending) {
        state.chargeTime = Math.min(state.chargeTime + dt, CHARGE_FULL);
      }
    }
  }
}

export function chargeLevel(state: MatchState): number | null {
  if (!state.chargeKey) return null;
  return clamp(state.chargeTime / CHARGE_FULL, 0, 1);
}

export function doHomeKick(
  state: MatchState,
  code: string,
  charge: number,
  lofted = false,
) {
  const kicker = state.controlled;

  // A throw-in is taken with the HANDS — any kick key releases a hand throw
  // (not a foot kick / shot), aimed at the held direction's teammate.
  if (kicker === state.throwInTaker) {
    executeThrowIn(state, kicker, true);
    return;
  }

  if (code === "shot") {
    shootAssisted(state, kicker, charge);
    return;
  }

  const isShort = code === "shortPass";
  const isLong = code === "longPass";
  const isThrough = code === "throughPass";
  if (!isShort && !isLong && !isThrough) return;
  passAssisted(state, kicker, { isShort, isLong, isThrough, lofted, charge });
}

export function shootAssisted(
  state: MatchState,
  kicker: PlayerEntity,
  charge: number,
) {
  state.nextKickKind = "shot";
  let vert = 0;
  if (state.keys.has("moveUp")) vert -= 1;
  if (state.keys.has("moveDown")) vert += 1;
  // No arrow held at all → fall back to the facing direction's vertical
  // lean, so curling runs still place shots naturally.
  const horizontalHeld =
    state.keys.has("moveLeft") || state.keys.has("moveRight");
  if (vert === 0 && !horizontalHeld) {
    if (kicker.facing.y < -0.45) vert = -1;
    else if (kicker.facing.y > 0.45) vert = 1;
  }

  const inset = 16; // keep aim inside the posts
  const mid = (goalTop + goalBottom) / 2;
  // Zone of the frame the input allows, and the spot the input "wants".
  let zoneLo = goalTop + inset;
  let zoneHi = goalBottom - inset;
  let desiredY = mid;
  if (vert < 0) {
    zoneHi = mid - 8;
    desiredY = goalTop + inset; // top corner
  } else if (vert > 0) {
    zoneLo = mid + 8;
    desiredY = goalBottom - inset; // bottom corner
  }

  // Sample candidate placements across the allowed zone and score each
  // by how clear the shooting lane is (distance of the nearest blocker
  // to the ball→target line), with a tie-break preference for the spot
  // the player's input asked for.
  const blockers = [...state.awayPlayers, ...state.homePlayers].filter(
    (p) => p !== kicker,
  );
  const goalX = FIELD_W - 2;
  const zoneSpan = Math.max(zoneHi - zoneLo, 1);
  const SAMPLES = 9;
  let bestY = desiredY;
  let bestScore = -Infinity;
  for (let i = 0; i < SAMPLES; i++) {
    const ty = zoneLo + (zoneSpan * i) / (SAMPLES - 1);
    const target = { x: goalX, y: ty };
    let clearance = Infinity;
    for (const b of blockers) {
      clearance = Math.min(
        clearance,
        distToSegment(b, state.ball, target) - b.r,
      );
    }
    // Clearance dominates (capped so wide-open lanes stop competing),
    // input preference breaks ties between similarly open lanes.
    const score =
      Math.min(clearance, 50) + (1 - Math.abs(ty - desiredY) / zoneSpan) * 16;
    if (score > bestScore) {
      bestScore = score;
      bestY = ty;
    }
  }

  // Charge controls shot power across a REAL-LIFE-ANCHORED range (px/s via
  // PX_PER_M=20.95, ×0.172 = km/h. POWER spans a WIDE, clearly-felt range so
  // a tap and a full blast feel completely different: a placed shot (charge 0)
  // leaves the boot at ~400 px/s ≈ 69 km/h (a gentle roll), a full-power strike
  // (charge 1) at ~960 px/s ≈ 165 km/h (a screamer; a touch arcade for feel),
  // an elite finisher a bit more. Ratio ~2.4× tap→full, vs the old narrow 1.8×
  // that made every shot feel the same. shotPowerMul tilts it per striker.
  const power = (400 + 560 * charge) * shotPowerMul(kicker.ratings);
  // `loft` is the UPWARD launch velocity (px/s), solved from a target APEX
  // HEIGHT: loft = sqrt(2·GRAVITY·apex). Loft is TIED TO POWER so weak and
  // strong shots look different — a WEAK shot stays PURELY on the ground
  // (apex 0, the ball just rolls) and only once you charge past ~0.25 does it
  // start to climb, a full-power strike flying high toward the top corners.
  // With the realistic GRAVITY the apex is reached ~20m out, so from a normal
  // shooting position a hard shot is still RISING as it crosses the line.
  // Capped just under the M(2.44) bar so the peak can't sail over.
  const liftCharge = clamp((charge - 0.25) / 0.75, 0, 1);
  const shotApex = Math.min(liftCharge * liftCharge * M(2.7), M(2.35));
  const loft = shotApex > 0 ? Math.sqrt(2 * GRAVITY * shotApex) : 0;
  // Shots scatter — and the harder you hit it, the LESS precise it is (FIFA:
  // a power blast can fly wide of the post, while a placed side-foot is far
  // tighter). The charge term dominates so full-power efforts genuinely miss
  // the target a fair share of the time.
  // SHOOTING: better strikers hit it harder and straighter — more power and
  // a tighter spread, so a weak forward sprays the same chance wide.
  const shotSpread = (0.06 + charge * 0.2) * shotSpreadMul(kicker.ratings);
  kickBallToward(
    state,
    { x: goalX, y: bestY },
    power,
    kicker,
    loft,
    shotSpread,
  );
}

export function passAssisted(
  state: MatchState,
  kicker: PlayerEntity,
  opts: {
    isShort: boolean;
    isLong: boolean;
    isThrough: boolean;
    lofted?: boolean;
    charge: number;
  },
) {
  const { isShort, isLong, isThrough, charge } = opts;
  const lofted = !!opts.lofted;

  const target = pickPassTarget(state, kicker, {
    short: isShort,
    long: isLong,
    through: isThrough,
  });
  if (!target) {
    // No teammate available — knock it in the aimed direction.
    const f = heldDir(state, kicker);
    state.ball.vx = f.x * 380;
    state.ball.vy = f.y * 380;
    afterKick(state, kicker);
    return;
  }

  // Control follows your pass (FIFA-style), and the receiver gets "ball
  // gravity" until they actually take possession (see updateControlled).
  state.passReceiver = target;
  state.receptionTime = 1.25;

  let aim: Vec;
  if (isThrough) {
    // Lead the receiver along their actual RUN (FIFA through ball):
    // play the ball into the space they're heading to, defaulting to
    // straight at the opponent goal when they're standing still.
    const atkX = kicker.team === "home" ? 1 : -1;
    const sp = Math.hypot(target.vx, target.vy);
    // Direction to play the ball into: always lead toward goal, blended
    // with the receiver's actual run so a sprinter gets played in behind
    // along their line and a standing player gets pushed forward.
    let rx = atkX;
    let ry = 0;
    if (sp > 50) {
      rx = target.vx / sp + atkX * 0.6;
      ry = target.vy / sp;
      // Never lead a through ball backwards.
      if (rx * atkX < 0.1) rx = atkX * 0.55;
      const rl = len(rx, ry);
      rx /= rl;
      ry /= rl;
    }
    // Always carve out a clear gap in front of the receiver (FIFA through
    // ball): a fixed forward lead plus extra for how fast they're running,
    // so even a standing player has real space to chase onto.
    const lead = clamp(M(3) + sp * 0.4, M(3), M(7.5));
    aim = {
      x: clamp(target.x + rx * lead, 30, FIELD_W - 30),
      y: clamp(target.y + ry * lead, 20, FIELD_H - 20),
    };
  } else {
    // Aim slightly ahead of where they're moving.
    aim = {
      x: clamp(target.x + target.vx * 0.2, 15, FIELD_W - 15),
      y: clamp(target.y + target.vy * 0.2, 15, FIELD_H - 15),
    };
  }

  const d = dist(state.ball, aim);

  if (isThrough && lofted) {
    // Q + W = a LOFTED through ball (FIFA): same lead-into-space aim as the
    // grounded through ball, but chipped through the air so it clears a
    // defender stepping into the lane and drops into the runner's path.
    // Lower, faster arc than a raking long ball so it still threads behind.
    const T = clamp(0.5 + d / M(95) + charge * 0.2, 0.5, 1.15);
    const vz = 0.5 * GRAVITY * T;
    const hspeed = Math.min((d / T) * 1.08, 1500);
    kickBallToward(
      state,
      aim,
      hspeed,
      kicker,
      vz,
      0.05 * passSpreadMul(kicker.ratings),
    );
    state.aerialReceiver = target;
    state.controlled = target;
    return;
  }

  if (isLong) {
    // Long ball = a LOFTED, ballistic pass (FIFA): it flies over the
    // defenders and drops onto the receiver. Solve a projectile so the
    // hang time matches the horizontal travel (air friction is light, so
    // horizontal speed stays roughly constant in flight). A fuller charge
    // floats it higher and longer.
    const T = clamp(0.62 + d / M(70) + charge * 0.25, 0.6, 1.5);
    const vz = 0.5 * GRAVITY * T;
    const hspeed = Math.min((d / T) * 1.12, 1500);
    // A raking long ball is harder to land on a sixpence than a short pass.
    kickBallToward(
      state,
      aim,
      hspeed,
      kicker,
      vz,
      0.045 * passSpreadMul(kicker.ratings),
    );
    state.aerialReceiver = target;
    state.controlled = target;
    return;
  }

  // Friction-aware power: arrive at the aim point still rolling at the
  // given speed (exponential friction covers (v0 - vEnd)/BALL_DECAY px),
  // instead of dying en route like the old distance multipliers did.
  const base = isThrough
    ? passPower(state, d, 240, 920)
    : passPower(state, d, 260, 780);
  // FIFA assist: targeting is automatic, but the gauge still matters —
  // undercharged passes arrive soft/short, overcharged ones run past
  // the receiver. charge ~0.4 ≈ the "right" weight. Band tightened from
  // 0.78–1.33 to 0.84–1.22 so neither extreme is wild: a tap pass isn't
  // limp and a full-charge drive doesn't rocket 27m past a 12m target —
  // the launch ceiling (780 px/s ≈ 134 km/h ground pass) is realistic too.
  const scale = 0.84 + 0.38 * charge;
  // PASSING: accurate passers weight it better and misplace it less often.
  const power = Math.min(base * scale * passPowerMul(kicker.ratings), 1600);

  kickBallToward(
    state,
    aim,
    power,
    kicker,
    0,
    0.03 * passSpreadMul(kicker.ratings),
  );

  // Control follows your pass (FIFA-style). All other switching is Q-only.
  state.controlled = target;
}

export function executeThrowIn(
  state: MatchState,
  thrower: PlayerEntity,
  isHome: boolean,
) {
  const target = pickPassTarget(state, thrower, {
    short: true,
    long: false,
    through: false,
  });

  let aim: Vec;
  if (target) {
    aim = {
      x: clamp(target.x + target.vx * 0.2, 15, FIELD_W - 15),
      y: clamp(target.y + target.vy * 0.2, 15, FIELD_H - 15),
    };
    state.passReceiver = target;
    state.receptionTime = 1.25;
    if (isHome) state.controlled = target;
  } else {
    // Nobody to aim at — toss it a few metres infield in the held direction.
    const f = isHome
      ? heldDir(state, thrower)
      : { x: thrower.team === "home" ? 1 : -1, y: 0 };
    aim = {
      x: clamp(thrower.x + f.x * M(8), 15, FIELD_W - 15),
      y: clamp(thrower.y + f.y * M(8), 15, FIELD_H - 15),
    };
  }

  // Disarm BEFORE the throw so dribble/possession stop treating the ball as
  // held overhead and kickBallToward launches it as a normal airborne ball.
  state.throwInTaker = null;
  thrower.throwing = false;

  const d = dist(state.ball, aim);
  // A two-handed throw: a modest lofted arc, much shorter range than a kick.
  const T = clamp(0.45 + d / M(60), 0.4, 1.0);
  const vz = 0.5 * GRAVITY * T;
  const hspeed = Math.min(d / T, 900);
  kickBallToward(state, aim, hspeed, thrower, vz, 0.04);
  // A thrown ball is also aerial — only the intended teammate gathers it in
  // flight, it can't be picked off mid-air.
  if (target) state.aerialReceiver = target;

  // No offside can be given from a throw-in (real rule).
  state.offsideFlags.clear();
  state.cpuDecision = 0.5;
}

export function heldDir(state: MatchState, kicker: PlayerEntity): Vec {
  const { x: dx, y: dy } = state.moveInput;
  if (dx === 0 && dy === 0) return kicker.facing;
  const l = len(dx, dy);
  return { x: dx / l, y: dy / l };
}

export function pickPassTarget(
  state: MatchState,
  kicker: PlayerEntity,
  opts: { short: boolean; long: boolean; through: boolean },
): PlayerEntity | null {
  const aim = heldDir(state, kicker);
  const mates = (
    kicker.team === "home" ? state.homePlayers : state.awayPlayers
  ).filter((p) => p !== kicker && !(opts.through && p.isGK));
  const opps = kicker.team === "home" ? state.awayPlayers : state.homePlayers;
  const favorite = castPassTarget(state, mates);
  if (favorite) return favorite;

  let best: PlayerEntity | null = null;
  let bestScore = -Infinity;

  for (const m of mates) {
    const dx = m.x - kicker.x;
    const dy = m.y - kicker.y;
    const d = len(dx, dy);
    const align = (dx / d) * aim.x + (dy / d) * aim.y;

    // Alignment with the aimed direction dominates everything else.
    let score = align * 260;
    // Teammates behind / far outside the aim cone are a last resort.
    if (align < 0.1) score -= 400;

    if (opts.long) {
      score += clamp(d, 0, 900) * 0.12; // find the far outlet
    } else {
      // Short & through: first man along the aim, nearest wins ties.
      score -= d * (opts.short ? 0.3 : 0.22);
    }

    // Passing-lane openness (ground passes only — a lofted long ball flies
    // over). Endpoint mirrors the aim used in passAssisted: short = at the
    // receiver, through = led ahead into their run. An opponent sitting in
    // the lane heavily demotes this receiver so an open one wins instead.
    if (!opts.long) {
      const end = passLaneEnd(state, kicker, m, opts.through);
      let clearance = Infinity;
      for (const o of opps) {
        if (o.isGK) continue;
        // Ignore a defender right on the kicker's back — he sits at the
        // start of EVERY lane (so wouldn't change ranking) and is already
        // handled by the just-kicked grace. Only true lane blockers count.
        if (dist(o, kicker) < 34) continue;
        clearance = Math.min(clearance, distToSegment(o, kicker, end) - o.r);
      }
      // A clear channel (>~26px either side) is fine; the tighter the lane,
      // the bigger the penalty, so a body in the lane (clearance≈0) is a
      // strong deterrent without being an absolute veto.
      const LANE_OK = 26;
      if (clearance < LANE_OK) {
        score -= (LANE_OK - Math.max(clearance, -10)) * 7;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }

  return best;
}

/** A cast player with `passShare` steals that share of his team's passes. */
export function castPassTarget(
  state: MatchState,
  mates: readonly PlayerEntity[],
): PlayerEntity | null {
  const fav = mates.find((m) => m.cast?.passShare);
  return fav && state.random() < fav.cast!.passShare! ? fav : null;
}

export function passLaneEnd(
  _state: MatchState,
  kicker: PlayerEntity,
  m: PlayerEntity,
  through: boolean,
): Vec {
  if (!through) {
    return { x: m.x + m.vx * 0.2, y: m.y + m.vy * 0.2 };
  }
  const atkX = kicker.team === "home" ? 1 : -1;
  const sp = Math.hypot(m.vx, m.vy);
  let rx = atkX;
  let ry = 0;
  if (sp > 50) {
    rx = m.vx / sp;
    ry = m.vy / sp;
    if (rx * atkX < 0.1) {
      rx = atkX * 0.55;
      const rl = len(rx, ry);
      rx /= rl;
      ry /= rl;
    }
  }
  const lead = clamp(sp * 0.45, 45, 110);
  return {
    x: clamp(m.x + rx * lead, 30, FIELD_W - 30),
    y: clamp(m.y + ry * lead, 20, FIELD_H - 20),
  };
}

export function passPower(
  _state: MatchState,
  d: number,
  arrival: number,
  max: number,
) {
  return Math.min(BALL_DECAY * d + arrival, max);
}

export function kickBallToward(
  state: MatchState,
  aim: Vec,
  power: number,
  kicker: PlayerEntity,
  loft = 0,
  /** Angular error envelope in radians — how much this kick can stray from
   *  the perfect aim. Short passes are tight; shots/long balls scatter more
   *  (FIFA: not every strike is pixel-perfect). */
  spread = 0.03,
) {
  const dx = aim.x - state.ball.x;
  const dy = aim.y - state.ball.y;
  const l = len(dx, dy);
  const nx = dx / l;
  const ny = dy / l;
  // FIFA-like imperfection: deflect the aim by a small random angle and
  // nudge the power, so no two kicks come out exactly the same. The noise is
  // triangular (peaked at 0) — most kicks are near-perfect, the odd one
  // sprays wide or runs heavy.
  const ang = spread * kickNoise(state);
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const rx = nx * ca - ny * sa;
  const ry = nx * sa + ny * ca;
  const pw = power * (1 + 0.05 * kickNoise(state));
  state.ball.vx = rx * pw;
  state.ball.vy = ry * pw;
  // `loft` is the upward launch velocity (px/s). Pop the ball just off the
  // turf so it leaves the ground cleanly on a lofted kick.
  state.ball.vz = loft;
  if (loft > 0) state.ball.z = Math.max(state.ball.z, 0.5);
  // A flat (non-lofted) release travels on the ground — drop the ball to the
  // turf in case it was elevated (e.g. just thrown/rolled out of the keeper's
  // hands, where it was held at chest height).
  else state.ball.z = 0;
  afterKick(state, kicker);
}

export function kickNoise(state: MatchState): number {
  return state.random() - state.random();
}

export function afterKick(state: MatchState, kicker: PlayerEntity) {
  recordEvent(state, state.nextKickKind, kicker);
  state.lastKickKind = state.nextKickKind;
  state.nextKickKind = "pass";
  state.owner = null;
  // Default: this kick is NOT a protected aerial pass. Lofted-pass callers
  // re-arm `aerialReceiver` immediately after kickBallToward returns.
  state.aerialReceiver = null;
  state.lastKicker = kicker;
  state.lastTouchTeam = kicker.team;
  state.kickerLock = 0.45;
  kicker.kickTimer = 0.28;
  // The struck ball is briefly untouchable so it physically leaves the
  // kicker's body cluster before anyone (esp. an opponent leaning on the
  // kicker's back) can claim it — otherwise the kick is "canceled" the same
  // frame it's launched. ~0.12s ≈ 100-150px of travel at pass/shot speed,
  // enough to clear bodies while a defender genuinely down the lane can
  // still intercept.
  state.ballFree = 0.12;
  state.jostle = 0;
  snapshotOffside(state, kicker);
}
