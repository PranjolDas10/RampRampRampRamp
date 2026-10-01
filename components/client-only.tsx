"use client";

import { useIsClient } from "@/lib/store";

// Everything in this demo lives in localStorage, so render it on the client only.
export function ClientOnly({ children }: { children: React.ReactNode }) {
  const isClient = useIsClient();
  return isClient ? <>{children}</> : null;
}
