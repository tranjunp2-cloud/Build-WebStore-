'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GripVertical, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Reorder } from 'framer-motion'
import BusinessInfoForm from '@/components/builder/BusinessInfoForm'
import BuilderCompletionView from '@/components/builder/BuilderCompletionView'
import BuilderFullPreview from '@/components/builder/BuilderFullPreview'
import BuilderGenerationView from '@/components/builder/BuilderGenerationView'
import type { BuilderPreviewMode } from '@/components/builder/BuilderPreviewPrimitives'
import { blockRegistry } from '@/blocks/registry'
import { BlockErrorBoundary } from '@/blocks/ErrorBoundary'
import type { ThemeConfig } from '@/blocks/types'
import { useBuilderStore, type BusinessInfo } from '@/store/builderStore'

function LivePreview({
    blocks,
    theme,
    onReorder,
}: {
    blocks: any[]
    theme: ThemeConfig | null
    onReorder?: (newOrder: any[]) => void
}) {
    if (!theme || blocks.length === 0) return null

    return (
        <Reorder.Group
            axis="y"
            className="min-h-full w-full"
            onReorder={(newOrder) => onReorder?.(newOrder)}
            style={{
                fontFamily: `'${theme.fontBody}', sans-serif`,
                background: theme.colorMode === 'dark' ? '#09090b' : '#ffffff',
                color: theme.colorMode === 'dark' ? '#fafafa' : '#09090b',
            }}
            values={blocks}
        >
            {blocks.map((block) => {
                if (!block.blockType) return null

                const BlockComponent = blockRegistry.getComponent(block.blockType)
                if (!BlockComponent) return null

                const isFixed = block.blockType === 'navigation' || block.blockType === 'footer'

                return (
                    <Reorder.Item
                        className="group/block relative"
                        dragListener={!isFixed}
                        key={block._id}
                        value={block}
                    >
                        <div className="absolute left-3 top-3 z-40 opacity-0 transition-opacity duration-200 group-hover/block:opacity-100">
                            {isFixed ? (
                                <div className="flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-white/40 backdrop-blur-sm">
                                    <Lock className="size-3" />
                                </div>
                            ) : (
                                <div className="flex cursor-grab items-center gap-1.5 rounded-lg border border-blue-500 bg-blue-600/90 px-2 py-1.5 text-[10px] font-medium text-white shadow-lg active:cursor-grabbing">
                                    <GripVertical className="size-3" />
                                </div>
                            )}
                        </div>

                        <div className="pointer-events-none absolute inset-0 z-30 rounded-sm border-2 border-transparent transition-all group-active/block:border-blue-500/40 group-active/block:bg-blue-500/5" />

                        <BlockErrorBoundary blockType={block.blockType}>
                            <BlockComponent block={block} theme={theme} />
                        </BlockErrorBoundary>
                    </Reorder.Item>
                )
            })}
        </Reorder.Group>
    )
}

