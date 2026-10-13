import type { Ratings, SquadPlayer, TeamData } from "../teams/types";
import { makeRatings } from "../teams/types";
import { HAIR_COLORS, SKIN_TONES } from "../constants";
export const HAIRSTYLES = ["short", "curly", "mohawk", "long", "bald"] as const;
export const CELEBRATIONS = ["classic", "dance", "dab", "heart"] as const;
export const SOUNDS = ["fanfare", "party", "stadium", "none"] as const;
export interface FaceShape {
  jaw: number;
  chin: number;
  noseWidth: number;
  noseLength: number;
  eyeSpacing: number;
  eyeSize: number;
  mouthWidth: number;
  lips: number;
  ears: number;
  cheeks: number;
}
export const defaultFace = (): FaceShape => ({
  jaw: 1,
  chin: 1,
  noseWidth: 1,
  noseLength: 1,
  eyeSpacing: 1,
  eyeSize: 1,
  mouthWidth: 1,
  lips: 1,
  ears: 1,
  cheeks: 1,
});
export interface PlayerCustomization {
  face: FaceShape;
  name: string;
  num: number;
  skin: string;
  hairColor: string;
  eyeColor: string;
  hairStyle: (typeof HAIRSTYLES)[number];
  beard: boolean;
  height: number;
  build: number;
  headSize: number;
  boots: string;
  wristband: string;
  ratings: Pick<Ratings, "pac" | "sho" | "pas" | "dri" | "def" | "phy">;
  celebration: {
    style: (typeof CELEBRATIONS)[number];
    speed: number;
    spin: number;
    jump: number;
    sound: string;
    volume: number;
    confetti: boolean;
  };
}
export interface BirthdayProfile {
  version: 1;
  recipient: string;
  dedication: string;
  cameraZoom: number;
  volume: number;
  players: Record<string, PlayerCustomization>;
  sounds: Record<string, { name: string; data: string }>;
}
export const defaultProfile = (): BirthdayProfile => ({
  version: 1,
  recipient: "Sebastian",
  dedication: "¡Feliz cumpleaños, Sebastian! Este partido es para ti.",
  cameraZoom: 1.18,
  volume: 0.65,
  players: {},
  sounds: {},
});
export const playerKey = (team: TeamData, player: SquadPlayer) =>
  `${team.abbr}:${player.sourceId ?? player.num}`;
export function defaultPlayer(
  team: TeamData,
  p: SquadPlayer,
): PlayerCustomization {
  const i = team.players.indexOf(p);
  return {
    face: defaultFace(),
    name: p.name,
    num: p.num,
    skin: SKIN_TONES[Math.max(0, i) % SKIN_TONES.length],
    hairColor: HAIR_COLORS[Math.max(0, i) % HAIR_COLORS.length],
    eyeColor: "#504c38",
    hairStyle: "short",
    beard: false,
    height: 1.8,
    build: 1,
    headSize: 1,
    boots: "#202734",
    wristband: "#ffffff",
    ratings: { ...p.ratings },
    celebration: {
      style: "classic",
      speed: 1,
      spin: 0,
      jump: 0.15,
      sound: "fanfare",
      volume: 0.8,
      confetti: true,
    },
  };
}
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const number = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
const text = (value: unknown, max: number, fallback: string) =>
  typeof value === "string"
    ? value.replace(/[\u0000-\u001f]/g, "").slice(0, max)
    : fallback;
