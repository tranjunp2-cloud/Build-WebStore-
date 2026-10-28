import type { SitePrepareKind } from "../shop/shop-tools";

/**
 * The language on the web editor's canvas, from the message's pin
 * (`filters.editingLanguage`, set by the editor). prime-web reads and drafts
 * page text in it, so an edit lands on the text the merchant is looking at.
 * It travels beside the model's input, never inside it: the model can't set it.
 */
export function editingLanguageOf(pin: { module?: string; filters?: Record<string, string> } | null | undefined): string | undefined {
	if (pin?.module !== "editor") return undefined;
	const language = pin.filters?.editingLanguage?.trim();
	return language && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/i.test(language) ? language : undefined;
}

/** Drafts that change page text: one page, or several pages at once. */
const TEXT_EDIT_KINDS: ReadonlySet<SitePrepareKind> = new Set<SitePrepareKind>(["patch", "pages"]);

export function prepareWithLanguage(kind: SitePrepareKind, input: Record<string, unknown>, language: string | undefined): Record<string, unknown> {
	return language && TEXT_EDIT_KINDS.has(kind) ? { ...input, language } : input;
}

/** Reads that return page text (the page's sections, one section in full). */
export function readWithLanguage(input: Record<string, unknown>, language: string | undefined): Record<string, unknown> {
	return language && (input.view === "page" || input.view === "block") ? { ...input, language } : input;
}
