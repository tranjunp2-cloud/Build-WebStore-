import React from 'react';
import { QnAPageClient } from './QnAPageClient';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Q&A | Help Center',
    description: 'Find answers to frequently asked questions about PrimeWeb CMS.',
};

export default function QnAPage() {
    return (
        <div className="w-full flex-1 animate-in fade-in duration-500 pb-12">
            <QnAPageClient />
        </div>
    );
}
