/**
 * worst-blocks-ranking.tsx
 * Ranked list of blocks with lowest avg quality score.
 * Resolves display names from the block registry.
 */
'use client'

import { getBlockBySlug } from '@/lib/admin/block-registry-reader'
import type { WorstBlockEntry } from '@/lib/admin/quality-metrics'

type Props = {
  blocks: WorstBlockEntry[]
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score))
  const color = score >= 70 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 80 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', minWidth: 28, textAlign: 'right' }}>
        {score.toFixed(0)}
      </span>
    </div>
  )
}

export function WorstBlocksRanking({ blocks }: Props) {
  if (blocks.length === 0) {
    return (
      <p style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
        No scoring data in range
      </p>
    )
  }

  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {blocks.map((block, i) => {
        const meta = getBlockBySlug(block.slug)
        const displayName = meta?.name ?? block.slug
        return (
          <li
            key={block.slug}
            style={{
              display: 'grid',
              gridTemplateColumns: '20px 1fr auto',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              background: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--border) 30%, transparent)',
              borderRadius: 6,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textAlign: 'center' }}>
              {i + 1}
            </span>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                {block.usageCount > 0 ? `${block.usageCount} uses` : 'unused'}
              </div>
            </div>
            <ScoreBar score={block.avgScore} />
          </li>
        )
      })}
    </ol>
  )
}
