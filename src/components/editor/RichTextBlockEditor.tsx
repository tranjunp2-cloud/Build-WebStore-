'use client'

import { useMemo, useRef, useEffect, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Undo2, Redo2, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter,
    AlignRight, AlignJustify, List, ListOrdered, IndentIncrease, IndentDecrease,
    Link2, ImagePlus, Upload, Table, Quote, type LucideIcon } from 'lucide-react'
import { RichTextImage } from './rich-text-image'
import { TableKit } from '@tiptap/extension-table'
import { TextStyleKit } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import { sanitizeRichHtml, mediaEmbedUrl } from '@/blocks/custom-html/html-safety'
import Typography from '@tiptap/extension-typography'
import { RichTextMedia } from './rich-text-media'
import { normalizePw1RichHtml } from './normalize-pw1-rich-html'
import { colorToHex } from './rich-text-colors'
import { useUploadProgress } from '@/hooks/use-upload-progress'
import { LegacyAttributes, LegacyCaption, LegacyContainer } from './rich-text-extensions'
import './rich-text-block-editor.css'

const TOOL_ICONS: Record<string, LucideIcon> = {
    Undo: Undo2, Redo: Redo2, Bold, Italic, Underline, Strike: Strikethrough,
    left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify,
    Bullets: List, Numbered: ListOrdered, Indent: IndentIncrease, Outdent: IndentDecrease,
    Link: Link2, 'Image URL': ImagePlus, 'Upload image': Upload, Table, Quote,
}

interface Props { html: string; onApply: (html: string) => void; onCancel: () => void; onReady?: () => void }

