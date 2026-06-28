"use client";

import { useEffect, useState } from "react";
import { differenceInSeconds, formatDistanceToNow } from "date-fns";

export function CountdownTimer({ deadline }: { deadline: string | null }) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!deadline) return;

    const update = () => {
      const target = new Date(deadline);
      const now = new Date();
      const diff = differenceInSeconds(target, now);

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft("Brackets locked!");
        return;
      }

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return null;

  return (
    <div className="text-center">
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        Bracket lock in
      </p>
      <p
        className={`text-2xl font-bold tabular-nums ${
          isExpired ? "text-red-400" : "text-emerald-400"
        }`}
      >
        {timeLeft}
      </p>
      <p className="text-xs text-zinc-500">
        {formatDistanceToNow(new Date(deadline), { addSuffix: true })}
      </p>
    </div>
  );
}
