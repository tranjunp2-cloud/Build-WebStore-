import type { ChangeSet, ChangeSetGroup } from "@ech/agent-core";

/**
 * One promo campaign per `start_campaign` call: every card staged after it in the same run
 * (discount code, homepage banner, announcement post) carries the same `group`, so the chat can tag
 * them and offer "Approve all". Kept in the run state, because the tools are rebuilt after a pause.
 */
export interface CampaignState {
	/** how many campaigns this run started (the group id is unique per run) */
	seq: number;
	id: string;
	label: string;
	/** cards stamped so far */
	steps: number;
}

export interface CampaignRun {
	/** starts a campaign (a second call in the same run starts a new group) */
	begin: (label: string) => ChangeSetGroup;
	/** the change set with its group when it belongs in the campaign; otherwise unchanged */
	stamp: (changeSet: ChangeSet) => ChangeSet;
}

/**
 * What a campaign may hold. The site-wide or live-at-once changes (theme, languages, publish) and
 * anything destructive stay single cards the merchant decides on their own.
 */
export const CAMPAIGN_ACTION_KINDS: ReadonlySet<string> = new Set([
	"store.discounts_patch",
	"site.page_patch",
	"site.pages_patch",
	"site.page_create",
	"site.seo_patch",
	"site.translate_page",
	"site.nav_patch",
	"blog.create_draft",
]);

export function createCampaignRun(runId: string, holder: { campaign?: CampaignState }): CampaignRun {
	return {
		begin(label) {
			const seq = (holder.campaign?.seq ?? 0) + 1;
			const clean = label.replace(/\s+/g, " ").trim().slice(0, 60);
			holder.campaign = { seq, id: `cmp_${runId}_${seq}`.slice(0, 120), label: clean, steps: 0 };
			return { id: holder.campaign.id, label: holder.campaign.label };
		},
		stamp(changeSet) {
			const campaign = holder.campaign;
			if (!campaign || changeSet.group) return changeSet;
			if (changeSet.confirmText || !CAMPAIGN_ACTION_KINDS.has(changeSet.action?.kind ?? "")) return changeSet;
			campaign.steps += 1;
			return { ...changeSet, group: { id: campaign.id, label: campaign.label, step: campaign.steps } };
		},
	};
}
