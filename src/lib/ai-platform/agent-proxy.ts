import "server-only";

import { randomUUID } from "node:crypto";
import { ATTACHMENT_IMAGE_TYPES, type ChangeSet, type ChangeSetResult, ChangeSetSchema } from "@ech/agent-core";
import * as Sentry from "@sentry/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { ChangeSetApplyError } from "./appliers/errors";
import { applyChangeSet, UnsupportedChangeSetError } from "./appliers";
import { requiredConfirmation } from "./appliers/site-confirm";
import { applyUndo } from "./appliers/record-edits";
import { undoVerdict } from "./appliers/site-undo-verdict";
import { isAiAgentEnabled } from "./config";
import { invalidateAfterAgentWrite } from "./invalidate-after-write";
import { AgentAccessError, type AgentActor, resolveAgentActor, signAgentContextToken } from "./context";
import { agentRateLimited } from "./agent-rate-limits";
import { currentRequestId, REQUEST_ID_HEADER, requestIdOf, withRequestId } from "./request-id";
import { listMedia, loadChangeSetAttachment, pickAttachment, uploadAttachment } from "./attachments";
import { validateCsrf } from "./csrf";
import { generatePictures } from "./generated-images";
import { newerOverlapping } from "@/lib/agent-changes/undo-touches";
import { AiPlatformError, aiPlatformJson, callAiPlatform } from "./upstream";
import { isTransientUpstreamError, recordWithRetry } from "./record-with-retry";
import { abandonApply, type ApplyReceipt, beginApply, markApplied, markRecorded, markReinstated, markReverted, readReceipt, STALE_APPLYING_MS } from "./apply-receipts";
import { getWorkList, putWorkState, workStateKey } from "./work/work-routes";

const ID = "[A-Za-z0-9_-]{1,64}";
/** Browser-reachable upstream routes. claim/release stay server-internal. */
const ALLOWED: ReadonlyArray<{ method: string; pattern: RegExp }> = [
	{ method: "GET", pattern: new RegExp(`^(insights|conversations|autonomy|runs|change-sets|threads|usage)$`) },
	{ method: "GET", pattern: new RegExp(`^(runs|change-sets|threads)/${ID}$`) },
	{ method: "POST", pattern: /^runs$/ },
	// clarifying questions: answer (streams like a run) and search the open question's options
	{ method: "POST", pattern: new RegExp(`^runs/${ID}/answers$`) },
	// Stop: the run ends as cancelled
	{ method: "POST", pattern: new RegExp(`^runs/${ID}/cancel$`) },
	{ method: "GET", pattern: new RegExp(`^runs/${ID}/questions/${ID}/options$`) },
	// the uploader's own attachment bytes (thumbnails)
	{ method: "GET", pattern: new RegExp(`^attachments/${ID}/content$`) },
	{ method: "PUT", pattern: new RegExp(`^autonomy/${ID}$`) },
	// chat history — the platform scopes threads to the signed token's user
	{ method: "PATCH", pattern: new RegExp(`^threads/${ID}$`) },
	{ method: "DELETE", pattern: new RegExp(`^threads/${ID}$`) },
];
/** Statuses that must not carry a body (Response() throws otherwise). */
const NULL_BODY = new Set([101, 204, 205, 304]);
const DECISION = new RegExp(`^change-sets/(${ID})/decision$`);
const UNDO = new RegExp(`^change-sets/(${ID})/undo$`);
const RECONCILE = new RegExp(`^change-sets/(${ID})/reconcile$`);
const ATTACHMENT_CONTENT = new RegExp(`^attachments/${ID}/content$`);
const INLINE_TYPES: ReadonlySet<string> = new Set(ATTACHMENT_IMAGE_TYPES);

function problem(status: number, detail: string): NextResponse {
	return NextResponse.json(
		{ title: status >= 500 ? "AI platform error" : "Request failed", status, detail },
		{ status, headers: { "Cache-Control": "private, no-store" } },
	);
}

function toProblem(error: unknown): NextResponse {
	if (error instanceof AgentAccessError || error instanceof AiPlatformError) return problem(error.status, error.message);
	if (error instanceof UnsupportedChangeSetError) return problem(422, error.message);
	if (error instanceof ChangeSetApplyError) return problem(error.status, error.message);
	if (error instanceof ZodError) return problem(422, "The drafted change is not valid for this workspace.");
	// Anything else is internal (a failed SQL query, a stack): the merchant sees a plain message with a
	// reference, the details stay in the server log under that reference.
	const reference = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	console.error(`[ai-agent] proxy failure (ref ${reference})`, error);
	return problem(500, `Something went wrong on our side, so nothing was changed. Try again in a moment (ref ${reference}).`);
}

