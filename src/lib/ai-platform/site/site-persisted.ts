import "server-only";

import type { Block, Field } from "payload";
import { Pages } from "@/collections/Pages";

/**
 * What a page save actually keeps: the Payload block's fields. A block schema
 * (zod) may name more (hero overlayOpacity, sectionLabel on most blocks, team
 * socials…); Payload drops those silently on save, so the review card showed a
 * change that never landed. The copilot may only set fields Payload stores.
 */

/** `required`: fields Payload refuses to save empty (a button's label and link…). */
type Shape = { fields: Map<string, Shape | "json" | "value">; required: Set<string> };

function shapeOf(fields: readonly Field[]): Shape {
	const out: Shape = { fields: new Map(), required: new Set() };
	for (const field of fields) {
		const named = "name" in field && typeof field.name === "string" ? field.name : null;
		if (!named) {
			// rows, collapsibles and tabs only lay fields out: their fields belong to the parent
			const nested = "fields" in field && Array.isArray(field.fields) ? field.fields : "tabs" in field && Array.isArray(field.tabs) ? field.tabs.flatMap((tab) => tab.fields) : [];
			const inner = shapeOf(nested);
			for (const [key, value] of inner.fields) out.fields.set(key, value);
			for (const key of inner.required) out.required.add(key);
			continue;
		}
		if (field.type === "json") out.fields.set(named, "json");
		else if ((field.type === "array" || field.type === "group") && "fields" in field) out.fields.set(named, shapeOf(field.fields));
		else out.fields.set(named, "value");
		if ("required" in field && field.required === true) out.required.add(named);
	}
	return out;
}

let blocks: Map<string, Shape> | null = null;

function payloadBlocks(): Map<string, Shape> {
	if (blocks) return blocks;
	const layout = Pages.fields.find((field) => "name" in field && field.name === "layout");
	const list = layout && "blocks" in layout ? (layout.blocks as Block[]) : [];
	blocks = new Map(list.map((block) => [block.slug, shapeOf(block.fields)]));
	return blocks;
}

/**
 * The keys Payload stores at a path of a block type ([] = the block itself,
 * ["features"] = a features row): null when anything is stored there (a JSON
 * field, or a block type Payload doesn't describe).
 */
export function storedKeys(blockType: string, segments: Array<string | number> = []): Set<string> | null {
	let shape: Shape | "json" | "value" | undefined = payloadBlocks().get(blockType);
	if (!shape) return null;
	for (const segment of segments) {
		if (typeof segment === "number") continue;
		if (shape === "json") return null;
		if (shape === "value" || !shape) return new Set();
		shape = shape.fields.get(segment);
	}
	if (shape === "json" || shape === undefined) return shape === "json" ? null : new Set();
	if (shape === "value") return new Set();
	return new Set(shape.fields.keys());
}

const isEmpty = (value: unknown) => value === undefined || value === null || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0);

/**
 * Paths of the fields Payload would refuse to save empty in a section
 * ("ctaButtons.0.url"): the publish fails on them ("CtaButton 1 → url: This
 * field is required."). List rows are checked row by row.
 */
export function missingRequired(blockType: string, block: Record<string, unknown>): string[] {
	const shape = payloadBlocks().get(blockType);
	if (!shape) return [];
	const out: string[] = [];
	const walk = (node: Shape, value: Record<string, unknown>, prefix: string) => {
		for (const key of node.required) if (isEmpty(value[key])) out.push(`${prefix}${key}`);
		for (const [key, child] of node.fields) {
			if (typeof child === "string") continue;
			const inner = value[key];
			if (Array.isArray(inner)) inner.forEach((row, i) => row && typeof row === "object" && walk(child, row as Record<string, unknown>, `${prefix}${key}.${i}.`));
			else if (inner && typeof inner === "object") walk(child, inner as Record<string, unknown>, `${prefix}${key}.`);
		}
	};
	walk(shape, block, "");
	return out;
}
