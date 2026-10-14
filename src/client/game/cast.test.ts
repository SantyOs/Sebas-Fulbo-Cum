import { describe, it, expect } from "vitest";
import { applyCast, CastLineCursor } from "./customization/cast";
import { emptyInput, type MatchSnapshot } from "./contracts";
import { MatchSimulation } from "./simulation";
import { pickPassTarget } from "./simulation/actions";
import { resolvePossession } from "./simulation/possession";
import { TEAMS } from "./teams";
import { updateBall } from "./simulation/physics";
import { recordEvent } from "./simulation/events";
import { updateAwayCarrier } from "./simulation/ai";
import { FIELD_H } from "./constants";
import { startCelebration } from "./simulation/rules";

const castSim = () => {
  const [home, away] = applyCast(TEAMS[0], TEAMS[1]);
  return new MatchSimulation(home, away, { seed: 5 });
};
const find = (sim: MatchSimulation, name: string) =>
  [...sim.state.homePlayers, ...sim.state.awayPlayers].find((p) =>
    p.name.startsWith(name),
  )!;

describe("office cast", () => {
  it("keyboard faces the top CPU with roster abilities; pad boosts the user", () => {
    const sim = castSim(),
      sebas = find(sim, "Sebastian"),
      base = sebas.ratings.sho;
    sim.setInputDevice("keyboard");
    expect(sim.state.difficulty).toBe("muyAlta");
    expect(sebas.ratings.sho).toBe(base);
    sim.setInputDevice("pad");
    expect(sim.state.difficulty).toBe("media");
    expect(sebas.ratings.sho).toBe(base + 8);
    sim.setInputDevice("keyboard");
    expect(sebas.ratings.sho).toBe(base);
  });
  it("gives Yenny's goal two extra celebration seconds", () => {
    const s = castSim().state;
    s.lastKicker = find({ state: s } as MatchSimulation, "Yenny");
    startCelebration(s, "away", "GOL", "home", "left");
    expect(s.celebration).toBe(6);
  });
  it("lets Yenny shoot from outside the box toward the open corner", () => {
    const s = castSim().state;
    const yenny = s.awayPlayers[9];
    Object.assign(yenny, { x: 390, y: FIELD_H / 2, vx: 0, vy: 0 });
    Object.assign(s.homePlayers[0], { y: FIELD_H / 2 - 40 });
    Object.assign(s, { owner: yenny, cpuDecision: 0, freeze: 0 });
    Object.assign(s.ball, { x: yenny.x, y: yenny.y, z: 0 });
    updateAwayCarrier(s, yenny, 0);
    expect(s.events.at(-1)?.kind).toBe("shot");
    expect(s.ball.vx).toBeLessThan(0);
    expect(s.ball.vy).toBeGreaterThan(0);
  });
  it("feeds an open Yenny ahead even when her teammate is not pressured", () => {
    const s = castSim().state;
    const carrier = s.awayPlayers[5],
      yenny = s.awayPlayers[9];
    for (const p of s.homePlayers) Object.assign(p, { x: 100, y: 100 });
    for (const p of s.awayPlayers)
      Object.assign(p, {
        x: 1000,
        y: 100,
        cast: { ...p.cast, passShare: undefined },
      });
    Object.assign(carrier, { x: 700, y: FIELD_H / 2 });
    Object.assign(yenny, { x: 420, y: FIELD_H / 2 });
    Object.assign(s, { owner: carrier, cpuDecision: 0, freeze: 0 });
    Object.assign(s.ball, { x: carrier.x, y: carrier.y, z: 0 });
    updateAwayCarrier(s, carrier, 0);
    expect(s.events.at(-1)?.kind).toBe("pass");
    expect(s.ball.vx).toBeLessThan(0);
    expect(Math.abs(s.ball.vy)).toBeLessThan(Math.abs(s.ball.vx) * 0.1);
  });
  it("lets Maria's teammate passes through without touching or repeating her line", () => {
    const sim = castSim(),
      s = sim.state,
      maria = find(sim, "Maria"),
      passer = find(sim, "Sebastian");
    Object.assign(s, { freeze: 0, owner: null, ballFree: 0, kickerLock: 0 });
    for (const p of [...s.homePlayers, ...s.awayPlayers])
      Object.assign(p, { x: 100, y: 100 });
    Object.assign(maria, { x: 700, y: 500 });
    s.lastKicker = passer;
    s.lastKickKind = "pass";
    recordEvent(s, "pass", passer);
    Object.assign(s.ball, { x: 700, y: 500, z: 0, vx: 200, vy: 0, vz: 0 });
    s.offsideFlags.add(maria.id);
    resolvePossession(s);
    resolvePossession(s);
    expect(s.owner).toBeNull();
    expect(s.lastKicker).toBe(passer);
    expect(s.ball.vx).toBe(200);
    expect(s.offsideFlags.has(maria.id)).toBe(true);
    expect(s.events.filter((e) => e.kind === "refusal")).toHaveLength(1);
    const lines = new CastLineCursor().consume(sim.snapshot());
    expect(lines[0]?.text).toBe(maria.cast!.phrases![0]);
    recordEvent(s, "pass", passer);
    resolvePossession(s);
    expect(s.events.filter((e) => e.kind === "refusal")).toHaveLength(2);
    // A fast swept pass must travel beyond her, rather than stick at her radius.
    Object.assign(s.ball, { x: 650, vx: 1200 });
    updateBall(s, 0.1);
    expect(s.ball.x).toBeGreaterThan(740);
    expect(s.owner).toBeNull();
    s.offsideFlags.clear();
    s.lastKicker = find(sim, "Yenny");
    Object.assign(s.ball, { x: 700, vx: 100 });
    resolvePossession(s);
    expect(s.owner).toBe(maria);
  });
  it("renames by side without touching rosters or simulation IDs", () => {
    const [home, away] = applyCast(TEAMS[0], TEAMS[1]);
    expect(home.players[9].name).toBe("Sebastian Londoño (C)");
    expect(away.players[9].name).toBe("Yenny Gomez");
    expect(away.players[9].ratings.sho).toBe(99);
    expect(TEAMS[0].players[9].name).not.toBe(home.players[9].name);
    expect(home.players.map((p) => p.sourceId)).toEqual(
      TEAMS[0].players.map((p) => p.num),
    );
  });
  it("keeps Monica still and sends her about 40% of passes", () => {
    const sim = castSim(),
      monica = find(sim, "Monica");
    const spot = { ...monica.stillAt! };
    for (let i = 0; i < 240; i++) sim.step(1 / 60, emptyInput());
    expect({ x: monica.x, y: monica.y }).toEqual(spot);
    const kicker = find(sim, "Sebastian");
    let hits = 0;
    for (let i = 0; i < 400; i++)
      if (
        pickPassTarget(sim.state, kicker, {
          short: true,
          long: false,
          through: false,
        }) === monica
      )
        hits++;
    expect(hits / 400).toBeGreaterThan(0.33);
  });
  it("marks a teammate pass reception with its passer", () => {
    const sim = castSim(),
      s = sim.state,
      passer = find(sim, "Don Roge"),
      receiver = find(sim, "Patricia");
    Object.assign(s, { freeze: 0, owner: null, ballFree: 0, kickerLock: 0 });
    for (const p of [...s.homePlayers, ...s.awayPlayers])
      Object.assign(p, { x: 100, y: 100, stillAt: undefined });
    Object.assign(receiver, { x: 700, y: 500 });
    s.lastKicker = passer;
    s.lastKickKind = "pass";
    Object.assign(s.ball, { x: receiver.x, y: receiver.y, z: 0, vx: 0, vy: 0 });
    resolvePossession(s);
    const event = s.events.at(-1)!;
    expect(event).toMatchObject({
      kind: "contact",
      playerId: receiver.id,
      fromId: passer.id,
    });
  });
  it("rotates every line once per reception and consumes events once", () => {
    const sim = castSim(),
      patricia = find(sim, "Patricia"),
      yenny = find(sim, "Yenny"),
      base = sim.snapshot();
    const contact = (
      id: number,
      playerId: string,
    ): MatchSnapshot["events"][0] => ({
      id,
      tick: 0,
      time: 0,
      kind: "contact",
      playerId,
      fromId: "away-x",
    });
    const snap = {
      ...base,
      events: [1, 2, 3, 4, 5].map((id) => contact(id, patricia.id)),
    };
    const cursor = new CastLineCursor();
    expect(cursor.consume(snap).map((l) => l.text)).toEqual([
      ...patricia.cast!.phrases!,
      patricia.cast!.phrases![0],
    ]);
    expect(cursor.consume(snap)).toEqual([]);
    expect(cursor.consume({ ...base, events: [contact(6, yenny.id)] })).toEqual(
      [{ playerId: yenny.id, text: undefined, sound: "call" }],
    );
  });
});
