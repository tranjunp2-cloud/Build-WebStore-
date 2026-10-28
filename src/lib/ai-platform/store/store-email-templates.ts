import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";
import { getDefaultContentFields } from "@/lib/email/template-default-fields";
import { planAllowsTemplates, toSnapshot, type TemplateRowSnapshot } from "@/lib/email/template-settings-service";
import { templateRegistry } from "@/lib/email/template-registry";
import { EMAIL_PREVIEW_FIXTURES } from "@/lib/email/preview-fixtures";
import { EMAIL_TEMPLATE_RECIPIENTS, EMAIL_TEMPLATE_TYPES, EMAIL_TEMPLATE_VARIABLES, type EmailRecipient, type EmailTemplateType } from "@/lib/email/types";
import type { AgentActor } from "../context";

/**
 * The shop's email templates for the copilot (Settings → Email templates): what each email says now (the
 * shop's own wording or the built-in text), the built-in text, the `{variables}` it may use. The draft and the
 * applier share the words and the field rules from here.
 */

export type TemplateLocale = "en" | "ms";
export const TEMPLATE_FIELDS = ["subject", "greeting", "ctaLabel", "closing"] as const;
export type TemplateField = (typeof TEMPLATE_FIELDS)[number];
export type TemplateText = Partial<Record<TemplateField, string>>;

/** The emails a shop can customise: the ones with a reader (sign-in, password and invitation emails are platform-managed). */
export const CUSTOMISABLE_TEMPLATES: readonly EmailTemplateType[] = EMAIL_TEMPLATE_TYPES.filter((t) => EMAIL_TEMPLATE_RECIPIENTS[t].length > 0);

export const TEMPLATE_LABELS: Partial<Record<EmailTemplateType, string>> = {
	"order-confirmation": "Order confirmation",
	"order-completed": "Order completed",
	"order-cancelled": "Order cancelled",
	"order-expired": "Order expired",
	"order-refunded": "Order refunded",
	"bank-transfer-instructions": "Bank transfer instructions",
	"payment-confirmed": "Payment confirmed",
	"payment-rejected": "Payment rejected",
	"order-waiting": "Waiting for payment",
	"new-order-seller": "New order (to you)",
	"contact-from-seller": "New enquiry (to you)",
	"newsletter-seller-digest": "New subscriber (to you)",
};

export const templateLabel = (type: EmailTemplateType) => TEMPLATE_LABELS[type] ?? type;
export const recipientOf = (type: EmailTemplateType): EmailRecipient => EMAIL_TEMPLATE_RECIPIENTS[type][0] ?? "buyer";
export const isCustomisable = (value: string): value is EmailTemplateType => (CUSTOMISABLE_TEMPLATES as readonly string[]).includes(value);

/** Fields the template shows from fixed text whatever is saved (the footer of the owner emails; the whole "waiting for payment" email). */
export function fixedFields(type: EmailTemplateType): readonly TemplateField[] {
	if (type === "order-waiting") return TEMPLATE_FIELDS;
	if (type === "new-order-seller" || type === "contact-from-seller" || type === "newsletter-seller-digest") return ["closing"];
	return [];
}

export const LOCALE_WORDS: Record<TemplateLocale, string> = { en: "English", ms: "Bahasa Malaysia" };
export const FIELD_WORDS: Record<TemplateField, string> = { subject: "Subject", greeting: "Greeting", ctaLabel: "Button", closing: "Closing" };

export const contentOf = (row: TemplateRowSnapshot | null, locale: TemplateLocale): TemplateText => (locale === "en" ? row?.contentEn : row?.contentMs) ?? {};

/** What one language of the email says now: the shop's own wording, else the built-in text (null where there is none to show). */
export function effectiveText(row: TemplateRowSnapshot | null, type: EmailTemplateType, locale: TemplateLocale): Record<TemplateField, { text: string | null; custom: boolean }> {
	const own = contentOf(row, locale);
	const base = getDefaultContentFields(type, locale);
	return Object.fromEntries(TEMPLATE_FIELDS.map((f) => [f, own[f] ? { text: own[f]!, custom: true } : { text: base[f] ?? null, custom: false }])) as Record<TemplateField, { text: string | null; custom: boolean }>;
}

