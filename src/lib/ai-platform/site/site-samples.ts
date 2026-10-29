import type { PageBlock } from "./site-blocks";
import type { PictureSpot } from "./site-shown";

/**
 * Sample pictures: what a block shows where the merchant has no picture yet
 * (industry stock, placeholders), per block type — read from each block's
 * component. Without this the copilot sees an empty field where the merchant
 * sees a picture.
 */

export type SampleRule = {
	/** what an empty single-picture field at this path shows (a sample, or a stand-in like initials), or null = nothing */
	emptyField?: (path: string, block: PageBlock) => { source: "sample" | "empty"; now: string } | null;
	/** the block's pictures, when its own rule differs from the generic field walk */
	spots?: (block: PageBlock) => PictureSpot[];
	note?: string;
	/** sample TEXT the block shows while its list is empty (made-up features, numbers, plans…), or null */
	sampleText?: (block: PageBlock) => string | null;
};

const empty = (block: PageBlock, ...keys: string[]) => keys.every((key) => rows(block[key]).length === 0);

/** A stored picture: a media id, a populated upload ({ id, url }) or a URL. */
export function hasPicture(value: unknown): boolean {
	if (typeof value === "number") return value > 0;
	if (typeof value === "string") return /^\d+$/.test(value) || /^(https?:)?\/\//.test(value) || value.startsWith("/");
	if (value && typeof value === "object" && !Array.isArray(value)) {
		const record = value as Record<string, unknown>;
		return Boolean(record.id ?? record.url);
	}
	return false;
}

/** The merchant's words for a stored picture (its media id is named later from the media library). */
export function pictureName(value: unknown): string {
	if (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))) return `your picture (media ${value})`;
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		const label = [record.alt, record.filename].find((v) => typeof v === "string" && v.trim());
		return `your picture${label ? ` “${String(label).slice(0, 60)}”` : record.id ? ` (media ${record.id})` : ""}`;
	}
	return "your picture";
}

const rows = (value: unknown): Array<Record<string, unknown> | null> => (Array.isArray(value) ? (value as Array<Record<string, unknown> | null>) : []);

/** A list of { image, caption } rows that falls back per slot (a gallery): no rows at all = `count` samples. */
function pictureList(path: string, count: number, what: string): (block: PageBlock) => PictureSpot[] {
	return (block) => {
		const list = rows(block[path]);
		const slots = list.length > 0 ? list.length : count;
		return Array.from({ length: slots }, (_, i) => {
			const row = list[i];
			const where = `${path}.${i}.image`;
			if (row && hasPicture(row.image)) return { where, source: "own" as const, now: pictureName(row.image), change: `set_image path "${where}", or set_pictures path "${path}" for the whole list` };
			return {
				where,
				source: "sample" as const,
				now: `a sample picture (${what})`,
				change: row ? `set_image path "${where}", or set_pictures path "${path}" for the whole list` : `set_pictures path "${path}" (the whole list, in order)`,
			};
		});
	};
}

/**
 * A list of items with a picture each (carousel slides, portfolio projects): an item without a picture
 * shows a sample; no items at all = `count` sample items, which have no stored row to target.
 */
function itemList(path: string, key: string, count: number): (block: PageBlock) => PictureSpot[] {
	return (block) => {
		const list = rows(block[path]);
		if (list.length === 0) {
			return Array.from({ length: count }, (_, i) => ({
				where: `sample ${i + 1}`,
				source: "sample" as const,
				now: "a sample picture (industry stock): the section has no items yet",
				change: `edit_list path "${path}" with new items (their text), then set_image path "${path}.N.${key}" for each in a second change`,
			}));
		}
		return list.map((row, i) => {
			const where = `${path}.${i}.${key}`;
			return hasPicture(row?.[key])
				? { where, source: "own" as const, now: pictureName(row?.[key]), change: `set_image path "${where}"` }
				: { where, source: "sample" as const, now: "a sample picture (industry stock)", change: `set_image path "${where}"` };
		});
	};
}

const SAMPLE_PHOTO = { source: "sample", now: "a sample photo (industry stock)" } as const;

/** Hero variants that show an industry photo while `image` is empty (centered, fullscreen, minimal, gradient don't). */
const HERO_SAMPLE_VARIANTS = new Set(["split-left", "split-right", "cards-overlay", "magazine", "parallax", "video", "slideshow", "split-video"]);

const RULES: Record<string, SampleRule> = {
	gallery: { spots: pictureList("images", 6, "industry stock"), note: "A gallery slot without a picture of its own shows a sample picture; with no pictures at all it shows 6 samples." },
	hero: {
		emptyField: (path, block) => (path === "image" && HERO_SAMPLE_VARIANTS.has(String(block.variant)) ? SAMPLE_PHOTO : null),
		note: "backgroundImage is not shown by any hero style; the picture is image (slides.N.image in the slideshow).",
	},
	about: { emptyField: (path, block) => (path === "image" && ["split", "image-overlay"].includes(String(block.variant)) ? SAMPLE_PHOTO : null) },
	testimonials: { emptyField: (path, block) => (/^testimonials\.\d+\.avatar$/.test(path) && block.variant !== "simple" ? { source: "sample", now: "a sample portrait (stock)" } : null) },
	team: {
		emptyField: (path) => (/^members\.\d+\.image$/.test(path) ? { source: "empty", now: "initials instead of a photo" } : null),
		sampleText: (block) => (empty(block, "members") ? "3 made-up members (Team Lead, Senior Specialist, Customer Success)" : null),
	},
	features: { sampleText: (block) => (empty(block, "features") ? "4 made-up features in English (Quality Service, Fast Response, Premium Experience, Trusted & Reliable)" : null) },
	faq: { sampleText: (block) => (empty(block, "faqs", "items") ? "4 made-up questions and answers" : null) },
	stats: { sampleText: (block) => (empty(block, "stats") ? "made-up numbers (500+ Happy Customers, 10+ Years, 4.9★)" : null) },
	pricing: { sampleText: (block) => (empty(block, "plans") && ["cards", "table", "horizontal", "tiered", "comparison", undefined].includes(block.variant as string | undefined) ? "3 made-up plans (Starter RM 99, Pro RM 299, Enterprise)" : null) },
	carousel: { spots: itemList("items", "image", 6) },
	"portfolio-grid": { spots: itemList("projects", "image", 6) },
};

export function sampleRule(blockType: string): SampleRule | undefined {
	return RULES[blockType];
}

/** The made-up text a section shows instead of the merchant's, said so the copilot can offer to replace it. */
export function sampleText(block: PageBlock): string | null {
	const text = RULES[String(block.blockType ?? "")]?.sampleText?.(block);
	return text ? `Shows ${text} because its list is empty: visitors see them as real. Replace them with the merchant's own (edit_list with new items), or remove the section.` : null;
}
