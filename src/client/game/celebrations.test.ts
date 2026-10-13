import { readFile } from "node:fs/promises";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, it, expect } from "vitest";
import { GoalFocus } from "./rendering/goal-focus";
import { sportClips } from "./rendering/sport-clips";
import { MatchSimulation } from "./simulation";
import { TEAMS } from "./teams";
import {
  CELEBRATIONS,
  defaultPlayer,
  defaultProfile,
  customizeTeams,
  normalizeProfile,
  playerKey,
} from "./customization/profile";
import { applyCast } from "./customization/cast";

describe("personal celebrations and opposing cast", () => {
  it("provides a valid distinct animation for each configurable celebration", async () => {
    const load = async (name: string) => {
      const data = await readFile(
        new URL(`../public/assets/players/${name}`, import.meta.url),
      );
      return new GLTFLoader().parseAsync(
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
        "",
      );
    };
    const [model, library] = await Promise.all([
      load("footballer.glb"),
      load("locomotion.glb"),
    ]);
    const clips = sportClips(
      model.scene,
      library.animations.find((c) => c.name === "Idle_Loop")!,
    );
    const poses = CELEBRATIONS.map((style) => {
      const clip = clips.find(
        (c) =>
          c.name === (style === "classic" ? "celebrate" : `celebrate_${style}`),
      )!;
      expect(clip.validate()).toBe(true);
      return JSON.stringify(
        clip.tracks.map((t) => [t.name, Array.from(t.values)]),
      );
    });
    expect(new Set(poses).size).toBe(CELEBRATIONS.length);
  });
  it("zooms once per goal, holds while paused and returns before kickoff", () => {
    const sim = new MatchSimulation(TEAMS[0], TEAMS[1]);
    const snap = sim.snapshot(),
      id = snap.controlledId;
    snap.events = [
      { id: 1, kind: "goal", playerId: id, team: "home", tick: 0, time: 0 },
    ];
    const camera = new GoalFocus();
    expect(camera.update(snap, 0)).toEqual({ playerId: id, weight: 0 });
    expect(camera.update(snap, 1)?.weight).toBe(1);
    expect(camera.update(snap, 0)?.weight).toBe(1);
    expect(camera.update(snap, 2.7)?.weight).toBeCloseTo(0.5);
    expect(camera.update(snap, 0.4)).toBeNull();
    expect(camera.update(snap, 1)).toBeNull();
    snap.events = [{ ...snap.events[0], id: 2 }];
    expect(camera.update(snap, 0)?.weight).toBe(0);
  });
  it("round-trips independent home/away designs and keeps stable IDs and cast traits", () => {
    const [home, away] = applyCast(TEAMS[0], TEAMS[0]);
    const profile = defaultProfile();
    const h = home.players[6],
      a = away.players[6];
    profile.players[playerKey(home, h, "home")] = {
      ...defaultPlayer(home, h),
      name: "Contable",
      num: 98,
    };
    profile.players[playerKey(away, a, "away")] = {
      ...defaultPlayer(away, a),
      name: "Rival editada",
      num: 99,
      height: 2.05,
    };
    profile.players[playerKey(away, a, "away")].celebration.style = "siu";
    profile.players[playerKey(away, a, "away")].celebration.closeup = false;
    const patricia = away.players[10];
    profile.players[playerKey(away, patricia, "away")] = {
      ...defaultPlayer(away, patricia),
      hairStyle: "long",
    };
    const clean = normalizeProfile(JSON.parse(JSON.stringify(profile)), TEAMS);
    const [editedHome] = customizeTeams([home], clean, "home");
    const [editedAway] = customizeTeams([away], clean, "away");
    expect(editedHome.players[6].name).toBe("Contable");
    expect(editedHome.players[6].cast?.refusesPasses).toBe(true);
    expect(editedAway.players[6].name).toBe("Rival editada");
    expect(editedAway.players[10].name).toBe("Patricia De La Espriella");
    expect(editedAway.players[6].custom?.height).toBe(2.05);
    expect(editedAway.players[6].custom?.celebration).toMatchObject({
      style: "siu",
      closeup: false,
    });
    expect(editedHome.players[6].sourceId).toBe(TEAMS[0].players[6].num);
    expect(editedAway.players[6].sourceId).toBe(TEAMS[0].players[6].num);
    expect(applyCast(editedHome, editedAway)[1].players[6].name).toBe(
      "Rival editada",
    );
    const sim = new MatchSimulation(editedHome, editedAway);
    const snap = sim.snapshot(),
      p = snap.players.find((p) => p.team === "away" && p.num === 99)!;
    snap.events = [
      { id: 1, kind: "goal", playerId: p.id, team: "away", tick: 0, time: 0 },
    ];
    expect(new GoalFocus().update(snap, 1)).toBeNull();
  });
  it("reserves inherited legacy shirt numbers when normalizing side overrides", () => {
    const team = TEAMS[0],
      profile = defaultProfile();
    profile.players[playerKey(team, team.players[0])] = {
      ...defaultPlayer(team, team.players[0]),
      num: 99,
    };
    profile.players[playerKey(team, team.players[1], "away")] = {
      ...defaultPlayer(team, team.players[1]),
      num: 99,
    };
    const clean = normalizeProfile(profile, TEAMS);
    const [away] = customizeTeams([team], clean, "away");
    expect(new Set(away.players.map((p) => p.num)).size).toBe(11);
    expect(away.players[0].num).toBe(99);
  });
  it("ends the close-up when catch-up simulation has reached the restart", () => {
    const snap = new MatchSimulation(TEAMS[0], TEAMS[1]).snapshot();
    snap.events = [
      {
        id: 10,
        kind: "goal",
        playerId: snap.controlledId,
        team: "home",
        tick: 0,
        time: 0,
      },
    ];
    const camera = new GoalFocus();
    camera.update(snap, 0);
    snap.tick = 241;
    expect(camera.update(snap, 0.05)).toBeNull();
  });
});
