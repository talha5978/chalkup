import { db } from "~/lib/db";

export async function seedDatabase() {
	const existing = await db.customers.count();
	if (existing > 0) {
		console.log("Database already has data - skipping seed");
		return;
	}

	const now = new Date();

	// ---- Customers ----
	const customers = [
		{
			id: crypto.randomUUID(),
			name: "Maria Santos",
			phone: "+639171234567",
			notes: "Regular cupcake customer",
			createdAt: now,
			updatedAt: now,
		},
		{
			id: crypto.randomUUID(),
			name: "Ahmed Khan",
			phone: "+923001112233",
			notes: "Buys tools on credit",
			createdAt: now,
			updatedAt: now,
		},
		{
			id: crypto.randomUUID(),
			name: "Priya Sharma",
			email: "priya@example.com",
			notes: "Home baking orders",
			createdAt: now,
			updatedAt: now,
		},
		{
			id: crypto.randomUUID(),
			name: "Carlos Rivera",
			phone: "+5215512345678",
			createdAt: now,
			updatedAt: now,
		},
		{
			id: crypto.randomUUID(),
			name: "Fatima Ali",
			phone: "+923334445566",
			notes: "Pays every Friday",
			createdAt: now,
			updatedAt: now,
		},
	];

	await db.customers.bulkAdd(customers);

	// ---- Entries ----
	const entries = [
		// Maria owes 40 for cupcakes
		{
			id: crypto.randomUUID(),
			customerId: customers[0].id,
			amount: 40,
			direction: "owes_me" as const,
			description: "Two dozen cupcakes",
			dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // in 2 days
			status: "open" as const,
			source: "voice" as const,
			originalInput: "Maria took two dozen cupcakes, owes me forty, pays Friday",
			createdAt: now,
			updatedAt: now,
		},
		// Ahmed already settled one
		{
			id: crypto.randomUUID(),
			customerId: customers[1].id,
			amount: 2500,
			direction: "owes_me" as const,
			description: "Drill bits + sandpaper",
			status: "settled" as const,
			settledAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
			source: "manual" as const,
			createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
			updatedAt: now,
		},
		// Ahmed still owes
		{
			id: crypto.randomUUID(),
			customerId: customers[1].id,
			amount: 1800,
			direction: "owes_me" as const,
			description: "Angle grinder blades",
			dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
			status: "open" as const,
			source: "text" as const,
			createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
			updatedAt: now,
		},
		// You owe Priya
		{
			id: crypto.randomUUID(),
			customerId: customers[2].id,
			amount: 1200,
			direction: "i_owe" as const,
			description: "Custom birthday cake",
			status: "open" as const,
			source: "manual" as const,
			createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
			updatedAt: now,
		},
		// Fatima small open balance
		{
			id: crypto.randomUUID(),
			customerId: customers[4].id,
			amount: 650,
			direction: "owes_me" as const,
			description: "3 kg flour + sugar",
			dueDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
			status: "open" as const,
			source: "voice" as const,
			originalInput: "Fatima took flour and sugar, six fifty, pays next week",
			createdAt: now,
			updatedAt: now,
		},
	];

	await db.entries.bulkAdd(entries);

	// Ensure settings exist
	await db.getOrCreateSettings();

	console.log("✅ Seed data inserted");
}
