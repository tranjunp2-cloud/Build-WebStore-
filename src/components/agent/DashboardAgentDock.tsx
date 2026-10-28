"use client";

import "@ech/agent-ui/styles.css";
import type { ChangeSet, WorkItem } from "@ech/agent-core";
import { AgentProvider, useChangeSets, useDecideChangeSet, useUndoChangeSet, useWork } from "@ech/agent-react";
import { type AgentSessionIntent, enterSession, outsideWebBuilderChats, useAgentChatRuntime } from "@ech/agent-react/chat";
import { AgentAssistantPanel, type Box, type ComposerHandle, summonMascot } from "@ech/agent-ui";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n";
import { createAgentGateway } from "@/lib/agent-changes/agent-gateway";
import { entityForPath, moduleForPath } from "@/lib/ai-platform/shop-surface";
import { dashboardPageLocation } from "./agent-page-location";
import { agentPanelLabels, entityLabel, pageLabel } from "./agent-panel-labels";
import { dockShownOn } from "./agent-dock-routes";
import { AGENT_OPEN_EVENT, dockStoppedListening, takeHeldAgentOpens } from "./agent-open-queue";
import { agentStarters } from "./agent-starters";
import { useAskParam } from "./use-ask-param";

/**
 * Prime Web's assistant (the dashboard mascot). The gateway talks to /api/agent (BFF → apps/ai-platform). Approving a draft
 * applies it server-side with the signed-in user's permissions.
 */
