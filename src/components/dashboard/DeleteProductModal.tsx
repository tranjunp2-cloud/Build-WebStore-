'use client'

import { AlertTriangle } from 'lucide-react'
import { useI18n } from '@/i18n'
import { ConfirmModal } from '@/components/ui/confirm-modal'

interface DeleteProductModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => Promise<void>
    productName: string
    isDeleting?: boolean
}

export function DeleteProductModal({
    isOpen,
    onClose,
    onConfirm,
    productName,
    isDeleting = false
}: DeleteProductModalProps) {
    const { t } = useI18n()

    return (
        <ConfirmModal
            open={isOpen}
            onConfirm={onConfirm}
            onCancel={onClose}
            title={t.dashboard.products.form.deleteConfirmTitle}
            description={
                <>
                    <span className="block">
                        {t.dashboard.products.form.deleteConfirmText}{' '}
                        <span className="font-semibold">&quot;{productName}&quot;</span>?
                    </span>
                    <span className="block mt-2">{t.dashboard.products.form.deleteWarning}</span>
                </>
            }
            confirmLabel={isDeleting ? t.dashboard.products.form.deleting : t.dashboard.products.form.confirmDeleteBtn}
            cancelLabel={t.dashboard.products.form.cancel}
            variant="danger"
            loading={isDeleting}
            icon={<AlertTriangle className="h-7 w-7 text-[hsl(var(--destructive))]" />}
        />
    )
}
