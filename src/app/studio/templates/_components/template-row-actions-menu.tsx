'use client'
/**
 * Dropdown row actions menu for a single template.
 * Actions: Edit (stub), Clone, Publish, Schedule, Archive, Add to Pack.
 */
import { useState } from 'react'
import { toast } from 'sonner'
import {
    MoreHorizontal, Pencil, Copy, Rocket, Clock, Archive, Layers, Wrench,
} from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { CloneTemplateModal } from '../../_components/modals/clone-template-modal'
import { PublishTemplateModal } from '../../_components/modals/publish-template-modal'
import { ArchiveTemplateModal } from '../../_components/modals/archive-template-modal'
import { ScheduleTemplateModal } from '../../_components/modals/schedule-template-modal'
import { AddToPackModal } from '../../_components/modals/add-to-pack-modal'
import type { AdminTemplate } from '@/lib/admin/templates-query'

type Props = {
    template: AdminTemplate
    onRefresh: () => void
}

type ActiveModal = 'clone' | 'publish' | 'archive' | 'schedule' | 'add-to-pack' | null

export function TemplateRowActionsMenu({ template, onRefresh }: Props) {
    const [activeModal, setActiveModal] = useState<ActiveModal>(null)

    const handleDone = (successMsg?: string) => {
        setActiveModal(null)
        if (successMsg) toast.success(successMsg)
        onRefresh()
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <MoreHorizontal size={14} />
                        <span className="sr-only">Actions</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                    {/* Edit in builder — Phase 09 */}
                    <DropdownMenuItem asChild>
                        <a href={`/studio/templates/${template.id}/edit`}>
                            <Wrench size={13} className="mr-2" /> Edit in builder
                        </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <a href={`/admin/collections/templates/${template.id}`} target="_blank" rel="noopener noreferrer">
                            <Pencil size={13} className="mr-2" /> Edit (Payload)
                        </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setActiveModal('clone')}>
                        <Copy size={13} className="mr-2" /> Clone
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {template.status !== 'live' && (
                        <DropdownMenuItem onSelect={() => setActiveModal('publish')}>
                            <Rocket size={13} className="mr-2" /> Publish
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => setActiveModal('schedule')}>
                        <Clock size={13} className="mr-2" /> Schedule
                    </DropdownMenuItem>
                    {template.status !== 'archived' && (
                        <DropdownMenuItem
                            onSelect={() => setActiveModal('archive')}
                            className="text-destructive focus:text-destructive"
                        >
                            <Archive size={13} className="mr-2" /> Archive
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setActiveModal('add-to-pack')}>
                        <Layers size={13} className="mr-2" /> Add to pack
                    </DropdownMenuItem>
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
