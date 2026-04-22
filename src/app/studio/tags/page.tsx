import { Tag } from 'lucide-react'
import { ComingSoonEmpty } from '../_components/coming-soon-empty'

export const metadata = { title: 'Tags & AI Prompts' }

export default function TagsPage() {
    return (
        <div style={{ padding: 'var(--pad)' }}>
            <ComingSoonEmpty
                icon={Tag}
                title="Tags & AI Prompts"
                description="Tag taxonomy management for blocks, templates, and content packs."
                ctaHref="/studio/blocks"
                ctaLabel="Browse block catalog"
            />
        </div>
    )
}
