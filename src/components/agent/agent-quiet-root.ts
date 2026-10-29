'use client'

import { useEffect } from 'react'
import { dockShownOn, quietOn } from './agent-dock-routes'

/**
 * On form screens (product editor, settings, a discount, a customer: `quietOn`) the mascot sits compact and tucked
 * into the corner so it does not cover right-aligned row controls (a settings switch, a row action). globals.css
 * reads the `data-agent-quiet` attribute this sets on <html> (`--ech-ag-dock-right`, `--ech-ag-fab-zoom`); the
 * placeholder and the loaded dock share those variables, so they look alike while the dock loads.
 *
 * An attribute on the root, like `data-save-bar` (save-bar-lift): no `:has()` on the document.
 */
export function useAgentQuietRoot(pathname: string): void {
    const quiet = dockShownOn(pathname) && quietOn(pathname)
    useEffect(() => {
        if (!quiet) return
        const root = document.documentElement
        root.dataset.agentQuiet = ''
        return () => {
            delete root.dataset.agentQuiet
        }
    }, [quiet])
}
