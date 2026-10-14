import { useEffect, useRef, useState } from "react";
import { birthdayAudio } from "../../game/customization/audio";
import type { BirthdayProfile } from "../../game/customization/profile";

/** Shown on every page load, in this order, with no skip. The third plays at
 *  full volume over a saturated Clash Royale loop; the others stay quieter. */
const VIDEOS = [
  { id: "nAv0mjeiqsU", volume: 25 },
  { id: "QK91AMJbnrM", volume: 25 },
  { id: "WC07z8h5oLA", volume: 100, saturated: true },
];
const LOAD_TIMEOUT = 10_000;

interface YTPlayer {
  loadVideoById(id: string): void;
  setVolume(volume: number): void;
  unMute(): void;
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
  const [started, setStarted] = useState(false),
    [index, setIndex] = useState(0);
  const host = useRef<HTMLDivElement>(null),
    done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!started || !host.current) return;
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
      setIndex(i);
      const video = VIDEOS[i];
      if (video.saturated) void birthdayAudio.saturated(profile);
      else birthdayAudio.stop();
      player!.setVolume(video.volume);
      player!.unMute();
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
  }, [started]);
  return (
    <div className="intro-videos" role="dialog" aria-label="Videos de inicio">
      {started ? (
        <>
          <div className="intro-videos-player" ref={host} />
          {/* Blocks clicks on the player: no pausing or skipping. */}
          <div className="intro-videos-shield" aria-hidden="true" />
          <span className="intro-videos-count" role="status">
            {index + 1} / {VIDEOS.length}
          </span>
        </>
      ) : (
        <button
          className="primary-button"
          autoFocus
          onClick={() => {
            // The click is the gesture browsers need before playing sound.
            void birthdayAudio.unlock().catch(() => {});
            setStarted(true);
          }}
        >
          ▶ PULSA PARA EMPEZAR
        </button>
      )}
    </div>
  );
}
