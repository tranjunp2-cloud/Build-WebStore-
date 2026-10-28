import { z } from "zod";

/**
 * The copilot's inventory tools, shared by ai-platform (what the model calls)
 * and prime-web (which resolves, validates against @ech/contracts and applies).
 * Inputs are nullable rather than optional: one strict JSON schema for every
 * model provider.
 */

export const INVENTORY_VIEWS = [
	"overview",
	"stock",
	"product",
	"item",
	"warehouses",
	"warehouse",
	"transfers",
	"transfer",
	"reservations",
	"reservation",
	"adjustments",
	"adjustment",
	"cycle_counts",
	"cycle_count",
	"holds",
	"facility_locations",
	"location_mappings",
] as const;

export const InventoryReadInputSchema = z.object({
	view: z
		.enum(INVENTORY_VIEWS)
		.describe(
			"overview = what needs attention (low/out of stock, transfers to dispatch/receive, approvals, expiring reservations, channel sync); stock = search stock rows; product = one product's variants per warehouse, holds by type, channel published qty; item = one inventory item with channels / commitments / stock history; the rest are lists and details",
		),
	query: z.string().max(120).nullable().describe("words / SKU to search"),
	id: z
		.string()
		.max(120)
		.nullable()
		.describe("detail views: product = productId; item = inventoryItemId, SKU or product name (one call gives channels, reservations and stock history); transfer / adjustment / count / reservation id"),
	warehouse: z.string().max(120).nullable().describe("warehouse name, code or id to filter by"),
	status: z.string().max(40).nullable().describe("stock: in_stock | low_stock | out_of_stock | oversold; ledgers: their own statuses"),
	include: z.enum(["channels", "commitments", "timeline", "all"]).nullable().describe("item view: which drill-down"),
	limit: z.number().int().min(1).max(50).nullable(),
});
export type InventoryReadInput = z.infer<typeof InventoryReadInputSchema>;

export const INVENTORY_CAPABILITIES = [
	"stock.adjust",
	"stock.receive",
	"stock.set_count",
	"stock.opening",
	"transfer.send",
	"transfer.send_and_receive",
	"transfer.draft",
	"transfer.edit",
	"transfer.reserve",
	"transfer.dispatch",
	"transfer.receive",
	"transfer.cancel",
	"transfer.resolve_exception",
	"count.create",
	"count.record",
	"count.submit",
	"count.approve",
	"count.post",
	"count.cancel",
	"hold.place",
	"hold.release",
	"reservation.release",
	"adjustment.submit",
	"adjustment.approve",
	"adjustment.reject",
	"adjustment.void",
	"adjustment.post",
	"warehouse.create",
	"warehouse.update",
	"warehouse.set_default",
	"warehouse.deactivate",
	"warehouse.reactivate",
	"warehouse.delete",
	"warehouse.map_channel",
	"location.create",
	"location.update",
	"mapping.confirm",
	"mapping.adopt_stock",
] as const;
export type InventoryCapability = (typeof INVENTORY_CAPABILITIES)[number];

export const InventoryProposalInputSchema = z.object({
	capability: z.enum(INVENTORY_CAPABILITIES),
	why: z
		.string()
		.min(3)
		.max(300)
		.describe("One line in the merchant's language, built only from numbers you read (stock per warehouse, reservations, low stock). Never invent numbers."),
	warehouse: z.string().max(120).nullable().describe("the warehouse it happens in / the source of a transfer (name, code or id)"),
	toWarehouse: z.string().max(120).nullable().describe("transfer destination"),
	targetId: z
		.string()
		.max(120)
		.nullable()
		.describe("existing transfer / count / adjustment / hold / reservation / facility location / location mapping id"),
	lines: z
		.array(
			z.object({
				item: z.string().min(1).max(200).describe("inventoryItemId, SKU or product name"),
				quantity: z
					.number()
					.nullable()
					.describe("adjust: signed delta; receive / transfer / hold / dispatch / receive: units; set_count / count / opening: counted units"),
				shortageReason: z.string().max(220).nullable().describe("transfer receive: why fewer arrived"),
			}),
		)
		.max(200)
		.nullable()
		.describe("over 50 lines is split into several commands automatically"),
	reason: z
		.string()
		.max(80)
		.nullable()
		.describe(
			"adjust: received | found | damaged | lost | other; hold: quality_hold | return_inspection | damage | manual; resolve_exception: write_off | return_to_source | release_undispatched; mapping.adopt_stock: adopt | decline",
		),
	note: z.string().max(400).nullable(),
	fields: z
		.object({
			name: z.string().max(160).nullable(),
			shortCode: z.string().max(40).nullable(),
			warehouseType: z.enum(["main_warehouse", "retail_store", "third_party_partner", "backup_storage"]).nullable(),
			status: z.enum(["active", "paused"]).nullable(),
			countryCode: z.string().max(2).nullable(),
			region: z.string().max(120).nullable(),
			city: z.string().max(120).nullable(),
			addressLine1: z.string().max(200).nullable(),
			postalCode: z.string().max(20).nullable(),
			code: z.string().max(160).nullable().describe("facility location code"),
			locationKind: z.string().max(40).nullable().describe("facility location kind, e.g. storage, receiving, quarantine, returns, packing"),
			parentId: z.string().max(120).nullable(),
			salesChannelUnitId: z.string().max(120).nullable(),
			enabled: z.boolean().nullable(),
		})
		.nullable()
		.describe("warehouse / facility location / channel binding fields"),
});
export type InventoryProposalInput = z.infer<typeof InventoryProposalInputSchema>;
