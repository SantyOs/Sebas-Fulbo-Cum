import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";

/** Presentation-only props for the winning finale. Each builder owns its
 *  geometries/materials and returns a dispose that releases them. */
export interface Prop {
  root: THREE.Group;
  dispose(): void;
}

function tracker() {
  const geometries: THREE.BufferGeometry[] = [],
    materials: THREE.Material[] = [];
  return {
    g<T extends THREE.BufferGeometry>(geometry: T) {
      geometries.push(geometry);
      return geometry;
    },
    m<T extends THREE.Material>(material: T) {
      materials.push(material);
      return material;
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

/** Low-poly World Cup style trophy, about 0.36 m tall, base at y = 0. */
export function buildTrophy(env?: THREE.Texture): Prop {
  const t = tracker(),
    root = new THREE.Group();
  const gold = t.m(
    new THREE.MeshStandardMaterial({
      color: "#e7b43c",
      metalness: 0.85,
      roughness: 0.28,
      envMap: env ?? null,
      flatShading: true,
    }),
  );
  const malachite = t.m(
    new THREE.MeshStandardMaterial({ color: "#1f7a4a", roughness: 0.5 }),
  );
  const ring = (y: number, r: number, h: number) => {
    const band = new THREE.Mesh(
      t.g(new THREE.CylinderGeometry(r, r, h, 14)),
      malachite,
    );
    band.position.y = y;
    root.add(band);
  };
  const base = new THREE.Mesh(
    t.g(
      new THREE.LatheGeometry(
        [
          [0, 0],
          [0.07, 0],
          [0.07, 0.012],
          [0.064, 0.07],
          [0.06, 0.072],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        14,
      ),
    ),
    gold,
  );
  root.add(base);
  ring(0.03, 0.068, 0.016);
  ring(0.055, 0.066, 0.012);
  // Two figures spiral up to the globe; a twisted lathe keeps it one draw.
  const body = t.g(
    new THREE.LatheGeometry(
      [
        [0.058, 0.07],
        [0.045, 0.11],
        [0.034, 0.17],
        [0.042, 0.22],
        [0.062, 0.26],
        [0.07, 0.28],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      10,
    ),
  );
  const p = body.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i),
      a = (y - 0.07) * 9,
      x = p.getX(i),
      z = p.getZ(i);
    p.setXYZ(
      i,
      x * Math.cos(a) - z * Math.sin(a),
      y,
      x * Math.sin(a) + z * Math.cos(a),
    );
  }
  body.computeVertexNormals();
  root.add(new THREE.Mesh(body, gold));
  const globe = new THREE.Mesh(t.g(new THREE.IcosahedronGeometry(0.068, 1)), gold);
  globe.position.y = 0.31;
  root.add(globe);
  root.traverse((o) => (o.castShadow = true));
  return { root, dispose: t.dispose };
}

/** DualShock style pad, 0.16 m wide, facing +z, centred at the origin. */
export function buildController(): Prop {
  const t = tracker(),
    root = new THREE.Group();
  const shell = t.m(
    new THREE.MeshStandardMaterial({ color: "#1b1e25", roughness: 0.55 }),
  );
  const shape = new THREE.Shape();
  shape.moveTo(-0.05, 0.035);
  shape.lineTo(0.05, 0.035);
  shape.quadraticCurveTo(0.08, 0.035, 0.08, 0.01);
  shape.lineTo(0.075, -0.045);
  shape.quadraticCurveTo(0.07, -0.07, 0.05, -0.062);
  shape.lineTo(0.032, -0.03);
  shape.lineTo(-0.032, -0.03);
  shape.lineTo(-0.05, -0.062);
  shape.quadraticCurveTo(-0.07, -0.07, -0.075, -0.045);
  shape.lineTo(-0.08, 0.01);
  shape.quadraticCurveTo(-0.08, 0.035, -0.05, 0.035);
  const body = t.g(
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.022,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.005,
      bevelSegments: 2,
      curveSegments: 6,
    }),
  );
  body.translate(0, 0, -0.011);
  root.add(new THREE.Mesh(body, shell));
  const front = 0.018;
  const add = (
    geometry: THREE.BufferGeometry,
    color: string,
    x: number,
    y: number,
    emissive = 0,
  ) => {
    const mesh = new THREE.Mesh(
      t.g(geometry),
      t.m(
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.4,
          emissive: emissive ? color : "#000",
          emissiveIntensity: emissive,
        }),
      ),
    );
    mesh.position.set(x, y, front);
    mesh.rotation.x = Math.PI / 2;
    root.add(mesh);
    return mesh;
  };
  const stick = () => new THREE.CylinderGeometry(0.011, 0.011, 0.01, 10);
  add(stick(), "#3a3f4a", -0.026, -0.016);
  add(stick(), "#3a3f4a", 0.026, -0.016);
  const button = () => new THREE.CylinderGeometry(0.0065, 0.0065, 0.006, 8);
  add(button(), "#48d6c4", 0.054, 0.02, 0.35);
  add(button(), "#ff6670", 0.066, 0.008, 0.35);
  add(button(), "#7aa8ff", 0.054, -0.004, 0.35);
  add(button(), "#f08fe0", 0.042, 0.008, 0.35);
  for (const [x, y, w, h] of [
    [-0.054, 0.019, 0.007, 0.012],
    [-0.054, -0.003, 0.007, 0.012],
    [-0.066, 0.008, 0.012, 0.007],
    [-0.042, 0.008, 0.012, 0.007],
  ])
    add(new THREE.BoxGeometry(w, 0.005, h), "#2c313b", x, y);
  add(new THREE.BoxGeometry(0.05, 0.004, 0.03), "#262a33", 0, 0.014);
  const bar = add(new THREE.BoxGeometry(0.044, 0.004, 0.005), "#3aa0ff", 0, 0.034, 1.4);
  bar.position.z = 0.002;
  bar.position.y = 0.041;
  root.traverse((o) => (o.castShadow = true));
  return { root, dispose: t.dispose };
}

