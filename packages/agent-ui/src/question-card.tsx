import type { AgentAsk, AgentAttachment, AnswerInput, AnsweredQuestion, QuestionOption } from "@ech/agent-core";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { Icon } from "./icons";

export interface QuestionLabels {
	/** "Question {i} of {n}" */
	progress: string;
	suggested: string;
	/** "Search all {n} families…" — `{n}` is the total, `{what}` the question's label */
	searchAll: string;
	searchSome: string;
	typeAnswer: string;
	noOptions: string;
	searching: string;
	skip: string;
	/** "Next: {next}" */
	next: string;
	continue: string;
	finish: string;
	change: string;
	searchPictures: string;
	uploadPicture: string;
	uploadingPicture: string;
	noPictures: string;
	skipPictures: string;
	/** "Use {n} photos" */
	usePictures: string;
	useOnePicture: string;
	/** tooltip of the auto chip */
	pickedForYou: string;
	/** short chip on rows the decision model answered */
	autoTag: string;
	skipped: string;
}

export const DEFAULT_QUESTION_LABELS: QuestionLabels = {
	progress: "Question {i} of {n}",
	suggested: "Suggested",
	searchAll: "Search all {n} {what}…",
	searchSome: "Search {what}…",
	typeAnswer: "Or type your answer…",
	noOptions: "Nothing matches. Type your answer instead.",
	searching: "Searching…",
	skip: "Skip, decide later",
	next: "Next: {next}",
	continue: "Continue",
	finish: "Done",
	change: "Change",
	searchPictures: "Search photos…",
	uploadPicture: "Upload",
	uploadingPicture: "Uploading photo",
	noPictures: "No photos found. Upload your own or search with other words.",
	skipPictures: "Skip, add later",
	usePictures: "Use {n} photos",
	useOnePicture: "Use 1 photo",
	pickedForYou: "Picked for you from your catalog — change it if it's wrong",
	autoTag: "Auto",
	skipped: "Skipped",
};

