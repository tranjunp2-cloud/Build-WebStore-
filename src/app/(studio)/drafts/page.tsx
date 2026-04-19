import { PlaceholderCard } from '../_components/placeholder-card'

export const metadata = { title: 'Drafts' }

export default function DraftsPage() {
    return (
        <PlaceholderCard
            title="Drafts"
            phase={2}
            description="Templates in draft state — not yet published to live."
        />
    )
}
