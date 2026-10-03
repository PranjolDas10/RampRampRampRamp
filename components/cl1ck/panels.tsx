"use client";

import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  Eye,
  MousePointerClick,
  PencilLine,
  ShieldAlert,
  Sparkles,
  Undo2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_SETTINGS, KEYS, NO_PROMOTED, approveRun, fmtCost, promoteSetup, undoRun } from "@/lib/automation";
import { fmtDuration, fmtMoney, timeAgo } from "@/lib/format";
import { WORKFLOW_NAMES, coveredBy, groupName } from "@/lib/groups";
import { BILL_WORKFLOW_ID, DEFAULT_ADOPTION, ORG_TREE, TEAM_MEMBERS, type OrgNode } from "@/lib/seed";
import { useStored, write } from "@/lib/store";
import type { CapturedEvent, Run } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar, Pill, PrimaryButton, Section, TextButton } from "./bits";

const ICONS: Record<CapturedEvent["type"], typeof Eye> = {
  navigate: ArrowRight,
  view: Eye,
  click: MousePointerClick,
  change: PencilLine,
  copy: Copy,
  paste: ClipboardPaste,
  submit: CheckCircle2,
  submit_failed: ShieldAlert,
  automation: Sparkles,
};

function describe(e: CapturedEvent, mask: boolean) {
  const v = (s?: string) => (mask ? "•••" : (s ?? ""));
  switch (e.type) {
    case "navigate":
      return `Opened ${e.route}`;
    case "view":
      return `Read “${e.label}”`;
    case "click":
      return `Clicked ${e.label}`;
    case "change":
      return `${e.label} = ${v(e.value)}`;
    case "copy":
      return `Copied “${v(e.value)}”`;
    case "paste":
      return `Pasted into ${e.label}`;
    case "submit":
      return `Saved ${e.label}`;
    case "submit_failed":
      return "Save failed";
    case "automation":
      return e.label ?? "Automation ran";
  }
}

