export type GameAction =
  | "moveUp"
  | "moveDown"
  | "moveLeft"
  | "moveRight"
  | "sprint"
  | "shot"
  | "shortPass"
  | "longPass"
  | "throughPass"
  | "switchPlayer"
  | "contain";

export type KeyBindings = Record<GameAction, string>;

/** Physical keys are translated to actions only by the input adapter. The
 *  engine always plays with these; saved bindings only feed the settings panel. */
export const DEFAULT_BINDINGS: KeyBindings = {
  moveUp: "KeyW",
  moveDown: "KeyS",
  moveLeft: "KeyA",
  moveRight: "KeyD",
  sprint: "KeyE",
  shot: "KeyL",
  shortPass: "Digit5",
  longPass: "Digit1",
  throughPass: "KeyB",
  switchPlayer: "KeyQ",
  contain: "KeyC",
};

export const ACTION_ORDER: GameAction[] = [
  "moveUp",
  "moveDown",
  "moveLeft",
  "moveRight",
  "sprint",
  "shot",
  "shortPass",
  "longPass",
  "throughPass",
  "switchPlayer",
  "contain",
];

/** Grouped metadata for the settings panel. */
export const BINDING_GROUPS: {
  title: string;
  actions: { action: GameAction; label: string }[];
}[] = [
  {
    title: "Movement",
    actions: [
      { action: "moveUp", label: "Move up" },
      { action: "moveDown", label: "Move down" },
      { action: "moveLeft", label: "Move left" },
      { action: "moveRight", label: "Move right" },
    ],
  },
  {
    title: "Actions",
    actions: [
      { action: "sprint", label: "Sprint" },
      { action: "shot", label: "Shot / Tackle" },
      { action: "shortPass", label: "Short pass" },
      { action: "longPass", label: "Long pass / Slide" },
      { action: "throughPass", label: "Through pass" },
      { action: "switchPlayer", label: "Switch player" },
      { action: "contain", label: "Contain (hold)" },
    ],
  },
];

const STORAGE_KEY = "wc2026.keybindings";

/** Load bindings from localStorage, falling back to defaults for any missing
 *  or invalid entries. */
export function loadBindings(): KeyBindings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeBindings(JSON.parse(raw));
  } catch {
    // Ignore corrupt storage and use defaults.
  }
  return { ...DEFAULT_BINDINGS };
}

export function isBindableCode(code: string) {
  return /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Shift(Left|Right)|Control(Left|Right)|Space|Backspace|Numpad([0-9]|Add|Subtract|Multiply|Divide|Decimal|Enter))$/.test(
    code,
  );
}

export function normalizeBindings(value: unknown): KeyBindings {
  const result = {} as KeyBindings;
  const used = new Set<string>();
  const data =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  for (const action of ACTION_ORDER) {
    const code = data[action];
    if (typeof code === "string" && isBindableCode(code) && !used.has(code)) {
      result[action] = code;
      used.add(code);
    }
  }
  for (const action of ACTION_ORDER)
    if (!result[action]) {
      const code = !used.has(DEFAULT_BINDINGS[action])
        ? DEFAULT_BINDINGS[action]
        : Object.values(DEFAULT_BINDINGS).find((code) => !used.has(code))!;
      result[action] = code;
      used.add(code);
    }
  return result;
}

export function saveBindings(b: KeyBindings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  } catch {
    // Storage unavailable (private mode etc.) — bindings just won't persist.
  }
}

/** Assign `code` to `action`, swapping with whatever action already owns that
 *  code so every action always stays bound to a unique key. */
export function assignKey(
  bindings: KeyBindings,
  action: GameAction,
  code: string,
): KeyBindings {
  if (!isBindableCode(code)) return bindings;
  const next: KeyBindings = { ...bindings };
  const previous = next[action];
  const clashing = ACTION_ORDER.find((a) => a !== action && next[a] === code);
  next[action] = code;
  if (clashing) next[clashing] = previous; // swap so nothing is left unbound
  return next;
}

/** Human-readable label for a KeyboardEvent.code (e.g. 'KeyW' → 'W'). */
export function codeLabel(code: string): string {
  if (!code) return "—";
  const arrows: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
  };
  if (arrows[code]) return arrows[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "Num " + code.slice(6);
  const named: Record<string, string> = {
    Space: "Space",
    ShiftLeft: "L-Shift",
    ShiftRight: "R-Shift",
    ControlLeft: "L-Ctrl",
    ControlRight: "R-Ctrl",
    AltLeft: "L-Alt",
    AltRight: "R-Alt",
    Enter: "Enter",
    Tab: "Tab",
    Backspace: "Bksp",
    Escape: "Esc",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Semicolon: ";",
    Quote: "'",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Minus: "-",
    Equal: "=",
    Backquote: "`",
  };
  return named[code] ?? code;
}

/** Bottom-of-screen controls legend, derived from the live bindings. */
export function controlsLegend(
  b: KeyBindings,
): { keys: string; label: string }[] {
  return [
    {
      keys: `${codeLabel(b.moveLeft)} ${codeLabel(b.moveUp)} ${codeLabel(b.moveDown)} ${codeLabel(b.moveRight)}`,
      label: "Move",
    },
    { keys: codeLabel(b.sprint), label: "Sprint" },
    { keys: codeLabel(b.shot), label: "Shot / Tackle" },
    { keys: codeLabel(b.shortPass), label: "Short pass" },
    { keys: codeLabel(b.longPass), label: "Long pass / Slide" },
    { keys: codeLabel(b.throughPass), label: "Through pass" },
    {
      keys: `${codeLabel(b.switchPlayer)} + ${codeLabel(b.throughPass)}`,
      label: "Lofted through ball",
    },
    { keys: codeLabel(b.contain), label: "Contain (hold)" },
    { keys: codeLabel(b.switchPlayer), label: "Switch player" },
  ];
}