function fill(template: string, values: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

/** "families", "values" — what the search box looks through. */
function searchNoun(ask: AgentAsk): string {
	return ask.question.kind === "family" ? "families" : ask.question.kind === "images" ? "photos" : "options";
}

export interface QuestionCardProps {
	ask: AgentAsk;
	onAnswer: (input: AnswerInput) => Promise<void> | void;
	/** search every option of the question (e.g. all the shop's families) */
	onSearch?: (query: string) => Promise<QuestionOption[]>;
	/** picture questions: upload files straight into the answer */
	onUpload?: (files: File[]) => Promise<AgentAttachment[]>;
	labels?: Partial<QuestionLabels>;
}

/**
 * The clarifying question an `ask_user` tool call opened. One question at a
 * time; options come from the shop's own data and the decision model's
 * suggestion is pre-selected. Answering resumes the paused run.
 */
export function QuestionCard({ ask, onAnswer, onSearch, onUpload, labels: overrides }: QuestionCardProps) {
	const labels = { ...DEFAULT_QUESTION_LABELS, ...overrides };
	const { question } = ask;
	const multiple = question.multiple;
	const [selected, setSelected] = useState<string[]>(question.suggested ? [question.suggested] : []);
	const [text, setText] = useState("");
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<QuestionOption[] | null>(null);
	const [searching, setSearching] = useState(false);
	const [sending, setSending] = useState(false);
	const headingId = useId();
	const groupRef = useRef<HTMLDivElement>(null);

	// a new question replaces the card's state
	useEffect(() => {
		setSelected(question.suggested ? [question.suggested] : []);
		setText("");
		setQuery("");
		setResults(null);
		setSending(false);
	}, [question.id, question.suggested]);

	// hosts pass an inline search callback; a ref keeps a new identity from re-running the search
	const searchRef = useRef(onSearch);
	searchRef.current = onSearch;
	const canSearch = Boolean(onSearch);
	useEffect(() => {
		const q = query.trim();
		const search = searchRef.current;
		if (!q || !search) {
			setResults(null);
			return;
		}
		setSearching(true);
		let live = true;
		const timer = setTimeout(() => {
			search(q)
				.then((rows) => {
					if (live) setResults(rows);
				})
				.catch(() => {
					if (live) setResults([]);
				})
				.finally(() => {
					if (live) setSearching(false);
				});
		}, 250);
		return () => {
			live = false;
			clearTimeout(timer);
		};
	}, [query]);

	// keep a searched pick visible once the search is cleared
	const [picked, setPicked] = useState<QuestionOption[]>([]);
	const shown = results ?? [
		...question.options,
		...picked.filter((p) => !question.options.some((o) => o.value === p.value)),
	];
	const pictures = question.kind === "images";
	const searchable =
		canSearch && (pictures || (question.total ?? question.options.length) > question.options.length);
	const [uploading, setUploading] = useState(0);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const upload = async (files: File[]) => {
		if (!onUpload || files.length === 0) return;
		setUploading(files.length);
		setUploadError(null);
		try {
			const added = await onUpload(files);
			const options = added.map((a) => ({ value: a.id, label: a.name, imageUrl: a.url }));
			setPicked((rows) => [...rows, ...options]);
			setSelected((current) => [...current, ...options.map((o) => o.value)]);
		} catch (error) {
			setUploadError(error instanceof Error && error.message ? error.message : "Upload failed. Try again.");
		} finally {
			setUploading(0);
		}
	};
	const typed = text.trim();
	const canSubmit = !sending && (selected.length > 0 || typed.length > 0);

	const toggle = (option: QuestionOption) => {
		if (!picked.some((p) => p.value === option.value)) setPicked((rows) => [...rows, option]);
		setText("");
		setSelected((current) =>
			multiple
				? current.includes(option.value)
					? current.filter((v) => v !== option.value)
					: [...current, option.value]
				: [option.value],
		);
	};

	const submit = async (input: Omit<AnswerInput, "toolCallId" | "questionId">) => {
		setSending(true);
		try {
			await onAnswer({ toolCallId: ask.toolCallId, questionId: question.id, ...input });
		} finally {
			setSending(false);
		}
	};

	// radio group keys: arrows move and select, Home/End jump
	const onOptionsKey = (e: KeyboardEvent<HTMLDivElement>) => {
		const keys = ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Home", "End"];
		if (!keys.includes(e.key)) return;
		const items = [...(groupRef.current?.querySelectorAll<HTMLButtonElement>(".ech-ag-opt") ?? [])];
		if (items.length === 0) return;
		const index = items.indexOf(document.activeElement as HTMLButtonElement);
		const last = items.length - 1;
		const nextIndex =
			e.key === "Home"
				? 0
				: e.key === "End"
					? last
					: e.key === "ArrowDown" || e.key === "ArrowRight"
						? Math.min(last, index + 1)
						: Math.max(0, index - 1);
		e.preventDefault();
		const next = items[nextIndex];
		next?.focus();
		const option = shown[nextIndex];
		if (option && !multiple) toggle(option);
	};

	const focusIndex = Math.max(
		0,
		shown.findIndex((o) => selected.includes(o.value)),
	);
	const isLast = ask.index + 1 >= ask.total;

	return (
		<div className="ech-ag-q" role="group" aria-labelledby={headingId}>
			<div className="ech-ag-q-head">
				<h3 id={headingId}>{question.title}</h3>
				{ask.total > 1 && <span>{fill(labels.progress, { i: ask.index + 1, n: ask.total })}</span>}
			</div>
			{question.why && <p className="ech-ag-q-why">{question.why}</p>}
			{pictures && (
				<div className="ech-ag-q-tiles" role="group" aria-labelledby={headingId}>
					{shown.map((option) => {
						const checked = selected.includes(option.value);
						return (
							<button
								key={option.value}
								type="button"
								className="ech-ag-q-tile"
								role="checkbox"
								aria-checked={checked}
								aria-label={option.label}
								title={[option.label, option.credit].filter(Boolean).join(" · ")}
								style={option.imageUrl ? { backgroundImage: `url("${option.imageUrl.replace(/"/g, "%22")}")` } : undefined}
								onClick={() => toggle(option)}
							>
								<span className="ech-ag-q-check" aria-hidden="true">
									{checked && <Icon name="check" size={12} strokeWidth={3} />}
								</span>
							</button>
						);
					})}
					{Array.from({ length: uploading }, (_, i) => (
						<span key={`up-${i}`} className="ech-ag-q-tile is-uploading" role="status" aria-label={labels.uploadingPicture}>
							<Icon name="loader-circle" className="ech-ag-spin" />
						</span>
					))}
					{onUpload && (
						<button type="button" className="ech-ag-q-tile is-add" onClick={() => fileRef.current?.click()}>
							<Icon name="upload" />
							<span>{labels.uploadPicture}</span>
						</button>
					)}
					<input
						ref={fileRef}
						type="file"
						accept="image/jpeg,image/png,image/webp"
						multiple
						hidden
						onChange={(e) => {
							void upload([...(e.target.files ?? [])]);
							e.target.value = "";
						}}
					/>
				</div>
			)}
			{pictures && shown.length === 0 && uploading === 0 && <p className="ech-ag-q-empty">{labels.noPictures}</p>}
			{uploadError && (
				<p className="ech-ag-q-empty ech-ag-q-error" role="alert">
					{uploadError}
				</p>
			)}
			{!pictures && shown.length > 0 && (
				<div
					ref={groupRef}
					className="ech-ag-opts"
					role={multiple ? "group" : "radiogroup"}
					aria-labelledby={headingId}
					onKeyDown={onOptionsKey}
				>
					{shown.map((option, i) => {
						const checked = selected.includes(option.value);
						return (
							<button
								key={option.value}
								type="button"
								className="ech-ag-opt"
								role={multiple ? "checkbox" : "radio"}
								data-multi={multiple ? "" : undefined}
								aria-checked={checked}
								tabIndex={multiple || i === focusIndex ? 0 : -1}
								onClick={() => toggle(option)}
							>
								<span className="ech-ag-radio" aria-hidden="true">
									{multiple && checked && <Icon name="check" size={12} strokeWidth={3} />}
								</span>
								<span>
									<b>{option.label}</b>
									{option.meta && <small>{option.meta}</small>}
								</span>
								{option.value === question.suggested ? (
									<span className="ech-ag-suggested">{labels.suggested}</span>
								) : (
									<span />
								)}
							</button>
						);
					})}
				</div>
			)}
			{results !== null && results.length === 0 && !searching && <p className="ech-ag-q-empty">{labels.noOptions}</p>}
			{searchable && (
				<label className="ech-ag-q-other">
					<Icon name={searching ? "loader-circle" : "search"} className={searching ? "ech-ag-spin" : undefined} />
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={
							pictures
								? labels.searchPictures
								: question.total
									? fill(labels.searchAll, { n: question.total, what: searchNoun(ask) })
									: fill(labels.searchSome, { what: searchNoun(ask) })
						}
						aria-label={fill(labels.searchSome, { what: searchNoun(ask) })}
					/>
				</label>
			)}
			{!pictures && (question.allowText || question.options.length === 0) && (
				<label className="ech-ag-q-other">
					<Icon name="square-pen" />
					<input
						type="text"
						value={text}
						maxLength={500}
						onChange={(e) => {
							setText(e.target.value);
							if (e.target.value.trim() && !multiple) setSelected([]);
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter" && canSubmit) {
								e.preventDefault();
								void submit(typed ? { text: typed } : { values: selected });
							}
						}}
						placeholder={labels.typeAnswer}
						aria-label={labels.typeAnswer}
					/>
				</label>
			)}
			<div className="ech-ag-q-foot">
				{question.allowSkip ? (
					<button
						type="button"
						className="ech-ag-button is-ghost is-sm"
						disabled={sending}
						onClick={() => void submit({ skip: true })}
					>
						{pictures ? labels.skipPictures : labels.skip}
					</button>
				) : (
					<span style={{ marginRight: "auto" }} />
				)}
				{ask.next && <span className="ech-ag-q-next">{fill(labels.next, { next: ask.next })}</span>}
				<button
					type="button"
					className="ech-ag-button is-primary is-sm"
					disabled={!canSubmit || uploading > 0}
					onClick={() => void submit(typed ? { text: typed } : { values: selected })}
				>
					{sending && <Icon name="loader-circle" className="ech-ag-spin" size={14} />}
					{pictures && selected.length > 0
						? fill(selected.length === 1 ? labels.useOnePicture : labels.usePictures, { n: selected.length })
						: isLast
							? labels.finish
							: labels.continue}
				</button>
			</div>
		</div>
	);
}

