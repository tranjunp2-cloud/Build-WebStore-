import type { ReceiptRecord } from "@ech/agent-core";

type Item = {
	kind: "product" | "blog_post";
	id: string;
	title: string;
	status?: string;
	url?: string;
	meta?: string;
	facts?: ReadonlyArray<{ label: string; value: string }>;
};

/** Same-origin app paths only: a record card never links out of the app. */
const appPath = (url: string | undefined) => (url && /^\/(?!\/)/.test(url) ? url : undefined);
const webUrl = (url: string | undefined) => (url && (/^\/(?!\/)/.test(url) || /^https?:\/\//i.test(url)) ? url : undefined);

/**
 * A product or post the run read or found, as the chat's record card: its name, status, one
 * short line (price or SKU) and where it opens — instead of a grid of its photos.
 */
export function itemRecord(item: Item, thumb?: string): ReceiptRecord {
	const fact = item.facts?.find((f) => /^(price|giá|harga)(?=$|[\s:(])/i.test(f.label.trim())) ?? item.facts?.find((f) => /sku/i.test(f.label));
	const meta = item.meta ?? (fact ? `${fact.label}: ${fact.value}` : undefined);
	const href = appPath(item.url);
	const image = webUrl(thumb);
	return {
		kind: item.kind === "product" ? "product" : "post",
		id: item.id.slice(0, 80),
		title: item.title.slice(0, 200),
		...(item.status ? { status: item.status.slice(0, 40) } : {}),
		...(meta ? { meta: meta.slice(0, 120) } : {}),
		...(href ? { href } : {}),
		...(image ? { thumb: image } : {}),
	};
}
