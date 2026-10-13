import type { Kit, TeamData } from "../teams/types";

function rgb(hex: string) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}
function difference(a: string, b: string) {
  const x = rgb(a),
    y = rgb(b);
  return Math.hypot(...x.map((v, i) => v - y[i]));
}
export function chooseKits(
  home: TeamData,
  away: TeamData,
): { home: Kit; away: Kit } {
  const combinations = [
    { home: home.kit, away: away.awayKit },
    { home: home.kit, away: away.kit },
    { home: home.awayKit, away: away.kit },
    { home: home.awayKit, away: away.awayKit },
  ];
  const score = (k: { home: Kit; away: Kit }) =>
    difference(k.home.shirt, k.away.shirt) * 2 +
    difference(k.home.shorts ?? k.home.sleeve, k.away.shorts ?? k.away.sleeve) *
      0.3;
  const preferred = combinations[0];
  if (difference(preferred.home.shirt, preferred.away.shirt) > 0.65)
    return preferred;
  return combinations.sort((a, b) => score(b) - score(a))[0];
}
