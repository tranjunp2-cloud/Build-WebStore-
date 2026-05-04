'use client'

/**
 * block-schema-inspector.tsx
 * Schema & fields tab — renders real Zod-introspected field table.
 * Phase P2: replaces name-heuristic inferType() with FieldMeta[] from
 * block-schema-registry.ts. Shows type, required, validation rules, description.
 *
 * Styled to match design bundle builder-block-detail.jsx schema tab.
 */
import { useState } from 'react'
import type { FieldMeta } from '@/lib/admin/block-schema-registry'

type Props = {
    editableFields: string[]
    blockSlug: string
    defaultVariant: string
    variants: string[]
    /** Real Zod-introspected fields (Phase P2). Empty = schema not available. */
    fields?: FieldMeta[]
}

export function BlockSchemaInspector({ editableFields, blockSlug, defaultVariant, variants, fields = [] }: Props) {
    const hasRealFields = fields.length > 0

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Description */}
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
                Schema cho block{' '}
                <strong style={{ color: 'var(--text)' }}>{blockSlug}</strong> — source:{' '}
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>src/blocks/{blockSlug}/config.ts</span>
                {hasRealFields && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--accent)' }}>
                        ✓ Zod introspection
                    </span>
                )}
            </p>

            {/* Copy buttons */}
            {hasRealFields && (
                <CopyButtons blockSlug={blockSlug} fields={fields} />
            )}

            {/* Fields table */}
            {hasRealFields ? (
                <ZodFieldTable fields={fields} />
            ) : editableFields.length > 0 ? (
                <LegacyFieldTable editableFields={editableFields} />
            ) : (
                <p className="muted" style={{ fontSize: 13 }}>
                    No schema defined for this block.{' '}
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        Add <code>export const configSchema</code> to{' '}
                        <code>src/blocks/{blockSlug}/config.ts</code>
                    </span>
                </p>
            )}

            {/* Variants list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="b-group-title">Variants</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {variants.map((v) => (
                        <span
                            key={v}
                            className={v === defaultVariant ? 'b-pill-ai' : 'b-pill-manual'}
                            style={{ cursor: 'default' }}
                        >
                            {v}
                            {v === defaultVariant && (
                                <span style={{ marginLeft: 4, opacity: 0.7, fontSize: 9 }}>default</span>
                            )}
                        </span>
                    ))}
                </div>
            </div>

            {/* Raw registry snapshot */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="b-group-title">Registry Snapshot</div>
                <pre
                    className="scroll-thin"
                    style={{
                        borderRadius: 8,
                        background: 'var(--bg-sunk)',
                        border: '1px solid var(--border)',
                        padding: 12,
                        fontSize: 11,
                        color: 'var(--text-2)',
                        overflow: 'auto',
                        maxHeight: 180,
                        fontFamily: 'var(--mono)',
                        lineHeight: 1.5,
                        margin: 0,
                    }}
                >
                    {JSON.stringify({
                        blockSlug,
                        defaultVariant,
                        variantCount: variants.length,
                        fieldCount: hasRealFields ? fields.length : editableFields.length,
                        source: hasRealFields ? 'zod-introspection' : 'registry-heuristic',
                    }, null, 2)}
                </pre>
            </div>
        </div>
    )
}

// ── Zod field table ───────────────────────────────────────────────────────────

