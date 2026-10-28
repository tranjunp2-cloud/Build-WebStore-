import { requirePermission } from '@/lib/permission-guard'
import type { ReactNode } from 'react'
import { EditorAgentProvider } from '@/components/editor/agent/editor-agent-context'
import { isAiAgentEnabled } from '@/lib/ai-platform/config'

export default async function SiteEditorLayout({ children }: { children: ReactNode }) {
    await requirePermission('builder')
    // The editor's AI (AI Chat tab, Ask AI on elements) is the web builder copilot, where the assistant runs.
    return <EditorAgentProvider enabled={isAiAgentEnabled()}>{children}</EditorAgentProvider>
}
