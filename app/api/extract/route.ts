import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// Fallback reader for invoice layouts the learned rules don't recognize. Returns each field's
// value plus the label printed before it, so the client can learn the label and never pay again.
const Field = z.object({
  value: z.string().describe("The value exactly as printed on the document."),
  label: z
    .string()
    .describe(
      "The exact text that comes right before the value on the same line, without the trailing colon. Empty string if there is none.",
    ),
});

const ExtractSchema = z.object({
  vendor: Field.describe("Who is billing us (the seller), not the customer."),
  invoice_no: Field.describe("The invoice or document number."),
  invoice_date: Field.describe("The date the invoice was issued."),
  due_date: Field.describe("The date payment is due."),
  amount: Field.describe("The total amount to pay."),
});

const FIELD_NAMES = {
  vendor: "Vendor",
  invoice_no: "Invoice No.",
  invoice_date: "Invoice Date",
  due_date: "Due Date",
  amount: "Amount",
} as const;

// Claude Opus 5.5 list prices, dollars per million tokens.
const INPUT_PER_M = 4;
const OUTPUT_PER_M = 20;

export async function POST(req: Request) {
  const apiKey = process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "No CLAUDE_API_KEY in .env" }, { status: 500 });

  const { lines } = (await req.json()) as { lines?: string[] };
  if (!Array.isArray(lines) || !lines.length) return Response.json({ error: "No document lines" }, { status: 400 });

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      output_config: { effort: "low", format: zodOutputFormat(ExtractSchema) },
      system:
        "You read vendor invoices for an accounts-payable team. The document is given as plain text lines. " +
        "For each field, copy the value exactly as printed, and copy the label text that precedes it on the same line " +
        "(for example, for the line 'Document No.: GGB-2207' the label is 'Document No.'). Use the line with a label " +
        "whenever one exists.",
      messages: [{ role: "user", content: lines.join("\n") }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return Response.json({ error: "Couldn't read this document" }, { status: 422 });
    }
    const parsed = response.parsed_output;
    const fields = Object.fromEntries(
      (Object.keys(FIELD_NAMES) as (keyof typeof FIELD_NAMES)[]).map((k) => [FIELD_NAMES[k], parsed[k]]),
    );
    const { input_tokens, output_tokens } = response.usage;
    const cost = (input_tokens * INPUT_PER_M + output_tokens * OUTPUT_PER_M) / 1_000_000;
    return Response.json({ fields, usage: { input_tokens, output_tokens }, cost });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return Response.json({ error: `Claude API error ${err.status}` }, { status: 502 });
    }
    throw err;
  }
}
