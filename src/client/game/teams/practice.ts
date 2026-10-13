import type { TeamData } from "./types";

export function practiceTeams(
  home: TeamData,
  away: TeamData,
): [TeamData, TeamData] {
  const keeper = home.players.find((p) => p.role === "GK")!;
  const attackers = home.players.filter((p) => p.role === "ST").slice(0, 2);
  const midfield = home.players.filter((p) => p.role === "MF").slice(0, 2);
  const selected = [keeper, ...midfield, ...attackers];
  for (const p of home.players)
    if (selected.length < 5 && !selected.includes(p)) selected.push(p);
  return [
    { ...home, players: selected, kickoffFwd: selected.length - 1 },
    {
      ...away,
      players: [away.players.find((p) => p.role === "GK")!],
      kickoffFwd: 0,
    },
  ];
}
