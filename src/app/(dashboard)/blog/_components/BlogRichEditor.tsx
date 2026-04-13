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
    type UploadAdapter,
    type FileLoader,
    type Editor,
    Plugin,
} from 'ckeditor5'
import 'ckeditor5/ckeditor5.css'
import { useState } from 'react'
import { uploadMediaAction } from '@/app/(dashboard)/actions/media'

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

export function BlogRichEditor({ content, onChange, placeholder = 'Start writing...' }: BlogRichEditorProps) {
    const [charCount, setCharCount] = useState(0)
    const [editorInstance, setEditorInstance] = useState<Editor | null>(null)
    const [selectedText, setSelectedText] = useState('')
    const [showImproveMenu, setShowImproveMenu] = useState(false)
    const [improveMenuPos, setImproveMenuPos] = useState({ top: 0, left: 0 })
    const [isRewriting, setIsRewriting] = useState(false)

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
        <div className="blog-ckeditor-wrapper relative flex flex-col bg-[rgba(30,41,59,0.6)] border border-[rgba(255,255,255,0.08)] rounded-[16px] overflow-hidden">
            {/* Improve Text floating menu */}
            {showImproveMenu && selectedText && (
                <div
                    className="absolute z-50 flex flex-col gap-1 p-2 bg-[#1E293B] border border-white/10 rounded-xl shadow-2xl min-w-[180px]"
                    style={{ top: improveMenuPos.top, left: improveMenuPos.left }}
                >
                    <span className="text-[10px] uppercase tracking-wider text-gray-500 px-2 py-1">AI Improve</span>
                    {[
                        { label: 'Make Professional', instruction: 'Rewrite this text to sound more professional and polished' },
                        { label: 'Make Shorter', instruction: 'Make this text shorter and more concise while keeping the meaning' },
                        { label: 'Improve Writing', instruction: 'Improve the grammar, clarity, and readability of this text' },
                    ].map((action) => (
                        <button
                            key={action.label}
                            onClick={() => handleImproveText(action.instruction)}
                            className="text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            {action.label}
                        </button>
                    ))}
                    <button
                        onClick={() => setShowImproveMenu(false)}
                        className="text-left px-3 py-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            )}
            {isRewriting && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-[16px]">
                    <div className="flex items-center gap-2 text-sm text-white bg-[#1E293B] px-4 py-2 rounded-lg border border-white/10">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Rewriting...
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
                        Image,
                        ImageInsert,
                        ImageUpload,
                        List,
                        BlockQuote,
                        Paragraph,
                        Heading,
                        Indent,
                        Undo,
                        PayloadUploadAdapterPlugin,
                    ],
                    toolbar: {
                        items: [
                            'bold', 'italic', 'underline',
                            '|',
                            'link', 'insertImage',
                            '|',
                            'bulletedList', 'numberedList',
                            '|',
                            'blockQuote',
                            '|',
                            'undo', 'redo',
                        ],
                    },
                    placeholder,
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
            <div className="flex items-center justify-end px-[16px] py-[8px] border-t border-[rgba(255,255,255,0.08)]">
                <span className="font-['Inter'] font-[400] text-[12px] leading-[1.3333333333333333em] text-[rgba(248,250,252,0.5)]">
                    {charCount} characters
                </span>
            </div>

            {/* Complete dark theme CSS overrides */}
            <style jsx global>{`
                /* ===== EDITOR WRAPPER ===== */
                .blog-ckeditor-wrapper {
                    border: 1px solid rgba(255, 255, 255, 0.08) !important;
                }
                .blog-ckeditor-wrapper .ck.ck-editor {
                    width: 100%;
                    border: none !important;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__top,
                .blog-ckeditor-wrapper .ck.ck-editor__top .ck-sticky-panel,
                .blog-ckeditor-wrapper .ck.ck-editor__top .ck-sticky-panel__content {
                    border: none !important;
                    box-shadow: none !important;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__top {
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
                }

                /* ===== TOOLBAR ===== */
                .blog-ckeditor-wrapper .ck.ck-toolbar {
                    background: rgba(11, 17, 32, 0.5) !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 8px 12px !important;
                    border-radius: 0 !important;
                    flex-wrap: wrap !important;
                }

                /* ===== AC-1: STICKY TOOLBAR ON MOBILE ===== */
                @media (max-width: 1279px) {
                    .blog-ckeditor-wrapper .ck.ck-editor__top {
                        position: sticky !important;
                        bottom: 0 !important;
                        z-index: 50 !important;
                        order: 2 !important;
                        border-bottom: none !important;
                        border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
                        background: rgba(11, 17, 32, 0.95) !important;
                        backdrop-filter: blur(8px) !important;
                    }
                    .blog-ckeditor-wrapper .ck.ck-editor__main {
                        order: 1 !important;
                    }
                    .blog-ckeditor-wrapper .ck.ck-editor {
                        display: flex !important;
                        flex-direction: column !important;
                    }
                    .blog-ckeditor-wrapper .ck.ck-editor__editable {
                        min-height: 300px !important;
                    }
                    .blog-ckeditor-wrapper .ck.ck-toolbar {
                        padding: 6px 8px !important;
                    }
                    .blog-ckeditor-wrapper .ck.ck-button {
                        min-width: 44px !important;
                        min-height: 44px !important;
                        padding: 8px !important;
                    }
                }
                .blog-ckeditor-wrapper .ck.ck-toolbar .ck-toolbar__separator {
                    background: rgba(255, 255, 255, 0.08) !important;
                }
                .blog-ckeditor-wrapper .ck.ck-toolbar .ck-toolbar__items > .ck-dropdown > .ck-button .ck-icon {
                    color: rgba(248, 250, 252, 0.6) !important;
                }

                /* ===== TOOLBAR BUTTONS ===== */
                .blog-ckeditor-wrapper .ck.ck-button,
                .blog-ckeditor-wrapper .ck.ck-button.ck-off,
                .blog-ckeditor-wrapper a.ck.ck-button {
                    color: rgba(248, 250, 252, 0.6) !important;
                    background: transparent !important;
                    border: none !important;
                    border-radius: 8px !important;
                    cursor: pointer !important;
                }
                .blog-ckeditor-wrapper .ck.ck-button:hover,
                .blog-ckeditor-wrapper .ck.ck-button.ck-off:hover {
                    background: rgba(255, 255, 255, 0.08) !important;
                    color: #F8FAFC !important;
                }
                .blog-ckeditor-wrapper .ck.ck-button.ck-on {
                    background: rgba(59, 130, 246, 0.15) !important;
                    color: #3B82F6 !important;
                    border: none !important;
                    border-radius: 8px !important;
                }
                .blog-ckeditor-wrapper .ck.ck-button .ck-icon {
                    color: inherit !important;
                }
                .blog-ckeditor-wrapper .ck.ck-button.ck-disabled {
                    opacity: 0.3 !important;
                }
                .blog-ckeditor-wrapper .ck.ck-dropdown .ck-dropdown__arrow {
                    color: rgba(248, 250, 252, 0.4) !important;
                }

                /* ===== EDITOR CONTENT AREA ===== */
                .blog-ckeditor-wrapper .ck.ck-editor__main {
                    background: transparent !important;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__editable {
                    background: transparent !important;
                    border: none !important;
                    color: #F8FAFC !important;
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
                    color: rgba(255, 255, 255, 0.3) !important;
                    font-family: 'Inter', sans-serif !important;
                }

                /* ===== CONTENT STYLING ===== */
                .blog-ckeditor-wrapper .ck.ck-editor__editable a {
                    color: #2DD4BF !important;
                    text-decoration: underline !important;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__editable blockquote {
                    border-left: 3px solid #3B82F6 !important;
                    color: rgba(248, 250, 252, 0.6) !important;
                    padding-left: 16px !important;
                    margin-left: 0 !important;
                    font-style: italic !important;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__editable ul,
                .blog-ckeditor-wrapper .ck.ck-editor__editable ol {
                    color: #F8FAFC !important;
                    padding-left: 24px !important;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__editable li::marker {
                    color: rgba(248, 250, 252, 0.5) !important;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__editable strong {
                    color: #FFFFFF !important;
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
                    background: #3B82F6 !important;
                }
                /* Upload progress bar */
                .blog-ckeditor-wrapper .ck .ck-progress-bar {
                    background: #3B82F6 !important;
                }
                .blog-ckeditor-wrapper .ck .ck-upload-placeholder-loader::before {
                    border-color: #3B82F6 transparent transparent !important;
                }

                /* ===== ALL POPUP / BALLOON PANELS ===== */
                .ck.ck-balloon-panel,
                .ck.ck-balloon-panel_visible {
                    background: #1E293B !important;
                    border: 1px solid rgba(255, 255, 255, 0.12) !important;
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
                    background: #1E293B !important;
                    padding: 16px !important;
                    border: none !important;
                }
                .ck.ck-balloon-panel .ck.ck-form__header,
                .ck.ck-balloon-panel .ck-form__header {
                    background: transparent !important;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
                    padding: 0 0 12px 0 !important;
                }
                .ck.ck-balloon-panel .ck.ck-form__header .ck-form__header__label,
                .ck.ck-balloon-panel .ck-form__header__label {
                    color: #F8FAFC !important;
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
                    background: #0F172A !important;
                    border: 1px solid rgba(255, 255, 255, 0.12) !important;
                    color: #F8FAFC !important;
                    border-radius: 8px !important;
                    padding: 8px 12px !important;
                    font-family: 'Inter', sans-serif !important;
                    font-size: 13px !important;
                    outline: none !important;
                    box-shadow: none !important;
                    caret-color: #3B82F6 !important;
                }
                .ck.ck-balloon-panel .ck-input:focus,
                .ck.ck-balloon-panel .ck-input-text:focus,
                .ck.ck-balloon-panel input:focus,
                .ck.ck-dropdown__panel .ck-input:focus,
                .ck.ck-dropdown__panel input:focus {
                    border-color: #3B82F6 !important;
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
                    outline: none !important;
                }
                .ck.ck-balloon-panel .ck-input::placeholder,
                .ck.ck-balloon-panel input::placeholder {
                    color: rgba(248, 250, 252, 0.3) !important;
                }

                /* ===== LABELS ===== */
                .ck.ck-balloon-panel .ck-labeled-field-view__label,
                .ck.ck-balloon-panel label,
                .ck.ck-dropdown__panel label {
                    color: rgba(248, 250, 252, 0.6) !important;
                    font-family: 'Inter', sans-serif !important;
                    font-size: 12px !important;
                    font-weight: 500 !important;
                }
                .ck.ck-balloon-panel .ck-labeled-field-view__status {
                    color: rgba(248, 250, 252, 0.4) !important;
                    font-size: 11px !important;
                }
                .ck.ck-labeled-field-view .ck-labeled-field-view__input-wrapper > .ck-label {
                    background: #1E293B !important;
                    color: rgba(248, 250, 252, 0.5) !important;
                }

                /* ===== BUTTONS IN POPUPS ===== */
                .ck.ck-balloon-panel .ck-button,
                .ck.ck-dropdown__panel .ck-button {
                    color: rgba(248, 250, 252, 0.7) !important;
                    background: transparent !important;
                    border: none !important;
                    border-radius: 8px !important;
                }
                .ck.ck-balloon-panel .ck-button:hover,
                .ck.ck-dropdown__panel .ck-button:hover {
                    background: rgba(255, 255, 255, 0.08) !important;
                    color: #F8FAFC !important;
                }
                .ck.ck-balloon-panel .ck-button-save,
                .ck.ck-balloon-panel .ck-button-action {
                    background: #3B82F6 !important;
                    color: #FFFFFF !important;
                    border-radius: 8px !important;
                }
                .ck.ck-balloon-panel .ck-button-save:hover,
                .ck.ck-balloon-panel .ck-button-action:hover {
                    background: #2563EB !important;
                }
                .ck.ck-balloon-panel .ck-button-cancel {
                    color: rgba(248, 250, 252, 0.5) !important;
                }

                /* ===== LINK ACTIONS ===== */
                .ck.ck-link-actions {
                    background: #1E293B !important;
                    border: none !important;
                    padding: 8px !important;
                }
                .ck.ck-link-actions .ck-link-actions__preview {
                    color: #2DD4BF !important;
                    background: transparent !important;
                }

                /* ===== DROPDOWN PANELS ===== */
                .ck.ck-dropdown__panel {
                    background: #1E293B !important;
                    border: 1px solid rgba(255, 255, 255, 0.12) !important;
                    border-radius: 12px !important;
                    box-shadow: 0px 8px 32px rgba(0, 0, 0, 0.5) !important;
                    overflow: hidden !important;
                }
                .ck.ck-dropdown__panel .ck-image-insert__panel-view {
                    background: #1E293B !important;
                    padding: 16px !important;
                }
                .ck.ck-dropdown__panel .ck-collapsible {
                    background: #1E293B !important;
                    border-color: rgba(255, 255, 255, 0.08) !important;
                }
                .ck.ck-dropdown__panel .ck-collapsible .ck-collapsible__children {
                    background: #1E293B !important;
                }
                .ck.ck-dropdown__panel .ck-collapsible > button {
                    color: rgba(248, 250, 252, 0.7) !important;
                    background: transparent !important;
                }

                /* ===== FILE DIALOG BUTTON (Upload from computer) ===== */
                .ck.ck-dropdown__panel .ck-file-dialog-button {
                    background: transparent !important;
                    border: none !important;
                }
                .ck.ck-dropdown__panel .ck-file-dialog-button .ck-button {
                    background: rgba(59, 130, 246, 0.1) !important;
                    color: #3B82F6 !important;
                    border: 1px dashed rgba(59, 130, 246, 0.3) !important;
                    border-radius: 8px !important;
                    padding: 12px 16px !important;
                    font-weight: 500 !important;
                    width: 100% !important;
                    justify-content: center !important;
                }
                .ck.ck-dropdown__panel .ck-file-dialog-button .ck-button:hover {
                    background: rgba(59, 130, 246, 0.2) !important;
                    border-color: rgba(59, 130, 246, 0.5) !important;
                    color: #60A5FA !important;
                }

                /* ===== LISTS / MENUS ===== */
                .ck.ck-list {
                    background: #1E293B !important;
                }
                .ck.ck-list .ck-list__item .ck-button {
                    color: rgba(248, 250, 252, 0.7) !important;
                    background: transparent !important;
                }
                .ck.ck-list .ck-list__item .ck-button:hover {
                    background: rgba(255, 255, 255, 0.08) !important;
                    color: #F8FAFC !important;
                }
                .ck.ck-list .ck-list__item .ck-button.ck-on {
                    background: rgba(59, 130, 246, 0.15) !important;
                    color: #3B82F6 !important;
                }
                .ck.ck-list .ck-list__separator {
                    background: rgba(255, 255, 255, 0.08) !important;
                }

                /* ===== SWITCH / TOGGLE ===== */
                .ck.ck-balloon-panel .ck-switchbutton,
                .ck.ck-dropdown__panel .ck-switchbutton {
                    color: rgba(248, 250, 252, 0.7) !important;
                }
                .ck.ck-balloon-panel .ck-switchbutton .ck-button__toggle,
                .ck.ck-dropdown__panel .ck-switchbutton .ck-button__toggle {
                    background: rgba(255, 255, 255, 0.15) !important;
                    border-color: rgba(255, 255, 255, 0.1) !important;
                }
                .ck.ck-balloon-panel .ck-switchbutton.ck-on .ck-button__toggle,
                .ck.ck-dropdown__panel .ck-switchbutton.ck-on .ck-button__toggle {
                    background: #3B82F6 !important;
                }

                /* ===== TOOLTIP ===== */
                .ck.ck-tooltip .ck-tooltip__text {
                    background: #0F172A !important;
                    color: #F8FAFC !important;
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
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                }
                .blog-ckeditor-wrapper .ck.ck-editor__editable::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
                /* ===== DIALOG OVERLAY (Image via URL, etc.) ===== */
                .ck.ck-dialog-overlay {
                    background: rgba(0, 0, 0, 0.6) !important;
                }
                .ck.ck-dialog {
                    background: #1E293B !important;
                    border: 1px solid rgba(255, 255, 255, 0.12) !important;
                    border-radius: 16px !important;
                    box-shadow: 0px 16px 48px rgba(0, 0, 0, 0.6) !important;
                    overflow: hidden !important;
                    color: #F8FAFC !important;
                }
                /* Dialog header */
                .ck.ck-dialog .ck-form__header {
                    background: #0F172A !important;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
                    padding: 16px 20px !important;
                }
                .ck.ck-dialog .ck-form__header .ck-form__header__label {
                    color: #F8FAFC !important;
                    font-family: 'Inter', sans-serif !important;
                    font-weight: 600 !important;
                    font-size: 15px !important;
                }
                .ck.ck-dialog .ck-form__header .ck-button {
                    color: rgba(248, 250, 252, 0.5) !important;
                    background: transparent !important;
                    border: none !important;
                    border-radius: 8px !important;
                }
                .ck.ck-dialog .ck-form__header .ck-button:hover {
                    background: rgba(255, 255, 255, 0.08) !important;
                    color: #F8FAFC !important;
                }
                /* Dialog body/content */
                .ck.ck-dialog .ck-dialog__content {
                    background: #1E293B !important;
                    padding: 20px !important;
                }
                /* Dialog actions footer */
                .ck.ck-dialog .ck-dialog__actions {
                    background: #1E293B !important;
                    border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
                    padding: 12px 20px !important;
                }
                /* Dialog inputs */
                .ck.ck-dialog .ck-input,
                .ck.ck-dialog .ck-input-text,
                .ck.ck-dialog input {
                    background: #0F172A !important;
                    border: 1px solid rgba(255, 255, 255, 0.12) !important;
                    color: #F8FAFC !important;
                    border-radius: 8px !important;
                    padding: 10px 14px !important;
                    font-family: 'Inter', sans-serif !important;
                    font-size: 13px !important;
                    outline: none !important;
                    box-shadow: none !important;
                    caret-color: #3B82F6 !important;
                }
                .ck.ck-dialog .ck-input:focus,
                .ck.ck-dialog input:focus {
                    border-color: #3B82F6 !important;
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
                    outline: none !important;
                }
                .ck.ck-dialog .ck-input::placeholder,
                .ck.ck-dialog input::placeholder {
                    color: rgba(248, 250, 252, 0.3) !important;
                }
                /* Dialog labels */
                .ck.ck-dialog .ck-labeled-field-view__label,
                .ck.ck-dialog label,
                .ck.ck-dialog .ck-label {
                    color: rgba(248, 250, 252, 0.5) !important;
                    font-family: 'Inter', sans-serif !important;
                    font-size: 12px !important;
                    font-weight: 500 !important;
                }
                .ck.ck-dialog .ck-labeled-field-view__status {
                    color: rgba(248, 250, 252, 0.4) !important;
                }
                .ck.ck-dialog .ck-labeled-field-view .ck-labeled-field-view__input-wrapper > .ck-label {
                    background: #1E293B !important;
                    color: rgba(248, 250, 252, 0.5) !important;
                }
                /* Dialog buttons */
                .ck.ck-dialog .ck-button {
                    color: rgba(248, 250, 252, 0.7) !important;
                    background: transparent !important;
                    border: 1px solid rgba(255, 255, 255, 0.12) !important;
                    border-radius: 8px !important;
                    padding: 8px 20px !important;
                    font-family: 'Inter', sans-serif !important;
                    font-size: 13px !important;
                    font-weight: 500 !important;
                    cursor: pointer !important;
                }
                .ck.ck-dialog .ck-button:hover {
                    background: rgba(255, 255, 255, 0.05) !important;
                    color: #F8FAFC !important;
                }
                .ck.ck-dialog .ck-button-action,
                .ck.ck-dialog .ck-button-save {
                    background: #3B82F6 !important;
                    color: #FFFFFF !important;
                    border: none !important;
                    border-radius: 8px !important;
                }
                .ck.ck-dialog .ck-button-action:hover,
                .ck.ck-dialog .ck-button-save:hover {
                    background: #2563EB !important;
                }

                /* ===== CK BODY WRAPPER (global panel container) ===== */
                .ck-body-wrapper .ck.ck-balloon-panel,
                .ck-body-wrapper .ck.ck-balloon-panel_visible {
                    background: #1E293B !important;
                    border: 1px solid rgba(255, 255, 255, 0.12) !important;
                    border-radius: 12px !important;
                    box-shadow: 0px 8px 32px rgba(0, 0, 0, 0.5) !important;
                }
                .ck-body-wrapper .ck-input,
                .ck-body-wrapper .ck-input-text,
                .ck-body-wrapper input.ck-input {
                    background: #0F172A !important;
                    border: 1px solid rgba(255, 255, 255, 0.12) !important;
                    color: #F8FAFC !important;
                    border-radius: 8px !important;
                    padding: 8px 12px !important;
                    font-family: 'Inter', sans-serif !important;
                    font-size: 13px !important;
                    caret-color: #3B82F6 !important;
                }
                .ck-body-wrapper .ck-input:focus,
                .ck-body-wrapper input.ck-input:focus {
                    border-color: #3B82F6 !important;
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
                }
                .ck-body-wrapper label,
                .ck-body-wrapper .ck-label {
                    color: rgba(248, 250, 252, 0.5) !important;
                }
                .ck-body-wrapper .ck-button {
                    color: rgba(248, 250, 252, 0.7) !important;
                }
                .ck-body-wrapper .ck-button:hover {
                    background: rgba(255, 255, 255, 0.08) !important;
                }
                .ck-body-wrapper .ck-button-action {
                    background: #3B82F6 !important;
                    color: #FFFFFF !important;
                }
                .ck-body-wrapper .ck-link-form,
                .ck-body-wrapper .ck-responsive-form {
                    background: #1E293B !important;
                    padding: 16px !important;
                }
                .ck-body-wrapper .ck-form__header {
                    background: transparent !important;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
                }
                .ck-body-wrapper .ck-form__header__label {
                    color: #F8FAFC !important;
                    font-family: 'Inter', sans-serif !important;
                    font-weight: 600 !important;
                }
                .ck-body-wrapper .ck-link-actions {
                    background: #1E293B !important;
                }
                .ck-body-wrapper .ck-link-actions__preview {
                    color: #2DD4BF !important;
                }
            `}</style>
        </div>
    )
}
