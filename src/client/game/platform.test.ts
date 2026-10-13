import { FrameMetrics } from "./runtime/performance";
import { describe, it, expect, vi, afterEach } from "vitest";
import { ActionInput, deadzone, type PadState } from "./input/actions";
import { BrowserInput } from "./input/browser";
import {
  assignKey,
  DEFAULT_BINDINGS,
  normalizeBindings,
  loadBindings,
  saveBindings,
} from "./keybindings";
import { FixedStepClock } from "./runtime/fixed-step";
import { MatchSimulation } from "./simulation";
import { emptyInput } from "./contracts";
import { TEAMS } from "./teams";
import { practiceTeams } from "./teams/practice";
import { moveTeam } from "./teams/selection";
import { chooseKits } from "./teams/kits";

const pad = (
  pressed: number[] = [],
  axes = [0, 0],
): PadState & { index: number } => ({
  index: 0,
  mapping: "standard",
  connected: true,
  axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({
    pressed: pressed.includes(i),
    value: pressed.includes(i) ? 1 : 0,
  })),
});
afterEach(() => vi.unstubAllGlobals());
describe("PC input", () => {
  it("removes the old physical binding and preserves a fast press-release pair", () => {
    const input = new ActionInput(),
      bindings = assignKey(DEFAULT_BINDINGS, "shot", "KeyF");
    input.sample(new Set(["KeyL"]), bindings);
    expect(input.consume().held.has("shot")).toBe(false);
    input.sample(new Set(["KeyF"]), bindings);
    input.sample(new Set(), bindings);
    const tap = input.consume();
    expect(tap.pressed).toContain("shot");
    expect(tap.released).toContain("shot");
    expect(input.consume().pressed).toHaveLength(0);
  });
  it("swaps duplicate assignments and repairs corrupted saved data", () => {
    const swapped = assignKey(DEFAULT_BINDINGS, "shot", "Digit5");
    expect(swapped.shortPass).toBe("KeyL");
    const fixed = normalizeBindings({
      shot: "KeyF",
      shortPass: "KeyF",
      sprint: 4,
      moveUp: "Escape",
    });
    expect(fixed.shot).toBe("KeyF");
    expect(new Set(Object.values(fixed)).size).toBe(11);
    expect(Object.values(fixed)).not.toContain("Escape");
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => storage.get(k),
      setItem: (k: string, v: string) => storage.set(k, v),
    });
    saveBindings(fixed);
    expect(loadBindings()).toEqual(fixed);
    storage.set("wc2026.keybindings", "{");
    expect(loadBindings()).toEqual(DEFAULT_BINDINGS);
  });
  it("uses radial deadzone, analog magnitude and standard face/shoulder buttons", () => {
    expect(deadzone(0.1, 0.1)).toEqual({ x: 0, y: 0 });
    expect(Math.hypot(...Object.values(deadzone(1, 1)))).toBeCloseTo(1);
    const input = new ActionInput();
    input.sample(new Set(), DEFAULT_BINDINGS, pad([0, 4, 5, 6], [0.59, 0]));
    const frame = input.consume();
    expect(frame.move.x).toBeCloseTo(0.5);
    expect([...frame.held]).toEqual(
      expect.arrayContaining([
        "shortPass",
        "switchPlayer",
        "sprint",
        "contain",
      ]),
    );
  });
  it("ignores nonstandard pads", () => {
    const input = new ActionInput();
    input.sample(new Set(), DEFAULT_BINDINGS, { ...pad([1]), mapping: "" });
    expect(input.consume().held.size).toBe(0);
  });
  it("clears held controls on blur and pauses only explicitly on resume", () => {
    const win = new EventTarget(),
      doc = Object.assign(new EventTarget(), { hidden: false });
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", doc);
    vi.stubGlobal("navigator", { getGamepads: () => [] });
    const pause = vi.fn(),
      input = new BrowserInput(DEFAULT_BINDINGS, pause, () => {});
    input.attach();
    const key = Object.assign(new Event("keydown"), {
      code: "KeyL",
      repeat: false,
    });
    win.dispatchEvent(key);
    expect(input.actions.consume().held.has("shot")).toBe(true);
    win.dispatchEvent(new Event("blur"));
    expect(pause).toHaveBeenCalledWith("focus");
    expect(input.actions.consume().held.size).toBe(0);
    input.setPaused(true);
    win.dispatchEvent(key);
    expect(input.actions.consume().held.size).toBe(0);
    doc.hidden = true;
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(pause).toHaveBeenCalledTimes(2);
    input.dispose();
    win.dispatchEvent(new Event("blur"));
    expect(pause).toHaveBeenCalledTimes(2);
  });
  it("pauses when the active pad disconnects and warns for nonstandard pads", () => {
    let pads: ReturnType<typeof pad>[] = [pad([1])];
    vi.stubGlobal("navigator", { getGamepads: () => pads });
    const pause = vi.fn(),
      status = vi.fn(),
      input = new BrowserInput(DEFAULT_BINDINGS, pause, status);
    input.poll();
    expect(input.actions.consume().held.has("shot")).toBe(true);
    expect(input.usingPad).toBe(true);
    pads = [];
    input.poll();
    expect(input.usingPad).toBe(false);
    expect(pause).toHaveBeenCalledWith("controller");
    expect(input.actions.consume().held.size).toBe(0);
    pads = [{ ...pad(), mapping: "" }];
    input.poll();
    expect(status.mock.lastCall?.[0]).toContain("no estándar");
  });
});
describe("fixed simulation and roster", () => {
  it("CPU closes the user down faster on harder difficulty", () => {
    const gap = (difficulty: "media" | "muyAlta") => {
      const sim = new MatchSimulation(TEAMS[0], TEAMS[1], { seed: 7 });
      sim.state.difficulty = difficulty;
      for (let i = 0; i < 70; i++) sim.step(1 / 60, emptyInput());
      const owner = sim.state.owner ?? sim.state.controlled;
      return Math.min(
        ...sim.state.awayPlayers.map((p) =>
          Math.hypot(p.x - owner.x, p.y - owner.y),
        ),
      );
    };
    expect(gap("muyAlta")).toBeLessThan(gap("media"));
  });
  it("produces identical full snapshots at 30, 60 and 120 rendering FPS", () => {
    const run = (fps: number) => {
      const sim = new MatchSimulation(TEAMS[0], TEAMS[1], { seed: 94 }),
        clock = new FixedStepClock();
      let step = 0;
      for (let i = 0; i < fps * 12; i++)
        clock.advance(1 / fps, (dt) => {
          const input = emptyInput();
          input.move = { x: Math.sin(step / 60), y: Math.cos(step / 60) };
          sim.step(dt, input);
          step++;
        });
      return sim.snapshot();
    };
    expect(run(30)).toEqual(run(60));
    expect(run(120)).toEqual(run(60));
  });
  it("caps recovery at five steps and discards paused time", () => {
    const clock = new FixedStepClock(),
      step = vi.fn();
    clock.advance(30, step);
    expect(step).toHaveBeenCalledTimes(5);
    clock.reset();
    clock.advance(0, step);
    expect(step).toHaveBeenCalledTimes(5);
  });
  it("contains exactly the agreed ten countries, 110 named players and explicit roles", () => {
    expect(TEAMS.map((t) => t.abbr)).toEqual([
      "ARG",
      "BRA",
      "FRA",
      "ESP",
      "ENG",
      "POR",
      "GER",
      "NED",
      "URU",
      "COL",
    ]);
    expect(TEAMS.flatMap((t) => t.players)).toHaveLength(110);
    for (const team of TEAMS) {
      expect(new Set(team.players.map((p) => p.num)).size).toBe(11);
      expect(team.players.filter((p) => p.role === "GK")).toHaveLength(1);
      for (const p of team.players) {
        expect(p.name).toBeTruthy();
        expect(p.ratings.ovr).toBeGreaterThan(0);
      }
    }
  });
  it("selects practice players by role even with a shuffled squad", () => {
    const reordered = { ...TEAMS[0], players: [...TEAMS[0].players].reverse() };
    const [h, a] = practiceTeams(reordered, TEAMS[1]);
    expect(h.players).toHaveLength(5);
    expect(h.players[0].role).toBe("GK");
    expect(h.players.filter((p) => p.role === "ST")).toHaveLength(2);
    expect(a.players).toHaveLength(1);
    expect(a.players[0].role).toBe("GK");
  });
  it("never selects the same team while navigating and shares kit choice with snapshots", () => {
    for (let i = 0; i < 10; i++)
      for (const offset of [-5, -1, 1, 5])
        expect(moveTeam(i, offset, i)).not.toBe(i);
    for (const home of TEAMS)
      for (const away of TEAMS) {
        if (home === away) continue;
        const sim = new MatchSimulation(home, away);
        const kits = chooseKits(home, away);
        for (const p of sim.snapshot().players)
          if (!p.isGK) expect(p.kit).toEqual(kits[p.team]);
      }
  });
});

describe("performance measurement accounting (synthetic, not a GPU benchmark)", () => {
  it("requires a completed sample and rejects a long frame spanning the measurement window", () => {
    const metrics = new FrameMetrics();
    for (let i = 0; i < 600; i++) metrics.add(1 / 60);
    expect(metrics.report().targetMet).toBe(false);
    metrics.reset();
    metrics.add(71);
    expect(metrics.report().targetMet).toBe(false);
    expect(metrics.report().p95FrameMs).toBe(71000);
    metrics.reset();
    for (let i = 0; i < 4201; i++) metrics.add(1 / 60);
    expect(metrics.report().complete).toBe(true);
    expect(metrics.report().averageFps).toBeCloseTo(60);
    expect(metrics.report().activeSeconds).toBe(60);
  });
});
