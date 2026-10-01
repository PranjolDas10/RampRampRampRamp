# Workflow Auto-Suggester & Automation Store

A feature for a spend management platform (e.g. Ramp) that watches how finance teams work, spots repeated manual workflows, and suggests automations for them. Automations can be tested safely, switched on with guardrails, and shared across a company, with accounting firms, or publicly as templates.

**Goal:** save customers time (fewer manual steps) and money (fewer errors, faster approvals, caught anomalies), for both small and large companies.

---

## 1. Feature list

### Core: auto-suggester
| Feature | What it does |
|---|---|
| Pattern detection | Notices when users repeat the same sequence of actions on similar records (e.g. same vendor, same category). |
| Intent-aware suggestions | Looks at what data changed, not just which buttons were clicked, so one-off fixes aren't mistaken for rules. |
| Evidence-backed prompts | Shows why it's suggesting something: "You coded 14 AWS bills to Cloud Software this quarter." |
| Dry-run / replay | Replays the proposed automation against past records and shows what it would have done before going live. |
| Guardrails | Amount limits, "notify instead of act" mode, auto-pause on anomalies (new bank details, unusual amount). |
| Smart nagging limits | Stops suggesting a pattern after it's dismissed twice; respects per-user snooze. |

### Automation store
| Feature | What it does |
|---|---|
| Company store | Share automations internally so teams and entities use the same processes. |
| Accountant store | Accounting firms publish templates to all their client companies. |
| Public store | Anonymised templates anyone can install, reviewed before listing. |
| Template stripping | Removes vendor names, account codes, amounts and people before sharing; installer maps their own values. |
| Versioning & ratings | Track template versions, installs, and ratings; notify installers of updates. |

### Supporting features
| Feature | What it does |
|---|---|
| Natural-language builder | "When a bill from a new vendor arrives, send it to Sarah first" becomes an automation. |
| Time-saved report | Monthly report of manual hours spent and hours saved by automations. |
| Anomaly alerts | Flags duplicate invoices, price jumps, and changed vendor bank details. |
| Approval bottleneck insights | Finds slow approvers and suggests delegates, parallel approval, or thresholds. |
| Early-payment discount finder | Spots invoices with early-pay discounts and suggests paying early when cash allows. |
| Subscription overlap finder | Detects duplicate tools and unused seats across cards and bills. |
| Audit log | Records who created, edited, enabled or ran each automation, and what it changed. |

### Who benefits most
- **Small companies:** auto-suggester, natural-language builder, accountant templates (no ops person to design workflows).
- **Large companies:** company store (standardisation), bottleneck insights, anomaly alerts, audit log.

---

## 2. Architecture overview

```
┌──────────────┐    events    ┌───────────────┐   sessions   ┌──────────────────┐
│  Web / app   │ ───────────▶ │ Event pipeline│ ───────────▶ │ Pattern miner    │
│  (UI events) │              │ (Kafka etc.)  │              │ (batch + stream) │
└──────────────┘              └───────────────┘              └────────┬─────────┘
                                                                      │ candidates
                                                                      ▼
┌──────────────┐  approve    ┌───────────────┐   scored     ┌──────────────────┐
│ Suggestion UI│ ◀────────── │ Dry-run engine│ ◀─────────── │ Rule synthesiser │
└──────┬───────┘             └───────────────┘              └──────────────────┘
       │ enable
       ▼
┌──────────────┐   triggers   ┌───────────────┐
│ Automation   │ ◀─────────── │ Domain events │  (bill created, card txn, etc.)
│ engine       │ ───────────▶ │ + audit log   │
└──────────────┘   actions    └───────────────┘
       │
       ▼
┌──────────────┐
│ Automation   │  company / accountant / public templates
│ store        │
└──────────────┘
```

---

## 3. How to build it

### Step 1: Capture the right events

Log **semantic actions**, not raw clicks. A click on "Approve" is useful only with context.

```json
{
  "event_id": "evt_123",
  "company_id": "co_456",
  "user_id": "usr_789",
  "timestamp": "2026-10-01T09:14:22Z",
  "action": "bill.update_field",
  "object_type": "bill",
  "object_id": "bill_001",
  "context": {
    "vendor_id": "ven_aws",
    "amount": 1240.50,
    "currency": "USD",
    "category": "software",
    "entity_id": "ent_us"
  },
  "change": { "field": "gl_account", "from": null, "to": "6100" }
}
```

Tips:
- Define a fixed vocabulary of actions (`bill.approve`, `bill.update_field`, `bill.assign_approver`, `po.create`, `card.set_limit`, etc.).
- Record the before/after values for edits; this is what turns clicks into rules.
- Exclude sensitive fields (bank details, card numbers) from the event stream entirely.

### Step 2: Group events into sessions

Group a user's actions on the same object (or a short time window) into a **workflow instance**:

```
bill_001: [open] → [update gl_account=6100] → [assign_approver=finance_lead] → [approve]
```

Simple rule to start: same user + same object + gap under 30 minutes = one session.

### Step 3: Mine repeated patterns

Find sequences that repeat across many objects with similar context.

**Version 1 (simple, recommended to start):**
1. Normalise each session into a signature: list of actions + changed fields.
2. Group sessions by signature.
3. Within each group, find context attributes that are constant (e.g. `vendor_id = ven_aws` in 95% of cases).
4. Keep groups that meet thresholds:
   - repeated at least **5 times** in the last **60 days**
   - outcome is consistent in at least **90%** of cases
   - performed by the same team or role

