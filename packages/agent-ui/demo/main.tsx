import type {
	AgentAttachment,
	AgentChatTurn,
	AgentRun,
	AgentThread,
	ChangeSet,
	ComposerAttachment,
	DraftField,
} from "@ech/agent-core";
import { createRoot } from "react-dom/client";
import { type AgentChatView, AgentAssistantPanel, type AgentPanelHistory } from "../src";
import "../src/styles.css";

/**
 * Static state gallery for the assistant panel — one URL per state, same
 * params as the approved wireframe (`?man=moi|hoi|nhap-sp|nhap-blog|lich-su`
 * `&tt=du-lieu|dang-tai|rong|loi|go`). Sample data only; nothing is wired.
 */
const params = new URLSearchParams(location.search);
const man = params.get("man") ?? "hoi";
const tt = params.get("tt") ?? "du-lieu";

const IMG = (id: string, w = 400) => `https://images.unsplash.com/photo-${id}?w=${w}&q=70&auto=format&fit=crop`;
const SHIRT_GREY = IMG("1601762603339-fd61e28b698a");
const SHIRT_IVORY = IMG("1617019114583-affb34d1b3cd");
const TEES = IMG("1523381210434-271e8be1f52b");
const RACK = IMG("1490481651871-ab68de25d43d", 800);
const KNITS = IMG("1558769132-cb1aea458c5e", 900);
const FLAT = IMG("1556905055-8f358a7a47b2", 800);

const NOW = new Date();
const iso = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();

const att = (id: string, name: string, url?: string, kind: "image" | "document" = "image"): AgentAttachment => ({
	id,
	kind,
	origin: "upload",
	name,
	mime: kind === "image" ? "image/jpeg" : "application/pdf",
	size: 240_000,
	url,
});

const userTurn: AgentChatTurn = {
	id: "user_1",
	role: "user",
	text: "Create a product from these photos. Oversized cotton shirt, grey and ivory, S to XL, RM 89. Size chart attached.",
	attachments: [att("a1", "grey.jpg", SHIRT_GREY), att("a2", "ivory.jpg", SHIRT_IVORY)],
};

const baseRun: AgentRun = {
	id: "run_1",
	role: "merchant",
	domain: "products",
	prompt: userTurn.text,
	status: "running",
	steps: [
		{ id: "read", label: "Read your photos and size chart", status: "done" },
		{ id: "families", label: "Reading your catalog families", status: "done" },
	],
	receipts: [
		{ id: "r1", tool: "catalog.read_attachments", summary: "2 photos, 1 PDF", durationMs: 820, status: "ok", entityIds: [] },
		{ id: "r2", tool: "catalog.list_families", summary: "23 families in your catalog", durationMs: 140, status: "ok", entityIds: [] },
	],
	changeSetIds: [],
	threadId: "thr_1",
	startedAt: iso(3),
};

const field = (key: string, label: string, value: string, source: DraftField["source"], group: DraftField["group"]): DraftField => ({
	key,
	label,
	value,
	source,
	group,
});

