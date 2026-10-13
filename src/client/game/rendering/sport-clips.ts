import * as THREE from "three";

type Pose = Record<string, [number, number, number]>;
/** Additive clips augment locomotion; their transforms never drive simulation. */
function clip(name: string, duration: number, pose: Pose) {
  const tracks: THREE.KeyframeTrack[] = [];
  for (const [bone, angles] of Object.entries(pose)) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles));
    tracks.push(
      new THREE.QuaternionKeyframeTrack(
        `${bone}.quaternion`,
        [0, duration * 0.25, duration * 0.62, duration],
        [0, 0, 0, 1, ...q.toArray(), ...q.toArray(), 0, 0, 0, 1],
      ),
    );
  }
  return new THREE.AnimationClip(
    name,
    duration,
    tracks,
    THREE.AdditiveAnimationBlendMode,
  );
}
export function sportClips() {
  return [
    clip("pass", 0.32, {
      thigh_r: [-0.7, 0, 0],
      calf_r: [0.4, 0, 0],
      spine_01: [0.12, 0, 0],
      upperarm_l: [0, 0, -0.3],
    }),
    clip("shot", 0.46, {
      thigh_r: [-1.15, 0, 0],
      calf_r: [0.65, 0, 0],
      spine_01: [0.22, -0.18, 0],
      upperarm_l: [0, 0, -0.65],
    }),
    clip("receive", 0.28, {
      thigh_r: [-0.3, 0.3, 0],
      foot_r: [0, 0.35, 0],
      spine_01: [0.1, 0, 0],
    }),
    clip("tackle", 0.3, {
      thigh_r: [-0.8, 0, 0],
      calf_l: [0.35, 0, 0],
      spine_01: [0.24, 0, 0],
    }),
    clip("slide", 0.7, {
      thigh_r: [-0.9, 0, 0],
      thigh_l: [-0.6, 0.4, 0],
      calf_l: [1.2, 0, 0],
      spine_01: [-0.2, 0, 0],
    }),
    clip("recover", 0.36, {
      thigh_l: [-0.65, 0, 0],
      calf_l: [1, 0, 0],
      spine_01: [0.6, 0, 0],
    }),
    clip("save", 0.55, {
      upperarm_l: [-1.1, 0, -0.5],
      upperarm_r: [-1.1, 0, 0.5],
      lowerarm_l: [-0.6, 0, 0],
      lowerarm_r: [-0.6, 0, 0],
    }),
    clip("dive", 0.6, {
      upperarm_l: [-2, 0, -0.3],
      upperarm_r: [-2, 0, 0.3],
      thigh_l: [-0.3, 0, 0],
      calf_r: [0.4, 0, 0],
    }),
    clip("throw", 0.65, {
      upperarm_l: [-2.4, 0, -0.2],
      upperarm_r: [-2.4, 0, 0.2],
      lowerarm_l: [-0.9, 0, 0],
      lowerarm_r: [-0.9, 0, 0],
    }),
    clip("celebrate_dance", 0.7, {
      upperarm_l: [-1.2, 0, -0.8],
      upperarm_r: [-0.3, 0, 1.2],
      spine_01: [0, 0.3, 0.15],
      thigh_l: [-0.5, 0, 0],
      calf_l: [0.65, 0, 0],
    }),
    clip("celebrate_dab", 1.4, {
      upperarm_l: [-1.6, 0, -1.1],
      upperarm_r: [-1.2, 0, 0.8],
      lowerarm_r: [-1.8, 0, 0],
      Head: [0.2, 0, -0.35],
    }),
    clip("celebrate_heart", 1.8, {
      upperarm_l: [-1.2, 0, -0.25],
      upperarm_r: [-1.2, 0, 0.25],
      lowerarm_l: [-1.9, 0, -0.5],
      lowerarm_r: [-1.9, 0, 0.5],
    }),
    clip("celebrate", 1.2, {
      upperarm_l: [-2.8, 0, -0.3],
      upperarm_r: [-2.8, 0, 0.3],
      lowerarm_l: [-0.2, 0, 0],
      lowerarm_r: [-0.2, 0, 0],
    }),
  ];
}
