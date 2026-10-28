import "server-only";

import config from "@payload-config";
import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { z } from "zod";
import { isAiAgentEnabled } from "../config";
import { AgentAccessError } from "../context";
import { incomingRequestId, requestIdOf, withRequestId } from "../request-id";
import { MediaSourceUnavailableError, searchMedia, StockPhotosUnavailableError } from "./media-tools";
import { readPost, searchPosts } from "./content-tools";
import { snapshotPost } from "./record-snapshot";
import { resolveToolActor } from "./tool-actor";
import { StoreProductError } from "./store-product-doc";
import { GeneratedPictureError, GeneratedPictureSchema, saveGeneratedPicture } from "../generated-images";
import { readShopProduct, searchShopProducts, snapshotShopProduct } from "./store-product-tools";
import { preparePagePatch, prepareThemeChange } from "../site/site-prepare";
import { withDefaultSite } from "../site/site-default";
import { readSite, SiteToolError } from "../site/site-read";
import { prepareSeoChange, prepareTranslatePage } from "../site/site-seo-translate";
import { preparePublish as prepareSitePublish, readSiteCheck } from "../site/site-check";
import { prepareNavChange, readNavigation } from "../site/site-nav";
import { prepareSiteLanguages, readSiteLanguages } from "../site/site-languages";
import { preparePageCreate, prepareSitePatch } from "../site/site-structure";
import { prepareStoreCategories, readStoreCategories } from "../store/store-categories";
import { readStoreDiscounts } from "../store/store-discounts";
import { prepareStoreDiscounts } from "../store/store-discounts-prepare";
import { readStoreCustomers } from "../store/store-customers";
import { prepareStoreCustomers } from "../store/store-customers-prepare";
import { OrdersToolError, readStoreOrders } from "../store/store-orders";
import { prepareStoreOrders } from "../store/store-orders-prepare";
import { readStoreReports } from "../store/store-reports";
import { readStoreTodos } from "../store/store-todos";

const ReadItemInput = z.object({ kind: z.enum(["product", "blog_post"]), id: z.string().min(1).max(120) });
const SearchItemsInput = z.object({
	kind: z.enum(["product", "blog_post"]),
	query: z.string().max(80).optional(),
	status: z.enum(["draft", "published", "any", "trash"]).optional(),
	limit: z.number().int().min(1).max(10).optional(),
});
const SaveGeneratedInput = z.object({ prompt: z.string().min(1).max(1000), picture: GeneratedPictureSchema });
const SiteViewInput = z.object({ siteId: z.union([z.string().min(1).max(40), z.number().int().positive()]) });
const MediaInput = z.object({
	source: z.enum(["stock", "media", "product"]),
	query: z.string().max(80).default(""),
	limit: z.number().int().min(1).max(24).optional(),
});

function problem(status: number, detail: string) {
	return NextResponse.json({ title: "Agent tool failed", status, detail }, { status });
}

/**
 * Agent tool facade — the AI platform's typed door to the shop's website (pages, theme, navigation,
 * publishing checks) and to stock photos. Every call acts for the merchant in the forwarded context
 * token, with their own permissions. Reads and drafts only: nothing is written until the merchant approves
 * (the apply step lives in the BFF). No commerce platform is involved. Blog posts, store products (Payload
 * `products`), the shop's picture library and generated pictures are served from this app's own collections.
 */
export async function handleAgentTool(req: Request, tool: string): Promise<Response> {
	// the id ai-platform sent with this call (its run's request) also goes on any ai-platform call made from here
	return withRequestId(requestIdOf(req), () => runAgentTool(req, tool));
}

