'use client'

import { CKEditor } from '@ckeditor/ckeditor5-react'
import {
    ClassicEditor,
    Essentials,
    Bold,
    Italic,
    Underline,
    Link,
    Image,
    ImageInsert,
    ImageUpload,
    List,
    BlockQuote,
    Paragraph,
    Heading,
    Indent,
    Undo,
    FileRepository,
    Code,
    type UploadAdapter,
    type FileLoader,
    type Editor,
    Plugin,
} from 'ckeditor5'
import { AutoLink } from '@ckeditor/ckeditor5-link'
import 'ckeditor5/ckeditor5.css'
import { useState, useEffect } from 'react'
import { uploadMediaAction } from '@/app/(dashboard)/actions/media'
import { useI18n } from '@/i18n'

// Custom Upload Adapter — uses server action to upload to Payload CMS
class PayloadUploadAdapter implements UploadAdapter {
    private loader: FileLoader

    constructor(loader: FileLoader) {
        this.loader = loader
    }

    async upload(): Promise<{ default: string;[key: string]: string }> {
        const file = await this.loader.file

        if (!file) {
            throw new Error('No file selected')
        }

        const formData = new FormData()
        formData.append('file', file)

        // Use server action — bypasses REST API cookie auth
        const doc = await uploadMediaAction(formData)

        // Fix Docker-internal MinIO URL to browser-accessible URL
        const s3Public = process.env.NEXT_PUBLIC_S3_ENDPOINT || 'http://localhost:9000'
        const fixUrl = (url: string) => {
            if (!url) return url
            return url.replace(/https?:\/\/minio:\d+/, s3Public)
        }

        const baseUrl = fixUrl(doc.url || '')
        const urls: { default: string;[key: string]: string } = {
            default: baseUrl,
        }

        if (doc.sizes) {
            if (doc.sizes.hero?.url) urls['1920'] = fixUrl(doc.sizes.hero.url)
            if (doc.sizes.card?.url) urls['768'] = fixUrl(doc.sizes.card.url)
            if (doc.sizes.thumbnail?.url) urls['400'] = fixUrl(doc.sizes.thumbnail.url)
        }

        return urls
    }

    abort(): void {
        // Server actions don't support abort
    }
}

// CKEditor Plugin to register the custom upload adapter
class PayloadUploadAdapterPlugin extends Plugin {
    static get requires() {
        return [FileRepository] as const
    }

    static get pluginName() {
        return 'PayloadUploadAdapter' as const
    }

    init() {
        this.editor.plugins.get(FileRepository).createUploadAdapter = (loader: FileLoader) => {
            return new PayloadUploadAdapter(loader)
        }
    }
}

interface BlogRichEditorProps {
    content: string
    onChange: (html: string) => void
    placeholder?: string
}

