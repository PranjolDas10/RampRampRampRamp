"use client";

import { useRef, useState } from "react";
import { TopNav } from "@/components/cl1ck/dashboard";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { fmtDuration } from "@/lib/format";
import { DAYS, MACHINE, MEDIAN_HAND_SECONDS, RAN_DAYS } from "@/lib/personal/data";
import { LIBRARY, PEOPLE, personById, workflowById, type PersonId } from "@/lib/personal/library";
import { cn } from "@/lib/utils";
import { Label, Stat, TextButton, useCountUp } from "../cl1ck/bits";
import { DesktopSim } from "./desktop-sim";
import { LibrarySheet, TeamLibrary, ViewAsSwitcher, recordRun, useLibraryState } from "./library";
import { Timeline } from "./timeline";

type RunState = { wf: string; person: PersonId; key: number } | null;

export function PersonalDemo({ repoPath }: { repoPath: string }) {
  const [viewer, setViewer] = useState<PersonId>("you");
  const [open, setOpen] = useState<string | null>(null);
  const [showSignals, setShowSignals] = useState(false);
  const [run, setRun] = useState<RunState>(null);
  const runRef = useRef<HTMLDivElement>(null);
  const s = useLibraryState();

  const installsTotal = LIBRARY.reduce((sum, w) => sum + s.installCount(w), 0);
  const savedToday = Object.entries(s.runs).reduce((sum, [key, n]) => sum + n * workflowById(key.split(":")[0]).savesSeconds, 0);
  const installsAnim = useCountUp(installsTotal);
  const savedAnim = useCountUp(savedToday);

  const startRun = (wf: string) => {
    setRun((prev) => ({ wf, person: viewer, key: (prev?.key ?? 0) + 1 }));
    runRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const runWorkflow = run ? workflowById(run.wf) : null;
  const runPerson = run ? personById(run.person) : null;

  return (
    <div className="min-h-screen bg-bone text-ink">
      <header className="border-b border-hairline bg-paper">
        <div className="mx-auto flex max-w-[1200px] items-center gap-6 px-6 py-3">
          <TopNav active="personal" />
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] space-y-8 px-6 py-10">
        <section className="space-y-2">
          <Label>Personal → Platform team</Label>
          <h1 className="text-[40px] leading-[1.05] text-ink">One person&apos;s routine, everyone&apos;s workflow</h1>
        </section>

        {/* Discovery, compact */}
        <section className="rounded-2xl border border-hairline bg-paper p-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <Label>Found on this Mac</Label>
              <div className="mt-1 text-sm text-ink">
                {MACHINE.model} · {MACHINE.chip.split(" ·")[0]}
              </div>
            </div>
            <div>
              <Label>Last 10 workdays</Label>
              <div className="mt-1.5 flex gap-1">
                {DAYS.map((d) => (
                  <span
                    key={d.date}
                    title={`${d.label} ${d.date}${d.ran ? "" : " · not docked"}`}
                    className={cn("size-3.5 rounded-[3px]", d.ran ? "bg-ink" : "border border-hairline")}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label>Seen</Label>
              <div className="mt-1 text-sm">{RAN_DAYS}/10 days</div>
            </div>
            <div>
              <Label>By hand</Label>
              <div className="mt-1 text-sm">{fmtDuration(MEDIAN_HAND_SECONDS)} / day</div>
            </div>
            <div>
              <Label>Saved as</Label>
              <div className="mt-1 text-sm">Start my workday · v1.2</div>
            </div>
            <TextButton className="ml-auto" onClick={() => setShowSignals((v) => !v)}>
              Signals <ChevronDown className={cn("size-3.5 transition-transform", showSignals && "rotate-180")} />
            </TextButton>
          </div>
          <p className="mt-3 text-xs text-ash">Not an Open at Login job: needs a trigger (dock + music), an order, and waits.</p>
          {showSignals && (
            <div className="mt-4 border-t border-hairline pt-4">
              <Timeline />
            </div>
          )}
        </section>

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Platform engineers" value={String(PEOPLE.length)} />
          <Stat label="Shared workflows" value={String(LIBRARY.length)} />
          <Stat label="Installs" value={String(Math.round(installsAnim))} accent />
          <Stat label="Saved today" value={fmtDuration(savedAnim)} accent />
        </section>

        {/* The centerpiece */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Label>Platform team library</Label>
              <h2 className="mt-1 text-2xl leading-tight text-ink">Built by one, installed by the team</h2>
            </div>
            <ViewAsSwitcher viewer={viewer} onChange={setViewer} />
          </div>
          <TeamLibrary viewer={viewer} onView={setOpen} onRun={startRun} repoPath={repoPath} />
        </section>

        <section ref={runRef} className="rounded-2xl border border-hairline bg-paper p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <Label>Live run</Label>
              <div className="mt-1 text-base">
                {runWorkflow && runPerson ? `${runWorkflow.name} · ${runPerson.id === "you" ? "you" : runPerson.name}` : "Nothing running"}
              </div>
            </div>
            {runPerson && <span className="font-mono text-[11px] text-ash">~/{runPerson.values.repo}</span>}
          </div>
          <DesktopSim
            key={run ? `${run.wf}-${run.person}` : "idle"}
            steps={runWorkflow && runPerson ? runWorkflow.sim(runPerson) : LIBRARY[0].sim(personById(viewer))}
            runKey={run?.key ?? 0}
            onDone={() => {
              if (!runWorkflow || !runPerson) return;
              recordRun(runWorkflow, runPerson.id);
              toast(`Saved ${fmtDuration(runWorkflow.savesSeconds)} for ${runPerson.id === "you" ? "you" : runPerson.name}`);
            }}
          />
        </section>
      </main>

      <LibrarySheet workflowId={open} viewer={viewer} onViewer={setViewer} onClose={() => setOpen(null)} onRun={startRun} />
    </div>
  );
}
