import { type AiWork, type WorkAction, type WorkItem, WorkItemSchema } from "@ech/agent-core";
import { type ApproveKind, type WorkCopy, workCopy } from "./work-copy";
import { clip, type WorkLocale } from "./work-format";

/**
 * The assistant's part of the work queue, worded in the merchant's language:
 * one item per chat with drafts waiting for approval, one per run paused on a
 * question. Group "you" (the assistant waits on the merchant). No model call.
 */

/** Question first: a run is stopped until it is answered. */
const ORDER = { question: 0, review: 10 } as const;

type Area = keyof WorkCopy["area"];
const AREA_OF_DOMAIN: Record<string, { area: Area; icon: string }> = {
	webbuilder: { area: "website", icon: "layout-template" },
	cms: { area: "blog", icon: "file-text" },
	products: { area: "products", icon: "package" },
	listings: { area: "products", icon: "package" },
	pricing: { area: "products", icon: "package" },
	inventory: { area: "inventory", icon: "warehouse" },
	orders: { area: "orders", icon: "shopping-bag" },
	crm: { area: "customers", icon: "users" },
	support: { area: "customers", icon: "users" },
};

const areaOf = (domain: string | undefined, copy: WorkCopy) => {
	const found = (domain && AREA_OF_DOMAIN[domain]) || { area: "assistant" as Area, icon: "sparkles" };
	return { area: copy.area[found.area], icon: found.icon };
};

/** What approving the oldest waiting draft does, from its action kind: the row's icon, area and fact. */
const APPROVE: Array<{ match: (kind: string) => boolean; kind: ApproveKind; area: Area | "discounts"; icon: string; tone: "late" | "near" }> = [
	{ match: (k) => k === "store.customers_patch", kind: "email", area: "customers", icon: "mail", tone: "near" },
	{ match: (k) => k === "store.orders_patch", kind: "order", area: "orders", icon: "shopping-cart", tone: "late" },
	{ match: (k) => k === "store.discounts_patch", kind: "discount", area: "discounts", icon: "percent", tone: "near" },
	{ match: (k) => k === "store.categories_patch", kind: "category", area: "products", icon: "package", tone: "near" },
	{ match: (k) => k.startsWith("shop_product.") || k.startsWith("product") || k.startsWith("pm."), kind: "product", area: "products", icon: "package", tone: "near" },
	{ match: (k) => k.startsWith("blog."), kind: "blog", area: "blog", icon: "file-text", tone: "near" },
	{ match: (k) => k === "site.theme_patch", kind: "theme", area: "website", icon: "layout-template", tone: "near" },
	{ match: (k) => k.startsWith("site."), kind: "website", area: "website", icon: "layout-template", tone: "near" },
];

function approveOf(actionKind: string | undefined, domain: string | undefined, copy: WorkCopy) {
	const found = actionKind ? APPROVE.find((entry) => entry.match(actionKind)) : undefined;
	if (!found) return { ...areaOf(domain, copy), fact: { text: copy.approve.other, tone: "near" as const } };
	return { area: found.area === "discounts" ? copy.discounts : copy.area[found.area], icon: found.icon, fact: { text: copy.approve[found.kind], tone: found.tone } };
}

/** The site editor has its own chat: its threads open the editor (the site's when the task names it). */
function editorHref(taskKey: string | undefined): string {
	const site = taskKey?.match(/^entity:site:([A-Za-z0-9_-]{1,64})$/)?.[1];
	return site ? `/editor/${site}` : "/editor";
}

function openAction(thread: { threadId: string; domain?: string; taskKey?: string }, label: string, copy: WorkCopy): WorkAction {
	if (thread.domain === "webbuilder") return { kind: "link", value: editorHref(thread.taskKey), label: copy.openEditor };
	return { kind: "open_thread", value: thread.threadId, label };
}

const taskKeyOf = (thread: { threadId: string; taskKey?: string }) => thread.taskKey || `thread:${thread.threadId}`;

/** Only contract-valid items leave here; a malformed upstream row is dropped, not shown broken. */
function valid(item: WorkItem): WorkItem[] {
	const parsed = WorkItemSchema.safeParse(item);
	if (parsed.success) return [parsed.data];
	console.warn("[ai-work] dropped an invalid work item", item.key, parsed.error.issues[0]?.message);
	return [];
}

/** The site editor's chats stay in the editor: their drafts and questions are reviewed there, never in the dashboard's queue. */
const outsideEditor = (thread: { domain?: string }) => thread.domain !== "webbuilder";

export function aiWorkItems(work: Pick<AiWork, "reviews" | "questions">, locale: WorkLocale): WorkItem[] {
	const copy = workCopy(locale);
	const reviews = work.reviews.filter(outsideEditor).flatMap((review) => {
		const chat = clip(review.title, 100);
		// what approving does, named by the waiting draft itself ("Reply to Farid Hassan"); the chat it sits in when that differs
		const title = clip(review.change?.title ?? review.title, 100);
		const where = title !== chat ? copy.question.detail(chat) : undefined;
		const detail = [review.count > 1 ? copy.review.detail(review.count) : undefined, where].filter(Boolean).join(" · ");
		const action = openAction(review, copy.review.label, copy);
		return valid({
			key: clip(`ai:review:${review.threadId}`, 120),
			source: "ai",
			kind: "review",
			group: "you",
			order: ORDER.review,
			count: review.count,
			title: clip(copy.review.title(title), 160),
			...(detail ? { detail: clip(detail, 200) } : {}),
			...approveOf(review.change?.actionKind, review.domain, copy),
			say: clip(copy.review.say(title, review.count), 400),
			short: clip(copy.review.short(title), 120),
			actions: [action],
			...(action.kind === "link" ? { href: action.value } : {}),
			taskKey: clip(taskKeyOf(review), 120),
			taskTitle: clip(review.title, 120),
			threadId: review.threadId,
			fingerprint: clip(`${review.threadId}:${review.count}`, 120),
			since: review.since,
		});
	});
	const questions = work.questions.filter(outsideEditor).flatMap((question) => {
		const title = clip(question.title, 100);
		const action = openAction(question, copy.question.label, copy);
		return valid({
			key: clip(`ai:ask:${question.runId}`, 120),
			source: "ai",
			kind: "question",
			group: "you",
			order: ORDER.question,
			count: 1,
			title: clip(copy.question.title(question.question), 160),
			detail: clip(copy.question.detail(title), 200),
			fact: { text: copy.waitsForAnswer, tone: "near" },
			...areaOf(question.domain, copy),
			// a question looks like one, whatever the chat is about
			icon: "message-circle-question",
			say: clip(copy.question.say(title, question.question), 400),
			short: clip(copy.question.short(title), 120),
			actions: [action],
			...(action.kind === "link" ? { href: action.value } : {}),
			taskKey: clip(taskKeyOf(question), 120),
			taskTitle: clip(question.title, 120),
			threadId: question.threadId,
			fingerprint: clip(question.runId, 120),
			since: question.since,
		});
	});
	return [...questions, ...reviews];
}
