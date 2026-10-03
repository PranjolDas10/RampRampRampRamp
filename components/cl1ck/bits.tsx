"use client";

// Shared UI pieces, styled per docs/design.md: bone canvas, white cards with hairline borders,
// ink text at a single weight, and chartreuse only where money moves or something is live.
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { RuleSource } from "@/lib/types";

export function useCountUp(target: number, ms = 700) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setValue(a + (target - a) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("us-label", className)}>{children}</div>;
}

export function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-hairline bg-paper px-5 py-4">
      <Label>{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        {accent && <span className="size-2 rounded-[2px] bg-highlight" />}
        <span className="text-[28px] leading-[1.14] text-ink tabular-nums">{value}</span>
      </div>
      {sub && <div className="mt-0.5 text-xs text-ash">{sub}</div>}
    </div>
  );
}

export function AppChip({ name }: { name: string }) {
  return <span className="rounded-md border border-hairline bg-bone px-1.5 py-0.5 text-[11px] text-ink">{name}</span>;
}

export function SourceBadge({ source }: { source: RuleSource }) {
  const label = { you: "Your runs", team: "Team", both: "You + team" }[source];
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[11px]",
        source === "both" ? "bg-ink text-paper" : "border border-hairline text-ash",
      )}
    >
      {label}
    </span>
  );
}

export function Avatar({ initials, you, className }: { initials: string; you?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[11px] ring-2 ring-paper",
        you ? "bg-highlight text-ink" : "bg-obsidian text-paper",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function Section({
  title,
  desc,
  action,
  children,
  className,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-hairline bg-paper p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base text-ink">{title}</h3>
          {desc && <p className="mt-0.5 text-xs text-ash">{desc}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

type Tone = "emerald" | "amber" | "red" | "sky" | "violet" | "zinc";

// One accent only: "emerald" (live / money moving) is chartreuse, "red" (blocked) is solid ink,
// "amber" (held) is outlined, everything else is a quiet wash.
export function Pill({ tone = "zinc", children }: { tone?: Tone; children: React.ReactNode }) {
  const tones: Record<Tone, string> = {
    emerald: "bg-highlight text-ink",
    red: "bg-ink text-paper",
    amber: "border border-ink text-ink",
    sky: "bg-bone text-ink",
    violet: "bg-bone text-ink",
    zinc: "bg-bone text-ash",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]", tones[tone])}>
      {children}
    </span>
  );
}

export function PrimaryButton({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md bg-highlight px-3.5 text-xs text-ink transition-colors duration-300 hover:bg-[#d6e41a] disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export function GhostButton({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border border-ink/80 px-3 text-xs text-ink transition-colors duration-300 hover:bg-bone disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export function TextButton({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-ink transition-colors duration-300 hover:bg-bone disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
