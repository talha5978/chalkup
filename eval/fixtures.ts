export type GoldPhrase = {
	id: string;
	transcript: string;
	expected: {
		customerName: string;
		amount?: number;
		direction?: "owes_me" | "i_owe";
		description?: string | null;
		dueDate?: string | null; // normalized lowercase fragment, e.g. "friday"
		intent: "new_debt" | "payment";
	};
};

/**
 * Fixed spoken phrases for the hackathon eval.
 * Keep English-only, varied names, amounts, directions, payments.
 */
export const FIXTURES: GoldPhrase[] = [
	{
		id: "debt-01",
		transcript: "Maria took two dozen cupcakes, owes me forty, pays Friday",
		expected: {
			customerName: "Maria",
			amount: 40,
			direction: "owes_me",
			description: "two dozen cupcakes",
			dueDate: "friday",
			intent: "new_debt",
		},
	},
	{
		id: "debt-02",
		transcript: "Ahmed borrowed five hundred for materials, will pay next week",
		expected: {
			customerName: "Ahmed",
			amount: 500,
			direction: "owes_me",
			description: "materials",
			dueDate: "next week",
			intent: "new_debt",
		},
	},
	{
		id: "debt-03",
		transcript: "I owe Sara two thousand for the catering",
		expected: {
			customerName: "Sara",
			amount: 2000,
			direction: "i_owe",
			description: "catering",
			dueDate: null,
			intent: "new_debt",
		},
	},
	{
		id: "debt-04",
		transcript: "Bilal took three bags of flour on credit, sixty rupees, due Monday",
		expected: {
			customerName: "Bilal",
			amount: 60,
			direction: "owes_me",
			description: "flour",
			dueDate: "monday",
			intent: "new_debt",
		},
	},
	{
		id: "debt-05",
		transcript: "Priya got tutoring, owes me fifteen hundred, pays tomorrow",
		expected: {
			customerName: "Priya",
			amount: 1500,
			direction: "owes_me",
			description: "tutoring",
			dueDate: "tomorrow",
			intent: "new_debt",
		},
	},
	{
		id: "pay-01",
		transcript: "Maria paid me the forty",
		expected: {
			customerName: "Maria",
			amount: 40,
			intent: "payment",
		},
	},
	{
		id: "pay-02",
		transcript: "Ahmed settled his balance",
		expected: {
			customerName: "Ahmed",
			intent: "payment",
		},
	},
	{
		id: "pay-03",
		transcript: "Sara paid me two thousand for the catering",
		expected: {
			customerName: "Sara",
			amount: 2000,
			intent: "payment",
		},
	},
	{
		id: "debt-06",
		transcript: "James ordered a cake, one twenty, he owes me, due next Friday",
		expected: {
			customerName: "James",
			amount: 120,
			direction: "owes_me",
			description: "cake",
			dueDate: "friday",
			intent: "new_debt",
		},
	},
	{
		id: "debt-07",
		transcript: "I still owe Fatima three hundred for the repairs",
		expected: {
			customerName: "Fatima",
			amount: 300,
			direction: "i_owe",
			description: "repairs",
			dueDate: null,
			intent: "new_debt",
		},
	},
	{
		id: "debt-08",
		transcript: "Omar took ten loaves, owes me two hundred, no due date",
		expected: {
			customerName: "Omar",
			amount: 200,
			direction: "owes_me",
			description: "loaves",
			dueDate: null,
			intent: "new_debt",
		},
	},
	{
		id: "pay-04",
		transcript: "Bilal paid sixty",
		expected: {
			customerName: "Bilal",
			amount: 60,
			intent: "payment",
		},
	},
];
