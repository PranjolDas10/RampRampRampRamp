"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowUp, Check, Download, Eye, FileDown, Play, Timer } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fmtDuration } from "@/lib/format";
import {
  LOCAL_WORKFLOW_ID,
  SHORTCUT_CREATE_URL,
  SHORTCUT_NAME,
  SHORTCUT_RUN_URL,
  openLink,
  shortcutScript,
} from "@/lib/personal/local-plan";
import {
  LIBRARY,
  NO_INSTALLS,
  NO_PRUNS,
  NO_PSHARES,
  PEOPLE,
  PKEYS,
  downloadText,
  launchdPlist,
  personById,
  workflowById,
  type PersonId,
  type Workflow,
} from "@/lib/personal/library";
import { ORG_TREE, relation, type OrgNode } from "@/lib/seed";
import { update, useStored } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Avatar, GhostButton, Label, Pill, PrimaryButton, TextButton } from "../cl1ck/bits";
import { CodeView } from "./code-view";

const nameOf = (p: PersonId) => (p === "you" ? "you" : personById(p).name);

export function useLibraryState() {
  const installs = useStored(PKEYS.installs, NO_INSTALLS);
  const runs = useStored(PKEYS.runs, NO_PRUNS);
  const shares = useStored(PKEYS.shares, NO_PSHARES);
  const installCount = (w: Workflow) => w.baseInstalls + (installs[w.id] ?? []).filter((p) => p !== w.author).length;
  const isInstalled = (w: Workflow, p: PersonId) => w.author === p || (installs[w.id] ?? []).includes(p);
  const runCount = (w: Workflow, p: PersonId) => runs[`${w.id}:${p}`] ?? 0;
  return { installs, runs, shares, installCount, isInstalled, runCount };
}

export function install(w: Workflow, p: PersonId) {
  update(PKEYS.installs, NO_INSTALLS, (prev) => ({ ...prev, [w.id]: Array.from(new Set([...(prev[w.id] ?? []), p])) }));
}

export function recordRun(w: Workflow, p: PersonId) {
  update(PKEYS.runs, NO_PRUNS, (prev) => ({ ...prev, [`${w.id}:${p}`]: (prev[`${w.id}:${p}`] ?? 0) + 1 }));
}

export function detectOs(): "mac" | "windows" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac OS X|Macintosh/i.test(ua)) return "mac";
  return "other";
}

export function downloadScript(w: Workflow, p: PersonId, os: "mac" | "windows" = detectOs() === "windows" ? "windows" : "mac") {
  if (os === "windows") {
    downloadText(w.winFile, w.winScript(personById(p), personById(w.author)), "application/x-bat");
    toast(`Downloaded ${w.winFile}`, { description: `Filled in for ${nameOf(p)} · double-click to run` });
    return;
  }
  downloadText(w.file, w.script(personById(p), personById(w.author)), "text/x-shellscript");
  toast(`Downloaded ${w.file}`, { description: `Filled in for ${nameOf(p)} · run: zsh ~/Downloads/${w.file}` });
}

export function downloadPlist(w: Workflow, p: PersonId) {
  downloadText(`com.cl1ck.${w.id}.plist`, launchdPlist(w, personById(p)), "application/xml");
  toast(`Downloaded com.cl1ck.${w.id}.plist`);
}

