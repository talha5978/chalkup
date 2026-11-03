import { db } from "~/lib/db";
import { seedDatabase } from "~/lib/seed";

async function clearDatabase() {
	console.log("🗑️  Clearing all data...");
	await db.entries.clear();
	await db.customers.clear();
	await db.settings.clear();
	console.log("✅ Database cleared");
}

async function main() {
	const args = process.argv.slice(2);
	const isReset = args.includes("--reset") || args.includes("-r");

	try {
		if (isReset) {
			await clearDatabase();
		}

		console.log("🌱 Seeding database...");
		await seedDatabase();
		console.log("✅ Seed completed successfully");
		process.exit(0);
	} catch (error) {
		console.error("❌ Operation failed:", error);
		process.exit(1);
	}
}

main();