/** HTTP status an error answers with (toProblem): what decides whether an apply failure is reported. */
function statusOf(error: unknown): number {
	if (error instanceof AgentAccessError || error instanceof AiPlatformError || error instanceof ChangeSetApplyError) return error.status;
	if (error instanceof UnsupportedChangeSetError || error instanceof ZodError) return 422;
	return 500;
}

/**
 * Sentry for what on-call must see (console lines stay as they are): an apply / undo that failed on our side (5xx),
 * a change that ran, was put back and closed (`final`), and a change that is live but not recorded (fatal).
 */
function reportAgentFailure(error: unknown, actor: AgentActor, changeSetId: string, level: "error" | "fatal" = "error"): void {
	try {
		Sentry.captureException(error, {
			level,
			tags: { area: "ai-agent", changeSetId, tenant: actor.tenantId, requestId: currentRequestId() ?? "none" },
		});
	} catch {
		// reporting never changes the answer
	}
}

const requestIdHeader = (): Record<string, string> => {
	const id = currentRequestId();
	return id ? { [REQUEST_ID_HEADER]: id } : {};
};

/** The upstream answer's headers as the browser gets them; a stored file never runs as a page of this origin. */
function passthroughHeaders(upstream: Response, path: string): Record<string, string> {
	const contentType = upstream.headers.get("content-type") ?? "application/json";
	const headers: Record<string, string> = {
		"content-type": contentType,
		"cache-control": "private, no-store, no-transform",
		"x-accel-buffering": "no",
	};
	const nosniff = upstream.headers.get("x-content-type-options");
	if (nosniff) headers["x-content-type-options"] = nosniff;
	if (ATTACHMENT_CONTENT.test(path)) {
		headers["x-content-type-options"] = "nosniff";
		// pictures show inline (chat thumbnails); a document (PDF, CSV, XLSX) is only ever downloaded
		if (!INLINE_TYPES.has(contentType.split(";")[0]?.trim().toLowerCase() ?? "")) headers["content-disposition"] = "attachment";
	}
	return headers;
}

/**
 * /api/agent/* — the browser's only door to the AI platform. Authenticates
 * the session, signs a short-lived context token, streams run responses
 * through unbuffered, and owns the apply step of approvals. Every ai-platform call made for one request carries the
 * same `x-request-id` (the browser's / Vercel's id when there is one).
 */
export async function handleAgentProxy(req: NextRequest, segments: string[]): Promise<Response> {
	return withRequestId(requestIdOf(req), () => handleAgentRequest(req, segments));
}

async function handleAgentRequest(req: NextRequest, segments: string[]): Promise<Response> {
	if (!isAiAgentEnabled()) return problem(404, "The AI assistant is not enabled.");
	const method = req.method.toUpperCase();
	if (method !== "GET" && !validateCsrf(req)) return problem(403, "CSRF verification failed.");
	const path = segments.join("/");

	try {
		const actor = await resolveAgentActor(req);
		const token = await signAgentContextToken(actor);
		const decision = method === "POST" ? path.match(DECISION) : null;
		if (decision?.[1]) return await decide(req, actor, token, decision[1]);
		const undo = method === "POST" ? path.match(UNDO) : null;
		if (undo?.[1]) return await undoChange(actor, token, undo[1]);
		const reconcile = method === "POST" ? path.match(RECONCILE) : null;
		if (reconcile?.[1]) return await reconcileChange(actor, token, reconcile[1]);
		// files and pictures: handled here (BFF reads documents, resolves media, then hands bytes over)
		// an upload stores up to 3 MB and runs the document readers: 30 per user per 10 minutes, picks included
		if (method === "POST" && (path === "attachments" || path === "attachments/pick")) {
			const limited = await agentRateLimited("attachment", actor);
			if (limited) return limited;
			return path === "attachments" ? await uploadAttachment(req, token) : await pickAttachment(req, actor, token);
		}
		if (method === "GET" && path === "media") return await listMedia(req, actor);
		// "Generate": ai-platform draws (limits, ledger), the picture is kept in the shop's media library
		if (method === "POST" && path === "media/generate") return await generatePictures(req, actor, token);
		// the work queue: shop + assistant merged here; Later / Don't remind me go to the platform
		if (method === "GET" && path === "work") return await getWorkList(req, actor, token);
		const workKey = method === "PUT" ? workStateKey(path) : null;
		if (workKey) return await putWorkState(req, token, workKey);
		if (!ALLOWED.some((route) => route.method === method && route.pattern.test(path))) {
			return problem(404, "Unknown agent route.");
		}
		// no timeout here: a run streams for minutes and ends when the browser leaves (req.signal)
		const upstream = await callAiPlatform({
			method,
			path: `/agent/${path}${new URL(req.url).search}`,
			token,
			accept: req.headers.get("accept") ?? "application/json",
			body: method === "GET" || method === "DELETE" ? undefined : await req.text(),
			signal: req.signal,
			requestId: currentRequestId(),
		});
		return new Response(NULL_BODY.has(upstream.status) ? null : upstream.body, {
			status: upstream.status,
			headers: { ...passthroughHeaders(upstream, path), ...requestIdHeader() },
		});
	} catch (error) {
		return toProblem(error);
	}
}