export default function AIBuilderPage() {
    const router = useRouter()
    const [isFullPreviewOpen, setIsFullPreviewOpen] = useState(false)
    const [previewMode, setPreviewMode] = useState<BuilderPreviewMode>('desktop')
    const [generationTimeMs, setGenerationTimeMs] = useState(0)
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const {
        step,
        businessInfo,
        status,
        messages,
        blocks,
        theme,
        siteId,
        siteName,
        progress,
        addMessage,
        setStatus,
        addBlock,
        setTheme,
        setProgress,
        setSiteId,
        setSiteName,
        setError,
        setBusinessInfo,
        setBlocks,
        setStep,
        reset,
    } = useBuilderStore()

    useEffect(() => {
        if (!siteId || status !== 'done' || blocks.length === 0 || !theme) return

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

        saveTimeoutRef.current = setTimeout(async () => {
            try {
                await fetch(`/api/sites/${siteId}/save`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ blocks, theme }),
                })
            } catch (error) {
                console.error('[Auto-save] Failed to save draft:', error)
            }
        }, 2000)

        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        }
    }, [blocks, siteId, status, theme])

    const prepareGenerationSession = useCallback((info: BusinessInfo) => {
        reset()
        setGenerationTimeMs(0)
        setBusinessInfo(info)
        setStatus('streaming')
        setProgress({
            step: 'generate',
            label: 'Generating content & design',
            progress: 8,
        })
        addMessage({ role: 'assistant', content: '🚀 Starting website creation...' })
    }, [addMessage, reset, setBusinessInfo, setProgress, setStatus])

    const handleSSEEvent = useCallback((event: string, data: any) => {
        switch (event) {
            case 'step':
                setProgress(data)
                break
            case 'theme_set':
                setTheme(data.theme)
                break
            case 'block_complete':
                addBlock(data.block)
                break
            case 'error':
                setError(data)
                break
            case 'done':
                setStatus('done')
                setGenerationTimeMs(data.timeMs || 0)
                setSiteId(data.siteId)
                setSiteName(data.siteName)
                addMessage({
                    role: 'assistant',
                    content:
                        `✅ Website **"${data.siteName}"** has been created successfully!\n\n` +
                        `📊 **${data.totalBlocks} sections** generated\n` +
                        `⏱️ **${Math.round(data.timeMs / 1000)}s** generation time\n\n` +
                        'You can view the Preview on the right, open the Editor to make changes, or Publish now!',
                })
                break
            default:
                break
        }
    }, [addBlock, addMessage, setError, setProgress, setSiteId, setSiteName, setStatus, setTheme])

    const startSSEGeneration = useCallback(async (info: BusinessInfo, extraInstructions?: string) => {
        try {
            const response = await fetch('/api/ai/generate-site?stream=true', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessInfo: info,
                    extraInstructions,
                    language: info.language || 'auto',
                }),
                credentials: 'include',
            })

            if (!response.ok) {
                const errorData = await response.json()
                const errorMessage =
                    typeof errorData?.error === 'string'
                        ? errorData.error
                        : errorData?.error?.details || 'Generation failed'

                throw new Error(errorMessage)
            }

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()

            if (!reader) {
                throw new Error('No response stream')
            }

            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })

                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                let currentEvent = ''

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7)
                        continue
                    }

                    if (!line.startsWith('data: ') || !currentEvent) {
                        continue
                    }

                    try {
                        const data = JSON.parse(line.slice(6))
                        handleSSEEvent(currentEvent, data)
                    } catch {
                        // Ignore malformed SSE payloads.
                    }

                    currentEvent = ''
                }
            }
        } catch (error: any) {
            const message = error?.message || 'Generation failed'

            setError({
                code: 'generation_failed',
                message,
                retryable: true,
            })
            setStep('info')
            toast.error(message)
        }
    }, [handleSSEEvent, setError, setStep])

    const handleGenerateStart = useCallback((info: BusinessInfo) => {
        prepareGenerationSession(info)
        void startSSEGeneration(info)
    }, [prepareGenerationSession, startSSEGeneration])

    const handlePreviewNextStep = useCallback((info: BusinessInfo) => {
        prepareGenerationSession(info)
        setProgress({
            step: 'generate',
            label: 'Generating content & design',
            progress: 52,
        })
    }, [prepareGenerationSession, setProgress])

    const demoBusinessInfo: BusinessInfo = {
        businessName: 'Duck Coffee',
        shortDescription: 'We are a modern neighborhood cafe serving specialty coffee, fresh pastries, and a warm all-day atmosphere.',
        industry: 'restaurant',
        products: 'Specialty coffee, croissants, handmade pastries, bubble tea',
        targetAudience: '',
        style: 'modern',
        language: 'auto',
    }

    const jumpToStep1 = useCallback(() => {
        reset()
        setGenerationTimeMs(0)
        setIsFullPreviewOpen(false)
    }, [reset])

    const jumpToStep2 = useCallback(() => {
        prepareGenerationSession(demoBusinessInfo)
        setProgress({
            step: 'generate',
            label: 'Generating content & design',
            progress: 52,
        })
        setIsFullPreviewOpen(false)
    }, [demoBusinessInfo, prepareGenerationSession, setProgress])

    const jumpToStep3 = useCallback(() => {
        reset()
        setGenerationTimeMs(0)
        setBusinessInfo(demoBusinessInfo)
        setStatus('done')
        setSiteId('demo-site')
        setSiteName('Duck Coffee')
        addMessage({ role: 'assistant', content: '🚀 Starting website creation...' })
        addMessage({
            role: 'assistant',
            content:
                '✅ Website **"Duck Coffee"** has been created successfully!\n\n' +
                '📊 **7 sections** generated\n' +
                '⏱️ **0s** generation time\n\n' +
                'You can view the Preview on the right, open the Editor to make changes, or Publish now!',
        })
        setIsFullPreviewOpen(false)
    }, [addMessage, demoBusinessInfo, reset, setBusinessInfo, setSiteId, setSiteName, setStatus])

    const currentStepIndex = step === 'info' ? 1 : status === 'done' ? 3 : 2

    const stepPreviewControls = (
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0b1120]/90 p-2 shadow-[0px_8px_32px_0px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <button
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={currentStepIndex === 1}
                onClick={currentStepIndex === 3 ? jumpToStep2 : jumpToStep1}
                type="button"
            >
                Prev
            </button>

            <div className="px-2 text-xs font-medium text-[#94a3b8]">
                Step {currentStepIndex}/3
            </div>

            <button
                className="rounded-xl bg-[linear-gradient(90deg,#3b82f6_0%,#2dd4bf_100%)] px-3 py-2 text-xs font-semibold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={currentStepIndex === 3}
                onClick={currentStepIndex === 1 ? jumpToStep2 : jumpToStep3}
                type="button"
            >
                Next
            </button>
        </div>
    )

    const generationMessage =
        messages.find((message) => message.role === 'assistant')?.content.replace(/^🚀\s*/, '') ||
        'Starting website creation...'

    const previewContent = blocks.length > 0 && theme ? (
        <div className="h-full overflow-y-auto bg-[#06090F]">
            <LivePreview blocks={blocks} onReorder={setBlocks} theme={theme} />
        </div>
    ) : (
        <div className="flex h-full items-center justify-center bg-[#06090F]">
            <div className="text-center">
                <p className="text-base font-medium text-white/80">{siteName || businessInfo?.businessName || 'Your website'}</p>
                <p className="mt-2 text-sm text-white/40">Preview is being prepared.</p>
            </div>
        </div>
    )

    const shouldShowGenerationScreen =
        step === 'chat' &&
        status !== 'done' &&
        blocks.length === 0

    const shouldShowPreviewScreen =
        status === 'done' ||
        (step === 'chat' && blocks.length > 0 && !!theme)

    if (step === 'info') {
        return (
            <BusinessInfoForm
                floatingControls={stepPreviewControls}
                initialValues={businessInfo}
                isGenerating={status === 'streaming'}
                onPreviewNextStep={handlePreviewNextStep}
                onSubmit={handleGenerateStart}
            />
        )
    }

    if (shouldShowGenerationScreen) {
        return (
            <BuilderGenerationView
                floatingControls={stepPreviewControls}
                message={generationMessage}
                progress={progress.progress || 52}
            />
        )
    }

    if (shouldShowPreviewScreen) {
        if (isFullPreviewOpen) {
            return (
                <BuilderFullPreview
                    mode={previewMode}
                    onBack={() => setIsFullPreviewOpen(false)}
                    onModeChange={setPreviewMode}
                    previewContent={previewContent}
                />
            )
        }

        return (
            <BuilderCompletionView
                floatingControls={stepPreviewControls}
                generationTimeLabel={generationTimeMs > 0 ? `${Math.round(generationTimeMs / 1000)}s` : '0s'}
                onDashboard={() => router.push('/dashboard')}
                onOpenEditor={() => {
                    if (!siteId) return
                    router.push(`/editor/${siteId}`)
                }}
                onOpenPreview={() => setIsFullPreviewOpen(true)}
                onPreviewModeChange={setPreviewMode}
                previewContent={previewContent}
                previewMode={previewMode}
                siteName={siteName || businessInfo?.businessName || 'your-site'}
                totalBlocks={blocks.length || 7}
            />
        )
    }

    return (
        <BusinessInfoForm
            floatingControls={stepPreviewControls}
            initialValues={businessInfo}
            isGenerating={false}
            onPreviewNextStep={handlePreviewNextStep}
            onSubmit={handleGenerateStart}
        />
    )
}
