"use client";

import Link from "next/link";
import { X, ArrowUpRight, Pause, Play } from "lucide-react";
import { fmtDuration } from "@/lib/format";

export type OverlayToast = { id: string; title: string; body?: string; tone: "ok" | "warn" | "block" | "info"; demo?: string };

type Props = {
  events: number;
  paused: boolean;
  onTogglePause: () => void;
  discoveryCard: { runs: number; teamRuns: number } | null;
  onDiscoveryDone: () => void;
  suggestion: { vendor: string; fields: number; seconds: number; teammates: number } | null;
  onFill: () => void;
  onNotNow: () => void;
  toasts: OverlayToast[];
  onDismissToast: (id: string) => void;
};

// Monochrome per docs/design.md: the left edge marks the outcome (chartreuse = done, ink = blocked).
const EDGE: Record<OverlayToast["tone"], string> = {
  ok: "border-l-highlight",
  warn: "border-l-ash",
  block: "border-l-ink",
  info: "border-l-hairline",
};

const card = "pointer-events-auto w-full rounded-2xl border border-hairline bg-paper text-ink";
const primary = "inline-flex h-8 items-center gap-1 rounded-md bg-highlight px-3 text-xs text-ink hover:bg-[#d6e41a]";
const quiet = "inline-flex h-8 items-center rounded-md px-3 text-xs text-ink hover:bg-bone";

// cl1ck's in-app layer. Marked data-cl1ck so the recorder never records itself.
export function Cl1ckOverlay(p: Props) {
  return (
    <div
      data-cl1ck
      className="pointer-events-none fixed right-4 bottom-10 z-50 flex w-[320px] flex-col items-end gap-2 font-sans text-[13px]"
      style={{ fontFeatureSettings: '"ss01"' }}
    >
      {p.toasts.map((t) => (
        <div
          key={t.id}
          data-demo={t.demo ? `toast-${t.demo}` : undefined}
          className={`${card} border-l-4 p-3 ${EDGE[t.tone]} animate-in fade-in slide-in-from-bottom-2`}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div>{t.title}</div>
              {t.body && <div className="mt-0.5 text-xs text-ash">{t.body}</div>}
            </div>
            <button className="text-ash hover:text-ink" onClick={() => p.onDismissToast(t.id)} aria-label="Dismiss">
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ))}

      {p.discoveryCard && (
        <div data-demo="discovery" className={`${card} p-4 animate-in fade-in slide-in-from-bottom-3`}>
          <div className="us-label">Pattern found</div>
          <div className="mt-1 text-base leading-snug">Your team does this {p.discoveryCard.teamRuns}× a week.</div>
          <div className="mt-1 text-xs text-ash">Your {p.discoveryCard.runs} runs joined the team workflow.</div>
          <div className="mt-3 flex gap-1">
            <Link href="/" target="cl1ck" className={primary}>
              Open workflow <ArrowUpRight className="size-3.5" />
            </Link>
            <button data-demo="got-it" className={quiet} onClick={p.onDiscoveryDone}>
              Got it
            </button>
          </div>
        </div>
      )}

      {p.suggestion && (
        <div className={`${card} p-4 animate-in fade-in slide-in-from-bottom-3`}>
          <div className="us-label">{p.suggestion.teammates} teammates do this</div>
          <div className="mt-1 text-base leading-snug">Fill from {p.suggestion.vendor}&apos;s email?</div>
          <div className="mt-1 text-xs text-ash">
            {p.suggestion.fields} fields · saves {fmtDuration(p.suggestion.seconds)}
          </div>
          <div className="mt-3 flex gap-1">
            <button data-demo="fill" className={primary} onClick={p.onFill}>
              Fill {p.suggestion.fields} fields
            </button>
            <button className={quiet} onClick={p.onNotNow}>
              Not now
            </button>
          </div>
        </div>
      )}

      <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-hairline bg-paper py-1.5 pr-1.5 pl-3 text-ink">
        <span className={`size-2 rounded-[2px] ${p.paused ? "bg-smoke" : "animate-pulse bg-highlight"}`} />
        <span className="text-xs">
          cl1ck · <span className="text-ash">{p.events}</span>
        </span>
        <button
          onClick={p.onTogglePause}
          className="rounded-md p-1 text-ash hover:bg-bone hover:text-ink"
          aria-label={p.paused ? "Resume recording" : "Pause recording"}
        >
          {p.paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
        </button>
        <Link href="/" target="cl1ck" className="rounded-md p-1 text-ash hover:bg-bone hover:text-ink" aria-label="Open cl1ck">
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
