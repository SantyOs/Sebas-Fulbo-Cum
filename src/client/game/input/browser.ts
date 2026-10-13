import type { KeyBindings } from "../keybindings";
import { ActionInput } from "./actions";

export type PauseReason = "focus" | "controller" | "manual";
export class BrowserInput {
  readonly actions = new ActionInput();
  private codes = new Set<string>();
  private activePad: number | null = null;
  private startHeld = false;
  private suppressPad = false;
  private status = "";
  private paused = false;
  constructor(
    private readonly bindings: KeyBindings,
    private onPause: (reason: PauseReason) => void,
    private onStatus: (message: string) => void,
  ) {}
  attach() {
    window.addEventListener("keydown", this.keyDown);
    window.addEventListener("keyup", this.keyUp);
    window.addEventListener("blur", this.blur);
    document.addEventListener("visibilitychange", this.visibility);
  }
  dispose() {
    window.removeEventListener("keydown", this.keyDown);
    window.removeEventListener("keyup", this.keyUp);
    window.removeEventListener("blur", this.blur);
    document.removeEventListener("visibilitychange", this.visibility);
    this.clear();
  }
  setPaused(paused: boolean) {
    this.paused = paused;
    this.clear();
  }
  clear() {
    this.codes.clear();
    this.actions.clear();
    this.suppressPad = true;
  }
  private blur = () => {
    this.clear();
    this.onPause("focus");
  };
  private visibility = () => {
    if (document.hidden) this.blur();
  };
  private keyDown = (event: KeyboardEvent) => {
    if (this.paused) return;
    if (event.code === "Escape" && !event.repeat) {
      event.preventDefault();
      this.onPause("manual");
      return;
    }
    if (!Object.values(this.bindings).includes(event.code)) return;
    event.preventDefault();
    this.codes.add(event.code);
    // Capture quick press/release sequences even between animation frames.
    this.poll();
  };
  private keyUp = (event: KeyboardEvent) => {
    this.codes.delete(event.code);
    this.poll();
  };
  poll() {
    const pads = Array.from(navigator.getGamepads?.() ?? []).filter(
      (p): p is Gamepad => !!p && p.connected,
    );
    let pad = pads.find(
      (p) => p.index === this.activePad && p.mapping === "standard",
    );
    if (this.activePad !== null && !pad) {
      this.activePad = null;
      this.clear();
      this.onPause("controller");
    }
    if (!pad)
      pad = pads.find(
        (p) =>
          p.mapping === "standard" &&
          (p.buttons.some((b) => b.pressed) ||
            p.axes.some((a) => Math.abs(a) > 0.2)),
      );
    if (pad) this.activePad = pad.index;
    const status = pad
      ? "Mando conectado"
      : pads.some((p) => p.mapping !== "standard")
        ? "Mando no estándar. Puedes jugar con teclado."
        : "Teclado · pulsa un botón para conectar el mando";
    if (status !== this.status) {
      this.status = status;
      this.onStatus(status);
    }
    const start = pad?.buttons[9]?.pressed ?? false;
    if (start && !this.startHeld && !this.paused) this.onPause("manual");
    this.startHeld = start;
    if (
      this.suppressPad &&
      !pad?.buttons.some((b) => b.pressed) &&
      !pad?.axes.some((a) => Math.abs(a) > 0.18)
    )
      this.suppressPad = false;
    if (!this.paused)
      this.actions.sample(
        this.codes,
        this.bindings,
        this.suppressPad ? undefined : pad,
      );
  }
}
