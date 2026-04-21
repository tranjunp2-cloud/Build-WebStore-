'use client'

/**
 * Triage panel — client island for Phase 01 of plan 260419-2231.
 *
 * Renders verdict counters + per-fixture radio buttons injected into the
 * `[data-triage-slot]` placeholders on the index page. Persists verdicts to
 * localStorage so PM can close + resume without losing progress. Also offers
 * an "Export JSON" button that downloads the full triage log for committing
 * into the plan's reports/ folder.
 */

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'

type Verdict = 'ok' | 'minor' | 'major'
type VerdictRecord = { verdict: Verdict; note: string; updatedAt: string }
type TriageMap = Record<string, VerdictRecord>

const STORAGE_KEY = 'template-triage-verdicts'

function loadTriage(): TriageMap {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as TriageMap
  } catch {
    return {}
  }
}

function saveTriage(map: TriageMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

function verdictColor(v: Verdict): string {
  return v === 'ok' ? 'bg-emerald-500' : v === 'minor' ? 'bg-amber-500' : 'bg-red-500'
}

function verdictLabel(v: Verdict): string {
  return v === 'ok' ? 'OK' : v === 'minor' ? 'Minor' : 'Major'
}

export function TriagePanel({ totalCount, fixtureIds }: { totalCount: number; fixtureIds: string[] }) {
  const [map, setMap] = useState<TriageMap>({})
  const [noteDraftFor, setNoteDraftFor] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  useEffect(() => {
    setMap(loadTriage())
  }, [])

  const setVerdict = useCallback((fixtureId: string, verdict: Verdict, note?: string) => {
    setMap((prev) => {
      const next: TriageMap = {
        ...prev,
        [fixtureId]: {
          verdict,
          note: note ?? prev[fixtureId]?.note ?? '',
          updatedAt: new Date().toISOString(),
        },
      }
      saveTriage(next)
      return next
    })
  }, [])

  // Inject radio controls into every `[data-triage-slot]` placeholder.
  useEffect(() => {
    const slots = document.querySelectorAll<HTMLElement>('[data-triage-slot]')
    slots.forEach((slot) => {
      const fid = slot.dataset.triageSlot
      if (!fid) return
      slot.textContent = ''
      const current = map[fid]?.verdict
      const row = document.createElement('div')
      row.className = 'flex items-center gap-1'
      for (const v of ['ok', 'minor', 'major'] as const) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className =
          'rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wide transition ' +
          (current === v
            ? `${verdictColor(v)} text-white`
            : 'bg-muted text-muted-foreground hover:bg-muted-foreground/10')
        btn.textContent = verdictLabel(v)
        btn.onclick = () => {
          setVerdict(fid, v)
          if (v !== 'ok') {
            setNoteDraftFor(fid)
            setNoteText(map[fid]?.note ?? '')
          }
        }
        row.appendChild(btn)
      }
      slot.appendChild(row)
    })
  }, [map, fixtureIds, setVerdict])

  const counts: Record<Verdict | 'pending', number> = { ok: 0, minor: 0, major: 0, pending: 0 }
  for (const fid of fixtureIds) {
    const v = map[fid]?.verdict
    if (v) counts[v] += 1
    else counts.pending += 1
  }

  const exportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      totalCount,
      summary: counts,
      verdicts: map,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'triage-verdicts.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearAll = () => {
    if (!confirm('Clear all triage verdicts from localStorage?')) return
    localStorage.removeItem(STORAGE_KEY)
    setMap({})
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded bg-emerald-500 px-2 py-0.5 text-white">OK {counts.ok}</span>
        <span className="rounded bg-amber-500 px-2 py-0.5 text-white">Minor {counts.minor}</span>
        <span className="rounded bg-red-500 px-2 py-0.5 text-white">Major {counts.major}</span>
        <span className="rounded bg-muted px-2 py-0.5">Pending {counts.pending}</span>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={exportJson}>
          Export JSON
        </Button>
        <Button variant="ghost" size="sm" onClick={clearAll}>
          Clear
        </Button>
      </div>
      {noteDraftFor && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background p-3 shadow-lg">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium">
                Note for <code className="text-xs">{noteDraftFor}</code>
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full rounded-md border px-2 py-1 text-sm"
                rows={2}
                placeholder="What's wrong? 10+ chars recommended"
              />
            </div>
            <Button
              size="sm"
              onClick={() => {
                const current = map[noteDraftFor]
                if (current) setVerdict(noteDraftFor, current.verdict, noteText)
                setNoteDraftFor(null)
              }}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNoteDraftFor(null)}>
              Skip
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
