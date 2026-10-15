import { useStartButton } from "../../hooks/useMenuNavigation";

/** Broadcast layer over the 3D winning finale. Its CSS timeline mirrors
 *  rendering/finale.ts and freezes with the game; Enter skips to the menu. */
export function Finale({
  player,
  score,
  dedication,
  paused,
  onDone,
}: {
  player: string;
  score: string;
  dedication: string;
  paused: boolean;
  onDone: () => void;
}) {
  useStartButton(!paused, onDone);
  return (
    <div
      className={`finale${paused ? " finale-paused" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="finale-flash" aria-hidden="true" />
      <div className="finale-bar finale-bar-top" aria-hidden="true" />
      <div className="finale-bar finale-bar-bottom" aria-hidden="true" />
      <div className="finale-fulltime">
        <b>FINAL DEL PARTIDO</b>
        {score}
      </div>
      <div className="finale-champ">
        <span className="finale-kicker">WORLD CUP 2026</span>
        <strong>¡CAMPEONES!</strong>
        <span className="finale-name">{player.toUpperCase()}</span>
        <p>{dedication}</p>
      </div>
      <span className="finale-press">PULSA START</span>
    </div>
  );
}
