import { useState } from "react";
import { useMenuNavigation } from "../../hooks/useMenuNavigation";
export function IntroMenu({
  enabled,
  onStart,
  onSettings,
  onCustomize,
  recipient,
  dedication,
}: {
  recipient: string;
  dedication: string;
  onCustomize: () => void;
  enabled: boolean;
  onStart: (practice: boolean) => void;
  onSettings: () => void;
}) {
  const [index, setIndex] = useState(0);
  const actions = [
    () => onStart(false),
    () => onStart(true),
    onCustomize,
    onSettings,
  ];
  useMenuNavigation(enabled, (action) => {
    if (action === "confirm") actions[index]();
    else if (action === "up" || action === "left") setIndex((i) => (i + 3) % 4);
    else if (action === "down" || action === "right")
      setIndex((i) => (i + 1) % 4);
  });
  return (
    <section className="intro-screen">
      <div className="intro-copy">
        <p className="eyebrow">EL FÚTBOL VUELVE A SER FÚTBOL</p>
        <h2>
          ¡FELIZ CUMPLEAÑOS!
          <br />
          <em>{recipient || "ESTE ES TU PARTIDO"}</em>
        </h2>
        <p className="intro-description">{dedication}</p>
        <div className="mode-buttons">
          {[
            ["PARTIDO RÁPIDO", "Elige tu selección · 11 contra 11"],
            ["ENTRENAMIENTO", "Pases, disparos y un portero a batir"],
            [
              "PERSONALIZAR REGALO",
              "Caras, jugadores, celebraciones y sonidos",
            ],
            ["AJUSTES", "Teclado, mando y gráficos"],
          ].map(([title, description], i) => (
            <button
              key={title}
              className={index === i ? "selected" : ""}
              onMouseEnter={() => setIndex(i)}
              onFocus={() => setIndex(i)}
              onClick={actions[i]}
            >
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <b>↗</b>
            </button>
          ))}
        </div>
        <p className="menu-help">
          ↑ ↓ Mover · Enter / A Confirmar · Teclado y mando
        </p>
      </div>
      <div className="intro-art" aria-hidden="true">
        <div className="stadium-lights" />
        <div className="pitch-drawing">
          <div className="pitch-circle" />
          <div className="pitch-half" />
          <div className="pitch-box left" />
          <div className="pitch-box right" />
        </div>
        <div className="season-number">26</div>
        <span className="edition-label">WORLD CUP / CLASSIC FOOTBALL</span>
      </div>
    </section>
  );
}
