import "dotenv/config";
import type { ParsedEntry } from "~/lib/schemas";
import { FIXTURES, type GoldPhrase } from "../eval/fixtures";
import { parseEntryFromTranscript } from "~/lib/ai/parse-entry";

type FieldKey = "intent" | "customerName" | "amount" | "direction" | "description" | "dueDate";

const FIELDS: FieldKey[] = ["intent", "customerName", "amount", "direction", "description", "dueDate"];

function normName(s: string) {
	return s.trim().toLowerCase();
}

function normText(s?: string | null) {
	if (s == null || s === "") return null;
	return s.trim().toLowerCase();
}

function dueMatches(expected?: string | null, got?: string | null) {
	const e = normText(expected);
	const g = normText(got);
	if (e == null && (g == null || g === "null")) return true;
	if (e == null || g == null) return false;
	// soft match: expected fragment appears in model output
	return g.includes(e) || e.includes(g);
}

function descMatches(expected?: string | null, got?: string | null) {
	const e = normText(expected);
	const g = normText(got);
	if (e == null && g == null) return true;
	if (e == null || g == null) return false;
	return g.includes(e) || e.includes(g);
}

function scoreField(field: FieldKey, gold: GoldPhrase["expected"], pred: ParsedEntry): boolean {
	switch (field) {
		case "intent":
			return (pred.intent ?? "new_debt") === gold.intent;
		case "customerName":
			return (
				normName(pred.customerName).includes(normName(gold.customerName)) ||
				normName(gold.customerName).includes(normName(pred.customerName))
			);
		case "amount":
			if (gold.amount == null) return pred.amount == null || pred.amount === undefined;
			return pred.amount === gold.amount;
		case "direction":
			if (gold.intent === "payment") return true; // not required
			if (gold.direction == null) return true;
			return pred.direction === gold.direction;
		case "description":
			if (gold.intent === "payment") return true;
			return descMatches(gold.description, pred.description);
		case "dueDate":
			if (gold.intent === "payment") return true;
			return dueMatches(gold.dueDate, pred.dueDate);
		default:
			return false;
	}
}

type Failure = {
	id: string;
	transcript: string;
	field: FieldKey;
	expected: unknown;
	got: unknown;
};

async function main() {
	if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) {
		console.error("Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN");
		process.exit(1);
	}

	const totals: Record<FieldKey, { ok: number; n: number }> = {
		intent: { ok: 0, n: 0 },
		customerName: { ok: 0, n: 0 },
		amount: { ok: 0, n: 0 },
		direction: { ok: 0, n: 0 },
		description: { ok: 0, n: 0 },
		dueDate: { ok: 0, n: 0 },
	};

	const failures: Failure[] = [];
	let exact = 0;

	console.log(`\nChalkup parse eval — ${FIXTURES.length} phrases\n`);

	for (const fixture of FIXTURES) {
		process.stdout.write(`  ${fixture.id}… `);

		let pred: ParsedEntry;
		try {
			pred = await parseEntryFromTranscript(fixture.transcript);
		} catch (err) {
			console.log("ERROR");
			for (const field of FIELDS) {
				totals[field].n += 1;
				failures.push({
					id: fixture.id,
					transcript: fixture.transcript,
					field,
					expected: fixture.expected[field as keyof typeof fixture.expected],
					got: err instanceof Error ? err.message : "parse failed",
				});
			}
			continue;
		}

		let allOk = true;
		for (const field of FIELDS) {
			// skip optional scoring noise for payment-only fields already handled in scoreField
			const relevant =
				field === "intent" ||
				field === "customerName" ||
				field === "amount" ||
				fixture.expected.intent === "new_debt" ||
				field === "direction" ||
				field === "description" ||
				field === "dueDate";

			if (!relevant) continue;

			totals[field].n += 1;
			const ok = scoreField(field, fixture.expected, pred);
			if (ok) {
				totals[field].ok += 1;
			} else {
				allOk = false;
				failures.push({
					id: fixture.id,
					transcript: fixture.transcript,
					field,
					expected: fixture.expected[field as keyof typeof fixture.expected] ?? null,
					got:
						field === "intent"
							? pred.intent
							: field === "customerName"
								? pred.customerName
								: field === "amount"
									? pred.amount
									: field === "direction"
										? pred.direction
										: field === "description"
											? pred.description
											: pred.dueDate,
				});
			}
		}

		if (allOk) {
			exact += 1;
			console.log("OK");
		} else {
			console.log("FAIL");
		}

		// gentle rate limit for Workers AI free tier
		await new Promise((r) => setTimeout(r, 400));
	}

	const pct = (ok: number, n: number) => (n === 0 ? "—" : `${((100 * ok) / n).toFixed(1)}%`);

	console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	console.log("Field accuracy");
	console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	console.log("| Field         | Correct | Total | Accuracy |");
	console.log("|---------------|---------|-------|----------|");
	for (const field of FIELDS) {
		const { ok, n } = totals[field];
		console.log(
			`| ${field.padEnd(13)} | ${String(ok).padStart(7)} | ${String(n).padStart(5)} | ${pct(ok, n).padStart(8)} |`,
		);
	}
	console.log(
		`\nExact match (all scored fields): ${exact}/${FIXTURES.length} (${pct(exact, FIXTURES.length)})`,
	);

	if (failures.length) {
		console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
		console.log("Failures");
		console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
		for (const f of failures) {
			console.log(
				`• ${f.id} [${f.field}] expected=${JSON.stringify(f.expected)} got=${JSON.stringify(f.got)}`,
			);
			console.log(`  “${f.transcript}”`);
		}
	}

	// Machine-readable snapshot for README
	console.log("\n--- README snippet ---");
	console.log("| Field | Accuracy |");
	console.log("|-------|----------|");
	for (const field of FIELDS) {
		const { ok, n } = totals[field];
		console.log(`| ${field} | ${pct(ok, n)} |`);
	}
	console.log(`| **exact** | **${pct(exact, FIXTURES.length)}** |`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
