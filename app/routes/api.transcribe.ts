import type { Route } from "./+types/api.transcribe";
import { transcribeAudio } from "~/lib/ai/transcribe";

export async function action({ request }: Route.ActionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	try {
		const formData = await request.formData();
		const audioFile = formData.get("audio");

		if (typeof audioFile !== "object" || audioFile === null) {
			return Response.json({ error: "No audio file provided" }, { status: 400 });
		}

		const transcript = await transcribeAudio(audioFile);

		return Response.json({ transcript });
	} catch (error) {
		console.error("Transcription error:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Transcription failed" },
			{ status: 500 },
		);
	}
}
