import type { ContextElement } from '@ech/agent-core'
import { editorBlockId } from './editor-agent-context'

/**
 * The element the merchant asks AI about, as the chat carries it: its kind,
 * the section (`editorBlockId`), the field path inside it and what it says now.
 */

const LABEL_MAX = 40

/** Text as the merchant reads it: tags dropped, spaces collapsed, cut with "…". */
export function plainLabel(value: unknown, max = LABEL_MAX): string {
    const text = String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/** "products-featured" → "Products featured" */
export function blockTypeLabel(blockType: string): string {
    const words = blockType.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').trim().toLowerCase()
    return words ? words[0]!.toUpperCase() + words.slice(1) : 'Section'
}

/** A label inside a button list (ctaButtons.0.label, primaryButton.text…) is a button, the rest is text. */
const BUTTON_PATH = /(^|\.)(cta\w*|\w*buttons?|\w*Button\w*|btn\w*)(\.|$)/i

type Block = { blockType?: string } & Record<string, unknown>

/**
 * Payload page ids reach the editor as numbers (typed string): the chat's
 * schema takes strings only, so a number made the message fail with
 * "expected string, received number".
 */
type PageRef = string | number | null | undefined
const pageRef = (pageId: PageRef) => (pageId === null || pageId === undefined || pageId === '' ? {} : { pageId: String(pageId) })

export function textElement(input: {
    block: Block
    blockIndex: number
    fieldPath: Array<string | number> | null
    value: unknown
    pageId: PageRef
}): ContextElement {
    const path = input.fieldPath?.length ? input.fieldPath.join('.') : undefined
    const value = plainLabel(input.value, 300)
    return {
        kind: path && BUTTON_PATH.test(path) ? 'button' : 'text',
        label: plainLabel(input.value) || blockTypeLabel(String(input.block.blockType ?? '')),
        ...pageRef(input.pageId),
        blockId: editorBlockId(input.block, input.blockIndex),
        ...(path ? { path } : {}),
        ...(value ? { value } : {}),
    }
}

const HEADLINE_KEYS = ['headline', 'title', 'heading']

export function sectionElement(input: { block: Block; blockIndex: number; pageId: PageRef }): ContextElement {
    const headline = HEADLINE_KEYS.map((key) => input.block[key]).find((value) => typeof value === 'string' && value.trim())
    return {
        kind: 'section',
        label: blockTypeLabel(String(input.block.blockType ?? '')),
        ...pageRef(input.pageId),
        blockId: editorBlockId(input.block, input.blockIndex),
        ...(headline ? { value: plainLabel(headline, 300) } : {}),
    }
}

const UPLOAD_FIELDS = new Set(['image', 'backgroundImage', 'logo', 'avatar', 'ogImage', 'posterImage', 'thumbnail'])

export function imageElement(input: {
    block: Block
    blockIndex: number
    /** where the picture's address was found in the section, if it was */
    fieldPath: Array<string | number> | null
    src: string
    alt?: string
    pageId: PageRef
}): ContextElement {
    // ['items', 2, 'image', 'url'] → items.2.image (the picture field, not its address)
    const segments = input.fieldPath ?? []
    const upload = segments.findIndex((segment) => typeof segment === 'string' && UPLOAD_FIELDS.has(segment))
    const path = (upload >= 0 ? segments.slice(0, upload + 1) : segments).join('.') || undefined
    const name = (() => {
        try {
            return decodeURIComponent(new URL(input.src, 'https://x.invalid').pathname.split('/').pop() ?? '')
        } catch {
            return ''
        }
    })()
    return {
        kind: 'image',
        label: plainLabel(input.alt || name || blockTypeLabel(String(input.block.blockType ?? ''))),
        ...pageRef(input.pageId),
        blockId: editorBlockId(input.block, input.blockIndex),
        ...(path ? { path } : {}),
        value: input.src.slice(0, 300),
    }
}
