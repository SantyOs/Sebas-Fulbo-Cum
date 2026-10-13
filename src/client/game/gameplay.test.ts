import { describe, it, expect } from "vitest";
import { MatchSimulation } from "./simulation";
import { TEAMS } from "./teams";
import { FIELD_H, FIELD_W, M } from "./constants";
import { updateBall } from "./simulation/physics";
import { sweepCircle } from "./simulation/sweep";
import {
  handleSwitchKey,
  updateControlled,
  passAssisted,
} from "./simulation/actions";
import { resolvePossession } from "./simulation/possession";
import { awardRestart, handleGoals, snapshotOffside } from "./simulation/rules";
import { emptyInput } from "./contracts";

function setup() {
  const sim = new MatchSimulation(TEAMS[0], TEAMS[1], { seed: 2 });
  const s = sim.state;
  s.freeze = 0;
  s.owner = null;
  s.ballFree = 0;
  return s;
}
function isolated() {
  const s = setup();
  for (const p of [...s.homePlayers, ...s.awayPlayers]) {
    p.x = 100;
    p.y = 100;
  }
  Object.assign(s.ball, { x: 700, y: 700, z: 0, vx: 0, vy: 0, vz: 0 });
  return s;
}
describe("actions and ball trajectory", () => {
  it("charges a shot while held and executes exactly once on release", () => {
    const s = isolated(),
      p = s.controlled;
    Object.assign(p, { x: 700, y: 700 });
    s.owner = p;
    s.keys.add("shot");
    s.justPressed = ["shot"];
    updateControlled(s, 1 / 60);
    expect(s.owner).toBe(p);
    expect(s.chargeKey).toBe("shot");
    s.justPressed = [];
    for (let i = 0; i < 20; i++) updateControlled(s, 1 / 60);
    s.keys.clear();
    s.justReleased = ["shot"];
    updateControlled(s, 1 / 60);
    expect(s.owner).toBeNull();
    expect(s.ball.vx).toBeGreaterThan(0);
    expect(s.events.filter((e) => e.kind === "shot")).toHaveLength(1);
    s.justReleased = [];
    updateControlled(s, 1 / 60);
    expect(s.events.filter((e) => e.kind === "shot")).toHaveLength(1);
  });
  it("switches without possession but preserves the carrier for the loft modifier", () => {
    const s = setup(),
      original = s.controlled,
      target = s.homePlayers[2];
    s.switchHint = target;
    s.justPressed = ["switchPlayer"];
    handleSwitchKey(s);
    expect(s.controlled).toBe(target);
    s.controlled = original;
    s.owner = original;
    s.switchHint = target;
    handleSwitchKey(s);
    expect(s.controlled).toBe(original);
  });
  it("lofted through passes leave the ground and control follows the receiver", () => {
    const s = isolated(),
      kicker = s.homePlayers[9],
      receiver = s.homePlayers[8];
    Object.assign(kicker, { x: 700, y: 700 });
    Object.assign(receiver, { x: 900, y: 700 });
    s.owner = kicker;
    s.controlled = kicker;
    s.moveInput = { x: 1, y: 0 };
    passAssisted(s, kicker, {
      isShort: false,
      isLong: false,
      isThrough: true,
      lofted: true,
      charge: 0.5,
    });
    expect(s.ball.vz).toBeGreaterThan(0);
    expect(s.controlled).toBe(receiver);
    expect(s.passReceiver).toBe(receiver);
    expect(s.receptionTime).toBe(1.25);
    expect(s.events.at(-1)?.kind).toBe("pass");
  });
  it("returns directional control after the assistance window expires", () => {
    const s = isolated(),
      p = s.controlled;
    Object.assign(p, { x: 1000, y: 700, vx: 0, vy: 0 });
    s.lastKicker = s.homePlayers[1];
    s.passReceiver = p;
    s.receptionTime = 0;
    s.moveInput = { x: 1, y: 0 };
    updateControlled(s, 1 / 60);
    expect(p.vx).toBeGreaterThan(0);
  });
  it("preserves analog magnitude in movement", () => {
    const speed = (magnitude: number) => {
      const s = isolated();
      Object.assign(s.controlled, { x: 1000, y: 700 });
      s.moveInput = { x: magnitude, y: 0 };
      for (let i = 0; i < 60; i++) updateControlled(s, 1 / 60);
      return Math.hypot(s.controlled.vx, s.controlled.vy);
    };
    expect(speed(0.5) / speed(1)).toBeCloseTo(0.5, 1);
  });
  it("solves a swept body collision even when both endpoints miss", () => {
    expect(
      sweepCircle({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }, 10),
    ).toBeCloseTo(0.4);
    expect(
      sweepCircle({ x: 0, y: 30 }, { x: 100, y: 30 }, { x: 50, y: 0 }, 10),
    ).toBeNull();
    const s = isolated(),
      defender = s.awayPlayers[4];
    Object.assign(defender, { x: 800, y: 700 });
    s.ball.vx = 18000;
    updateBall(s, 1 / 60);
    expect(s.lastTouchTeam).toBe("away");
    expect(
      s.events.some((e) => e.kind === "contact" && e.playerId === defender.id),
    ).toBe(true);
    expect(s.ball.x).toBeLessThan(850);
  });
  it("allows a high ball to travel over an outfielder", () => {
    const s = isolated();
    Object.assign(s.awayPlayers[4], { x: 800, y: 700 });
    s.ball.vx = 18000;
    s.ball.z = M(4);
    updateBall(s, 1 / 60);
    expect(s.ball.x).toBeGreaterThan(900);
    expect(s.owner).toBeNull();
  });
  it("checks a goal at its crossing instead of an overshot position outside the posts", () => {
    const s = isolated();
    Object.assign(s.ball, {
      x: FIELD_W - 10,
      y: FIELD_H / 2,
      z: 0,
      vx: 12000,
      vy: 12000,
    });
    updateBall(s, 1 / 60);
    handleGoals(s);
    expect(s.homeScore).toBe(1);
    expect(s.events.at(-1)?.kind).toBe("goal");
  });
  it("flags offside by stable ID and awards the defending restart on contact", () => {
    const s = isolated(),
      kicker = s.homePlayers[7],
      receiver = s.homePlayers[9];
    s.ball.x = 1500;
    s.ball.y = 700;
    Object.assign(kicker, { x: 1500, y: 700 });
    Object.assign(receiver, { x: 2000, y: 700 });
    s.awayPlayers.forEach((p, i) => (p.x = i === 0 ? 2100 : 1800));
    snapshotOffside(s, kicker);
    expect(s.offsideFlags.has(receiver.id)).toBe(true);
    Object.assign(s.ball, { x: 2000, y: 700 });
    resolvePossession(s);
    expect(s.message).toContain("OFFSIDE");
    expect(s.owner?.team).toBe("away");
  });
  it("catches a slow legal ball and emits a save event", () => {
    const s = isolated(),
      gk = s.awayPlayers[0];
    Object.assign(gk, { x: FIELD_W - M(2), y: FIELD_H / 2 });
    Object.assign(s.ball, { x: gk.x, y: gk.y, vx: 100 });
    resolvePossession(s);
    expect(s.owner).toBe(gk);
    expect(s.gkHandling).toBe(true);
    expect(s.events.at(-1)?.kind).toBe("save");
  });
  it("stages throw-ins with the ball in hands and a restart event", () => {
    const s = setup();
    awardRestart(s, "home", 1000, 0, "", false, true);
    expect(s.throwInTaker?.team).toBe("home");
    expect(s.owner).toBe(s.throwInTaker);
    expect(s.events.at(-1)?.kind).toBe("restart");
  });
  it("does not trap a high ball even when its ground projection overlaps a player", () => {
    const s = isolated(),
      p = s.homePlayers[3];
    Object.assign(p, { x: 700, y: 700 });
    s.ball.z = M(3);
    resolvePossession(s);
    expect(s.owner).toBeNull();
  });
  it("lets a defender block a low lofted pass beyond the kicker's grace cluster", () => {
    const s = isolated(),
      kicker = s.homePlayers[9],
      defender = s.awayPlayers[3];
    Object.assign(kicker, { x: 700, y: 700 });
    Object.assign(defender, { x: 850, y: 700 });
    s.lastKicker = kicker;
    s.kickerLock = 0.4;
    s.ballFree = 0.1;
    s.aerialReceiver = s.homePlayers[8];
    Object.assign(s.ball, { vx: 18000, z: M(0.6), vz: 0 });
    updateBall(s, 1 / 60);
    expect(s.lastTouchTeam).toBe("away");
    expect(s.events.at(-1)?.playerId).toBe(defender.id);
  });
  it("buffers a released shot until reception and cancels when an opponent intercepts", () => {
    const s = isolated();
    s.lastKicker = s.homePlayers[1];
    s.keys.add("shot");
    s.justPressed = ["shot"];
    updateControlled(s, 1 / 60);
    s.justPressed = [];
    s.keys.clear();
    s.justReleased = ["shot"];
    updateControlled(s, 1 / 60);
    expect(s.kickPending).toBe(true);
    s.justReleased = [];
    s.owner = s.controlled;
    updateControlled(s, 1 / 60);
    expect(s.events.at(-1)?.kind).toBe("shot");
    expect(s.kickPending).toBe(false);
    s.chargeKey = "shot";
    s.kickPending = true;
    s.owner = s.awayPlayers[2];
    updateControlled(s, 1 / 60);
    expect(s.chargeKey).toBeNull();
    expect(s.kickPending).toBe(false);
  });
  it("restarts ten independent simulations without carrying old match state", () => {
    for (let i = 0; i < 10; i++) {
      const sim = new MatchSimulation(TEAMS[0], TEAMS[1], { seed: i });
      for (let j = 0; j < 120; j++) sim.step(1 / 60, emptyInput());
      expect(sim.state.homeScore).toBe(0);
      expect(sim.snapshot().players).toHaveLength(22);
    }
  });
});
