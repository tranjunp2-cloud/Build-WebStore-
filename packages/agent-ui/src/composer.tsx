import {
	ATTACHMENT_DOCUMENT_TYPES,
	ATTACHMENT_IMAGE_TYPES,
	type AgentAttachment,
	type AttachmentOrigin,
	type ComposerAttachment,
	type ContextElement,
	type ContextElementKind,
	contextElementKey,
} from "@ech/agent-core";
import {
	type ClipboardEvent,
	type DragEvent,
	forwardRef,
	type KeyboardEvent,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import { ElementChip } from "./element-chip";
import { Icon, type IconName } from "./icons";

export type PickSource = Exclude<AttachmentOrigin, "upload">;

export interface ComposerLabels {
	placeholder: string;
	/** while a reply is on its way — typing is still allowed */
	placeholderBusy: string;
	/** one thing on the page attached: "What should change on this {kind}?" ({kind} = its kind, lower case) */
	placeholderElement: string;
	/** several: "Ask about these {n}…" */
	placeholderElements: string;
	/** the send button while a reply is on its way */
	stop: string;
	/** key hint beside a suggested prompt in the empty box */
	useHint: string;
	/** footer switch: apply the assistant's changes without asking */
	autoApprove: string;
	autoApproveHint: string;
	message: string;
	attach: string;
	upload: string;
	uploadHint: string;
	library: string;
	productPhotos: string;
	stock: string;
	/** where the free photos come from, shown small after `stock` */
	stockHint: string;
	searchPictures: string;
	noPictures: string;
	loadingPictures: string;
	picturesFailed: string;
	back: string;
	removeFile: string;
	removeContext: string;
	contextTitle: string;
	send: string;
	/** "{n}%" */
	uploading: string;
	readForFacts: string;
	ready: string;
	/** chip kind of a thing on the page sent with the message */
	elementKinds: Record<ContextElementKind, string>;
	/** "Remove {name}" on an element chip */
	removeElement: string;
}

export const DEFAULT_COMPOSER_LABELS: ComposerLabels = {
	placeholder: "Ask, or describe what to create…",
	placeholderBusy: "Type your next message…",
	placeholderElement: "What should change on this {kind}?",
	placeholderElements: "Ask about these {n}…",
	stop: "Stop reply",
	useHint: "Tab",
	autoApprove: "Auto-approve",
	autoApproveHint: "Apply the assistant's changes without asking. You can still undo most of them; deletions, payments, buyer emails and live discount codes still ask.",
	message: "Message ECH Agent",
	attach: "Attach files or photos",
	upload: "Upload from computer",
	uploadHint: "Images, PDF, CSV, XLSX",
	library: "Media library",
	productPhotos: "Photos of an existing product",
	stock: "Find free photos",
	stockHint: "Pixabay",
	searchPictures: "Search pictures",
	noPictures: "No pictures found.",
	loadingPictures: "Loading pictures…",
	picturesFailed: "Pictures could not load. Try again.",
	back: "Back",
	removeFile: "Remove {name}",
	removeContext: "Don't use this page as context",
	contextTitle: "Include this page as context",
	send: "Send",
	uploading: "Uploading {n}%",
	readForFacts: "read for facts",
	ready: "ready",
	elementKinds: {
		text: "Text",
		button: "Button",
		image: "Picture",
		section: "Section",
		seo: "SEO",
		menu: "Menu",
		footer: "Footer",
		page: "Page",
		product: "Product",
		post: "Post",
	},
	removeElement: "Remove {name}",
};

const ACCEPT = [...ATTACHMENT_IMAGE_TYPES, ...ATTACHMENT_DOCUMENT_TYPES].join(",");

function sizeLabel(bytes: number): string {
	if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export interface ComposerHandle {
	/** focus the box, optionally replacing its text */
	focus: (text?: string) => void;
	/** open the picture picker on a source (e.g. stock photos for a new cover) */
	openPicker: (source: PickSource) => void;
}

export interface ChatComposerProps {
	attachments: ComposerAttachment[];
	attachmentError?: string;
	onFiles: (files: File[]) => void;
	onRemove: (key: string) => void;
	onPick: (item: AgentAttachment) => void;
	listMedia: (query: { source: PickSource; query?: string; limit?: number }) => Promise<AgentAttachment[]>;
	/** page-context chip; omitted once the merchant removed it */
	context?: { label: string; icon?: IconName; onRemove: () => void };
	/** things on the page waiting for the next message (Ask AI on an element) */
	elements?: {
		items: ContextElement[];
		onRemove: (element: ContextElement) => void;
		/** pointer over a chip — the host lights the element up */
		onHover?: (element: ContextElement | null) => void;
	};
	canSend: (text: string) => boolean;
	onSend: (text: string) => Promise<void> | void;
	/** a run is working — sending waits */
	busy?: boolean;
	/** stop the run that is working; the send button turns into stop */
	onStop?: () => void;
	/** a suggested next prompt shown in the empty box; Tab takes it */
	hint?: string;
	/** Enter while a reply is on its way: keep the message to send when it is done */
	onQueue?: (text: string) => void;
	/** the auto-approve switch in the footer (omitted: no switch) */
	autoApprove?: { on: boolean; onChange: (on: boolean) => void };
	labels?: Partial<ComposerLabels>;
}

function fill(template: string, values: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function MediaPicker({
	source,
	listMedia,
	onPick,
	onBack,
	labels,
}: {
	source: PickSource;
	listMedia: ChatComposerProps["listMedia"];
	onPick: (item: AgentAttachment) => void;
	onBack: () => void;
	labels: ComposerLabels;
}) {
	const [query, setQuery] = useState("");
	const [items, setItems] = useState<AgentAttachment[] | null>(null);
	const [failed, setFailed] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		inputRef.current?.focus();
	}, []);
	useEffect(() => {
		let live = true;
		setFailed(false);
		const timer = setTimeout(
			() => {
				listMedia({ source, query: query.trim() || undefined, limit: 24 })
					.then((rows) => live && setItems(rows))
					.catch(() => {
						if (!live) return;
						setItems([]);
						setFailed(true);
					});
			},
			query ? 250 : 0,
		);
		return () => {
			live = false;
			clearTimeout(timer);
		};
	}, [source, query, listMedia]);
	const title = source === "media" ? labels.library : source === "product" ? labels.productPhotos : labels.stock;
	return (
		<div className="ech-ag-menu ech-ag-picker" role="dialog" aria-label={title}>
			<div className="ech-ag-picker-head">
				<button type="button" className="ech-ag-ib" aria-label={labels.back} onClick={onBack}>
					<Icon name="chevron-right" style={{ rotate: "180deg" }} />
				</button>
				<b>{title}</b>
			</div>
			<label className="ech-ag-search">
				<Icon name="search" />
				<input
					ref={inputRef}
					type="search"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder={labels.searchPictures}
					aria-label={labels.searchPictures}
				/>
			</label>
			{items === null ? (
				<p className="ech-ag-picker-note">{labels.loadingPictures}</p>
			) : items.length === 0 ? (
				<p className="ech-ag-picker-note">{failed ? labels.picturesFailed : labels.noPictures}</p>
			) : (
				<div className="ech-ag-picker-grid">
					{items.map((item) => (
						<button
							key={item.id}
							type="button"
							style={item.url ? { backgroundImage: `url("${item.url.replace(/"/g, "%22")}")` } : undefined}
							title={[item.name, item.credit].filter(Boolean).join(" · ")}
							aria-label={item.name}
							onClick={() => onPick(item)}
						/>
					))}
				</div>
			)}
		</div>
	);
}

/**
 * The composer, pinned to the bottom of the panel: file tray, autosizing
 * box, attach menu (upload, media library, a product's photos, stock
 * photos), the page-context chip and send.
 */
export const ChatComposer = forwardRef<ComposerHandle, ChatComposerProps>(function ChatComposer(
	{ attachments, attachmentError, onFiles, onRemove, onPick, listMedia, context, elements, canSend, onSend, busy, onStop, hint, onQueue, autoApprove, labels: overrides },
	ref,
) {
	const labels = { ...DEFAULT_COMPOSER_LABELS, ...overrides };
	const [text, setText] = useState("");
	const [menu, setMenu] = useState<"closed" | "menu" | PickSource>("closed");
	const [drop, setDrop] = useState(false);
	const boxRef = useRef<HTMLTextAreaElement>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const rootRef = useRef<HTMLFormElement>(null);
	const attachRef = useRef<HTMLButtonElement>(null);

	useImperativeHandle(ref, () => ({
		focus: (next) => {
			if (next !== undefined) setText(next);
			requestAnimationFrame(() => {
				const box = boxRef.current;
				if (!box) return;
				box.focus();
				box.setSelectionRange(box.value.length, box.value.length);
			});
		},
		openPicker: (source) => setMenu(source),
	}));

	// autosize for browsers without `field-sizing: content`
	useEffect(() => {
		const box = boxRef.current;
		if (!box || CSS.supports?.("field-sizing", "content")) return;
		box.style.height = "auto";
		box.style.height = `${Math.min(200, box.scrollHeight)}px`;
	}, [text]);

	useEffect(() => {
		if (menu === "closed") return;
		const onDown = (e: PointerEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) setMenu("closed");
		};
		document.addEventListener("pointerdown", onDown, true);
		return () => document.removeEventListener("pointerdown", onDown, true);
	}, [menu]);

	const ready = canSend(text) && !busy;
	const submit = () => {
		if (busy && onQueue && text.trim()) {
			onQueue(text.trim());
			setText("");
			return;
		}
		if (!ready) return;
		const value = text;
		setText("");
		void onSend(value);
	};

	const offerHint = Boolean(hint) && !busy && text === "";
	// a thing on the page attached: ask about it in its own words
	const attached = elements?.items ?? [];
	const firstKind = attached[0] ? (labels.elementKinds[attached[0].kind] ?? attached[0].kind).toLowerCase() : "";
	const elementPlaceholder =
		attached.length > 1
			? fill(labels.placeholderElements, { n: attached.length })
			: firstKind
				? fill(labels.placeholderElement, { kind: firstKind })
				: labels.placeholder;
	const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Tab" && !e.shiftKey && offerHint && hint) {
			e.preventDefault();
			setText(hint);
			return;
		}
		if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
			e.preventDefault();
			submit();
		}
	};

	const takeFiles = (list: FileList | null | undefined) => {
		const files = list ? [...list] : [];
		if (files.length > 0) onFiles(files);
	};

	const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
		const files = [...e.clipboardData.files];
		if (files.length > 0) {
			e.preventDefault();
			onFiles(files);
		}
	};

	const dragProps = {
		onDragOver: (e: DragEvent) => {
			if (!e.dataTransfer.types.includes("Files")) return;
			e.preventDefault();
			setDrop(true);
		},
		onDragLeave: (e: DragEvent) => {
			if (!rootRef.current?.contains(e.relatedTarget as Node)) setDrop(false);
		},
		onDrop: (e: DragEvent) => {
			if (!e.dataTransfer.files.length) return;
			e.preventDefault();
			setDrop(false);
			takeFiles(e.dataTransfer.files);
		},
	};

	const closeMenu = (refocus: boolean) => {
		setMenu("closed");
		if (refocus) attachRef.current?.focus();
	};

	return (
		<form
			ref={rootRef}
			className="ech-ag-cmp"
			data-drop={drop ? "" : undefined}
			onSubmit={(e) => {
				e.preventDefault();
				submit();
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape" && menu !== "closed") {
					e.stopPropagation();
					closeMenu(true);
				}
			}}
			{...dragProps}
		>
			{attachments.length > 0 && (
				<div className="ech-ag-files">
					{attachments.map((file) => {
						const image = file.kind === "image" && file.previewUrl;
						const remove = (
							<button
								type="button"
								className="ech-ag-x"
								aria-label={fill(labels.removeFile, { name: file.name })}
								onClick={() => onRemove(file.key)}
							>
								<span>
									<Icon name="x" size={11} />
								</span>
							</button>
						);
						if (image && file.status !== "error") {
							return (
								<span
									key={file.key}
									className="ech-ag-file is-img"
									data-status={file.status}
									style={{ backgroundImage: `url("${file.previewUrl?.replace(/"/g, "%22")}")` }}
									title={file.name}
								>
									{file.status === "uploading" && (
										<span className="ech-ag-bar">
											<i style={{ transform: `scaleX(${Math.max(0.02, file.progress)})` }} />
										</span>
									)}
									{remove}
								</span>
							);
						}
						const status =
							file.status === "error"
								? (file.error ?? "Upload failed")
								: file.status === "uploading"
									? fill(labels.uploading, { n: Math.round(file.progress * 100) })
									: file.kind === "document"
										? `${file.attachment ? `${sizeLabel(file.attachment.size)} · ` : ""}${labels.readForFacts}`
										: labels.ready;
						return (
							<span key={file.key} className="ech-ag-file" data-status={file.status} title={file.name}>
								<span
									className="ech-ag-doc"
									style={file.kind === "image" ? { background: "var(--ech-ag-quiet)", color: "var(--ech-ag-ink-3)" } : undefined}
								>
									<Icon name={file.kind === "image" ? "image" : "file-text"} />
								</span>
								<span>
									<b>{file.name}</b>
									<small>{status}</small>
								</span>
								{file.status === "uploading" && (
									<span className="ech-ag-bar">
										<i style={{ transform: `scaleX(${Math.max(0.02, file.progress)})` }} />
									</span>
								)}
								{remove}
							</span>
						);
					})}
				</div>
			)}
			{attachmentError && (
				<p className="ech-ag-cmp-error" role="alert">
					{attachmentError}
				</p>
			)}
			{elements && elements.items.length > 0 && (
				// the editor's flight lands here (data-agent-elements)
				<div className="ech-ag-els" data-agent-elements="">
					{elements.items.map((element) => (
						<ElementChip
							key={contextElementKey(element)}
							element={element}
							kindLabel={labels.elementKinds[element.kind] ?? element.kind}
							removeLabel={fill(labels.removeElement, { name: element.label })}
							onRemove={() => elements.onRemove(element)}
							onHover={elements.onHover}
						/>
					))}
				</div>
			)}
			<textarea
				ref={boxRef}
				rows={1}
				value={text}
				onChange={(e) => setText(e.target.value)}
				onKeyDown={onKeyDown}
				onPaste={onPaste}
				placeholder={busy ? labels.placeholderBusy : offerHint ? hint : elementPlaceholder}
				aria-label={labels.message}
			/>
			<div className="ech-ag-c-row">
				<button
					ref={attachRef}
					type="button"
					className="ech-ag-ib"
					aria-label={labels.attach}
					title={labels.attach}
					aria-haspopup="menu"
					aria-expanded={menu !== "closed"}
					onClick={() => setMenu(menu === "closed" ? "menu" : "closed")}
				>
					<Icon name="paperclip" />
				</button>
				{context && (
					<button type="button" className="ech-ag-ctx" title={labels.removeContext} onClick={context.onRemove}>
						<Icon name={context.icon ?? "package"} />
						<span>{context.label}</span>
						<Icon name="x" />
					</button>
				)}
				{autoApprove && (
					<button
						type="button"
						role="switch"
						aria-checked={autoApprove.on}
						className="ech-ag-auto"
						title={labels.autoApproveHint}
						onClick={() => autoApprove.onChange(!autoApprove.on)}
					>
						<span className="ech-ag-auto-track" aria-hidden="true">
							<span />
						</span>
						{labels.autoApprove}
					</button>
				)}
				{offerHint && (
					<kbd className="ech-ag-tab-hint" aria-hidden="true">
						{labels.useHint}
					</kbd>
				)}
				{busy && onStop ? (
					<button type="button" className="ech-ag-send-btn is-stop" aria-label={labels.stop} title={labels.stop} onClick={onStop}>
						<Icon name="square" size={22} />
					</button>
				) : (
					<button type="submit" className="ech-ag-send-btn" aria-label={labels.send} disabled={!ready}>
						<Icon name="arrow-up" />
					</button>
				)}
			</div>
			<input
				ref={fileRef}
				type="file"
				accept={ACCEPT}
				multiple
				hidden
				onChange={(e) => {
					takeFiles(e.target.files);
					e.target.value = "";
				}}
			/>
			{menu === "menu" && (
				<div className="ech-ag-menu ech-ag-composer-menu" role="menu" style={{ left: 4, bottom: "calc(100% + 6px)" }}>
					<button
						type="button"
						role="menuitem"
						onClick={() => {
							closeMenu(false);
							fileRef.current?.click();
						}}
					>
						<Icon name="upload" />
						{labels.upload}
						<small>{labels.uploadHint}</small>
					</button>
					<button type="button" role="menuitem" onClick={() => setMenu("stock")}>
						<Icon name="search" />
						{labels.stock}
						<small>{labels.stockHint}</small>
					</button>
				</div>
			)}
			{menu !== "closed" && menu !== "menu" && (
				<MediaPicker
					source={menu}
					listMedia={listMedia}
					labels={labels}
					onBack={() => setMenu("menu")}
					onPick={(item) => {
						onPick(item);
						closeMenu(false);
						boxRef.current?.focus();
					}}
				/>
			)}
		</form>
	);
});
