import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { sportClips } from "./rendering/sport-clips";
import { Footballer } from "./rendering/footballer";
import {
  defaultPlayer,
  defaultProfile,
  customizeTeams,
  playerKey,
} from "./customization/profile";
import { MatchSimulation } from "./simulation";
import { TEAMS } from "./teams";

const load = async (name: string) => {
  const b = await readFile(
    new URL(`../public/assets/players/${name}`, import.meta.url),
  );
  return new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    "",
  );
};
afterEach(() => vi.unstubAllGlobals());

describe("avatar pose geometry", () => {
  it("keeps celebration hands in front of the shoulders and lifts the classic salute above the head", async () => {
    const [model, library] = await Promise.all([
      load("footballer.glb"),
      load("locomotion.glb"),
    ]);
    const idle = library.animations.find((c) => c.name === "Idle_Loop")!;
    const clips = sportClips(model.scene, idle).filter((c) =>
      c.name.startsWith("celebrate"),
    );
    for (const clip of clips) {
      const rig = clone(model.scene),
        mixer = new THREE.AnimationMixer(rig);
      mixer.clipAction(idle).play();
      mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1).play();
      mixer.update(clip.duration * 0.4);
      rig.updateMatrixWorld(true);
      for (const side of ["l", "r"]) {
        const hand = rig
          .getObjectByName(`hand_${side}`)!
          .getWorldPosition(new THREE.Vector3());
        const shoulder = rig
          .getObjectByName(`upperarm_${side}`)!
          .getWorldPosition(new THREE.Vector3());
        expect(
          hand.z,
          `${clip.name} ${side}: hand behind shoulder`,
        ).toBeGreaterThan(shoulder.z - 0.015);
        if (clip.name === "celebrate") expect(hand.y).toBeGreaterThan(1.8);
        if (clip.name === "celebrate_heart") {
          expect(Math.abs(hand.x)).toBeLessThan(0.13);
          expect(hand.z).toBeGreaterThan(0.25);
        }
      }
      mixer.stopAllAction();
      mixer.uncacheRoot(rig);
      rig.traverse((o) => {
        if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
      });
    }
  });

  it("covers the actual skull with hair, preserves deliberate baldness and exports optional CPU inspection geometry", async () => {
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
    const team = TEAMS[0],
      p = team.players[9],
      custom = defaultPlayer(team, p);
    const profile = defaultProfile();
    profile.players[playerKey(team, p)] = custom;
    const [home, away] = customizeTeams(TEAMS, profile);
    const view = new MatchSimulation(home, away)
      .snapshot()
      .players.find((p) => p.custom)!;
    const assets = { model, locomotion, dispose: () => {} };
    for (const style of ["short", "curly", "long", "mohawk", "bald"] as const) {
      custom.hairStyle = style;
      const avatar = new Footballer(assets, view, home);
      avatar.root.updateMatrixWorld(true);
      const hair = avatar.root.getObjectByName("PlayerHair")!;
      expect(hair.visible).toBe(style !== "bald");
      if (hair.visible) {
        const scalp = new THREE.Box3().setFromObject(
          avatar.root.getObjectByName("SuperHero_Male")!,
          true,
        );
        const cap = new THREE.Box3().setFromObject(hair, true);
        expect(
          cap.max.y,
          `${style} must extend above the scalp`,
        ).toBeGreaterThan(scalp.max.y + 0.008);
      }
      avatar.dispose();
    }
    // Opt-in, offline geometry capture for visual inspection without a browser.
    // This is a CPU pose illustration, not evidence of WebGL rendering.
    if (process.env.AVATAR_QA_FILE) {
      const captures: {
        name: string;
        meshes: { positions: number[]; indices: number[]; color: string }[];
      }[] = [];
      for (const style of [
        "classic",
        "heart",
        "dab",
        "airplane",
        "salute",
        "siu",
      ] as const) {
        custom.hairStyle = "short";
        custom.celebration.style = style;
        custom.celebration.jump = 0;
        const avatar = new Footballer(assets, view, home);
        for (let i = 0; i < 27; i++)
          avatar.update(
            view,
            view,
            1,
            1 / 60,
            [{ id: 1, tick: 1, time: 0, kind: "goal", playerId: view.id }],
            false,
          );
        avatar.root.updateMatrixWorld(true);
        const modelSpace = avatar.root.matrixWorld.clone().invert();
        const meshes: (typeof captures)[number]["meshes"] = [];
        avatar.root.traverse((o) => {
          if (
            !(o instanceof THREE.Mesh) ||
            !o.visible ||
            !(o.material instanceof THREE.MeshStandardMaterial)
          )
            return;
          if (o instanceof THREE.SkinnedMesh) o.skeleton.update();
          const positions: number[] = [];
          for (let i = 0; i < o.geometry.getAttribute("position").count; i++) {
            const v = o
              .getVertexPosition(i, new THREE.Vector3())
              .applyMatrix4(o.matrixWorld)
              .applyMatrix4(modelSpace);
            positions.push(...v.toArray());
          }
          meshes.push({
            positions,
            indices: o.geometry.index
              ? Array.from(o.geometry.index.array)
              : Array.from({ length: positions.length / 3 }, (_, i) => i),
            color: o.material.color.getStyle(),
          });
        });
        captures.push({ name: style, meshes });
        avatar.dispose();
      }
      await writeFile(process.env.AVATAR_QA_FILE, JSON.stringify(captures));
    }
  });
});
