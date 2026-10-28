import type { AgentChatTurn, AgentRun, AgentThreadDetail, ChangeSet } from "@ech/agent-core";

export type { AgentChatTurn, ComposerAttachment } from "@ech/agent-core";

export type TurnRecord = { run: AgentRun | undefined; changeSets: ChangeSet[] };

/** Still working (or waiting for a free AI slot): the chat follows it and the composer offers Stop. */
export const ACTIVE_RUN: ReadonlySet<string> = new Set(["queued", "planning", "running", "applying"]);

/**
 * Rebuilds the transcript of a stored thread: each run becomes the user's
 * prompt + the assistant's reply, with change sets in their CURRENT state
 * (an approval made after the run shows as applied, not pending).
 */
export function turnsFromThread(detail: AgentThreadDetail): {
	turns: AgentChatTurn[];
	records: Map<string, TurnRecord>;
} {
	const turns: AgentChatTurn[] = [];
	const records = new Map<string, TurnRecord>();
	for (const run of detail.runs) {
		const changeSets = detail.changeSets.filter((cs) => cs.runId === run.id || run.changeSetIds.includes(cs.id));
		records.set(run.id, { run, changeSets });
		turns.push({
			id: `user_${run.id}`,
			role: "user",
			text: run.prompt,
			attachments: run.attachments,
			...(run.pictures?.length ? { pictures: run.pictures } : {}),
			...(run.context?.elements?.length ? { elements: run.context.elements } : {}),
		});
		turns.push({ id: run.id, role: "assistant", run, changeSets });
	}
	return { turns, records };
}

/**
 * Where the open chat is remembered between page loads. `null` = no memory
 * (follow the server's latest thread), `""` = the user started a new chat,
 * otherwise a thread id. Only a hint: it is always validated with the server,
 * so an id left behind by another account just falls back to that user's own.
 */
export interface ThreadHintStore {
	get(): string | null;
	set(value: string | null): void;
}

const HINT_KEY = "ech-agent:thread";

/** Per-tab hint (sessionStorage) — a reload keeps the open chat, a new tab follows the latest. */
export function sessionThreadHint(key: string = HINT_KEY): ThreadHintStore {
	const storage = (): Storage | null => {
		try {
			return typeof window === "undefined" ? null : window.sessionStorage;
		} catch {
			return null; // storage disabled (privacy mode, sandboxed frame)
		}
	};
	return {
		get: () => {
			try {
				return storage()?.getItem(key) ?? null;
			} catch {
				return null;
			}
		},
		set: (value) => {
			try {
				if (value === null) storage()?.removeItem(key);
				else storage()?.setItem(key, value);
			} catch {
				// quota / disabled — the server's latest thread still restores
			}
		},
	};
}

export function memoryThreadHint(initial: string | null = null): ThreadHintStore {
	let value = initial;
	return {
		get: () => value,
		set: (next) => {
			value = next;
		},
	};
}
