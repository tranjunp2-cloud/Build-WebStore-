'use client'
/**
 * Row actions dropdown — bundle .kebab + popover menu design.
 * Uses shadcn DropdownMenu for accessibility, styled with kebab trigger.
 */
import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Copy, Rocket, Clock, Archive, Layers, Wrench, Send } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CloneTemplateModal }   from '../../_components/modals/clone-template-modal'
import { PublishTemplateModal } from '../../_components/modals/publish-template-modal'
import { ArchiveTemplateModal } from '../../_components/modals/archive-template-modal'
import { ScheduleTemplateModal } from '../../_components/modals/schedule-template-modal'
import { AddToPackModal }       from '../../_components/modals/add-to-pack-modal'
import { patchTemplate, type AdminTemplate } from '@/lib/admin/templates-query'
import { canEditTemplateContent, canSetTemplateStatus } from '@/lib/admin/studio-permissions'
import { useStudioCan, useStudioRoles } from '../../_components/studio-permissions-context'

type Props = {
    template: AdminTemplate
    onRefresh: () => void
}

type ActiveModal = 'clone' | 'publish' | 'archive' | 'schedule' | 'add-to-pack' | null

export function TemplateRowActionsMenu({ template, onRefresh }: Props) {
    const [activeModal, setActiveModal] = useState<ActiveModal>(null)
    const roles = useStudioRoles()
    const can = useStudioCan()
    const canClone = can('template.create')
    const canReview = can('template.review')
    const canSendForReview = template.status === 'draft' && canSetTemplateStatus(roles, 'draft', 'review')
    const canArchive = template.status !== 'archived' && canSetTemplateStatus(roles, template.status, 'archived')
    const canAddToPack = can('pack.edit')
    const showStatusGroup = canSendForReview || canReview || canArchive

    const handleSendForReview = async () => {
        try {
            await patchTemplate(template.id, { status: 'review' })
            handleDone('Template sent for review')
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not send for review')
        }
    }

    const handleDone = (msg?: string) => {
        setActiveModal(null)
        if (msg) toast.success(msg)
        onRefresh()
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    {/* Bundle-matched kebab trigger */}
                    <button className="kebab" aria-label="Row actions">
                        <MoreHorizontal size={14} />
                    </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    align="end"
                    /* Override shadcn defaults to match bundle popover style */
                    style={{
                        width: 180,
                        background: 'var(--bg-elev)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        padding: 4,
                        boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                        fontSize: 13,
                    }}
                >
                    <DropdownMenuItem asChild>
                        <Link href={`/studio/templates/${template.id}/edit`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Wrench size={13} /> Edit in builder
                        </Link>
                    </DropdownMenuItem>
                    {canEditTemplateContent(roles, template.status) && (
                        <DropdownMenuItem asChild>
                            <a
                                href={`/admin/collections/templates/${template.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                                <Pencil size={13} /> Edit (Payload)
                            </a>
                        </DropdownMenuItem>
                    )}
                    {canClone && (
                        <DropdownMenuItem onSelect={() => setActiveModal('clone')} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Copy size={13} /> Clone template
                        </DropdownMenuItem>
                    )}

                    {showStatusGroup && <DropdownMenuSeparator style={{ background: 'var(--border)', margin: '4px 0' }} />}

                    {canSendForReview && (
                        <DropdownMenuItem
                            onSelect={() => { void handleSendForReview() }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                            <Send size={13} /> Send for review
                        </DropdownMenuItem>
                    )}
                    {canReview && template.status !== 'live' && (
                        <DropdownMenuItem
                            onSelect={() => setActiveModal('publish')}
                            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                            <Rocket size={13} /> Publish
                        </DropdownMenuItem>
                    )}
                    {canReview && (
                        <DropdownMenuItem
                            onSelect={() => setActiveModal('schedule')}
                            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                            <Clock size={13} /> Schedule
                        </DropdownMenuItem>
                    )}
                    {canArchive && (
                        <DropdownMenuItem
                            onSelect={() => setActiveModal('archive')}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}
                        >
                            <Archive size={13} /> Archive
                        </DropdownMenuItem>
                    )}

                    {canAddToPack && (
                        <>
                            <DropdownMenuSeparator style={{ background: 'var(--border)', margin: '4px 0' }} />
                            <DropdownMenuItem
                                onSelect={() => setActiveModal('add-to-pack')}
                                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                                <Layers size={13} /> Add to pack
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {activeModal === 'clone' && (
                <CloneTemplateModal
                    template={template}
                    onClose={() => setActiveModal(null)}
                    onCloned={() => handleDone('Template cloned')}
                />
            )}
            {activeModal === 'publish' && (
                <PublishTemplateModal
                    template={template}
                    onClose={() => setActiveModal(null)}
                    onPublished={() => handleDone('Template published')}
                />
            )}
            {activeModal === 'archive' && (
                <ArchiveTemplateModal
                    template={template}
                    onClose={() => setActiveModal(null)}
                    onArchived={() => handleDone('Template archived')}
                />
            )}
            {activeModal === 'schedule' && (
                <ScheduleTemplateModal
                    template={template}
                    onClose={() => setActiveModal(null)}
                    onScheduled={() => handleDone('Template scheduled')}
                />
            )}
            {activeModal === 'add-to-pack' && (
                <AddToPackModal
                    templateId={String(template.id)}
                    templateName={template.name}
                    onClose={() => setActiveModal(null)}
                    onAdded={() => handleDone(`Added "${template.name}" to pack`)}
                />
            )}
        </>
    )
}
