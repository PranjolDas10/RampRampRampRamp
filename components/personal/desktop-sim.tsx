"use client";

import { useEffect, useRef, useState } from "react";
import { Code2, Globe, Music, Sparkles, SquareTerminal, Zap } from "lucide-react";
import type { SimKind } from "@/lib/personal/library";
import { cn } from "@/lib/utils";

export type SimStep = { kind: SimKind; label: string; detail: string; at: number };

const ICON: Record<SimKind, typeof Zap> = {
  trigger: Zap,
  code: Code2,
  terminal: SquareTerminal,
  browser: Globe,
  music: Music,
  note: Sparkles,
};

const SPEED = 420; // ms of animation per simulated second

// Faux desktop: steps light up in order and windows appear as they happen.
export function DesktopSim({ steps, runKey, onDone }: { steps: SimStep[]; runKey: number; onDone?: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<number | null>(null);
  const done = useRef(onDone);
  const total = steps[steps.length - 1]?.at ?? 0;

  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!runKey) return;
    const started = performance.now();
    timer.current = window.setInterval(() => {
      const t = (performance.now() - started) / SPEED;
      setElapsed(Math.min(t, total));
      if (t >= total) {
        if (timer.current) window.clearInterval(timer.current);
        done.current?.();
      }
    }, 60);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [runKey, total]);

  const reached = (i: number) => runKey > 0 && elapsed >= steps[i].at;
  const has = (kind: SimKind) => steps.some((s, i) => s.kind === kind && reached(i));
  const terminalLines = steps.filter((s, i) => s.kind === "terminal" && reached(i));
  const code = steps.find((s) => s.kind === "code");
  const music = steps.find((s) => s.kind === "music");
  const last = steps[steps.length - 1];
  const finished = runKey > 0 && elapsed >= total;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-obsidian">
        <div className="flex items-center justify-between border-b border-paper/10 px-3 py-1 text-[10px] text-paper/60">
          <span>Finder File Edit View</span>
          <span className="flex items-center gap-3">
            {music && has("music") && (
              <span className="flex items-center gap-1 text-paper">
                <Music className="size-3" /> {music.detail}
              </span>
            )}
            <span className="font-mono">{runKey ? `${elapsed.toFixed(1)}s` : "idle"}</span>
          </span>
        </div>

        {!runKey && <div className="absolute inset-0 flex items-center justify-center text-xs text-paper/50">Run a workflow to watch it here</div>}

        {code && has("code") && (
          <div className="us-rise absolute top-8 bottom-3 left-3 w-[calc(50%-18px)] overflow-hidden rounded-lg border border-paper/10 bg-[#111]">
            <div className="border-b border-paper/10 px-2 py-1 text-[10px] text-paper/60">
              {code.detail.split("/").pop()} — Visual Studio Code
            </div>
            <div className="flex h-full">
              <div className="w-1/3 space-y-1 border-r border-paper/10 p-2 font-mono text-[9px] text-paper/40">
                <div>app/</div>
                <div>components/</div>
                <div>lib/</div>
                <div>package.json</div>
              </div>
              <div className="flex-1 space-y-1 p-2 font-mono text-[9px] text-paper/70">
                <div>export default function Page() {"{"}</div>
                <div className="pl-3 text-paper/40">return &lt;Dashboard /&gt;</div>
                <div>{"}"}</div>
              </div>
            </div>
          </div>
        )}

        {has("browser") && (
          <div className="us-rise absolute top-8 right-3 bottom-3 w-[calc(50%-18px)] overflow-hidden rounded-lg bg-paper">
            <div className="flex gap-1 border-b border-hairline bg-bone px-2 pt-1.5">
              {["localhost", "Pull requests", "Notes"].map((t, i) => (
                <span key={t} className={cn("rounded-t px-2 py-0.5 text-[9px]", i === 0 ? "bg-paper text-ink" : "text-ash")}>
                  {t}
                </span>
              ))}
            </div>
            <div className="space-y-1.5 p-3">
              <div className="h-2 w-1/3 rounded-sm bg-ink" />
              <div className="h-1.5 w-2/3 rounded-sm bg-hairline" />
              <div className="h-1.5 w-1/2 rounded-sm bg-hairline" />
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-8 rounded-sm bg-bone" />
                ))}
              </div>
            </div>
          </div>
        )}

        {terminalLines.length > 0 && (
          <div className="us-rise absolute bottom-3 left-[18%] w-[42%] rounded-lg border border-paper/15 bg-black p-2 font-mono text-[9px] text-paper/80">
            {terminalLines.map((l) => (
              <div key={l.label}>
                ❯ {l.label} <span className="text-paper/40">{l.detail}</span>
              </div>
            ))}
          </div>
        )}

        {finished && (
          <div className="us-rise absolute top-8 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-md bg-highlight px-3 py-1.5 text-xs text-ink">
            {last.label} · {last.detail}
          </div>
        )}
      </div>

      <ol className="space-y-1">
        {steps.map((s, i) => {
          const Icon = ICON[s.kind];
          const on = reached(i);
          return (
            <li
              key={`${s.label}-${i}`}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors duration-300",
                on ? "border-ink text-ink" : "border-hairline text-ash",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              {on && <span className="size-1.5 shrink-0 rounded-[1px] bg-highlight" />}
              <span className="w-8 shrink-0 text-right font-mono text-[10px] text-ash">{on ? `${s.at.toFixed(1)}s` : ""}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