async function decide(req: NextRequest, actor: AgentActor, token: string, id: string): Promise<Response> {
	const body = (await req.json().catch(() => ({}))) as { decision?: unknown; note?: unknown; confirm?: unknown; manual?: unknown };
	const note = typeof body.note === "string" ? body.note.slice(0, 1000) : undefined;
	const decisionPath = `/agent/change-sets/${id}/decision`;
	if (body.decision === "reject") {
		// a change that already ran here (its record lost) can't be rejected: that would close the card with the data changed and no Undo
		const receipt = await readReceipt(id, actor.tenantId);
		if (receipt && receipt.state !== "reverted") return await refuseRejectOfApplied(actor, token, id, receipt, note);
		const rejected = await aiPlatformJson({ method: "POST", path: decisionPath, token, body: JSON.stringify({ decision: "reject", note }) });
		return NextResponse.json(rejected);
	}
	if (body.decision !== "approve") return problem(400, "decision must be approve or reject.");

	// destructive changes: the approver said Yes and the card echoed `confirmText` — checked here, not only in the browser
	const staged = ChangeSetSchema.parse(await aiPlatformJson({ method: "GET", path: `/agent/change-sets/${id}`, token }));
	// money, buyer emails, live codes: only the merchant's own click approves them (Auto-approve never does), checked here too
	if (staged.requiresClick && body.manual !== true) {
		return problem(409, "This change needs your own click: press Approve on the card. If you just updated, reload the page.");
	}
	if (staged.confirmText && !sameText(body.confirm, staged.confirmText)) {
		return problem(400, `Type “${staged.confirmText}” to confirm.`);
	}

	// Claim first so a double click (or a second tab) can't apply twice.
	const claimed = ChangeSetSchema.parse(
		await aiPlatformJson({ method: "POST", path: `/agent/change-sets/${id}/claim`, token }),
	);
	// what goes live at once (publish, theme) or touches most of the site needs the site name typed, decided here
	const mustType = await requiredConfirmation(claimed, actor).catch(async (error: unknown) => {
		await release(token, id);
		throw error;
	});
	if (mustType && !sameText(body.confirm, mustType)) {
		await release(token, id);
		return problem(400, `Type “${mustType}” to confirm.`);
	}
	// prime-web's own receipt (apply-receipts): a change that already ran here is re-sent, never applied twice
	const attempt = currentRequestId() ?? randomUUID();
	const receipt = await beginApply({ changeSetId: id, tenantId: actor.tenantId, userId: actor.user.id ?? null, requestId: attempt }).catch(async (error: unknown) => {
		await release(token, id);
		throw error;
	});
	if (receipt.kind === "busy") {
		await release(token, id);
		return problem(409, receipt.state === "reverted" ? "This change was already undone." : "This change is being applied right now.");
	}
	if (receipt.kind === "applied" && !receipt.receipt.result) {
		// it ran here but its stored result can't be read: never applied a second time, on-call settles the card
		await release(token, id);
		reportAgentFailure(new Error(`change set ${id} is applied in prime-web but its receipt holds no readable result`), actor, id, "fatal");
		return problem(409, "This change was already applied. Its card will update shortly.");
	}
	let result;
	let decisionNote = note;
	if (receipt.kind === "applied" && receipt.receipt.result) {
		// the write went through on an earlier try and only the record was lost: send what it did (and its note)
		result = receipt.receipt.result;
		decisionNote = receipt.receipt.note ?? note;
	} else {
		try {
			result = await applyChangeSet(claimed, actor, (attachmentId) => loadChangeSetAttachment(token, id, attachmentId));
			// the To do card and the sidebar badges count what this just changed: forget their short memory
			invalidateAfterAgentWrite(actor.tenantId);
		} catch (error) {
			invalidateAfterAgentWrite(actor.tenantId);
			// this try took over from one that died part way: a version guard refusal may be that earlier try's own
			// write, so the card is not closed as stale (it stays pending) and the merchant checks the record
			if (receipt.kind === "started" && receipt.takeover && error instanceof ChangeSetApplyError && error.stale) {
				await abandonApply(id, attempt).catch((cause: unknown) => console.error(`[ai-agent] apply receipt ${id} could not be cleared`, cause instanceof Error ? cause.message : cause));
				await release(token, id);
				reportAgentFailure(error, actor, id);
				throw new ChangeSetApplyError(
					"An earlier try of this approval stopped part way and may already have made this change. Open the record to check; if it's there, Reject this card.",
					409,
				);
			}
			// a failure on our side, or a change that already moved something before it was put back (a version guard
			// refusal is the merchant's own edit: closed, not reported)
			if (statusOf(error) >= 500 || (error instanceof ChangeSetApplyError && error.final && !error.stale)) reportAgentFailure(error, actor, id);
			// part of it ran and keeps its undo (shipped orders before a refund failed): the card is closed as applied with
			// what ran and why the rest did not, so its Undo stays; the merchant still reads the failure
			if (error instanceof ChangeSetApplyError && error.final && error.partial) {
				await recordPartial(actor, token, id, attempt, error.partial, error.message.slice(0, 1000));
				throw error;
			}
			await abandonApply(id, attempt).catch((cause: unknown) => console.error(`[ai-agent] apply receipt ${id} could not be cleared`, cause instanceof Error ? cause.message : cause));
			await release(token, id);
			// a change that ran and was put back (or can never apply) is closed, not offered again with stale versions
			if (error instanceof ChangeSetApplyError && error.final) {
				await aiPlatformJson({ method: "POST", path: decisionPath, token, body: JSON.stringify({ decision: "reject", note: error.message.slice(0, 1000) }) }).catch(() => undefined);
			}
			throw error;
		}
		// kept before ai-platform is told: a lost record is re-sent from here (retry, cron), not applied again
		await markApplied(id, attempt, result, note).catch((error: unknown) => {
			console.error(`[ai-agent] change set ${id} is applied but its receipt was not written (tenant ${actor.tenantId})`, error instanceof Error ? error.message : error);
			reportAgentFailure(error, actor, id);
		});
	}
	const recorded = await recordWrite(actor, token, id, "applied", () =>
		aiPlatformJson({ method: "POST", path: decisionPath, token, body: JSON.stringify({ decision: "approve", note: decisionNote, result }) }),
	);
	if (recorded) {
		await markRecorded(id, "applied").catch(() => undefined);
		return NextResponse.json(recorded);
	}
	// the change is live: answer as applied (a 502 would invite a second apply). Extra keys are ignored by the client.
	return NextResponse.json({
		...claimed,
		status: "applied",
		decidedBy: actor.user.email || undefined,
		decidedAt: new Date().toISOString(),
		note: decisionNote,
		result,
		recordPending: true,
		detail: "Applied — the card will update shortly.",
	});
}

