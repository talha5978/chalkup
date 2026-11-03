import Dexie, { type EntityTable } from "dexie";
import type { Customer, Entry, Settings } from "~/types/db";

class ChalkupDB extends Dexie {
	customers!: EntityTable<Customer, "id">;
	entries!: EntityTable<Entry, "id">;
	settings!: EntityTable<Settings, "id">;

	constructor() {
		super("ChalkupDB");

		this.version(1).stores({
			customers: "id, name, phone, createdAt",
			entries: "id, customerId, status, dueDate, createdAt, [customerId+status]",
			settings: "id",
		});
	}

	async getOrCreateSettings(): Promise<Settings> {
		const existing = await this.settings.get("settings");
		if (existing) return existing;

		const defaults: Settings = {
			id: "settings",
			currency: "PKR",
			currencySymbol: "Rs",
			defaultTone: "friendly",
			updatedAt: new Date(),
		};

		await this.settings.put(defaults);
		return defaults;
	}

	async getCustomerBalance(customerId: string): Promise<number> {
		const openEntries = await this.entries.where({ customerId, status: "open" }).toArray();

		return openEntries.reduce((sum, e) => {
			return e.direction === "owes_me" ? sum + e.amount : sum - e.amount;
		}, 0);
	}
}

export const db = new ChalkupDB();
