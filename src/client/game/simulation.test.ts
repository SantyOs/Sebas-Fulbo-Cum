import { describe, it, expect, vi, afterEach } from "vitest";
import { MatchSimulation } from "./simulation";
import { emptyInput } from "./contracts";
import { handleGoals, checkOutOfPlay } from "./simulation/rules";
import { keeperMayHandle } from "./simulation/keepers";
import { TEAMS } from "./teams";
import { FIELD_W, FIELD_H, MATCH_REAL_SECS } from "./constants";

afterEach(() => vi.restoreAllMocks());
function match(practice = false) {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  return new MatchSimulation(TEAMS[0], TEAMS[1], { practice, seed: 123 });
}
describe("match rules before renderer migration", () => {
  it("builds two complete sides and selects the home kickoff player", () => {
    const g = match();
    expect(g.state.homePlayers).toHaveLength(11);
    expect(g.state.awayPlayers).toHaveLength(11);
    expect(g.state.controlled.team).toBe("home");
  });
  it("simulates to full time without invalid coordinates", () => {
    const g = match();
    for (let i = 0; i < 22000 && g.state.elapsed < MATCH_REAL_SECS; i++)
      g.step(1 / 60, emptyInput());
    expect(g.state.elapsed).toBe(MATCH_REAL_SECS);
    expect(g.state.message).toContain("FULL TIME");
    for (const p of [
      ...g.state.homePlayers,
      ...g.state.awayPlayers,
      g.state.ball,
    ]) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });
  it("awards a goal and restarts in practice without advancing the clock", () => {
    const g = match(true);
    Object.assign(g.state.ball, { x: FIELD_W + 2, y: FIELD_H / 2, z: 0 });
    g.state.owner = null;
    handleGoals(g.state);
    expect(g.state.homeScore).toBe(1);
    for (let i = 0; i < 180; i++) g.step(1 / 60, emptyInput());
    expect(g.state.elapsed).toBe(0);
    expect(g.state.ball.x).toBeLessThan(FIELD_W);
  });
  it("awards a throw-in to the opposite team", () => {
    const g = match();
    g.state.owner = null;
    g.state.lastTouchTeam = "home";
    Object.assign(g.state.ball, { x: FIELD_W / 2, y: -10, z: 0 });
    checkOutOfPlay(g.state);
    expect(g.state.pendingRestart?.team).toBe("away");
    expect(g.state.pendingRestart?.isThrowIn).toBe(true);
  });
  it("does not allow the keeper to handle a deliberate teammate kick", () => {
    const g = match();
    expect(
      keeperMayHandle(g.state, g.state.homePlayers[0], g.state.homePlayers[1]),
    ).toBe(false);
  });
});
