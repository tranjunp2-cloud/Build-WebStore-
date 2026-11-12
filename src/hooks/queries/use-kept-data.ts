import { useRef } from 'react'

/**
 * The query's data, or the last data it had: a filter or page whose first read fails keeps the rows last shown on
 * screen (the screens toast the failure) instead of falling back to an empty table.
 */
export function useKeptData<T>(data: T | undefined): T | undefined {
    const kept = useRef(data)
    if (data !== undefined) kept.current = data
    return data ?? kept.current
}
