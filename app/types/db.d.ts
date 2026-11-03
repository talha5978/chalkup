export type Direction = "owes_me" | "i_owe";
export type EntryStatus = "open" | "settled";
export type EntrySource = "voice" | "text" | "manual";
export type ReminderTone = "friendly" | "neutral" | "firm";

export interface Customer {
	id: string;
	name: string;
	phone?: string;
	email?: string;
	notes?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface Entry {
	id: string;
	customerId: string;
	amount: number; // always positive
	direction: Direction;
	description?: string;
	dueDate?: Date | null;
	status: EntryStatus;
	settledAt?: Date | null;
	source: EntrySource;
	originalInput?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface Settings {
	id: "settings";
	currency: string;
	currencySymbol: string;
	defaultTone: ReminderTone;
	updatedAt: Date;
}
