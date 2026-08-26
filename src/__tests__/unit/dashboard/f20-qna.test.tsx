import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QnAAccordion } from '@/components/help/QnAAccordion';
import { QnASearch } from '@/components/help/QnASearch';
import { QnAPageClient } from '@/app/(dashboard)/help/qna/QnAPageClient';
import { I18nProvider } from '@/i18n';

describe('[TC-F20.03] QnAAccordion Component', () => {
    const mockOnToggle = vi.fn();
    const props = {
        question: 'Làm sao để thêm sản phẩm mới?',
        answer: 'Vào menu Products...',
        isOpen: false,
        onToggle: mockOnToggle
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the question text properly', () => {
        render(<QnAAccordion {...props} />);
        expect(screen.getByText('Làm sao để thêm sản phẩm mới?')).toBeInTheDocument();
    });

    it('displays the answer when isOpen is true', () => {
        render(<QnAAccordion {...props} isOpen={true} />);
        expect(screen.getByText('Vào menu Products...')).toBeInTheDocument();
    });

    it('calls onToggle when header is clicked', () => {
        render(<QnAAccordion {...props} />);
        const header = screen.getByRole('button');
        fireEvent.click(header);
        expect(mockOnToggle).toHaveBeenCalledTimes(1);
    });

    it('[TC-F20.07] calls onToggle when Enter or Space is pressed (Keyboard A11y)', () => {
        render(<QnAAccordion {...props} />);
        const header = screen.getByRole('button');
        
        // Tab focus should be available via tabIndex={0}
        expect(header).toHaveAttribute('tabIndex', '0');

        // Space
        fireEvent.keyDown(header, { key: ' ' });
        expect(mockOnToggle).toHaveBeenCalledTimes(1);

        // Enter
        fireEvent.keyDown(header, { key: 'Enter' });
        expect(mockOnToggle).toHaveBeenCalledTimes(2);
    });
});

describe('[TC-F20.06] QnASearch Component', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('debounces the search input and calls onDebouncedSearch', () => {
        const mockSearch = vi.fn();
        render(<QnASearch onDebouncedSearch={mockSearch} />);

        const input = screen.getByRole('textbox');
        
        // Type fast
        fireEvent.change(input, { target: { value: 'p' } });
        fireEvent.change(input, { target: { value: 'pr' } });
        fireEvent.change(input, { target: { value: 'pro' } });

        // Initial render called it with '' once
        expect(mockSearch).toHaveBeenCalledWith('');
        mockSearch.mockClear();

        // Advance timer by 200ms
        act(() => {
            vi.advanceTimersByTime(200);
        });
        
        // Has not been called yet for 'pro'
        expect(mockSearch).not.toHaveBeenCalled();

        // Advance to 300ms
        act(() => {
            vi.advanceTimersByTime(100);
        });

        expect(mockSearch).toHaveBeenCalledWith('pro');
    });

    it('[TC-F20.05] sanitizes input before calling onDebouncedSearch', () => {
        const mockSearch = vi.fn();
        render(<QnASearch onDebouncedSearch={mockSearch} />);
        const input = screen.getByRole('textbox');

        // Type script tag
        fireEvent.change(input, { target: { value: '<script>alert(1)</script>' } });
        
        act(() => {
            vi.advanceTimersByTime(300);
        });

        // The input visually shows '<script>alert(1)</script>' but the emitted safeText is stripped
        expect(mockSearch).toHaveBeenCalledWith('alert(1)');
    });
});

describe('[TC-F20.04] QnAPageClient Integration', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('allows opening multiple accordions concurrently without closing others', () => {
        render(
            <I18nProvider>
                <QnAPageClient />
            </I18nProvider>
        );
        
        // Find all buttons
        const buttons = screen.getAllByRole('button'); // 8 accordions in mock data, plus the search clear button (if input is there)
        
        // Click first
        fireEvent.click(buttons[0]);
        // Click second
        fireEvent.click(buttons[1]);
        
        // Both answers should be visible in the DOM
        expect(screen.getByText(/Traffic/i)).toBeInTheDocument(); // q1 answer snippet (Dashboard Metrics)
        expect(screen.getAllByText(/Customize/i).length).toBeGreaterThanOrEqual(1); // q2 answer snippet (Dashboard Customize)
    });

    it('[TC-F20.05] displays Empty State when search yields no results', () => {
        render(
            <I18nProvider>
                <QnAPageClient />
            </I18nProvider>
        );
        const searchInput = screen.getByRole('textbox');

        // Type a non-existent word
        fireEvent.change(searchInput, { target: { value: 'abc88xyz' } });

        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(screen.getByText('No answers found')).toBeInTheDocument();
        expect(screen.getByText(/Try different keywords, or message us on WhatsApp/)).toBeInTheDocument();
    });
});
