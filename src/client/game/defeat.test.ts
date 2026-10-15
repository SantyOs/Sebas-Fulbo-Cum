import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { DefeatPresentation, isDefeat } from "./rendering/defeat";
import { GoalEventCursor } from "./customization/goals";
import { defaultPlayer } from "./customization/profile";
import { applyCast } from "./customization/cast";
import { MatchSimulation } from "./simulation";
import { TEAMS } from "./teams";

describe("birthday result presentation", () => {
  it("shares the laugh, advances on media end, pauses and releases all resources", () => {
    const elements: any[] = [];
    vi.stubGlobal("document", { createElement: () => {
      const element = {
        play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(),
        setAttribute: vi.fn(), removeAttribute: vi.fn(), load: vi.fn(), remove: vi.fn(),
        readyState: 0, HAVE_CURRENT_DATA: 2,
      };
      elements.push(element);
      return element;
    } });
    try {
      const scene = new THREE.Scene();
      const host = { append: vi.fn() } as unknown as HTMLElement;
      const effect = new DefeatPresentation(scene, host, 0.4);
      effect.update(new Map([ ["one", { root: new THREE.Object3D() }], ["two", { root: new THREE.Object3D() }] ]));
      expect(scene.children).toHaveLength(2);
      expect((scene.children[0] as THREE.Sprite).material).toBe((scene.children[1] as THREE.Sprite).material);
      expect(elements[0].play).toHaveBeenCalledTimes(1);
      effect.setPaused(true);
      expect(elements[0].pause).toHaveBeenCalled();
      effect.setPaused(false);
      expect(elements[0].play).toHaveBeenCalledTimes(2);
      elements[0].onended();
      expect(scene.children.every(p => !p.visible)).toBe(true);
      expect(elements[1].hidden).toBe(false);
      expect(elements[1].play).toHaveBeenCalledTimes(1);
      effect.setVolume(0);
      expect(elements[1].volume).toBe(0);
      effect.setPaused(true);
      expect(elements[1].pause).toHaveBeenCalled();
      effect.dispose();
      expect(scene.children).toHaveLength(0);
      expect(elements[1].removeAttribute).toHaveBeenCalledWith("src");
      expect(elements[2].remove).toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
  it("only starts defeat after the final whistle with a losing home score", () => {
    expect(isDefeat({ finished: false, homeScore: 0, awayScore: 3 })).toBe(false);
    expect(isDefeat({ finished: true, homeScore: 0, awayScore: 3 })).toBe(true);
    expect(isDefeat({ finished: true, homeScore: 3, awayScore: 3 })).toBe(false);
    expect(isDefeat({ finished: true, homeScore: 4, awayScore: 3 })).toBe(false);
  });
  it("defaults Sebastian to siu and identifies his goals independently of name and number", () => {
    const [home, away] = applyCast(TEAMS[0], TEAMS[1]);
    expect(defaultPlayer(home, home.players[9]).celebration.style).toBe("siu");
    const snap = new MatchSimulation(home, away).snapshot();
    const sebas = snap.players.find(p => p.cast?.freeGoal)!;
    const other = snap.players.find(p => p.team === "home" && !p.cast?.freeGoal)!;
    const rival = snap.players.find(p => p.team === "away")!;
    snap.players = snap.players.map(p => p.id === sebas.id ? { ...p, name: "Editado", num: 99 } : p);
    const cursor = new GoalEventCursor();
    for (const [i, scorer] of [sebas, other, rival].entries()) {
      snap.events = [{ id: i + 1, kind: "goal", playerId: scorer.id, team: scorer.team, tick: 10, time: 1, freeGoal: i === 0 }];
      expect(cursor.consume(snap)[0].siu).toBe(i === 0);
      expect(cursor.consume(snap)).toEqual([]);
    }
    snap.events = [{ id: 4, kind: "goal", team: "home", tick: 11, time: 2 }];
    expect(cursor.consume(snap)[0].siu).toBe(false);
  });
});
