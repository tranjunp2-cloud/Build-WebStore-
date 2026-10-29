"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AgentDockPlaceholder } from "./AgentDockPlaceholder";
import { dockShownOn } from "./agent-dock-routes";
import { useAgentQuietRoot } from "./agent-quiet-root";
import { AGENT_OPEN_EVENT, holdAgentOpen } from "./agent-open-queue";

const importDock = () => import("./DashboardAgentDock");
// assistant-ui, the chat panel and the agent stylesheet: their own chunk, fetched off the page's critical path
// (the placeholder stays while its chunk downloads)
const DashboardAgentDock = dynamic(importDock, { ssr: false, loading: () => <AgentDockPlaceholder /> });
/** reminder links (`?todo=` / `?ask=`, see use-ask-param) need the dock at once */
const ASKS_FOR_DOCK = /[?&](todo|ask)=/;

/** Run `task` when the browser is idle (or after `timeout` ms at the latest); a short timer where requestIdleCallback is missing (Safari). */
function whenIdle(task: () => void, timeout: number): () => void {
	if (typeof window.requestIdleCallback === "function") {
		const handle = window.requestIdleCallback(() => task(), { timeout });
		return () => window.cancelIdleCallback(handle);
	}
	const timer = setTimeout(task, 200);
	return () => clearTimeout(timer);
}

/** After the page has loaded and the browser is idle: the page's own code and data go first. */
function afterLoadIdle(task: () => void): () => void {
	let cancelIdle = () => {};
	const start = () => {
		cancelIdle = whenIdle(task, 3000);
	};
	if (document.readyState === "complete") start();
	else window.addEventListener("load", start, { once: true });
	return () => {
		window.removeEventListener("load", start);
		cancelIdle();
	};
}

/**
 * The dashboard mascot. A still placeholder button renders at once; the dock (chat, work queue, drafts) loads when
 * the browser is idle after the page loaded, or earlier when the merchant reaches for it (hover / focus / click on the
 * mascot, an "ask the copilot" button anywhere, a reminder link). Open requests made before the dock listens are held
 * and handed to it (agent-open-queue), so nothing typed into an ask bar is lost.
 */
export function DashboardAgentDockLoader() {
	const pathname = usePathname() ?? "/";
	const [mounted, setMounted] = useState(false);
	// form screens: a compact mascot tucked into the corner (globals.css), the placeholder and the dock alike
	useAgentQuietRoot(pathname);

	// hold every open request until the dock listens (it takes them from the queue)
	useEffect(() => {
		const onOpen = (e: Event) => {
			holdAgentOpen((e as CustomEvent).detail);
			setMounted(true);
		};
		window.addEventListener(AGENT_OPEN_EVENT, onOpen);
		return () => window.removeEventListener(AGENT_OPEN_EVENT, onOpen);
	}, []);

	useEffect(() => {
		if (mounted) return;
		if (ASKS_FOR_DOCK.test(window.location.search)) {
			setMounted(true);
			return;
		}
		return afterLoadIdle(() => setMounted(true));
	}, [mounted]);

	if (!dockShownOn(pathname)) return null;
	if (mounted) return <DashboardAgentDock />;
	return <AgentDockPlaceholder onWarm={() => void importDock()} />;
}
