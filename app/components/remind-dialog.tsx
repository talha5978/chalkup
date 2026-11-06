import { useEffect, useState } from "react";
import { Copy, Check, MessageCircle, Mail, Phone } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { draftReminder, buildShareLinks } from "~/lib/reminders";
import { db } from "~/lib/db";
import type { ReminderTone } from "~/types/db";

export type RemindTarget = {
	customerName: string;
	amount: number;
	description?: string;
	dueDate?: Date | null;
	phone?: string;
};

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	target: RemindTarget | null;
};

export function RemindDialog({ open, onOpenChange, target }: Props) {
	const [tone, setTone] = useState<ReminderTone>("friendly");
	const [message, setMessage] = useState("");
	const [currencySymbol, setCurrencySymbol] = useState("Rs");
	const [copied, setCopied] = useState(false);

	// Load settings + draft when dialog opens / target changes
	useEffect(() => {
		if (!open || !target) return;

		let cancelled = false;

		(async () => {
			const settings = await db.getOrCreateSettings();
			if (cancelled) return;

			setTone(settings.defaultTone);
			setCurrencySymbol(settings.currencySymbol);

			const draft = draftReminder({
				customerName: target.customerName,
				amount: target.amount,
				currencySymbol: settings.currencySymbol,
				description: target.description,
				dueDate: target.dueDate,
				tone: settings.defaultTone,
			});
			setMessage(draft);
		})();

		return () => {
			cancelled = true;
		};
	}, [open, target]);

	// Re-draft when tone changes
	useEffect(() => {
		if (!open || !target) return;

		setMessage(
			draftReminder({
				customerName: target.customerName,
				amount: target.amount,
				currencySymbol,
				description: target.description,
				dueDate: target.dueDate,
				tone,
			}),
		);
	}, [tone]); // eslint-disable-line react-hooks/exhaustive-deps

	if (!target) return null;

	const links = buildShareLinks(message, target.phone);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(message);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Send reminder</DialogTitle>
					<DialogDescription>
						Draft a message for {target.customerName}, then share it.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					<div className="space-y-2">
						<Label htmlFor="tone">Tone</Label>
						<Select value={tone} onValueChange={(v) => setTone(v as ReminderTone)}>
							<SelectTrigger id="tone">
								<SelectValue>
									{{ friendly: "Friendly", neutral: "Neutral", firm: "Firm" }[tone]}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="friendly">Friendly</SelectItem>
								<SelectItem value="neutral">Neutral</SelectItem>
								<SelectItem value="firm">Firm</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="reminder-message">Message</Label>
						<Textarea
							id="reminder-message"
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							rows={7}
							className="resize-none text-sm"
						/>
					</div>
				</div>

				<DialogFooter className="flex-col gap-2 sm:flex-col">
					<div className="grid grid-cols-2 gap-2 w-full">
						<a href={links.wa} target="_blank" rel="noopener noreferrer" className="w-full">
							<Button variant="default" className="w-full gap-2">
								<MessageCircle className="h-4 w-4" />
								WhatsApp
							</Button>
						</a>

						<a href={links.sms} className="w-full">
							<Button variant="outline" className="w-full gap-2">
								<Phone className="h-4 w-4" />
								SMS
							</Button>
						</a>

						<a href={links.email} className="w-full">
							<Button variant="outline" className="w-full gap-2">
								<Mail className="h-4 w-4" />
								Email
							</Button>
						</a>

						<Button variant="outline" className="w-full gap-2" onClick={handleCopy}>
							{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
							{copied ? "Copied" : "Copy"}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
