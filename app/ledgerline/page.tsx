import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { Ledgerline } from "@/components/ledgerline/ledgerline";
import "./ledgerline.css";

export const metadata: Metadata = { title: "Ledgerline Enterprise 8.2" };

export default function LedgerlinePage() {
  return (
    <ClientOnly>
      <Ledgerline />
    </ClientOnly>
  );
}
