export function formatMoney(amount: number, symbol: string, opts?: { sign?: "auto" | "none" | "+" | "−" }) {
	const abs = Math.abs(amount).toLocaleString();
	const sign = opts?.sign ?? "none";
	if (sign === "none") return `${symbol}${abs}`;
	if (sign === "+") return `+${symbol}${abs}`;
	if (sign === "−") return `−${symbol}${abs}`;
	// auto
	if (amount > 0) return `+${symbol}${abs}`;
	if (amount < 0) return `−${symbol}${abs}`;
	return `${symbol}${abs}`;
}
