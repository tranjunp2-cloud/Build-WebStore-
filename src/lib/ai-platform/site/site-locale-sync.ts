import { blockHash, blockIdOf, type PageBlock } from "./site-blocks";
import type { LocaleContent } from "./site-seo-translate";

/**
 * The editor keeps a copy of the base language in `locale_content[section][base]`
 * (an edit in the base language writes the section AND that slot, and the slot
 * wins on the canvas). A copilot edit writes only the section, so the slot kept
 * the old text: the editor showed it while Preview showed the new one.
 *
 * After a page draft changes, every field of the base slot whose section value
 * changed takes the new value. Fields the slot does not hold and the other
 * languages' slots (real translations) are left alone. Undo runs through the
 * same write, so it puts the slot back with the section.
 *
 * Returns the new content, or null when nothing changed.
 */
export function syncBaseLocaleSlots(
	content: LocaleContent,
	baseLocale: string,
	before: readonly PageBlock[],
	after: readonly PageBlock[],
): LocaleContent | null {
	const previous = new Map(before.map((block, index) => [blockIdOf(block, index), block]));
	let next: LocaleContent | null = null;
	after.forEach((block, index) => {
		const id = blockIdOf(block, index);
		const slot = content[id]?.[baseLocale];
		const old = previous.get(id);
		if (!slot || !old || blockHash(old) === blockHash(block)) return;
		const changed = Object.keys(slot).filter((key) => blockHash(old[key] ?? null) !== blockHash(block[key] ?? null));
		if (changed.length === 0) return;
		const synced = { ...slot };
		for (const key of changed) {
			if (block[key] === undefined) delete synced[key];
			else synced[key] = block[key];
		}
		next ??= { ...content };
		next[id] = { ...content[id], [baseLocale]: synced };
	});
	return next;
}
