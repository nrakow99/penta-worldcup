"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";

export function ConfettiCelebration({
  trigger,
  type = "winner",
}: {
  trigger: boolean;
  type?: "winner" | "loser";
}) {
  useEffect(() => {
    if (!trigger) return;

    const colors =
      type === "winner"
        ? ["#10b981", "#fbbf24", "#ffffff"]
        : ["#ef4444", "#f97316", "#ffffff"];

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors,
    });

    const timeout = setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });
    }, 250);

    return () => clearTimeout(timeout);
  }, [trigger, type]);

  return null;
}
