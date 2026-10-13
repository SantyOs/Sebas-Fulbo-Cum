import { useState } from "react";
import { useMenuNavigation } from "../../hooks/useMenuNavigation";
export function PauseMenu({
  reason,
  finished,
  onResume,
  onRestart,
  onSettings,
  onMenu,
}: {
  reason: string;
  finished: boolean;
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onMenu: () => void;
}) {
  const [index, setIndex] = useState(0);
  const options = finished
    ? ([
        ["REVANCHA", onRestart],
        ["MENÚ PRINCIPAL", onMenu],
      ] as const)
    : ([
        ["CONTINUAR", onResume],
        ["REINICIAR PARTIDO", onRestart],
        ["AJUSTES", onSettings],
        ["MENÚ PRINCIPAL", onMenu],
      ] as const);
  useMenuNavigation(true, (action) => {
    if (action === "confirm") options[index]?.[1]();
    else if (action === "back" && !finished) onResume();
    else if (action === "up" || action === "left")
      setIndex((i) => (i - 1 + options.length) % options.length);
    else if (action === "down" || action === "right")
      setIndex((i) => (i + 1) % options.length);
  });
  return (
    <div className="modal-backdrop">
      <div
        className="pause-panel"
        role="dialog"
        aria-modal="true"
        aria-label={finished ? "Fin del partido" : "Partido en pausa"}
      >
        <p className="eyebrow">WORLD CUP 2026</p>
        <h2>{finished ? "FINAL DEL PARTIDO" : "PAUSA"}</h2>
        <p className="muted">{reason}</p>
        <div className="mode-buttons">
          {options.map(([label, action], i) => (
            <button
              key={label}
              className={i === index ? "selected" : ""}
              onFocus={() => setIndex(i)}
              onMouseEnter={() => setIndex(i)}
              onClick={action}
            >
              <strong>{label}</strong>
              <b>→</b>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
