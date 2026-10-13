import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Footballer, loadPlayerAssets } from "../../game/rendering/footballer";
import type { MatchSnapshot } from "../../game/contracts";
import type { PlayerCustomization } from "../../game/customization/profile";
import type { SquadPlayer, TeamData } from "../../game/teams/types";
import { FIELD_H, FIELD_W, PLAYER_R } from "../../game/constants";

export default function PlayerPreview({
  custom,
  team,
  player,
  face,
  celebrate,
}: {
  custom: PlayerCustomization;
  team: TeamData;
  player: SquadPlayer;
  face: boolean;
  celebrate: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    latest = useRef({ custom, team, player, face, celebrate, angle: 0 });
  const [angle, setAngle] = useState(0),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  latest.current = { custom, team, player, face, celebrate, angle };
  useEffect(() => {
    const element = canvas.current!;
    let disposed = false,
      frame = 0,
      avatar: Footballer | undefined,
      assets: Awaited<ReturnType<typeof loadPlayerAssets>> | undefined,
      renderer: THREE.WebGLRenderer | undefined;
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(35, 1, 0.01, 20);
    scene.background = new THREE.Color("#142537");
    scene.add(new THREE.HemisphereLight("#dcefff", "#667066", 3));
    const light = new THREE.DirectionalLight("#fff3df", 4);
    light.position.set(2, 3, 4);
    scene.add(light);
    let signature = "",
      view: MatchSnapshot["players"][number],
      lastCelebration = 0,
      goalId = 0,
      previous = performance.now(),
      observed = "",
      changedAt = 0;
    const rebuild = () => {
      const { custom: c, team: t, player: p } = latest.current;
      goalId = 0;
      lastCelebration = latest.current.celebrate;
      view = {
        id: "preview",
        team: "home",
        x: FIELD_W / 2,
        y: FIELD_H / 2,
        vx: 0,
        vy: 0,
        r: PLAYER_R,
        anchor: { x: 0, y: 0 },
        facing: { x: 0, y: 1 },
        animPhase: 0,
        kickTimer: 0,
        hair: c.hairColor,
        skin: c.skin,
        isGK: p.role === "GK",
        role: p.role,
        num: c.num,
        name: c.name,
        ratings: p.ratings,
        kit: p.role === "GK" ? t.gkKit : t.kit,
        custom: c,
        cast: p.cast,
      };
      if (avatar) {
        scene.remove(avatar.root);
        avatar.dispose();
      }
      avatar = new Footballer(assets!, view, t);
      scene.add(avatar.root);
      const currentAvatar = avatar;
      void avatar.ready.catch((error) => {
        if (!disposed && avatar === currentAvatar)
          setError(
            error instanceof Error
              ? error.message
              : "No se pudo cargar la foto.",
          );
      });
    };
    const draw = (now: number) => {
      if (disposed || !renderer || !assets) return;
      const requestedCelebration = latest.current.celebrate !== lastCelebration;
      const next = JSON.stringify([
        latest.current.custom,
        latest.current.team.abbr,
        latest.current.player.num,
      ]);
      if (next !== observed) {
        observed = next;
        changedAt = now;
      }
      if (
        next !== signature &&
        (!avatar || now - changedAt > 100 || requestedCelebration)
      ) {
        signature = next;
        rebuild();
      }
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      if (requestedCelebration) {
        lastCelebration = latest.current.celebrate;
        goalId++;
      }
      if (avatar) {
        avatar.update(
          view,
          view,
          1,
          document.hidden ? 0 : dt,
          goalId
            ? [
                {
                  id: goalId,
                  tick: 1,
                  time: 0,
                  kind: "goal",
                  playerId: "preview",
                },
              ]
            : [],
          false,
        );
        avatar.root.rotation.y += latest.current.angle;
      }
      const rect = element.getBoundingClientRect(),
        width = Math.max(1, Math.round(rect.width)),
        height = Math.max(1, Math.round(rect.height));
      if (element.width !== width || element.height !== height) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      const scale = latest.current.custom.height / 1.8;
      if (latest.current.face) {
        camera.position.set(0, 1.64 * scale, 0.72);
        camera.lookAt(0, 1.63 * scale, 0);
      } else {
        camera.position.set(0, 1.25 * scale, 3.45);
        camera.lookAt(0, 0.95 * scale, 0);
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(draw);
    };
    void (async () => {
      try {
        const context = element.getContext("webgl2", { antialias: true });
        if (!context)
          throw new Error(
            "La vista previa necesita WebGL 2. Puedes seguir editando los valores.",
          );
        renderer = new THREE.WebGLRenderer({
          canvas: element,
          context,
          antialias: true,
        });
        renderer.setPixelRatio(1);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        assets = await loadPlayerAssets();
        if (disposed) {
          assets.dispose();
          return;
        }
        setReady(true);
        frame = requestAnimationFrame(draw);
      } catch (e) {
        if (!disposed)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo cargar la vista previa.",
          );
      }
    })();
    const lost = (e: Event) => {
      e.preventDefault();
      setError("Se perdió la vista 3D. Cierra y vuelve a abrir el editor.");
      cancelAnimationFrame(frame);
    };
    element.addEventListener("webglcontextlost", lost);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      element.removeEventListener("webglcontextlost", lost);
      avatar?.dispose();
      assets?.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
    };
  }, []);
  return (
    <section className="player-preview">
      <canvas ref={canvas} aria-label="Vista previa 3D del jugador" />
      {(!ready || error) && <p role="status">{error || "Cargando jugador…"}</p>}
      <div className="preview-angles">
        <button onClick={() => setAngle(0)}>Frente</button>
        <button onClick={() => setAngle(Math.PI / 2)}>Perfil</button>
        <button onClick={() => setAngle(Math.PI)}>Espalda</button>
      </div>
      <label>
        Girar jugador
        <input
          type="range"
          min={-3.14}
          max={3.14}
          step={0.02}
          value={angle}
          onChange={(e) => setAngle(+e.target.value)}
        />
      </label>
      <small>
        {face ? "Acercamiento facial" : "Vista del cuerpo completo"} · cambios
        en tiempo real
      </small>
    </section>
  );
}
