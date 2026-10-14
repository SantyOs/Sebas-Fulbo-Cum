import {
  loadProfile,
  customizeTeams,
  saveProfile,
} from "../game/customization/profile";
import { birthdayAudio } from "../game/customization/audio";
import { BirthdayGoal } from "../components/game/BirthdayGoal";
import { CpuAds } from "../components/game/CpuAds";
import { IntroVideos } from "../components/game/IntroVideos";
import type { GoalPresentation } from "../game/customization/goals";
import { lazy, Suspense, useMemo, useState } from "react";
import { Settings, RotateCcw, Pause, ArrowLeft } from "lucide-react";
import { IntroMenu } from "../components/game/IntroMenu";
import { TeamSelect } from "../components/game/TeamSelect";
import { SettingsModal } from "../components/game/SettingsModal";
import { MatchHud } from "../components/game/MatchHud";
import { PauseMenu } from "../components/game/PauseMenu";
import { useGame } from "../hooks/useGame";
import { TEAMS } from "../game/teams";
import {
  loadBindings,
  saveBindings,
  controlsLegend,
  DEFAULT_BINDINGS,
  type KeyBindings,
} from "../game/keybindings";
import type { GraphicsQuality } from "../game/contracts";
import "../game.css";

const PlayerEditor = lazy(() => import("../components/game/PlayerEditor"));
type Phase = "intro" | "select" | "playing";
const qualityKey = "wc2026.graphics";
function loadQuality(): GraphicsQuality {
  try {
    return localStorage.getItem(qualityKey) === "medium" ? "medium" : "high";
  } catch {
    return "high";
  }
}
export default function HomePage() {
  const [birthday, setBirthday] = useState(() => loadProfile(TEAMS)),
    [editor, setEditor] = useState(false),
    [goal, setGoal] = useState<GoalPresentation | null>(null),
    [ads, setAds] = useState(false),
    // Every page load opens on the intro videos.
    [videos, setVideos] = useState(true);
  const [storageNotice, setStorageNotice] = useState("");
  // Presentation sliders must never reconstruct an ongoing match.
  const teams = useMemo(
    () => customizeTeams(TEAMS, birthday),
    [birthday.players],
  );
  const presentation = (patch: { cameraZoom?: number; volume?: number }) => {
    const next = { ...birthday, ...patch };
    setBirthday(next);
    try {
      saveProfile(next);
      setStorageNotice("");
    } catch {
      setStorageNotice(
        "Aplicado a esta sesión. No se pudo guardar en el navegador.",
      );
    }
  };
  const [phase, setPhase] = useState<Phase>("intro");
  const [practice, setPractice] = useState(false),
    [homeIndex, setHomeIndex] = useState(0),
    [awayIndex, setAwayIndex] = useState(1);
  const [gameKey, setGameKey] = useState(0),
    [settings, setSettings] = useState(false),
    [paused, setPaused] = useState(false),
    [pauseReason, setPauseReason] = useState("");
  const [bindings, setBindings] = useState(loadBindings),
    [quality, setQuality] = useState<GraphicsQuality>(loadQuality);
  const home = teams[homeIndex],
    away = teams[awayIndex];
  const { canvasRef, gameRef, hud, ready, error, controller } = useGame({
    birthday,
    onGoal: setGoal,
    active: phase === "playing",
    gameKey,
    home,
    away,
    practice,
    quality,
    paused: paused || settings || ads,
    onPause: (reason) => {
      setPaused(true);
      setPauseReason(
        reason === "focus"
          ? "El juego se pausó al cambiar de ventana."
          : reason === "controller"
            ? "Se desconectó el mando. Puedes continuar con teclado."
            : "El partido está en pausa.",
      );
    },
  });
  const start = (isPractice: boolean) => {
    void birthdayAudio.unlock().catch(() => {});
    setGoal(null);
    setAds(false);
    setPractice(isPractice);
    setPaused(false);
    setPauseReason("");
    setPhase("select");
  };
  const restart = () => {
    setGoal(null);
    setAds(false);
    setPaused(false);
    setSettings(false);
    setPauseReason("");
    setGameKey((k) => k + 1);
  };
  const menu = () => {
    setAds(false);
    setSettings(false);
    setPaused(false);
    setPhase("intro");
  };
  const applyBindings = (next: KeyBindings) => {
    setBindings(next);
    saveBindings(next);
  };
  const applyQuality = (next: GraphicsQuality) => {
    setQuality(next);
    try {
      localStorage.setItem(qualityKey, next);
    } catch {
      /* Session-only when storage is unavailable. */
    }
  };
  const finished = !practice && hud.finished;
  return (
    <main className="football-app">
      <header className="game-header">
        <div className="brand">
          <span className="brand-mark">W</span>
          <h1>
            WORLD CUP <em>2026</em>
          </h1>
          <span className="brand-subtitle">
            PARA {birthday.recipient || "TI"}
          </span>
        </div>
        <nav aria-label="Opciones del juego">
          {phase !== "playing" && (
            <button onClick={() => setEditor(true)}>Personalizar regalo</button>
          )}
          {phase === "playing" && (
            <button onClick={() => void birthdayAudio.unlock().catch(() => {})}>
              Activar sonido
            </button>
          )}
          {phase === "playing" && (
            <>
              <button
                onClick={() => {
                  setPauseReason("El partido está en pausa.");
                  setPaused(true);
                }}
                aria-label="Pausar"
              >
                <Pause size={16} />
                <span>Pausa</span>
              </button>
              <button onClick={restart}>
                <RotateCcw size={16} />
                <span>Revancha</span>
              </button>
              <button onClick={menu}>
                <ArrowLeft size={16} />
                <span>Menú</span>
              </button>
            </>
          )}
          <button onClick={() => setSettings(true)}>
            <Settings size={17} />
            <span>Ajustes</span>
          </button>
        </nav>
      </header>
      {phase === "intro" && (
        <IntroMenu
          enabled={!settings && !editor && !videos}
          recipient={birthday.recipient}
          dedication={birthday.dedication}
          onCustomize={() => setEditor(true)}
          onStart={start}
          onSettings={() => setSettings(true)}
        />
      )}
      {phase === "select" && (
        <TeamSelect
          teams={teams}
          practice={practice}
          initialHome={homeIndex}
          initialAway={awayIndex}
          enabled={!settings && !editor}
          onBack={menu}
          onStart={(h, a) => {
            void birthdayAudio.unlock().catch(() => {});
            setGoal(null);
            setHomeIndex(h);
            setAwayIndex(a);
            setPhase("playing");
          }}
        />
      )}
      {phase === "playing" && (
        <>
          <div className="game-viewport" key={gameKey}>
            <canvas ref={canvasRef} aria-label="Campo de fútbol 3D" />
            {ready && !error && (
              <MatchHud hud={hud} home={home} away={away} practice={practice} />
            )}
            {goal && ready && !error && (
              <BirthdayGoal
                key={`${gameKey}:${goal.id}`}
                goal={goal}
                dedication={birthday.dedication}
                paused={paused || settings}
                onDone={() => {
                  if (goal.team === "away" && !practice) setAds(true);
                }}
              />
            )}
            {!ready && !error && (
              <div className="loading-game" role="status">
                <div className="loading-ball" />
                <p>PREPARANDO EL ESTADIO</p>
                <span>Cargando jugadores, animaciones y luz…</span>
              </div>
            )}
            {error && (
              <div className="loading-game" role="alert">
                <h2>NO SE PUDO INICIAR</h2>
                <p>{error}</p>
                <button className="primary-button" onClick={restart}>
                  REINTENTAR
                </button>
                <button className="quiet-button" onClick={menu}>
                  Volver al menú
                </button>
              </div>
            )}
          </div>
          <footer className="controls-footer">
            <span className="controller-status">{controller}</span>
            <div>
              {controlsLegend(DEFAULT_BINDINGS).map((item, i) => (
                <span key={i}>
                  <kbd>{item.keys}</kbd> {item.label}
                </span>
              ))}
            </div>
          </footer>
          {(paused || finished) && !settings && !error && ready && (
            <PauseMenu
              key={finished ? "finished" : "pause"}
              reason={
                finished
                  ? `${home.abbr} ${hud.homeScore} — ${hud.awayScore} ${away.abbr}`
                  : pauseReason
              }
              finished={finished}
              onResume={() => setPaused(false)}
              onRestart={restart}
              onSettings={() => setSettings(true)}
              onMenu={menu}
            />
          )}
        </>
      )}
      {phase !== "playing" && (
        <footer className="menu-footer">
          <span>10 SELECCIONES · FÚTBOL 3D · JUEGA A TU RITMO</span>
          <span>EDICIÓN 2026</span>
        </footer>
      )}
      {editor && (
        <Suspense
          fallback={
            <div className="editor-backdrop">
              <p>Cargando editor?</p>
            </div>
          }
        >
          <PlayerEditor
            profile={birthday}
            homeTeamIndex={homeIndex}
            awayTeamIndex={awayIndex}
            onClose={() => setEditor(false)}
            onSave={(p) => {
              setBirthday(p);
              setEditor(false);
            }}
          />
        </Suspense>
      )}
      {ads && phase === "playing" && (
        <CpuAds
          profile={birthday}
          onClose={() => setAds(false)}
        />
      )}
      {videos && (
        <IntroVideos profile={birthday} onDone={() => setVideos(false)} />
      )}
      {settings && (
        <SettingsModal
          cameraZoom={birthday.cameraZoom}
          volume={birthday.volume}
          onPresentation={presentation}
          storageNotice={storageNotice}
          bindings={bindings}
          onChange={applyBindings}
          quality={quality}
          onQuality={applyQuality}
          onClose={() => setSettings(false)}
          performance={gameRef.current?.performanceReport}
          onMeasure={() => {
            gameRef.current?.resetPerformanceMeasurement();
            setSettings(false);
            setPaused(false);
          }}
        />
      )}
    </main>
  );
}
