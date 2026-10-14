import { useEffect, useRef, useState } from "react";
import { birthdayAudio } from "../../game/customization/audio";
import type { BirthdayProfile } from "../../game/customization/profile";
import { useStartButton } from "../../hooks/useMenuNavigation";

/** Every page load shows these in order with no skip: the two Clash Royale
 *  shorts (the second at full volume over a saturated loop), then the
 *  original Mundial Ronaldinho Soccer 64 intro, clean and clear. */
const VIDEOS = [
  { id: "QK91AMJbnrM", volume: 25 },
  { id: "WC07z8h5oLA", volume: 100, saturated: true },
  { id: "nAv0mjeiqsU", volume: 70 },
];
const LOAD_TIMEOUT = 10_000;

interface YTPlayer {
  loadVideoById(id: string): void;
  setVolume(volume: number): void;
  unMute(): void;
  /** Undocumented but stable: hides captions such as "[Música]". */
  unloadModule?(name: string): void;
  playVideo(): void;
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, number>;
      events: {
        onReady: () => void;
        onStateChange: (event: { data: number }) => void;
        onError: () => void;
      };
    },
  ) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let api: Promise<YTNamespace> | undefined;
function loadYouTube() {
  api ??= new Promise<YTNamespace>((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      api = undefined;
      reject(new Error("YouTube no disponible"));
    };
    window.onYouTubeIframeAPIReady = () => resolve(window.YT!);
    document.head.append(script);
  });
  return api;
}

export function IntroVideos({
  profile,
  onDone,
}: {
  profile: BirthdayProfile;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"boot" | "videos">("boot"),
    [muted, setMuted] = useState(false);
  const host = useRef<HTMLDivElement>(null),
    done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (phase !== "videos" || !host.current) return;
    // YouTube replaces this element with its iframe, so React never owns it.
    const element = host.current.appendChild(document.createElement("div"));
    let player: YTPlayer | undefined,
      current = 0,
      cancelled = false;
    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      birthdayAudio.stop();
      done.current();
    };
    const play = (i: number) => {
      current = i;
      const video = VIDEOS[i];
      if (video.saturated) void birthdayAudio.saturated(profile);
      else birthdayAudio.stop();
      player!.setVolume(video.volume);
      player!.unMute();
      player!.unloadModule?.("captions");
    };
    // Ended or unplayable (embedding disabled, offline): go to the next one.
    const next = () => {
      if (current + 1 >= VIDEOS.length) return finish();
      player!.loadVideoById(VIDEOS[current + 1].id);
      play(current + 1);
    };
    // Without YouTube the game must still open.
    const timeout = window.setTimeout(finish, LOAD_TIMEOUT);
    loadYouTube()
      .then((YT) => {
        if (cancelled) return;
        player = new YT.Player(element, {
          videoId: VIDEOS[0].id,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
            rel: 0,
            iv_load_policy: 3,
            cc_load_policy: 0,
          },
          events: {
            onReady: () => {
              window.clearTimeout(timeout);
              play(0);
              player!.playVideo();
            },
            onStateChange: (e) => {
              if (e.data === 0) next();
            },
            onError: next,
          },
        });
      })
      .catch(finish);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      birthdayAudio.stop();
      player?.destroy();
      element.remove();
    };
  }, [phase]);
  // A gamepad press is not a browser gesture: offer a key/click to unmute.
  useEffect(() => {
    if (!muted) return;
    const unlock = () =>
      void birthdayAudio
        .unlock()
        .then(() => setMuted(!birthdayAudio.running))
        .catch(() => {});
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [muted]);
  const booting = useRef(false);
  const boot = () => {
    if (booting.current) return;
    booting.current = true;
    // Without a gesture (gamepad) resume() stays pending: don't wait for it.
    void Promise.race([
      birthdayAudio.unlock().catch(() => {}),
      new Promise((r) => setTimeout(r, 400)),
    ]).then(() => {
      setMuted(!birthdayAudio.running);
      setPhase("videos");
    });
  };
  useStartButton(phase === "boot", boot);
  return (
    <div className="intro-videos" role="dialog" aria-label="Intro del juego">
      {phase === "boot" && (
        <button className="retro-boot" autoFocus onClick={boot}>
          <span className="retro-blink">PRESS START</span>
          <small>ENTER · START</small>
        </button>
      )}
      {phase === "videos" && (
        <>
          <div className="intro-videos-player" ref={host} />
          {/* Blocks clicks on the player: no pausing or skipping. */}
          <div className="intro-videos-shield" aria-hidden="true" />
        </>
      )}
      {muted && phase !== "boot" && (
        <span className="retro-muted" role="status">
          SIN SONIDO · PULSA ENTER O HAZ CLIC
        </span>
      )}
    </div>
  );
}
