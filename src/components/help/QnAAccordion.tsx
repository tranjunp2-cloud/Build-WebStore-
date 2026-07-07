import React, { KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import DOMPurify from 'isomorphic-dompurify';

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    // Check if the element is an anchor tag with target="_blank"
    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
        node.setAttribute('rel', 'noopener noreferrer');
    }
});

interface QnAAccordionProps {
    question: string;
    answer: string;
    isOpen: boolean;
    onToggle: () => void;
    isLast?: boolean;
}

/**
 * Accordion component for displaying a Question & Answer pair.
 */
export const QnAAccordion: React.FC<QnAAccordionProps> = ({
    question,
    answer,
    isOpen,
    onToggle,
    isLast = false,
}) => {
    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
        }
    };

    // Preflight is OFF: without `border-0`, `border-solid` alone exposes the UA default
    // `medium` (~3px) width on the top/left/right sides — only the 1px bottom divider may paint.
    return (
        <div className={`transition-all duration-200 ${!isLast ? 'border-0 border-b border-solid border-[hsl(var(--border))]' : ''}`}>
            <div
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onClick={onToggle}
                onKeyDown={handleKeyDown}
                className="flex items-center justify-between w-full px-5 py-4 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] hover:bg-[hsl(var(--secondary))] transition-colors"
                style={{ userSelect: 'none' }}
            >
                <div className="min-w-0 break-words text-[14px] font-semibold text-white pr-4">
                    {question}
                </div>
                <div
                    className={`shrink-0 transition-transform duration-250 ease-in-out text-[hsl(var(--muted-foreground))] ${isOpen ? 'rotate-180' : 'rotate-0'
                        }`}
                >
                    <ChevronDown className="w-3.5 h-3.5" aria-hidden />
                </div>
            </div>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                    >
                        <div
                            className="px-5 pb-4 text-[14px] text-[hsl(var(--muted-foreground))] leading-[22px] [&_strong]:text-[var(--dash-text)] [&_strong]:font-semibold"
                            dangerouslySetInnerHTML={{ 
                                __html: DOMPurify.sanitize(answer, { 
                                    ALLOWED_TAGS: ['strong', 'br', 'a', 'p', 'ul', 'ol', 'li', 'em', 'u'], 
                                    ALLOWED_ATTR: ['href', 'target', 'rel'] 
                                }) 
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
