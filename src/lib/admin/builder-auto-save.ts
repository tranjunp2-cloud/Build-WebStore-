'use client'
/**
 * builder-auto-save.ts
 * Auto-saves builder sections to localStorage every 30s.
 * Silent — no toast on success. Persists up to 5 snapshots per template.
 */
import type { Section } from './builder-store'

const MAX_HISTORY = 5
const AUTO_SAVE_INTERVAL_MS = 30_000

function storageKey(templateId: number): string {
    return `pw_builder_${templateId}`
}

export interface AutoSaveSnapshot {
    savedAt: string
    sections: Section[]
}

/** Reads the latest snapshot for a template from localStorage. */
export function loadAutoSave(templateId: number): Section[] | null {
    try {
        const raw = localStorage.getItem(storageKey(templateId))
        if (!raw) return null
        const history: AutoSaveSnapshot[] = JSON.parse(raw)
        return history[history.length - 1]?.sections ?? null
    } catch {
        return null
    }
}

/** Persists sections to localStorage history (capped at MAX_HISTORY). */
export function persistAutoSave(templateId: number, sections: Section[]): void {
    try {
        const raw = localStorage.getItem(storageKey(templateId))
        const history: AutoSaveSnapshot[] = raw ? JSON.parse(raw) : []
        history.push({ savedAt: new Date().toISOString(), sections })
        if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY)
        localStorage.setItem(storageKey(templateId), JSON.stringify(history))
    } catch {
        // Quota exceeded or parse error — silently skip
    }
}

/** Clears all auto-save data for a template (call after successful DB save). */
export function clearAutoSave(templateId: number): void {
    try {
        localStorage.removeItem(storageKey(templateId))
    } catch {
        // ignore
    }
}

/**
 * Starts the 30s auto-save interval.
 * Returns a cleanup function that stops it.
 * getSections: function that returns current sections at call time.
 */
export function startAutoSave(
    templateId: number,
    getSections: () => Section[],
): () => void {
    const handle = setInterval(() => {
        persistAutoSave(templateId, getSections())
    }, AUTO_SAVE_INTERVAL_MS)

    return () => clearInterval(handle)
}
