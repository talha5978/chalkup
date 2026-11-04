import { parsedEntrySchema, type ParsedEntry } from "~/lib/schemas";

const SYSTEM_PROMPT = `You are a precise data extractor for a small-business ledger app called Chalkup.
Extract structured information from a spoken or written phrase about money owed.

Rules:
- customerName: the person's name only (e.g. "Ahmed Khan", "Maria Santos", "Priya Sharma", "James", "John", "Robert", "Michael", "William")
- amount: positive number only (convert words like "forty" → 40, "six fifty" → 650)
- direction: "owes_me" if the customer owes the speaker, "i_owe" if the speaker owes the customer
- description: short reason (e.g. "two dozen cupcakes")
- dueDate: keep relative phrases as-is ("Friday", "next week", "tomorrow") or null if none

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
						},
						required: ["customerName", "amount", "direction"],
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
