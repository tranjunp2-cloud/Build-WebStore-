'use client'

import { useTransition } from 'react';
import { useI18n } from '@/i18n';
import { ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { removeStaff } from './actions';
import type { StaffMember } from './StaffDirectoryClient';
import { ConfirmModal } from '@/components/ui/confirm-modal';

interface RemoveStaffModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: StaffMember | null;
    onSuccess: (userId: string) => void;
}

export function RemoveStaffModal({ isOpen, onClose, user, onSuccess }: RemoveStaffModalProps) {
    const [isPending, startTransition] = useTransition();
    const { t } = useI18n();

    const displayName = user
        ? ([user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0])
        : '';

    function handleConfirm() {
        if (!user) return;
        startTransition(async () => {
            const res = await removeStaff(user.id);
            if (res.success) {
                toast.success(t?.Staff?.toast?.removed || 'User removed from workspace');
                onSuccess(user.id);
                onClose();
            } else {
                toast.error(res.error || t?.Staff?.toast?.removeFailed || 'Failed to remove user');
            }
        });
    }

    return (
        <ConfirmModal
            open={isOpen && !!user}
            onConfirm={handleConfirm}
            onCancel={onClose}
            title={t?.Staff?.removeModal?.title || 'Remove Staff Access'}
            description={
                <>
                    <span className="block">{t?.Staff?.removeModal?.desc1 || 'Are you sure you want to remove access for this user?'}</span>
                    <span className="block mt-2 font-medium text-foreground">{displayName}</span>
                    <span className="block text-[12px] mt-1">{user?.email}</span>
                    <span className="block mt-3">{t?.Staff?.removeModal?.desc2 || 'This person will immediately lose access to the system and all store data. This action cannot be undone.'}</span>
                </>
            }
            confirmLabel={t?.Staff?.removeModal?.confirm || 'Yes, Remove'}
            cancelLabel={t?.Staff?.removeModal?.cancel || 'Cancel'}
            variant="danger"
            loading={isPending}
            icon={<ShieldAlert className="h-7 w-7 text-[hsl(var(--destructive))]" />}
        />
    );
}
