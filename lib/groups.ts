// Org structure helpers: which groups a workflow covers, and how far a share can reach.
import { BILL_WORKFLOW_ID, ORG_TREE, findNode, relation, type OrgNode } from "./seed";

export function parentId(id: string): string | null {
  if (id === "me") return "ap";
  const walk = (node: OrgNode, parent: OrgNode | null): string | null | undefined => {
    if (node.id === id) return parent?.id ?? null;
    for (const c of node.children ?? []) {
      const r = walk(c, node);
      if (r !== undefined) return r;
    }
    return undefined;
  };
  return walk(ORG_TREE, null) ?? null;
}

export function ancestors(id: string) {
  const out: string[] = [];
  let cur: string | null = id;
  while (cur) {
    out.push(cur);
    cur = parentId(cur);
  }
  return out;
}

// A workflow covers a group if it was turned on for that group or anything above it.
export function coveredBy(adoption: Record<string, string[]>, workflowId: string, groupId: string) {
  const on = adoption[workflowId] ?? [];
  return ancestors(groupId).find((g) => on.includes(g)) ?? null;
}

export function groupName(id: string) {
  if (id === "me") return "you";
  return findNode(id)?.name ?? id;
}

export function shareTargets(from: string) {
  const all: { node: OrgNode; rel: ReturnType<typeof relation> }[] = [];
  const walk = (n: OrgNode) => {
    all.push({ node: n, rel: relation(from, n.id) });
    (n.children ?? []).forEach(walk);
  };
  walk(ORG_TREE);
  return all.filter((x) => x.node.id !== from);
}

export const WORKFLOW_NAMES: Record<string, string> = {
  [BILL_WORKFLOW_ID]: "Bill from email",
  "categorize-card": "Card categorizing",
  "chase-overdue": "Overdue reminders",
  "approve-po": "PO approvals",
  "kpi-report": "KPI report",
  "bank-statements": "Bank statements",
  "after-interview": "Interview follow-up",
  "ticket-to-merge": "Ticket → PR",
  "after-call": "Call logging",
  "ticket-triage": "Ticket triage",
};
