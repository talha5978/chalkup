import { z } from "zod";

export const directionSchema = z.enum(["owes_me", "i_owe"]);
export const entryStatusSchema = z.enum(["open", "settled"]);
export const entrySourceSchema = z.enum(["voice", "text", "manual"]);
export const reminderToneSchema = z.enum(["friendly", "neutral", "firm"]);

export const customerSchema = z.object({
	id: z.uuidv4(),
	name: z.string().min(1, "Name is required").max(100),
	phone: z.string().optional(),
	email: z.email().optional().or(z.literal("")),
	notes: z.string().max(500).optional(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export const entrySchema = z.object({
	id: z.uuidv4(),
	customerId: z.uuidv4(),
	amount: z.number().positive("Amount must be greater than 0"),
	direction: directionSchema,
	description: z.string().max(300).optional(),
	dueDate: z.coerce.date().nullable().optional(),
	status: entryStatusSchema,
	settledAt: z.coerce.date().nullable().optional(),
	source: entrySourceSchema,
	originalInput: z.string().optional(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export const settingsSchema = z.object({
	id: z.literal("settings"),
	currency: z.string().min(1),
	currencySymbol: z.string().min(1),
	defaultTone: reminderToneSchema,
	updatedAt: z.coerce.date(),
});

// ---------- Form / LLM input schemas (without ids & timestamps) ----------

export const createCustomerSchema = customerSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export const createEntrySchema = entrySchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
	settledAt: true,
});

export const updateSettingsSchema = settingsSchema.omit({
	id: true,
	updatedAt: true,
});

export const parsedEntrySchema = z.object({
	customerName: z.string().min(1),
	amount: z.number().positive().optional(),
	direction: directionSchema.optional(),
	description: z.string().optional(),
	dueDate: z.string().nullable().optional(),
	intent: z.enum(["new_debt", "payment"]).default("new_debt"),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type ParsedEntry = z.infer<typeof parsedEntrySchema>;
