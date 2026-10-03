import Link from "next/link";

export function PageIntro({
  title,
  children,
  sampleNote = true,
}: {
  title: string;
  children: React.ReactNode;
  sampleNote?: boolean;
}) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-[32px] leading-[1.1] text-ink sm:text-[40px]">{title}</h1>
        <Link href="/" className="text-xs text-ash hover:text-ink">
          ← What is cl1ck?
        </Link>
      </div>
      <div className="max-w-[62ch] space-y-1.5 text-sm text-ash">{children}</div>
      {sampleNote && (
        <p className="max-w-[62ch] rounded-md border border-hairline bg-paper px-3 py-2 text-[11px] text-ash">
          <span className="text-ink">Sample data · </span>
          Juniper Coffee Roasters, its teammates and its history are sample data. Everything you do in the demo runs
          through the real engine.
        </p>
      )}
    </section>
  );
}
