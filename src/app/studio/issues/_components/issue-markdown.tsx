'use client'

/**
 * IssueMarkdown — renders markdown with strict XSS sanitization.
 * Uses react-markdown + rehype-sanitize (no javascript: URLs, no dangerous attrs).
 */
import ReactMarkdown from 'react-markdown'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'

// Strict schema: allow safe subset of HTML only
const SANITIZE_SCHEMA = {
    ...defaultSchema,
    // Disallow all attributes that could lead to script execution
    attributes: {
        ...defaultSchema.attributes,
        // Only allow safe href values (no javascript:)
        a: [['href', /^(?!javascript:)/i]],
    },
}

type Props = {
    content: string
    className?: string
}

function MarkdownBody({ content }: { content: string }) {
    return (
        <ReactMarkdown
            rehypePlugins={[[rehypeSanitize, SANITIZE_SCHEMA]]}
            components={{
                a: ({ href, children }) => {
                    const isVideo = typeof href === 'string' && /\.(mp4|webm)(?:[?#].*)?$/i.test(href)
                    return isVideo ? (
                        <span style={{ display: 'grid', gap: 6 }}>
                            <video controls preload="metadata" style={{ width: 'min(100%, 640px)', borderRadius: 6, background: '#111' }}>
                                <source src={href} />
                                Trình duyệt không hỗ trợ phát video này.
                            </video>
                            <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{children}</a>
                        </span>
                    ) : <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{children}</a>
                },
                code: ({ children }) => (
                    <code style={{ background: 'var(--bg-sunk)', borderRadius: 3, padding: '1px 5px', fontSize: 12, fontFamily: 'monospace' }}>{children}</code>
                ),
                pre: ({ children }) => (
                    <pre style={{ background: 'var(--bg-sunk)', borderRadius: 6, padding: '10px 14px', overflow: 'auto', fontSize: 12, fontFamily: 'monospace', marginBlock: 8 }}>{children}</pre>
                ),
                p: ({ children }) => <p style={{ marginBlock: 6, whiteSpace: 'pre-line' }}>{children}</p>,
                ul: ({ children }) => <ul style={{ paddingLeft: 18, marginBlock: 6 }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ paddingLeft: 18, marginBlock: 6 }}>{children}</ol>,
            }}
        >
            {content}
        </ReactMarkdown>
    )
}

function field(content: string, label: string) {
    return content.match(new RegExp(`^${label}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? null
}

/** Older F41 tickets were stored as newline-delimited key/value text. Keep the
 * database value intact, but present that known-safe legacy shape as a handoff
 * document instead of an unreadable paragraph. */
function readableGenerationTicket(content: string) {
    if (!content.startsWith('Sự cố generation được tạo tự động từ Studio.')) return content
    const generationId = field(content, 'Generation ID')
    const root = field(content, 'Generation gốc')
    const websiteId = field(content, 'Website ID')
    const userId = field(content, 'User ID')
    const traceId = field(content, 'Trace ID')
    const incident = field(content, 'Loại sự cố')
    const location = field(content, 'Vị trí')
    const phase = field(content, 'Giai đoạn lỗi')
    const code = field(content, 'Mã chuẩn hóa')
    const cause = field(content, 'Nguyên nhân')
    const impact = field(content, 'Ảnh hưởng')
    const retry = field(content, 'Lần gen lại')
    const evidence = field(content, 'Technical evidence')
    return [
        `# Bug Report: ${incident ?? 'Generation incident'}`,
        '',
        `**Bug ID:** BUG-F41-G${root ?? generationId ?? 'UNKNOWN'}`,
        '**Feature/Module:** F41 – User Generations / Website generation',
        '**Environment:** Chưa ghi nhận từ ticket cũ',
        '**Browser/Device:** Không áp dụng; lỗi được hệ thống ghi nhận trong pipeline generation',
        '**Tester:** Studio automation · người trực tracking',
        '**Date:** Chưa ghi nhận từ ticket cũ',
        '**Severity:** Xem metadata ticket',
        '**Priority:** Cần triage lại',
        '',
        '### Preconditions',
        '- Đăng nhập Studio bằng quyền Super Admin.',
        ...(generationId ? [`- Có generation #${generationId}.`] : []),
        '',
        '### Steps to Reproduce',
        ...(generationId ? [`1. Mở generation #${generationId} trong Studio.`, '2. Mở mục “Sự cố cần xử lý” để đối chiếu evidence đã capture.'] : ['1. Mở ticket và kiểm tra context kỹ thuật đã lưu.']),
        '',
        '### Actual Result',
        ...(incident ? [`- Loại sự cố: ${incident}`] : []), ...(location ? [`- Vị trí: ${location}`] : []), ...(phase ? [`- Giai đoạn lỗi: ${phase}`] : []), ...(code ? [`- Mã lỗi: ${code}`] : []), ...(cause ? [`- Nguyên nhân chuẩn hóa: ${cause}`] : []), ...(impact ? [`- ${impact}`] : []), ...(retry ? [`- Lần gen lại: ${retry}`] : []),
        '',
        '### Expected Result',
        '- Website generation được xử lý thành công hoặc Dev ghi rõ quyết định/hướng xử lý cho người trực.',
        '',
        '### Evidence',
        ...(generationId ? [`- Generation ID: ${generationId}`] : []), ...(root ? [`- Generation gốc: ${root}`] : []), ...(websiteId ? [`- Website ID: ${websiteId}`] : []), ...(userId ? [`- User ID: ${userId}`] : []), ...(traceId ? [`- Trace ID: ${traceId}`] : []), ...(evidence ? [`- Technical evidence: ${evidence}`] : []),
        '',
        '### Impact',
        ...(impact ? [`- Ảnh hưởng đến: ${impact}`] : ['- Cần đối chiếu generation để xác định phạm vi ảnh hưởng.']),
    ].join('\n')
}

export function IssueMarkdown({ content, className }: Props) {
    if (!content) return null
    const normalized = readableGenerationTicket(content)
    const parts = normalized.split(/^### (.+)$/m)
    const isBugReport = normalized.startsWith('# Bug Report:')

    return (
        <div
            className={className}
            style={{
                fontSize: 13,
                lineHeight: 1.65,
                color: 'var(--text)',
            }}
        >
            {isBugReport ? (
                <div className="issue-report-layout">
                    <section className="issue-report-overview"><MarkdownBody content={parts[0] ?? ''} /></section>
                    {parts.slice(1).reduce<Array<{ heading: string; body: string }>>((sections, part, index) => {
                        if (index % 2 === 0) sections.push({ heading: part, body: parts[index + 2] ?? '' })
                        return sections
                    }, []).map((section) => (
                        <section key={section.heading} className="issue-report-section">
                            <h3>{section.heading}</h3>
                            <MarkdownBody content={section.body} />
                        </section>
                    ))}
                </div>
            ) : <MarkdownBody content={normalized} />}
        </div>
    )
}
