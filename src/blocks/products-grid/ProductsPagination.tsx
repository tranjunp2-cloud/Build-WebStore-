'use client'

interface ProductsPaginationProps {
    currentPage: number
    totalPages: number
    onPageChange: (page: number, event: React.MouseEvent<HTMLButtonElement>) => void
    primaryColor: string
}

type PaginationItem = number | 'ellipsis'

function buildPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1)

    const items: PaginationItem[] = [1]
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)

    if (start > 2) items.push('ellipsis')
    for (let page = start; page <= end; page += 1) items.push(page)
    if (end < totalPages - 1) items.push('ellipsis')

    items.push(totalPages)
    return items
}

export function ProductsPagination({ currentPage, totalPages, onPageChange, primaryColor }: ProductsPaginationProps) {
    const safeTotalPages = Math.max(1, totalPages)
    const items = buildPaginationItems(currentPage, safeTotalPages)

    return (
        <nav className="mt-14 flex flex-wrap items-center justify-center gap-3" aria-label="Products pagination">
            <button
                type="button"
                aria-label="Previous page"
                disabled={currentPage <= 1}
                className="flex h-12 min-w-12 items-center justify-center border border-[var(--divider)] bg-[var(--surface-card)] px-4 text-base font-bold text-[var(--text-primary)] transition-colors hover:bg-[rgba(var(--brand-primary-rgb),0.08)] disabled:cursor-not-allowed disabled:opacity-45"
                onClick={(event) => onPageChange(currentPage - 1, event)}
            >
                &laquo;
            </button>

            {items.map((item, index) => item === 'ellipsis' ? (
                <span
                    key={`ellipsis-${index}`}
                    className="flex h-12 min-w-12 items-center justify-center border border-[var(--divider)] bg-[var(--surface-card)] px-4 text-base font-bold text-[var(--text-primary)]"
                    aria-hidden="true"
                >
                    ...
                </span>
            ) : (
                <button
                    key={item}
                    type="button"
                    aria-label={`Page ${item}`}
                    aria-current={item === currentPage ? 'page' : undefined}
                    className="flex h-12 min-w-12 items-center justify-center border px-4 text-base font-bold transition-colors"
                    style={item === currentPage
                        ? { backgroundColor: primaryColor, borderColor: primaryColor, color: '#ffffff' }
                        : { backgroundColor: 'var(--surface-card)', borderColor: 'var(--divider)', color: 'var(--text-primary)' }}
                    onClick={(event) => onPageChange(item, event)}
                >
                    {item}
                </button>
            ))}

            <button
                type="button"
                aria-label="Next page"
                disabled={currentPage >= safeTotalPages}
                className="flex h-12 min-w-12 items-center justify-center border border-[var(--divider)] bg-[var(--surface-card)] px-4 text-base font-bold text-[var(--text-primary)] transition-colors hover:bg-[rgba(var(--brand-primary-rgb),0.08)] disabled:cursor-not-allowed disabled:opacity-45"
                onClick={(event) => onPageChange(currentPage + 1, event)}
            >
                &raquo;
            </button>
        </nav>
    )
}
