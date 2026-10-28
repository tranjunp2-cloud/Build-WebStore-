import { z } from "zod";

/**
 * The merchant's work queue: everything that needs them now, one list and one
 * number for the mascot, the dock and the dashboard's To do card. Items come
 * from the shop (orders, stock, discounts, website — computed by the host app)
 * and from the assistant (drafts waiting for approval, questions waiting for an
 * answer — from the AI platform). Nothing here calls a model: counts, order and
 * wording are plain data.
 */

/** Which group an item sits in, in this order: do it now, the assistant waits on you, this week. */
export const WorkGroupSchema = z.enum(["now", "you", "week"]);
export type WorkGroup = z.infer<typeof WorkGroupSchema>;

export const WORK_GROUP_ORDER: readonly WorkGroup[] = ["now", "you", "week"];

/** What pressing an item's button does: send a prompt in the item's task chat, go to a page, or open the item's existing chat. */
export const WorkActionSchema = z.object({
	label: z.string().min(1).max(40),
	kind: z.enum(["prompt", "link", "open_thread"]),
	/** prompt text, a same-site path, or a thread id */
	value: z.string().min(1).max(600),
});
export type WorkAction = z.infer<typeof WorkActionSchema>;

export const WorkItemSchema = z.object({
	/** stable across refreshes: "shop:<kind>" or "ai:review:<threadId>" / "ai:ask:<runId>" */
	key: z.string().min(1).max(120),
	source: z.enum(["shop", "ai"]),
	kind: z.string().min(1).max(60),
	group: WorkGroupSchema,
	/** tie-break inside a group: lower first */
	order: z.number().int(),
	count: z.number().int().nonnegative(),
	/** "1 payment slip to check" */
	title: z.string().min(1).max(160),
	/** plain facts: "Order #1042 · RM 86.00" */
	detail: z.string().max(200).optional(),
	/** the one fact that makes it urgent, coloured: late (past its time / losing sales) or near (due soon) */
	fact: z.object({ text: z.string().min(1).max(80), tone: z.enum(["late", "near"]) }).optional(),
	/** where it belongs ("Orders") and its icon (lucide name) */
	area: z.string().min(1).max(40),
	icon: z.string().min(1).max(40),
	/** what the assistant says when it raises the item: facts + one question */
	say: z.string().min(1).max(400),
	/** one short line for the "Next" strip */
	short: z.string().min(1).max(120),
	/** first = the main button */
	actions: z.array(WorkActionSchema).min(1).max(3),
	/** the page that shows it */
	href: z.string().max(300).optional(),
	/** the chat this item is handled in: the task's title, and the thread when it exists */
	taskKey: z.string().min(1).max(120),
	taskTitle: z.string().min(1).max(120),
	threadId: z.string().min(1).max(64).optional(),
	/** changes when the set behind the item changes (a new order): a dismissed item comes back */
	fingerprint: z.string().min(1).max(120),
	/** age anchor (oldest order, when the draft was staged) */
	since: z.string().optional(),
});
export type WorkItem = z.infer<typeof WorkItemSchema>;

/** What the merchant chose about an item (per user). */
export const WorkStateSchema = z.object({
	key: z.string().min(1).max(120),
	/** "Later": not raised again before this time (still counted) */
	snoozedUntil: z.string().optional(),
	/** "Don't remind me": hidden until the item's fingerprint changes */
	dismissedFingerprint: z.string().max(120).optional(),
	lastRaisedAt: z.string().optional(),
	updatedAt: z.string().min(1),
});
export type WorkState = z.infer<typeof WorkStateSchema>;

export const WorkStateInputSchema = z.object({
	snoozedUntil: z.string().nullable().optional(),
	dismissedFingerprint: z.string().max(120).nullable().optional(),
	lastRaisedAt: z.string().optional(),
});
export type WorkStateInput = z.infer<typeof WorkStateInputSchema>;

/** The whole queue as the browser gets it: ranked, dismissed items removed, states attached. */
export const WorkListSchema = z.object({
	items: z.array(WorkItemSchema),
	states: z.array(WorkStateSchema),
	checkedAt: z.string().min(1),
	/** a source could not be read: the list may be short */
	partial: z.boolean().optional(),
});
export type WorkList = z.infer<typeof WorkListSchema>;

/** A chat's state as a job: waits on the merchant, the assistant is working, finished, or it failed. */
export const ThreadStatusSchema = z.enum(["needs_you", "working", "done", "failed"]);
export type ThreadStatus = z.infer<typeof ThreadStatusSchema>;

/**
 * What the AI platform knows about the user's work (raw facts, no wording —
 * the host words them in the merchant's language).
 */
