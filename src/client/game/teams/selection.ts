import { TEAMS } from "./index";
export function moveTeam(
  index: number,
  offset: number,
  excluded: number | null,
) {
  let next = (index + offset + TEAMS.length) % TEAMS.length;
  if (next === excluded)
    next = (next + (offset < 0 ? -1 : 1) + TEAMS.length) % TEAMS.length;
  return next;
}
