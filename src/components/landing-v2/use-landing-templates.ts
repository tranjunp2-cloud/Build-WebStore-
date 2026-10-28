'use client'

import { useEffect, useState } from 'react'
import { parseTemplates } from './template-picks'
import type { LvTemplate } from './lv-types'

export interface LandingTemplatesState {
  status: 'loading' | 'ready' | 'error'
  templates: LvTemplate[]
}

const LIST_URL = '/api/templates/list?limit=100'

/** One client-side fetch shared by the bento previews and the templates carousel. */
export function useLandingTemplates(): LandingTemplatesState {
  const [state, setState] = useState<LandingTemplatesState>({ status: 'loading', templates: [] })

  useEffect(() => {
    const ac = new AbortController()
    fetch(LIST_URL, { signal: ac.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`templates list ${res.status}`)
        return res.json() as Promise<unknown>
      })
      .then((json) => setState({ status: 'ready', templates: parseTemplates(json) }))
      .catch((err: unknown) => {
        if (ac.signal.aborted) return
        console.warn('[landing-v2] template previews unavailable:', err)
        setState({ status: 'error', templates: [] })
      })
    return () => ac.abort()
  }, [])

  return state
}
