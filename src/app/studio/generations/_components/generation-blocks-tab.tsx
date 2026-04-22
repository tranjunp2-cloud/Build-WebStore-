'use client'

/**
 * GenerationBlocksTab — lists selectedBlocks with display names from registry.
 */

import { getBlockBySlug } from '@/lib/admin/block-registry-reader'
import type { GenerationRecord } from './generation-types'

type Props = { record: GenerationRecord }

export function GenerationBlocksTab({ record }: Props) {
    const blocks = record.selectedBlocks ?? []

    if (blocks.length === 0) {
        return (
            <p style={{ color: 'var(--text-3)', fontSize: 13, padding: '16px 0' }}>
                No block data recorded for this generation.
            </p>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {blocks.map((b, i) => {
                const slug = b.value ?? ''
                const meta = slug ? getBlockBySlug(slug) : null
                return (
                    <div
                        key={b.id ?? i}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-sunk)',
                            fontSize: 13,
                        }}
                    >
                        <span style={{ fontSize: 16, lineHeight: 1 }}>{meta?.icon ?? '📦'}</span>
                        <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 500, color: 'var(--text)' }}>
                                {meta?.name ?? slug}
                            </span>
                            {meta?.description && (
                                <span style={{ marginLeft: 8, color: 'var(--text-3)', fontSize: 11 }}>
                                    {meta.description.slice(0, 60)}
                                </span>
                            )}
                        </div>
                        <code style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                            {slug}
                        </code>
                    </div>
                )
            })}
        </div>
    )
}
