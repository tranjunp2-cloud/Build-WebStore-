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

export function IssueMarkdown({ content, className }: Props) {
    if (!content) return null

    return (
        <div
            className={className}
            style={{
                fontSize: 13,
                lineHeight: 1.65,
                color: 'var(--text)',
            }}
        >
            <ReactMarkdown
                rehypePlugins={[[rehypeSanitize, SANITIZE_SCHEMA]]}
                components={{
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                        >
                            {children}
                        </a>
                    ),
                    code: ({ children }) => (
                        <code
                            style={{
                                background: 'var(--bg-sunk)',
                                borderRadius: 3,
                                padding: '1px 5px',
                                fontSize: 12,
                                fontFamily: 'monospace',
                            }}
                        >
                            {children}
                        </code>
                    ),
                    pre: ({ children }) => (
                        <pre
                            style={{
                                background: 'var(--bg-sunk)',
                                borderRadius: 6,
                                padding: '10px 14px',
                                overflow: 'auto',
                                fontSize: 12,
                                fontFamily: 'monospace',
                                marginBlock: 8,
                            }}
                        >
                            {children}
                        </pre>
                    ),
                    p: ({ children }) => (
                        <p style={{ marginBlock: 6 }}>{children}</p>
                    ),
                    ul: ({ children }) => (
                        <ul style={{ paddingLeft: 18, marginBlock: 6 }}>{children}</ul>
                    ),
                    ol: ({ children }) => (
                        <ol style={{ paddingLeft: 18, marginBlock: 6 }}>{children}</ol>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}
