import { describe, it, expect } from "vitest";
import { applyCast, CastLineCursor } from "./customization/cast";
import { emptyInput, type MatchSnapshot } from "./contracts";
import { MatchSimulation } from "./simulation";
import { pickPassTarget } from "./simulation/actions";
import { resolvePossession } from "./simulation/possession";
import { TEAMS } from "./teams";

const castSim = () => {
  const [home, away] = applyCast(TEAMS[0], TEAMS[1]);
  return new MatchSimulation(home, away, { seed: 5 });
};
const find = (sim: MatchSimulation, name: string) =>
  [...sim.state.homePlayers, ...sim.state.awayPlayers].find((p) =>
    p.name.startsWith(name),
  )!;

describe("office cast", () => {
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
