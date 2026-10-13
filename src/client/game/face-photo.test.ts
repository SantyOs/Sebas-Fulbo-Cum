import { afterEach, describe, expect, it, vi } from "vitest";
import {
  effectivePhoto,
  MAX_FACE_PHOTO,
  normalizePhoto,
  yennyPhoto,
} from "./customization/photo";
import { applyCast } from "./customization/cast";
import {
  customizeTeams,
  defaultPlayer,
  defaultProfile,
  normalizeProfile,
  playerKey,
} from "./customization/profile";
import { TEAMS } from "./teams";
import { practiceTeams } from "./teams/practice";
import { BirthdayAudio } from "./customization/audio";
import { applyFacePhoto } from "./rendering/face-photo";
import * as THREE from "three";

afterEach(() => vi.unstubAllGlobals());
describe("face photos and shared practice customization", () => {
  it("defaults Yenny to her bundled photo, retaining explicit removal and old profiles", () => {
    const [, away] = applyCast(TEAMS[0], TEAMS[1]);
    const yenny = away.players[9];
    expect(effectivePhoto(yenny)).toEqual(yennyPhoto());
    const old = { ...defaultPlayer(away, yenny), photo: undefined };
    expect(effectivePhoto({ ...yenny, custom: old })).toEqual(yennyPhoto());
    expect(
      effectivePhoto({ ...yenny, custom: { ...old, photo: null } }),
    ).toBeNull();
  });
  it("rejects remote, SVG, oversized and malformed sources and clamps placement", () => {
    for (const source of [
      "https://example.com/photo.jpg",
      "data:image/svg+xml;base64,AAAA",
      "data:image/png;base64,???",
      "data:image/png;base64," + "A".repeat(MAX_FACE_PHOTO),
    ])
      expect(normalizePhoto({ ...yennyPhoto(), source })).toBeUndefined();
    expect(
      normalizePhoto({
        ...yennyPhoto(),
        scale: 100,
        opacity: -1,
        offsetX: NaN,
      }),
    ).toMatchObject({ scale: 6, opacity: 0, offsetX: 0.5 });
  });
  it("round trips side-scoped photos and preserves them on the reduced training squad", () => {
    const [home, away] = applyCast(TEAMS[0], TEAMS[1]);
    const profile = defaultProfile();
    const key = playerKey(home, home.players[9], "home");
    profile.players[key] = {
      ...defaultPlayer(home, home.players[9]),
      photo: {
        ...yennyPhoto(),
        source: "data:image/png;base64,AAAA",
        opacity: 0.75,
      },
    };
    profile.players[key].celebration.style = "heart";
    const restored = normalizeProfile(
      JSON.parse(JSON.stringify(profile)),
      TEAMS,
    );
    const [customHome] = customizeTeams([home], restored, "home");
    const [h, a] = practiceTeams(customHome, away);
    expect(h.players).toHaveLength(5);
    expect(a.players).toHaveLength(1);
    const striker = h.players.find(
      (p) => p.sourceId === home.players[9].sourceId,
    )!;
    expect(striker.custom?.photo).toEqual(profile.players[key].photo);
    expect(striker.custom?.celebration.style).toBe("heart");
    expect(striker.cast).toEqual(home.players[9].cast);
  });
  it("bounds embedded photo storage across imported players", () => {
    const profile = defaultProfile();
    for (const p of TEAMS[0].players)
      profile.players[playerKey(TEAMS[0], p)] = {
        ...defaultPlayer(TEAMS[0], p),
        photo: {
          ...yennyPhoto(),
          source: "data:image/png;base64," + "A".repeat(170_000),
        },
      };
    const normalized = normalizeProfile(profile, TEAMS);
    const bytes = Object.values(normalized.players).reduce(
      (n, p) => n + (p.photo?.source.length ?? 0),
      0,
    );
    expect(bytes).toBeLessThanOrEqual(1_200_000);
  });
  it("projects in bind space while retaining the material shader and texture alpha", () => {
    const material = new THREE.MeshStandardMaterial();
    const texture = new THREE.Texture();
    material.onBeforeCompile = (shader) => {
      shader.uniforms.existing = { value: 1 };
    };
    applyFacePhoto(material, texture, yennyPhoto());
    const shader = {
      uniforms: {},
      vertexShader: "#include <common>\n#include <begin_vertex>",
      fragmentShader: "#include <common>\n#include <roughnessmap_fragment>",
    };
    material.onBeforeCompile(
      shader as THREE.WebGLProgramParametersWithUniforms,
      {} as THREE.WebGLRenderer,
    );
    expect(shader.uniforms).toMatchObject({
      existing: { value: 1 },
      facePhoto: { value: texture },
    });
    expect(shader.vertexShader).toContain("vPhotoPosition = position");
    expect(shader.fragmentShader).toContain("faceTexel.a");
    expect(shader.fragmentShader).toContain("smoothstep(0.025, 0.065");
    material.dispose();
    texture.dispose();
  });
});

it("loops the louder goal ringtone for 12 seconds and cancels pending audio on pause", async () => {
  const sources: {
    loop: boolean;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }[] = [];
  const gain = {
    gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(0) })),
  );
  vi.stubGlobal(
    "AudioContext",
    class {
      state = "running";
      currentTime = 10;
      destination = {};
      decodeAudioData = async () => ({ duration: 4 });
      createGain = () => gain;
      createBufferSource = () => {
        const source = {
          loop: false,
          start: vi.fn(),
          stop: vi.fn(),
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
        sources.push(source);
        return source;
      };
    },
  );
  const audio = new BirthdayAudio();
  await audio.unlock();
  await audio.playCall(true, defaultProfile());
  expect(sources[0].loop).toBe(true);
  expect(sources[0].stop).toHaveBeenCalledWith(22);
  expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.65 * 2.4, 10);
  audio.stop();
  expect(sources[0].stop).toHaveBeenCalledTimes(2);
  const pending = audio.playCall(true, defaultProfile());
  audio.stop();
  await pending;
  expect(sources).toHaveLength(1);
  await audio.playCall(false, defaultProfile());
  expect(sources[1].loop).toBe(false);
  expect(sources[1].stop).toHaveBeenCalledWith(13);
});
