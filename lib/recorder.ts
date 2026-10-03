// Generic DOM recorder. It knows nothing about Ledgerline: it reads labels, roles and on-screen
// text, so the same script could run as a browser extension content script on any web app.
import { uid } from "./format";
import { clean, detectShape, makeSnapshot, traceValue, type Seen } from "./trace";
import type { CapturedEvent, Shape } from "./types";

type Options = {
  root: HTMLElement;
  app: (route: string) => string;
  getRoute: () => string;
  emit: (event: CapturedEvent) => void;
};

const IGNORE = "[data-cl1ck]";

// The recorder runs on apps we don't own, so it can't rely on them marking private fields.
const SENSITIVE = /bank|iban|swift|routing|account\s*(no|num)|card|cvv|cvc|ssn|\bsin\b|tax\s*id|password|passcode|\bpin\b/i;

export function isSensitive(label: string, autocomplete = "") {
  return SENSITIVE.test(label) || /^cc-|password/.test(autocomplete);
}

function labelOf(el: HTMLElement) {
  const input = el as HTMLInputElement;
  const text =
    input.labels?.[0]?.textContent ??
    el.getAttribute("aria-label") ??
    el.getAttribute("name") ??
    el.id ??
    "";
  return clean(text).replace(/[\s*:]+$/, "");
}

function clickLabel(el: HTMLElement) {
  const text = el.getAttribute("aria-label") ?? el.dataset.usLabel ?? el.innerText ?? "";
  const line = text.split("\n").map(clean).find((l) => /[a-z]/i.test(l)) ?? "";
  return line.replace(/^[^a-z0-9]+/i, "").slice(0, 40);
}

export function startRecorder({ root, app, getRoute, emit }: Options) {
  // Screens seen during the current task, and values typed so far. Reset after each save.
  let seen: Seen[] = [];
  let typed: { value: string; shape: Shape }[] = [];
  const timers = new Set<number>();
  const before = new WeakMap<EventTarget, string>(); // value when the field got focus, for before/after

  const send = (e: Omit<CapturedEvent, "id" | "ts" | "app" | "route"> & { ts?: number; route?: string }) => {
    const route = e.route ?? getRoute();
    emit({ id: uid("ev"), ts: e.ts ?? Date.now(), app: app(route), route, ...e });
  };

  const later = (fn: () => void, ms: number) => {
    const t = window.setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };

  const inScope = (target: EventTarget | null): target is HTMLElement =>
    target instanceof HTMLElement && root.contains(target) && !target.closest(IGNORE);

  const onClick = (e: MouseEvent) => {
    if (!inScope(e.target)) return;
    const el = e.target.closest<HTMLElement>("button, a, [role=button], [role=tab], [role=treeitem], [data-us-click]");
    if (!el || (el.closest("form") && el.getAttribute("type") === "submit")) return;
    const label = clickLabel(el);
    if (label) send({ type: "click", label });
  };

  const onFocus = (e: FocusEvent) => {
    if (!inScope(e.target)) return;
    const el = e.target as HTMLInputElement | HTMLSelectElement;
    if ("value" in el) before.set(el, el instanceof HTMLSelectElement ? (el.selectedOptions[0]?.text ?? "") : el.value);
  };

  const onChange = (e: Event) => {
    if (!inScope(e.target)) return;
    const el = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (!("value" in el)) return;
    if ((el as HTMLInputElement).type === "password" || el.dataset.usPrivate !== undefined) return;
    const label = labelOf(el);
    if (isSensitive(`${label} ${el.getAttribute("name") ?? ""}`, el.getAttribute("autocomplete") ?? "")) return;
    const value = el instanceof HTMLSelectElement ? (el.selectedOptions[0]?.text ?? "") : el.value;
    if (!label || !value.trim()) return;
    const shape = detectShape(value, label);
    typed.push({ value, shape });
    const route = getRoute();
    const from = before.get(el) || undefined;
    before.set(el, value);
    send({ type: "change", label, value, from, shape, trace: traceValue(value, shape, route, seen, typed) });
  };

  const onCopy = () => {
    const selection = document.getSelection();
    if (!selection?.anchorNode || !root.contains(selection.anchorNode)) return;
    const text = clean(selection.toString()).slice(0, 80);
    if (text) send({ type: "copy", value: text, shape: detectShape(text) });
  };

  const onPaste = (e: ClipboardEvent) => {
    if (!inScope(e.target)) return;
    const text = clean(e.clipboardData?.getData("text") ?? "").slice(0, 80);
    if (text) send({ type: "paste", label: labelOf(e.target), value: text, shape: detectShape(text) });
  };

  // A save "worked" if the form is gone shortly after submit. No app-specific hooks needed.
  const onSubmit = (e: SubmitEvent) => {
    if (!inScope(e.target)) return;
    const form = e.target as HTMLFormElement;
    const label = clean(form.getAttribute("aria-label") ?? e.submitter?.textContent ?? "Submit");
    const ts = Date.now();
    const route = getRoute();
    later(() => {
      if (form.isConnected) {
        send({ type: "submit_failed", label, ts, route });
      } else {
        send({ type: "submit", label, ts, route });
        seen = [];
        typed = [];
      }
    }, 400);
  };

  document.addEventListener("focusin", onFocus, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("change", onChange, true);
  document.addEventListener("copy", onCopy, true);
  document.addEventListener("paste", onPaste, true);
  document.addEventListener("submit", onSubmit, true);

  return {
    // Called by the host on every screen change; snapshots what's visible after it paints.
    navigate(route: string) {
      send({ type: "navigate", route });
      later(() => {
        if (getRoute() !== route) return;
        const main = root.querySelector<HTMLElement>("[data-us-main]") ?? root;
        const title = clean(main.querySelector("h1, h2")?.textContent ?? route);
        const snapshot = makeSnapshot(title, main.innerText.split("\n"));
        if (!snapshot.tokens.length) return;
        seen.push({ route, snapshot });
        if (seen.length > 12) seen = seen.slice(-12);
        send({ type: "view", route, label: title, snapshot });
      }, 80);
    },
    automation(label: string) {
      send({ type: "automation", label });
    },
    stop() {
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("change", onChange, true);
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("submit", onSubmit, true);
      timers.forEach((t) => window.clearTimeout(t));
    },
  };
}

export type Recorder = ReturnType<typeof startRecorder>;
