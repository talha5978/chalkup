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
import type { ReminderTone } from "~/types/db";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSaved?: () => void;
};

export function SettingsDialog({ open, onOpenChange, onSaved }: Props) {
	const [currency, setCurrency] = useState("PKR");
	const [currencySymbol, setCurrencySymbol] = useState("Rs");
	const [defaultTone, setDefaultTone] = useState<ReminderTone>("friendly");
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!open) return;
		(async () => {
			const s = await db.getOrCreateSettings();
			setCurrency(s.currency);
			setCurrencySymbol(s.currencySymbol);
			setDefaultTone(s.defaultTone);
		})();
	}, [open]);

	const handleSave = async () => {
		setSaving(true);
		try {
			await db.settings.put({
				id: "settings",
				currency: currency.trim() || "PKR",
				currencySymbol: currencySymbol.trim() || "Rs",
				defaultTone,
				updatedAt: new Date(),
			});
			onSaved?.();
			onOpenChange(false);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Settings</DialogTitle>
					<DialogDescription>Currency and default reminder tone for this device.</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-2">
							<Label htmlFor="currency">Currency code</Label>
							<Input
								id="currency"
								value={currency}
								onChange={(e) => setCurrency(e.target.value)}
								placeholder="PKR"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="symbol">Symbol</Label>
							<Input
								id="symbol"
								value={currencySymbol}
								onChange={(e) => setCurrencySymbol(e.target.value)}
								placeholder="Rs"
							/>
						</div>
					</div>

					<div className="space-y-2">
						<Label>Default reminder tone</Label>
						<Select value={defaultTone} onValueChange={(v) => setDefaultTone(v as ReminderTone)}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="friendly">Friendly</SelectItem>
								<SelectItem value="neutral">Neutral</SelectItem>
								<SelectItem value="firm">Firm</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							Used when drafting WhatsApp / SMS / email reminders.
						</p>
					</div>
				</div>

				<DialogFooter className="gap-2">
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={saving} className="gap-2">
						<Save className="h-4 w-4" />
						{saving ? "Saving…" : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