const productSet: ChangeSet = {
	id: "cs_product",
	runId: "run_1",
	domain: "products",
	title: "Oversized Cotton Shirt",
	summary: "Oversized Cotton Shirt",
	risk: "low",
	blastRadius: { kind: "product", count: 9, label: "1 product, 8 variants" },
	diffs: [{ entity: { kind: "product", id: "new" }, field: "name", before: null, after: "Oversized Cotton Shirt", provenance: "generated" }],
	guardrails: [],
	status: "pending",
	stagedBy: "agent",
	stagedAt: iso(1),
	expiresAt: iso(-60 * 24),
	drafts: [
		{
			type: "product",
			name: "Oversized Cotton Shirt",
			sku: "OCS",
			price: "RM 89.00",
			family: { code: "shirts_blouses", label: "Tops › Shirts & Blouses" },
			fields: [
				field("name", "Name", "Oversized Cotton Shirt", "ai", "product"),
				field("price", "Price", "RM 89.00", "you", "product"),
				field("brand", "Brand", "Kedai Linen", "family", "product"),
				field(
					"description",
					"Description",
					"A relaxed, dropped-shoulder shirt in breathable 100% cotton poplin. Wear it buttoned or open over a tee…",
					"ai",
					"product",
				),
				field("material", "Material", "100% cotton", "you", "required"),
				field("fit", "Fit", "Oversized", "you", "required"),
				field("sleeve", "Sleeve length", "Long sleeve", "auto", "required"),
				field("neckline", "Neckline", "Classic collar", "ai", "required"),
				field("pattern", "Pattern", "Solid", "auto", "required"),
				field("origin", "Country of origin", "Malaysia", "family", "required"),
				field("care", "Care instructions", "Machine wash cold, line dry", "ai", "optional"),
				field("occasion", "Occasion", "", "missing", "optional"),
				field("season", "Season", "", "missing", "optional"),
				field("collar", "Collar type", "Classic", "ai", "optional"),
				field("closure", "Closure", "Buttons", "ai", "optional"),
				field("length", "Length", "", "missing", "optional"),
				field("lining", "Lining", "", "missing", "optional"),
				field("fabric_weight", "Fabric weight", "", "missing", "optional"),
				field("seo_title", "Meta title", "Oversized Cotton Shirt — Grey & Ivory | Kedai Linen", "ai", "seo"),
				field("seo_description", "Meta description", "Relaxed oversized shirt in 100% cotton poplin, grey or ivory, sizes S–XL.", "ai", "seo"),
			],
			variants: {
				axes: [
					{ code: "color", label: "Colour" },
					{ code: "size", label: "Size" },
				],
				rows: ["Grey", "Ivory"].flatMap((colour) =>
					["S", "M", "L", "XL"].map((size) => ({
						label: `${colour} / ${size}`,
						sku: `OCS-${colour.slice(0, 2).toUpperCase()}-${size}`,
						values: [
							{ axis: "color", value: colour },
							{ axis: "size", value: size },
						],
						price: "RM 89.00",
						stock: 0,
					})),
				),
			},
			images: [
				{ url: SHIRT_GREY, origin: "upload", role: "main" },
				{ url: SHIRT_IVORY, origin: "upload", role: "gallery" },
				{ url: TEES, origin: "upload", role: "gallery" },
			],
		},
	],
};

const blogSet: ChangeSet = {
	...productSet,
	id: "cs_blog",
	domain: "cms",
	title: "How to care for linen and cotton so they last",
	drafts: [
		{
			type: "blog",
			title: "How to care for linen and cotton so they last",
			words: 1150,
			sections: 4,
			cover: { url: KNITS, origin: "stock", role: "cover", credit: "Pixabay" },
			images: [
				{ url: RACK, origin: "stock", role: "inline", credit: "Pixabay" },
				{ url: FLAT, origin: "media", role: "inline" },
				{ url: SHIRT_IVORY, origin: "upload", role: "inline" },
			],
			html: `<p>Natural fibres breathe beautifully in our climate, but they need a little care. Here is how we look after the pieces we sell, from the first wash to storage.</p><h3>1. Wash cold, turn inside out</h3><p>Cold water keeps the colour and stops cotton shrinking. Turn shirts inside out so buttons don't rub against the drum.</p><figure><img src="${RACK}" alt="Air-dry on wooden hangers"><figcaption>Pixabay · Air-dry on wooden hangers</figcaption></figure><h3>2. Dry in the shade</h3><p>Direct sun fades ivory and grey quickly. Hang in the shade and iron while slightly damp.</p>`,
			seo: {
				title: "Linen & cotton care guide | Kedai Linen",
				description:
					"How to wash, dry and store linen and cotton so they last: cold washes, shade drying and the right hangers, from the team at Kedai Linen.",
			},
		},
	],
};

