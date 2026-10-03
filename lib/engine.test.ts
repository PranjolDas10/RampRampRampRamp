import { describe, expect, it } from "vitest";
import { isSensitive } from "./recorder";
import { buildSandbox } from "./sandbox";
import { BILL_FORM_FIELDS, INITIAL_EMAILS, QUEUED_EMAILS, emailLines } from "./seed";

describe("engine pipeline", () => {
  const sb = buildSandbox();

  it("segments two manual entries into two tasks and groups them as one pattern", () => {
    expect(sb.episodes).toHaveLength(2);
    expect(sb.clusters).toBe(1);
    expect(sb.similarity).toBeGreaterThan(0.5);
  });

  it("learns that invoice fields are copied from labels on the email", () => {
    const invoiceNo = sb.personal.find((r) => r.field === "Invoice No.");
    expect(invoiceNo?.kind).toBe("extract");
  });

  it("dry run reproduces every non-free-text field the person typed", () => {
    const checks = sb.dryRun.flatMap((d) => d.checks).filter((c) => c.match !== null);
    expect(checks.length).toBeGreaterThan(0);
    expect(checks.every((c) => c.match)).toBe(true);
  });

  it("guardrails post, hold and block the queued invoices", () => {
    expect(sb.outcomes.map((o) => o.status).sort()).toEqual(["Blocked", "Held", "Posted"]);
    const protectedTotal = sb.outcomes.reduce((s, o) => s + o.protectedAmount, 0);
    expect(protectedTotal).toBeGreaterThan(0);
  });

  it("impact numbers from the sandbox are non-zero", () => {
    expect(sb.episodes.reduce((s, e) => s + e.seconds, 0)).toBeGreaterThan(0);
    expect(sb.outcomes.some((o) => o.status === "Blocked")).toBe(true);
  });

  it("learns an unfamiliar layout's labels so the next invoice needs no model call", () => {
    expect(sb.unfamiliar.missing.length).toBeGreaterThan(0);
    expect(sb.unfamiliar.next.filled.length).toBeGreaterThanOrEqual(sb.unfamiliar.missing.length);
  });
});

describe("recorder privacy", () => {
  it("skips bank, card and identity fields", () => {
    for (const label of ["Bank account number", "Routing #", "IBAN", "Card number", "SSN", "Tax ID"]) {
      expect(isSensitive(label), label).toBe(true);
    }
    expect(isSensitive("Name on card", "cc-name")).toBe(true);
  });

  it("still records the bill form", () => {
    for (const field of BILL_FORM_FIELDS) expect(isSensitive(field), field).toBe(false);
  });
});

it("every seed email fits the /api/extract input cap", () => {
  for (const email of [...INITIAL_EMAILS, ...QUEUED_EMAILS]) {
    const lines = emailLines(email);
    expect(lines.length).toBeLessThanOrEqual(200);
    expect(Math.max(...lines.map((l) => l.length))).toBeLessThanOrEqual(500);
  }
});
