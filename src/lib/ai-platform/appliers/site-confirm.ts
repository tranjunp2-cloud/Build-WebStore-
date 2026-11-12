import "server-only";

import type { ChangeSet } from "@ech/agent-core";
import type { AgentActor } from "../context";
import { SiteToolError, siteForActor } from "../site/site-read";
import { ChangeSetApplyError } from "./errors";

/** above this many pages a site edit needs the typed site name (as drafted in `prepareSitePatch`) */
const TYPED_CONFIRM_PAGES = 3;

/**
 * The text the approver must type for this change, decided here from the change itself and the site as
 * prime-web reads it — never only from what the AI platform says. Null = no typed confirmation needed.
 * Publishing and theme edits go live at once; large multi-page edits touch the whole site.
 */
export async function requiredConfirmation(changeSet: ChangeSet, actor: AgentActor): Promise<string | null> {
	const kind = changeSet.action?.kind;
	const payload = (changeSet.action?.payload ?? {}) as { siteId?: unknown; pages?: unknown };
	const needs =
		kind === "site.publish" ||
		kind === "site.theme_patch" ||
		(kind === "site.pages_patch" && Array.isArray(payload.pages) && payload.pages.length > TYPED_CONFIRM_PAGES);
	if (!needs) return null;
	const { site } = await siteForActor(actor, String(payload.siteId ?? "")).catch((error: unknown) => {
		if (error instanceof SiteToolError) throw new ChangeSetApplyError(error.message, error.status === 404 ? 409 : 403);
		throw error;
	});
	// the same text the card asks for (prepare uses the trimmed name, "site" when blank)
	return (site.name?.trim() || "site").slice(0, 200);
}
