'use client'

/**
 * block-schema-inspector.tsx
 * Schema & fields tab — renders editable field table with type pills + required badge.
 * Styled to match design bundle builder-block-detail.jsx schema tab.
 * Data comes from registry (editableFields string[]) — no live zod introspection yet.
 */
import { Plus } from 'lucide-react'

// Field type inference from field name conventions
function inferType(field: string): string {
    if (field.includes('url') || field.includes('Url') || field.includes('image') || field.includes('Image')) return 'string (url)'
    if (field.includes('count') || field.includes('Count') || field.includes('num') || field.includes('Num')) return 'number'
    if (field.includes('show') || field.includes('Show') || field.includes('enabled') || field.includes('visible')) return 'boolean'
    if (field.includes('items') || field.includes('Items') || field.includes('list') || field.includes('List') || field.includes('buttons') || field.includes('links')) return 'array'
    return 'string'
}

// Required fields are canonical content keys — headline/message/address treated as required
const REQUIRED_KEYS = new Set(['headline', 'message', 'videoUrl', 'address', 'email', 'phone'])

function isRequired(field: string): boolean {
    return REQUIRED_KEYS.has(field)
}

type Props = {
    editableFields: string[]
    blockSlug: string
    defaultVariant: string
    variants: string[]
}

export function BlockSchemaInspector({ editableFields, blockSlug, defaultVariant, variants }: Props) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Description */}
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
                Định nghĩa schema cho block{' '}
                <strong style={{ color: 'var(--text)' }}>{blockSlug}</strong> — các field có thể chỉnh sửa trong Inspector.
                Mirror của{' '}
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>src/blocks/{blockSlug}/config.ts</span>
            </p>

            {editableFields.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>No editable fields defined.</p>
            ) : (
                <table className="b-schema-table">
                    <thead>
                        <tr>
                            <th style={{ width: '22%' }}>Field key</th>
                            <th style={{ width: '20%' }}>Type</th>
                            <th>Label / description</th>
                            <th style={{ width: '12%' }}>Required</th>
                            <th style={{ width: '12%' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {editableFields.map((field) => {
                            const type = inferType(field)
                            const required = isRequired(field)
                            return (
                                <tr key={field}>
                                    <td><span className="key">{field}</span></td>
                                    <td><span className="ztype">{type}</span></td>
                                    <td>
                                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>
                                            {fieldLabel(field)}
                                        </div>
                                        <div className="hint">
                                            Exposed to AI editor · Inspector Content tab
                                        </div>
                                    </td>
                                    <td>
                                        {required ? (
                                            <span className="b-pill-ai">required</span>
                                        ) : (
                                            <span className="b-pill-manual">optional</span>
                                        )}
                                    </td>
                                    <td style={{ display: 'flex', gap: 4 }}>
                                        <button className="b-btn ghost" style={{ height: 26, padding: '0 8px', fontSize: 11 }}>
                                            Edit
                                        </button>
                                        <button
                                            className="b-btn ghost"
                                            style={{ height: 26, padding: '0 8px', fontSize: 11, color: 'var(--danger)' }}
                                        >
                                            Del
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            )}

            <div>
                <button className="b-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Plus size={13} /> Add schema field
                </button>
            </div>

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
                    {JSON.stringify({ blockSlug, defaultVariant, variantCount: variants.length, fieldCount: editableFields.length, editableFields }, null, 2)}
                </pre>
            </div>
        </div>
    )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert camelCase/kebab field key to a readable label */
function fieldLabel(key: string): string {
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/-/g, ' ')
        .replace(/^./, (c) => c.toUpperCase())
        .trim()
}
