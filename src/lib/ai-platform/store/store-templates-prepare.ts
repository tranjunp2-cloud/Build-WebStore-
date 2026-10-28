import "server-only";

import { CONTENT_FIELD_LIMITS } from "@/app/(dashboard)/settings/email-templates/validate-content-fields";
import type { TemplateRowSnapshot } from "@/lib/email/template-settings-service";
import { EMAIL_TEMPLATE_VARIABLES, type EmailTemplateType } from "@/lib/email/types";
import type { PreparedSiteChange } from "../site/site-prepare";
import { contentOf, effectiveText, FIELD_WORDS, fixedFields, isCustomisable, LOCALE_WORDS, recipientOf, rowKey, sampleSubject, TEMPLATE_FIELDS, type TemplateField, type TemplateLocale, type TemplateText, templateLabel } from "./store-email-templates";

/**
 * Drafts the email-template steps of a customer card: edit the wording of one language of an email (subject,
 * greeting, button, closing), switch it on / off, or put the built-in text back. The wording is plain text:
 * the email escapes it, and only the `{variables}` the template lists are filled in.
 */

export type Refusal = { error: { code: string; message: string } };
export const refuse = (code: string, message: string): Refusal => ({ error: { code, message } });

/** The templates as the card's steps leave them (null = on the built-in text). */
export type TemplateState = Map<string, TemplateRowSnapshot | null>;

export type TemplateStep =
	| { op: "template_edit"; templateType: string; locale: TemplateLocale; subject?: string | null; greeting?: string | null; ctaLabel?: string | null; closing?: string | null; enabled?: boolean | null }
	| { op: "template_reset"; templateType: string };

export type PlannedTemplateStep =
	| { op: "template_save"; templateType: EmailTemplateType; enabled: boolean; contentEn: TemplateText; contentMs: TemplateText }
	| { op: "template_reset"; templateType: EmailTemplateType };

type Diff = PreparedSiteChange["diffs"][number];
const BLANK_NOTE = "(built-in text)";

const unknownVariables = (type: EmailTemplateType, text: string) => {
	const allowed = new Set<string>(EMAIL_TEMPLATE_VARIABLES[type]);
	return [...new Set([...text.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]!))].filter((name) => !allowed.has(name));
};

/** Plain text only: the email escapes markup, so a tag would show up as text. */
const looksLikeMarkup = (text: string) => /<\s*\/?\s*[a-z!][^>]*>/i.test(text);

const rowOf = (type: EmailTemplateType, enabled: boolean, en: TemplateText, ms: TemplateText, old: TemplateRowSnapshot | null): TemplateRowSnapshot => ({ id: old?.id ?? "new", enabled, contentEn: en, contentMs: ms, updatedAt: old?.updatedAt ?? "" });

/** The wording a row shows in one language, "(built-in text)" where nothing is shown. */
const shown = (row: TemplateRowSnapshot | null, type: EmailTemplateType, locale: TemplateLocale, field: TemplateField) => {
	const t = effectiveText(row, type, locale)[field];
	return t.text ?? BLANK_NOTE;
};

export function templateLabelFor(type: EmailTemplateType) {
	return `${templateLabel(type)} email`;
}

