import type { InputFrame } from "../contracts";
import {
  ACTION_ORDER,
  type GameAction,
  type KeyBindings,
} from "../keybindings";

export interface PadState {
  mapping: string;
  connected: boolean;
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}
const PAD_ACTIONS: Partial<Record<number, GameAction>> = {
  0: "shortPass",
  1: "shot",
  2: "longPass",
  3: "throughPass",
  4: "switchPlayer",
  5: "sprint",
  6: "contain",
};

export function deadzone(x: number, y: number, zone = 0.18) {
  const length = Math.hypot(x, y);
  if (length <= zone) return { x: 0, y: 0 };
  const magnitude = Math.min(1, (length - zone) / (1 - zone));
  return { x: (x / length) * magnitude, y: (y / length) * magnitude };
}

/** Device-independent edge buffering. A zero-step render cannot lose a tap. */
export class ActionInput {
  private held = new Set<GameAction>();
  private pressed: GameAction[] = [];
  private released: GameAction[] = [];
  private move = { x: 0, y: 0 };
  sample(codes: ReadonlySet<string>, bindings: KeyBindings, pad?: PadState) {
    const next = new Set<GameAction>();
    for (const action of ACTION_ORDER)
      if (codes.has(bindings[action])) next.add(action);
    let analog = { x: 0, y: 0 };
    if (pad?.connected && pad.mapping === "standard") {
      analog = deadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      for (const [index, action] of Object.entries(PAD_ACTIONS))
        if (action && pad.buttons[Number(index)]?.pressed) next.add(action);
      if (pad.buttons[12]?.pressed) next.add("moveUp");
      if (pad.buttons[13]?.pressed) next.add("moveDown");
      if (pad.buttons[14]?.pressed) next.add("moveLeft");
      if (pad.buttons[15]?.pressed) next.add("moveRight");
    }
    const x = Number(next.has("moveRight")) - Number(next.has("moveLeft"));
    const y = Number(next.has("moveDown")) - Number(next.has("moveUp"));
    const length = Math.hypot(x, y) || 1;
    this.move = x || y ? { x: x / length, y: y / length } : analog;
    // Discrete direction zones are also used by assisted shooting.
    if (analog.y < -0.25) next.add("moveUp");
    if (analog.y > 0.25) next.add("moveDown");
    if (analog.x < -0.25) next.add("moveLeft");
    if (analog.x > 0.25) next.add("moveRight");
    for (const action of next)
      if (!this.held.has(action)) this.pressed.push(action);
    for (const action of this.held)
      if (!next.has(action)) this.released.push(action);
    this.held = next;
  }
  consume(): InputFrame {
    const result = {
      move: { ...this.move },
      held: new Set(this.held),
      pressed: this.pressed,
      released: this.released,
    };
    this.pressed = [];
    this.released = [];
    return result;
  }
  clear() {
    this.held.clear();
    this.pressed = [];
    this.released = [];
    this.move = { x: 0, y: 0 };
  }
}
