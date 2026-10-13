import { useEffect, useRef, useState } from "react";
import {
  assignKey,
  BINDING_GROUPS,
  codeLabel,
  DEFAULT_BINDINGS,
  isBindableCode,
  type GameAction,
  type KeyBindings,
} from "../../game/keybindings";
import type { GraphicsQuality } from "../../game/contracts";
import { useMenuNavigation } from "../../hooks/useMenuNavigation";

export function SettingsModal({
  bindings,
  onChange,
  quality,
  onQuality,
  onClose,
  performance,
  onMeasure,
  cameraZoom,
  volume,
  onPresentation,
  storageNotice,
}: {
  cameraZoom: number;
  volume: number;
  onPresentation: (patch: { cameraZoom?: number; volume?: number }) => void;
  storageNotice: string;
  bindings: KeyBindings;
  onChange: (b: KeyBindings) => void;
  quality: GraphicsQuality;
  onQuality: (q: GraphicsQuality) => void;
  onClose: () => void;
  performance?: {
    samples: number;
    averageFps: number;
    p95FrameMs: number;
    targetMet: boolean;
    gpu: string;
    width: number;
    height: number;
    complete: boolean;
    activeSeconds: number;
  };
  onMeasure?: () => void;
}) {
  const [capturing, setCapturing] = useState<GameAction | null>(null),
    [notice, setNotice] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.querySelector("button")?.focus();
  }, []);
  useEffect(() => {
    const trap = (event: KeyboardEvent) => {
      if (event.code !== "Tab") return;
      const buttons = Array.from(
        panel.current?.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        ) ?? [],
      );
      if (!buttons.length) return;
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", trap);
    return () => window.removeEventListener("keydown", trap);
  }, []);
  useMenuNavigation(!capturing, (action) => {
    if (action === "back") {
      onClose();
      return;
    }
    const buttons = Array.from(
      panel.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input[type="range"]',
      ) ?? [],
    );
    const focused = document.activeElement;
    if (
      focused instanceof HTMLInputElement &&
      focused.type === "range" &&
      (action === "left" || action === "right")
    ) {
      const delta = (action === "left" ? -1 : 1) * 0.05;
      if (focused.dataset.setting === "camera")
        onPresentation({
          cameraZoom: Math.max(1, Math.min(1.4, cameraZoom + delta)),
        });
      else onPresentation({ volume: Math.max(0, Math.min(1, volume + delta)) });
      return;
    }
    if (action === "confirm") {
      (document.activeElement as HTMLElement)?.click();
      return;
    }
    const current = buttons.indexOf(document.activeElement as HTMLElement),
      delta = action === "up" || action === "left" ? -1 : 1;
    buttons[(current + delta + buttons.length) % buttons.length]?.focus();
  });
  useEffect(() => {
    if (!capturing) return;
    const key = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === "Escape") {
        setCapturing(null);
        return;
      }
      if (!isBindableCode(e.code)) {
        setNotice("Esa tecla está reservada por el navegador. Elige otra.");
        return;
      }
      onChange(assignKey(bindings, capturing, e.code));
      setCapturing(null);
      setNotice("");
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [capturing, bindings, onChange]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="settings-panel"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-top">
          <div>
            <p className="eyebrow">TU FORMA DE JUGAR</p>
            <h2 id="settings-title">AJUSTES</h2>
          </div>
          <button
            className="quiet-button"
            onClick={onClose}
            aria-label="Cerrar ajustes"
          >
            ✕
          </button>
        </div>
        <div className="presentation-settings">
          <label className="editor-slider">
            <span>
              Cercanía de cámara <output>{cameraZoom.toFixed(2)}×</output>
            </span>
            <input
              data-setting="camera"
              type="range"
              min={1}
              max={1.4}
              step={0.01}
              value={cameraZoom}
              onChange={(e) => onPresentation({ cameraZoom: +e.target.value })}
            />
          </label>
          <label className="editor-slider">
            <span>
              Sonido <output>{Math.round(volume * 100)}%</output>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => onPresentation({ volume: +e.target.value })}
            />
          </label>
          {storageNotice && <p role="status">{storageNotice}</p>}
        </div>
        <div className="quality-picker">
          <span>Calidad gráfica</span>
          <button
            className={quality === "medium" ? "chosen" : ""}
            onClick={() => onQuality("medium")}
          >
            MEDIA · 720p
          </button>
          <button
            className={quality === "high" ? "chosen" : ""}
            onClick={() => onQuality("high")}
          >
            ALTA · 1080p
          </button>
        </div>
        <p className="muted">
          Selecciona una tecla y pulsa su reemplazo. Si ya está asignada, ambas
          acciones intercambian teclas. Esc cancela.
        </p>
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
        <div className="binding-groups">
          {BINDING_GROUPS.map((group) => (
            <div key={group.title}>
              <h3>{group.title === "Movement" ? "MOVIMIENTO" : "ACCIONES"}</h3>
              {group.actions.map(({ action, label }) => (
                <div className="binding-row" key={action}>
                  <span>{label}</span>
                  <button
                    onClick={() => setCapturing(action)}
                    className={capturing === action ? "capturing" : ""}
                  >
                    {capturing === action
                      ? "PULSA UNA TECLA"
                      : codeLabel(bindings[action])}
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="muted">
          Mando: A/✕ pase · B/○ tiro · X/□ pase largo · Y/△ pase al hueco ·
          LB/L1 cambio · RB/R1 sprint · LT/L2 contener · Start pausa.
        </p>
        {performance && (
          <div className="benchmark">
            <p>
              Medición local · {performance.samples} frames ·{" "}
              {performance.averageFps.toFixed(1)} FPS · p95{" "}
              {performance.p95FrameMs.toFixed(1)} ms
              <br />
              <span>
                {performance.width} ? {performance.height} ? {performance.gpu}
                <br />
                10 s de calentamiento + {performance.activeSeconds.toFixed(0)}
                /60 s de juego activo.{" "}
                {performance.targetMet
                  ? "Objetivo alcanzado en esta muestra."
                  : "Objetivo aún no validado."}
              </span>
            </p>
            <button className="quiet-button" onClick={onMeasure}>
              Reiniciar medición
            </button>
          </div>
        )}
        <div className="selection-footer">
          <button
            className="quiet-button"
            onClick={() => onChange({ ...DEFAULT_BINDINGS })}
          >
            Restablecer teclas
          </button>
          <button className="primary-button" onClick={onClose}>
            LISTO
          </button>
        </div>
      </div>
    </div>
  );
}