/**
 * Questions already answered (by you, picked by the decision model, or
 * skipped) — one line, several attributes joined: "Fit Oversized · Material
 * 100% cotton". Change asks again.
 */
export function AnsweredRow({
	answers,
	onChange,
	labels: overrides,
}: {
	answers: AnsweredQuestion[];
	onChange?: () => void;
	labels?: Partial<QuestionLabels>;
}) {
	const labels = { ...DEFAULT_QUESTION_LABELS, ...overrides };
	const auto = answers.some((a) => a.source === "auto");
	const allSkipped = answers.every((a) => a.source === "skipped");
	return (
		<div className="ech-ag-answered">
			<Icon name={allSkipped ? "chevron-right" : "check"} />
			<span>
				{answers.map((answer, i) => (
					<span key={answer.questionId}>
						{i > 0 && " · "}
						{answer.label} <b>{answer.source === "skipped" ? labels.skipped : answer.display}</b>
					</span>
				))}
			</span>
			{auto && (
				<span className="ech-ag-auto" title={labels.pickedForYou}>
					<Icon name="sparkles" size={12} />
					{labels.autoTag}
				</span>
			)}
			{onChange && (
				<button type="button" className="ech-ag-edit" onClick={onChange}>
					{labels.change}
				</button>
			)}
		</div>
	);
}