async function runAgentTool(req: Request, tool: string): Promise<Response> {
	if (!isAiAgentEnabled()) return problem(404, "The AI assistant is not enabled.");
	try {
		const actor = await resolveToolActor(req);
		// a website tool called away from the site editor says siteId "auto": the workspace's only website
		const body = await withDefaultSite(actor, tool, await req.json().catch(() => ({})));
		switch (tool) {
			case "content.read_item":
			case "content.snapshot": {
				const input = ReadItemInput.parse(body);
				// the shop's own products (Payload `products`)
				if (input.kind === "product") return NextResponse.json(tool === "content.snapshot" ? await snapshotShopProduct(actor, input.id) : await readShopProduct(actor, input.id));
				// blog posts: read as the merchant (Payload access) and pinned to the workspace; snapshot = exact values + version
				const cms = await getPayload({ config });
				const post = tool === "content.snapshot" ? await snapshotPost(cms, actor.user, actor.tenantId, input.id) : await readPost(cms, actor.user, actor.tenantId, input.id);
				return post ? NextResponse.json(post) : problem(404, "No such post in this workspace.");
			}
			case "content.search_items": {
				const input = SearchItemsInput.parse(body);
				if (input.kind === "product") return NextResponse.json(await searchShopProducts(actor, input));
				return NextResponse.json(await searchPosts(await getPayload({ config }), actor.user, actor.tenantId, input));
			}
			case "media.search": {
				const input = MediaInput.parse(body);
				// stock photos (Pixabay), the shop's library and its products' photos (only what media-access allows this workspace)
				return NextResponse.json({ items: await searchMedia(input, actor.tenantId) });
			}
			case "media.save_generated": {
				// the one write here: a picture ai-platform drew for this merchant is kept in their media library
				const input = SaveGeneratedInput.parse(body);
				return NextResponse.json(await saveGeneratedPicture(await getPayload({ config }), actor, input.picture, input.prompt));
			}
			case "site.read": {
				// the editor's page draft, one section, the theme, block types, store products — read-only
				const view = (body as { view?: unknown } | null)?.view;
				// what is still missing before publishing, and the menu/footer draft
				if (view === "check") return NextResponse.json(await readSiteCheck(actor, SiteViewInput.parse(body).siteId));
				if (view === "navigation") return NextResponse.json(await readNavigation(actor, SiteViewInput.parse(body).siteId));
				// the website's languages and how much of each page is translated
				if (view === "languages") return NextResponse.json(await readSiteLanguages(actor, SiteViewInput.parse(body).siteId));
				return NextResponse.json(await readSite(actor, body));
			}
			case "site.prepare_patch":
				// a page edit drafted from a fresh read of the draft — nothing is written until confirmed
				return NextResponse.json(await preparePagePatch(actor, body));
			case "site.prepare_seo":
				return NextResponse.json(await prepareSeoChange(actor, body));
			case "site.prepare_translate":
				// the translation is produced here (AI platform task) so the card shows the real text; nothing is written
				return NextResponse.json(await prepareTranslatePage(actor, body));
			case "site.prepare_theme":
				return NextResponse.json(await prepareThemeChange(actor, body));
			case "site.prepare_pages":
				// one edit across several pages, all or nothing
				return NextResponse.json(await prepareSitePatch(actor, body));
			case "site.prepare_page_create":
				return NextResponse.json(await preparePageCreate(actor, body));
			case "site.prepare_nav":
				return NextResponse.json(await prepareNavChange(actor, body));
			case "store.categories":
				// the Product Store's categories (tree, product counts) and store products by name
				return NextResponse.json(await readStoreCategories(actor, body));
			case "store.prepare_categories":
				// create / rename / move / delete categories, put products in one — nothing written until approved
				return NextResponse.json(await prepareStoreCategories(actor, body));
			case "store.discounts":
				// the shop's discount codes: the list with live state and usage, or one code in full
				return NextResponse.json(await readStoreDiscounts(actor, body));
			case "store.reports":
				// sales / best sellers / discount performance / orders by status / traffic for a period (shop time), read-only
				return NextResponse.json(await readStoreReports(actor, body));
			case "store.todos":
				// what needs attention now (the dashboard's To do card), read-only
				return NextResponse.json(await readStoreTodos(actor, body));
			case "store.prepare_discounts":
				// create / change / activate / pause / delete discount codes — nothing written until approved
				return NextResponse.json(await prepareStoreDiscounts(actor, body));
			case "store.orders":
				// the shop's orders: the list, one order in full, or what needs action today
				return NextResponse.json(await readStoreOrders(actor, body));
			case "store.prepare_orders":
				// confirm / ship / complete / payment proofs / cancel / refund — nothing written until approved
				return NextResponse.json(await prepareStoreOrders(actor, body));
			case "store.customers":
				// customers, contact leads and email templates: the list or one in full (the merchant's own role)
				return NextResponse.json(await readStoreCustomers(actor, body));
			case "store.prepare_customers":
				// customer rank / note, lead status, one email reply, email template wording — nothing written until approved
				return NextResponse.json(await prepareStoreCustomers(actor, body));
			case "site.prepare_languages":
				// add / remove the second language, change the primary one — the menu draft, nothing written yet
				return NextResponse.json(await prepareSiteLanguages(actor, body));
			case "site.prepare_publish":
				// the check runs here; nothing goes live until the merchant says Yes
				return NextResponse.json(await prepareSitePublish(actor, body));
			default:
				return problem(404, `Unknown tool ${tool}.`);
		}
	} catch (error) {
		if (error instanceof AgentAccessError) return problem(error.status, error.message);
		// expected refusals go back to the model as data it can act on
		if (error instanceof SiteToolError) return NextResponse.json({ error: { code: `site_${error.status}`, message: error.message } });
		if (error instanceof OrdersToolError) return NextResponse.json({ error: { code: error.code, message: error.message } });
		// a malformed site edit is the model's to fix: say what was wrong
		if (error instanceof z.ZodError && (tool.startsWith("site.") || tool.startsWith("store."))) {
			const issue = error.issues[0];
			return NextResponse.json({ error: { code: "invalid_input", message: `${issue?.path.join(".") || "input"}: ${issue?.message ?? "invalid"}` } });
		}
		if (error instanceof StoreProductError || error instanceof GeneratedPictureError) return problem(error.status, error.message);
		if (error instanceof StockPhotosUnavailableError) return problem(503, error.message);
		if (error instanceof MediaSourceUnavailableError) return problem(501, error.message);
		if (error instanceof z.ZodError) return problem(400, "Invalid tool input.");
		console.error(`[agent-tools] failure (tool ${tool}, request ${incomingRequestId(req) ?? "none"})`, error);
		return problem(500, "The tool failed.");
	}
}
