"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type CodeFile = { name: string; path: string; body: string };

// Obsidian code block with file tabs. Lines holding a {{placeholder}} are where each
// teammate's own values went in.
export function CodeView({ files, maxHeight = 360 }: { files: CodeFile[]; maxHeight?: number }) {
  const [file, setFile] = useState(0);
  const f = files[Math.min(file, files.length - 1)];
  const lines = f.body.split("\n");
  return (
    <div className="overflow-hidden rounded-2xl bg-obsidian text-paper">
      <div className="flex items-center gap-1 border-b border-paper/10 px-2 pt-2">
        {files.map((x, i) => (
          <button
            key={x.name}
            onClick={() => setFile(i)}
            className={cn("rounded-t-md px-2.5 py-1.5 font-mono text-[11px]", file === i ? "bg-paper/10 text-paper" : "text-paper/50 hover:text-paper/80")}
          >
            {x.name}
          </button>
        ))}
        <button
          onClick={() => {
            void navigator.clipboard?.writeText(f.body);
            toast("Copied", { description: f.path });
          }}
          className="mb-1 ml-auto rounded-md p-1 text-paper/50 hover:bg-paper/10 hover:text-paper"
          aria-label="Copy file"
        >
          <Copy className="size-3.5" />
        </button>
      </div>
      <pre key={`${f.name}-${f.body.length}`} className="overflow-auto p-4 font-mono text-[11px] leading-relaxed" style={{ maxHeight }}>
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn("us-rise whitespace-pre", line.trim().startsWith("#") || line.trim().startsWith("<!--") ? "text-paper/45" : "text-paper", line.includes("{{") && "bg-paper/10")}
            style={{ animationDelay: `${Math.min(i, 40) * 12}ms` }}
          >
            <span className="mr-3 inline-block w-5 text-right text-paper/25 select-none">{i + 1}</span>
            {line || " "}
          </div>
        ))}
      </pre>
    </div>
  );
}
