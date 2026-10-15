import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { FINALE_SECS } from "../constants";
import type { MatchSnapshot } from "../contracts";
import { aim, reach, type Point } from "./celebration-clips";
import type { Footballer, PlayerAssets } from "./footballer";
import {
  buildController,
  buildGrinch,
  buildTrophy,
  GRINCH_HEAD,
} from "./finale-props";

/** The home free-goal striker lifts the trophy-holding Grinch after a win with
 *  a pad. Null when the finale does not apply. */
export function finaleLifter(
  snapshot: MatchSnapshot,
  usingPad: boolean,
): MatchSnapshot["players"][number] | null {
  const { hud } = snapshot;
  if (!usingPad || !hud.finished || hud.homeScore <= hud.awayScore) return null;
  return (
    snapshot.players.find((p) => p.team === "home" && p.cast?.freeGoal) ?? null
  );
}

const ease = (t: number, a: number, b: number) =>
  THREE.MathUtils.smootherstep(t, a, b);
const lerp = (a: Point, b: Point, k: number): Point => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];
const CONFETTI = 520;
const PALETTE = ["#c6ff2e", "#ff8dd8", "#77dbff", "#ffe47e", "#e7b43c", "#fff"];

/** Presentation only: poses an avatar and drives the camera, never the
 *  simulation. Owns every resource it creates. */
