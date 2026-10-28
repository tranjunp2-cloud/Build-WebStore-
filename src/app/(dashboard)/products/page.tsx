import { isAiAgentEnabled } from '@/lib/ai-platform/config'
import ProductsPageClient from './ProductsPageClient'

export default function ProductsPage() {
    return <ProductsPageClient agentEnabled={isAiAgentEnabled()} />
}
