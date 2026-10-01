import { ClientOnly } from "@/components/client-only";
import { Dashboard } from "@/components/cl1ck/dashboard";

export default function Home() {
  return (
    <ClientOnly>
      <Dashboard />
    </ClientOnly>
  );
}