/**
 * Record on the platform what prime-web already wrote (approve → applied, undo → reverted). Transient failures are
 * retried (300 ms, 1 s, 3 s); when they persist it is logged and null comes back, so the caller can still answer 200.
 * A 4xx is the platform's real answer and is thrown as before.
 */
async function recordWrite(
	actor: AgentActor,
	token: string,
	id: string,
	expected: "applied" | "reverted",
	record: () => Promise<unknown>,
): Promise<unknown> {
	const landed = async () => {
		const stored = ChangeSetSchema.parse(await aiPlatformJson({ method: "GET", path: `/agent/change-sets/${id}`, token }));
		return stored.status === expected ? stored : null;
	};
	try {
		return await recordWithRetry(record, landed);
	} catch (error) {
		if (!isTransientUpstreamError(error)) throw error;
		console.error(
			`[ai-agent] change set ${id} is ${expected} in prime-web but the AI platform did not record it (tenant ${actor.tenantId})`,
			error instanceof Error ? error.message : error,
		);
		// the shop changed and the card does not know it: someone has to reconcile this one
		reportAgentFailure(error, actor, id, "fatal");
		return null;
	}
}

/**
 * Reject of a change that has a receipt here (applying or applied): refused, nothing forwarded. An applied one with
 * its result is recorded as approved on the way (the card gets its Undo), like a retried Approve would.
 */