export class Finale {
  private time = 0;
  private startYaw?: number;
  private grinch: ReturnType<typeof buildGrinch>;
  private trophy: ReturnType<typeof buildTrophy>;
  private pad: ReturnType<typeof buildController>;
  private env: THREE.WebGLRenderTarget;
  private grinchMixer: THREE.AnimationMixer;
  private confetti: THREE.InstancedMesh;
  private bits: {
    cannon: boolean;
    side: number;
    a: number;
    r: number;
    h: number;
    v: number;
    spin: THREE.Vector3;
    delay: number;
    up: number;
    spread: THREE.Vector3;
  }[];
  private dummy = new THREE.Object3D();
  constructor(
    assets: PlayerAssets,
    renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
  ) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    this.env = pmrem.fromScene(room, 0.04);
    room.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    pmrem.dispose();
    this.grinch = buildGrinch(assets.model.scene);
    this.grinchMixer = new THREE.AnimationMixer(this.grinch.body);
    const idle = assets.locomotion.animations.find((c) => c.name === "Idle_Loop");
    if (idle) this.grinchMixer.clipAction(idle).play();
    this.trophy = buildTrophy(this.env.texture);
    this.trophy.root.scale.setScalar(0.85);
    this.trophy.root.position.set(-0.07, 0.3, 0.15);
    this.grinch.root.add(this.trophy.root);
    this.pad = buildController();
    this.pad.root.scale.setScalar(0.9);
    this.confetti = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.045, 0.07),
      new THREE.MeshStandardMaterial({
        side: THREE.DoubleSide,
        roughness: 0.6,
        metalness: 0.2,
      }),
      CONFETTI,
    );
    this.confetti.frustumCulled = false;
    // Deterministic scatter, so every finale looks the same.
    let seed = 2026;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    this.bits = Array.from({ length: CONFETTI }, (_, i) => {
      this.confetti.setColorAt(i, new THREE.Color(PALETTE[i % PALETTE.length]));
      const cannon = i < CONFETTI * 0.45;
      return {
        cannon,
        side: i % 2 ? 1 : -1,
        a: rand() * Math.PI * 2,
        r: 0.8 + rand() * 4,
        h: 5 + rand() * 5,
        v: 0.7 + rand() * 0.8,
        spin: new THREE.Vector3(rand(), rand(), rand()).multiplyScalar(9),
        delay: rand() * (cannon ? 0.25 : 1.6),
        up: 7 + rand() * 4,
        spread: new THREE.Vector3(rand() - 0.5, 0, rand() - 0.5).multiplyScalar(2.6),
      };
    });
    scene.add(this.grinch.root, this.pad.root, this.confetti);
  }
  /** Advances the sequence; holds the last frame once it has played. */
  update(
    dt: number,
    lifter: Footballer,
    camera: THREE.PerspectiveCamera,
    broadcast: { position: THREE.Vector3; look: THREE.Vector3 },
  ) {
    const t = (this.time = Math.min(FINALE_SECS, this.time + dt));
    const root = lifter.root,
      rig = lifter.rig,
      at = root.position;
    // He turns to the broadcast side (+z) while the camera comes down.
    this.startYaw ??= root.rotation.y;
    const turn =
      THREE.MathUtils.euclideanModulo(-this.startYaw + Math.PI, Math.PI * 2) -
      Math.PI;
    root.rotation.y = this.startYaw + turn * ease(t, 0.9, 2.2);
    root.updateMatrixWorld(true);

    // Side carry, then the right hand lifts him overhead; the left pumps.
    const lift = ease(t, 2.7, 3.7),
      pump = t > 3.7 ? Math.sin((t - 3.7) * 5.5) * 0.5 + 0.5 : 0;
    reach(rig, "r", lerp([-0.36, 1.02, 0.3], [-0.2, 2.2, 0.16], lift), [
      -0.7,
      1.2 + lift * 0.6,
      -0.2,
    ]);
    reach(
      rig,
      "l",
      lerp([0.3, 1, 0.22], [0.42, 1.62 + pump * 0.3, 0.22], ease(t, 3, 3.9)),
      [0.6, 1.3, -0.1],
    );
    rig.updateMatrixWorld(true);
    const palm = rig
      .getObjectByName("hand_r")!
      .getWorldPosition(new THREE.Vector3());

    // The Grinch sits on the palm, hugging the cup, pad raised in his left.
    const g = this.grinch,
      body = g.body;
    this.grinchMixer.update(dt);
    body.getObjectByName("Head")!.scale.setScalar(GRINCH_HEAD);
    g.root.position.copy(palm).add(new THREE.Vector3(0, -0.36, 0.05));
    g.root.rotation.set(
      0,
      root.rotation.y + Math.sin(t * 2.2) * 0.08 * lift,
      Math.sin(t * 4) * 0.04 * lift,
    );
    g.root.updateMatrixWorld(true);
    for (const [s, x] of [
      ["l", 1],
      ["r", -1],
    ] as const) {
      const swing = Math.sin(t * 6 + x) * 0.06 * lift;
      aim(
        body.getObjectByName(`thigh_${s}`)!,
        body.getObjectByName(`calf_${s}`)!,
        body.localToWorld(new THREE.Vector3(x * 0.17, 0.9, 0.5)),
      );
      aim(
        body.getObjectByName(`calf_${s}`)!,
        body.getObjectByName(`foot_${s}`)!,
        body.localToWorld(new THREE.Vector3(x * 0.19, 0.48, 0.55 + swing)),
      );
    }
    const raise = ease(t, 3.5, 4.2);
    reach(body, "r", [-0.1, 1.05, 0.42], [-0.8, 1, 0.2]);
    reach(body, "l", lerp([0.55, 1.2, 0.3], [0.38, 2.1, 0.22], raise), [0.9, 1, -0.2]);
    body.updateMatrixWorld(true);
    this.trophy.root.rotation.set(0.12, 0, 0.1 + Math.sin(t * 3) * 0.03 * lift);
    this.pad.root.position
      .copy(body.getObjectByName("hand_l")!.getWorldPosition(new THREE.Vector3()))
      .add(new THREE.Vector3(0.01, 0, 0.03));
    this.pad.root.quaternion
      .copy(root.quaternion)
      .multiply(
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(-0.25, 0.2, -0.25 - raise * 0.4),
        ),
      );

    // Broadcast view → crane down to a low hero angle → slow orbit, subject
    // framed right of centre while the title panel sits lower left.
    const orbit = 0.5 - ease(t, 2.4, FINALE_SECS) * 0.85;
    const dist = THREE.MathUtils.lerp(3.3, 4.9, lift) - ease(t, 4.2, FINALE_SECS) * 0.6;
    const hero = new THREE.Vector3(
      at.x + Math.sin(orbit) * dist,
      1.05 + lift * 0.35,
      at.z + Math.cos(orbit) * dist,
    );
    const thirds = ease(t, 3.6, 4.4) * 0.85;
    const heroLook = new THREE.Vector3(
      at.x - Math.cos(orbit) * thirds,
      THREE.MathUtils.lerp(1.3, 1.75, lift),
      at.z + Math.sin(orbit) * thirds,
    );
    const swoop = ease(t, 0.9, 2.6);
    camera.position.lerpVectors(broadcast.position, hero, swoop);
    camera.position.y += Math.sin(swoop * Math.PI) * 4;
    camera.fov = THREE.MathUtils.lerp(43, 36, swoop);
    camera.updateProjectionMatrix();
    camera.lookAt(new THREE.Vector3().lerpVectors(broadcast.look, heroLook, swoop));

    // Cannons fire as he lifts; the rest rains around him.
    for (let i = 0; i < CONFETTI; i++) {
      const b = this.bits[i],
        tt = t - 3.65 - b.delay,
        d = this.dummy;
      if (tt < 0) d.position.set(0, -50, 0);
      else if (b.cannon) {
        const rise = Math.min(tt, 0.9);
        d.position.set(
          at.x + b.side * 2.2 + b.spread.x * tt + Math.sin(tt * 3 + b.a) * 0.3,
          Math.max(0.05, 0.2 + b.up * rise - 4.9 * rise * rise - Math.max(0, tt - 0.9) * b.v),
          at.z - 0.6 + b.spread.z * tt,
        );
      } else
        d.position.set(
          at.x + Math.cos(b.a) * b.r + Math.sin(tt * 2 + b.a) * 0.4,
          Math.max(0.03, b.h - tt * b.v * 1.4),
          at.z + Math.sin(b.a) * b.r,
        );
      d.rotation.set(b.spin.x * tt, b.spin.y * tt, b.spin.z * tt);
      d.updateMatrix();
      this.confetti.setMatrixAt(i, d.matrix);
    }
    this.confetti.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    this.scene.remove(this.grinch.root, this.pad.root, this.confetti);
    this.grinchMixer.stopAllAction();
    this.grinchMixer.uncacheRoot(this.grinch.body);
    this.grinch.dispose();
    this.trophy.dispose();
    this.pad.dispose();
    this.confetti.geometry.dispose();
    (this.confetti.material as THREE.Material).dispose();
    this.confetti.dispose();
    this.env.dispose();
  }
}
