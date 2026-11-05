import { useState, useCallback } from "react";
import { Mic, Loader2, CheckCircle2, AlertCircle, RotateCcw, Save } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { useVoiceRecorder } from "~/hooks/use-voice-recorder";
import { db } from "~/lib/db";
import { resolveRelativeDate } from "~/lib/dates";
import type { ParsedEntry } from "~/lib/schemas";
import { cn } from "~/lib/utils";
import { findCustomerMatches, getOrCreateCustomer } from "~/lib/customers";
import type { Customer, Direction } from "~/types/db";

type Status = "idle" | "recording" | "processing" | "confirm" | "saving" | "success" | "error";

export const meta = () => {
	return [{ name: "Home | Chalkup" }];
};

export default function Home() {
	const { isRecording, startRecording, stopRecording, transcribe } = useVoiceRecorder();

	const [status, setStatus] = useState<Status>("idle");
	const [transcript, setTranscript] = useState<string | null>(null);
	const [parsed, setParsed] = useState<ParsedEntry | null>(null);
	const [error, setError] = useState<string | null>(null);

	const [customerName, setCustomerName] = useState("");
	const [amount, setAmount] = useState("");
	const [direction, setDirection] = useState<"owes_me" | "i_owe" | undefined>("owes_me");
	const [description, setDescription] = useState("");
	const [dueDateText, setDueDateText] = useState("");

	const [customerMatches, setCustomerMatches] = useState<{ customer: Customer; score: number }[]>([]);
	const [selectedCustomerId, setSelectedCustomerId] = useState<string | "new">("new");

	const reset = () => {
		setStatus("idle");
		setTranscript(null);
		setParsed(null);
		setError(null);
		setCustomerName("");
		setAmount("");
		setDirection("owes_me");
		setDescription("");
		setDueDateText("");
		setCustomerMatches([]);
		setSelectedCustomerId("new");
	};

	const handleToggleRecord = useCallback(async () => {
		// Start recording
		if (!isRecording && status !== "processing" && status !== "saving") {
			setStatus("recording");
			setTranscript(null);
			setParsed(null);
			setError(null);
			setCustomerMatches([]);
			setSelectedCustomerId("new");

			try {
				await startRecording();
			} catch (err) {
				setStatus("error");
				setError(err instanceof Error ? err.message : "Could not access microphone");
			}
			return;
		}

		// Stop recording → process
		if (isRecording) {
			try {
				setStatus("processing");
				const blob = await stopRecording();
				const text = await transcribe(blob);
				setTranscript(text);

				const res = await fetch("/api/parse-entry", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ transcript: text }),
				});

				const data = await res.json();
				if (!res.ok) throw new Error(data.error || "Parsing failed");

				const p = data.parsed as ParsedEntry;
				setParsed(p);

				setCustomerName(p.customerName);
				setAmount(p.amount != null ? String(p.amount) : "");
				setDirection(p.direction ?? "owes_me");
				setDescription(p.description ?? "");
				setDueDateText(p.dueDate ?? "");

				const matches = await findCustomerMatches(p.customerName);
				setCustomerMatches(matches);

				if (matches.length === 0) {
					setSelectedCustomerId("new");
				} else if (matches.length === 1 && matches[0].score < 0.35) {
					setSelectedCustomerId(matches[0].customer.id);
					setCustomerName(matches[0].customer.name);
				} else {
					setSelectedCustomerId(matches[0].customer.id);
					setCustomerName(matches[0].customer.name);
				}

				setStatus("confirm");
			} catch (err) {
				setStatus("error");
				setError(err instanceof Error ? err.message : "Something went wrong");
			}
		}
	}, [isRecording, status, startRecording, stopRecording, transcribe]);

	const handleConfirmSave = async () => {
		if (!customerName.trim()) return;

		setStatus("saving");
		try {
			const now = new Date();
			const customer = await getOrCreateCustomer(
				customerName.trim(),
				selectedCustomerId === "new" ? undefined : selectedCustomerId,
			);

			// ---------- PAYMENT ----------
			if (parsed?.intent === "payment") {
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
					const latest = openEntries[0];
					await db.entries.update(latest.id, {
						status: "settled",
						settledAt: now,
						updatedAt: now,
					});
				}

				setStatus("success");
				return;
			}

			// ---------- NEW DEBT ----------
			const amt = Number(amount);
			if (isNaN(amt) || amt <= 0) throw new Error("Invalid amount");

			const dueDate = resolveRelativeDate(dueDateText || null);

			await db.entries.add({
				id: crypto.randomUUID(),
				customerId: customer.id,
				amount: amt,
				direction: direction as Direction,
				description: description.trim() || undefined,
				dueDate,
				status: "open",
				source: "voice",
				originalInput: transcript ?? undefined,
				createdAt: now,
				updatedAt: now,
			});

			setStatus("success");
		} catch (err) {
			setStatus("error");
			setError(err instanceof Error ? err.message : "Failed to save");
		}
	};

	return (
		<div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8 bg-background text-foreground">
			<div className="w-full max-w-md space-y-8">
				{/* Header */}
				<div className="text-center space-y-2">
					<h1 className="text-3xl font-bold tracking-tight">Chalkup</h1>
					<p className="text-muted-foreground text-sm">Tap the button and speak naturally</p>
				</div>

				{/* Record Button */}
				{status !== "confirm" && status !== "success" && (
					<div className="flex flex-col items-center gap-6">
						<button
							type="button"
							onClick={handleToggleRecord}
							disabled={status === "processing" || status === "saving"}
							className={cn(
								"relative flex h-36 w-36 items-center justify-center rounded-full",
								"select-none transition-all duration-200",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
								"disabled:opacity-60 disabled:pointer-events-none",
								status === "recording"
									? "bg-destructive text-destructive-foreground scale-110 shadow-lg"
									: "bg-primary text-primary-foreground shadow-md hover:scale-105 active:scale-95",
							)}
						>
							{status === "processing" || status === "saving" ? (
								<Loader2 className="h-12 w-12 animate-spin" />
							) : (
								<Mic className="h-12 w-12" />
							)}
							{status === "recording" && (
								<span className="absolute inset-0 rounded-full animate-ping bg-destructive/40" />
							)}
						</button>

						<p className="text-sm font-medium text-muted-foreground h-5">
							{status === "idle" && "Tap to talk"}
							{status === "recording" && "Listening… tap again to stop"}
							{status === "processing" && "Transcribing & parsing…"}
							{status === "error" && "Something went wrong"}
						</p>
					</div>
				)}

				{/* Error */}
				{status === "error" && error && (
					<Card className="border-destructive/50">
						<CardContent className="pt-6 space-y-4">
							<div className="flex items-center gap-2 text-destructive">
								<AlertCircle className="h-5 w-5" />
								<p className="text-sm">{error}</p>
							</div>
							<Button variant="outline" onClick={reset} className="w-full gap-2">
								<RotateCcw className="h-4 w-4" />
								Try again
							</Button>
						</CardContent>
					</Card>
				)}

				{/* Confirm Card */}
				{status === "confirm" && parsed && (
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">
								{parsed.intent === "payment" ? "Confirm payment" : "Confirm entry"}
							</CardTitle>
							<CardDescription>
								{parsed.intent === "payment"
									? "This will settle open balance(s) for this customer."
									: "Check the details extracted from your voice, then save."}
							</CardDescription>
						</CardHeader>

						<CardContent className="space-y-4">
							{transcript && (
								<p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-3">
									“{transcript}”
								</p>
							)}

							{/* Intent badge */}
							<div
								className={cn(
									"text-xs font-medium px-2.5 py-1 rounded-full w-fit",
									parsed.intent === "payment"
										? "bg-primary/10 text-primary"
										: "bg-muted text-muted-foreground",
								)}
							>
								{parsed.intent === "payment" ? "Payment / Settlement" : "New debt"}
							</div>

							{/* Customer */}
							<div className="space-y-2">
								<Label htmlFor="customerName">Customer</Label>

								{/* Case A: No matches → create new */}
								{customerMatches.length === 0 && (
									<>
										<Input
											id="customerName"
											value={customerName}
											onChange={(e) => {
												setCustomerName(e.target.value);
												setSelectedCustomerId("new");
											}}
											placeholder="Customer name"
										/>
										<p className="text-xs text-muted-foreground">
											No existing customer found — a new one will be created.
										</p>
									</>
								)}

								{/* Case B: Single strong match → use existing */}
								{customerMatches.length === 1 &&
									customerMatches[0].score < 0.35 &&
									selectedCustomerId !== "new" && (
										<>
											<Input
												id="customerName"
												value={customerMatches[0].customer.name}
												readOnly
												className="bg-muted"
											/>
											<p className="text-xs text-muted-foreground">
												Matched existing customer
											</p>
										</>
									)}

								{/* Case C: Ambiguous → Select dropdown */}
								{(customerMatches.length > 1 ||
									(customerMatches.length === 1 && customerMatches[0].score >= 0.35)) && (
									<>
										<Select
											value={selectedCustomerId}
											onValueChange={(value) => {
												setSelectedCustomerId(value as string | "new");
												if (value === "new") {
													setCustomerName(parsed.customerName);
												} else {
													const match = customerMatches.find(
														(m) => m.customer.id === value,
													);
													if (match) setCustomerName(match.customer.name);
												}
											}}
										>
											<SelectTrigger id="customerName" className="w-full">
												<SelectValue placeholder="Select customer" />
											</SelectTrigger>
											<SelectContent>
												{customerMatches.map(({ customer, score }) => (
													<SelectItem key={customer.id} value={customer.id}>
														{customer.name}
														<span className="ml-2 text-xs text-muted-foreground">
															({Math.round((1 - score) * 100)}% match)
														</span>
													</SelectItem>
												))}
												<SelectItem value="new">
													Create new “{parsed.customerName}”
												</SelectItem>
											</SelectContent>
										</Select>

										{selectedCustomerId === "new" && (
											<Input
												value={customerName}
												onChange={(e) => setCustomerName(e.target.value)}
												placeholder="New customer name"
												className="mt-2"
											/>
										)}

										<p className="text-xs text-muted-foreground">
											Multiple possible matches — pick one or create new.
										</p>
									</>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="amount">
									Amount{" "}
									{parsed.intent === "payment" &&
										"(optional – leave empty to settle latest)"}
								</Label>
								<Input
									id="amount"
									type="number"
									min="0"
									step="0.01"
									value={amount}
									onChange={(e) => setAmount(e.target.value)}
								/>
							</div>

							{parsed.intent !== "payment" && (
								<>
									<div className="space-y-2">
										<Label>Direction</Label>
										<Select
											value={direction == "i_owe" ? "I Owe Them" : "They Owe Me"}
											onValueChange={(v) => setDirection(v as "owes_me" | "i_owe")}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="owes_me">They owe me</SelectItem>
												<SelectItem value="i_owe">I owe them</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label htmlFor="description">Description</Label>
										<Input
											id="description"
											value={description}
											onChange={(e) => setDescription(e.target.value)}
											placeholder="What was it for?"
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="dueDate">Due date</Label>
										<Input
											id="dueDate"
											value={dueDateText}
											onChange={(e) => setDueDateText(e.target.value)}
											placeholder="Friday, next week, etc."
										/>
									</div>
								</>
							)}
						</CardContent>

						<CardFooter className="flex gap-2">
							<Button variant="outline" onClick={reset} className="flex-1 gap-2">
								<RotateCcw className="h-4 w-4" />
								Cancel
							</Button>
							<Button
								onClick={handleConfirmSave}
								disabled={!customerName.trim() || (parsed.intent !== "payment" && !amount)}
								className="flex-1 gap-2"
							>
								<Save className="h-4 w-4" />
								{parsed.intent === "payment" ? "Record Payment" : "Save Entry"}
							</Button>
						</CardFooter>
					</Card>
				)}

				{/* Success */}
				{status === "success" && (
					<Card>
						<CardContent className="pt-6 space-y-4 text-center">
							<CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
							<div>
								<p className="font-medium">
									{parsed?.intent === "payment" ? "Payment recorded" : "Entry saved"}
								</p>
								<p className="text-sm text-muted-foreground mt-1">
									{parsed?.intent === "payment"
										? `${customerName} – balance updated`
										: `${customerName} · ${direction === "owes_me" ? "owes you" : "you owe"} ${amount}`}
								</p>
							</div>
							<Button onClick={reset} className="w-full">
								Add another
							</Button>
						</CardContent>
					</Card>
				)}

				<p className="text-center text-xs text-muted-foreground">
					Example: “Maria took two dozen cupcakes, owes me forty, pays Friday”
				</p>
			</div>
		</div>
	);
}
