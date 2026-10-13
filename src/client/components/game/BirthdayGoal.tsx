import { useEffect, useRef, useState } from "react";
export function BirthdayGoal({
  goal,
  dedication,
  paused,
}: {
  goal: { name: string; confetti: boolean };
  dedication: string;
  paused: boolean;
}) {
  const [visible, setVisible] = useState(true);
  const remaining = useRef(4000);
  useEffect(() => {
    if (paused || !visible) return;
    const started = performance.now();
    const timer = setTimeout(() => setVisible(false), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(
        0,
        remaining.current - (performance.now() - started),
      );
    };
  }, [paused, visible]);
  if (!visible) return null;
  return (
    <div className="birthday-goal" aria-live="polite">
      <div className="birthday-goal-title">
        <span>¡GOOOL, {goal.name}!</span>
        <p>{dedication}</p>
      </div>
      {goal.confetti && (
        <div className="goal-confetti" aria-hidden="true">
          {Array.from({ length: 60 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 37) % 100}%`,
                background: ["#c6ff2e", "#ff8dd8", "#77dbff", "#ffe47e"][i % 4],
                animationDelay: `${-(i % 13) * 0.12}s`,
                animationDuration: `${2.4 + (i % 7) * 0.2}s`,
                animationPlayState: paused ? "paused" : "running",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