export default function RichTextBlockEditor({ html, onApply, onCancel, onReady }: Props) {
    const safeHtml = useMemo(() => normalizePw1RichHtml(html), [html])
    const rootRef = useRef<HTMLDivElement>(null)
    const toolbarRef = useRef<HTMLDivElement>(null)
    const fileRef = useRef<HTMLInputElement>(null)
    const finished = useRef(false)
    const dirty = useRef(false)
    const readyCallback = useRef(onReady)
    readyCallback.current = onReady
    const { upload, isUploading } = useUploadProgress()
    const [error, setError] = useState('')
    const [panel, setPanel] = useState<'link' | 'image' | 'media' | null>(null)
    const [url, setUrl] = useState('')
    const [alt, setAlt] = useState('')
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [StarterKit.configure({ link: { openOnClick: false } }),
            RichTextImage.configure({ inline: true }),
            TableKit.configure({ table: { resizable: true } }), TextStyleKit,
            TextAlign.configure({ types: ['heading', 'paragraph'] }), LegacyContainer, LegacyCaption, LegacyAttributes, RichTextMedia, Typography],
        content: safeHtml,
        editorProps: { attributes: { class: 'pw2-rich-text-content', 'aria-label': 'Rich text content' } },
        onUpdate: () => { dirty.current = true },
    })
    useEditorState({ editor, selector: ({ editor: current }) => current ? current.state : null })

    useEffect(() => {
        if (!editor) return
        readyCallback.current?.()
        const frame = requestAnimationFrame(() => { if (!editor.isDestroyed) editor.commands.focus() })
        return () => cancelAnimationFrame(frame)
    }, [editor])

    useEffect(() => {
        if (!editor) return
        const root = rootRef.current
        const toolbar = toolbarRef.current
        const block = root?.closest('.custom-html-block')
        if (!root || !toolbar || !block) return
        const resize = () => {
            const bounds = block.getBoundingClientRect()
            const local = root.getBoundingClientRect()
            toolbar.style.width = `${bounds.width - 4}px`
            toolbar.style.left = `${bounds.left - local.left + 2}px`
            toolbar.style.top = `${bounds.top - local.top + 2}px`
            root.style.paddingTop = `${Math.max(0, toolbar.offsetHeight + 8 - (local.top - bounds.top))}px`
        }
        const observer = new ResizeObserver(resize)
        observer.observe(block)
        observer.observe(toolbar)
        resize()
        return () => observer.disconnect()
    }, [editor])

    useEffect(() => {
        if (!editor) return
        const finish = (cancel: boolean) => {
            if (finished.current || isUploading) return
            finished.current = true
            if (cancel || !dirty.current) onCancel()
            else onApply(sanitizeRichHtml(editor.getHTML()) || '<p></p>')
        }
        const outside = (event: PointerEvent) => {
            if (rootRef.current?.contains(event.target as Node)) return
            // Keep URL/upload controls open until the user confirms or cancels them.
            if (panel) return
            const active = document.activeElement
            if (active instanceof HTMLElement && rootRef.current?.contains(active)) active.blur()
            finish(false)
        }
        const escape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            event.stopPropagation()
            if (panel) setPanel(null)
            else finish(true)
        }
        document.addEventListener('pointerdown', outside)
        document.addEventListener('keydown', escape, true)
        const parentDocument = window.parent !== window ? window.parent.document : null
        parentDocument?.addEventListener('pointerdown', outside)
        return () => {
            document.removeEventListener('pointerdown', outside)
            document.removeEventListener('keydown', escape, true)
            parentDocument?.removeEventListener('pointerdown', outside)
        }
    }, [editor, isUploading, onApply, onCancel, panel])

    if (!editor) return null
    const button = (label: string, action: () => void, active = false, disabled = false) => {
        const Icon = TOOL_ICONS[label]
        return <button type="button" key={label} title={label} aria-label={label} aria-pressed={active} disabled={disabled}
            onMouseDown={e => e.preventDefault()} onClick={action}>{Icon ? <Icon size={16} aria-hidden="true" /> : label}</button>
    }
    const updateImage = (attributes: Record<string, unknown>) => {
        const position = editor.state.selection.from
        editor.chain().updateAttributes('image', attributes).setNodeSelection(position).run()
    }
    const openUrl = (kind: 'link' | 'image' | 'media') => {
        setPanel(kind); setError(''); setAlt('')
        setUrl(kind === 'link' ? String(editor.getAttributes('link').href || '') : '')
    }
    const insertUrl = () => {
        const value = url.trim()
        if (panel === 'link' && !value) { editor.chain().focus().unsetLink().run(); setPanel(null); return }
        if (!/^(https?:\/\/|\/(?!\/)|#)/i.test(value)) { setError('Use an https:// URL, /path or #anchor.'); return }
        if (panel === 'media') {
            const embed = mediaEmbedUrl(value)
            const mediaUrl = new URL(value, window.location.origin)
            if (embed) {
                const iframe = document.createElement('iframe'); iframe.src = embed; iframe.title = 'Embedded media'
                const figure = document.createElement('figure'); figure.className = 'media'; figure.appendChild(iframe)
                editor.chain().focus().insertContent({ type: 'richTextMedia', attrs: { html: sanitizeRichHtml(figure.outerHTML) } }).run()
            } else if (mediaUrl.protocol === 'https:' && /\.(mp4|webm|mp3|ogg|wav)$/i.test(mediaUrl.pathname)) {
                const media = document.createElement(/\.(mp3|ogg|wav)$/i.test(mediaUrl.pathname) ? 'audio' : 'video'); media.src = mediaUrl.href; media.controls = true
                editor.chain().focus().insertContent({ type: 'richTextMedia', attrs: { html: sanitizeRichHtml(media.outerHTML) } }).run()
            } else { setError('Use YouTube, Vimeo, an approved embed URL, or an HTTPS video/audio file.'); return }
        }
        else if (panel === 'image') editor.chain().focus().setImage({ src: value, alt }).run()
        else editor.chain().focus().extendMarkRange('link').setLink({ href: value }).run()
        setPanel(null)
    }
    return <div ref={rootRef} className="rich-text-block-editor">
        <div ref={toolbarRef} className="pw2-rich-toolbar" role="toolbar" aria-label="Rich text formatting" data-editor-control="rich-text-toolbar">
            {button('Undo', () => { editor.chain().focus().undo().run() }, false, !editor.can().undo())}
            {button('Redo', () => { editor.chain().focus().redo().run() }, false, !editor.can().redo())}
            <select aria-label="Heading" value={editor.getAttributes('heading').level || 'p'} onChange={e => {
                const level = Number(e.target.value) as 1 | 2 | 3 | 4 | 5 | 6
                if (level) editor.chain().focus().setHeading({ level }).run()
                else editor.chain().focus().setParagraph().run()
            }}><option value="p">Paragraph</option>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>Heading {n}</option>)}</select>
            {button('Bold', () => { editor.chain().focus().toggleBold().run() }, editor.isActive('bold'))}
            {button('Italic', () => { editor.chain().focus().toggleItalic().run() }, editor.isActive('italic'))}
            {button('Underline', () => { editor.chain().focus().toggleUnderline().run() }, editor.isActive('underline'))}
            {button('Code', () => { editor.chain().focus().toggleCode().run() }, editor.isActive('code'))}
            {button('Strike', () => { editor.chain().focus().toggleStrike().run() }, editor.isActive('strike'))}
            <select aria-label="Font family" value={editor.getAttributes('textStyle').fontFamily || ''} onChange={e => { editor.chain().focus().setFontFamily(e.target.value).run() }}>
                <option value="">Site font</option>{Array.from(new Set([editor.getAttributes('textStyle').fontFamily, 'Arial, Helvetica, sans-serif', 'Courier New, Courier, monospace', 'Georgia, serif', 'Lucida Sans Unicode, Lucida Grande, sans-serif', 'Tahoma, Geneva, sans-serif', 'Times New Roman, Times, serif', 'Trebuchet MS, Helvetica, sans-serif', 'Verdana, Geneva, sans-serif'].filter(Boolean))).map(font => <option key={font} value={font}>{font.split(',')[0].replace(/["']/g, '')}</option>)}</select>
            <input aria-label="Font size" list="pw2-font-sizes" placeholder="Size" key={`size-${editor.getAttributes('textStyle').fontSize || ''}`}
                defaultValue={editor.getAttributes('textStyle').fontSize || ''} onBlur={e => {
                    const value = e.target.value.trim()
                    if (!value) editor.chain().focus().unsetFontSize().run()
                    else if (/^\d+(\.\d+)?(px|em|rem|%)?$/.test(value)) editor.chain().focus().setFontSize(/^\d+(\.\d+)?$/.test(value) ? `${value}px` : value).run()
                }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }} />
            <datalist id="pw2-font-sizes">{[9, 11, 13, 16, 17, 19, 21, 24, 32, 40, 48, 60].map(size => <option key={size} value={`${size}px`} />)}</datalist>
            <label title="Text color">A <input aria-label="Text color" type="color" value={colorToHex(editor.getAttributes('textStyle').color)} onChange={e => { editor.chain().focus().setColor(e.target.value).run() }} /></label>
            <label title="Background color">Highlight <input aria-label="Background color" type="color" value={colorToHex(editor.getAttributes('textStyle').backgroundColor, '#ffffff')} onChange={e => { editor.chain().focus().setBackgroundColor(e.target.value).run() }} /></label>
            {(['left', 'center', 'right', 'justify'] as const).map(align => button(align, () => { editor.chain().focus().setTextAlign(align).run() }, editor.isActive({ textAlign: align })))}
            {button('Bullets', () => { editor.chain().focus().toggleBulletList().run() }, editor.isActive('bulletList'))}
            {button('Numbered', () => { editor.chain().focus().toggleOrderedList().run() }, editor.isActive('orderedList'))}
            {button('Indent', () => { editor.chain().focus().sinkListItem('listItem').run() }, false, !editor.can().sinkListItem('listItem'))}
            {button('Outdent', () => { editor.chain().focus().liftListItem('listItem').run() }, false, !editor.can().liftListItem('listItem'))}
            {button('Link', () => openUrl('link'), editor.isActive('link'))}
            {button('Image URL', () => openUrl('image'))}
            {button(isUploading ? 'Uploading…' : 'Upload image', () => fileRef.current?.click(), false, isUploading)}
            {button('Table', () => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() })}
            {button('Quote', () => { editor.chain().focus().toggleBlockquote().run() }, editor.isActive('blockquote'))}
            {editor.isActive('table') && <>
                {button('+ Row', () => { editor.chain().focus().addRowAfter().run() })}
                {button('− Row', () => { editor.chain().focus().deleteRow().run() })}
                {button('+ Column', () => { editor.chain().focus().addColumnAfter().run() })}
                {button('− Column', () => { editor.chain().focus().deleteColumn().run() })}
                {button('Merge cells', () => { editor.chain().focus().mergeCells().run() }, false, !editor.can().mergeCells())}
                {button('Split cell', () => { editor.chain().focus().splitCell().run() }, false, !editor.can().splitCell())}
                {button('Delete table', () => { editor.chain().focus().deleteTable().run() })}
            </>}
            {editor.isActive('image') && <>
                <select aria-label="Image layout" value={editor.getAttributes('image').imageLayout || 'inline'} onChange={e => updateImage({ imageLayout: e.target.value })}>
                    <option value="inline">Inline image</option>
                    <option value="left">Image left · wrap text</option>
                    <option value="right">Image right · wrap text</option>
                    <option value="standalone">Standalone image</option>
                </select>
                <label>Spacing <input aria-label="Image spacing" type="number" min={0} max={64} value={editor.getAttributes('image').imageGap ?? 16}
                    onChange={e => updateImage({ imageGap: Math.min(64, Math.max(0, Number(e.target.value) || 0)) })} /></label>
                {button('Caption', () => updateImage({ showCaption: !editor.getAttributes('image').showCaption }), Boolean(editor.getAttributes('image').showCaption))}
                {editor.getAttributes('image').showCaption && <input aria-label="Image caption" placeholder="Caption" value={editor.getAttributes('image').caption || ''} onChange={e => updateImage({ caption: e.target.value, captionHtml: '' })} />}
                {button('Remove image', () => { editor.chain().focus().deleteSelection().run() })}

                <input aria-label="Image alternative text" placeholder="Image description" value={editor.getAttributes('image').alt || ''} onChange={e => updateImage({ alt: e.target.value })} />
                <input aria-label="Image width" type="text" placeholder="240px / 50%" key={`width-${editor.getAttributes('image').cssWidth || editor.getAttributes('image').width || ''}`} defaultValue={editor.getAttributes('image').cssWidth || editor.getAttributes('image').width || ''} onBlur={e => {
                    const width = e.target.value.trim()
                    if (/^\d+(\.\d+)?%$/.test(width) && parseFloat(width) <= 100) updateImage({ cssWidth: width, width: null, height: null })
                    else if (/^\d+(px)?$/.test(width)) updateImage({ width: Math.max(24, parseInt(width)), cssWidth: null, height: null })
                }} />
            </>}
            {panel && <div className="pw2-rich-url-panel">
                <input autoFocus aria-label={panel === 'link' ? 'Link URL' : panel === 'media' ? 'Media URL' : 'Image URL'} placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); insertUrl() } }} />
                {panel === 'image' && <input aria-label="Image description" placeholder="Image description" value={alt} onChange={e => setAlt(e.target.value)} />}
                {button('Insert', insertUrl)}{button('Cancel', () => setPanel(null))}
            </div>}
            {error && <span role="alert">{error}</span>}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={async event => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) { setError('Choose a JPG, PNG, WebP or GIF image.'); return }
            try {
                setError('')
                const data = new FormData(); data.append('file', file); data.append('alt', file.name)
                const media = await upload(data)
                if (!editor.isDestroyed) editor.chain().focus().setImage({ src: media.url, alt: file.name }).run()
            } catch (cause) { setError(cause instanceof Error ? cause.message : 'Upload failed') }
        }} />
        <EditorContent editor={editor} />
    </div>
}