const color = (value: unknown, fallback: string) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
export function normalizeProfile(
  value: unknown,
  teams: readonly TeamData[],
): BirthdayProfile {
  const source = object(value),
    result = defaultProfile(),
    players = object(source.players);
  result.recipient = text(source.recipient, 40, result.recipient);
  result.dedication = text(source.dedication, 180, result.dedication);
  result.cameraZoom = number(source.cameraZoom, 1, 1.4, result.cameraZoom);
  result.volume = number(source.volume, 0, 1, result.volume);
  let total = 0;
  for (const [key, v] of Object.entries(object(source.sounds)).slice(0, 4)) {
    const sound = object(v);
    if (
      !/^custom-[a-z0-9-]{1,60}$/i.test(key) ||
      typeof sound.data !== "string" ||
      !/^data:audio\/(mpeg|mp3|wav|x-wav|ogg|webm);base64,[a-z0-9+/=]+$/i.test(
        sound.data,
      ) ||
      sound.data.length > 1_400_000
    )
      continue;
    total += sound.data.length;
    if (total > 2_800_000) continue;
    result.sounds[key] = {
      name: text(sound.name, 60, "Mi sonido"),
      data: sound.data,
    };
  }
  for (const team of teams) {
    const used = new Set<number>();
    for (const p of team.players) {
      const key = playerKey(team, p),
        raw = players[key];
      if (!raw) continue;
      const d = defaultPlayer(team, p),
        v = object(raw),
        c = object(v.celebration),
        r = object(v.ratings),
        f = object(v.face);
      const saved: PlayerCustomization = {
        ...d,
        name: text(v.name, 24, d.name).trim() || d.name,
        num: Math.round(number(v.num, 1, 99, d.num)),
        skin: color(v.skin, d.skin),
        hairColor: color(v.hairColor, d.hairColor),
        eyeColor: color(v.eyeColor, d.eyeColor),
        boots: color(v.boots, d.boots),
        wristband: color(v.wristband, d.wristband),
        hairStyle: HAIRSTYLES.includes(v.hairStyle as never)
          ? (v.hairStyle as PlayerCustomization["hairStyle"])
          : d.hairStyle,
        beard: v.beard === true,
        height: number(v.height, 1.55, 2.1, d.height),
        build: number(v.build, 0.75, 1.3, d.build),
        headSize: number(v.headSize, 0.85, 1.15, 1),
        ratings: { ...d.ratings },
        celebration: {
          style: CELEBRATIONS.includes(c.style as never)
            ? (c.style as PlayerCustomization["celebration"]["style"])
            : "classic",
          speed: number(c.speed, 0.6, 1.8, 1),
          spin: number(c.spin, 0, 1, 0),
          jump: number(c.jump, 0, 0.6, 0.15),
          sound:
            typeof c.sound === "string" &&
            (SOUNDS.includes(c.sound as never) || result.sounds[c.sound])
              ? c.sound
              : "fanfare",
          volume: number(c.volume, 0, 1, 0.8),
          confetti: c.confetti !== false,
        },
      };
      saved.face = defaultFace();
      for (const feature of Object.keys(saved.face) as (keyof FaceShape)[])
        saved.face[feature] = number(f[feature], 0.65, 1.35, 1);
      for (const attr of ["pac", "sho", "pas", "dri", "def", "phy"] as const)
        saved.ratings[attr] = Math.round(
          number(r[attr], 1, 99, d.ratings[attr]),
        );
      // Reserve untouched squad numbers too; never silently create duplicate shirts.
      const reserved = team.players
        .filter((other) => other !== p && !players[playerKey(team, other)])
        .map((other) => other.num);
      if (used.has(saved.num) || reserved.includes(saved.num))
        saved.num = Array.from({ length: 99 }, (_, i) => i + 1).find(
          (n) => !used.has(n) && !reserved.includes(n),
        )!;
      used.add(saved.num);
      result.players[key] = saved;
    }
  }
  return result;
}
export function customizeTeams(
  teams: readonly TeamData[],
  profile: BirthdayProfile,
): TeamData[] {
  return teams.map((team) => ({
    ...team,
    players: team.players.map((p) => {
      const custom = profile.players[playerKey(team, p)];
      if (!custom) return p;
      const r = custom.ratings;
      return {
        ...p,
        sourceId: p.sourceId ?? p.num,
        name: custom.name,
        num: custom.num,
        custom,
        ratings: makeRatings(p.role, [
          r.pac,
          r.sho,
          r.pas,
          r.dri,
          r.def,
          r.phy,
        ]),
      };
    }),
  }));
}
const KEY = "wc2026.birthday.v1";
export function loadProfile(teams: readonly TeamData[]): BirthdayProfile {
  try {
    return normalizeProfile(
      JSON.parse(localStorage.getItem(KEY) ?? "null"),
      teams,
    );
  } catch {
    return defaultProfile();
  }
}
export function saveProfile(profile: BirthdayProfile) {
  localStorage.setItem(KEY, JSON.stringify(profile));
}
