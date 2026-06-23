'use client'

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
    GripVertical, ChevronDown, ChevronRight, Plus, Trash2, Pencil,
    ArrowUp, ArrowDown, ArrowRightToLine, ArrowLeftToLine,
    ExternalLink, FileText,
} from 'lucide-react'
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useI18n } from '@/i18n'
import { toast } from 'sonner'
import { isValidExternalNavigationUrl } from '@/lib/navigation-url'
import type { NavLinkItem, DropTarget } from './navigation-editor-types'

// Max label length per nav depth — prevents layout breakage on rendered nav.
// Desktop nav bar: top-level items are wider; child items appear in narrower dropdowns.
const MAX_LABEL_CHARS_TOP = 20    // depth 0 — desktop nav bar
const MAX_LABEL_CHARS_CHILD = 15  // depth 1+ — dropdown / sidebar

// ── Palette mapped to --dash-* tokens → adapts to light/dark automatically.
// (Inline styles can't be remapped by the .dash-shell layer, so reference the
//  CSS variables directly.) Exported so NavigationEditor can share it.
export const C = {
    bg: 'var(--dash-bg)',
    panel: 'var(--dash-surface)',
    row: 'var(--dash-surface)',
    rowHover: 'var(--dash-surface-hover)',
    border: 'var(--dash-border)',
    borderStrong: 'var(--dash-divider)',
    text: 'var(--dash-text)',
    text2: 'var(--dash-text-muted)',
    text3: 'var(--dash-text-muted)',
    info: 'var(--dash-accent)',
    infoBg: 'hsl(var(--primary)/0.12)',
    danger: 'var(--dash-error)',
    warning: 'var(--dash-warning)',
} as const

export function normalizePageOptionUrl(slug: string) {
    if (!slug || slug === '/') return '/'
    return slug.startsWith('/') ? slug : `/${slug}`
}

export function validateLinkUrl(link: NavLinkItem, value: string) {
    if (link.type === 'page') return value.trim().length > 0 && value !== '#'
    return value.trim().length > 0 && isValidExternalNavigationUrl(value.trim())
}

// ── Toolbar button (.tbtn — icon + text label, dark bg). iconOnly = icon only. ─
export function TBtn({ icon: Icon, label, onClick, disabled, danger, mlAuto, iconOnly, title }: {
    icon: React.ElementType
    label: string
    onClick: (e: React.MouseEvent) => void
    disabled?: boolean
    danger?: boolean
    mlAuto?: boolean
    iconOnly?: boolean
    /** Explicit tooltip — falls back to the label for icon-only buttons. Use to explain a disabled state. */
    title?: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title ?? (iconOnly ? label : undefined)}
            aria-label={iconOnly ? label : undefined}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: iconOnly ? '3px 5px' : '3px 7px', borderRadius: 5, fontSize: 10,
                border: `1px solid ${C.border}`, background: C.bg,
                color: disabled ? C.text3 : danger ? C.danger : C.text2,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                marginLeft: mlAuto ? 'auto' : undefined,
                whiteSpace: 'nowrap' as const,
                transition: 'color 0.12s, border-color 0.12s',
            }}
            onMouseEnter={e => {
                if (!disabled) {
                    e.currentTarget.style.color = danger ? C.danger : C.text
                    e.currentTarget.style.borderColor = danger ? C.danger : C.borderStrong
                }
            }}
            onMouseLeave={e => {
                if (!disabled) {
                    e.currentTarget.style.color = danger ? C.danger : C.text2
                    e.currentTarget.style.borderColor = C.border
                }
            }}
        >
            <Icon size={11} />
            {!iconOnly && label}
        </button>
    )
}

