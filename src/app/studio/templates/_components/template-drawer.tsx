'use client'
/**
 * Template detail drawer — tabs: Overview | Quality (Phase 03) | Issues (Phase 06) | Versions (Phase 09)
 * Opens on right side in split view. Lightweight: data already fetched in list row.
 */
import { X, ExternalLink, ImageOff } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TemplateStatusPill } from './template-status-pill'
import { QualityTab } from './quality-tab'
import { IssuesTabEmbed } from '@/app/studio/_components/issues-tab-embed'
import type { AdminTemplate } from '@/lib/admin/templates-query'

type Props = {
    template: AdminTemplate
    onClose: () => void
}

function PlaceholderTab({ phase, feature }: { phase: number; feature: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-48 text-center gap-2">
            <p className="text-sm font-medium text-muted-foreground">{feature}</p>
            <p className="text-xs text-muted-foreground">Available in Phase {phase}</p>
        </div>
    )
}

export function TemplateDrawer({ template, onClose }: Props) {
    const categoryList = Array.isArray(template.category)
        ? template.category.join(', ')
        : (template.category ?? '—')

    const tagList = template.tags?.map(t => t.tag).filter(Boolean) ?? []

    return (
        <div className="flex flex-col h-full bg-background border-l overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 p-4 border-b">
                <div className="min-w-0">
                    <h2 className="font-semibold text-sm truncate">{template.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <TemplateStatusPill status={template.status} />
                        {template.isPremium && (
                            <span className="text-xs text-amber-600 font-medium">Premium</span>
                        )}
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 rounded hover:bg-muted text-muted-foreground flex-shrink-0"
                    aria-label="Close drawer"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Thumbnail */}
            <div className="aspect-[16/10] bg-muted border-b flex-shrink-0">
                {template.thumbnail?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={template.thumbnail.url}
                        alt={template.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <ImageOff size={24} className="text-muted-foreground" />
                    </div>
                )}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="flex flex-col flex-1 min-h-0">
                <TabsList className="mx-4 mt-3 h-8 justify-start gap-1 bg-transparent p-0 border-b rounded-none w-auto">
                    {['overview', 'quality', 'issues', 'versions'].map(t => (
                        <TabsTrigger
                            key={t}
                            value={t}
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-2 pb-2 text-xs capitalize"
                        >
                            {t}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {/* Overview */}
                <TabsContent value="overview" className="flex-1 overflow-auto p-4 mt-0">
                    <dl className="space-y-3 text-sm">
                        {template.description && (
                            <div>
                                <dt className="text-xs text-muted-foreground font-medium mb-0.5">Description</dt>
                                <dd className="text-sm leading-relaxed">{template.description}</dd>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <dt className="text-xs text-muted-foreground font-medium mb-0.5">Category</dt>
                                <dd>{categoryList}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground font-medium mb-0.5">Personality</dt>
                                <dd>{template.personality ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground font-medium mb-0.5">Usage count</dt>
                                <dd>{template.usageCount ?? 0}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground font-medium mb-0.5">Featured</dt>
                                <dd>{template.isFeatured ? 'Yes' : 'No'}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground font-medium mb-0.5">Created</dt>
                                <dd>{new Date(template.createdAt).toLocaleDateString()}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground font-medium mb-0.5">Updated</dt>
                                <dd>{new Date(template.updatedAt).toLocaleDateString()}</dd>
                            </div>
                        </div>
                        {template.scheduledFor && (
                            <div>
                                <dt className="text-xs text-muted-foreground font-medium mb-0.5">Scheduled for</dt>
                                <dd>{new Date(template.scheduledFor).toLocaleString()}</dd>
                            </div>
                        )}
                        {tagList.length > 0 && (
                            <div>
                                <dt className="text-xs text-muted-foreground font-medium mb-1">Tags</dt>
                                <dd className="flex flex-wrap gap-1">
                                    {tagList.map(tag => (
                                        <span key={tag} className="px-2 py-0.5 bg-muted rounded-full text-xs">{tag}</span>
                                    ))}
                                </dd>
                            </div>
                        )}
                        {template.previewUrl && (
                            <div>
                                <dt className="text-xs text-muted-foreground font-medium mb-0.5">Preview URL</dt>
                                <dd>
                                    <a
                                        href={template.previewUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary text-xs flex items-center gap-1 hover:underline"
                                    >
                                        Open preview <ExternalLink size={11} />
                                    </a>
                                </dd>
                            </div>
                        )}
                    </dl>
                </TabsContent>

                <TabsContent value="quality" className="flex-1 overflow-auto mt-0">
                    <QualityTab templateId={template.id} />
                </TabsContent>

                <TabsContent value="issues" className="flex-1 overflow-auto mt-0">
                    <IssuesTabEmbed relatedType="template" relatedId={String(template.id)} />
                </TabsContent>

                <TabsContent value="versions" className="flex-1 overflow-auto mt-0">
                    <PlaceholderTab phase={9} feature="Version history & rollback" />
                </TabsContent>
            </Tabs>
        </div>
    )
}
