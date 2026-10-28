"use client";

import "@ech/agent-ui/styles.css";
import type { ChangeSet } from "@ech/agent-core";
import { AgentProvider, useChangeSets, useDecideChangeSet, useReconcileChangeSet, useUndoChangeSet } from "@ech/agent-react";
import { sessionThreadHint, useAgentChatRuntime, webBuilderChats } from "@ech/agent-react/chat";
import { AgentAssistantPanel, AutoApproveWait, type CardUndoState, type ChatSuggestion, type ComposerHandle, DEFAULT_COMPOSER_LABELS, flyToComposer } from "@ech/agent-ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { editorPageLocation } from "@/components/agent/agent-page-location";
import { agentPanelLabels } from "@/components/agent/agent-panel-labels";
import { useI18n } from "@/i18n";
import { createAgentGateway } from "@/lib/agent-changes/agent-gateway";
import { siteLanguages } from "@/lib/site-languages";
import { aiStepState, useEditorStore } from "@/store/editorStore";
import { elementRevealTarget, revealTargetOf, revealTargetsOf, translatedInto } from "@/lib/editor/reveal/reveal-target";
import { EDITOR_AI_PICK_EVENT, type EditorAiPickDetail } from "./canvas-pick";
import { AUTO_IDLE, MANUAL_IDLE, waitForEditorIdle } from "./editor-idle";
import { cardUndoState, undoRoute } from "./card-undo-state";
import { editorUndoPhrases } from "./editor-undo-phrases";
import { newerOverlapping } from "@/lib/agent-changes/undo-touches";
import { CanvasPickTip, canvasPickTipText, useCanvasPickTip } from "./canvas-pick-tip";
import { useChangeWalker } from "./change-walker-store";
import {
	EDITOR_AI_ASK_EVENT,
	EDITOR_AI_CHANGED_EVENT,
	EDITOR_AI_RECONCILE_EVENT,
	type EditorAiAskDetail,
	type EditorAiChangedDetail,
	type EditorAiReconcileDetail,
	editorPin,
	hoverInEditor,
	useChangeVerdicts,
	useEditorAgentFocus,
	useEditorAgentRun,
	useEditorHistoryControl,
} from "./editor-agent-context";

const SUGGESTIONS: Record<string, ChatSuggestion[]> = {
	en: [
		{ label: "Friendlier hero", prompt: "Rewrite the top section to sound friendlier" },
		{ label: "Add a FAQ", prompt: "Add a FAQ section with 4 questions about my shop" },
		{ label: "Check SEO", prompt: "Check this page's SEO and fix what is missing" },
		{ label: "Translate page", prompt: "Translate this page into the website's second language" },
	],
	ms: [
		{ label: "Hero lebih mesra", prompt: "Tulis semula bahagian atas supaya lebih mesra" },
		{ label: "Tambah Soalan Lazim", prompt: "Tambah bahagian Soalan Lazim dengan 4 soalan tentang kedai saya" },
		{ label: "Semak SEO", prompt: "Semak SEO halaman ini dan betulkan yang tiada" },
		{ label: "Terjemah halaman", prompt: "Terjemah halaman ini ke bahasa kedua laman web" },
	],
	vi: [
		{ label: "Hero thân thiện hơn", prompt: "Viết lại phần đầu trang cho thân thiện hơn" },
		{ label: "Thêm FAQ", prompt: "Thêm phần FAQ với 4 câu hỏi về cửa hàng của tôi" },
		{ label: "Kiểm tra SEO", prompt: "Kiểm tra SEO trang này và sửa phần còn thiếu" },
		{ label: "Dịch trang", prompt: "Dịch trang này sang ngôn ngữ thứ hai của website" },
	],
};

/** The new chat's greeting and how to put a thing on the page into the chat. */
const HELLO: Record<string, { greeting: string; page: string }> = {
	en: { greeting: "What should we change on {page}?", page: "this page" },
	ms: { greeting: "Apa yang perlu kita ubah pada {page}?", page: "halaman ini" },
	vi: { greeting: "Bạn muốn sửa gì trên {page}?", page: "trang này" },
};

