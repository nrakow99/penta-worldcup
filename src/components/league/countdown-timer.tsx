"use client";

import { useEffect, useState } from "react";

function computeLabel(deadline: string): { label: string; expired: boolean } {
  const diff = Math.floor((new Date(deadline).getTime() - Date.now()) / 1000);
  if (diff <= 0) return { label: "Brackets locked", expired: true };

  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;

  if (d > 0) return { label: `${d}d ${h}h ${m}m`, expired: false };
  if (h > 0) return { label: `${h}h ${m}m ${s}s`, expired: false };
  return { label: `${m}m ${s}s`, expired: false };
}

export function CountdownTimer({ deadline }: { deadline: string | null }) {
  const [state, setState] = useState<{ label: string; expired: boolean } | null>(null);

  useEffect(() => {
    if (!deadline) return;

    const tick = () => setState(computeLabel(deadline));
    tick(); // run immediately — no empty-string flash
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline || !state) return null;

  return (
    <div className="text-center">
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        {state.expired ? "Status" : "Bracket lock in"}
      </p>
      <p
        className={`text-2xl font-bold tabular-nums ${
          state.expired ? "text-red-400" : "text-emerald-400"
        }`}
      >
        {state.label}
      </p>
    </div>
  );
}
