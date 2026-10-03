"use client";

import { useCallback, useEffect, useState } from "react";
import { TopNav } from "@/components/cl1ck/dashboard";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageIntro } from "@/components/page-intro";
import { GhostButton, PrimaryButton } from "@/components/cl1ck/bits";
import { buildSandbox, type Sandbox } from "@/lib/sandbox";
import {
  CaptureStep,
  ClaudeStep,
  DryRunStep,
  GroupStep,
  GuardrailStep,
  LearnStep,
  TeamStep,
  TraceStep,
} from "./steps";

const STEPS: { title: string; line: string; render: (s: Sandbox) => React.ReactNode }[] = [
  { title: "Capture", line: "The recorder sees fields, values and saves, not pixels.", render: (s) => <CaptureStep s={s} /> },
  { title: "Trace", line: "Each typed value is matched to the label it sat next to on the email.", render: (s) => <TraceStep s={s} /> },
  { title: "Group", line: "Two tasks become step sequences. Close enough means the same pattern.", render: (s) => <GroupStep s={s} /> },
  { title: "Learn", line: "Every field gets a rule. The team fills what two runs can't prove.", render: (s) => <LearnStep s={s} /> },
  { title: "Dry run", line: "Replay on bills already entered. Suggest only at 90% or better.", render: (s) => <DryRunStep s={s} /> },
  { title: "Guardrails", line: "Three new invoices: one posts, one waits, one never goes out.", render: (s) => <GuardrailStep s={s} /> },
  { title: "Team", line: "One switch covers the whole team. Sharing reaches one step.", render: () => <TeamStep /> },
  { title: "New layout", line: "When rules miss, Claude reads once and the labels are learned.", render: (s) => <ClaudeStep s={s} /> },
];

const AUTOPLAY_MS = 5000;

export function Walkthrough() {
  const [sandbox] = useState(buildSandbox);
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(false);

  const go = useCallback((d: number) => setStep((s) => (s + d + STEPS.length) % STEPS.length), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  useEffect(() => {
    if (!auto) return;
    const t = window.setInterval(() => go(1), AUTOPLAY_MS);
    return () => window.clearInterval(t);
  }, [auto, go]);

  const current = STEPS[step];

  return (
    <div className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between">
          <TopNav active="sandbox" />
          <button
            onClick={() => setAuto((a) => !a)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs transition-colors duration-300",
              auto ? "bg-highlight text-ink" : "border border-ink/80 text-ink hover:bg-paper",
            )}
          >
            {auto ? <Pause className="size-3.5" /> : <Play className="size-3.5" />} Autoplay
          </button>
        </div>

        <div className="mt-8">
          <PageIntro title="Sandbox">
            <p>
              Step through the real engine on fixed demo data — capture, tracing, clustering, dry run and guardrails.
              Nothing here touches the live Ledgerline demo.
            </p>
          </PageIntro>
        </div>

        <ol className="mt-8 flex flex-wrap gap-1.5">
          {STEPS.map((st, i) => (
            <li key={st.title}>
              <button
                onClick={() => setStep(i)}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs transition-colors duration-300",
                  i === step ? "bg-highlight text-ink" : i < step ? "bg-paper text-ink" : "text-ash hover:bg-paper",
                )}
              >
                <span className="tabular-nums">{i + 1}</span>
                {st.title}
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[28px] leading-[1.14] text-ink">{current.title}</h2>
            <p className="mt-1 text-sm text-ash">{current.line}</p>
          </div>
          <span className="text-xs text-ash tabular-nums">
            {step + 1} / {STEPS.length}
          </span>
        </div>

        <div className="mt-5" key={step}>
          {current.render(sandbox)}
        </div>

        <div className="mt-6 flex items-center gap-2">
          <GhostButton onClick={() => go(-1)}>
            <ArrowLeft className="size-3.5" /> Back
          </GhostButton>
          <PrimaryButton onClick={() => go(1)}>
            {step === STEPS.length - 1 ? "Start over" : "Next"} <ArrowRight className="size-3.5" />
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