/** One template step, simulated on `state`; pushes its card lines and its planned step. Returns a refusal or null. */
export function draftTemplateStep(
	step: TemplateStep,
	state: TemplateState,
	out: { diffs: Diff[]; steps: PlannedTemplateStep[]; notes: string[]; touched: Set<EmailTemplateType> },
	plan: { canEdit: boolean },
): Refusal | null {
	if (!isCustomisable(step.templateType)) return refuse("unknown_template", `templateType ${step.templateType} can't be customised (read store_customers view email_templates for the list).`);
	const type = step.templateType;
	const key = rowKey(type);
	const old = state.get(key) ?? null;
	const entity = { kind: "email_template", id: type, label: templateLabelFor(type) };
	const sendsTo = recipientOf(type) === "buyer" ? "buyers" : "you";

	if (step.op === "template_reset") {
		if (!old) {
			out.notes.push(`${templateLabelFor(type)} already uses the built-in text.`);
			return null;
		}
		out.diffs.push({ entity, field: "Wording", before: "The shop's own wording", after: "Built-in text again (both languages, and sending switched on)" });
		state.set(key, null);
		out.steps.push({ op: "template_reset", templateType: type });
		out.touched.add(type);
		return null;
	}

	if (!plan.canEdit) return refuse("plan", "Editing email templates is not part of this shop's plan.");
	const fixed = fixedFields(type);
	const given = TEMPLATE_FIELDS.filter((f) => step[f] != null);
	const blocked = given.filter((f) => fixed.includes(f));
	if (blocked.length > 0) return refuse("fixed_text", `${blocked.map((f) => FIELD_WORDS[f]).join(", ")} of the ${templateLabel(type)} email is fixed text: saving it changes nothing. ${fixed.length === TEMPLATE_FIELDS.length ? "This email can't be reworded." : "Edit the other fields."}`);
	if (given.length === 0 && step.enabled == null) return refuse("invalid_input", `${templateLabel(type)}: give at least one field to change, or enabled.`);

	const before = old;
	const enText: TemplateText = { ...contentOf(old, "en") };
	const msText: TemplateText = { ...contentOf(old, "ms") };
	const text = step.locale === "en" ? enText : msText;
	const lines: Diff[] = [];
	for (const field of given) {
		const value = step[field]!.trim();
		if (value) {
			if (value.length > CONTENT_FIELD_LIMITS[field]) return refuse("too_long", `${FIELD_WORDS[field]} of ${templateLabel(type)} is ${value.length} characters (at most ${CONTENT_FIELD_LIMITS[field]}).`);
			if (looksLikeMarkup(value)) return refuse("plain_text", `${FIELD_WORDS[field]} of ${templateLabel(type)}: plain text only, no HTML tags.`);
			const unknown = unknownVariables(type, value);
			if (unknown.length > 0) return refuse("unknown_variable", `${FIELD_WORDS[field]} of ${templateLabel(type)} uses ${unknown.map((u) => `{${u}}`).join(", ")}; allowed: ${EMAIL_TEMPLATE_VARIABLES[type].map((v) => `{${v}}`).join(", ")}.`);
			text[field] = value;
		} else {
			delete text[field];
		}
	}
	const enabled = step.enabled ?? old?.enabled ?? true;
	const after = rowOf(type, enabled, enText, msText, old);

	for (const field of given) {
		const was = shown(before, type, step.locale, field);
		const now = shown(after, type, step.locale, field);
		if (was !== now) lines.push({ entity, field: `${LOCALE_WORDS[step.locale]} · ${FIELD_WORDS[field]}`, before: was, after: step[field]!.trim() ? now : `${now === BLANK_NOTE ? BLANK_NOTE : now} (built-in)` });
	}
	if (given.includes("subject")) {
		const was = sampleSubject(type, step.locale, contentOf(before, step.locale), before?.enabled ?? true);
		const now = sampleSubject(type, step.locale, contentOf(after, step.locale), enabled);
		if (now && was !== now) lines.push({ entity, field: `${LOCALE_WORDS[step.locale]} · Sample subject`, before: was, after: now });
	}
	if (enabled !== (old?.enabled ?? true)) lines.push({ entity, field: "Sending", before: old?.enabled === false ? "Off" : "On", after: enabled ? `On (${sendsTo} get it)` : `Off (${sendsTo} won't get it)` });
	if (lines.length === 0) {
		out.notes.push(`${templateLabelFor(type)} already says that.`);
		return null;
	}
	out.diffs.push(...lines);
	state.set(key, after);
	out.steps.push({ op: "template_save", templateType: type, enabled, contentEn: enText, contentMs: msText });
	out.touched.add(type);
	return null;
}