// ── Dashed "+ Add submenu" button (.add-btn) ──────────────────────────────────
export function DashedBtn({ label, onClick, mt, mb }: {
    label: string
    onClick: (e: React.MouseEvent) => void
    mt?: number
    mb?: number
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                width: '100%', padding: 9,
                background: 'transparent', border: `1px dashed ${C.borderStrong}`,
                borderRadius: 8, marginTop: mt ?? 7, marginBottom: mb ?? 0,
                fontSize: 13, color: C.text2,
                cursor: 'pointer', transition: 'border-color 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.info; e.currentTarget.style.color = C.text }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderStrong; e.currentTarget.style.color = C.text2 }}
        >
            <Plus size={14} />
            {label}
        </button>
    )
}

// ── Config field label (.field-lbl) ──────────────────────────────────────────
const fieldLblStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, color: C.text2, margin: '0 0 4px',
}

// ── Select/input (.select / .input) ───────────────────────────────────────────
const controlStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', borderRadius: 8,
    border: `1px solid ${C.border}`, background: C.bg, color: C.text,
    padding: '9px 11px', fontSize: 13, outline: 'none',
}

// ── NavLinkRow ────────────────────────────────────────────────────────────────
export interface NavLinkRowProps {
    link: NavLinkItem
    depth: number
    isFirst: boolean
    isLast: boolean
    siblingCount: number
    openPanelId: string | null
    editingNameId: string | null
    dropTarget: DropTarget
    pages?: { id: string; title: string; slug: string }[]
    onUpdate: (id: string, changes: Partial<NavLinkItem>) => void
    onDelete: (id: string) => void
    onAddChild: (parentId: string) => void
    onMoveUp: (id: string) => void
    onMoveDown: (id: string) => void
    onIndent: (id: string) => void
    onOutdent: (id: string) => void
    onSetOpenPanelId: (id: string | null) => void
    onSetEditingNameId: (id: string | null) => void
}

