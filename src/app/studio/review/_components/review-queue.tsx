'use client'
/**
 * ReviewQueue — client wrapper managing optimistic removal after approve/reject.
 */
import { useState } from 'react'
import { CheckSquare } from 'lucide-react'
import { ReviewCard } from './review-card'
import type { ComplianceResult } from '@/lib/admin/dna-compliance'

export type ReviewTemplate = {
    id: string
    name: string
    description?: string | null
    category: string[]
    personality?: string | null
    thumbnail?: { url?: string | null } | null
    dnaComplianceCache?: ComplianceResult | null
    updatedAt: string
}

type Props = { initialTemplates: ReviewTemplate[] }

export function ReviewQueue({ initialTemplates }: Props) {
    const [templates, setTemplates] = useState<ReviewTemplate[]>(initialTemplates)

    const handleResolved = (id: string) => {
        setTemplates(prev => prev.filter(t => t.id !== id))
    }

    if (templates.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-2">
                <CheckSquare size={32} className="opacity-30" />
                <p className="text-sm">No templates pending review — queue is clear.</p>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-4 max-w-3xl mx-auto">
            {templates.map(template => (
                <ReviewCard
                    key={template.id}
                    template={template}
                    onResolved={() => handleResolved(template.id)}
                />
            ))}
        </div>
    )
}
