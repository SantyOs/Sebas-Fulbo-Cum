import * as THREE from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";

export type Point = [number, number, number];
type Arms = {
  left: Point;
  right: Point;
  leftElbow?: Point;
  rightElbow?: Point;
};
const poses: Record<string, Arms> = {
  celebrate: { left: [0.24, 1.97, 0.12], right: [-0.24, 1.97, 0.12] },
  celebrate_dance: { left: [0.48, 1.72, 0.22], right: [-0.48, 1.28, 0.3] },
  celebrate_dab: {
    left: [0.7, 1.75, 0.16],
    right: [0.02, 1.67, 0.25],
    rightElbow: [-0.4, 1.65, 0.1],
  },
  celebrate_heart: { left: [0.035, 1.43, 0.36], right: [-0.035, 1.43, 0.36] },
  celebrate_airplane: { left: [0.76, 1.43, 0.05], right: [-0.76, 1.43, 0.05] },
  celebrate_slide: { left: [0.57, 1.58, 0.26], right: [-0.57, 1.58, 0.26] },
  celebrate_archer: {
    left: [0.61, 1.6, 0.28],
    right: [-0.08, 1.6, 0.2],
    rightElbow: [-0.45, 1.54, 0.01],
  },
  celebrate_salute: {
    left: [0.32, 1.02, 0.04],
    right: [-0.07, 1.74, 0.21],
    rightElbow: [-0.44, 1.52, 0.04],
  },
  celebrate_shush: { left: [0.32, 1.02, 0.04], right: [-0.01, 1.6, 0.22] },
  celebrate_fist: { left: [0.38, 1.17, 0.14], right: [-0.28, 1.97, 0.1] },
  celebrate_siu: { left: [0.53, 1.12, 0.09], right: [-0.53, 1.12, 0.09] },
};

/** Aim a bone through its child in model space, respecting the imported rig axes. */
export function aim(
  bone: THREE.Object3D,
  child: THREE.Object3D,
  target: THREE.Vector3,
) {
  const origin = bone.getWorldPosition(new THREE.Vector3());
  const from = child
    .getWorldPosition(new THREE.Vector3())
    .sub(origin)
    .normalize();
  const to = target.clone().sub(origin).normalize();
  const rotation = new THREE.Quaternion()
    .setFromUnitVectors(from, to)
    .multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
  bone.quaternion.copy(
    bone
      .parent!.getWorldQuaternion(new THREE.Quaternion())
      .invert()
      .multiply(rotation),
  );
  bone.updateWorldMatrix(false, true);
}

/** Two-bone arm solve in the rig's model space (the finale poses live,
 *  transformed bodies). The pole keeps the elbow outside the chest. */
export function reach(
  rig: THREE.Object3D,
  side: "l" | "r",
  destination: Point,
  pole?: Point,
) {
  const upper = rig.getObjectByName(`upperarm_${side}`)!;
  const lower = rig.getObjectByName(`lowerarm_${side}`)!;
  const hand = rig.getObjectByName(`hand_${side}`)!;
  const shoulder = upper.getWorldPosition(new THREE.Vector3());
  const elbow = lower.getWorldPosition(new THREE.Vector3());
  const wrist = hand.getWorldPosition(new THREE.Vector3());
  const a = shoulder.distanceTo(elbow),
    b = elbow.distanceTo(wrist);
  const delta = rig.localToWorld(new THREE.Vector3(...destination)).sub(shoulder);
  const distance = THREE.MathUtils.clamp(
    delta.length(),
    Math.abs(a - b) + 0.005,
    a + b - 0.005,
  );
  const direction = delta.normalize();
  const target = shoulder.clone().addScaledVector(direction, distance);
  const bend = rig
    .localToWorld(
      new THREE.Vector3(...(pole ?? [side === "l" ? 0.48 : -0.48, 1.35, 0.15])),
    )
    .sub(shoulder);
  bend.addScaledVector(direction, -bend.dot(direction)).normalize();
  const along = (a * a - b * b + distance * distance) / (2 * distance);
  const joint = shoulder
    .clone()
    .addScaledVector(direction, along)
    .addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
  aim(upper, lower, joint);
  aim(lower, hand, target);
}

const durations: Record<string, number> = {
  celebrate: 1.2,
  celebrate_dance: 0.7,
  celebrate_dab: 1.4,
  celebrate_heart: 1.8,
  celebrate_airplane: 2,
  celebrate_slide: 2.4,
  celebrate_archer: 2,
  celebrate_salute: 1.8,
  celebrate_shush: 2,
  celebrate_fist: 1,
  celebrate_siu: 1.6,
};
const cache = new WeakMap<THREE.Object3D, THREE.AnimationClip[]>();
/** Bake deltas against the actual idle pose, never against assumed Euler axes.
 * The cloned rig is only used at asset preparation; runtime uses ordinary clips. */
export function celebrationClips(
  model: THREE.Object3D,
  idle: THREE.AnimationClip,
) {
  const cached = cache.get(model);
  if (cached) return cached;
  const rig = clone(model),
    mixer = new THREE.AnimationMixer(rig);
  mixer.clipAction(idle).play();
  mixer.update(0);
  rig.updateMatrixWorld(true);
  const reference = new Map<string, THREE.Quaternion>();
  rig.traverse((bone) => {
    if (bone instanceof THREE.Bone)
      reference.set(bone.name, bone.quaternion.clone());
  });
  const result = Object.entries(poses).map(([name, pose]) => {
    const duration = durations[name];
    for (const [name, q] of reference)
      rig.getObjectByName(name)!.quaternion.copy(q);
    rig.updateMatrixWorld(true);
    reach(rig, "l", pose.left, pose.leftElbow);
    reach(rig, "r", pose.right, pose.rightElbow);
    if (name === "celebrate_slide") {
      for (const side of ["l", "r"]) {
        const x = side === "l" ? 0.13 : -0.13;
        const thigh = rig.getObjectByName(`thigh_${side}`)!;
        const calf = rig.getObjectByName(`calf_${side}`)!;
        const foot = rig.getObjectByName(`foot_${side}`)!;
        aim(thigh, calf, new THREE.Vector3(x, 0.6, 0.19));
        aim(calf, foot, new THREE.Vector3(x, 0.59, -0.21));
      }
    }
    // Leave the torso on idle: arbitrary Euler rotations would turn the corrected
    // arms backwards again. Kneeling uses calibrated leg targets as well.
    const tracks: THREE.KeyframeTrack[] = [];
    for (const side of ["l", "r"]) {
      for (const part of name === "celebrate_slide"
        ? ["upperarm", "lowerarm", "thigh", "calf"]
        : ["upperarm", "lowerarm"]) {
        const name = `${part}_${side}`;
        const q = reference
          .get(name)!
          .clone()
          .invert()
          .multiply(rig.getObjectByName(name)!.quaternion);
        tracks.push(
          new THREE.QuaternionKeyframeTrack(
            `${name}.quaternion`,
            [0, duration * 0.25, duration * 0.62, duration],
            [0, 0, 0, 1, ...q.toArray(), ...q.toArray(), 0, 0, 0, 1],
          ),
        );
      }
    }
    return new THREE.AnimationClip(
      name,
      duration,
      tracks,
      THREE.AdditiveAnimationBlendMode,
    );
  });
  mixer.stopAllAction();
  mixer.uncacheRoot(rig);
  // SkeletonUtils cloned skeletons; geometry and materials remain shared.
  rig.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
  });
  cache.set(model, result);
  return result;
}