async function refuseRejectOfApplied(actor: AgentActor, token: string, id: string, receipt: ApplyReceipt, note: string | undefined): Promise<Response> {
	if (receipt.state === "applying") {
		const age = Date.now() - Date.parse(receipt.updatedAt);
		// an unreadable time counts as fresh: "Approve again" is only said when the earlier try surely died
		return age >= STALE_APPLYING_MS
			? problem(409, "An earlier approve stopped part way — Approve again to finish it.")
			: problem(409, "This change is being applied right now.");
	}
	const result = receipt.result;
	if (result) {
		const recorded = await recordWrite(actor, token, id, "applied", () =>
			aiPlatformJson({ method: "POST", path: `/agent/change-sets/${id}/decision`, token, body: JSON.stringify({ decision: "approve", note: receipt.note ?? note, result }) }),
		).catch(() => null);
		if (recorded) await markRecorded(id, "applied").catch(() => undefined);
	}
	return problem(409, "This change was already applied — use Undo to take it back.");
}

/** A `final` failure after steps that keep their undo: kept and recorded as applied with the failure as its note. */
async function recordPartial(actor: AgentActor, token: string, id: string, attempt: string, partial: ChangeSetResult, note: string): Promise<void> {
	await markApplied(id, attempt, partial, note).catch((error: unknown) => {
		console.error(`[ai-agent] change set ${id} partly applied but its receipt was not written (tenant ${actor.tenantId})`, error instanceof Error ? error.message : error);
	});
	const recorded = await recordWrite(actor, token, id, "applied", () =>
		aiPlatformJson({ method: "POST", path: `/agent/change-sets/${id}/decision`, token, body: JSON.stringify({ decision: "approve", note, result: partial }) }),
	).catch((error: unknown) => {
		console.error(`[ai-agent] change set ${id} partly applied, the AI platform refused the record`, error instanceof Error ? error.message : error);
		return null;
	});
	if (recorded) await markRecorded(id, "applied").catch(() => undefined);
}

/** Gives the ai-platform claim back (best effort: a lost release only delays the next Approve by the claim hold). */
async function release(token: string, id: string): Promise<void> {
	await aiPlatformJson({ method: "POST", path: `/agent/change-sets/${id}/release`, token }).catch(() => undefined);
}

function sameText(typed: unknown, expected: string): boolean {
	const norm = (value: string) => value.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
	return typeof typed === "string" && norm(typed) === norm(expected);
}

/**
 * Undo an applied change from the pre-image it saved. The record must be
 * exactly as the change left it (version guard) — a later edit is never
 * overwritten. The platform then marks the change set reverted.
 */
async function undoChange(actor: AgentActor, token: string, id: string): Promise<Response> {
	const changeSet = ChangeSetSchema.parse(await aiPlatformJson({ method: "GET", path: `/agent/change-sets/${id}`, token }));
	// already undone (a second click, another tab, the editor's own Undo): the same answer as the first time
	if (changeSet.status === "reverted") return NextResponse.json(changeSet);
	// only who asked, or an owner / admin, undoes it (the platform says so per caller): refused before anything is written
	if (changeSet.access?.canDecide === false) {
		return problem(403, changeSet.access.reason === "needs_owner_or_admin" ? "An owner or admin needs to undo this." : "Only the person who asked, or an owner or admin, can undo this.");
	}
	const undo = changeSet.result?.undo;
	if (changeSet.status !== "applied" || !undo) return problem(409, "This change can't be undone.");
	// the undo already ran here and only its record was lost: re-send it, never put things back twice
	const receipt = await readReceipt(id, actor.tenantId);
	let result;
	if (receipt?.state === "reverted" && receipt.result) {
		result = receipt.result;
	} else {
		try {
			result = await applyUndo(undo, actor, id);
		} catch (error) {
			if (statusOf(error) >= 500) reportAgentFailure(error, actor, id);
			// refused because the parts moved on: when a newer change of the assistant did it, say which one goes first
			if (error instanceof ChangeSetApplyError && error.status === 409) {
				// another tab's Undo put it back first: the same answer as that tab got
				const undone = await revertedNow(token, id);
				if (undone) return NextResponse.json(undone);
				const newer = await newerChangeFor(changeSet, token).catch(() => null);
				if (newer) throw new ChangeSetApplyError(`Undo “${newer.title}” first — it changed the same part after this one.`, 409);
			}
			throw error;
		}
		invalidateAfterAgentWrite(actor.tenantId);
		await markReverted({ changeSetId: id, tenantId: actor.tenantId, userId: actor.user.id ?? null, requestId: currentRequestId() ?? randomUUID(), result }).catch((error: unknown) => {
			console.error(`[ai-agent] change set ${id} is undone but its receipt was not written (tenant ${actor.tenantId})`, error instanceof Error ? error.message : error);
			reportAgentFailure(error, actor, id);
		});
	}
	let recorded: unknown;
	try {
		recorded = await recordWrite(actor, token, id, "reverted", () =>
			aiPlatformJson({ method: "POST", path: `/agent/change-sets/${id}/revert`, token, body: JSON.stringify({ result }) }),
		);
	} catch (error) {
		// another tab's Undo was recorded first: it is undone, answer as such
		if (!(error instanceof AiPlatformError) || error.status !== 409) throw error;
		const undone = await revertedNow(token, id);
		if (!undone) throw error;
		await markRecorded(id, "reverted").catch(() => undefined);
		return NextResponse.json(undone);
	}
	if (recorded) {
		await markRecorded(id, "reverted").catch(() => undefined);
		return NextResponse.json(recorded);
	}
	return NextResponse.json({
		...changeSet,
		status: "reverted",
		result: { ...changeSet.result, undo: undefined },
		recordPending: true,
		detail: "Undone — the card will update shortly.",
	});
}

