import type { TeamData } from "../../game/teams/types";
import { useState } from "react";
import { TEAMS } from "../../game/teams";
import { moveTeam } from "../../game/teams/selection";
import { chooseKits } from "../../game/teams/kits";
import { useMenuNavigation } from "../../hooks/useMenuNavigation";
import { KitJersey } from "./KitJersey";

export function TeamSelect({
  teams = TEAMS,
  enabled,
  onStart,
  onBack,
}: {
  teams?: TeamData[];
  enabled: boolean;
  onStart: (home: number, away: number) => void;
  onBack: () => void;
}) {
  const [home, setHome] = useState(0),
    [away, setAway] = useState(1),
    [side, setSide] = useState<"home" | "away">("home");
  const index = side === "home" ? home : away;
  const confirm = () => {
    if (side === "home") {
      if (away === home) setAway((home + 1) % teams.length);
      setSide("away");
    } else onStart(home, away);
  };
  useMenuNavigation(enabled, (action) => {
    if (action === "back") {
      if (side === "away") setSide("home");
      else onBack();
      return;
    }
    if (action === "confirm") {
      confirm();
      return;
    }
    const delta = { left: -1, right: 1, up: -5, down: 5 }[action];
    (side === "home" ? setHome : setAway)((i) =>
      moveTeam(i, delta, side === "away" ? home : null),
    );
  });
  const kits = chooseKits(teams[home], teams[away]);
  return (
    <section className="selection-screen">
      <div className="section-top">
        <div>
          <p className="eyebrow">PARTIDO RÁPIDO · 11 CONTRA 11</p>
          <h2>ELIGE TU SELECCIÓN</h2>
        </div>
        <button className="quiet-button" onClick={onBack}>
          ← Volver
        </button>
      </div>
      <div className="matchup">
        <div className={side === "home" ? "active-side" : ""}>
          <span>TÚ {side === "away" ? "✓" : ""}</span>
          <strong>{teams[home].name}</strong>
        </div>
        <b>VS</b>
        <div className={side === "away" ? "active-side" : ""}>
          <span>CPU</span>
          <strong>{teams[away].name}</strong>
        </div>
      </div>
      <div
        className="team-grid"
        role="group"
        aria-label={`Selecciona equipo ${side === "home" ? "local" : "rival"}`}
      >
        {teams.map((team, i) => {
          const selected = i === index,
            disabled = side === "away" && i === home;
          const rating = Math.round(
            team.players.reduce((sum, p) => sum + p.ratings.ovr, 0) /
              team.players.length,
          );
          const kit =
            side === "away" && selected
              ? kits.away
              : side === "home" && selected
                ? kits.home
                : side === "away"
                  ? team.awayKit
                  : team.kit;
          return (
            <button
              key={team.abbr}
              disabled={disabled}
              aria-pressed={selected}
              className={`team-card ${selected ? "selected" : ""}`}
              onClick={() => {
                (side === "home" ? setHome : setAway)(i);
              }}
              onDoubleClick={() => {
                if (i === index) confirm();
              }}
            >
              <span className="team-abbr">{team.abbr}</span>
              <span className="team-rating">
                {rating}
                <small>OVR</small>
              </span>
              <KitJersey kit={kit} />
              <strong>{team.name}</strong>
            </button>
          );
        })}
      </div>
      <div className="selection-footer">
        <p>
          {side === "home"
            ? "1 / 2 · Selecciona tu equipo"
            : "2 / 2 · Selecciona el rival"}
          <br />
          <span>Flechas / stick · Enter / A para confirmar</span>
        </p>
        <button className="primary-button" onClick={confirm}>
          {side === "home" ? "CONFIRMAR EQUIPO →" : "JUGAR PARTIDO →"}
        </button>
      </div>
    </section>
  );
}
