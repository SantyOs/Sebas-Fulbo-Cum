import { PlayerEditorFields, tabs } from "./PlayerEditorFields";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { applyCast } from "../../game/customization/cast";
import { TEAMS } from "../../game/teams";
import {
  defaultPlayer,
  normalizeProfile,
  playerKey,
  saveProfile,
  type BirthdayProfile,
  type PlayerCustomization,
} from "../../game/customization/profile";
import {
  effectivePhoto,
  MAX_FACE_PHOTOS,
} from "../../game/customization/photo";
import { birthdayAudio } from "../../game/customization/audio";
const PlayerPreview = lazy(() => import("./PlayerPreview"));
export default function PlayerEditor({
  profile,
  homeTeamIndex,
  awayTeamIndex,
  onSave,
  onClose,
}: {
  profile: BirthdayProfile;
  homeTeamIndex: number;
  awayTeamIndex: number;
  onSave: (profile: BirthdayProfile) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(profile)),
    [teamIndex, setTeam] = useState(homeTeamIndex),
    [side, setSide] = useState<"home" | "away">("home"),
    [playerIndex, setPlayer] = useState(0),
    [tab, setTab] = useState<(typeof tabs)[number]>("Cara"),
    [notice, setNotice] = useState(""),
    [celebrate, setCelebrate] = useState(0),
    [fullBody, setFullBody] = useState(false);
  const panel = useRef<HTMLDivElement>(null),
    file = useRef<HTMLInputElement>(null);
  const castTeams = applyCast(TEAMS[teamIndex], TEAMS[teamIndex]);
  const team = castTeams[side === "home" ? 0 : 1],
    player = team.players[playerIndex],
    key = playerKey(team, player, side),
    savedCustom =
      draft.players[key] ??
      draft.players[playerKey(team, player)] ??
      defaultPlayer(team, player);
  const custom = {
    ...savedCustom,
    photo: effectivePhoto({ custom: savedCustom, cast: player.cast }),
  };
  const update = (patch: Partial<PlayerCustomization>) =>
    setDraft((d) => ({
      ...d,
      players: { ...d.players, [key]: { ...custom, ...patch } },
    }));
  const changeCelebration = (
    patch: Partial<PlayerCustomization["celebration"]>,
  ) => update({ celebration: { ...custom.celebration, ...patch } });
  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const focus = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const all = Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,select,textarea",
        ) ?? [],
      ).filter((e) => e.getClientRects().length);
      if (e.shiftKey && document.activeElement === all[0]) {
        e.preventDefault();
        all.at(-1)?.focus();
      } else if (!e.shiftKey && document.activeElement === all.at(-1)) {
        e.preventDefault();
        all[0]?.focus();
      }
    };
    window.addEventListener("keydown", focus);
    return () => {
      window.removeEventListener("keydown", focus);
      birthdayAudio.stop();
    };
  }, []);
  const download = () => {
    const data = normalizeProfile(draft, TEAMS),
      url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
    const a = document.createElement("a");
    a.href = url;
    a.download = "cumpleanos-sebastian.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importFile = async (f?: File) => {
    if (!f) return;
    try {
      if (f.size > 6_000_000) throw new Error("El archivo supera 6 MB.");
      const value = JSON.parse(await f.text());
      if (value?.version !== 1)
        throw new Error("Formato de regalo no compatible.");
      setDraft(normalizeProfile(value, TEAMS));
      setNotice("Regalo importado. Revisa y guarda para aplicarlo.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "No se pudo importar.");
    }
  };
  const upload = async (f?: File) => {
    if (!f) return;
    try {
      if (
        ![
          "audio/mpeg",
          "audio/mp3",
          "audio/wav",
          "audio/x-wav",
          "audio/ogg",
          "audio/webm",
        ].includes(f.type)
      )
        throw new Error("Usa MP3, WAV, OGG o WebM.");
      if (f.size > 1_000_000)
        throw new Error("El sonido debe pesar menos de 1 MB.");
      if (Object.keys(draft.sounds).length >= 4)
        throw new Error(
          "Puedes guardar hasta cuatro sonidos. Elimina uno para añadir otro.",
        );
      const context = new AudioContext();
      try {
        const decoded = await context.decodeAudioData(await f.arrayBuffer());
        if (decoded.duration > 30)
          throw new Error(
            "Elige un clip de hasta 30 segundos; en un gol se reproducen como máximo 8.",
          );
      } finally {
        await context.close();
      }
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      if (
        Object.values(draft.sounds).reduce((n, s) => n + s.data.length, 0) +
          data.length >
        2_800_000
      )
        throw new Error(
          "Los sonidos del regalo superan el espacio permitido. Elimina uno.",
        );
      const id = `custom-${crypto.randomUUID()}`;
      setDraft((d) => ({
        ...d,
        sounds: { ...d.sounds, [id]: { name: f.name, data } },
        players: {
          ...d.players,
          [key]: {
            ...(d.players[key] ?? custom),
            celebration: {
              ...(d.players[key] ?? custom).celebration,
              sound: id,
            },
          },
        },
      }));
      setNotice("Audio añadido al jugador. Guarda el regalo para conservarlo.");
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "El navegador no pudo leer ese audio.",
      );
    }
  };
  const save = () => {
    const photoSize = Object.values(draft.players).reduce(
      (total, p) =>
        total +
        (p.photo?.source.startsWith("data:") ? p.photo.source.length : 0),
      0,
    );
    if (photoSize > MAX_FACE_PHOTOS) {
      setNotice(
        "Las fotos superan el espacio disponible (1,2 MB). Quita algunas antes de guardar.",
      );
      return;
    }
    const normalized = normalizeProfile(draft, TEAMS);
    try {
      saveProfile(normalized);
      onSave(normalized);
    } catch {
      setNotice(
        "No hay espacio o almacenamiento disponible. Exporta el regalo para conservarlo o elimina audios y vuelve a guardar.",
      );
    }
  };
  const preview = () => {
    setCelebrate((n) => n + 1);
    setFullBody(true);
    void birthdayAudio
      .preview(custom, draft)
      .catch(() =>
        setNotice("Pulsa de nuevo para activar el sonido en este navegador."),
      );
  };
  return (
    <div className="editor-backdrop">
      <div
        className="birthday-editor"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
      >
        <header className="editor-header">
          <div>
            <p className="eyebrow">UN REGALO HECHO A TU MEDIDA</p>
            <h2 id="editor-title">
              EL EQUIPO DE {draft.recipient || "TU CUMPLEAÑERO"}
            </h2>
          </div>
          <button className="quiet-button" onClick={onClose}>
            Cerrar sin guardar
          </button>
        </header>
        <div className="editor-selectors">
          <label>
            Equipo
            <select
              value={side}
              onChange={(e) => {
                const nextSide = e.target.value as "home" | "away";
                setSide(nextSide);
                setTeam(nextSide === "home" ? homeTeamIndex : awayTeamIndex);
                setPlayer(0);
              }}
            >
              <option value="home">Mi equipo</option>
              <option value="away">Equipo contrario</option>
            </select>
          </label>
          <label>
            Selección
            <select
              value={teamIndex}
              onChange={(e) => {
                setTeam(+e.target.value);
                setPlayer(0);
              }}
            >
              {TEAMS.map((t, i) => (
                <option key={t.abbr} value={i}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Jugador
            <select
              value={playerIndex}
              onChange={(e) => setPlayer(+e.target.value)}
            >
              {team.players.map((p, i) => (
                <option key={p.num} value={i}>
                  {(
                    draft.players[playerKey(team, p, side)] ??
                    draft.players[playerKey(team, p)]
                  )?.name ?? p.name}{" "}
                  · #
                  {(
                    draft.players[playerKey(team, p, side)] ??
                    draft.players[playerKey(team, p)]
                  )?.num ?? p.num}
                </option>
              ))}
            </select>
          </label>
          <button
            className="quiet-button"
            onClick={() => {
              setDraft((d) => {
                const players = { ...d.players };
                delete players[key];
                return { ...d, players };
              });
              setNotice("Jugador restablecido en el borrador.");
            }}
          >
            Restablecer jugador
          </button>
        </div>
        <div className="editor-layout">
          <section className="editor-fields">
            <nav className="editor-tabs" aria-label="Categorías del editor">
              {tabs.map((t) => (
                <button
                  key={t}
                  className={tab === t ? "chosen" : ""}
                  aria-pressed={tab === t}
                  onClick={() => {
                    setTab(t);
                    setFullBody(t !== "Cara");
                  }}
                >
                  {t}
                </button>
              ))}
            </nav>
            <PlayerEditorFields
              key={key}
              tab={tab}
              custom={custom}
              draft={draft}
              setDraft={setDraft}
              update={update}
              changeCelebration={changeCelebration}
              preview={preview}
              upload={upload}
              onDeleteSound={(id) => {
                const sounds = { ...draft.sounds };
                delete sounds[id];
                setDraft(normalizeProfile({ ...draft, sounds }, TEAMS));
                birthdayAudio.stop();
              }}
            />
          </section>
          <div className="editor-visual">
            <Suspense fallback={<p>Cargando vista 3D…</p>}>
              <PlayerPreview
                custom={custom}
                team={team}
                player={player}
                face={!fullBody}
                celebrate={celebrate}
              />
            </Suspense>
            <button
              className="quiet-button"
              onClick={() => setFullBody((v) => !v)}
            >
              {fullBody ? "Ver rostro" : "Ver cuerpo completo"}
            </button>
            <p>
              {custom.name} · #{custom.num}
            </p>
          </div>
        </div>
        <footer className="editor-footer">
          <p role="status">
            {notice ||
              "Los cambios se aplican al guardar y comenzar un nuevo partido."}
          </p>
          <div>
            <input
              hidden
              type="file"
              ref={file}
              accept=".json,application/json"
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              className="quiet-button"
              onClick={() => file.current?.click()}
            >
              Importar regalo
            </button>
            <button className="quiet-button" onClick={download}>
              Exportar regalo
            </button>
            <button className="primary-button" onClick={save}>
              GUARDAR CAMBIOS
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