export function ViewAsSwitcher({ viewer, onChange }: { viewer: PersonId; onChange: (p: PersonId) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Label>View as</Label>
      <div className="inline-flex rounded-md border border-hairline bg-paper p-0.5">
        {PEOPLE.map((p) => (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-[5px] py-1 pr-2.5 pl-1 text-xs transition-colors duration-300",
              viewer === p.id ? "bg-ink text-paper" : "text-ash hover:text-ink",
            )}
          >
            <Avatar initials={p.initials} you={p.id === "you"} className="size-5 text-[8px] ring-0" />
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function WorkflowCard({
  w,
  viewer,
  onView,
  onRun,
  repoPath,
}: {
  w: Workflow;
  viewer: PersonId;
  onView: () => void;
  onRun: () => void;
  repoPath: string;
}) {
  const s = useLibraryState();
  const [setup, setSetup] = useState(false);
  const [realRun, setRealRun] = useState(false);
  const os = detectOs();
  const runsHere = w.id === LOCAL_WORKFLOW_ID && viewer === "you";
  const author = personById(w.author);
  const mine = w.author === viewer;
  const installed = s.isInstalled(w, viewer);
  const runs = s.runCount(w, viewer);
  const v = personById(viewer).values;
  const count = s.installCount(w);
  return (
    <article className={cn("flex flex-col rounded-2xl border bg-paper p-5", mine ? "border-ink" : "border-hairline")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg leading-tight text-ink">{w.name}</h3>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ash">
            <Avatar initials={author.initials} you={author.id === "you"} className="size-4 text-[7px] ring-0" />
            {nameOf(w.author)} · v{w.version} · {w.updated}
          </div>
        </div>
        {mine ? (
          <Pill tone="sky">Yours</Pill>
        ) : installed && runs > 0 ? (
          <Pill tone="emerald">Running · {fmtDuration(runs * w.savesSeconds)} saved</Pill>
        ) : installed ? (
          <Pill tone="sky">Installed</Pill>
        ) : null}
      </div>

      <div className="mt-4 space-y-1.5">
        <Label>Trigger</Label>
        <p className="text-xs text-ink">{w.trigger}</p>
      </div>

      <div className="mt-3 rounded-md bg-bone px-2.5 py-1.5 font-mono text-[10px] text-ink">
        ~/{v.repo} · :{v.port}
        {v.playlist ? ` · ${v.playlist}` : ""}
      </div>

      <div className="mt-3 flex items-center gap-3 text-[11px] text-ash">
        <span>
          <span className="text-ink tabular-nums">{count}</span> installs
        </span>
        <span>{fmtDuration(w.savesSeconds)} / run</span>
        <span>{w.steps.length} steps</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <TextButton onClick={onView}>
          <Eye className="size-3.5" /> View
        </TextButton>
        {!mine && !installed ? (
          <GhostButton
            onClick={() => {
              install(w, viewer);
              toast(`Installed for ${nameOf(viewer)}`, { description: `~/${v.repo}` });
            }}
          >
            <Check className="size-3.5" /> Install for me
          </GhostButton>
        ) : null}
        <PrimaryButton
          onClick={() => {
            if (!mine && !installed) install(w, viewer);
            onRun();
          }}
        >
          <Play className="size-3.5" /> Watch it run
        </PrimaryButton>
      </div>

      <div className="mt-3 text-[11px] text-ash">
        <button onClick={() => setRealRun((v) => !v)} className="underline hover:text-ink">
          {realRun ? "Hide" : "Run it on my computer"}
        </button>
        {realRun && (
          <div className="mt-2 space-y-2 rounded-md border border-hairline bg-bone px-3 py-2 text-ink">
            <p>
              Plain text — read it first. It only opens apps, folders and URLs, and starts your dev server.
              {os === "windows" ? " Double-click the .cmd file." : os === "mac" ? " Run with zsh, or use Shortcuts below." : ""}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(os === "windows" || os === "other") && (
                <GhostButton onClick={() => downloadScript(w, viewer, "windows")}>
                  <Download className="size-3.5" /> {w.winFile}
                </GhostButton>
              )}
              {(os === "mac" || os === "other") && (
                <GhostButton onClick={() => downloadScript(w, viewer, "mac")}>
                  <Download className="size-3.5" /> {w.file}
                </GhostButton>
              )}
            </div>
            {runsHere && os === "mac" && (
              <div>
                <button onClick={() => setSetup((v) => !v)} className="underline hover:text-ink">
                  {setup ? "Hide Shortcuts setup" : "One-click via macOS Shortcuts (1 min)"}
                </button>
                {setup && (
                  <ol className="mt-2 space-y-1.5">
                    <li className="flex items-center gap-2">
                      <span className="text-ash">1</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(shortcutScript(repoPath));
                          toast("Script copied");
                        }}
                        className="rounded-md bg-paper px-2 py-0.5 hover:bg-hairline"
                      >
                        Copy script
                      </button>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-ash">2</span>
                      <button onClick={() => openLink(SHORTCUT_CREATE_URL)} className="rounded-md bg-paper px-2 py-0.5 hover:bg-hairline">
                        Open Shortcuts
                      </button>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-ash">3</span>
                      <span>
                        Add <b className="font-normal underline">Run AppleScript</b>, paste, name it “{SHORTCUT_NAME}”. Allow
                        scripts in Shortcuts → Settings → Advanced.
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-ash">4</span>
                      <button
                        onClick={() => {
                          openLink(SHORTCUT_RUN_URL);
                          onRun();
                          toast(`Running “${SHORTCUT_NAME}”`);
                        }}
                        className="rounded-md bg-paper px-2 py-0.5 hover:bg-hairline"
                      >
                        Run on this Mac
                      </button>
                    </li>
                  </ol>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function TeamLibrary({
  viewer,
  onView,
  onRun,
  repoPath,
}: {
  viewer: PersonId;
  onView: (id: string) => void;
  onRun: (id: string) => void;
  repoPath: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {LIBRARY.map((w) => (
        <WorkflowCard key={w.id} w={w} viewer={viewer} onView={() => onView(w.id)} onRun={() => onRun(w.id)} repoPath={repoPath} />
      ))}
    </div>
  );
}

function flatten(node: OrgNode, out: OrgNode[] = []) {
  out.push(node);
  (node.children ?? []).forEach((c) => flatten(c, out));
  return out;
}

function ShareRow({ w }: { w: Workflow }) {
  const s = useLibraryState();
  const shared = s.shares[w.id] ?? [];
  const nodes = flatten(ORG_TREE).filter((n) => n.id !== "platform" && n.id !== "org");
  const reachable = nodes.filter((n) => relation("platform", n.id));
  const far = nodes.filter((n) => ["finance", "ops"].includes(n.id));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Pill tone="sky">
        <Check className="size-3" /> Platform
      </Pill>
      {reachable.map((n) => {
        const on = shared.includes(n.id);
        return on ? (
          <Pill key={n.id} tone="emerald">
            <Check className="size-3" /> {n.name}
          </Pill>
        ) : (
          <GhostButton
            key={n.id}
            className="h-6 px-2 text-[11px]"
            onClick={() => {
              update(PKEYS.shares, NO_PSHARES, (prev) => ({ ...prev, [w.id]: [...(prev[w.id] ?? []), n.id] }));
              toast(`Shared with ${n.name}`);
            }}
          >
            <ArrowUp className="size-3" /> Share with {n.name}
          </GhostButton>
        );
      })}
      {far.map((n) => (
        <span key={n.id} className="rounded-md border border-dashed border-hairline px-1.5 py-0.5 text-[11px] text-ash">
          {n.name} · 2 steps
        </span>
      ))}
    </div>
  );
}

export function LibrarySheet({
  workflowId,
  viewer,
  onViewer,
  onClose,
  onRun,
}: {
  workflowId: string | null;
  viewer: PersonId;
  onViewer: (p: PersonId) => void;
  onClose: () => void;
  onRun: (id: string) => void;
}) {
  const w = workflowId ? workflowById(workflowId) : null;
  return (
    <Sheet open={!!w} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto border-hairline bg-paper p-0 data-[side=right]:sm:max-w-3xl!">
        {w && (
          <SheetBody
            w={w}
            viewer={viewer}
            onViewer={onViewer}
            onRun={() => {
              onClose();
              onRun(w.id);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function SheetBody({ w, viewer, onViewer, onRun }: { w: Workflow; viewer: PersonId; onViewer: (p: PersonId) => void; onRun: () => void }) {
  const s = useLibraryState();
  const person = personById(viewer);
  const author = personById(w.author);
  const installed = s.isInstalled(w, viewer);
  const os = detectOs();
  const files = [
    { name: w.winFile, path: `Downloads\\${w.winFile}`, body: w.winScript(person, author) },
    { name: w.file, path: `~/Downloads/${w.file}`, body: w.script(person, author) },
    ...(os === "mac"
      ? [{ name: `com.cl1ck.${w.id}.plist`, path: `~/Library/LaunchAgents/com.cl1ck.${w.id}.plist`, body: launchdPlist(w, person) }]
      : []),
  ];
  return (
    <div className="space-y-6 pb-10">
      <SheetHeader className="border-b border-hairline p-6 pr-12">
        <Label>
          Platform library · {nameOf(w.author)} · v{w.version} · {s.installCount(w)} installs
        </Label>
        <SheetTitle className="mt-1 text-[28px] leading-[1.14] font-normal text-ink">{w.name}</SheetTitle>
        <SheetDescription className="text-ash">{w.trigger}</SheetDescription>
      </SheetHeader>

      <div className="space-y-6 px-6">
        <ViewAsSwitcher viewer={viewer} onChange={onViewer} />

        <section className="space-y-2">
          <Label>Steps</Label>
          <ol className="space-y-1">
            {w.steps.map((st, i) => (
              <li key={st.text} className="flex items-center gap-2 text-xs text-ink">
                <span className="w-4 font-mono text-[10px] text-ash">{i + 1}</span>
                {st.text}
                {st.wait && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-hairline px-1.5 py-0.5 text-[10px] text-ash">
                    <Timer className="size-3" /> waits
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-2">
          <Label>Filled in for {nameOf(viewer)}</Label>
          <div className="divide-y divide-hairline rounded-2xl border border-hairline">
            {w.placeholders.map((ph) => {
              const value = ph.value(person.values);
              const own = value !== ph.value(author.values);
              return (
                <div key={ph.key} className="flex items-center gap-3 px-4 py-2 text-xs">
                  <span className="w-36 shrink-0 font-mono text-[11px] text-ash">{ph.key}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink">{value}</span>
                  {own && <Pill tone="sky">own value</Pill>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-2">
          <Label>Script · opens apps, folders, URLs and the dev server only</Label>
          <CodeView files={files} maxHeight={320} />
          <div className="flex flex-wrap gap-1.5 pt-1">
            <PrimaryButton
              onClick={() => {
                if (!installed) {
                  install(w, viewer);
                  toast(`Installed for ${nameOf(viewer)}`);
                }
                onRun();
              }}
            >
              <Play className="size-3.5" /> Watch it run
            </PrimaryButton>
            <GhostButton onClick={() => downloadScript(w, viewer, "windows")}>
              <Download className="size-3.5" /> {w.winFile}
            </GhostButton>
            <GhostButton onClick={() => downloadScript(w, viewer, "mac")}>
              <Download className="size-3.5" /> {w.file}
            </GhostButton>
            {os === "mac" && (
              <TextButton onClick={() => downloadPlist(w, viewer)}>
                <FileDown className="size-3.5" /> Trigger .plist
              </TextButton>
            )}
          </div>
        </section>

        <section className="space-y-2">
          <Label>Shared with · inside Juniper, one step at a time</Label>
          <ShareRow w={w} />
        </section>
      </div>
    </div>
  );
}
