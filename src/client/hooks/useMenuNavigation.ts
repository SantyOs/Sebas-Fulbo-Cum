import { useEffect, useRef } from "react";
export type MenuAction = "left" | "right" | "up" | "down" | "confirm" | "back";
export function useMenuNavigation(
  enabled: boolean,
  onAction: (action: MenuAction) => void,
) {
  const callback = useRef(onAction);
  callback.current = onAction;
  useEffect(() => {
    if (!enabled) return;
    const keys: Record<string, MenuAction> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
      Enter: "confirm",
      Escape: "back",
    };
    const key = (e: KeyboardEvent) => {
      // Text fields, selects and sliders keep their native keyboard editing.
      const target = e.target as HTMLElement | null;
      if (
        e.code !== "Escape" &&
        target &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      )
        return;
      const action = keys[e.code];
      if (action) {
        e.preventDefault();
        e.stopImmediatePropagation();
        callback.current(action);
      }
    };
    window.addEventListener("keydown", key, true);
    let raf = 0,
      previous = new Set<MenuAction>(),
      initialized = false,
      lastRepeat = 0;
    const poll = (now: number) => {
      const p = Array.from(navigator.getGamepads?.() ?? []).find(
        (p) => p?.connected && p.mapping === "standard",
      );
      const next = new Set<MenuAction>();
      if (p) {
        if (p.buttons[14]?.pressed || p.axes[0] < -0.55) next.add("left");
        if (p.buttons[15]?.pressed || p.axes[0] > 0.55) next.add("right");
        if (p.buttons[12]?.pressed || p.axes[1] < -0.55) next.add("up");
        if (p.buttons[13]?.pressed || p.axes[1] > 0.55) next.add("down");
        if (p.buttons[0]?.pressed || p.buttons[9]?.pressed) next.add("confirm");
        if (p.buttons[1]?.pressed) next.add("back");
      }
      // Ignore a button held across a screen transition until it is released.
      if (initialized)
        for (const action of next) {
          const direction = !["confirm", "back"].includes(action);
          if (!previous.has(action) || (direction && now - lastRepeat > 260)) {
            callback.current(action);
            lastRepeat = now;
          }
        }
      initialized = true;
      previous = next;
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", key, true);
    };
  }, [enabled]);
}
/** Title screens: only Enter or the gamepad Start button (standard index 9). */
export function useStartButton(enabled: boolean, onStart: () => void) {
  const callback = useRef(onStart);
  callback.current = onStart;
  useEffect(() => {
    if (!enabled) return;
    const key = (e: KeyboardEvent) => {
      if (e.code !== "Enter" && e.code !== "NumpadEnter") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      callback.current();
    };
    window.addEventListener("keydown", key, true);
    let raf = 0,
      held: boolean | undefined;
    const poll = () => {
      const pressed = Array.from(navigator.getGamepads?.() ?? []).some(
        (p) => p?.connected && p.buttons[9]?.pressed,
      );
      // A Start held across the previous screen must be released first.
      if (held === false && pressed) callback.current();
      held = pressed;
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", key, true);
    };
  }, [enabled]);
}