const pendingOther: ChangeSet = { ...blogSet, id: "cs_other" };

function turnsFor(): AgentChatTurn[] {
	if (tt === "loi") {
		return [
			userTurn,
			{
				id: "run_1",
				role: "assistant",
				run: { ...baseRun, status: "failed", error: "The AI service didn't respond in time." },
				changeSets: [],
			},
		];
	}
	if (man === "moi" || tt === "rong" || tt === "dang-tai") return [];
	// `man=tiep`: the questions are answered and the run is back at work (two replies)
	if (man === "tiep") {
		const lead = "The hero button says “New Button” and has no link. Where should it go, and should it say something else?";
		return [
			{ id: "user_tiep", role: "user", text: "Check the broken button link and add one" },
			{
				id: "run_tiep",
				role: "assistant",
				run: {
					...baseRun,
					id: "run_tiep",
					status: tt === "xong" ? "applied" : "running",
					steps: [
						{ id: "model_1", label: "Thinking", status: "done", phrase: { key: "step.thinking" } },
						{ id: "model_2", label: "Drafting with your answers", status: tt === "xong" ? "done" : "running", phrase: { key: "step.drafting" } },
					],
					receipts: [],
					answer: tt === "xong" ? "Done — the hero button now says “Shop now” and opens the Shop page. Review the draft below." : lead,
					answers: [
						{ questionId: "q_link", kind: "choice", label: "Link", values: ["/shop"], display: "Shop page", source: "you" },
						{ questionId: "q_label", kind: "choice", label: "Label", values: ["Shop now"], display: "Change to “Shop now”", source: "you" },
					],
					intro: { answer: lead, steps: 1, receipts: 0, thoughtMs: 7_000, resumedAt: iso(0.2) },
					suggestions: [
						{ prompt: "Translate the homepage to English", source: "model" },
						{ prompt: "Check and improve the homepage SEO", source: "model" },
						{ prompt: "Make the theme colours brighter", source: "model" },
					],
					...(tt === "xong" ? { finishedAt: new Date(NOW.getTime() + 0).toISOString() } : {}),
				},
				changeSets: [],
			},
		];
	}
	if (man === "anh") {
		return [
			userTurn,
			{
				id: "run_1",
				role: "assistant",
				run: {
					...baseRun,
					status: "awaiting_input",
					answer: "Family and fit are set. One more: the photos.",
					answers: [
						{ questionId: "family", kind: "family", label: "Family", values: ["f"], display: "Tops › Shirts & Blouses", source: "auto", confidence: 0.94 },
						{ questionId: "attr_fit", kind: "attribute", label: "Fit", values: ["o"], display: "Oversized", source: "you" },
					],
					ask: {
						toolCallId: "call_1",
						index: 2,
						total: 3,
						question: {
							id: "images",
							kind: "images",
							label: "Photos",
							title: "Add product photos?",
							why: "Products publish with at least one photo. Pick from your library or upload your own.",
							options: [
								{ value: "asset:1", label: "Grey shirt", imageUrl: SHIRT_GREY },
								{ value: "asset:2", label: "Ivory shirt", imageUrl: SHIRT_IVORY },
								{ value: "asset:3", label: "Tees", imageUrl: TEES },
								{ value: "asset:4", label: "Flat lay", imageUrl: FLAT },
								{ value: "asset:5", label: "Knits", imageUrl: KNITS },
							],
							multiple: true,
							allowText: false,
							allowSkip: true,
							allowUpload: true,
						},
					},
				},
				changeSets: [],
			},
		];
	}
	if (man === "hoi" || man === "lich-su") {
		return [
			userTurn,
			{
				id: "run_1",
				role: "assistant",
				run: {
					...baseRun,
					status: "awaiting_input",
					answer: "I read the photos and the size chart: cotton, 2 colours, sizes S–XL. Three quick questions so the draft is ready to publish.",
					ask:
						man === "hoi"
							? {
									toolCallId: "call_1",
									index: 0,
									total: 3,
									next: "fit, material",
									question: {
										id: "family",
										kind: "family",
										label: "Family",
										title: "Which family is this product in?",
										why: "The family decides which attributes are required to publish. From your catalog:",
										options: [
											{ value: "shirts_blouses", label: "Tops › Shirts & Blouses", meta: "14 attributes · 6 required", confidence: 0.71 },
											{ value: "tshirts", label: "Tops › T-shirts", meta: "11 attributes · 5 required", confidence: 0.18 },
											{ value: "dresses", label: "Dresses", meta: "16 attributes · 7 required", confidence: 0.06 },
											{ value: "hijab", label: "Hijab & Tudung", meta: "9 attributes · 4 required", confidence: 0.02 },
										],
										suggested: "shirts_blouses",
										total: 23,
										multiple: false,
										allowText: false,
										allowSkip: true,
									},
								}
							: undefined,
				},
				changeSets: [],
			},
		];
	}
	if (man === "nhap-sp") {
		return [
			userTurn,
			{
				id: "run_1",
				role: "assistant",
				run: {
					...baseRun,
					status: "awaiting_approval",
					answer: "Here is the draft. All required attributes are filled; occasion and season are optional and still empty.",
					answers: [
						{ questionId: "family", kind: "family", label: "Family", values: ["shirts_blouses"], display: "Tops › Shirts & Blouses", source: "you" },
						{ questionId: "fit", kind: "attribute", label: "Fit", values: ["oversized"], display: "Oversized", source: "you" },
						{ questionId: "material", kind: "attribute", label: "Material", values: ["cotton_100"], display: "100% cotton", source: "you" },
					],
				},
				changeSets: [productSet],
			},
		];
	}
	return [
		{ id: "user_2", role: "user", text: "Write a blog post about caring for linen and cotton. Friendly tone, about 1,000 words." },
		{
			id: "run_2",
			role: "assistant",
			run: {
				...baseRun,
				id: "run_2",
				domain: "cms",
				status: "awaiting_approval",
				receipts: [...baseRun.receipts, { id: "r3", tool: "media.search_stock", summary: "Pixabay: linen care", durationMs: 300, status: "ok", entityIds: [] }],
				answer: "Here is the draft with a cover, two stock photos and one of your product photos.",
				answers: [
					{ questionId: "images", kind: "images", label: "Images", values: ["stock", "media"], display: "Stock photos + your media library", source: "you" },
					{ questionId: "feature", kind: "choice", label: "Feature product", values: ["p1"], display: "Oversized Cotton Shirt", source: "you" },
				],
			},
			changeSets: [blogSet],
		},
	];
}

