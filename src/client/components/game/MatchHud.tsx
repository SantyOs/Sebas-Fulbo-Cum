import type { HudState } from "../../game/types";
import type { TeamData } from "../../game/teams/types";
export function MatchHud({
  hud,
  home,
  away,
  practice,
}: {
  hud: HudState;
  home: TeamData;
  away: TeamData;
  practice: boolean;
}) {
  const minute = Math.floor(hud.clock / 60),
    second = String(hud.clock % 60).padStart(2, "0");
  return (
    <div className="match-hud" aria-live="off">
      {practice ? (
        <div className="practice-badge">
          ENTRENAMIENTO · {hud.homeScore} GOLES
        </div>
      ) : (
        <div className="scoreboard">
          <span style={{ borderColor: home.color }}>{home.abbr}</span>
          <b>
            {hud.homeScore} <i>—</i> {hud.awayScore}
          </b>
          <span style={{ borderColor: away.color }}>{away.abbr}</span>
          <time>
            {minute}:{second}
          </time>
        </div>
      )}
      {hud.message && (
        <div
          className={`match-message ${hud.message.includes("FULL TIME") ? "full-time" : ""}`}
        >
          {hud.message}
        </div>
      )}
      {hud.homePlayer && (
        <div className="player-tag home">
          <small>TÚ · {hud.homePlayer.num}</small>
          <strong>{hud.homePlayer.name}</strong>
          <div className="power-track">
            <div
              style={{
                width: `${(hud.charge ?? 0) * 100}%`,
                opacity: hud.charge === null ? 0 : 1,
              }}
            />
          </div>
        </div>
      )}
      {hud.awayPlayer && (
        <div className="player-tag away">
          <small>CPU · {hud.awayPlayer.num}</small>
          <strong>{hud.awayPlayer.name}</strong>
        </div>
      )}
    </div>
  );
}
