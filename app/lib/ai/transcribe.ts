export async function transcribeAudio(audio: ArrayBuffer | Blob): Promise<string> {
	const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
	const apiToken = process.env.CLOUDFLARE_API_TOKEN;

	if (!accountId || !apiToken) {
		throw new Error("Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN");
	}

	// Convert to base64
	const buffer = audio instanceof Blob ? await audio.arrayBuffer() : audio;
	const base64 = Buffer.from(buffer).toString("base64");

	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/openai/whisper-large-v3-turbo`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				audio: base64,
				task: "transcribe",
				language: "en", // force English for better accuracy
				// optional: initial_prompt: "This is about money, customers and debts.",
			}),
		},
	);

	if (!response.ok) {
		const err = await response.text();
		throw new Error(`Whisper failed: ${response.status} – ${err}`);
	}

	const data = await response.json();

	const text = data.result?.text ?? data.text;

	if (!text) {
		throw new Error("No transcription returned");
	}

	return text.trim();
}
