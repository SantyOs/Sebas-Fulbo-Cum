import type { FaceShape } from "./profile";
/** Local bind-space facial sculpting; each customized mesh owns its vertex copy. */
export function sculptFace(
  x: number,
  y: number,
  z: number,
  face: FaceShape,
): [number, number, number] {
  if (y < 1.52 || y > 1.81 || Math.abs(x) > 0.18) return [x, y, z];
  const gaussian = (center: number, width: number, value: number) =>
    Math.exp(-(((value - center) / width) ** 2));
  const front = Math.max(0, Math.min(1, (z - 0.015) / 0.05));
  const lower = gaussian(1.575, 0.043, y),
    cheek = gaussian(1.655, 0.04, y);
  let nx =
    x * (1 + (face.jaw - 1) * lower * 0.65 + (face.cheeks - 1) * cheek * 0.4);
  let ny = y - (face.chin - 1) * 0.042 * lower;
  let nz = z;
  const nose = gaussian(0, 0.026, x) * gaussian(1.665, 0.025, y) * front;
  nx += x * (face.noseWidth - 1) * nose;
  nz += (face.noseLength - 1) * 0.045 * nose;
  const eye =
    gaussian(0.043, 0.027, Math.abs(x)) * gaussian(1.697, 0.023, y) * front;
  nx += Math.sign(x) * 0.025 * (face.eyeSpacing - 1) * eye;
  ny += (y - 1.697) * (face.eyeSize - 1) * eye;
  const mouth = gaussian(0, 0.04, x) * gaussian(1.621, 0.014, y) * front;
  nx += x * (face.mouthWidth - 1) * mouth;
  nz += (face.lips - 1) * 0.025 * mouth;
  const ear = gaussian(0.103, 0.024, Math.abs(x)) * gaussian(1.675, 0.04, y);
  nx += Math.sign(x) * 0.03 * (face.ears - 1) * ear;
  return [nx, ny, nz];
}
