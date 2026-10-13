import { GoalEventCursor } from "./customization/goals";
import { describe, it, expect, vi, afterEach } from "vitest";
import { TEAMS } from "./teams";
import {
  defaultFace,
  defaultPlayer,
  defaultProfile,
  normalizeProfile,
  customizeTeams,
  playerKey,
  loadProfile,
  saveProfile,
} from "./customization/profile";
import { sculptFace } from "./customization/face";
import { MatchSimulation } from "./simulation";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Footballer } from "./rendering/footballer";
import { birthdayAudio } from "./customization/audio";
import * as THREE from "three";
afterEach(() => vi.unstubAllGlobals());
describe("birthday profiles", () => {
  it("starts with Sebastian and a closer camera", () => {
    expect(defaultProfile().recipient).toBe("Sebastian");
    expect(defaultProfile().cameraZoom).toBeGreaterThan(1);
  });
  it("preserves stable simulation IDs when renaming and changing a shirt number", () => {
    const base = TEAMS[0].players[9],
      profile = defaultProfile();
    profile.players[playerKey(TEAMS[0], base)] = {
      ...defaultPlayer(TEAMS[0], base),
      name: "Sebastian",
      num: 99,
    };
    const teams = customizeTeams(TEAMS, normalizeProfile(profile, TEAMS));
    const sim = new MatchSimulation(teams[0], teams[1]);
    const changed = sim.state.homePlayers.find(
      (p) => p.id === `home-${base.num}`,
    )!;
    expect(changed.name).toBe("Sebastian");
    expect(changed.num).toBe(99);
    expect(changed.custom?.face).toEqual(defaultFace());
    expect(TEAMS[0].players[9].name).toBe(base.name);
    expect(TEAMS[0].players[9].num).toBe(base.num);
  });
  it("sanitizes malformed imports and fixes duplicate numbers without changing the base roster", () => {
    const profile = defaultProfile(),
      a = TEAMS[0].players[0],
      b = TEAMS[0].players[1];
    profile.players[playerKey(TEAMS[0], a)] = {
      ...defaultPlayer(TEAMS[0], a),
      num: b.num,
      height: NaN,
      face: { ...defaultFace(), jaw: 200 },
      skin: "javascript:bad",
    };
    const normalized = normalizeProfile(
      {
        ...profile,
        volume: 4,
        cameraZoom: 10,
        players: { ...profile.players, unknown: { name: "bad" } },
      },
      TEAMS,
    );
    expect(normalized.volume).toBe(1);
    expect(normalized.cameraZoom).toBe(1.4);
    expect(Object.keys(normalized.players)).toHaveLength(1);
    const c = Object.values(normalized.players)[0];
    expect(c.height).toBe(1.8);
    expect(c.face.jaw).toBe(1.35);
    expect(c.skin).toMatch(/^#[a-f0-9]{6}$/i);
    expect(
      new Set(customizeTeams(TEAMS, normalized)[0].players.map((p) => p.num))
        .size,
    ).toBe(11);
  });
  it("round trips player edits, dedication and embedded audio in an export", () => {
    const p = defaultProfile(),
      id = playerKey(TEAMS[0], TEAMS[0].players[2]);
    p.players[id] = defaultPlayer(TEAMS[0], TEAMS[0].players[2]);
    p.sounds["custom-test"] = {
      name: "Amigos",
      data: "data:audio/wav;base64,AAAA",
    };
    p.players[id].celebration.sound = "custom-test";
    p.players[id].face.noseLength = 1.3;
    const clean = normalizeProfile(JSON.parse(JSON.stringify(p)), TEAMS);
    expect(clean).toEqual(normalizeProfile(p, TEAMS));
    expect(clean.players[id].celebration.sound).toBe("custom-test");
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => storage.get(k),
      setItem: (k: string, v: string) => storage.set(k, v),
    });
    saveProfile(clean);
    expect(loadProfile(TEAMS)).toEqual(clean);
  });
  it("rejects remote or oversized imported audio and resets references to missing clips", () => {
    const p = defaultProfile(),
      id = playerKey(TEAMS[0], TEAMS[0].players[0]);
    p.players[id] = defaultPlayer(TEAMS[0], TEAMS[0].players[0]);
    p.players[id].celebration.sound = "custom-remote";
    p.sounds = {
      "custom-remote": { name: "bad", data: "https://example.com/track.mp3" },
      "custom-large": {
        name: "large",
        data: "data:audio/wav;base64," + "A".repeat(1_400_000),
      },
    };
    const result = normalizeProfile(p, TEAMS);
    expect(result.sounds).toEqual({});
    expect(result.players[id].celebration.sound).toBe("fanfare");
  });
});
describe("face geometry", () => {
  it("leaves neutral face and nonfacial body vertices unchanged", () => {
    expect(sculptFace(0.05, 1.69, 0.08, defaultFace())).toEqual([
      0.05, 1.69, 0.08,
    ]);
    expect(sculptFace(0.1, 0.8, 0, { ...defaultFace(), jaw: 1.35 })).toEqual([
      0.1, 0.8, 0,
    ]);
    expect(
      sculptFace(0, 1.665, 0.09, { ...defaultFace(), noseLength: 1.35 })[2],
    ).toBeGreaterThan(0.09);
  });
  it("changes real mesh vertices without mutating another player or the shared asset", async () => {
    const load = async (name: string) => {
      const buffer = await readFile(
        resolve(import.meta.dirname, "../public/assets/players", name),
      );
      return new GLTFLoader().parseAsync(
        buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ),
        "",
      );
    };
    const [model, locomotion] = await Promise.all([
      load("footballer.glb"),
      load("locomotion.glb"),
    ]);
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ fillText: () => {} }),
      }),
    });
    const profile = defaultProfile(),
      p = TEAMS[0].players[9],
      c = defaultPlayer(TEAMS[0], p);
    c.face = {
      jaw: 1.35,
      chin: 1.35,
      noseWidth: 1.35,
      noseLength: 1.35,
      eyeSpacing: 1.35,
      eyeSize: 1.35,
      mouthWidth: 1.35,
      lips: 1.35,
      ears: 1.35,
      cheeks: 1.35,
    };
    profile.players[playerKey(TEAMS[0], p)] = c;
    const teams = customizeTeams(TEAMS, profile),
      sim = new MatchSimulation(teams[0], teams[1]),
      view = sim.snapshot().players.find((v) => v.custom)!;
    const source = model.scene.getObjectByName("SuperHero_Male") as THREE.Mesh,
      original = Array.from(source.geometry.getAttribute("position").array);
    const asset = { model, locomotion, dispose: () => {} },
      avatar = new Footballer(asset, view, teams[0]);
    const edited = avatar.root.getObjectByName("SuperHero_Male") as THREE.Mesh;
    expect(edited.geometry).not.toBe(source.geometry);
    expect(
      Array.from(edited.geometry.getAttribute("position").array),
    ).not.toEqual(original);
    expect(Array.from(source.geometry.getAttribute("position").array)).toEqual(
      original,
    );
    const warnings = vi.spyOn(console, "warn");
    avatar.update(
      view,
      view,
      1,
      1 / 60,
      [{ id: 1, tick: 1, time: 1, kind: "goal", playerId: view.id }],
      false,
    );
    expect(warnings).not.toHaveBeenCalled();
    warnings.mockRestore();
    avatar.dispose();
  });
});
describe("presentation audio lifecycle", () => {
  it("unlocks via gesture, stops sources on pause/exit and honors mute", async () => {
    const nodes: { stop: ReturnType<typeof vi.fn> }[] = [];
    const param = () => ({
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    });
    class Context {
      state = "running";
      currentTime = 0;
      sampleRate = 100;
      destination = {};
      resume = vi.fn();
      createGain() {
        return { gain: param(), connect: vi.fn(), disconnect: vi.fn() };
      }
      createOscillator() {
        const n = {
          frequency: { value: 0 },
          type: "",
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          onended: null,
        };
        nodes.push(n);
        return n;
      }
      createBuffer() {
        return { getChannelData: () => new Float32Array(200) };
      }
      createBufferSource() {
        const n = {
          buffer: null,
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          onended: null,
        };
        nodes.push(n);
        return n;
      }
      createBiquadFilter() {
        return {
          type: "",
          frequency: { value: 0 },
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
      }
    }
    vi.stubGlobal("AudioContext", Context);
    await birthdayAudio.unlock();
    await birthdayAudio.play("fanfare", 1, defaultProfile());
    expect(nodes).toHaveLength(6);
    birthdayAudio.stop();
    expect(nodes.every((n) => n.stop.mock.calls.length === 2)).toBe(true);
    await birthdayAudio.play("party", 1, { ...defaultProfile(), volume: 0 });
    expect(nodes).toHaveLength(6);
  });
});

it("delivers one personalized celebration per goal despite repeated snapshots", () => {
  const profile = defaultProfile(),
    player = TEAMS[0].players[9],
    key = playerKey(TEAMS[0], player),
    custom = defaultPlayer(TEAMS[0], player);
  custom.name = "Sebastian";
  custom.celebration.sound = "stadium";
  profile.players[key] = custom;
  const teams = customizeTeams(TEAMS, profile),
    snapshot = new MatchSimulation(teams[0], teams[1]).snapshot(),
    scorer = snapshot.players.find((p) => p.custom)!;
  const withGoal = {
    ...snapshot,
    events: [
      ...snapshot.events,
      {
        id: 2,
        tick: 200,
        time: 3.33,
        kind: "goal" as const,
        playerId: scorer.id,
        team: "home" as const,
      },
    ],
  };
  const cursor = new GoalEventCursor();
  expect(cursor.consume(withGoal)).toEqual([
    {
      id: 2,
      name: "Sebastian",
      confetti: true,
      sound: "stadium",
      volume: 0.8,
      call: false,
    },
  ]);
  expect(cursor.consume(withGoal)).toEqual([]);
});
