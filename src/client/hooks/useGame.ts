import {
  customizeTeams,
  type BirthdayProfile,
} from "../game/customization/profile";
import type { GoalPresentation } from "../game/customization/goals";
import { useEffect, useRef, useState } from "react";
import type { PitchKickGame } from "../game/engine";
import type { GraphicsQuality } from "../game/contracts";
import { applyCast } from "../game/customization/cast";
import { practiceTeams } from "../game/teams/practice";
import type { TeamData } from "../game/teams/types";
import type { HudState } from "../game/types";
import type { PauseReason } from "../game/input/browser";

const initialHud: HudState = {
  homeScore: 0,
  awayScore: 0,
  clock: 0,
  message: "",
  possession: "none",
  homePlayer: null,
  awayPlayer: null,
  charge: null,
};
export function useGame(options: {
  birthday: BirthdayProfile;
  onGoal: (goal: GoalPresentation) => void;
  active: boolean;
  gameKey: number;
  home: TeamData;
  away: TeamData;
  practice: boolean;
  quality: GraphicsQuality;
  paused: boolean;
  onPause: (reason: PauseReason) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null),
    gameRef = useRef<PitchKickGame | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const [hud, setHud] = useState(initialHud),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [controller, setController] = useState("Teclado");
  const { active, gameKey, home, away, practice } = options;
  useEffect(() => {
    if (!active || !canvasRef.current) return;
    setReady(false);
    setError("");
    setHud(initialHud);
    let cancelled = false;
    let game: PitchKickGame | undefined;
    const canvas = canvasRef.current;
    void (async () => {
      try {
        const { PitchKickGame } = await import("../game/engine");
        if (cancelled) return;
        const [baseHome, baseAway] = applyCast(home, away);
        const [castHome] = customizeTeams(
          [baseHome],
          latest.current.birthday,
          "home",
        );
        const [castAway] = customizeTeams(
          [baseAway],
          latest.current.birthday,
          "away",
        );
        const [h, a] = practice
          ? practiceTeams(castHome, castAway)
          : [castHome, castAway];
        game = new PitchKickGame(canvas, setHud, h, a, {
          practice,
          birthday: latest.current.birthday,
          onGoal: (goal) => latest.current.onGoal(goal),
          quality: latest.current.quality,
          seed: 2026 + gameKey,
          onReady: () => {
            if (!cancelled) {
              game?.setPaused(latest.current.paused);
              setReady(true);
            }
          },
          onError: (message) => {
            if (!cancelled) setError(message);
          },
          onPause: (reason) => latest.current.onPause(reason),
          onController: setController,
        });
        gameRef.current = game;
        await game.start();
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "No se pudo iniciar el partido.",
          );
      }
    })();
    return () => {
      cancelled = true;
      game?.stop();
      gameRef.current = null;
    };
  }, [active, gameKey, home, away, practice]);
  useEffect(() => {
    gameRef.current?.setPaused(options.paused);
  }, [options.paused]);
  useEffect(() => {
    gameRef.current?.setQuality(options.quality);
  }, [options.quality]);
  useEffect(() => {
    gameRef.current?.setBirthday(options.birthday);
  }, [options.birthday]);
  return { canvasRef, gameRef, hud, ready, error, controller };
}