/**
 * The site editor moved an assistant change back or forth with its own Undo / Redo (or just opened): compare the page
 * draft with what the change left and settle the card — applied ⇄ reverted. Writes nothing to the site; the change
 * keeps its undo data when the editor took it back, so Redo can put it back as applied.
 */
async function reconcileChange(actor: AgentActor, token: string, id: string): Promise<Response> {
	const read = async () => ChangeSetSchema.parse(await aiPlatformJson({ method: "GET", path: `/agent/change-sets/${id}`, token }));
	const changeSet = await read();
	const undo = changeSet.result?.undo;
	const comparable = (changeSet.status === "applied" || changeSet.status === "reverted") && undo && changeSet.action?.kind.startsWith("site.");
	if (!comparable || !undo) return NextResponse.json({ changeSet, verdict: "unknown" });
	const verdict = await undoVerdict(undo, actor);
	// not this caller's to settle (a viewer, a teammate's change): the verdict only, the card stays as stored
	if (changeSet.access?.canDecide === false) return NextResponse.json({ changeSet, verdict });
	let settled = changeSet;
	try {
		if (changeSet.status === "applied" && verdict === "reverted") {
			settled = ChangeSetSchema.parse(await aiPlatformJson({ method: "POST", path: `/agent/change-sets/${id}/revert`, token, body: JSON.stringify({ keepUndo: true }) }));
		} else if (changeSet.status === "reverted" && verdict === "applied") {
			settled = ChangeSetSchema.parse(await aiPlatformJson({ method: "POST", path: `/agent/change-sets/${id}/reinstate`, token, body: "{}" }));
			// applied again: a receipt of an earlier card Undo must not answer the next Undo with "already undone"
			await markReinstated(id).catch((error: unknown) => console.error(`[ai-agent] apply receipt ${id} could not follow the reinstate`, error instanceof Error ? error.message : error));
		}
	} catch (error) {
		// another tab / call settled it first: answer with what is stored now
		if (!(error instanceof AiPlatformError) || error.status !== 409) throw error;
		settled = await read();
	}
	return NextResponse.json({ changeSet: settled, verdict });
}

/** The change set as stored now, when it is already undone (another tab / call got there first); else null. */
async function revertedNow(token: string, id: string): Promise<ChangeSet | null> {
	const current = await aiPlatformJson({ method: "GET", path: `/agent/change-sets/${id}`, token })
		.then((raw) => ChangeSetSchema.parse(raw))
		.catch(() => null);
	return current?.status === "reverted" ? current : null;
}

/** The newest applied change that touched the same parts after this one (it has to be undone first). */
async function newerChangeFor(changeSet: ChangeSet, token: string): Promise<{ id: string; title: string } | null> {
	const raw = await aiPlatformJson({ method: "GET", path: "/agent/change-sets?status=applied&limit=100", token });
	const others = ChangeSetSchema.array().parse(raw);
	return newerOverlapping(changeSet, others);
}
