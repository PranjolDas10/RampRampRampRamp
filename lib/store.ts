"use client";

// Tiny persistent store on localStorage. Every write notifies this tab directly and other
// tabs through the "storage" event, so Ledgerline and the dashboard stay in sync live.
import { useSyncExternalStore } from "react";

const PREFIX = "cl1ck:";
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function emit() {
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (!e.key || e.key.startsWith(PREFIX)) emit();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PREFIX + key);
  } catch {
    raw = null;
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T = fallback;
  if (raw != null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  cache.set(key, { raw, value });
  return value;
}

export function write<T>(key: string, value: T) {
  const raw = JSON.stringify(value);
  try {
    localStorage.setItem(PREFIX + key, raw);
  } catch {
    // storage full or blocked: keep the in-memory copy so the demo still works
  }
  cache.set(key, { raw, value });
  emit();
}

export function update<T>(key: string, fallback: T, fn: (prev: T) => T) {
  write(key, fn(read(key, fallback)));
}

export function useStored<T>(key: string, fallback: T): T {
  return useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );
}

export function resetAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
  cache.clear();
  emit();
}

const noop = () => () => {};
export function useIsClient() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
