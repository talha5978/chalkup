import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { db } from "~/lib/db";
import { getOrCreateCustomer } from "~/lib/customers";
import { resolveRelativeDate } from "~/lib/dates";
import type { Customer, Direction } from "~/types/db";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSaved: () => void; // reload ledger rows
};

export function ManualEntryDialog({ open, onOpenChange, onSaved }: Props) {
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [intent, setIntent] = useState<"new_debt" | "payment">("new_debt");
	const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
	const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
	const [newCustomerName, setNewCustomerName] = useState("");
	const [amount, setAmount] = useState("");
	const [direction, setDirection] = useState<Direction>("owes_me");
	const [description, setDescription] = useState("");
	const [dueDateText, setDueDateText] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		db.customers.orderBy("name").toArray().then(setCustomers);
		// reset form each open
		setIntent("new_debt");
		setCustomerMode("existing");
		setSelectedCustomerId("");
		setNewCustomerName("");
		setAmount("");
		setDirection("owes_me");
		setDescription("");
		setDueDateText("");
		setError(null);
	}, [open]);

	const canSave = () => {
		const hasCustomer =
			customerMode === "new" ? newCustomerName.trim().length > 0 : selectedCustomerId.length > 0;
		if (!hasCustomer) return false;
		if (intent === "new_debt") {
			const n = Number(amount);
			return !isNaN(n) && n > 0;
		}
		// payment: amount optional
		return true;
	};

	const handleSave = async () => {
		if (!canSave()) return;
		setSaving(true);
		setError(null);

		try {
			const now = new Date();
			const name =
				customerMode === "new"
					? newCustomerName.trim()
					: (customers.find((c) => c.id === selectedCustomerId)?.name ?? "");

			const customer = await getOrCreateCustomer(
				name,
				customerMode === "existing" ? selectedCustomerId : undefined,
			);

			if (intent === "payment") {
				const openEntries = await db.entries
					.where({ customerId: customer.id, status: "open" })
					.reverse()
					.sortBy("createdAt");

				if (openEntries.length === 0) {
					throw new Error("No open balance found for this customer");
				}

				const payAmount = amount ? Number(amount) : null;

				if (payAmount && !isNaN(payAmount) && payAmount > 0) {
					let remaining = payAmount;
					for (const entry of openEntries) {
						if (remaining <= 0) break;
						if (entry.amount <= remaining) {
							await db.entries.update(entry.id, {
								status: "settled",
								settledAt: now,
								updatedAt: now,
							});
							remaining -= entry.amount;
						}
					}
				} else {
					await db.entries.update(openEntries[0].id, {
						status: "settled",
						settledAt: now,
						updatedAt: now,
					});
				}
			} else {
				const amt = Number(amount);
				await db.entries.add({
					id: crypto.randomUUID(),
					customerId: customer.id,
					amount: amt,
					direction,
					description: description.trim() || undefined,
					dueDate: resolveRelativeDate(dueDateText || null),
					status: "open",
					source: "manual",
					createdAt: now,
					updatedAt: now,
				});
			}

			onSaved();
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save");
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Add entry</DialogTitle>
					<DialogDescription>Manually record a debt or payment.</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					{/* Intent */}
					<div className="space-y-2">
						<Label htmlFor="entry-type">Type</Label>
						<Select value={intent} onValueChange={(v) => setIntent(v as "new_debt" | "payment")}>
							<SelectTrigger id="entry-type" className="w-full">
								<SelectValue>
									{intent === "new_debt" ? "New debt" : "Payment / settlement"}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="new_debt">New debt</SelectItem>
								<SelectItem value="payment">Payment / settlement</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Customer mode */}
					<div className="space-y-2">
						<Label htmlFor="customer-mode">Customer</Label>
						<Select
							value={customerMode}
							onValueChange={(v) => setCustomerMode(v as "existing" | "new")}
						>
							<SelectTrigger id="customer-mode" className="w-full">
								<SelectValue>
									{customerMode === "existing" ? "Existing customer" : "New customer"}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="existing">Existing customer</SelectItem>
								<SelectItem value="new">New customer</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{customerMode === "existing" ? (
						<div className="space-y-2">
							<Label htmlFor="existing-customer">Select customer</Label>
							<Select
								value={selectedCustomerId}
								onValueChange={(value) => setSelectedCustomerId(value ?? "")}
							>
								<SelectTrigger id="existing-customer" className="w-full">
									<SelectValue placeholder="Choose…">
										{
											customers.find((customer) => customer.id === selectedCustomerId)
												?.name
										}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{customers.length === 0 ? (
										<SelectItem value="__none" disabled>
											No customers yet
										</SelectItem>
									) : (
										customers.map((c) => (
											<SelectItem key={c.id} value={c.id}>
												{c.name}
											</SelectItem>
										))
									)}
								</SelectContent>
							</Select>
						</div>
					) : (
						<div className="space-y-2">
							<Label htmlFor="new-name">Name</Label>
							<Input
								id="new-name"
								value={newCustomerName}
								onChange={(e) => setNewCustomerName(e.target.value)}
								placeholder="Customer name"
							/>
						</div>
					)}

					{/* Amount */}
					<div className="space-y-2">
						<Label htmlFor="manual-amount">
							Amount
							{intent === "payment" && (
								<span className="text-muted-foreground font-normal">
									{" "}
									(optional – empty settles latest)
								</span>
							)}
						</Label>
						<Input
							id="manual-amount"
							type="number"
							min="0"
							step="0.01"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
						/>
					</div>

					{/* New debt only fields */}
					{intent === "new_debt" && (
						<>
							<div className="space-y-2">
								<Label htmlFor="entry-direction">Direction</Label>
								<Select value={direction} onValueChange={(v) => setDirection(v as Direction)}>
									<SelectTrigger id="entry-direction" className="w-full">
										<SelectValue>
											{direction === "owes_me" ? "They owe me" : "I owe them"}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="owes_me">They owe me</SelectItem>
										<SelectItem value="i_owe">I owe them</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label htmlFor="manual-desc">Description</Label>
								<Input
									id="manual-desc"
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									placeholder="What was it for?"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="manual-due">Due date</Label>
								<Input
									id="manual-due"
									value={dueDateText}
									onChange={(e) => setDueDateText(e.target.value)}
									placeholder="Friday, next week, 2026-11-10…"
								/>
							</div>
						</>
					)}

					{error && <p className="text-sm text-destructive">{error}</p>}
				</div>

				<DialogFooter className="gap-2">
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={!canSave() || saving} className="gap-2">
						<Save className="h-4 w-4" />
						{saving ? "Saving…" : intent === "payment" ? "Record payment" : "Save entry"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
