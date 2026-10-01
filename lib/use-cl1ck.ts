"use client";

import { useEffect, useMemo, useState } from "react";
import { INITIAL_EMAILS, QUEUED_EMAILS, BILL_FORM_FIELDS, TEAM_RULES } from "./seed";
import { cluster, fieldOverlap, learnRules, median, mergeRules, segment } from "./miner";
import { propose, KEYS, NO_EVENTS } from "./automation";
import { normalize } from "./trace";
import { useStored } from "./store";
import type { Email, Episode, MergedRule } from "./types";

export const DISCOVERY_THRESHOLD = 2; // production would use 5 runs in 60 days at 90% consistency

const ALL_EMAILS = [...INITIAL_EMAILS, ...QUEUED_EMAILS];

export type FieldCheck = { field: string; yours: string; auto: string; match: boolean | null };

// Dry run: replay the workflow on each email you handled by hand and compare field by field.
export function dryRun(episodes: Episode[], rules: MergedRule[]) {
  return episodes
    .filter((e) => e.emailId)
    .map((ep) => {
      const email = ALL_EMAILS.find((m) => m.id === ep.emailId) as Email | undefined;
      const auto = email ? propose(email, rules) : {};
      const checks: FieldCheck[] = Object.entries(ep.fields).map(([field, f]) => {
        const proposed = auto[field]?.value ?? "";
        const freeText = f.shape === "text" && !f.trace && !/Vendor|GL Account/.test(field);
        return {
          field,
          yours: f.value,
          auto: proposed,
          match: freeText ? null : normalize(proposed, f.shape) === normalize(f.value, f.shape),
        };
      });
      const scored = checks.filter((c) => c.match !== null);
      return { episode: ep, checks, ok: scored.every((c) => c.match), scored: scored.length };
    });
}

export function useCl1ck() {
  const events = useStored(KEYS.events, NO_EVENTS);
  return useMemo(() => {
    const episodes = segment(events);
    const clusters = cluster(episodes);
    const bill = clusters.find((c) => fieldOverlap(c.fieldLabels, BILL_FORM_FIELDS) >= 0.5);
    const personal = bill ? learnRules(bill) : [];
    const rules = mergeRules(personal, TEAM_RULES, BILL_FORM_FIELDS);
    const myRuns = bill?.episodes ?? [];
    const myMedian = median(myRuns.map((e) => e.seconds));
    const discovered = myRuns.length >= DISCOVERY_THRESHOLD;
    return {
      events,
      episodes,
      clusters,
      bill,
      personal,
      rules,
      myRuns,
      myMedian,
      discovered,
      manualSeconds: myMedian || 250,
      others: clusters.filter((c) => c !== bill),
    };
  }, [events]);
}

export function useNow(intervalMs = 5000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}