export function BlogRichEditor({ content, onChange, placeholder }: BlogRichEditorProps) {
    const { t } = useI18n()
    const resolvedPlaceholder = placeholder ?? t.dashboard.blog.editor.startWriting
    const [charCount, setCharCount] = useState(0)
    const [editorInstance, setEditorInstance] = useState<Editor | null>(null)
    const [selectedText, setSelectedText] = useState('')
    const [showImproveMenu, setShowImproveMenu] = useState(false)
    const [improveMenuPos, setImproveMenuPos] = useState({ top: 0, left: 0 })
    const [isRewriting, setIsRewriting] = useState(false)

    // Sync placeholder text when locale changes (CKEditor config only applies on mount)
    useEffect(() => {
        if (!editorInstance) return
        const root = editorInstance.editing.view.document.getRoot()
        if (root) {
            editorInstance.editing.view.change(writer => {
                writer.setAttribute('data-placeholder', resolvedPlaceholder, root)
            })
        }
    }, [editorInstance, resolvedPlaceholder])

    // Sync character count to the custom DOM element injected in toolbar
    useEffect(() => {
        const update = () => {
            const el = document.getElementById('ck-char-count')
            if (el) el.textContent = `${charCount} ${t.dashboard.blog.editor.characters}`
        }
        update()
        const id = setTimeout(update, 150)
        return () => clearTimeout(id)
    }, [charCount, t.dashboard.blog.editor.characters])

    const handleImproveText = async (instruction: string) => {
        if (!editorInstance || !selectedText.trim()) return
        setIsRewriting(true)
        setShowImproveMenu(false)
        try {
            const res = await fetch('/api/ai/rewrite-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ text: selectedText, instruction }),
            })
            if (res.ok) {
                const { rewritten } = await res.json()
                if (rewritten && rewritten !== selectedText) {
                    const viewDoc = editorInstance.editing.view.document
                    const selection = viewDoc.selection
                    if (!selection.isCollapsed) {
                        editorInstance.model.change(writer => {
                            const modelSelection = editorInstance.model.document.selection
                            const range = modelSelection.getFirstRange()
                            if (range) {
                                writer.remove(range)
                                writer.insertText(rewritten, range.start)
                            }
                        })
                    }
                }
            }
        } catch (err) {
            console.error('[Improve Text]', err)
        } finally {
            setIsRewriting(false)
            setSelectedText('')
        }
    }

    return (
        <div className="blog-ckeditor-wrapper relative flex flex-col bg-[var(--dash-secondary-bg)] border border-[var(--dash-border)] rounded-[16px] overflow-hidden">
            {/* Improve Text floating menu */}
            {showImproveMenu && selectedText && (
                <div
                    className="absolute z-50 flex flex-col gap-1 p-2 bg-popover border border-border rounded-xl shadow-2xl min-w-[180px]"
                    style={{ top: improveMenuPos.top, left: improveMenuPos.left }}
                >
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">{t.dashboard.blog.editor.aiImproveLabel}</span>
                    {[
                        { label: t.dashboard.blog.editor.aiMakeProfessional, instruction: 'Rewrite this text to sound more professional and polished' },
                        { label: t.dashboard.blog.editor.aiMakeShorter, instruction: 'Make this text shorter and more concise while keeping the meaning' },
                        { label: t.dashboard.blog.editor.aiImproveWriting, instruction: 'Improve the grammar, clarity, and readability of this text' },
                    ].map((action) => (
                        // Kept as raw <button>: absolute-positioned floating menu over CKEditor — Radix
                        // DropdownMenu cannot anchor to a selection rect; custom positioning is required.
                        <button
                            key={action.label}
                            onClick={() => handleImproveText(action.instruction)}
                            className="text-left px-3 py-2 text-sm text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            {action.label}
                        </button>
                    ))}
                    {/* Kept as raw <button>: same reason as above */}
                    <button
                        onClick={() => setShowImproveMenu(false)}
                        className="text-left px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {t.dashboard.blog.editor.cancel}
                    </button>
                </div>
            )}
            {isRewriting && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-[16px]">
                    <div className="flex items-center gap-2 text-sm text-[var(--dash-text)] bg-[var(--dash-secondary-bg)] px-4 py-2 rounded-lg border border-[var(--dash-border)]">
                        <div className="w-4 h-4 border-2 border-[var(--dash-border)] border-t-[var(--dash-text-muted)] rounded-full animate-spin" />
                        {t.dashboard.blog.editor.aiRewriting}
                    </div>
                </div>
            )}
            <CKEditor
                editor={ClassicEditor}
                config={{
                    licenseKey: 'GPL',
                    plugins: [
                        Essentials,
                        Bold,
                        Italic,
                        Underline,
                        Link,
                        AutoLink,
                        Image,
                        ImageInsert,
                        ImageUpload,
                        List,
                        BlockQuote,
                        Paragraph,
                        Heading,
                        Indent,
                        Undo,
                        Code,
                        PayloadUploadAdapterPlugin,
                    ],
                    toolbar: {
                        items: [
                            'bold', 'italic', 'underline',
                            '|',
                            'bulletedList', 'numberedList',
                            '|',
                            'link', 'blockQuote',
                            'code'
                        ],
                    },
                    placeholder: resolvedPlaceholder,
                    link: {
                        addTargetToExternalLinks: true,
                        defaultProtocol: 'https://',
                    },
                    image: {
                        insert: {
                            type: 'inline' as const,
                            integrations: ['upload', 'url'],
                        },
                    },
                }}
                data={content}
                onChange={(_event, editor) => {
                    const html = editor.getData()
                    onChange(html)
                    const div = document.createElement('div')
                    div.innerHTML = html
                    setCharCount(div.textContent?.length || 0)
                }}
                onReady={(editor) => {
                    setEditorInstance(editor)
                    const html = editor.getData()
                    const div = document.createElement('div')
                    div.innerHTML = html
                    setCharCount(div.textContent?.length || 0)

                    // DOM manipulation to match Figma toolbar
                    const toolbar = editor.ui.view.toolbar.element
                    if (toolbar) {
                        const itemsContainer = toolbar.querySelector('.ck-toolbar__items') as HTMLElement
                        if (itemsContainer) {
                            itemsContainer.style.flexWrap = 'wrap'
                            
                            // Add a flex-grow spacer to push character count to the right
                            const spacerDiv = document.createElement('div')
                            spacerDiv.style.flexGrow = '1'
                            itemsContainer.appendChild(spacerDiv)

                            // Inject character count to the right side (inline styles — Tailwind classes unreliable on DOM-created elements)
                            const charCountDiv = document.createElement('div')
                            charCountDiv.id = 'ck-char-count'
                            Object.assign(charCountDiv.style, {
                                fontFamily: "'Inter', sans-serif",
                                fontWeight: '400',
                                fontSize: '12px',
                                lineHeight: '1.333',
                                color: 'var(--dash-text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                paddingRight: '8px',
                            })
                            charCountDiv.textContent = `${div.textContent?.length || 0} ${t.dashboard.blog.editor.characters}`
                            itemsContainer.appendChild(charCountDiv)
                        }
                    }

                    // Listen for selection changes to show "Improve Text" menu
                    editor.editing.view.document.on('selectionChange', () => {
                        const modelSel = editor.model.document.selection
                        const range = modelSel.getFirstRange()
                        if (!range || modelSel.isCollapsed) {
                            setSelectedText('')
                            setShowImproveMenu(false)
                            return
                        }
                        let text = ''
                        for (const item of range.getItems()) {
                            if (item.is('$textProxy')) text += item.data
                        }
                        setSelectedText(text)
                    })

                    // Show improve menu on mouseup when text is selected
                    editor.editing.view.document.on('mouseup', () => {
                        setTimeout(() => {
                            const nativeSel = window.getSelection()
                            if (nativeSel && nativeSel.toString().trim().length > 3) {
                                const rect = nativeSel.getRangeAt(0).getBoundingClientRect()
                                const wrapper = (editor.editing.view.getDomRoot() as HTMLElement)?.closest('.blog-ckeditor-wrapper')
                                if (wrapper) {
                                    const wrapperRect = wrapper.getBoundingClientRect()
                                    setImproveMenuPos({
                                        top: rect.bottom - wrapperRect.top + 8,
                                        left: Math.min(rect.left - wrapperRect.left, wrapperRect.width - 200),
                                    })
                                    setShowImproveMenu(true)
                                }
                            }
                        }, 50)
                    })
                }}
            />

            {/* Complete theme CSS overrides */}
            <style jsx global>{`
                /* ===== EDITOR WRAPPER ===== */
                .blog-ckeditor-wrapper {
                    border: 1px solid var(--dash-border) !important;
                }
                .blog-ckeditor-wrapper .ck.ck-editor {
                    width: 100%;
                    border: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__top,
                .blog-ckeditor-wrapper .ck.ck-editor__top .ck-sticky-panel,
                .blog-ckeditor-wrapper .ck.ck-editor__top .ck-sticky-panel__content {
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__top .ck-sticky-panel__placeholder {
                    display: none !important;
                    height: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                /* ===== DISABLE STICKY TOOLBAR TO FIX GAP AND OVERLAP ISSUES ===== */
                .blog-ckeditor-wrapper .ck.ck-sticky-panel .ck-sticky-panel__content_sticky {
                    position: static !important;
                    top: auto !important;
                    width: auto !important;
                    box-shadow: none !important;
                }

                @media (max-width: 1279px) {
                    .blog-ckeditor-wrapper .ck.ck-editor__main {
                        order: 2 !important;
                    }
                    .blog-ckeditor-wrapper .ck.ck-editor {
                        display: flex !important;
                        flex-direction: column !important;
                    }
                    .blog-ckeditor-wrapper .ck.ck-editor__editable {
                        min-height: 300px !important;
                    }
                    .blog-ckeditor-wrapper .ck.ck-toolbar {
                        padding: 0 8px 8px 8px !important;
                    }
                    .blog-ckeditor-wrapper .ck.ck-button {
                        min-width: 44px !important;
                        min-height: 44px !important;
                        padding: 8px !important;
                    }
                }
                .blog-ckeditor-wrapper .ck.ck-editor__top {
                    border-bottom: 1px solid var(--dash-border) !important;
                }

                /* ===== TOOLBAR ===== */
                .blog-ckeditor-wrapper .ck.ck-toolbar {
                    background: var(--dash-bg) !important;
                    border: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    min-height: unset !important;
                }
                .blog-ckeditor-wrapper .ck.ck-toolbar__items {
                    padding: 12px !important;
                    margin: 0 !important;
                    gap: 8px !important;
                    align-items: center !important;
                    align-content: flex-start !important;
                }
                .blog-ckeditor-wrapper .ck.ck-toolbar__separator {
                    background: var(--dash-border) !important;
                    width: 1px !important;
                    height: 24px !important;
                    margin: 0 8px !important;
                }
                .blog-ckeditor-wrapper .ck.ck-toolbar .ck-toolbar__separator {
                    background: var(--dash-border) !important;
                }
                .blog-ckeditor-wrapper .ck.ck-toolbar .ck-toolbar__items > .ck-dropdown > .ck-button .ck-icon {
                    color: var(--dash-text-muted) !important;
                }

                /* ===== TOOLBAR BUTTONS ===== */
                .blog-ckeditor-wrapper .ck.ck-button,
                .blog-ckeditor-wrapper .ck.ck-button.ck-off,
                .blog-ckeditor-wrapper a.ck.ck-button {
                    color: var(--dash-text-muted) !important;
                    background: transparent !important;
                    border: none !important;
                    border-radius: 12px !important;
                    cursor: pointer !important;
                    margin: 0 !important;
                    width: 32px !important;
                    height: 32px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                .blog-ckeditor-wrapper .ck.ck-button:hover,
                .blog-ckeditor-wrapper .ck.ck-button.ck-off:hover {
                    background: var(--dash-surface-hover) !important;
                    color: var(--dash-text) !important;
                }
                .blog-ckeditor-wrapper .ck.ck-button.ck-on {
                    background: hsl(var(--info)/0.15) !important;
                    color: hsl(var(--info)) !important;
                    border: none !important;
                    border-radius: 12px !important;
                }
                .blog-ckeditor-wrapper .ck.ck-button .ck-icon {
                    color: inherit !important;
                }
                .blog-ckeditor-wrapper .ck.ck-button.ck-disabled {
                    opacity: 0.3 !important;
                }
                .blog-ckeditor-wrapper .ck.ck-dropdown .ck-dropdown__arrow {
                    color: var(--dash-text-muted) !important;
                }

                /* ===== EDITOR CONTENT AREA ===== */
                .blog-ckeditor-wrapper .ck.ck-editor__main {
                    background: transparent !important;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__editable {
                    background: transparent !important;
                    border: none !important;
                    color: var(--dash-text) !important;
                    font-family: 'Inter', sans-serif !important;
                    font-size: 14px !important;
                    line-height: 1.625em !important;
                    min-height: 466px !important;
                    padding: 24px !important;
                    box-shadow: none !important;
                    outline: none !important;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__editable:focus {
                    border: none !important;
                    box-shadow: none !important;
                    outline: none !important;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__editable .ck-placeholder::before {
                    color: var(--dash-text-muted) !important;
                    font-family: 'Inter', sans-serif !important;
                }

                /* ===== CONTENT STYLING ===== */
                .blog-ckeditor-wrapper .ck.ck-editor__editable a {
                    color: hsl(var(--primary)) !important;
                    text-decoration: underline !important;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__editable a:empty::after {
                    content: attr(href);
                    color: hsl(var(--primary));
                }
                .blog-ckeditor-wrapper .ck.ck-editor__editable .ck-link_selected {
                    color: hsl(var(--primary)) !important;
                    background: hsl(var(--primary)/0.15) !important;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__editable blockquote {
                    border-left: 3px solid hsl(var(--info)) !important;
                    color: var(--dash-text-muted) !important;
                    padding-left: 16px !important;
                    margin-left: 0 !important;
                    font-style: italic !important;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__editable ul,
                .blog-ckeditor-wrapper .ck.ck-editor__editable ol {
                    color: var(--dash-text) !important;
                    padding-left: 24px !important;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__editable li::marker {
                    color: var(--dash-text-muted) !important;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__editable strong {
                    color: var(--dash-text) !important;
                }

                /* ===== IMAGE IN EDITOR ===== */
                .blog-ckeditor-wrapper .ck.ck-editor__editable .image,
                .blog-ckeditor-wrapper .ck.ck-editor__editable .image-inline {
                    margin: 16px 0 !important;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__editable .image img,
                .blog-ckeditor-wrapper .ck.ck-editor__editable .image-inline img {
                    border-radius: 8px !important;
                    max-width: 100% !important;
                }
                .blog-ckeditor-wrapper .ck-widget__selection-handle {
                    background: hsl(var(--info)) !important;
                }
                /* Upload progress bar */
                .blog-ckeditor-wrapper .ck .ck-progress-bar {
                    background: hsl(var(--info)) !important;
                }
                .blog-ckeditor-wrapper .ck .ck-upload-placeholder-loader::before {
                    border-color: hsl(var(--info)) transparent transparent !important;
                }

                /* ===== ALL POPUP / BALLOON PANELS ===== */
                .ck.ck-balloon-panel,
                .ck.ck-balloon-panel_visible {
                    background: var(--dash-secondary-bg) !important;
                    border: 1px solid var(--dash-border) !important;
                    border-radius: 12px !important;
                    box-shadow: 0px 8px 32px rgba(0, 0, 0, 0.5) !important;
                    overflow: hidden !important;
                }
                .ck.ck-balloon-panel .ck-balloon-panel_arrow::after,
                .ck.ck-balloon-panel .ck-balloon-panel_arrow::before {
                    display: none !important;
                }

                /* ===== FORM VIEW (Link / Image popups) ===== */
                .ck.ck-balloon-panel .ck.ck-form,
                .ck.ck-balloon-panel .ck.ck-link-form,
                .ck.ck-balloon-panel .ck-responsive-form {
                    background: var(--dash-secondary-bg) !important;
                    padding: 16px !important;
                    border: none !important;
                }
                .ck.ck-balloon-panel .ck.ck-form__header,
                .ck.ck-balloon-panel .ck-form__header {
                    background: transparent !important;
                    border-bottom: 1px solid var(--dash-border) !important;
                    padding: 0 0 12px 0 !important;
                }
                .ck.ck-balloon-panel .ck.ck-form__header .ck-form__header__label,
                .ck.ck-balloon-panel .ck-form__header__label {
                    color: var(--dash-text) !important;
                    font-family: 'Inter', sans-serif !important;
                    font-weight: 600 !important;
                    font-size: 14px !important;
                }

                /* ===== INPUT FIELDS ===== */
                .ck.ck-balloon-panel .ck-input,
                .ck.ck-balloon-panel .ck-input-text,
                .ck.ck-balloon-panel input[type="text"],
                .ck.ck-balloon-panel input.ck-input,
                .ck.ck-dropdown__panel .ck-input,
                .ck.ck-dropdown__panel input {
                    background: var(--dash-bg) !important;
                    border: 1px solid var(--dash-border) !important;
                    color: var(--dash-text) !important;
                    border-radius: 8px !important;
                    padding: 8px 12px !important;
                    font-family: 'Inter', sans-serif !important;
                    font-size: 13px !important;
                    outline: none !important;
                    box-shadow: none !important;
                    caret-color: hsl(var(--info)) !important;
                }
                .ck.ck-balloon-panel .ck-input:focus,
                .ck.ck-balloon-panel .ck-input-text:focus,
                .ck.ck-balloon-panel input:focus,
                .ck.ck-dropdown__panel .ck-input:focus,
                .ck.ck-dropdown__panel input:focus {
                    border-color: hsl(var(--info)) !important;
                    box-shadow: 0 0 0 2px hsl(var(--info)/0.2) !important;
                    outline: none !important;
                }
                .ck.ck-balloon-panel .ck-input::placeholder,
                .ck.ck-balloon-panel input::placeholder {
                    color: var(--dash-text-muted) !important;
                }

                /* ===== LABELS ===== */
                .ck.ck-balloon-panel .ck-labeled-field-view__label,
                .ck.ck-balloon-panel label,
                .ck.ck-dropdown__panel label {
                    color: var(--dash-text-muted) !important;
                    font-family: 'Inter', sans-serif !important;
                    font-size: 12px !important;
                    font-weight: 500 !important;
                }
                .ck.ck-balloon-panel .ck-labeled-field-view__status {
                    color: var(--dash-text-muted) !important;
                    font-size: 11px !important;
                }
                .ck.ck-labeled-field-view .ck-labeled-field-view__input-wrapper > .ck-label {
                    background: var(--dash-secondary-bg) !important;
                    color: var(--dash-text-muted) !important;
                }

                /* ===== BUTTONS IN POPUPS ===== */
                .ck.ck-balloon-panel .ck-button,
                .ck.ck-dropdown__panel .ck-button {
                    color: var(--dash-text-muted) !important;
                    background: transparent !important;
                    border: none !important;
                    border-radius: 8px !important;
                }
                .ck.ck-balloon-panel .ck-button:hover,
                .ck.ck-dropdown__panel .ck-button:hover {
                    background: var(--dash-surface-hover) !important;
                    color: var(--dash-text) !important;
                }
                .ck.ck-balloon-panel .ck-button-save,
                .ck.ck-balloon-panel .ck-button-action {
                    background: hsl(var(--info)) !important;
                    color: #FFFFFF !important;
                    border-radius: 8px !important;
                }
                .ck.ck-balloon-panel .ck-button-save:hover,
                .ck.ck-balloon-panel .ck-button-action:hover {
                    background: hsl(var(--info)) !important;
                }
                .ck.ck-balloon-panel .ck-button-cancel {
                    color: var(--dash-text-muted) !important;
                }

                /* ===== LINK ACTIONS ===== */
                .ck.ck-link-actions {
                    background: var(--dash-secondary-bg) !important;
                    border: none !important;
                    padding: 8px !important;
                }
                .ck.ck-link-actions .ck-link-actions__preview {
                    color: hsl(var(--primary)) !important;
                    background: transparent !important;
                }

                /* ===== DROPDOWN PANELS ===== */
                .ck.ck-dropdown__panel {
                    background: var(--dash-secondary-bg) !important;
                    border: 1px solid var(--dash-border) !important;
                    border-radius: 12px !important;
                    box-shadow: 0px 8px 32px rgba(0, 0, 0, 0.5) !important;
                    overflow: hidden !important;
                }
                .ck.ck-dropdown__panel .ck-image-insert__panel-view {
                    background: var(--dash-secondary-bg) !important;
                    padding: 16px !important;
                }
                .ck.ck-dropdown__panel .ck-collapsible {
                    background: var(--dash-secondary-bg) !important;
                    border-color: var(--dash-border) !important;
                }
                .ck.ck-dropdown__panel .ck-collapsible .ck-collapsible__children {
                    background: var(--dash-secondary-bg) !important;
                }
                .ck.ck-dropdown__panel .ck-collapsible > button {
                    color: var(--dash-text-muted) !important;
                    background: transparent !important;
                }

                /* ===== FILE DIALOG BUTTON (Upload from computer) ===== */
                .ck.ck-dropdown__panel .ck-file-dialog-button {
                    background: transparent !important;
                    border: none !important;
                }
                .ck.ck-dropdown__panel .ck-file-dialog-button .ck-button {
                    background: hsl(var(--info)/0.1) !important;
                    color: hsl(var(--info)) !important;
                    border: 1px dashed hsl(var(--info)/0.3) !important;
                    border-radius: 8px !important;
                    padding: 12px 16px !important;
                    font-weight: 500 !important;
                    width: 100% !important;
                    justify-content: center !important;
                }
                .ck.ck-dropdown__panel .ck-file-dialog-button .ck-button:hover {
                    background: hsl(var(--info)/0.2) !important;
                    border-color: hsl(var(--info)/0.5) !important;
                    color: hsl(var(--info)) !important;
                }

                /* ===== LISTS / MENUS ===== */
                .ck.ck-list {
                    background: var(--dash-secondary-bg) !important;
                }
                .ck.ck-list .ck-list__item .ck-button {
                    color: var(--dash-text-muted) !important;
                    background: transparent !important;
                }
                .ck.ck-list .ck-list__item .ck-button:hover {
                    background: var(--dash-surface-hover) !important;
                    color: var(--dash-text) !important;
                }
                .ck.ck-list .ck-list__item .ck-button.ck-on {
                    background: hsl(var(--info)/0.15) !important;
                    color: hsl(var(--info)) !important;
                }
                .ck.ck-list .ck-list__separator {
                    background: var(--dash-border) !important;
                }

                /* ===== SWITCH / TOGGLE ===== */
                .ck.ck-balloon-panel .ck-switchbutton,
                .ck.ck-dropdown__panel .ck-switchbutton {
                    color: var(--dash-text-muted) !important;
                }
                .ck.ck-balloon-panel .ck-switchbutton .ck-button__toggle,
                .ck.ck-dropdown__panel .ck-switchbutton .ck-button__toggle {
                    background: var(--dash-surface-hover) !important;
                    border-color: var(--dash-border) !important;
                }
                .ck.ck-balloon-panel .ck-switchbutton.ck-on .ck-button__toggle,
                .ck.ck-dropdown__panel .ck-switchbutton.ck-on .ck-button__toggle {
                    background: hsl(var(--info)) !important;
                }

                /* ===== TOOLTIP ===== */
                .ck.ck-tooltip .ck-tooltip__text {
                    background: var(--dash-bg) !important;
                    color: var(--dash-text) !important;
                    border-radius: 6px !important;
                    font-family: 'Inter', sans-serif !important;
                    font-size: 12px !important;
                }

                /* ===== HIDE POWERED BY ===== */
                .ck.ck-powered-by,
                .ck-powered-by-balloon,
                .ck.ck-balloon-panel.ck-powered-by-balloon {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    width: 0 !important;
                    overflow: hidden !important;
                    pointer-events: none !important;
                    position: absolute !important;
                    clip: rect(0, 0, 0, 0) !important;
                }

                /* ===== SCROLLBAR ===== */
                .blog-ckeditor-wrapper .ck.ck-editor__editable::-webkit-scrollbar {
                    width: 6px;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__editable::-webkit-scrollbar-track {
                    background: transparent;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__editable::-webkit-scrollbar-thumb {
                    background: var(--dash-border);
                    border-radius: 3px;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__editable::-webkit-scrollbar-thumb:hover {
                    background: var(--dash-text-muted);
                }
                /* ===== DIALOG OVERLAY (Image via URL, etc.) ===== */
                .ck.ck-dialog-overlay {
                    background: rgba(0, 0, 0, 0.6) !important;
                }
                .ck.ck-dialog {
                    background: var(--dash-secondary-bg) !important;
                    border: 1px solid var(--dash-border) !important;
                    border-radius: 16px !important;
                    box-shadow: 0px 16px 48px rgba(0, 0, 0, 0.6) !important;
                    overflow: hidden !important;
                    color: var(--dash-text) !important;
                }
                /* Dialog header */
                .ck.ck-dialog .ck-form__header {
                    background: var(--dash-bg) !important;
                    border-bottom: 1px solid var(--dash-border) !important;
                    padding: 16px 20px !important;
                }
                .ck.ck-dialog .ck-form__header .ck-form__header__label {
                    color: var(--dash-text) !important;
                    font-family: 'Inter', sans-serif !important;
                    font-weight: 600 !important;
                    font-size: 15px !important;
                }
                .ck.ck-dialog .ck-form__header .ck-button {
                    color: var(--dash-text-muted) !important;
                    background: transparent !important;
                    border: none !important;
                    border-radius: 8px !important;
                }
                .ck.ck-dialog .ck-form__header .ck-button:hover {
                    background: var(--dash-surface-hover) !important;
                    color: var(--dash-text) !important;
                }
                /* Dialog body/content */
                .ck.ck-dialog .ck-dialog__content {
                    background: var(--dash-secondary-bg) !important;
                    padding: 20px !important;
                }
                /* Dialog actions footer */
                .ck.ck-dialog .ck-dialog__actions {
                    background: var(--dash-secondary-bg) !important;
                    border-top: 1px solid var(--dash-border) !important;
                    padding: 12px 20px !important;
                }
                /* Dialog inputs */
                .ck.ck-dialog .ck-input,
                .ck.ck-dialog .ck-input-text,
                .ck.ck-dialog input {
                    background: var(--dash-bg) !important;
                    border: 1px solid var(--dash-border) !important;
                    color: var(--dash-text) !important;
                    border-radius: 8px !important;
                    padding: 10px 14px !important;
                    font-family: 'Inter', sans-serif !important;
                    font-size: 13px !important;
                    outline: none !important;
                    box-shadow: none !important;
                    caret-color: hsl(var(--info)) !important;
                }
                .ck.ck-dialog .ck-input:focus,
                .ck.ck-dialog input:focus {
                    border-color: hsl(var(--info)) !important;
                    box-shadow: 0 0 0 2px hsl(var(--info)/0.2) !important;
                    outline: none !important;
                }
                .ck.ck-dialog .ck-input::placeholder,
                .ck.ck-dialog input::placeholder {
                    color: var(--dash-text-muted) !important;
                }
                /* Dialog labels */
                .ck.ck-dialog .ck-labeled-field-view__label,
                .ck.ck-dialog label,
                .ck.ck-dialog .ck-label {
                    color: var(--dash-text-muted) !important;
                    font-family: 'Inter', sans-serif !important;
                    font-size: 12px !important;
                    font-weight: 500 !important;
                }
                .ck.ck-dialog .ck-labeled-field-view__status {
                    color: var(--dash-text-muted) !important;
                }
                .ck.ck-dialog .ck-labeled-field-view .ck-labeled-field-view__input-wrapper > .ck-label {
                    background: var(--dash-secondary-bg) !important;
                    color: var(--dash-text-muted) !important;
                }
                /* Dialog buttons */
                .ck.ck-dialog .ck-button {
                    color: var(--dash-text-muted) !important;
                    background: transparent !important;
                    border: 1px solid var(--dash-border) !important;
                    border-radius: 8px !important;
                    padding: 8px 20px !important;
                    font-family: 'Inter', sans-serif !important;
                    font-size: 13px !important;
                    font-weight: 500 !important;
                    cursor: pointer !important;
                }
                .ck.ck-dialog .ck-button:hover {
                    background: var(--dash-surface-hover) !important;
                    color: var(--dash-text) !important;
                }
                .ck.ck-dialog .ck-button-action,
                .ck.ck-dialog .ck-button-save {
                    background: hsl(var(--info)) !important;
                    color: #FFFFFF !important;
                    border: none !important;
                    border-radius: 8px !important;
                }
                .ck.ck-dialog .ck-button-action:hover,
                .ck.ck-dialog .ck-button-save:hover {
                    background: hsl(var(--info)) !important;
                }

                /* ===== CK BODY WRAPPER (global panel container) ===== */
                .ck-body-wrapper {
                    z-index: 35 !important;
                }
                .ck-body-wrapper .ck.ck-balloon-panel,
                .ck-body-wrapper .ck.ck-balloon-panel_visible {
                    background: var(--dash-secondary-bg) !important;
                    border: 1px solid var(--dash-border) !important;
                    border-radius: 12px !important;
                    box-shadow: 0px 8px 32px rgba(0, 0, 0, 0.5) !important;
                }
                .ck-body-wrapper .ck-input,
                .ck-body-wrapper .ck-input-text,
                .ck-body-wrapper input.ck-input {
                    background: var(--dash-bg) !important;
                    border: 1px solid var(--dash-border) !important;
                    color: var(--dash-text) !important;
                    border-radius: 8px !important;
                    padding: 8px 12px !important;
                    font-family: 'Inter', sans-serif !important;
                    font-size: 13px !important;
                    caret-color: hsl(var(--info)) !important;
                }
                .ck-body-wrapper .ck-input:focus,
                .ck-body-wrapper input.ck-input:focus {
                    border-color: hsl(var(--info)) !important;
                    box-shadow: 0 0 0 2px hsl(var(--info)/0.2) !important;
                }
                .ck-body-wrapper label,
                .ck-body-wrapper .ck-label {
                    color: var(--dash-text-muted) !important;
                }
                .ck-body-wrapper .ck-button {
                    color: var(--dash-text-muted) !important;
                }
                .ck-body-wrapper .ck-button:hover {
                    background: var(--dash-surface-hover) !important;
                }
                .ck-body-wrapper .ck-button-action {
                    background: hsl(var(--info)) !important;
                    color: #FFFFFF !important;
                }
                .ck-body-wrapper .ck-link-form,
                .ck-body-wrapper .ck-responsive-form {
                    background: var(--dash-secondary-bg) !important;
                    padding: 16px !important;
                }
                .ck-body-wrapper .ck-form__header {
                    background: transparent !important;
                    border-bottom: 1px solid var(--dash-border) !important;
                }
                .ck-body-wrapper .ck-form__header__label {
                    color: var(--dash-text) !important;
                    font-family: 'Inter', sans-serif !important;
                    font-weight: 600 !important;
                }
                .ck-body-wrapper .ck-link-actions {
                    background: var(--dash-secondary-bg) !important;
                }
                .ck-body-wrapper .ck-link-actions__preview {
                    color: hsl(var(--primary)) !important;
                }
            `}</style>
        </div>
    )
}
