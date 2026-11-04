import { useEffect, useMemo, useState } from "react";
import {
	useTable,
	stockFeatures,
	flexRender,
	type ColumnDef,
	type SortingState,
	type ColumnFiltersState,
} from "@tanstack/react-table";
import { Search, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "~/lib/db";
import type { Customer, Entry } from "~/types/db";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

type LedgerRow = Entry & {
	customerName: string;
};

export const meta = () => [{ title: "Ledger | Chalkup" }];

export default function LedgerPage() {
	const [rows, setRows] = useState<LedgerRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [globalFilter, setGlobalFilter] = useState("");
	const [statusFilter, setStatusFilter] = useState<"all" | "open" | "settled">("all");
	const [directionFilter, setDirectionFilter] = useState<"all" | "owes_me" | "i_owe">("all");

	// Load data from Dexie
	useEffect(() => {
		async function load() {
			setLoading(true);
			try {
				const [entries, customers] = await Promise.all([
					db.entries.toArray(),
					db.customers.toArray(),
				]);

				const customerMap = new Map<string, Customer>();
				customers.forEach((c) => customerMap.set(c.id, c));

				const joined: LedgerRow[] = entries.map((e) => ({
					...e,
					customerName: customerMap.get(e.customerId)?.name ?? "Unknown",
				}));

				setRows(joined);
			} finally {
				setLoading(false);
			}
		}
		load();
	}, []);

	const filteredRows = useMemo(() => {
		return rows.filter((row) => {
			if (statusFilter !== "all" && row.status !== statusFilter) return false;
			if (directionFilter !== "all" && row.direction !== directionFilter) return false;
			return true;
		});
	}, [rows, statusFilter, directionFilter]);

	const columns = useMemo<ColumnDef<typeof stockFeatures, LedgerRow>[]>(
		() => [
			{
				accessorKey: "customerName",
				header: ({ column }) => (
					<Button
						variant="ghost"
						size="sm"
						className="-ml-3 h-8"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Customer
						<ArrowUpDown className="ml-2 h-3.5 w-3.5" />
					</Button>
				),
				cell: ({ row }) => <span className="font-medium">{row.getValue("customerName")}</span>,
			},
			{
				accessorKey: "amount",
				header: ({ column }) => (
					<Button
						variant="ghost"
						size="sm"
						className="-ml-3 h-8"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Amount
						<ArrowUpDown className="ml-2 h-3.5 w-3.5" />
					</Button>
				),
				cell: ({ row }) => {
					const amount = row.getValue("amount") as number;
					const direction = row.original.direction;
					return (
						<span
							className={cn(
								"font-medium tabular-nums",
								direction === "owes_me" ? "text-primary" : "text-muted-foreground",
							)}
						>
							{direction === "owes_me" ? "+" : "−"}
							{amount.toLocaleString()}
						</span>
					);
				},
			},
			{
				accessorKey: "direction",
				header: "Type",
				cell: ({ row }) => {
					const dir = row.getValue("direction") as string;
					return (
						<span className="text-sm text-muted-foreground">
							{dir === "owes_me" ? "They owe me" : "I owe them"}
						</span>
					);
				},
			},
			{
				accessorKey: "description",
				header: "Description",
				cell: ({ row }) => (
					<span className="text-sm text-muted-foreground max-w-45 truncate block">
						{row.getValue("description") || "—"}
					</span>
				),
			},
			{
				accessorKey: "dueDate",
				header: "Due",
				cell: ({ row }) => {
					const date = row.getValue("dueDate") as Date | null;
					if (!date) return <span className="text-muted-foreground">—</span>;
					return (
						<span className="text-sm tabular-nums">
							{new Date(date).toLocaleDateString(undefined, {
								month: "short",
								day: "numeric",
							})}
						</span>
					);
				},
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }) => {
					const status = row.getValue("status") as string;
					return (
						<Badge variant={status === "open" ? "default" : "secondary"} className="capitalize">
							{status}
						</Badge>
					);
				},
			},
			{
				accessorKey: "createdAt",
				header: ({ column }) => (
					<Button
						variant="ghost"
						size="sm"
						className="-ml-3 h-8"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Date
						<ArrowUpDown className="ml-2 h-3.5 w-3.5" />
					</Button>
				),
				cell: ({ row }) => {
					const date = row.getValue("createdAt") as Date;
					return (
						<span className="text-sm text-muted-foreground tabular-nums">
							{new Date(date).toLocaleDateString(undefined, {
								month: "short",
								day: "numeric",
								year: "numeric",
							})}
						</span>
					);
				},
			},
			{
				accessorKey: "source",
				header: "Source",
				cell: ({ row }) => (
					<span className="text-xs text-muted-foreground capitalize">{row.getValue("source")}</span>
				),
			},
		],
		[],
	);

	const table = useTable({
		features: stockFeatures,
		data: filteredRows,
		columns,
		state: {
			sorting,
			columnFilters,
			globalFilter,
		},
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onGlobalFilterChange: setGlobalFilter,
		initialState: {
			pagination: { pageSize: 10, pageIndex: 0 },
			sorting: [{ id: "createdAt", desc: true }],
		},
	});

	// Summary numbers
	const summary = useMemo(() => {
		const open = filteredRows.filter((r) => r.status === "open");
		const owedToMe = open.filter((r) => r.direction === "owes_me").reduce((s, r) => s + r.amount, 0);
		const iOwe = open.filter((r) => r.direction === "i_owe").reduce((s, r) => s + r.amount, 0);
		return { owedToMe, iOwe, net: owedToMe - iOwe };
	}, [filteredRows]);

	return (
		<div className="min-h-dvh bg-background text-foreground">
			<div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
				{/* Header */}
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-bold tracking-tight">Ledger</h1>
					<p className="text-sm text-muted-foreground">All debts and payments</p>
				</div>

				{/* Summary cards */}
				<div className="grid grid-cols-3 gap-3">
					<div className="rounded-lg border bg-card p-4">
						<p className="text-xs text-muted-foreground">Owed to you</p>
						<p className="text-xl font-semibold text-primary tabular-nums mt-1">
							+{summary.owedToMe.toLocaleString()}
						</p>
					</div>
					<div className="rounded-lg border bg-card p-4">
						<p className="text-xs text-muted-foreground">You owe</p>
						<p className="text-xl font-semibold text-muted-foreground tabular-nums mt-1">
							−{summary.iOwe.toLocaleString()}
						</p>
					</div>
					<div className="rounded-lg border bg-card p-4">
						<p className="text-xs text-muted-foreground">Net</p>
						<p
							className={cn(
								"text-xl font-semibold tabular-nums mt-1",
								summary.net >= 0 ? "text-primary" : "text-destructive",
							)}
						>
							{summary.net >= 0 ? "+" : ""}
							{summary.net.toLocaleString()}
						</p>
					</div>
				</div>

				{/* Filters */}
				<div className="flex flex-col sm:flex-row gap-3">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search customer or description…"
							value={globalFilter}
							onChange={(e) => setGlobalFilter(e.target.value)}
							className="pl-9"
						/>
					</div>

					<Select
						value={statusFilter}
						onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
					>
						<SelectTrigger className="w-full sm:w-35">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All status</SelectItem>
							<SelectItem value="open">Open</SelectItem>
							<SelectItem value="settled">Settled</SelectItem>
						</SelectContent>
					</Select>

					<Select
						value={directionFilter}
						onValueChange={(v) => setDirectionFilter(v as typeof directionFilter)}
					>
						<SelectTrigger className="w-full sm:w-40">
							<SelectValue placeholder="Direction" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All types</SelectItem>
							<SelectItem value="owes_me">They owe me</SelectItem>
							<SelectItem value="i_owe">I owe them</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Table */}
				<div className="rounded-lg border bg-card overflow-hidden">
					<Table>
						<TableHeader>
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id} className="hover:bg-transparent">
									{headerGroup.headers.map((header) => (
										<TableHead key={header.id} className="h-11">
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell colSpan={columns.length} className="h-32 text-center">
										Loading…
									</TableCell>
								</TableRow>
							) : table.getRowModel().rows.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={columns.length}
										className="h-32 text-center text-muted-foreground"
									>
										No entries found
									</TableCell>
								</TableRow>
							) : (
								table.getRowModel().rows.map((row) => (
									<TableRow key={row.id} className="hover:bg-muted/40">
										{row.getVisibleCells().map((cell) => (
											<TableCell key={cell.id} className="py-3">
												{flexRender(cell.column.columnDef.cell, cell.getContext())}
											</TableCell>
										))}
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>

				{/* Pagination */}
				<div className="flex items-center justify-between">
					<p className="text-sm text-muted-foreground">
						{table.getFilteredRowModel().rows.length} entr
						{table.getFilteredRowModel().rows.length === 1 ? "y" : "ies"}
					</p>

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => table.previousPage()}
							disabled={!table.getCanPreviousPage()}
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<span className="text-sm text-muted-foreground tabular-nums">
							{table.state.pagination.pageIndex + 1} / {table.getPageCount() || 1}
						</span>
						<Button
							variant="outline"
							size="sm"
							onClick={() => table.nextPage()}
							disabled={!table.getCanNextPage()}
						>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
