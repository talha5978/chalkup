import type { ReminderTone } from "~/types/db";

type ReminderInput = {
	customerName: string;
	amount: number;
	currencySymbol: string;
	description?: string;
	dueDate?: Date | null;
	tone: ReminderTone;
};

function formatDue(due?: Date | null) {
	if (!due) return null;
	return new Date(due).toLocaleDateString(undefined, {
		weekday: "long",
		month: "short",
		day: "numeric",
	});
}

export function draftReminder(input: ReminderInput): string {
	const { customerName, amount, currencySymbol, description, dueDate, tone } = input;

	const amountStr = `${currencySymbol}${amount.toLocaleString()}`;
	const dueStr = formatDue(dueDate);
	const forWhat = description ? ` for ${description}` : "";

	if (tone === "friendly") {
		return [
			`Hi ${customerName},`,
			``,
			`Hope you're doing well! Just a gentle reminder about the ${amountStr}${forWhat}${dueStr ? ` (due ${dueStr})` : ""}.`,
			``,
			`No rush — whenever it's convenient. Thank you!`,
		].join("\n");
	}

	if (tone === "firm") {
		return [
			`Hi ${customerName},`,
			``,
			`This is a reminder that ${amountStr}${forWhat} is still outstanding${dueStr ? ` (was due ${dueStr})` : ""}.`,
			``,
			`Please arrange payment at your earliest convenience.`,
		].join("\n");
	}

	// neutral
	return [
		`Hi ${customerName},`,
		``,
		`Friendly reminder: ${amountStr}${forWhat} is pending${dueStr ? ` (due ${dueStr})` : ""}.`,
		``,
		`Please let me know when you can settle. Thanks.`,
	].join("\n");
}

/** Build share URLs the user can open on their phone */
export function buildShareLinks(message: string, phone?: string) {
	const encoded = encodeURIComponent(message);

	// WhatsApp: if phone exists use it, else open share sheet with text only
	const wa = phone
		? `https://wa.me/${phone.replace(/\D/g, "")}?text=${encoded}`
		: `https://wa.me/?text=${encoded}`;

	const sms = phone ? `sms:${phone}?body=${encoded}` : `sms:?body=${encoded}`;

	const email = `mailto:?subject=${encodeURIComponent("Payment reminder")}&body=${encoded}`;

	return { wa, sms, email };
}
