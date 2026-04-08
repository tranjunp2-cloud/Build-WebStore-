import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '@/hooks/useDebounce';
import { sanitizeText } from '@/utils/sanitize';

describe('[TC-F20.06] useDebounce Hook', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return the initial value immediately', () => {
        const { result } = renderHook(() => useDebounce('initial', 300));
        expect(result.current).toBe('initial');
    });

    it('should update the debounced value only after the specified delay', () => {
        let value = 'initial';
        const { result, rerender } = renderHook(() => useDebounce(value, 300));

        // Update value
        value = 'updated';
        rerender();

        // Value should not update immediately
        expect(result.current).toBe('initial');

        // Fast forward 150ms - should still be initial
        act(() => {
            vi.advanceTimersByTime(150);
        });
        expect(result.current).toBe('initial');

        // Fast forward another 150ms (total 300ms) - should update now
        act(() => {
            vi.advanceTimersByTime(150);
        });
        expect(result.current).toBe('updated');
    });

    it('should reset the timer if value changes before the delay ends', () => {
        let value = 'first';
        const { result, rerender } = renderHook(() => useDebounce(value, 300));

        value = 'second';
        rerender();

        act(() => {
            vi.advanceTimersByTime(200); // Wait 200ms
        });
        expect(result.current).toBe('first'); // Still 'first'

        value = 'third';
        rerender(); // Update again before 300ms passed

        act(() => {
            vi.advanceTimersByTime(200); // Wait another 200ms
        });
        // Still 'first' because the 300ms timer was reset when "third" was passed
        expect(result.current).toBe('first');

        act(() => {
            vi.advanceTimersByTime(100); // 300ms total since 'third'
        });
        expect(result.current).toBe('third');
    });
});

describe('[TC-F20.05] sanitizeText Utility', () => {
    it('should strictly strip <script> tag injections', () => {
        const input = '<script>alert("XSS")</script>';
        const result = sanitizeText(input);
        expect(result).toBe('alert("XSS")');
    });

    it('should strictly strip deeply nested HTML tags', () => {
        const input = '<div>Test <span style="color:red">Nested <b>Text</b></span></div>';
        const result = sanitizeText(input);
        expect(result).toBe('Test Nested Text');
    });

    it('should return empty string for null or undefined', () => {
        expect(sanitizeText(null)).toBe('');
        expect(sanitizeText(undefined)).toBe('');
    });

    it('should preserve regular text without HTML', () => {
        const input = 'This is a nice safe string! 123 @#%';
        const result = sanitizeText(input);
        expect(result).toBe(input);
    });
});
