import React, { ChangeEvent, useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { sanitizeText } from '@/utils/sanitize';

interface QnASearchProps {
    onDebouncedSearch: (searchTerm: string) => void;
    placeholder?: string;
}

/**
 * QnA Search component that implements 300ms debounce (QA TC-F20.06)
 * and strips HTML tags against XSS attacks (QA TC-F20.05).
 */
export const QnASearch: React.FC<QnASearchProps> = ({
    onDebouncedSearch,
    placeholder = 'Search questions...',
}) => {
    const [inputValue, setInputValue] = useState('');

    // Debounce the input value by 300ms
    const debouncedValue = useDebounce(inputValue, 300);

    // Only notify parent when the debounced value changes, effectively preventing UI lag
    useEffect(() => {
        // Sanitize the text right before executing the search logic
        const safeText = sanitizeText(debouncedValue);
        onDebouncedSearch(safeText);
    }, [debouncedValue, onDebouncedSearch]);

    const handleClear = () => {
        setInputValue('');
    };

    return (
        <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-[18px] h-[18px] text-slate-400" aria-hidden />
            </div>
            <input
                type="text"
                className="w-full bg-[#161E2E] border border-[#1F2937] rounded-lg py-3 pl-11 pr-11 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm [&::-ms-clear]:hidden [&::-webkit-search-cancel-button]:hidden"
                placeholder={placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
            />
            {inputValue && (
                <button
                    type="button"
                    onClick={handleClear}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center justify-center bg-transparent border-none appearance-none outline-none text-slate-400 hover:text-white transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>
            )}
        </div>
    );
};
