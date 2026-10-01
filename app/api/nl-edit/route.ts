import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// Natural-language builder: one plain-English sentence becomes a structured rule edit.
// The client applies it and re-runs the dry run before anything goes live.
const EditSchema = z.object({
  summary: z.string().describe("One short sentence describing the change, in plain English."),
  threshold: z.number().nullable().describe("New hold-for-approval amount for every bill, or null if unchanged."),
  vendorHolds: z
    .array(z.object({ vendor: z.string(), amount: z.number() }))
    .describe("Per-vendor hold amounts. vendor must be one of the known vendor names."),
  memoTemplate: z
    .string()
    .nullable()
    .describe("Memo template using {invoice_no}, {vendor}, {amount}, {due_date}; null if unchanged."),
  notify: z.array(z.object({ who: z.string(), when: z.string() })).describe("People to notify and when."),
  unsupported: z.array(z.string()).describe("Parts of the request this workflow can't do."),
});

export type RuleEdit = z.infer<typeof EditSchema>;

export async function POST(req: Request) {
  const apiKey = process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "No CLAUDE_API_KEY in .env" }, { status: 500 });

  const { instruction, threshold, vendors } = (await req.json()) as {
    instruction: string;
    threshold: number;
    vendors: string[];
  };
  if (!instruction?.trim()) return Response.json({ error: "Empty instruction" }, { status: 400 });

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      output_config: { effort: "low", format: zodOutputFormat(EditSchema) },
      system:
        "You edit an accounts-payable automation called 'Enter bill from emailed invoice'. " +
        "It reads invoice emails and posts bills in Ledgerline. Supported edits: the global hold-for-approval amount, " +
        "per-vendor hold amounts, a memo template, and notifications. Anything else goes in unsupported. " +
        "Never change bank details or payment destinations; put such requests in unsupported.",
      messages: [
        {
          role: "user",
          content: `Current hold amount: $${threshold}.\nKnown vendors: ${vendors.join("; ")}.\n\nRequest: ${instruction}`,
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return Response.json({ error: "Couldn't turn that into a rule. Try rephrasing." }, { status: 422 });
    }
    return Response.json({ edit: response.parsed_output });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return Response.json({ error: `Claude API error ${err.status}` }, { status: 502 });
    }
    throw err;
  }
}
