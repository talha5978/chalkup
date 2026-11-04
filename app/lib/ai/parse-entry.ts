import { parsedEntrySchema, type ParsedEntry } from "~/lib/schemas";

const SYSTEM_PROMPT = `You are a precise data extractor for a small-business ledger app called Chalkup.
Extract structured information from a spoken or written phrase about money.

Decide the intent first:
- "new_debt" → someone is taking goods/services on credit (e.g. "Maria took cupcakes, owes me forty")
- "payment"  → someone is paying off a previous debt (e.g. "Maria paid the forty", "Maria settled", "Maria paid me")

Rules:
- customerName: the person's name only (e.g. "Ahmed Khan", "Maria Santos", "Priya Sharma", "James", "John", "Robert", "Michael", "William")
- amount: positive number (convert words → numbers). For pure payments without a number, omit amount.
- direction: only required for new_debt ("owes_me" or "i_owe")
- description: short reason if present
- dueDate: relative phrases like "Friday", "next week" or null
- intent: "new_debt" or "payment"

Return ONLY valid JSON matching the schema. No extra text.`;

export async function parseEntryFromTranscript(transcript: string): Promise<ParsedEntry> {
	const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
	const apiToken = process.env.CLOUDFLARE_API_TOKEN;

	if (!accountId || !apiToken) {
		throw new Error("Missing Cloudflare credentials");
	}

	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messages: [
					{ role: "system", content: SYSTEM_PROMPT },
					{ role: "user", content: transcript },
				],
				response_format: {
					type: "json_schema",
					json_schema: {
						type: "object",
						properties: {
							customerName: { type: "string" },
							amount: { type: "number" },
							direction: { type: "string", enum: ["owes_me", "i_owe"] },
							description: { type: "string" },
							dueDate: { type: ["string", "null"] },
							intent: { type: "string", enum: ["new_debt", "payment"] },
						},
						required: ["customerName", "intent"],
						additionalProperties: false,
					},
				},
			}),
		},
	);

	if (!response.ok) {
		const err = await response.text();
		throw new Error(`LLM parse failed: ${response.status} – ${err}`);
	}

	const data = await response.json();

	// Cloudflare usually returns { result: { response: {...} } } or { result: { response: "json string" } }
	let raw = data.result?.response ?? data.response ?? data.result;

	if (typeof raw === "string") {
		// Sometimes the model still wraps it in markdown
		const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
		raw = JSON.parse(cleaned);
	}

	// Validate with our Zod schema
	const parsed = parsedEntrySchema.parse(raw);
	return parsed;
}