export const AiWorkSchema = z.object({
	/** chats with unexpired drafts waiting for approval */
	reviews: z.array(
		z.object({
			threadId: z.string().min(1),
			title: z.string().min(1).max(120),
			count: z.number().int().positive(),
			/** when the oldest waiting draft was staged */
			since: z.string().min(1),
			domain: z.string().max(40).optional(),
			module: z.string().max(40).optional(),
			taskKey: z.string().max(120).optional(),
			/** a waiting draft needs a hand approval (confirm or requiresClick) */
			handOnly: z.boolean().optional(),
			/** the oldest waiting draft: what approving does ("Reply to Farid Hassan", store.customers_patch) */
			change: z.object({ title: z.string().min(1).max(200), actionKind: z.string().min(1).max(60) }).optional(),
		}),
	),
	/** runs paused on a question for the merchant */
	questions: z.array(
		z.object({
			threadId: z.string().min(1),
			runId: z.string().min(1),
			title: z.string().min(1).max(120),
			question: z.string().min(1).max(300),
			since: z.string().min(1),
			domain: z.string().max(40).optional(),
			module: z.string().max(40).optional(),
			taskKey: z.string().max(120).optional(),
		}),
	),
	/** chats tied to a task (last 90 days), newest first */
	tasks: z.array(z.object({ taskKey: z.string().min(1).max(120), threadId: z.string().min(1), status: ThreadStatusSchema, updatedAt: z.string().min(1) })),
	states: z.array(WorkStateSchema),
});
export type AiWork = z.infer<typeof AiWorkSchema>;

const groupRank = (group: WorkGroup) => WORK_GROUP_ORDER.indexOf(group);

/**
 * One ranked list from the shop's items and the assistant's items:
 * - an assistant item about a task (its chat has a taskKey) replaces the shop item of that task;
 * - a shop item with a chat already gets its threadId (never a second chat);
 * - dismissed items stay hidden until their fingerprint changes.
 */
export function mergeWork(shop: readonly WorkItem[], ai: readonly WorkItem[], tasks: AiWork["tasks"], states: readonly WorkState[]): WorkItem[] {
	const aiTasks = new Set(ai.map((item) => item.taskKey));
	const threadOf = new Map<string, string>();
	// newest first: the first chat seen for a task wins
	for (const task of tasks) if (!threadOf.has(task.taskKey)) threadOf.set(task.taskKey, task.threadId);
	const stateOf = new Map(states.map((state) => [state.key, state]));
	const merged = [
		...shop.filter((item) => !aiTasks.has(item.taskKey)).map((item) => {
			const threadId = item.threadId ?? threadOf.get(item.taskKey);
			return threadId ? { ...item, threadId } : item;
		}),
		...ai,
	].filter((item) => {
		const dismissed = stateOf.get(item.key)?.dismissedFingerprint;
		return !dismissed || dismissed !== item.fingerprint;
	});
	return merged.sort(
		(a, b) => groupRank(a.group) - groupRank(b.group) || a.order - b.order || (a.since ?? "").localeCompare(b.since ?? "") || a.key.localeCompare(b.key),
	);
}

export interface RaisePolicy {
	/** an item raised less than this long ago is not raised again */
	repeatAfterMs: number;
	/** at most this many unprompted raises per rolling hour */
	perHour: number;
	/** local hours [from, to) with no unprompted raise, except a "now" item that is late */
	quietHours: [number, number];
}

export const DEFAULT_RAISE_POLICY: RaisePolicy = { repeatAfterMs: 20 * 60_000, perHour: 3, quietHours: [22, 8] };

const inQuietHours = (hour: number, [from, to]: [number, number]) => (from > to ? hour >= from || hour < to : hour >= from && hour < to);

/**
 * The item the assistant should raise now (unprompted), or none: the first open
 * item that is not snoozed and was not raised recently, within the hourly cap
 * and outside quiet hours (a late "now" item may break quiet hours).
 */
export function nextToRaise(
	items: readonly WorkItem[],
	states: readonly WorkState[],
	raisedAt: readonly number[],
	now: Date,
	policy: RaisePolicy = DEFAULT_RAISE_POLICY,
): WorkItem | undefined {
	const at = now.getTime();
	if (raisedAt.filter((time) => at - time < 3_600_000).length >= policy.perHour) return undefined;
	const quiet = inQuietHours(now.getHours(), policy.quietHours);
	const stateOf = new Map(states.map((state) => [state.key, state]));
	return items.find((item) => {
		const state = stateOf.get(item.key);
		if (state?.snoozedUntil && Date.parse(state.snoozedUntil) > at) return false;
		if (state?.lastRaisedAt && at - Date.parse(state.lastRaisedAt) < policy.repeatAfterMs) return false;
		if (quiet && !(item.group === "now" && item.fact?.tone === "late")) return false;
		return true;
	});
}

/** "Later": urgent items come back sooner. */
export const snoozeFor = (item: Pick<WorkItem, "group">): number => (item.group === "now" ? 60 : 180) * 60_000;
