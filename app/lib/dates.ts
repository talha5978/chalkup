export function resolveRelativeDate(input?: string | null): Date | null {
	if (!input) return null;

	const lower = input.toLowerCase().trim();
	const now = new Date();
	const result = new Date(now);
	result.setHours(23, 59, 59, 999); // end of day

	if (lower === "today") return result;

	if (lower === "tomorrow") {
		result.setDate(result.getDate() + 1);
		return result;
	}

	// "Friday", "next Friday", "this Friday"
	const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
	for (let i = 0; i < 7; i++) {
		if (lower.includes(days[i])) {
			const target = i;
			const current = now.getDay();
			let diff = target - current;
			if (diff <= 0) diff += 7; // next occurrence
			if (lower.includes("next") && diff < 7) diff += 7;
			result.setDate(now.getDate() + diff);
			return result;
		}
	}

	if (lower.includes("next week")) {
		result.setDate(result.getDate() + 7);
		return result;
	}

	// Try native parse as last resort
	const parsed = new Date(input);
	if (!isNaN(parsed.getTime())) return parsed;

	return null;
}
