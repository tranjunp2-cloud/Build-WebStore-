import type { ChangeSet } from "@ech/agent-core";
import { HttpGateway, type HttpGatewayOptions } from "@ech/agent-transport";
import { announceAgentChange } from "./bus";
import { changeFromChangeSet } from "./derive";

/**
 * The gateway every assistant surface uses (dashboard dock, blog writer, site editor). Approving, Approve all,
 * Auto-approve and Undo all end in these two calls, so announcing here covers every path with one helper.
 */
export class AnnouncingGateway extends HttpGateway {
	private announce(changeSet: ChangeSet): void {
		const change = changeFromChangeSet(changeSet);
		if (change) announceAgentChange(change);
	}

	override async decideChangeSet(...args: Parameters<HttpGateway["decideChangeSet"]>): Promise<ChangeSet> {
		const decided = await super.decideChangeSet(...args);
		this.announce(decided);
		return decided;
	}

	override async undoChangeSet(id: string): Promise<ChangeSet> {
		const reverted = await super.undoChangeSet(id);
		this.announce(reverted);
		return reverted;
	}
}

export const createAgentGateway = (options: Partial<HttpGatewayOptions> = {}): HttpGateway =>
	new AnnouncingGateway({ baseUrl: "/api", ...options });
