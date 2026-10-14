import { useEffect, useRef, useState } from "react";
import { birthdayAudio } from "../../game/customization/audio";
import type { BirthdayProfile } from "../../game/customization/profile";
import type { TeamData } from "../../game/teams/types";

/** Length of halftime-albion.mp3; the break lasts exactly the clip. */
export const HALFTIME_SECONDS = 34;
const HALFTIME_CLIP = "halftime-albion";

type GameProps = { onWin: () => void; teams: TeamData[] };
const pick = <T,>(list: readonly T[]) =>
  list[Math.floor(Math.random() * list.length)];

/** Calls `fn(key)` on keydown while mounted; the match input ignores keys while paused. */
function useKeys(fn: (key: string, e: KeyboardEvent) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const down = (e: KeyboardEvent) => !e.repeat && ref.current(e.key.toLowerCase(), e);
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);
}

const GRID_KEYS = ["q", "w", "e", "a", "s", "d", "z", "x", "c"];
function Saves({ onWin }: GameProps) {
  const GOAL = 8;
  const [ball, setBall] = useState(4),
    [saves, setSaves] = useState(0);
  // The ball jumps faster with every save.
  useEffect(() => {
    const t = setTimeout(
      () => setBall((b) => (b + 1 + Math.floor(Math.random() * 8)) % 9),
      Math.max(450, 1100 - saves * 80),
    );
    return () => clearTimeout(t);
  }, [ball, saves]);
  const save = (cell: number) => {
    if (cell !== ball || saves >= GOAL) return;
    setBall((b) => (b + 1 + Math.floor(Math.random() * 8)) % 9);
    if (saves + 1 === GOAL) onWin();
    setSaves((s) => s + 1);
  };
  useKeys((k) => GRID_KEYS.includes(k) && save(GRID_KEYS.indexOf(k)));
  return (
    <>
      <p className="ht-progress">ATAJADAS {saves}/{GOAL}</p>
      <div className="ht-goal">
        {GRID_KEYS.map((k, i) => (
          <button key={k} onClick={() => save(i)} aria-label={`Zona ${k.toUpperCase()}`}>
            {i === ball ? "⚽" : <kbd>{k.toUpperCase()}</kbd>}
          </button>
        ))}
      </div>
    </>
  );
}

