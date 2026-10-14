import type { MatchSnapshot } from "../contracts";
import type { CastTraits, SquadPlayer, TeamData } from "../teams/types";
import { makeRatings, type RatingTuple } from "../teams/types";
import { CELEBRATIONS } from "./profile";

interface CastMember extends CastTraits {
  name: string;
  r?: RatingTuple;
}

/** Fixed office cast, assigned by side and formation slot whatever country is
 *  chosen. Index 9 is every team's kickoff striker. */
export const PLAYER_CAST: CastMember[] = [
  { name: "Random 1" },
  { name: "Santiago Osorio" },
  { name: "Daniel Gil" },
  { name: "Random 2" },
  { name: "Random 3" },
  { name: "Lucumi PriPra" },
  {
    name: "Maria Alejandra Osorio",
    refusesPasses: true,
    phrases: ["No sé, nunca me había pasado, primera vez que me pasa"],
  },
  { name: "Lilith" },
  { name: "Nelson Bedoya", phrases: ["¡Señores del jurado!"] },
  {
    name: "Sebastian Londoño (C)",
    r: [90, 88, 88, 90, 62, 84],
    freeGoal: true,
  },
  { name: "Monica Bernal", monkeyBubble: true, still: true, passShare: 0.4 },
];

export const RIVAL_CAST: CastMember[] = [
  { name: "Linsed Blandon", phrases: ["Suban por favor"] },
  { name: "Liliana Queribin", phrases: ["Santi me ayuda porfa"] },
  { name: "Carolina Ospina", phrases: ["Es que un pago no me da"] },
  { name: "Diego Villada", phrases: ["Todo está aquí"] },
  { name: "Jader Montoya", phrases: ["Le voy a decir a Juan"] },
  { name: "Don Roge", phrases: ["¿Ya llamaron a SIESA?"] },
  { name: "Ana Maria Zapata", phrases: ["¿Qué es un dashboard?"] },
  { name: "Juan David Rodriguez", phrases: ["Joven, retroalimentación"] },
  {
    name: "Mario Carvajal",
    phrases: ["¿Joven me va a ayudar con una nota crédito?"],
  },
  {
    name: "Yenny Gomez",
    sound: "call",
    goalSound: "call",
    celebrationBonus: 2,
    finisher: true,
    facePhoto: "yenny",
    r: [86, 99, 76, 88, 40, 76],
  },
  {
    name: "Patricia De La Espriella",
    phrases: [
      "¡Mamertos hps!",
      "¡Paracos hps!",
      "¡Pa darles bala!",
      "¡Arriba la patria, Milagro!",
    ],
    passShare: 0.45,
  },
];

const withCast = (team: TeamData, cast: CastMember[]): TeamData => ({
  ...team,
  players: team.players.map((p, i): SquadPlayer => {
    const { name, r, ...traits } = cast[i] ?? { name: p.name };
    return {
      ...p,
      sourceId: p.sourceId ?? p.num,
      name: p.custom?.name ?? name,
      cast: {
        ...traits,
        celebrationStyle: CELEBRATIONS[i % CELEBRATIONS.length],
      },
      ratings: r && !p.custom ? makeRatings(p.role, r) : p.ratings,
    };
  }),
});

/** Home is always the player's office team, away always the rivals. */
export const applyCast = (home: TeamData, away: TeamData) =>
  [withCast(home, PLAYER_CAST), withCast(away, RIVAL_CAST)] as const;

export interface CastLine {
  playerId: string;
  text?: string;
  sound?: "call";
}

/** Presentation: consume pass receptions once and rotate each player's lines. */
export class CastLineCursor {
  private last = 0;
  private said = new Map<string, number>();
  consume(snapshot: MatchSnapshot): CastLine[] {
    const lines: CastLine[] = [];
    for (const event of snapshot.events) {
      if (event.id <= this.last) continue;
      this.last = event.id;
      if (
        (event.kind !== "contact" && event.kind !== "refusal") ||
        !event.fromId
      )
        continue;
      const player = snapshot.players.find((p) => p.id === event.playerId);
      const cast = player?.cast;
      if (!player || !cast || (!cast.phrases?.length && !cast.sound)) continue;
      const n = this.said.get(player.id) ?? 0;
      this.said.set(player.id, n + 1);
      lines.push({
        playerId: player.id,
        text: cast.phrases?.[n % cast.phrases.length],
        sound: cast.sound,
      });
    }
    return lines;
  }
}