const tray: ComposerAttachment[] =
	man === "moi" && tt === "du-lieu"
		? [
				{ key: "f1", name: "grey.jpg", kind: "image", status: "ready", progress: 1, previewUrl: SHIRT_GREY },
				{ key: "f2", name: "ivory.jpg", kind: "image", status: "ready", progress: 1, previewUrl: SHIRT_IVORY },
				{
					key: "f3",
					name: "size-chart-supplier.pdf",
					kind: "document",
					status: "ready",
					progress: 1,
					attachment: att("d1", "size-chart-supplier.pdf", undefined, "document"),
				},
				{ key: "f4", name: "flatlay.jpg", kind: "image", status: "uploading", progress: 0.6 },
			]
		: [];

const thread = (id: string, title: string, minutesAgo: number, extra: Partial<AgentThread> = {}): AgentThread => ({
	id,
	title,
	runCount: 2,
	createdAt: iso(minutesAgo),
	updatedAt: iso(minutesAgo),
	domain: "products",
	...extra,
});

const threads: AgentThread[] =
	tt === "rong"
		? []
		: [
				thread("thr_1", man === "nhap-blog" ? "How to care for linen and cotton" : "Oversized cotton shirt — new product", 2, {
					pendingDrafts: 1,
					domain: man === "nhap-blog" ? "cms" : "products",
				}),
				thread("thr_2", "Fill missing attributes on 12 shirts", 90, { appliedDrafts: 1 }),
				thread("thr_3", "How to care for linen and cotton", 60 * 20, { domain: "cms", pendingDrafts: 1 }),
				thread("thr_4", "Why did Shopee reject 3 listings?", 60 * 26, { domain: "listings" }),
				thread("thr_5", "Raya campaign product descriptions (Bahasa Melayu)", 60 * 24 * 3, { appliedDrafts: 6 }),
				thread("thr_6", "Batik scarf collection — 8 products from a supplier PDF with a very long title that wraps", 60 * 24 * 5),
			];