/** Changes that write the site the editor shows (the editor must reload after them). */
const EDITOR_KIND: Record<string, EditorAiChangedDetail["kind"]> = {
	"site.page_patch": "page",
	"site.theme_patch": "theme",
	"site.seo_patch": "seo",
	"site.translate_page": "translate",
	"site.pages_patch": "pages",
	"site.page_create": "structure",
	"site.nav_patch": "nav",
	"site.languages_patch": "languages",
	"site.publish": "publish",
};
const isSiteChange = (changeSet: ChangeSet) => Boolean(changeSet.action?.kind && EDITOR_KIND[changeSet.action.kind]);
/** A site change for this site — the editor lists only its own proposals, not the dashboard's. */
function isForSite(changeSet: ChangeSet, siteId: string): boolean {
	const planned = (changeSet.action?.payload as { siteId?: unknown } | undefined)?.siteId;
	return isSiteChange(changeSet) && (planned === undefined || String(planned) === siteId);
}

/**
 * The web builder copilot in the editor's AI Chat tab. Same agent packages and
 * backend as the dashboard dock; the pin tells it which site, page and section
 * are on screen. Approving applies the change to the page draft server-side;
 * the editor then reloads that draft so preview, history and Undo stay in step.
 *
 * One chat per site and tab: a reload reopens it, "Start over" clears it —
 * no recent chats, never the dashboard's latest chat. A click on the canvas
 * puts what was clicked into the message box (the chip follows the
 * selection; Shift + click adds); the selected section rides in the pin.
 */