export function LiveFeed({ events, now }: { events: CapturedEvent[]; now: number }) {
  const settings = useStored(KEYS.settings, DEFAULT_SETTINGS);
  const rows = events.filter((e) => e.type !== "navigate").slice(-30).reverse();
  return (
    <Section
      title="Live activity"
      action={
        <label className="flex items-center gap-2 text-xs text-ash">
          Mask
          <Switch checked={settings.maskValues} onCheckedChange={(c) => write(KEYS.settings, { ...settings, maskValues: c })} />
        </label>
      }
    >
      <div className="max-h-[360px] space-y-0.5 overflow-y-auto">
        {rows.length === 0 && <p className="py-6 text-center text-xs text-ash">Waiting for activity in Ledgerline.</p>}
        {rows.map((e) => {
          const Icon = ICONS[e.type];
          return (
            <div key={e.id} className="us-rise flex items-start gap-2 rounded-md px-1.5 py-1.5 text-xs hover:bg-bone">
              <Icon className="mt-0.5 size-3.5 shrink-0 text-ash" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-ink">{describe(e, settings.maskValues)}</div>
                {e.trace && <div className="truncate text-[11px] text-ash">← email · {e.trace.label}</div>}
              </div>
              <span className="shrink-0 text-[10px] text-ash">{timeAgo(e.ts, now)}</span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

const RUN_TONE: Record<Run["status"], "emerald" | "amber" | "red" | "zinc"> = {
  Posted: "emerald",
  Approved: "emerald",
  Assisted: "zinc",
  "Awaiting approval": "amber",
  Blocked: "red",
  "Needs read": "amber",
  Undone: "zinc",
};

export function AuditLog({ runs, now }: { runs: Run[]; now: number }) {
  const aiSpend = runs.reduce((s, r) => s + (r.aiCost ?? 0), 0);
  return (
    <Section title="Runs" action={aiSpend ? <span className="text-xs text-ash">AI spend {fmtCost(aiSpend)}</span> : undefined}>
      {runs.length === 0 ? (
        <p className="py-6 text-center text-xs text-ash">No runs yet.</p>
      ) : (
        <div className="divide-y divide-hairline">
          {runs.slice(0, 10).map((r) => (
            <div key={r.id} className="us-rise flex items-start gap-3 py-2.5 text-xs">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={RUN_TONE[r.status]}>{r.status}</Pill>
                  <span className="text-ink">{r.invoiceNo}</span>
                  <span className="truncate text-ash">{r.vendor}</span>
                  {r.status !== "Needs read" && <span className="text-ink tabular-nums">{fmtMoney(r.amount)}</span>}
                </div>
                {r.flags[0] && <div className="mt-1 text-[11px] text-ink">{r.flags.join(" · ")}</div>}
                <div className="mt-0.5 text-[11px] text-ash">
                  v{r.version} · saved {fmtDuration(r.seconds)}
                  {r.protected ? ` · protected ${fmtMoney(r.protected)}` : ""}
                  {r.aiCost != null ? ` · AI ${r.aiCost > 0 ? fmtCost(r.aiCost) : "$0"}` : ""} · {timeAgo(r.ts, now)}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                {r.status === "Awaiting approval" && (
                  <PrimaryButton
                    onClick={() => {
                      approveRun(r.id);
                      toast.success(`Approved ${r.invoiceNo}`);
                    }}
                  >
                    Approve
                  </PrimaryButton>
                )}
                {(r.status === "Posted" || r.status === "Approved" || r.status === "Awaiting approval") && (
                  <TextButton
                    aria-label="Undo"
                    onClick={() => {
                      undoRun(r.id);
                      toast(`Undid ${r.invoiceNo}`);
                    }}
                  >
                    <Undo2 className="size-3.5" />
                  </TextButton>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

export function TeamMembers({ myRuns, myMedian }: { myRuns: number; myMedian: number }) {
  const adoption = useStored(KEYS.adoption, DEFAULT_ADOPTION);
  const promoted = useStored(KEYS.promoted, NO_PROMOTED);
  const covered = coveredBy(adoption, BILL_WORKFLOW_ID, "ap");
  return (
    <Section title="Team">
      <div className="space-y-2.5">
        {TEAM_MEMBERS.map((m) => (
          <div key={m.id} className="flex items-center gap-3 text-xs">
            <Avatar initials={m.initials} you={m.you} />
            <div className="min-w-0 flex-1">
              <div className="text-ink">
                {m.name} {m.you && <span className="text-ash">· you</span>}
              </div>
              <div className="text-[11px] text-ash">
                {fmtDuration(m.you && myMedian ? myMedian : promoted["sam.r"] && covered ? 90 : m.billMedian)} per bill
                {m.you && myRuns ? ` · ${myRuns} today` : ""}
              </div>
            </div>
            {covered ? (
              <Pill tone="emerald">Automated</Pill>
            ) : m.setup && !promoted[m.id] ? (
              <Pill tone="amber">Private shortcut</Pill>
            ) : (
              <Pill>Manual</Pill>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

export function PersonalSetups() {
  const promoted = useStored(KEYS.promoted, NO_PROMOTED);
  return (
    <Section
      title="Private shortcuts"
      desc="Faster methods people never shared."
      action={
        <span
          className="text-[11px] text-ash"
          title="Personal tricks (keyboard macros, copy-paste habits) that cl1ck noticed. Promote one and it becomes the team's workflow."
        >
          What is this?
        </span>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {TEAM_MEMBERS.filter((m) => m.setup).map((m) => (
          <div key={m.id} className="rounded-xl bg-bone p-4 text-xs">
            <div className="flex items-center gap-2">
              <Avatar initials={m.initials} />
              <div className="min-w-0">
                <div className="truncate text-ink">{m.setup!.title}</div>
                <div className="text-[11px] text-ash">
                  {m.name} · saves {m.setup!.saves}
                </div>
              </div>
            </div>
            <div className="mt-3">
              {promoted[m.id] ? (
                <Pill tone="emerald">
                  <CheckCircle2 className="size-3" /> Shared with team
                </Pill>
              ) : (
                <PrimaryButton
                  onClick={() => {
                    promoteSetup(m.id);
                    toast.success(`${m.name.split(" ")[0]}'s shortcut is now the team's`);
                  }}
                >
                  Make it the team&apos;s
                </PrimaryButton>
              )}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// Kept for a sources view; not shown on the main dashboard.
export function Sources({ events }: { events: CapturedEvent[] }) {
  return (
    <Section title="Sources" desc={`${events.length} events stored in this browser`}>
      <div className="space-y-1.5 text-xs">
        {[
          ["Ledgerline recorder", "Live"],
          ["Chrome extension", "Ready"],
          ["Terminal hook", "Ready"],
          ["GitHub webhook", "Ready"],
        ].map(([name, status]) => (
          <div key={name} className="flex items-center justify-between">
            <span className="text-ink">{name}</span>
            <Pill tone={status === "Live" ? "emerald" : "zinc"}>{status}</Pill>
          </div>
        ))}
      </div>
    </Section>
  );
}

function OrgNodeBox({ node, depth, highlight }: { node: OrgNode; depth: number; highlight?: string }) {
  const adoption = useStored(KEYS.adoption, DEFAULT_ADOPTION);
  const running = Object.keys(adoption).filter((w) => coveredBy(adoption, w, node.id));
  const own = Object.keys(adoption).filter((w) => (adoption[w] ?? []).includes(node.id));
  return (
    <div className={cn(depth > 0 && "pl-4")}>
      <div
        className={cn(
          "mb-1.5 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
          node.id === highlight ? "border-ink" : "border-hairline",
        )}
      >
        <span className={cn("size-2 rounded-[2px]", running.length ? "bg-highlight" : "bg-smoke")} />
        <span className="text-ink">{node.name}</span>
        <span className="ml-auto flex flex-wrap justify-end gap-1">
          {running.map((w) => (
            <Pill key={w} tone={own.includes(w) ? "emerald" : "zinc"}>
              {WORKFLOW_NAMES[w] ?? w}
            </Pill>
          ))}
        </span>
      </div>
      {node.children?.map((c) => (
        <OrgNodeBox key={c.id} node={c} depth={depth + 1} highlight={highlight} />
      ))}
    </div>
  );
}

export function OrgMap({ highlight }: { highlight?: string }) {
  return (
    <Section title="Where it runs" desc={`On at ${groupName(highlight ?? "org")} or above covers everyone below.`}>
      <OrgNodeBox node={ORG_TREE} depth={0} highlight={highlight} />
    </Section>
  );
}