function DockSurface() {
	const pathname = usePathname() ?? "/";
	const router = useRouter();
	const { locale } = useI18n();
	// the page's module and open record: /products and /products/:id are the shop's own products (shop-surface)
	const pageModule = moduleForPath(pathname);
	// the record open on the page (a post, a product) — the copilot can read "this". The page and
	// record always ride along unseen: no chip to remove (it read as a filter nobody understood)
	const entity = useMemo(() => entityForPath(pathname), [pathname]);
	const pin = useMemo(() => ({ module: pageModule, ...(entity ? { entity } : {}) }), [pageModule, entity]);
	// where the merchant is ("which page am I on")
	const page = useMemo(() => dashboardPageLocation(pathname, pageModule), [pathname, pageModule]);
	// The open chat follows the user across pages; reload restores it. A fresh tab starts on the
	// work desk (the next to-do item), not on the newest chat.
	// the site editor keeps its own chats: never listed or continued here
	const chat = useAgentChatRuntime({ context: pin, page, scope: outsideWebBuilderChats, restoreLatest: false });
	const pending = useChangeSets({ status: "pending" });
	// the merchant's work queue: one number on the mascot, the dock's home is the next item
	const workQueue = useWork();
	const work = useMemo(
		() =>
			workQueue.data || workQueue.loading || workQueue.error
				? {
						items: workQueue.data?.items ?? [],
						states: workQueue.data?.states ?? [],
						loading: workQueue.loading,
						error: Boolean(workQueue.error),
						partial: workQueue.data?.partial,
						onRetry: () => void workQueue.refresh(),
						onChanged: () => void workQueue.refresh(),
						onDiscard: (item: WorkItem) => void workQueue.discard(item).catch(() => undefined),
						onRestore: (item: WorkItem) => void workQueue.restore(item).catch(() => undefined),
						onLater: (item: WorkItem, until: string) => void workQueue.setState(item.key, { snoozedUntil: until }).catch(() => undefined),
						onRaised: (item: WorkItem, at: string) => void workQueue.setState(item.key, { lastRaisedAt: at }).catch(() => undefined),
					}
				: undefined,
		[workQueue],
	);
	const decideChangeSet = useDecideChangeSet();
	const [open, setOpen] = useState(false);
	const composer = useRef<ComposerHandle | null>(null);
	// a message waiting to be put in the box (reminder links)
	const [prefill, setPrefill] = useState<string | null>(null);

	const undoChangeSet = useUndoChangeSet();
	// the gateway tells the open screens what changed (lib/agent-changes); nothing to refresh here
	const decide = useCallback(
		async (changeSet: ChangeSet, decision: "approve" | "reject", options?: { confirm?: string }) => {
			const decided = await decideChangeSet(changeSet.id, decision, "self", undefined, options);
			pending.refresh();
			return decided;
		},
		[decideChangeSet, pending],
	);
	const undo = useCallback(
		async (changeSet: ChangeSet) => (undoChangeSet ? undoChangeSet(changeSet.id) : changeSet),
		[undoChangeSet],
	);

	// other surfaces (e.g. "Generate with AI") open the panel, optionally with a prompt
	useEffect(() => {
		const onOpen = (e: Event) => {
			const detail = (e as CustomEvent<{ prompt?: string; send?: boolean; from?: Box; session?: AgentSessionIntent }>).detail;
			// the right chat first (a new task, this page's chat, the task under review), then the prompt. In-app buttons
			// (the To do card) send it; `send: false` (reminder links) only fills the box — the merchant presses Send.
			const deliver = async () => {
				await enterSession(chat.history, detail?.session, Boolean(detail?.prompt));
				setOpen(true);
				if (!detail?.prompt) return;
				if (detail.send === false) setPrefill(detail.prompt);
				else void chat.send(detail.prompt);
			};
			// asked from a field on the page: the mascot flies there and brings the request back
			if (!detail?.from) return void deliver();
			void summonMascot(detail.from, {
				onPickup: () => window.dispatchEvent(new CustomEvent("ech-agent:picked")),
				onReturn: () => void deliver(),
			});
		};
		window.addEventListener(AGENT_OPEN_EVENT, onOpen);
		// requests made while this code was still loading (the mascot placeholder, an ask bar): in order, once
		for (const detail of takeHeldAgentOpens()) onOpen(new CustomEvent(AGENT_OPEN_EVENT, { detail }));
		return () => {
			window.removeEventListener(AGENT_OPEN_EVENT, onOpen);
			dockStoppedListening();
		};
	}, [chat.send, chat.history]);

	// a reminder link (`/discounts?todo=<kind>`, from a notification or the digest email) opens the dock with the task's
	// message in the box. It is never sent from a link: a run starts only when the merchant presses Send.
	useAskParam(locale === "ms" ? "ms" : "en", (prompt) =>
		window.dispatchEvent(new CustomEvent(AGENT_OPEN_EVENT, { detail: { prompt, send: false } })),
	);
	// fill the box once the panel is open and its composer is mounted
	useEffect(() => {
		if (!open || prefill === null) return;
		let frame = 0;
		let tries = 0;
		const fillBox = () => {
			if (composer.current) {
				composer.current.focus(prefill);
				setPrefill(null);
			} else if (tries++ < 30) frame = requestAnimationFrame(fillBox);
			else setPrefill(null);
		};
		frame = requestAnimationFrame(fillBox);
		return () => cancelAnimationFrame(frame);
	}, [open, prefill]);

	return (
		<AgentAssistantPanel
			chat={chat}
			open={open}
			onOpenChange={setOpen}
			pageLabel={entity ? entityLabel(entity.kind, locale) : pageLabel(pageModule, locale)}
			pending={pending.data ?? []}
			onDecide={decide}
			onUndo={undoChangeSet ? undo : undefined}
			onNavigate={(href) => router.push(href)}
			composerHandle={composer}
			suggestions={agentStarters(pageModule, locale)}
			labels={agentPanelLabels(locale)}
			locale={locale}
			work={work}
		/>
	);
}

export default function DashboardAgentDock() {
	const pathname = usePathname() ?? "/";
	const [gateway] = useState(() => createAgentGateway());
	// the blog editor has the copilot in its side column (one chat per post): no second mascot there
	if (!dockShownOn(pathname)) return null;
	return (
		<AgentProvider gateway={gateway}>
			<DockSurface />
		</AgentProvider>
	);
}
