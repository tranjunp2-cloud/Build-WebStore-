import React, { KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'isomorphic-dompurify';

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

    return (
        <div className={`transition-all duration-200 ${!isLast ? 'border-b border-solid border-[#1F2937]' : ''}`}>
            <div
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onClick={onToggle}
                onKeyDown={handleKeyDown}
                className="flex items-center justify-between w-full px-5 py-4 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500 hover:bg-[#1F2937] transition-colors"
                style={{ userSelect: 'none' }}
            >
                <div className="text-[14px] font-semibold text-white pr-4">
                    {question}
                </div>
                <div
                    className={`shrink-0 transition-transform duration-250 ease-in-out text-[12px] text-[#9CA3AF] ${isOpen ? 'rotate-180' : 'rotate-0'
                        }`}
                >
                    ▼
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
                            className="px-5 pb-4 text-[14px] text-[#9CA3AF] leading-[22px] [&_strong]:text-white [&_strong]:font-semibold"
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