export const GRINCH_HEAD = 2.1;
/** Baby Grinch built on the same Quaternius rig as the players: oversized head,
 *  striped pyjama, fuzzy hair spikes and glossy reborn eyes. Skinned clone with
 *  its own materials; the shared GLB geometry is never modified. */
export function buildGrinch(model: THREE.Object3D): Prop & { body: THREE.Object3D } {
  const t = tracker(),
    root = new THREE.Group();
  const body = clone(model);
  body.scale.set(0.58, 0.46, 0.58);
  root.add(body);
  const skin = new THREE.Color("#b9c24c");
  const pyjama = t.m(
    new THREE.MeshStandardMaterial({ color: skin, roughness: 0.85 }),
  );
  pyjama.onBeforeCompile = (shader) => {
    shader.uniforms.skinColor = { value: skin };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vKit;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvKit = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vKit; uniform vec3 skinColor;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      float y = vKit.y, x = abs(vKit.x);
      vec3 red = vec3(0.78,0.09,0.11), white = vec3(0.95,0.93,0.9), cuff = vec3(0.07,0.42,0.16);
      if (y < 1.53 && x < 0.66) {
        diffuseColor.rgb = mod(floor((x > 0.3 ? x : y) / 0.06), 2.0) < 1.0 ? red : white;
        if (y > 1.47 && x < 0.16) diffuseColor.rgb = cuff;
        if (x > 0.6) diffuseColor.rgb = cuff;
        if (y < 0.1) diffuseColor.rgb = red;
      } else diffuseColor.rgb = skinColor;
    `,
      );
  };
  pyjama.customProgramCacheKey = () => "grinch-pyjama-v1";
  const eyes = t.m(
    new THREE.MeshStandardMaterial({ color: "#1a120c", roughness: 0.12 }),
  );
  const fur = t.m(
    new THREE.MeshStandardMaterial({
      color: "#5fbf2f",
      roughness: 1,
      flatShading: true,
    }),
  );
  body.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const name = o.name.toLowerCase();
    // The rig's own brows read as a frown; the reborn face adds softer ones.
    if (name.includes("eyebrow")) o.visible = false;
    o.material = name.includes("eyes") ? eyes : pyjama;
    o.castShadow = true;
    o.frustumCulled = false;
  });
  body.updateMatrixWorld(true);
  const head = body.getObjectByName("Head")!;
  // Hair: random-but-fixed spikes over the crown, merged into one draw.
  const spikes: THREE.BufferGeometry[] = [];
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // Wild fluffy tufts all round, except over the face.
  for (let i = 0; i < 120; i++) {
    const theta = rand() * Math.PI * 2,
      phi = rand() * 1.75;
    const dir = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi) + 0.25,
      Math.sin(phi) * Math.sin(theta) - 0.2,
    ).normalize();
    if (dir.z > 0.35 && dir.y < 0.75) continue;
    const len = (0.05 + rand() * 0.12) * (dir.y > 0.6 ? 1.15 : 1);
    const cone = new THREE.ConeGeometry(0.012 + rand() * 0.012, len, 4);
    cone.translate(0, len / 2, 0);
    // Tufts droop a little: blend the direction towards the side/down.
    const droop = dir.clone().lerp(new THREE.Vector3(dir.x, -0.2, dir.z), 0.25 * (1 - dir.y)).normalize();
    cone.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), droop),
    );
    cone.translate(dir.x * 0.1, 0.04 + dir.y * 0.09, dir.z * 0.1 - 0.015);
    spikes.push(cone);
  }
  const scalp = new THREE.IcosahedronGeometry(0.118, 1);
  scalp.scale(1, 0.9, 1);
  scalp.translate(0, 0.045, -0.025);
  spikes.push(scalp);
  for (const side of [-1, 1]) {
    const ear = new THREE.ConeGeometry(0.025, 0.09, 4);
    ear.rotateZ(side * -1.25);
    ear.translate(side * 0.12, 0.03, -0.01);
    spikes.push(ear);
  }
  const crown = new THREE.Group();
  const flat = spikes.map((g) => (g.index ? g.toNonIndexed() : g));
  const hair = new THREE.Mesh(t.g(mergeGeometries(flat)), fur);
  new Set([...spikes, ...flat]).forEach((g) => g.dispose());
  hair.castShadow = true;
  crown.add(hair);
  // Reborn face: big glossy eyes with a catchlight, button nose, pouty lip.
  const part = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
  ) => {
    const mesh = new THREE.Mesh(t.g(geometry), material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    crown.add(mesh);
  };
  const skinMat = t.m(
    new THREE.MeshStandardMaterial({ color: "#a9b043", roughness: 0.8 }),
  );
  const shine = t.m(new THREE.MeshBasicMaterial({ color: "#fffdf2" }));
  for (const x of [-1, 1]) {
    part(new THREE.SphereGeometry(0.021, 16, 12), eyes, x * 0.036, 0.006, 0.088, 1, 1.05, 0.75);
    part(new THREE.SphereGeometry(0.005, 6, 4), shine, x * 0.036 + 0.007, 0.014, 0.103);
    const brow = new THREE.BoxGeometry(0.034, 0.006, 0.01);
    brow.rotateZ(x * 0.22);
    part(brow, fur, x * 0.037, 0.038, 0.094);
  }
  for (const x of [-1, 1])
    part(new THREE.SphereGeometry(0.03, 10, 8), skinMat, x * 0.042, -0.03, 0.066, 1, 0.8, 0.7);
  part(new THREE.SphereGeometry(0.011, 8, 6), skinMat, 0, -0.016, 0.104, 1.2, 0.8, 1);
  part(new THREE.SphereGeometry(0.016, 10, 6), skinMat, 0, -0.045, 0.094, 1.6, 0.6, 0.8);
  // Same attachment as player hair: model-space pose expressed in bone space.
  head.updateWorldMatrix(true, false);
  crown.position.copy(
    head.worldToLocal(body.localToWorld(new THREE.Vector3(0, 1.69, -0.01))),
  );
  crown.quaternion.copy(head.getWorldQuaternion(new THREE.Quaternion()).invert());
  head.add(crown);
  head.scale.setScalar(GRINCH_HEAD);
  return {
    root,
    body,
    dispose() {
      t.dispose();
      body.traverse((o) => {
        if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
      });
    },
  };
}
