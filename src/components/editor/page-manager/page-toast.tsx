import { CircleCheck } from 'lucide-react'
import { toast } from 'sonner'
import type { ExternalToast } from 'sonner'

/**
 * Confirmation toast for Pages panel actions (hide/show, create, delete, restore):
 * neutral text, teal check icon and teal border like the design. Scoped to this panel —
 * the shared editor Toaster is untouched. Errors keep using `toast.error`.
 */
export function pageToast(message: string, options?: ExternalToast) {
    return toast(message, {
        icon: <CircleCheck className="h-[15px] w-[15px] text-teal-700 dark:text-[hsl(var(--primary))]" aria-hidden />,
        classNames: {
            toast: 'group-[.toaster]:border-teal-600/40 group-[.toaster]:text-[var(--editor-text)] dark:group-[.toaster]:border-[hsl(var(--primary)/0.3)]',
        },
        ...options,
    })
}

/**
 * Fills the `{name}` placeholder used by the page i18n strings. Uses a replacer
 * function so `$&`, `$'` etc. inside a page title are kept literally.
 */
export function withPageName(template: string, name: string) {
    return template.replace('{name}', () => name)
}
