import type { AgentRun, ReceiptMedia } from "@ech/agent-core";

/** Same-origin paths and http(s) only — never `javascript:` or `data:` from a tool. */
function safeUrl(url: string): string | null {
	return /^\/(?!\/)/.test(url) || /^https?:\/\//i.test(url) ? url : null;
}

/** The pictures a run found or made, or else the ones it read (receipts), each once. */
export function runMedia(run: AgentRun | undefined): ReceiptMedia[] {
	const seen = new Set<string>();
	const out: ReceiptMedia[] = [];
	// photos picked in a question card are already the merchant's answer (the answered row says so):
	// shown again here as "Use this" they read as a new choice to make
	const receipts = (run?.receipts ?? []).filter((r) => r.tool !== "catalog.ask_user");
	// pictures the merchant can use (found / generated) are the answer; what the run read on
	// the way is context — shown only when the run just read (no picture to pick, no change staged)
	const usable = receipts.some((r) => r.media?.some((m) => m.imageId));
	if (!usable && (run?.changeSetIds.length ?? 0) > 0) return [];
	for (const receipt of receipts) {
		for (const item of (receipt.media ?? []).filter((m) => !usable || m.imageId)) {
			const url = safeUrl(item.url);
			if (!url || seen.has(url)) continue;
			seen.add(url);
			out.push({ ...item, url });
		}
	}
	return out.slice(0, 12);
}

/** DAM thumbnails open as the full preview. */
function fullUrl(url: string): string {
	return url.replace(/\/thumbnail$/, "/preview");
}

/**
 * Pictures under a reply: one shows wide, more sit in a two-column grid.
 * Each opens full size in a new tab; the label (Cover, Generated) sits on it.
 */
export function RunMedia({
	items,
	openLabel = "Open picture",
	useLabel = "Use this",
	chosenLabel = "Selected",
	chosen,
	onUse,
}: {
	items: readonly ReceiptMedia[];
	openLabel?: string;
	useLabel?: string;
	chosenLabel?: string;
	/** image ids chosen for the next message: the tile shows it, its button takes it back */
	chosen?: ReadonlySet<string>;
	/** a picture the run can place (find_images / generate_image) → choose it for the assistant */
	onUse?: (item: ReceiptMedia) => void;
}) {
	if (items.length === 0) return null;
	return (
		<div className={`ech-ag-pics${items.length === 1 ? " is-single" : ""}`}>
			{items.map((item) => {
				const isChosen = Boolean(item.imageId && chosen?.has(item.imageId));
				return (
				<div key={item.url} className={`ech-ag-pic${isChosen ? " is-chosen" : ""}`}>
					<a
						href={fullUrl(item.url)}
						target="_blank"
						rel="noopener noreferrer"
						title={item.alt ?? item.label ?? openLabel}
						aria-label={`${openLabel}: ${item.alt ?? item.label ?? ""}`.trim()}
					>
						<img src={item.url} alt={item.alt ?? ""} loading="lazy" decoding="async" />
					</a>
					{item.label && <span className="ech-ag-pic-label">{item.label}</span>}
					{onUse && item.imageId && (
						<button type="button" className="ech-ag-pic-use" aria-pressed={isChosen} onClick={() => onUse(item)}>
							{isChosen ? `✓ ${chosenLabel}` : useLabel}
						</button>
					)}
				</div>
				);
			})}
		</div>
	);
}
