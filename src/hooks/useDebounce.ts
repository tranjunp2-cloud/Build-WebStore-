import { useState, useEffect } from 'react'

/**
 * Custom hook to debounce a search value.
 * Used for Q&A Search to prevent UI freeze and reduce filter calls when typing rapidly.
 * Meets QA TC-F20.06 requirements (300ms debounce).
 * 
 * @param value The value to debounce
 * @param delay The delay in milliseconds
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)

    useEffect(() => {
        // Update debounced value after delay
        const timer = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        // Cancel the timeout if value changes (also on delay change or unmount)
        // This is how we prevent debounced value from updating if value is changed ...
        // .. within the delay period. Timeout gets cleared and restarted.
        return () => {
            clearTimeout(timer)
        }
    }, [value, delay])

    return debouncedValue
}
