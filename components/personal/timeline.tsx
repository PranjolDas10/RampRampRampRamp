"use client";

import { useState } from "react";
import { fmtDuration } from "@/lib/format";
import { DAYS, SIGNAL_LABEL, WINDOW_MINUTES } from "@/lib/personal/data";
import { cn } from "@/lib/utils";
import { Label } from "../cl1ck/bits";

function clockAt(min: number) {
  const total = 8 * 60 + 30 + Math.floor(min);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// Ten workdays of captured signals, 8:30–9:15. Routine steps in ink, everything else smoke.
export function Timeline() {
  const [selected, setSelected] = useState(DAYS.length - 1);
  const day = DAYS[selected];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-1">
        <div className="mb-1 ml-[76px] flex justify-between pr-[60px] font-mono text-[10px] text-ash">
          {["8:30", "8:45", "9:00", "9:15"].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        {DAYS.map((d, i) => {
          const routine = d.signals.filter((s) => s.routine);
          const from = routine[0]?.at ?? 0;
          const to = routine[routine.length - 1]?.at ?? 0;
          return (
            <button
              key={d.date}
              onClick={() => setSelected(i)}
              className={cn("flex w-full items-center gap-2 rounded-md px-1 py-1 text-left", selected === i ? "bg-bone" : "hover:bg-bone/60")}
            >
              <span className="w-[68px] shrink-0 text-[11px] text-ash">
                {d.label} {d.date}
              </span>
              <span className="relative h-4 flex-1 border-b border-hairline">
                {d.ran && (
                  <span
                    className="absolute inset-y-0 rounded-[3px] border border-ink/30 bg-bone"
                    style={{ left: `${(from / WINDOW_MINUTES) * 100}%`, width: `${((to - from + 0.6) / WINDOW_MINUTES) * 100}%` }}
                  />
                )}
                {d.signals.map((s, j) => (
                  <span
                    key={j}
                    title={`${clockAt(s.at)} · ${s.text}`}
                    className={cn(
                      "absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-[1px]",
                      s.routine ? "bg-ink" : "bg-smoke",
                    )}
                    style={{ left: `${(s.at / WINDOW_MINUTES) * 100}%` }}
                  />
                ))}
              </span>
              <span className={cn("w-[52px] shrink-0 text-right font-mono text-[11px]", d.ran ? "text-ink" : "text-ash")}>
                {d.ran ? fmtDuration(d.handSeconds) : "—"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="rounded-xl border border-hairline p-3">
        <Label>
          {day.label} {day.date} · {day.ran ? `started ${day.start}` : "skipped"}
        </Label>
        {day.note && <p className="mt-2 text-[11px] text-ash">No external display → docking is part of the trigger.</p>}
        <ol className="mt-2 max-h-[260px] space-y-0.5 overflow-y-auto font-mono text-[11px]">
          {day.signals.map((s, i) => (
            <li key={i} className={cn("flex gap-2", s.routine ? "text-ink" : "text-ash")}>
              <span className="w-9 shrink-0 text-ash">{clockAt(s.at)}</span>
              <span className="w-14 shrink-0 text-ash">{SIGNAL_LABEL[s.kind]}</span>
              <span className="min-w-0 truncate" title={s.text}>
                {s.text}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
