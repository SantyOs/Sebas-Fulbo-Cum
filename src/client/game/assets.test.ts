import { createHash } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { sportClips } from "./rendering/sport-clips";

async function asset(name: string) {
  const data = await readFile(
    resolve(import.meta.dirname, "../public/assets/players", name),
  );
  return new GLTFLoader().parseAsync(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    "",
  );
}
describe("local redistributable 3D assets", () => {
  it("loads a skinned adult humanoid and five clips that bind to its skeleton", async () => {
    const [model, library] = await Promise.all([
      asset("footballer.glb"),
      asset("locomotion.glb"),
    ]);
    const meshes: THREE.SkinnedMesh[] = [];
    model.scene.traverse((o) => {
      if (o instanceof THREE.SkinnedMesh) meshes.push(o);
    });
    expect(meshes.length).toBeGreaterThan(0);
    expect(library.animations.map((c) => c.name).sort()).toEqual(
      [
        "Idle_Loop",
        "Walk_Loop",
        "Jog_Fwd_Loop",
        "Sprint_Loop",
        "Crouch_Fwd_Loop",
      ].sort(),
    );
    const warning = vi.spyOn(console, "warn"),
      error = vi.spyOn(console, "error");
    const instance = clone(model.scene),
      mixer = new THREE.AnimationMixer(instance);
    for (const clip of [...library.animations, ...sportClips()]) {
      for (const track of clip.tracks) {
        const target = THREE.PropertyBinding.parseTrackName(
          track.name,
        ).nodeName;
        expect(
          instance.getObjectByName(target),
          `${clip.name}: ${target}`,
        ).toBeTruthy();
      }
      mixer.stopAllAction();
      mixer.clipAction(clip).play();
      mixer.update(clip.duration * 0.45);
      instance.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(instance, true),
        size = box.getSize(new THREE.Vector3());
      expect(Number.isFinite(size.x + size.y + size.z)).toBe(true);
      expect(size.y).toBeGreaterThan(0.7);
      expect(size.y).toBeLessThan(3);
    }
    expect(warning).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    warning.mockRestore();
    error.mockRestore();
    mixer.stopAllAction();
    mixer.uncacheRoot(instance);
  });
  it("ships source license notices for both CC0 packs", async () => {
    for (const name of ["characters-LICENSE.txt", "animations-LICENSE.txt"]) {
      const license = await readFile(
        resolve(import.meta.dirname, "../public/assets/players", name),
        "utf8",
      );
      expect(license).toMatch(/CC0|Creative Commons Zero/i);
    }
  });
});

it("matches the checked-in asset manifest and has no locomotion root translation", async () => {
  const manifest = JSON.parse(
    await readFile(
      resolve(import.meta.dirname, "../public/assets/players/manifest.json"),
      "utf8",
    ),
  );
  for (const [name, entry] of Object.entries(manifest.files) as [
    string,
    { bytes: number; sha256: string },
  ][]) {
    const data = await readFile(
      resolve(import.meta.dirname, "../public/assets/players", name),
    );
    expect(data.length).toBe(entry.bytes);
    expect(createHash("sha256").update(data).digest("hex")).toBe(entry.sha256);
  }
  const library = await asset("locomotion.glb");
  for (const clip of library.animations) {
    const root = clip.tracks.find((t) => t.name === "root.position");
    expect(root).toBeDefined();
    expect(Array.from(root!.values).every((v) => Math.abs(v) < 1e-5)).toBe(
      true,
    );
  }
});
