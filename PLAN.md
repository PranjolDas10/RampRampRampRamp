# cl1ck: merged plan

**Sources merged:** the planning thread (team layers, org tree, one-gap sharing, monitoring sources), `so_locked_in/workflow-auto-suggester.md`, and `DESIGN.md` (styling, low priority).

**One line:** cl1ck watches how people work, finds the work a *team* repeats (including the private shortcuts people never share), and turns it into automations the whole group runs, up to the entire organization and never outside it.

**Judging criteria → what we show**

| Criterion | Proof in the demo |
|---|---|
| Time & money | Hours/week measured from real task timings; time saved per run; money protected (duplicate invoices blocked, early-pay discounts found) |
| Technical depth | Generic DOM recorder → value tracing across screens → task segmentation → sequence-alignment clustering → rule learning (copy-from-label, functional dependencies) → dry run → guardrails → team merge; Claude only where rules can't reach |
| Business & customer impact | Team-first: one person's pattern becomes everyone's workflow; private shortcuts get promoted; turn on per team / department / org; share one step at a time |

## What the demo is (built, runs locally)

- `/ledgerline`: a deliberately clunky accounting app (AP inbox + bills) with the recorder running in-page.
- `/`: the cl1ck dashboard, with layers *Org → Finance → Accounts Payable → Me*, workflows per layer, "Turn on for {group}", private shortcuts, audit log, live monitoring feed, org map, workflow detail with alignment table, learned rules, guardrails, team decision, dry run, sharing, rule YAML, and plain-English editing via Claude.
- `/personal`: personal developer routine (being built by an agent).
- Use cases page: accounting file conversion, focus-music workspace, month-end relay across teams.

Everything except the plain-English editor and unfamiliar-invoice reads is deterministic and free. State lives in localStorage, so the dashboard and Ledgerline stay in sync across tabs.

## The pipeline (best of both sources)

1. **Capture.** Semantic events, not raw clicks (doc): field edits with before → after values, submits, navigations, copy/paste, plus a snapshot of values on screen. The recorder is generic (labels, roles, visible text), so the same script works as a browser-extension content script on apps we don't own. When we do own the app, platform domain events (doc's `bill.update_field`) are the more reliable source. Use both. Passwords and bank fields are never captured, recording can be paused, and values can be masked.
2. **Trace values.** For each typed value, find the earlier screen it appeared on and the label next to it ("Invoice #", "Total due"). Prefer `Label: value` lines; ignore labels that contain values. This is what turns clicks into rules without anyone mapping fields.
3. **Tasks.** A successful save ends a task (the form disappears); idle gaps over 3 minutes reset. The doc's alternative (same object + 30-minute window) works for platform events.
4. **Mine.** Tasks become step sequences compared by edit distance and grouped. Production thresholds come from the doc: ≥ 5 runs in 60 days at ≥ 90% consistency. The demo uses 2 so it triggers on stage.
5. **Learn rules.** Each field is either *copied from a label*, *constant*, *decided by another field* (functional dependency, e.g. Vendor → GL account), or *ask a person*. Personal evidence wins when strong, team rules fill gaps, and agreement is shown ("You + team agree").
6. **Score.** `occurrences × consistency × time_saved_per_run × (1 − risk)`, where risk is higher for money-moving actions (doc).
7. **Dry run.** Replay on past records and compare field by field. Suggest only at ≥ 90% agreement and show the mismatches (doc).
8. **Suggest in context.** In-app card after the pattern forms, plus Turn on / Notify only / Not now / Never suggest. Stop after two dismissals (doc).
9. **Run with guardrails.** Hold over the team's approval limit, block duplicate invoices, pause on amounts over 3× the vendor average, never touch bank details, never exceed the owner's permissions. Every run is written to the audit log with the rule version, and undo voids the bill.
10. **Group layers.** Personal → team (main suggestion source) → department → org. Each layer only sees pattern templates from the layer below. Turning a workflow on at a level covers every group under it.
11. **Share, one gap max.** A team shares only to its parent, its children, or its siblings. The receiving team dry-runs on its own history before adopting. Shared versions are templates with vendor names, amounts and people stripped (doc).
12. **Claude, surgically.** (a) Plain-English rule edits → structured change → re-dry-run (doc's natural-language builder). (b) Unfamiliar document layouts: Claude reads once, cl1ck learns the labels, and the next document from that sender is free (being built by an agent).

## Decisions where the sources disagreed

| Topic | Doc | Thread | Decision |
|---|---|---|---|
| Store scope | Company, accountant and public stores | Everything org-scoped | **Org only.** Template stripping kept for team-to-team sharing. Accountant/public is future work. |
| Capture | Platform domain events | Generic DOM recorder + value tracing | **Both.** DOM recorder for third-party apps, domain events where we own the app. |
| Thresholds | 5 runs / 60 days / 90% | Demo needs it live | 5/60/90 in production, **2 in demo mode**. |
| AI | NL builder uses an LLM | No credits at first | Deterministic core. **Claude only for NL edits and unfamiliar layouts**, a few cents each. |
| Suggestion target | User-level | Team-level | **Team-first.** Personal patterns merge into the team's workflow; private shortcuts get promoted. |
| Styling | DESIGN.md (light, chartreuse accent) | Dark, emerald accent | Low priority: re-skin if time allows. |

## Real vs hardcoded in the demo

- **Real:** recorder, value tracing, task segmentation, clustering, rule learning, rule merge, dry run on your own runs, guardrails (duplicates, limit, early-pay), audit log and undo, cross-tab live updates, Claude NL edit.
- **Hardcoded:** team history (212 runs, 24/25 dry run), teammates and their shortcuts, Finance/Org patterns, share dry-run results, other data sources (extension, shell, GitHub), use cases.

## Metrics we'd track (doc)

Suggestion acceptance rate, undo rate (trust), hours saved per team per month, approval cycle time, money saved (duplicates, discounts), template installs across teams, guardrail trips.

## Run it

```bash
npm install
npm run dev           # http://localhost:3000 (dashboard), /ledgerline, /personal
# .env needs CLAUDE_API_KEY for the two Claude features; everything else works without it
```

See `DEMO.md` for the 90-second script.
