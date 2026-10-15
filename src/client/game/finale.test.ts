import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";
import { applyCast } from "./customization/cast";
import { finaleLifter } from "./rendering/finale";
import { buildController, buildGrinch, buildTrophy } from "./rendering/finale-props";
import { MatchSimulation } from "./simulation";
import { TEAMS } from "./teams";

describe("winning finale", () => {
  const finished = (home: number, away: number) => {
    const sim = new MatchSimulation(...applyCast(TEAMS[0], TEAMS[1]));
    Object.assign(sim.state, { fullTime: true, homeScore: home, awayScore: away });
    return sim.snapshot();
  };
  it("lifts with the free-goal striker only after a pad win", () => {
    expect(finaleLifter(finished(2, 1), true)?.name).toBe("Sebastian Londoño (C)");
    expect(finaleLifter(finished(2, 1), false)).toBeNull();
    expect(finaleLifter(finished(1, 1), true)).toBeNull();
    expect(finaleLifter(finished(0, 1), true)).toBeNull();
    const live = finished(2, 1);
    expect(finaleLifter({ ...live, hud: { ...live.hud, finished: false } }, true)).toBeNull();
  });
  it("builds the Grinch on a clone without touching the shared GLB", async () => {
    const data = await readFile(
      new URL("../public/assets/players/footballer.glb", import.meta.url),
    );
    const gltf = await new GLTFLoader().parseAsync(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      "",
    );
    const shared = new Map<THREE.Mesh, { material: unknown; positions: number[] }>();
    gltf.scene.traverse((o) => {
      if (o instanceof THREE.Mesh)
        shared.set(o, {
          material: o.material,
          positions: Array.from(o.geometry.getAttribute("position").array),
        });
    });
    const grinch = buildGrinch(gltf.scene);
    expect(grinch.body.getObjectByName("Head")!.scale.x).toBeGreaterThan(1);
    for (const [mesh, before] of shared) {
      expect(mesh.material).toBe(before.material);
      expect(Array.from(mesh.geometry.getAttribute("position").array)).toEqual(before.positions);
    }
    expect(gltf.scene.getObjectByName("Head")!.scale.x).toBe(1);
    for (const prop of [grinch, buildTrophy(), buildController()]) {
      expect(prop.root.children.length).toBeGreaterThan(0);
      prop.dispose();
    }
  });
});
