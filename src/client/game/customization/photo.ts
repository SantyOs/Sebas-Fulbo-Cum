import type { SquadPlayer } from "../teams/types";

export interface FacePhoto {
  source: string;
  scale: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
}
export const MAX_FACE_PHOTO = 180_000;
export const MAX_FACE_PHOTOS = 1_200_000;
export const yennyPhoto = (): FacePhoto => ({
  source: "builtin:yenny",
  scale: 2.7,
  offsetX: 0.51,
  offsetY: 0.34,
  opacity: 1,
});
export function normalizePhoto(value: unknown): FacePhoto | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== "object") return undefined;
  const p = value as Record<string, unknown>;
  if (
    typeof p.source !== "string" ||
    (p.source !== "builtin:yenny" &&
      (p.source.length > MAX_FACE_PHOTO ||
        !/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i.test(
          p.source,
        )))
  )
    return undefined;
  const clamp = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.max(min, Math.min(max, v))
      : fallback;
  return {
    source: p.source,
    scale: clamp(p.scale, 0.5, 6, 1),
    offsetX: clamp(p.offsetX, 0, 1, 0.5),
    offsetY: clamp(p.offsetY, 0, 1, 0.5),
    opacity: clamp(p.opacity, 0, 1, 1),
  };
}
export function effectivePhoto(
  p: Pick<SquadPlayer, "custom" | "cast">,
): FacePhoto | null {
  return p.custom?.photo !== undefined
    ? (normalizePhoto(p.custom.photo) ?? null)
    : p.cast?.facePhoto === "yenny"
      ? yennyPhoto()
      : null;
}
export const photoUrl = (source: string) =>
  source === "builtin:yenny"
    ? `${import.meta.env.BASE_URL}assets/faces/yenny.jpg`
    : source;
