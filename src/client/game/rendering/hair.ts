import * as THREE from "three";
import type { PlayerCustomization } from "../customization/profile";

/** Head-space hair shell. The front hairline stays above the eyes; the sides and
 * back cover the scalp. The former flattened sphere ended below the skull top. */
export function hairGeometry(style: PlayerCustomization["hairStyle"]) {
  if (style === "mohawk") {
    const crest = new THREE.BoxGeometry(0.055, 0.15, 0.19);
    crest.translate(0, 0.16, 0);
    return crest;
  }
  const geometry = new THREE.SphereGeometry(
    1,
    24,
    12,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.9,
  );
  const positions = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < positions.count; i++) {
    const phi = uv.getX(i) * Math.PI * 2;
    const front = Math.max(0, Math.sin(phi));
    const back = Math.max(0, -Math.sin(phi));
    const extent =
      Math.PI * (0.5 - 0.11 * front + (style === "long" ? 0.36 : 0.13) * back);
    const theta = (1 - uv.getY(i)) * extent;
    const curls =
      style === "curly"
        ? 0.009 * (1 + Math.sin(phi * 8) * Math.sin(theta * 12))
        : 0;
    positions.setXYZ(
      i,
      -(0.112 + curls) * Math.cos(phi) * Math.sin(theta),
      (0.145 + curls) * Math.cos(theta),
      (0.124 + curls) * Math.sin(phi) * Math.sin(theta),
    );
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
