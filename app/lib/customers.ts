import Fuse from "fuse.js";
import { db } from "~/lib/db";
import type { Customer } from "~/types/db";

export async function findBestCustomerMatch(
	name: string,
): Promise<{ customer: Customer | null; score: number }> {
	const all = await db.customers.toArray();
	if (all.length === 0) return { customer: null, score: 1 };

	const fuse = new Fuse(all, {
		keys: ["name"],
		threshold: 0.4, // lower = stricter
		includeScore: true,
	});

	const results = fuse.search(name.trim());
	if (results.length === 0) return { customer: null, score: 1 };

	const best = results[0];
	return {
		customer: best.item,
		score: best.score ?? 1,
	};
}

export async function getOrCreateCustomer(name: string): Promise<Customer> {
	const { customer, score } = await findBestCustomerMatch(name);

	// Good enough match → reuse
	if (customer && score < 0.35) {
		return customer;
	}

	// Create new
	const now = new Date();
	const newCustomer: Customer = {
		id: crypto.randomUUID(),
		name: name.trim(),
		createdAt: now,
		updatedAt: now,
	};
	await db.customers.add(newCustomer);
	return newCustomer;
}