**Version 2 (later):**
- Sequential pattern mining (PrefixSpan, SPADE) for longer, messier sequences.
- Decision-tree learning to find the conditions that predict an action ("if category = software and amount < $5k, then GL = 6100").

### Step 4: Turn patterns into rules

Convert each pattern into a trigger → condition → action rule:

```yaml
name: Code AWS bills to Cloud Software
trigger: bill.created
conditions:
  - field: vendor_id
    equals: ven_aws
actions:
  - set_field: { field: gl_account, value: "6100" }
  - assign_approver: { role: finance_lead }
guardrails:
  max_amount: 5000
  mode: act            # or "suggest" / "notify_only"
  pause_on: [vendor_bank_change, amount_over_3x_average]
evidence:
  occurrences: 14
  consistency: 0.97
  window_days: 60
```

Score each candidate:

```
score = occurrences × consistency × time_saved_per_run × (1 − risk)
```

where `risk` is higher for actions that move money (approve, pay) and lower for actions that only label data (set GL code, add tag).

### Step 5: Dry-run engine

Before suggesting, replay the rule over historical records:
- How many records would it have matched?
- How many times would it have done exactly what the user did?
- Where would it have differed? (Show these to the user.)

Only surface suggestions with **≥ 90% agreement**. Show the mismatches in the suggestion card so users can adjust conditions.

### Step 6: Suggestion UI

The card should show:
1. Plain-English summary: "Automatically code AWS bills to 6100 and send to Finance Lead."
2. Evidence: "You've done this 14 times since August."
3. Dry-run result: "Would have matched 14 bills, correct on 14."
4. Estimated savings: "About 25 minutes per month."
5. Buttons: **Turn on**, **Turn on in notify-only mode**, **Edit**, **Not now**, **Never suggest this**.

Show suggestions in context (on the bill page after the 5th repetition) and in a weekly digest, not as pop-ups.

### Step 7: Automation engine

- Subscribe to domain events (`bill.created`, `card.transaction`, `po.approved`).
- Evaluate enabled rules for that company in priority order.
- Execute actions idempotently (re-running must not double-pay or double-assign).
- Check guardrails before each action; if one trips, pause the rule and notify the owner.
- Write every run to the audit log: rule version, inputs, actions taken, result.

**Permissions:** an automation can never do more than its creator is allowed to do. If the creator loses approval rights, their automations that approve are paused.

### Step 8: Automation store

**Template stripping:** before publishing, replace specific values with placeholders.

```yaml
# Company version
conditions: [{ field: vendor_id, equals: ven_aws }]
actions:    [{ set_field: { field: gl_account, value: "6100" } }]

# Published template
conditions: [{ field: vendor_id, equals: "{{vendor}}" }]
actions:    [{ set_field: { field: gl_account, value: "{{software_gl_account}}" } }]
```

On install, the user maps placeholders to their own vendors, accounts and people.

**Visibility levels:**
| Level | Who can see | Review |
|---|---|---|
| Private | Creator only | None |
| Company | Everyone in the company | Admin approval |
| Accountant | Firm's client companies | Firm admin |
| Public | Everyone | Platform review + automated checks |

**Public template safety checks:**
- Block templates that change bank details, payee information, or payment destinations.
- Block templates that auto-approve without an amount limit.
- Scan for leftover company data (names, emails, account numbers).
- Allow reporting and takedown.

### Step 9: Supporting features (build order)

1. **Audit log**: needed from day one for trust and compliance.
2. **Time-saved report**: aggregate session durations before and after automation.
3. **Anomaly alerts**: start with rules (duplicate invoice number + vendor + amount; bank detail change; amount > 3× vendor average), add ML later.
4. **Approval bottleneck insights**: median time-in-queue per approver; suggest delegates or thresholds.
5. **Natural-language builder**: LLM converts text to the rule YAML above, always followed by dry-run and user confirmation.
6. **Early-payment discount finder**: parse invoice terms ("2/10 net 30") and compare with cash balance.
7. **Subscription overlap finder**: cluster vendors by category and flag overlaps or unused seats.

---

## 4. Data model (simplified)

```
events(event_id, company_id, user_id, ts, action, object_type, object_id, context_json, change_json)
sessions(session_id, company_id, user_id, object_id, signature, started_at, ended_at)
patterns(pattern_id, company_id, signature, conditions_json, occurrences, consistency, last_seen)
suggestions(suggestion_id, pattern_id, user_id, status, dismiss_count, shown_at)
automations(automation_id, company_id, owner_id, rule_yaml, version, mode, enabled, created_at)
automation_runs(run_id, automation_id, version, trigger_event_id, actions_json, result, ts)
templates(template_id, source_automation_id, visibility, template_yaml, placeholders_json, installs, rating)
```

---

## 5. Privacy & security

- Never log bank details, card numbers or personal IDs in the event stream.
- Pattern mining runs **per company**; no customer's data trains suggestions for another customer unless anonymised and aggregated.
- Public templates contain placeholders only, never real values.
- Automations inherit and are capped by their owner's permissions.
- Money-moving actions (approve, pay) default to notify-only mode until the user explicitly enables them.
- Full audit trail for every automation change and run.

---

## 6. Metrics to track

- **Suggestion acceptance rate** (accepted / shown)
- **Undo rate** (runs reversed by a user; key trust signal)
- **Hours saved per company per month**
- **Approval cycle time** (before vs after)
- **Money saved** (caught duplicates, early-pay discounts captured, cancelled overlapping subscriptions)
- **Template installs** (company, accountant, public)
- **Guardrail trips** (how often automations pause themselves)