/** The subject a sample order would get with this wording (the preview route's own renderer), or null. */
export function sampleSubject(type: EmailTemplateType, locale: TemplateLocale, content: TemplateText, enabled = true): string | null {
	try {
		const fixture = { ...EMAIL_PREVIEW_FIXTURES[type], locale };
		return templateRegistry[type](fixture, { enabled, ...content }).subject;
	} catch {
		return null;
	}
}

type Cms = Awaited<ReturnType<typeof getPayload>>;

/** Every saved row of the workspace, by "type:recipient". */
export async function tenantTemplateRows(cms: Cms, tenantId: string): Promise<Map<string, TemplateRowSnapshot>> {
	const result = await cms.find({ collection: "email-template-settings", where: { tenant: { equals: tenantId } }, limit: 100, depth: 0, overrideAccess: true });
	return new Map((result.docs as unknown as Array<Record<string, unknown>>).map((d) => [`${d.templateType}:${d.recipient}`, toSnapshot(d)]));
}

export const rowKey = (type: EmailTemplateType) => `${type}:${recipientOf(type)}`;

const customised = (row: TemplateRowSnapshot | undefined) => Boolean(row && (Object.keys(row.contentEn).length > 0 || Object.keys(row.contentMs).length > 0));

export async function readEmailTemplates(actor: AgentActor) {
	const cms = await getPayload({ config });
	const [rows, canEdit] = await Promise.all([tenantTemplateRows(cms, actor.tenantId), planAllowsTemplates(cms, actor.tenantId).catch(() => false)]);
	return {
		note: "The emails this shop sends that it may reword. Each uses its built-in text until the shop saves its own. Change them with propose_store_customers (op template_edit / template_reset).",
		canEdit,
		...(canEdit ? {} : { planNote: "Editing email templates is not part of this shop's plan, so a change would be refused." }),
		templates: CUSTOMISABLE_TEMPLATES.map((type) => {
			const row = rows.get(rowKey(type));
			return { templateType: type, label: templateLabel(type), sentTo: recipientOf(type) === "buyer" ? "the buyer" : "the shop owner", enabled: row?.enabled ?? true, customised: customised(row) };
		}),
	};
}

export async function readEmailTemplate(actor: AgentActor, type: string) {
	if (!isCustomisable(type)) return { error: { code: "unknown_template", message: `templateType: one of ${CUSTOMISABLE_TEMPLATES.join(", ")}.` } };
	const cms = await getPayload({ config });
	const row = (await tenantTemplateRows(cms, actor.tenantId)).get(rowKey(type)) ?? null;
	const text = (locale: TemplateLocale) => {
		const now = effectiveText(row, type, locale);
		const base = getDefaultContentFields(type, locale);
		return Object.fromEntries(TEMPLATE_FIELDS.map((f) => [f, { now: now[f].text, custom: now[f].custom, builtIn: base[f] ?? null }]));
	};
	const fixed = fixedFields(type);
	return {
		note: "Plain text only (no HTML). Keep any {variable} exactly as written; only the listed ones work. Empty / null means the built-in text is used.",
		template: {
			templateType: type,
			label: templateLabel(type),
			sentTo: recipientOf(type) === "buyer" ? "the buyer" : "the shop owner",
			enabled: row?.enabled ?? true,
			customised: customised(row ?? undefined),
			allowedVariables: EMAIL_TEMPLATE_VARIABLES[type].map((v) => `{${v}}`),
			...(fixed.length > 0 ? { fixedFields: fixed, fixedNote: "These fields are fixed text in the email: saving them changes nothing." } : {}),
			english: text("en"),
			bahasaMalaysia: text("ms"),
			sampleSubject: { en: sampleSubject(type, "en", contentOf(row, "en"), row?.enabled ?? true), ms: sampleSubject(type, "ms", contentOf(row, "ms"), row?.enabled ?? true) },
		},
	};
}
