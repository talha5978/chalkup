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
import { getOrCreateCustomer } from "~/lib/customers";
import type { Direction } from "~/types/db";

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

	// Editable fields on the confirm card
	const [customerName, setCustomerName] = useState("");
	const [amount, setAmount] = useState("");
	const [direction, setDirection] = useState<"owes_me" | "i_owe" | undefined>("owes_me");
	const [description, setDescription] = useState("");
	const [dueDateText, setDueDateText] = useState("");

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
	};

	const handlePointerDown = useCallback(
		async (e: React.PointerEvent) => {
			e.preventDefault();
			(e.target as HTMLElement).setPointerCapture(e.pointerId);

			if (status === "processing" || status === "recording" || status === "saving") return;

			setStatus("recording");
			setTranscript(null);
			setParsed(null);
			setError(null);

			try {
				await startRecording();
			} catch (err) {
				setStatus("error");
				setError(err instanceof Error ? err.message : "Could not access microphone");
			}
		},
		[status, startRecording],
	);

	const handlePointerUp = useCallback(async () => {
		if (!isRecording) return;

		try {
			setStatus("processing");
			const blob = await stopRecording();
			const text = await transcribe(blob);
			setTranscript(text);

			// Parse with LLM
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

			setStatus("confirm");
		} catch (err) {
			setStatus("error");
			setError(err instanceof Error ? err.message : "Something went wrong");
		}
	}, [isRecording, stopRecording, transcribe]);

	const handlePointerCancel = useCallback(async () => {
		if (isRecording) {
			await stopRecording();
			setStatus("idle");
		}
	}, [isRecording, stopRecording]);

	const handleConfirmSave = async () => {
		if (!customerName.trim()) return;

		setStatus("saving");
		try {
			const now = new Date();
			const customer = await getOrCreateCustomer(customerName.trim());

			// ---------- PAYMENT ----------
			if (parsed?.intent === "payment") {
				// Find open entries for this customer (most recent first)
				const openEntries = await db.entries
					.where({ customerId: customer.id, status: "open" })
					.reverse()
					.sortBy("createdAt");

				if (openEntries.length === 0) {
					throw new Error("No open balance found for this customer");
				}

				const payAmount = amount ? Number(amount) : null;

				if (payAmount && !isNaN(payAmount) && payAmount > 0) {
					// Settle the most recent matching amount, or the latest open one
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
					// No amount given → settle the latest open entry
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
					<p className="text-muted-foreground text-sm">Hold the button and speak naturally</p>
				</div>

				{/* Record Button */}
				{status !== "confirm" && status !== "success" && (
					<div className="flex flex-col items-center gap-6">
						<button
							type="button"
							onPointerDown={handlePointerDown}
							onPointerUp={handlePointerUp}
							onPointerLeave={handlePointerCancel}
							onPointerCancel={handlePointerCancel}
							disabled={status === "processing" || status === "saving"}
							className={cn(
								"relative flex h-36 w-36 items-center justify-center rounded-full",
								"select-none touch-none transition-all duration-200",
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
							{status === "idle" && "Hold to talk"}
							{status === "recording" && "Listening… release when done"}
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

							<div className="space-y-2">
								<Label htmlFor="customerName">Customer</Label>
								<Input
									id="customerName"
									value={customerName}
									onChange={(e) => setCustomerName(e.target.value)}
									placeholder="Name"
								/>
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

							{/* Only show direction + due date for new debts */}
							{parsed.intent !== "payment" && (
								<>
									<div className="space-y-2">
										<Label>Direction</Label>
										<Select
											value={direction}
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