function EditorChatSurface({ siteId }: { siteId: string }) {
	const router = useRouter();
	const { locale } = useI18n();
	const pageId = useEditorStore((s) => s.currentPageId);
	const pageTitle = useEditorStore((s) => s.pages.find((p) => p.id === s.currentPageId)?.title ?? null);
	const activeLocale = useEditorStore((s) => s.activeLocale);
	const primaryLocale = useEditorStore((s) => s.primaryLocale);
	const secondaryLocale = useEditorStore((s) => s.secondaryLocale);
	const generationLocale = useEditorStore((s) => s.generationLocale);
	const siteLocale = useEditorStore((s) => s.siteLocale);
	const languages = useMemo(
		() => siteLanguages({ primaryLocale, secondaryLocale, generationLocale, siteLocale }),
		[primaryLocale, secondaryLocale, generationLocale, siteLocale],
	);
	const writtenIn = generationLocale || siteLocale;
	const { blockId, blockLabel } = useEditorAgentFocus();

	const pin = useMemo(
		() => editorPin({ siteId, pageId, pageTitle, blockId, blockLabel, language: activeLocale, languages, writtenIn }),
		[siteId, pageId, pageTitle, blockId, blockLabel, activeLocale, languages, writtenIn],
	);

	const hint = useMemo(() => sessionThreadHint(`ech-agent:thread:editor:${siteId}`), [siteId]);
	// only web builder chats: listed, reopened, and never a dashboard chat continued here
	const page = useMemo(() => editorPageLocation(siteId, pageTitle), [siteId, pageTitle]);
	const runtime = useAgentChatRuntime({ context: pin, page, hint, restoreLatest: false, scope: webBuilderChats });
	// the compact bottom bar shows "AI is editing" and a Stop while a reply is being written
	const publishRun = useEditorAgentRun((s) => s.set);
	const { busy, stop } = runtime;
	useEffect(() => {
		publishRun(busy, stop);
		return () => publishRun(false, undefined);
	}, [busy, stop, publishRun]);
	// the copilot reads the saved draft: save what is on screen before each request
	const send = runtime.send;
	const chat = useMemo(() => {
		return {
			...runtime,
			send: async (prompt: string) => {
				const state = useEditorStore.getState();
				if (state.hasUnsavedChanges && !state.isSaving) await state.performSave(true);
				return send(prompt);
			},
		};
	}, [runtime, send]);
	const allPending = useChangeSets({ status: "pending" });
	const pending = useMemo(() => (allPending.data ?? []).filter((c) => isForSite(c, siteId)), [allPending.data, siteId]);
	const decideChangeSet = useDecideChangeSet();
	const undoChangeSet = useUndoChangeSet();
	/** change sets already compared with the page this session (or applied in it): each is asked about once */
	const checked = useRef(new Set<string>());


	/**
	 * Before a site change runs: write what is on screen, then hold autosave —
	 * a save from the store as it was would overwrite the change. Returns the
	 * resume function; the editor calls it once it reloaded the new draft.
	 */
	const phrases = useMemo(() => editorUndoPhrases(locale), [locale]);
	const holdEditor = useCallback(async (auto = false) => {
		// a change replaces the draft this editor holds: never while the merchant is mid-edit (typed text would be lost)
		const idle = await waitForEditorIdle(() => useEditorStore.getState(), auto ? AUTO_IDLE : MANUAL_IDLE);
		if (!idle) throw auto ? new AutoApproveWait(phrases.waitingToApply) : new Error(phrases.finishEditing);
		const state = useEditorStore.getState();
		if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);
		// the change is checked against the saved draft: what is on screen must be saved first
		if (state.hasUnsavedChanges && !(await state.performSave(true))) {
			throw new Error("Your latest edits could not be saved, so the change was not applied. Try again.");
		}
		const after = useEditorStore.getState();
		if (after.autoSaveTimer) clearTimeout(after.autoSaveTimer);
		const wasEnabled = after.autoSaveEnabled;
		after.setAutoSaveEnabled(false);
		// no canvas typing until the new draft is in (it would be replaced)
		after.setIsApplyingAi(true);
		return {
			resume: () => {
				const now = useEditorStore.getState();
				now.setIsApplyingAi(false);
				now.setAutoSaveEnabled(wasEnabled);
			},
			revision: after.contentRevision,
		};
	}, [phrases]);

	const announce = useCallback((changeSet: ChangeSet, held: { resume: () => void; revision: number }, undone = false) => {
		const payload = (changeSet.action?.payload ?? {}) as { pageId?: unknown; pages?: unknown };
		const pageIds = Array.isArray(payload.pages) ? payload.pages.map((p) => String((p as { pageId?: unknown }).pageId ?? "")).filter(Boolean) : [];
		// a new page has no id in its plan: the applied result names it (its undo removes that page)
		const created = changeSet.action?.kind === "site.page_create" ? changeSet.result?.entities?.find((e) => e.kind === "site_page")?.id : undefined;
		const detail: EditorAiChangedDetail = {
			kind: EDITOR_KIND[changeSet.action?.kind ?? ""] ?? "page",
			...(typeof payload.pageId === "string" ? { pageId: payload.pageId } : created ? { pageId: String(created) } : {}),
			...(pageIds.length > 0 ? { pageIds } : {}),
			label: changeSet.title,
			changeSetId: changeSet.id,
			...(undone ? { undone: true } : {}),
			// an applied translation is shown in its language; an undone one is not followed there
			...(!undone && translatedInto(changeSet) ? { locale: translatedInto(changeSet) } : {}),
			resume: held.resume,
			heldRevision: held.revision,
		};
		window.dispatchEvent(new CustomEvent(EDITOR_AI_CHANGED_EVENT, { detail }));
	}, []);

	const decide = useCallback(
		async (changeSet: ChangeSet, decision: "approve" | "reject", options?: { confirm?: string; auto?: boolean }) => {
			const held = decision === "approve" && isSiteChange(changeSet) ? await holdEditor(options?.auto === true) : null;
			// applied here: the page timeline has it (or will in a moment) — nothing to ask the server about
			if (decision === "approve") checked.current.add(changeSet.id);
			try {
				const decided = await decideChangeSet(changeSet.id, decision, "self", undefined, options?.confirm !== undefined ? { confirm: options.confirm } : undefined);
				allPending.refresh();
				if (held && decided.status === "applied") announce(decided, held);
				else held?.resume();
				return decided;
			} catch (error) {
				held?.resume();
				throw error;
			}
		},
		[decideChangeSet, allPending, announce, holdEditor],
	);
	// What the server last said about each applied change against the page (see reconcile): feeds the card's Undo state.
	const reconcileChangeSet = useReconcileChangeSet();
	const setVerdict = useChangeVerdicts((s) => s.set);
	const verdicts = useChangeVerdicts((s) => s.byId);
	const history = useEditorStore((s) => s.history);
	const historyIndex = useEditorStore((s) => s.historyIndex);
	/** Ask the server whether the page still has this change (applied / reverted / edited since) and settle its card. */
	const reconcile = useCallback(
		async (id: string): Promise<ChangeSet | null> => {
			if (!reconcileChangeSet) return null;
			for (let attempt = 0; attempt < 2; attempt++) {
				try {
					const result = await reconcileChangeSet(id);
					setVerdict(id, result.verdict);
					return result.changeSet;
				} catch (error) {
					if (attempt === 1) console.warn("[editor] could not check an assistant change against the page", error);
				}
			}
			return null;
		},
		[reconcileChangeSet, setVerdict],
	);
	// the header's Undo / Redo crossed one of the assistant's changes: settle its card
	useEffect(() => {
		const onReconcile = (event: Event) => void reconcile((event as CustomEvent<EditorAiReconcileDetail>).detail.changeSetId);
		window.addEventListener(EDITOR_AI_RECONCILE_EVENT, onReconcile);
		return () => window.removeEventListener(EDITOR_AI_RECONCILE_EVENT, onReconcile);
	}, [reconcile]);

	const undo = useCallback(
		async (changeSet: ChangeSet) => {
			if (!undoChangeSet) return changeSet;
			const kind = EDITOR_KIND[changeSet.action?.kind ?? ""];
			const editor = useEditorStore.getState();
			const route = undoRoute(kind, aiStepState(editor.history, editor.historyIndex, changeSet.id));
			if (route === "blocked") throw new Error(phrases.newerStepsFirst);
			const step = useEditorHistoryControl.getState().step;
			if (route === "timeline" && step) {
				// the newest step of the page timeline: this IS the header's Undo, nothing else
				const stepped = await step("undo");
				if (!stepped?.saved) throw new Error(phrases.couldNotSave);
				return (await reconcile(changeSet.id)) ?? changeSet;
			}
			// not on the timeline (the page was reloaded, or a setting it does not cover): the saved version is put back
			const held = isSiteChange(changeSet) ? await holdEditor() : null;
			try {
				const reverted = await undoChangeSet(changeSet.id);
				if (held) announce(changeSet, held, true);
				return reverted;
			} catch (error) {
				held?.resume();
				throw error;
			}
		},
		[undoChangeSet, announce, holdEditor, reconcile, phrases],
	);

	// cards of this chat applied before this page was opened: ask once what the page says (undone by hand, edited since…)
	const chatCards = useMemo(() => chat.turns.flatMap((turn) => (turn.role === "assistant" ? turn.changeSets : [])), [chat.turns]);
	useEffect(() => {
		const editor = useEditorStore.getState();
		const todo = chatCards
			.filter((c) => c.status === "applied" && isSiteChange(c) && c.result?.undo && !checked.current.has(c.id) && aiStepState(editor.history, editor.historyIndex, c.id) === "none")
			.slice(-6);
		if (todo.length === 0) return;
		for (const card of todo) checked.current.add(card.id);
		void (async () => {
			for (const card of todo) await reconcile(card.id);
		})();
	}, [chatCards, reconcile]);

	// a card's Undo: the same step as the header's when it is the newest, disabled with the reason otherwise
	const undoState = useCallback(
		(changeSet: ChangeSet): CardUndoState | undefined =>
			cardUndoState({
				changeSet,
				kind: EDITOR_KIND[changeSet.action?.kind ?? ""],
				step: aiStepState(history, historyIndex, changeSet.id),
				verdict: verdicts[changeSet.id],
				newer: changeSet.status === "applied" ? newerOverlapping(changeSet, chatCards) : null,
				phrases,
			}),
		[chatCards, history, historyIndex, phrases, verdicts],
	);

	// Ask AI on an element: it flies from the canvas into the message box and waits there;
	// with a prompt the message goes at once (the chat tab was opened by the editor page)
	const composer = useRef<ComposerHandle | null>(null);
	const labels = useMemo(() => agentPanelLabels(locale), [locale]);
	const attachElement = runtime.attachElement;
	// the Shift + click tip shows above the chip until the merchant has used it
	const chatBox = useRef<HTMLDivElement | null>(null);
	const pickTip = useCanvasPickTip(chatBox);
	const onPickedRef = useRef(pickTip.onPicked);
	useLayoutEffect(() => {
		onPickedRef.current = pickTip.onPicked;
	});
	const sendRef = useRef(chat.send);
	useLayoutEffect(() => {
		sendRef.current = chat.send;
	});
	useEffect(() => {
		const onAsk = (event: Event) => {
			const { element, prompt, from } = (event as CustomEvent<EditorAiAskDetail>).detail;
			const kinds = { ...DEFAULT_COMPOSER_LABELS.elementKinds, ...labels.composer?.elementKinds };
			// two frames: the sidebar and its tab are on screen before the flight measures the box
			requestAnimationFrame(() =>
				requestAnimationFrame(async () => {
					if (from) await flyToComposer(from, { element, kindLabel: kinds[element.kind] ?? element.kind });
					attachElement(element);
					if (prompt) void sendRef.current(prompt);
					else {
						composer.current?.focus();
						onPickedRef.current(false);
					}
				}),
			);
		};
		window.addEventListener(EDITOR_AI_ASK_EVENT, onAsk);
		return () => window.removeEventListener(EDITOR_AI_ASK_EVENT, onAsk);
	}, [attachElement, labels]);

	// a click on the canvas: its chip replaces the one in the box (Shift adds). The box is not
	// focused — the merchant may be typing on the page; the flight shows only while the chat is on screen
	useEffect(() => {
		const onPick = (event: Event) => {
			const { element, add, from } = (event as CustomEvent<EditorAiPickDetail>).detail;
			const kinds = { ...DEFAULT_COMPOSER_LABELS.elementKinds, ...labels.composer?.elementKinds };
			void (from ? flyToComposer(from, { element, kindLabel: kinds[element.kind] ?? element.kind }) : Promise.resolve()).then(() =>
				{
					attachElement(element, add ? "add" : "only");
					onPickedRef.current(Boolean(add));
				},
			);
		};
		window.addEventListener(EDITOR_AI_PICK_EVENT, onPick);
		return () => window.removeEventListener(EDITOR_AI_PICK_EVENT, onPick);
	}, [attachElement, labels]);

	const openWalker = useChangeWalker((s) => s.open);
	const hello = HELLO[locale.slice(0, 2)] ?? HELLO.en!;
	const panelLabels = useMemo(
		() => ({ ...labels, chat: { ...labels.chat, greeting: hello.greeting.replace("{page}", pageTitle?.trim() || hello.page) } }),
		[labels, hello, pageTitle],
	);
	return (
		<div ref={chatBox} className="relative h-full min-h-0">
		<AgentAssistantPanel
			placement="inline"
			chat={chat}
			pending={pending}
			onDecide={decide}
			onUndo={undoChangeSet ? undo : undefined}
			undoState={undoState}
			onNavigate={(href) => router.push(href)}
			onLocate={(changeSet, diff) => {
				// the walker steps through every place the change touched, starting at this line
				const targets = revealTargetsOf(changeSet);
				const clicked = revealTargetOf(changeSet, diff);
				if (!clicked || targets.length === 0) return;
				const index = targets.findIndex((t) => t.where === clicked.where && t.path === clicked.path && t.blockId === clicked.blockId);
				openWalker(targets, Math.max(index, 0));
			}}
			onElementHover={(element) => hoverInEditor(element ? elementRevealTarget(element) : null)}
			composerHandle={composer}
			suggestions={SUGGESTIONS[locale.slice(0, 2)] ?? SUGGESTIONS.en}
			labels={panelLabels}
			locale={locale}
			singleChat
		/>
		{pickTip.place && (
			<CanvasPickTip place={pickTip.place} text={canvasPickTipText(locale)} closeLabel={locale.startsWith("vi") ? "Đóng" : locale.startsWith("ms") ? "Tutup" : "Close"} onClose={pickTip.close} />
		)}
		</div>
	);
}

export default function EditorAgentChat({ siteId }: { siteId: string }) {
	const [gateway] = useState(createAgentGateway);
	return (
		<AgentProvider gateway={gateway}>
			<EditorChatSurface siteId={siteId} />
		</AgentProvider>
	);
}