const noop = async () => undefined;
const history: AgentPanelHistory = {
	threadId: man === "moi" || tt === "rong" ? undefined : "thr_1",
	threads,
	restoring: tt === "dang-tai",
	error: undefined,
	newThread: () => undefined,
	openThread: noop,
	deleteThread: noop,
	refresh: noop,
};

const chat: AgentChatView & { history: AgentPanelHistory } = {
	// `&tt=go`: a question just sent, the reply is on its way (typing bubble)
	turns: tt === "go" ? [{ id: "user_go", role: "user", text: "Analyse the products I have" }] : turnsFor(),
	busy: tt === "go" || (man === "tiep" && tt !== "xong"),
	stop: noop,
	send: noop,
	canSend: (text) => text.trim().length > 0 || tray.some((a) => a.status === "ready"),
	retry: noop,
	answer: noop,
	searchOptions: async () => [],
	attachments: tray,
	attachmentError: undefined,
	attachFiles: noop,
	attachPicked: noop,
	uploadPictures: async () => [],
	removeAttachment: () => undefined,
	listMedia: async () => [
		{ ...att("m1", "rack.jpg", RACK), origin: "media" },
		{ ...att("m2", "knits.jpg", KNITS), origin: "media" },
		{ ...att("m3", "flat.jpg", FLAT), origin: "media" },
	],
	history,
};

const pending = tt === "rong" ? [] : man === "nhap-sp" ? [productSet, pendingOther] : man === "nhap-blog" ? [blogSet, pendingOther] : [productSet, pendingOther];

function App() {
	return (
		<AgentAssistantPanel
			chat={chat}
			open
			pageLabel="Products page"
			onRemoveContext={() => undefined}
			pending={pending}
			onDecide={async (cs) => ({ ...cs, status: "applied" })}
			onNavigate={() => undefined}
			suggestions={[
				{ icon: "image-plus", label: "Create a product from photos" },
				{ icon: "list-checks", label: "Fill missing attributes on 12 shirts" },
				{ icon: "newspaper", label: "Write a blog post with images" },
			]}
			menu={[{ label: "Customer inbox", icon: "inbox", href: "#inbox" }]}
		/>
	);
}

createRoot(document.getElementById("dock-host") as HTMLElement).render(<App />);

// open the state the URL names (wide review, recent chats)
setTimeout(() => {
	if ((man === "nhap-sp" || man === "nhap-blog") && tt === "du-lieu") {
		document.querySelector<HTMLButtonElement>(".ech-ag-draft-foot .ech-ag-button:not(.is-primary)")?.click();
	}
	if (man === "lich-su") document.querySelector<HTMLButtonElement>(".ech-ag-thread-title")?.click();
	if (params.get("menu") === "1") document.querySelector<HTMLButtonElement>(".ech-ag-c-row .ech-ag-ib")?.click();
	const stream = document.querySelector(".ech-ag-stream");
	if (stream) stream.scrollTop = stream.scrollHeight;
}, 50);