function ZodFieldTable({ fields }: { fields: FieldMeta[] }) {
    return (
        <table className="b-schema-table">
            <thead>
                <tr>
                    <th style={{ width: '22%' }}>Field</th>
                    <th style={{ width: '18%' }}>Type</th>
                    <th style={{ width: '12%' }}>Required</th>
                    <th>Rules / Description</th>
                </tr>
            </thead>
            <tbody>
                {fields.map((f) => (
                    <tr key={f.name}>
                        <td><span className="key">{f.name}</span></td>
                        <td><TypePill field={f} /></td>
                        <td>
                            {f.required ? (
                                <span className="b-pill-ai">required</span>
                            ) : (
                                <span className="b-pill-manual">optional</span>
                            )}
                        </td>
                        <td>
                            <RulesCell field={f} />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

function TypePill({ field }: { field: FieldMeta }) {
    const label = field.type === 'array' && field.itemType
        ? `array<${field.itemType}>`
        : field.type
    return <span className="ztype">{label}</span>
}

function RulesCell({ field }: { field: FieldMeta }) {
    const rules: string[] = []
    if (field.minLength != null) rules.push(`min: ${field.minLength}`)
    if (field.maxLength != null) rules.push(`max: ${field.maxLength}`)
    if (field.min != null) rules.push(`min: ${field.min}`)
    if (field.max != null) rules.push(`max: ${field.max}`)
    if (field.nullable) rules.push('nullable')

    return (
        <div>
            {field.description && (
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
                    {field.description}
                </div>
            )}
            {field.enumValues && field.enumValues.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>
                    one of: {field.enumValues.join(', ')}
                </div>
            )}
            {rules.length > 0 && (
                <div className="hint">{rules.join(', ')}</div>
            )}
            {!field.description && rules.length === 0 && !field.enumValues && (
                <div className="hint">—</div>
            )}
        </div>
    )
}

// ── Legacy fallback table (heuristic, pre-P2) ─────────────────────────────────

const REQUIRED_KEYS = new Set(['headline', 'message', 'videoUrl', 'address', 'email', 'phone'])

function inferTypeLegacy(field: string): string {
    if (field.includes('url') || field.includes('Url') || field.includes('image') || field.includes('Image')) return 'string (url)'
    if (field.includes('count') || field.includes('Count') || field.includes('num') || field.includes('Num')) return 'number'
    if (field.includes('show') || field.includes('Show') || field.includes('enabled') || field.includes('visible')) return 'boolean'
    if (field.includes('items') || field.includes('Items') || field.includes('list') || field.includes('List') || field.includes('buttons') || field.includes('links')) return 'array'
    return 'string'
}

function LegacyFieldTable({ editableFields }: { editableFields: string[] }) {
    return (
        <>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>
                Schema source: registry heuristic (configSchema not yet exported from this block).
            </p>
            <table className="b-schema-table">
                <thead>
                    <tr>
                        <th style={{ width: '22%' }}>Field key</th>
                        <th style={{ width: '20%' }}>Type</th>
                        <th>Label / description</th>
                        <th style={{ width: '12%' }}>Required</th>
                    </tr>
                </thead>
                <tbody>
                    {editableFields.map((field) => (
                        <tr key={field}>
                            <td><span className="key">{field}</span></td>
                            <td><span className="ztype">{inferTypeLegacy(field)}</span></td>
                            <td>
                                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>
                                    {fieldLabel(field)}
                                </div>
                                <div className="hint">Exposed to AI editor · Inspector Content tab</div>
                            </td>
                            <td>
                                {REQUIRED_KEYS.has(field) ? (
                                    <span className="b-pill-ai">required</span>
                                ) : (
                                    <span className="b-pill-manual">optional</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    )
}

// ── Copy buttons ──────────────────────────────────────────────────────────────

function CopyButtons({ blockSlug, fields }: { blockSlug: string; fields: FieldMeta[] }) {
    const [copied, setCopied] = useState<'json' | 'ts' | null>(null)

    function buildSampleJson(): string {
        const sample: Record<string, unknown> = {}
        for (const f of fields) {
            if (f.type === 'string' || f.type === 'url') sample[f.name] = ''
            else if (f.type === 'number') sample[f.name] = 0
            else if (f.type === 'boolean') sample[f.name] = false
            else if (f.type === 'array') sample[f.name] = []
            else if (f.type === 'object') sample[f.name] = {}
            else if (f.type === 'enum' && f.enumValues?.[0]) sample[f.name] = f.enumValues[0]
            else sample[f.name] = null
        }
        return JSON.stringify(sample, null, 2)
    }

    function buildTsType(): string {
        const typeName = blockSlug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
        const lines = fields.map((f) => {
            const opt = f.optional ? '?' : ''
            const tsType = f.type === 'string' || f.type === 'url' ? 'string'
                : f.type === 'number' ? 'number'
                : f.type === 'boolean' ? 'boolean'
                : f.type === 'array' ? `${f.itemType ?? 'unknown'}[]`
                : f.type === 'object' ? 'Record<string, unknown>'
                : f.type === 'enum' && f.enumValues ? f.enumValues.map((v) => `'${v}'`).join(' | ')
                : 'unknown'
            return `  ${f.name}${opt}: ${f.nullable ? `${tsType} | null` : tsType}`
        })
        return `export type ${typeName[0]!.toUpperCase()}${typeName.slice(1)}Config = {\n${lines.join('\n')}\n}`
    }

    async function copyText(text: string, kind: 'json' | 'ts') {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(kind)
            setTimeout(() => setCopied(null), 1500)
        } catch { /* ignore */ }
    }

    return (
        <div style={{ display: 'flex', gap: 8 }}>
            <button
                className="b-btn ghost"
                style={{ height: 28, padding: '0 10px', fontSize: 11 }}
                onClick={() => copyText(buildSampleJson(), 'json')}
            >
                {copied === 'json' ? '✓ Copied' : 'Copy JSON'}
            </button>
            <button
                className="b-btn ghost"
                style={{ height: 28, padding: '0 10px', fontSize: 11 }}
                onClick={() => copyText(buildTsType(), 'ts')}
            >
                {copied === 'ts' ? '✓ Copied' : 'Copy TS type'}
            </button>
        </div>
    )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fieldLabel(key: string): string {
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/-/g, ' ')
        .replace(/^./, (c) => c.toUpperCase())
        .trim()
}
