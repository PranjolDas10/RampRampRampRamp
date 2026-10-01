import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { Walkthrough } from "@/components/sandbox/walkthrough";

export const metadata: Metadata = { title: "cl1ck · Sandbox" };

export default function SandboxPage() {
  return (
    <ClientOnly>
      <Walkthrough />
    </ClientOnly>
  );
}