function Penalties({ onWin }: GameProps) {
  const GOALS = 3;
  const [aim, setAim] = useState(0),
    [keeper, setKeeper] = useState(35),
    [goals, setGoals] = useState(0),
    [last, setLast] = useState("");
  useEffect(() => {
    let frame = 0;
    const loop = (t: number) => {
      // Ping-pong 0..100 across the goal mouth.
      const p = (t / 9 + goals * 37) % 200;
      setAim(p > 100 ? 200 - p : p);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [goals]);
  const shoot = () => {
    if (goals >= GOALS) return;
    const scored = aim > 4 && aim < 96 && (aim < keeper || aim > keeper + 30);
    setLast(scored ? "¡GOLAZO!" : aim <= 4 || aim >= 96 ? "¡AL PALO!" : "¡ATAJADA!");
    setKeeper(5 + Math.random() * 60);
    if (scored) {
      if (goals + 1 === GOALS) onWin();
      setGoals((g) => g + 1);
    }
  };
  useKeys((k, e) => {
    if (k !== " " && k !== "enter") return;
    e.preventDefault();
    shoot();
  });
  return (
    <>
      <p className="ht-progress">GOLES {goals}/{GOALS} {last && `· ${last}`}</p>
      <div className="ht-penalty" aria-hidden="true">
        <span className="ht-keeper" style={{ left: `${keeper}%`, width: "30%" }}>🧤</span>
        <span className="ht-aim" style={{ left: `${aim}%` }}>⚽</span>
      </div>
      <button className="ht-action" onClick={shoot}>¡CHUTA! (ESPACIO)</button>
    </>
  );
}

function Quiz({ onWin, teams }: GameProps) {
  const HITS = 5;
  const ask = () => {
    const options = [...teams].sort(() => Math.random() - 0.5).slice(0, 4);
    const team = pick(options);
    return { player: pick(team.players), team, options };
  };
  const [q, setQ] = useState(ask),
    [hits, setHits] = useState(0),
    [wrong, setWrong] = useState(false);
  const answer = (team: TeamData) => {
    if (hits >= HITS) return;
    if (team !== q.team) return setWrong(true);
    setWrong(false);
    setQ(ask());
    if (hits + 1 === HITS) onWin();
    setHits((h) => h + 1);
  };
  useKeys((k) => {
    const i = Number(k) - 1;
    if (q.options[i]) answer(q.options[i]);
  });
  return (
    <>
      <p className="ht-progress">ACIERTOS {hits}/{HITS} {wrong && "· ¡NO!"}</p>
      <p className="ht-question">
        ¿De qué selección es <b>#{q.player.num} {q.player.name}</b>?
      </p>
      <div className="ht-options">
        {q.options.map((t, i) => (
          <button
            key={t.abbr}
            onClick={() => answer(t)}
            style={{ background: t.color, color: t.textColor }}
          >
            {i + 1}. {t.name}
          </button>
        ))}
      </div>
    </>
  );
}

function Warmup({ onWin }: GameProps) {
  const STEPS = 50;
  const [steps, setSteps] = useState(0),
    [next, setNext] = useState<"left" | "right">("left");
  const step = (side: "left" | "right") => {
    if (side !== next || steps >= STEPS) return;
    setNext(side === "left" ? "right" : "left");
    if (steps + 1 === STEPS) onWin();
    setSteps((s) => s + 1);
  };
  useKeys((k, e) => {
    const side = k === "arrowleft" || k === "a" ? "left" : k === "arrowright" || k === "d" ? "right" : null;
    if (!side) return;
    e.preventDefault();
    step(side);
  });
  return (
    <>
      <p className="ht-progress">ZANCADAS {steps}/{STEPS}</p>
      <div className="ht-bar"><i style={{ width: `${(steps / STEPS) * 100}%` }} /></div>
      <div className="ht-options">
        <button className={next === "left" ? "is-next" : ""} onClick={() => step("left")}>
          ⬅ IZQUIERDA
        </button>
        <button className={next === "right" ? "is-next" : ""} onClick={() => step("right")}>
          DERECHA ➡
        </button>
      </div>
    </>
  );
}

// Six spots on a mini pitch for the pass sequence.
const SPOTS = [
  [15, 50], [38, 22], [38, 78], [62, 30], [62, 70], [85, 50],
];
function Replay({ onWin }: GameProps) {
  const ROUNDS = [4, 5];
  const make = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * SPOTS.length));
  const [round, setRound] = useState(0),
    [seq, setSeq] = useState(() => make(ROUNDS[0])),
    [shown, setShown] = useState(-1),
    [input, setInput] = useState<number[]>([]),
    [note, setNote] = useState("");
  const showing = shown < seq.length;
  // Flash each pass in turn, then hand over to the player.
  useEffect(() => {
    if (!showing) return;
    const t = setTimeout(() => setShown((s) => s + 1), shown < 0 ? 700 : 550);
    return () => clearTimeout(t);
  }, [shown, showing]);
  const press = (i: number) => {
    if (showing || round >= ROUNDS.length) return;
    const typed = [...input, i];
    if (seq[typed.length - 1] !== i) {
      setNote("¡Pase perdido! Mira otra vez");
      setInput([]);
      return setShown(-1);
    }
    if (typed.length < seq.length) return setInput(typed);
    setInput([]);
    setNote("¡Jugada perfecta!");
    if (round + 1 === ROUNDS.length) {
      setRound(ROUNDS.length);
      return onWin();
    }
    setRound(round + 1);
    setSeq(make(ROUNDS[round + 1]));
    setShown(-1);
  };
  useKeys((k) => {
    const i = Number(k) - 1;
    if (i >= 0 && i < SPOTS.length) press(i);
  });
  const lit = showing ? seq[shown] : input[input.length - 1];
  return (
    <>
      <p className="ht-progress">
        JUGADA {Math.min(round + 1, ROUNDS.length)}/{ROUNDS.length} ·{" "}
        {showing ? "MIRA" : `TU TURNO ${input.length}/${seq.length}`} {note && `· ${note}`}
      </p>
      <div className="ht-pitch">
        {SPOTS.map(([x, y], i) => (
          <button
            key={i}
            className={lit === i ? "is-lit" : ""}
            style={{ left: `${x}%`, top: `${y}%` }}
            onClick={() => press(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </>
  );
}

const GAMES = [
  { title: "ATAJADAS RELÁMPAGO", mission: "Ataja 8 balones: haz clic donde aparezca el balón.", Game: Saves },
  { title: "TANDA DE PENALES", mission: "Marca 3 penales: chuta cuando el balón esquive al portero.", Game: Penalties },
  { title: "ÁLBUM MUNDIALISTA", mission: "Acierta 5 jugadores con su selección.", Game: Quiz },
  { title: "CALENTAMIENTO", mission: "Da 50 zancadas alternando ← y →.", Game: Warmup },
  { title: "JUGADA DE PIZARRA", mission: "Memoriza la secuencia de pases y repítela.", Game: Replay },
];
let lastGame = -1;

/** Half-time break: one random minigame while the Albion clip plays. */
export function HalfTime({
  profile,
  teams,
  onDone,
}: {
  profile: BirthdayProfile;
  teams: TeamData[];
  onDone: () => void;
}) {
  const [index] = useState(() => {
    // Never the same one twice in a row.
    if (lastGame < 0) return (lastGame = Math.floor(Math.random() * GAMES.length));
    let i = Math.floor(Math.random() * (GAMES.length - 1));
    if (i >= lastGame) i++;
    return (lastGame = i);
  });
  const { title, mission, Game } = GAMES[index];
  const [left, setLeft] = useState(HALFTIME_SECONDS),
    [won, setWon] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left <= 0) onDone();
  }, [left]);
  // Starts after the match pause has silenced the goal audio.
  useEffect(() => {
    void birthdayAudio.unlock().catch(() => {});
    const t = setTimeout(
      () => void birthdayAudio.playClips([HALFTIME_CLIP], profile, { level: 1 }),
      250,
    );
    return () => {
      clearTimeout(t);
      birthdayAudio.stop();
    };
  }, []);
  return (
    <div className="halftime" role="dialog" aria-modal="true" aria-label={`Medio tiempo: ${title}`}>
      <p className="ht-kicker">MEDIO TIEMPO · MINIJUEGO</p>
      <h2>{title}</h2>
      <p className="ht-mission">{mission}</p>
      <div className="ht-timer" role="timer" aria-label={`${Math.max(0, left)} segundos`}>
        <i style={{ animationDuration: `${HALFTIME_SECONDS}s` }} />
        <span>{Math.max(0, left)}s</span>
      </div>
      <div className="ht-game">
        {won ? (
          <p className="ht-won" role="status">¡MISIÓN CUMPLIDA!<small>El segundo tiempo arranca al terminar el audio</small></p>
        ) : (
          <Game onWin={() => setWon(true)} teams={teams} />
        )}
      </div>
    </div>
  );
}
