import Fuse from "fuse.js";
import { db } from "./db";
import type { Customer } from "~/types/db";

export type CustomerMatch = {
	customer: Customer;
	score: number;
};

/** Returns ranked matches under the threshold (best first). */
export async function findCustomerMatches(name: string, threshold = 0.45): Promise<CustomerMatch[]> {
	const all = await db.customers.toArray();
	if (all.length === 0) return [];

	const fuse = new Fuse(all, {
		keys: ["name"],
		threshold,
		includeScore: true,
	});

	return fuse
		.search(name.trim())
		.map((r) => ({
			customer: r.item,
			score: r.score ?? 1,
		}))
		.sort((a, b) => a.score - b.score);
}

/** Used when the user has already chosen (or only one match / create new). */
export async function getOrCreateCustomer(name: string, existingId?: string): Promise<Customer> {
	if (existingId) {
		const existing = await db.customers.get(existingId);
		if (existing) return existing;
	}

	const matches = await findCustomerMatches(name);
	// Strong single match → reuse
	if (matches.length === 1 && matches[0].score < 0.35) {
		return matches[0].customer;
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
