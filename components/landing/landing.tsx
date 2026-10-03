"use client";

import Link from "next/link";
import { ArrowRight, Eye, Shield, Sparkles } from "lucide-react";
import { Label } from "@/components/cl1ck/bits";

const STEPS = [
  {
    icon: Eye,
    title: "Watch",
    body: "cl1ck records what people type and where each value came from, without anyone mapping fields.",
  },
  {
    icon: Sparkles,
    title: "Learn",
    body: "After a few repeats, it turns the pattern into a rule, proves it on past work, then offers to take over.",
  },
  {
    icon: Shield,
    title: "Automate safely",
    body: "Guardrails block duplicates, hold big amounts, and never touch bank details. Every run can be undone.",
  },
];

const DIVES = [
  {
    href: "/dashboard",
    title: "Team dashboard",
    body: "What a manager sees: every repeated task, hours saved, and which workflows are on.",
  },
  {
    href: "/sandbox",
    title: "How the engine works",
    body: "Step through capture, tracing, clustering, dry run and guardrails on fixed demo data.",
  },
  {
    href: "/personal",
    title: "Developer routines",
    body: "The same idea for engineering: one person's morning setup, shared and runnable by the team.",
  },
];

export function Landing() {
  return (
    <div className="min-h-screen bg-bone text-ink">
      <header className="border-b border-hairline bg-paper">
        <div className="mx-auto flex max-w-[960px] items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-ink">
            <span className="flex size-6 items-center justify-center rounded-md bg-ink text-[13px] text-highlight">1</span>
            cl1ck
          </Link>
          <nav className="hidden items-center gap-1 text-sm text-ash sm:flex">
            <Link href="/dashboard" className="rounded-md px-3 py-1.5 hover:text-ink">
              Dashboard
            </Link>
            <Link href="/sandbox" className="rounded-md px-3 py-1.5 hover:text-ink">
              Engine
            </Link>
            <Link href="/personal" className="rounded-md px-3 py-1.5 hover:text-ink">
              Personal
            </Link>
            <a
              href="https://github.com/PranjolDas10/RampRampRampRamp"
              target="_blank"
              rel="noreferrer"
              className="rounded-md px-3 py-1.5 hover:text-ink"
            >
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[960px] space-y-16 px-6 py-14">
        <section className="space-y-6">
          <Label>Workflow auto-suggester</Label>
          <h1 className="max-w-[18ch] text-[44px] leading-[1.05] text-ink sm:text-[52px]">
            Your team repeats the same work every day. cl1ck turns it into guarded automations.
          </h1>
          <p className="max-w-[52ch] text-base text-ash">
            It watches how people work, finds the pattern, proves it on past records, then runs it for the whole team —
            with guardrails that block duplicates and never touch bank details.
          </p>
          <p className="text-xs text-ash md:hidden">Best experienced on a laptop — the guided tour uses a full desktop layout.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/ledgerline?tour=1"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-highlight px-5 text-sm text-ink hover:bg-[#d6e41a]"
            >
              Try it in 2 minutes <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-ink/80 px-4 text-sm text-ink hover:bg-paper"
            >
              Skip to dashboard
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-hairline bg-paper p-5">
              <Icon className="size-4 text-ink" />
              <h2 className="mt-3 text-base text-ink">{title}</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-ash">{body}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-hairline bg-paper px-6 py-5">
          <Label>What you&apos;ll see in the tour</Label>
          <ul className="mt-3 space-y-2 text-sm text-ink">
            <li>A 4-minute invoice task becomes one click after two manual runs.</li>
            <li>A duplicate invoice gets blocked before money moves.</li>
            <li>AI is used once, only for a layout the rules have never seen — then that vendor is free.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <Label>Deeper dives</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            {DIVES.map((d) => (
              <Link
                key={d.href}
                href={d.href}
                className="group rounded-2xl border border-hairline bg-paper p-5 transition-colors hover:border-ink"
              >
                <h3 className="text-base text-ink group-hover:underline">{d.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-ash">{d.body}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline bg-paper">
        <div className="mx-auto max-w-[960px] space-y-3 px-6 py-8 text-xs text-ash">
          <p>
            Built at the Ramp hackathon.{" "}
            <a
              href="https://github.com/PranjolDas10/RampRampRampRamp"
              className="text-ink underline"
              target="_blank"
              rel="noreferrer"
            >
              Source on GitHub
            </a>
            .
          </p>
          <p>
            Juniper Coffee Roasters, its teammates and its history are sample data. Everything you do in the demo runs
            through the real engine — recorder, rule learning, dry run, guardrails.
          </p>
        </div>
      </footer>
    </div>
  );
}
