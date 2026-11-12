'use client';

import React, { useState, useMemo } from 'react';
import { Inbox } from 'lucide-react';
import { QnASearch } from '@/components/help/QnASearch';
import { QnAAccordion } from '@/components/help/QnAAccordion';
import { getQnAData } from '@/data/help-qna';
import { useI18n } from '@/i18n';

export const QnAPageClient = () => {
    const { t } = useI18n();
    const [searchTerm, setSearchTerm] = useState('');

    // Manage array of expanded IDs to allow multiple panels open concurrently (TC-F20.04)
    const [expandedIds, setExpandedIds] = useState<string[]>([]);

    const handleSearch = (sanitizedTerm: string) => {
        setSearchTerm(sanitizedTerm);
    };

    const toggleAccordion = (id: string) => {
        setExpandedIds(prev =>
            prev.includes(id)
                ? prev.filter(item => item !== id)
                : [...prev, id]
        );
    };

    const qnaData = useMemo(() => getQnAData(t), [t]);

    // Filter logic grouped by categories
    const filteredCategories = useMemo(() => {
        if (!searchTerm) return qnaData;

        const lowerTerm = searchTerm.toLowerCase();

        return qnaData.map(category => {
            // filter items inside the category
            const filteredItems = category.items.filter(
                item =>
                    item.question.toLowerCase().includes(lowerTerm) ||
                    item.answer.toLowerCase().includes(lowerTerm)
            );
            return {
                ...category,
                items: filteredItems
            };
        }).filter(category => category.items.length > 0); // Remove category if it has no matching items
    }, [searchTerm, qnaData]);

    const hasAnyResults = filteredCategories.length > 0;

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* Search Section */}
            <div className="w-full">
                <QnASearch
                    onDebouncedSearch={handleSearch}
                    placeholder={t.help.qna.searchPlaceholder}
                />
            </div>

            {/* Q&A List Section */}
            <div className="w-full flex flex-col gap-6">
                {hasAnyResults ? (
                    filteredCategories.map((category) => (
                        <div key={category.id} className="flex flex-col gap-3">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <category.Icon className="w-4 h-4 text-[hsl(var(--primary))] shrink-0" aria-hidden />
                                {category.title}
                            </h3>
                            {/* `border-solid` required (preflight OFF) so the 1px card outline paints and closes the last row. */}
                            <div className="bg-[hsl(var(--card))] border border-solid border-[hsl(var(--border))] rounded-[12px] overflow-hidden">
                                {category.items.map((item, index) => (
                                    <QnAAccordion
                                        key={item.id}
                                        question={item.question}
                                        answer={item.answer}
                                        isOpen={expandedIds.includes(item.id)}
                                        onToggle={() => toggleAccordion(item.id)}
                                        isLast={index === category.items.length - 1}
                                        video={item.video}
                                        videoBadgeLabel={t.help.qna.videoBadge}
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    /* Empty State: TC-F20.05 */
                    <div className="text-center py-12 px-6 text-slate-400">
                        <Inbox className="w-12 h-12 mx-auto mb-3 text-slate-500" aria-hidden />
                        <p className="text-[14px]">
                            <strong className="font-bold text-slate-300 text-[14px]">{t.help.qna.emptyTitle}</strong>
                        </p>
                        <p className="text-[14px] mt-1">
                            {t.help.qna.emptyDesc}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
