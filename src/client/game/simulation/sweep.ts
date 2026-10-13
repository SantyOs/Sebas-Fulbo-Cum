import type { Vec } from "../types";

/** Earliest segment-circle contact, including a segment starting inside. */
export function sweepCircle(
  start: Vec,
  end: Vec,
  center: Vec,
  radius: number,
): number | null {
  const dx = end.x - start.x,
    dy = end.y - start.y;
  const ox = start.x - center.x,
    oy = start.y - center.y;
  const c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a < 1e-12) return null;
  const b = 2 * (ox * dx + oy * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}
