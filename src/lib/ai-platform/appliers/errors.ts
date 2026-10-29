import type { ChangeSetResult } from "@ech/agent-core";

/** The domain refused the approved change (plan gate, permissions, validation). */
export class ChangeSetApplyError extends Error {
	/** the record moved on (or is gone) since the draft: routine, the card closes with the reason (not reported) */
	readonly stale: boolean;
	/** what ran before a `final` failure and keeps its undo: the BFF records the card as applied with it */
	readonly partial?: ChangeSetResult;

	constructor(
		message: string,
		readonly status: 403 | 409 | 422 = 422,
		/** the change ran, was put back (or can never apply), and must not be approved again: the BFF closes it */
		readonly final = false,
		options: { stale?: boolean; partial?: ChangeSetResult } = {},
	) {
		super(message);
		this.name = "ChangeSetApplyError";
		this.stale = options.stale ?? false;
		if (options.partial) this.partial = options.partial;
	}
}

/**
 * A version guard refused: the record changed since the assistant drafted the change, or it is gone. Approving
 * again can never succeed, so the change is closed (rejected with this reason) instead of waiting 24 h as pending.
 */
export const staleChange = (message: string): ChangeSetApplyError => new ChangeSetApplyError(message, 409, true, { stale: true });

/** One put-back step that failed, named for the merchant ("SUMMER10", "the category Shoes"). */
export class PutBackError extends Error {
	constructor(
		readonly what: string,
		readonly reason: unknown,
	) {
		super(`${what}: ${reason instanceof Error ? reason.message : String(reason)}`);
		this.name = "PutBackError";
	}
}

/** Runs one put-back step; a failure carries what it was about. */
export async function putBack<T>(what: string, write: () => Promise<T>): Promise<T> {
	try {
		return await write();
	} catch (error) {
		throw new PutBackError(what, error);
	}
}

/**
 * A change failed half way and putting back what already ran failed too: the shop is left half changed. Closed
 * (`final`, never offered again) with what was done and what is still in place, and logged for on-call.
 */
export function putBackFailed(area: string, failure: unknown, done: readonly string[], putBackError: unknown): ChangeSetApplyError {
	const reason = failure instanceof Error ? failure.message : "The change was refused.";
	const what = putBackError instanceof PutBackError ? putBackError.what : "an earlier step";
	console.error(
		`[agent-apply] ${area}: a failed change could not be put back`,
		putBackError instanceof PutBackError ? putBackError.message : putBackError instanceof Error ? putBackError.message : putBackError,
	);
	const doneText = done.length > 0 ? done.join("; ") : "nothing";
	return new ChangeSetApplyError(`${reason} Done: ${doneText}, could not put back: ${what}. Check it on the ${area} page.`, 422, true);
}

/** Reads an attachment a change set uses (the bytes live in ai-platform). */
export type AttachmentLoader = (attachmentId: string) => Promise<{ buffer: Buffer; mime: string; name: string }>;
