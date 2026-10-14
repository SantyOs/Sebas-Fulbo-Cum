import { useState } from "react";
import { useMenuNavigation, useStartButton } from "../../hooks/useMenuNavigation";
import { birthdayAudio } from "../../game/customization/audio";
import type { BirthdayProfile } from "../../game/customization/profile";
import { RetroBall, RetroLogo } from "./RetroLogo";

const OPTIONS = [
  ["PARTIDO AMISTOSO", "11 CONTRA 11 · 10 SELECCIONES"],
  ["ENTRENAMIENTO", "5 CONTRA EL PORTERO"],
  ["EDITAR JUGADORES", "CARAS · NOMBRES · FESTEJOS · SONIDOS"],
  ["OPCIONES", "CONTROLES · CÁMARA · VOLUMEN"],
] as const;

/** Retro title screen: only Enter or the gamepad Start opens the menu. */
export function IntroMenu({
  enabled,
  onStart,
  onSettings,
  onCustomize,
  profile,
}: {
  profile: BirthdayProfile;
  onCustomize: () => void;
  enabled: boolean;
  onStart: (practice: boolean) => void;
  onSettings: () => void;
}) {
  const [open, setOpen] = useState(false),
    [index, setIndex] = useState(0);
  const actions = [
    () => onStart(false),
    () => onStart(true),
    onCustomize,
    onSettings,
  ];
  const choose = (i: number) => {
    birthdayAudio.blip(profile, true);
    actions[i]();
  };
  const move = (delta: number) => {
    birthdayAudio.blip(profile);
    setIndex((i) => (i + delta + OPTIONS.length) % OPTIONS.length);
  };
  useStartButton(enabled && !open, () => {
    birthdayAudio.blip(profile, true);
    setOpen(true);
  });
  useMenuNavigation(enabled && open, (action) => {
    if (action === "confirm") choose(index);
    else if (action === "back") setOpen(false);
    else if (action === "up" || action === "left") move(-1);
    else move(1);
  });
  const name = (profile.recipient || "Sebastian").toUpperCase();
  return (
    <section className="retro-title">
      <div className="retro-stadium" aria-hidden="true">
        <span className="retro-tower left" />
        <span className="retro-tower right" />
        <span className="retro-crowd" />
        <span className="retro-pitch" />
      </div>
      <img
        className="retro-cover"
        src={`${import.meta.env.BASE_URL}assets/ads/sebas-v.jpg`}
        alt={name}
      />
      <RetroLogo name={profile.recipient} />
      {open ? (
        <nav className="retro-menu" aria-label="Menú principal">
          {OPTIONS.map(([title, detail], i) => (
            <button
              key={title}
              className={index === i ? "selected" : ""}
              onMouseEnter={() => setIndex(i)}
              onFocus={() => setIndex(i)}
              onClick={() => choose(i)}
            >
              {index === i && <RetroBall className="retro-cursor" />}
              <strong>{title}</strong>
              <small>{detail}</small>
            </button>
          ))}
          <p className="retro-help">↑↓ ELEGIR · ENTER / A ACEPTAR · ESC / B VOLVER</p>
        </nav>
      ) : (
        <p className="retro-press" role="status" aria-label="Pulsa Enter o Start">
          <span className="retro-blink">Press Start</span>
        </p>
      )}
      <div className="retro-ticker" aria-label="Dedicatoria">
        <span>
          {profile.dedication || `¡FELIZ CUMPLEAÑOS, ${name}!`} ★ WORLD CUP 2026 ★
        </span>
      </div>
      <footer className="retro-legal">
        <span>✿</span>
        <p>
          – VERSAO 1.0 –
          <br />
          (C) 2026 DEVELOPED BY OFICINA COMPUTER GROUP
        </p>
        <span>✿</span>
      </footer>
    </section>
  );
}
