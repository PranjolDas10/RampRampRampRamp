"use client";

import { ArrowRight } from "lucide-react";
import { Label } from "./bits";

type Loop = {
  team: string;
  people: number;
  loop: string;
  byHand: string[];
  shortcuts: string;
  automated: string[];
  impact: [string, string][];
  seenVia: string;
};

// The same loop, repeated by everyone on a team, each person with their own private shortcut.
const LOOPS: Loop[] = [
  {
    team: "Recruiting",
    people: 3,
    loop: "After-interview follow-up",
    byHand: ["Update stage", "Paste notes", "Email times", "Book panel", "Send template"],
    shortcuts: "Each recruiter has their own email snippets",
    automated: ["Interview ends", "Stage + notes", "Candidate email", "Panel booked"],
    impact: [
      ["Per recruiter", "20×/day"],
      ["Reply time", "1 day → 1 h"],
    ],
    seenVia: "Extension: ATS, Gmail, Calendar",
  },
  {
    team: "Engineering",
    people: 4,
    loop: "Ticket → branch → PR → deploy note",
    byHand: ["Branch from ticket", "Set In Progress", "Draft PR + link", "Move ticket", "Post #deploys"],
    shortcuts: "Everyone's own git aliases",
    automated: ["Ticket assigned", "Branch + status", "Draft PR", "Merge → ticket + #deploys"],
    impact: [
      ["Per engineer", "15×/wk"],
      ["Each time", "3m → 0"],
    ],
    seenVia: "Terminal hook, GitHub webhook, extension",
  },
  {
    team: "Sales",
    people: 4,
    loop: "After-call logging",
    byHand: ["Deal stage", "Call notes", "Recap email", "Next task"],
    shortcuts: "Personal recap templates",
    automated: ["Call ends", "CRM updated", "Recap drafted", "Task created"],
    impact: [
      ["Per call", "5m → 1m"],
      ["Per rep", "30 calls/wk"],
    ],
    seenVia: "Extension: CRM, Gmail",
  },
  {
    team: "Support",
    people: 3,
    loop: "Ticket triage",
    byHand: ["Find customer", "Check billing", "Apply credit", "Canned reply", "Tag"],
    shortcuts: "Each agent's own canned replies",
    automated: ["Ticket in", "Customer + billing", "Credit under limit", "Reply + tag"],
    impact: [
      ["Per ticket", "90s → 15s"],
      ["Volume", "300/wk"],
    ],
    seenVia: "Extension: helpdesk, admin, billing",
  },
];

function Chain({ steps, muted }: { steps: string[]; muted?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {steps.map((s, i) => (
        <span key={s} className="flex items-center gap-1">
          {i > 0 && <ArrowRight className="size-2.5 text-smoke" />}
          <span className={muted ? "rounded-md bg-bone px-1.5 py-0.5 text-[11px] text-ash" : "rounded-md border border-hairline px-1.5 py-0.5 text-[11px] text-ink"}>
            {s}
          </span>
        </span>
      ))}
    </div>
  );
}

export function UseCases() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[40px] leading-[1.05] text-ink">Every team has a loop</h1>
        <p className="mt-2 text-base text-ash">
          Everyone repeats it, each with a private shortcut. cl1ck makes it one shared workflow. Accounts Payable is the live
          demo.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {LOOPS.map((l) => (
          <article key={l.team} className="flex flex-col gap-4 rounded-2xl border border-hairline bg-paper p-6">
            <div>
              <Label>
                {l.team} · {l.people} people
              </Label>
              <h3 className="mt-1 text-2xl leading-[1.17] text-ink">{l.loop}</h3>
            </div>
            <div>
              <Label className="mb-1.5">By hand</Label>
              <Chain steps={l.byHand} muted />
            </div>
            <div className="rounded-xl bg-bone px-3 py-2 text-xs text-ink">
              <span className="mr-1.5 inline-block size-2 rounded-[2px] bg-highlight align-middle" />
              {l.shortcuts} → one team workflow
            </div>
            <div>
              <Label className="mb-1.5">Automated</Label>
              <Chain steps={l.automated} />
            </div>
            <div className="mt-auto flex items-end justify-between gap-4">
              <div className="flex gap-6">
                {l.impact.map(([label, value]) => (
                  <div key={label}>
                    <Label>{label}</Label>
                    <div className="text-sm text-ink">{value}</div>
                  </div>
                ))}
              </div>
              <span className="text-right text-[11px] text-ash">{l.seenVia}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