export function NavLinkRow({
    link, depth, isFirst, isLast, siblingCount,
    openPanelId, editingNameId, dropTarget, pages,
    onUpdate, onDelete, onAddChild,
    onMoveUp, onMoveDown, onIndent, onOutdent,
    onSetOpenPanelId, onSetEditingNameId,
}: NavLinkRowProps) {
    const { t } = useI18n()
    const nv = t.editor.navigationValidation
    const nav = t.editor.navigation

    const isPanelOpen = openPanelId === link.id
    const isEditingName = editingNameId === link.id
    const hasChildren = link.children.length > 0
    const [isExpanded, setIsExpanded] = useState(true)
    const maxLabelChars = depth === 0 ? MAX_LABEL_CHARS_TOP : MAX_LABEL_CHARS_CHILD
    const [editingLabelLen, setEditingLabelLen] = useState(link.label.length)

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: link.id })

    const nameInputRef = useRef<HTMLInputElement>(null)

    // Auto-focus on new items (require-name UX)
    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus()
            nameInputRef.current.select()
        }
    }, [isEditingName])

    // Sync char count to current label when editing opens (label may have changed since last edit)
    useEffect(() => {
        if (isEditingName) setEditingLabelLen(link.label.length)
    }, [isEditingName, link.label.length])

    const handleNameCommit = useCallback(
        (raw: string) => {
            const label = raw.trim()
            // Never-configured junk row (empty name, default url, no children) →
            // drop it instead of persisting a blank nav entry.
            if (!label && !hasChildren && (!link.url || link.url === '#')) {
                onDelete(link.id)
                onSetEditingNameId(null)
                return
            }
            onUpdate(link.id, { label })
            onSetEditingNameId(null)
        },
        [link.id, link.url, hasChildren, onUpdate, onDelete, onSetEditingNameId],
    )

    const handleUrlCommit = useCallback(
        (raw: string) => {
            const value = raw.trim()
            if (!validateLinkUrl(link, value)) {
                if (link.type === 'page') toast.error(nv.selectPageError)
                else if (!value) toast.error(nv.urlRequired)
                else toast.error(nv.invalidUrl)
                return
            }
            onUpdate(link.id, { url: value })
        },
        [link, onUpdate, nv],
    )

    // Visual states
    const isDropChildTarget = dropTarget?.mode === 'child' && dropTarget.id === link.id
    const isDropSiblingTarget = dropTarget?.mode === 'sibling' && dropTarget.id === link.id
    const isParentOfOpenPanel = depth === 0 && hasChildren && link.children.some(c => c.id === openPanelId)

    // Toolbar hide rules (per design "Quy tắc ẩn nút")
    const showMoveUp = siblingCount > 1 && !isFirst
    const showMoveDown = siblingCount > 1 && !isLast
    const showNestIn = depth === 0 && !isFirst
    const nestInDisabled = hasChildren   // active has children → depth-3 → routed to flatten confirm
    const showPromote = depth > 0

    const dragStyle: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    }

    // Card box — EVERY row is a filled card (design .row / .parent-group).
    // Focused (panel open) = blue border + glow; dim (parent of edited child) =
    // strong-grey border; otherwise the neutral row border.
    const borderColor =
        isPanelOpen || isDropChildTarget
            ? C.info
            : isParentOfOpenPanel
              ? C.borderStrong
              : C.border
    const cardStyle: React.CSSProperties = {
        background: C.row,
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        boxShadow: (isPanelOpen || isDropChildTarget) ? '0 0 0 2px hsl(var(--primary)/0.25)' : 'none',
        marginBottom: 7,
        overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.15s',
    }

    // Context toolbar (.toolbar — icon + text labels, Delete pushed right)
    const toolbar = (
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, alignItems: 'center' }}>
            {showMoveUp && <TBtn icon={ArrowUp} label={nav.moveUp} onClick={e => { e.stopPropagation(); onMoveUp(link.id) }} />}
            {showMoveDown && <TBtn icon={ArrowDown} label={nav.moveDown} onClick={e => { e.stopPropagation(); onMoveDown(link.id) }} />}
            {showNestIn && <TBtn icon={ArrowRightToLine} label={nav.nestIn} onClick={e => { e.stopPropagation(); onIndent(link.id) }} disabled={nestInDisabled} title={nestInDisabled ? nav.nestInDisabledHint : undefined} />}
            {showPromote && <TBtn icon={ArrowLeftToLine} label={nav.promote} onClick={e => { e.stopPropagation(); onOutdent(link.id) }} />}
            <TBtn icon={Trash2} label={nav.delete} onClick={e => { e.stopPropagation(); onDelete(link.id) }} danger iconOnly mlAuto />
        </div>
    )

    // Config form — hidden when item has children (parent = group trigger, no URL needed)
    const configForm = !hasChildren && (
        <>
            {/* Link type */}
            <label style={fieldLblStyle}>{nav.linkType}</label>
            <div style={{ position: 'relative', marginBottom: 12 }}>
                <select
                    value={link.type}
                    onChange={e => {
                        const nextType = e.target.value as NavLinkItem['type']
                        onUpdate(link.id, {
                            type: nextType,
                            url: nextType === 'page' ? (link.url.startsWith('/') ? link.url : '#') : (link.url === '#' ? '' : link.url),
                        })
                    }}
                    style={{ ...controlStyle, appearance: 'none' as const, paddingLeft: 30, paddingRight: 28, cursor: 'pointer' }}
                >
                    <option value="page">{nav.internalPage}</option>
                    <option value="external">{nav.externalUrl}</option>
                </select>
                {link.type === 'page'
                    ? <FileText size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.info, pointerEvents: 'none' }} />
                    : <ExternalLink size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.info, pointerEvents: 'none' }} />
                }
                <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: C.text2, pointerEvents: 'none' }} />
            </div>

            {/* Page select or URL input (mutually exclusive) */}
            {link.type === 'page' && pages ? (
                <>
                    <label style={fieldLblStyle}>{nav.pageField}</label>
                    <div style={{ position: 'relative', marginBottom: 12 }}>
                        <select
                            value={link.url}
                            onChange={e => {
                                const value = e.target.value
                                if (!validateLinkUrl(link, value)) { toast.error(nv.selectPageError); return }
                                onUpdate(link.id, { url: value })
                            }}
                            style={{ ...controlStyle, appearance: 'none' as const, paddingRight: 28, cursor: 'pointer' }}
                        >
                            <option value="#">{nav.selectPage}</option>
                            {pages.map(p => <option key={p.id} value={normalizePageOptionUrl(p.slug)}>{p.title}</option>)}
                        </select>
                        <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: C.text2, pointerEvents: 'none' }} />
                    </div>
                </>
            ) : (
                <>
                    <label style={fieldLblStyle}>{nav.urlField}</label>
                    <input
                        key={link.url}
                        defaultValue={link.url === '#' ? '' : link.url}
                        placeholder="https://..."
                        onBlur={e => handleUrlCommit(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        style={{ ...controlStyle, marginBottom: 12 }}
                    />
                </>
            )}
            {toolbar}
        </>
    )

    // Char counter color: red near limit, orange approaching, muted otherwise
    const charCounterColor = useMemo(() => {
        if (editingLabelLen >= maxLabelChars - 2) return C.danger
        if (editingLabelLen >= Math.floor(maxLabelChars * 0.75)) return C.warning
        return C.text3
    }, [editingLabelLen, maxLabelChars])

    // Inline name input (zone 2: click label = edit name inline)
    const nameEl = isEditingName ? (
        <input
            ref={nameInputRef}
            defaultValue={link.label}
            placeholder={nav.namePlaceholder}
            onChange={e => setEditingLabelLen(e.target.value.length)}
            onBlur={e => handleNameCommit(e.target.value)}
            onKeyDown={e => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') onSetEditingNameId(null)
            }}
            onClick={e => e.stopPropagation()}
            style={{ flex: 1, minWidth: 0, background: C.bg, border: '1px solid hsl(var(--primary)/0.45)', borderRadius: 6, padding: '3px 8px', fontSize: 14, color: C.text, outline: 'none' }}
        />
    ) : (
        <span
            title={link.label || undefined}
            style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, cursor: 'text' }}
            onClick={e => { e.stopPropagation(); onSetOpenPanelId(link.id); onSetEditingNameId(link.id) }}
        >
            {link.label || <em style={{ color: C.text3 }}>{nav.namePlaceholder}</em>}
        </span>
    )

    // "· missing URL" status tip (.state-tip)
    const isMissingUrl = !hasChildren && (!link.url || link.url === '#')
    const missingUrlTip = !isEditingName && isMissingUrl && (
        <span style={{ fontSize: 11, color: C.warning, whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
            · {nav.missingUrl}
        </span>
    )

    return (
        <div ref={setNodeRef} style={{ ...dragStyle, userSelect: 'none' }}>
            {/* Sibling drop indicator (.drop-line) — insert position before this row */}
            {isDropSiblingTarget && (
                <div style={{ height: 2, borderRadius: 2, background: C.info, boxShadow: `0 0 6px ${C.info}`, margin: '0 0 5px' }} />
            )}
            {/* Card (always filled + bordered) */}
            <div style={cardStyle}>
                {/* pg-header: grip(zone1) + chevron + name(zone2) + badge + pencil(zone3) */}
                <div
                    style={{
                        display: 'flex', alignItems: 'center', gap: 9, padding: '11px 12px',
                        cursor: 'pointer',
                        borderBottom: isPanelOpen ? `1px solid ${C.border}` : 'none',
                    }}
                    onClick={() => onSetOpenPanelId(isPanelOpen ? null : link.id)}
                >
                    {/* Zone 1: grip — drag only, stops click propagation */}
                    <div
                        {...attributes}
                        {...listeners}
                        style={{ cursor: 'grab', flexShrink: 0, color: C.text3, touchAction: 'none', lineHeight: 1 }}
                        onClick={e => e.stopPropagation()}
                        aria-label="Drag to reorder"
                    >
                        <GripVertical size={16} />
                    </div>

                    {/* Expand/collapse chevron (parents only) */}
                    {hasChildren && (
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setIsExpanded(v => !v) }}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.text2, flexShrink: 0, lineHeight: 1 }}
                        >
                            {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>
                    )}

                    {/* Zone 2: label (click = inline rename) */}
                    {nameEl}

                    {/* Character counter — only visible while typing the label */}
                    {isEditingName && (
                        <span
                            title={`Max ${maxLabelChars} characters`}
                            style={{ fontSize: 10, color: charCounterColor, flexShrink: 0, minWidth: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                        >
                            {editingLabelLen}/{maxLabelChars}
                        </span>
                    )}

                    {/* "· missing URL" tip (collapsed state only) */}
                    {!isPanelOpen && missingUrlTip}

                    {/* Submenu count badge (.badge-count) */}
                    {hasChildren && (
                        <span style={{ fontSize: 11, color: C.text2, background: C.bg, borderRadius: 11, padding: '2px 9px', flexShrink: 0 }}>
                            {(link.children.length === 1 ? nav.submenuCount : nav.submenuCountPlural).replace('{count}', String(link.children.length))}
                        </span>
                    )}

                    {/* Zone 3: pencil (hidden when panel open) */}
                    {!isPanelOpen && (
                        <button
                            type="button"
                            // GH-1204 #4: pencil mở panel + vào edit-name → input auto-focus (effect on isEditingName)
                            onClick={e => { e.stopPropagation(); onSetOpenPanelId(link.id); onSetEditingNameId(link.id) }}
                            style={{ background: 'none', border: 'none', padding: 0, color: C.text3, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}
                            aria-label="Edit link"
                            onMouseEnter={e => { e.currentTarget.style.color = C.text }}
                            onMouseLeave={e => { e.currentTarget.style.color = C.text3 }}
                        >
                            <Pencil size={16} />
                        </button>
                    )}
                </div>

                {/* pg-body: toolbar (has children) or config form (leaf) */}
                {isPanelOpen && (
                    <div style={{ padding: 12 }}>
                        {hasChildren ? toolbar : configForm}
                        {/* GH-1204 #5: "+ Add submenu" INSIDE the focus panel → scope rõ ràng (thuộc item
                            đang edit), tự ẩn khi đóng panel. Chỉ cho root leaf (depth 0, chưa có con). */}
                        {depth === 0 && !hasChildren && (
                            <DashedBtn label={nav.addSubmenu} onClick={e => { e.stopPropagation(); onAddChild(link.id) }} mt={12} />
                        )}
                    </div>
                )}
            </div>

            {/* Child-wrap with visible left-border guide (.child-wrap) */}
            {isExpanded && hasChildren && (
                <div style={{ marginLeft: 16, paddingLeft: 12, marginBottom: 7, borderLeft: `2px solid ${C.borderStrong}` }}>
                    <SortableContext items={link.children.map(c => c.id)} strategy={verticalListSortingStrategy}>
                        {link.children.map((child, idx) => (
                            <NavLinkRow
                                key={child.id}
                                link={child}
                                depth={depth + 1}
                                isFirst={idx === 0}
                                isLast={idx === link.children.length - 1}
                                siblingCount={link.children.length}
                                openPanelId={openPanelId}
                                editingNameId={editingNameId}
                                dropTarget={dropTarget}
                                pages={pages}
                                onUpdate={onUpdate}
                                onDelete={onDelete}
                                onAddChild={onAddChild}
                                onMoveUp={onMoveUp}
                                onMoveDown={onMoveDown}
                                onIndent={onIndent}
                                onOutdent={onOutdent}
                                onSetOpenPanelId={onSetOpenPanelId}
                                onSetEditingNameId={onSetEditingNameId}
                            />
                        ))}
                    </SortableContext>
                    {/* "+ Add submenu" — only while this group is active (parent clicked
                        OR one of its children is being edited), not always visible. */}
                    {(isPanelOpen || isParentOfOpenPanel) && (
                        <DashedBtn label={nav.addSubmenu} onClick={e => { e.stopPropagation(); onAddChild(link.id) }} mt={7} />
                    )}
                </div>
            )}
        </div>
    )
}
