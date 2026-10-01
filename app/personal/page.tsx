import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { PersonalDemo } from "@/components/personal/personal-demo";

export const metadata: Metadata = { title: "cl1ck · Personal" };

export default function PersonalPage() {
  return (
    <ClientOnly>
      {/* The repo path lets "Run on this Mac" open this project in VS Code via a vscode:// link. */}
      <PersonalDemo repoPath={process.cwd()} />
    </ClientOnly>
  );
}
