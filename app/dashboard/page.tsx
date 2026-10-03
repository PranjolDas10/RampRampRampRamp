import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { Dashboard } from "@/components/cl1ck/dashboard";

export const metadata: Metadata = { title: "cl1ck · Dashboard" };

export default function DashboardPage() {
  return (
    <ClientOnly>
      <Dashboard />
    </ClientOnly>
  );
}
