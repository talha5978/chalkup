import type { Route } from "./+types/api.parse-entry";
import { parseEntryFromTranscript } from "~/lib/ai/parse-entry";

export async function action({ request }: Route.ActionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	try {
		const { transcript } = await request.json();

		if (!transcript || typeof transcript !== "string") {
			return Response.json({ error: "transcript is required" }, { status: 400 });
		}

		const parsed = await parseEntryFromTranscript(transcript);
		return Response.json({ parsed });
	} catch (error) {
		console.error("Parse error:", error);
		return Response.json(
			{
				error: error instanceof Error ? error.message : "Failed to parse entry",
			},
			{ status: 500 },
		);
	}
}
