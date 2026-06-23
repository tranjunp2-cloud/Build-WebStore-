import React, { useTransition } from 'react';
import { useI18n } from '@/i18n';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { removeStaff } from './actions';
import type { StaffMember } from './StaffDirectoryClient';
import { Button } from '@/components/ui/button';

interface RemoveStaffModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: StaffMember | null;
    onSuccess: (userId: string) => void;
}

export function RemoveStaffModal({
 isOpen, onClose, user, onSuccess }: RemoveStaffModalProps) {
    const [isPending, startTransition] = useTransition();

    const { t } = useI18n();

    if (!isOpen || !user) return null;

    const handleConfirm = () => {
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
    };

    const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') ||
        user.email.split('@')[0];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--dash-overlay)] backdrop-blur-sm animate-in fade-in duration-200" onClick={isPending ? undefined : onClose}>
            <div
                className="flex flex-col w-full max-w-[448px] bg-[var(--dash-surface)] border border-dash-border rounded-[16px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-200 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex flex-col items-stretch px-[24px] py-[24px] pb-[23px] border-b border-dash-border">
                    <h2 className="text-[24px] font-bold text-dash-text leading-[1.333em] font-['Inter'] m-0 p-0 tracking-tight">
                        {t?.Staff?.removeModal?.title || 'Remove Staff Access'}
                    </h2>
                </div>

                {/* Body Content */}
                <div className="flex flex-col px-[24px] pt-[24px] pb-[32px] gap-[24px]">
                    {/* Icon — warning amber, intentional status color, unchanged in both modes */}
                    <div className="flex justify-center">
                        <div className="w-[64px] h-[64px] rounded-full flex items-center justify-center bg-[hsl(var(--warning)/0.1)] border-[2px] border-[hsl(var(--warning)/0.3)]">
                            <ShieldAlert className="w-[32px] h-[32px] text-[hsl(var(--warning))]" strokeWidth={1.5} />
                        </div>
                    </div>

                    {/* Text Block */}
                    <div className="flex flex-col gap-[12px] text-center">
                        <h3 className="text-[18px] font-bold text-dash-text leading-[1.556em] font-['Inter'] m-0 p-0">
                            {t?.Staff?.removeModal?.desc1 || 'Are you sure you want to remove access for this user?'}
                        </h3>
                        <p className="text-[14px] font-normal text-dash-text-muted leading-[1.428em] font-['Inter'] m-0 p-0 px-[8px]">
                            {t?.Staff?.removeModal?.desc2 || 'This person will immediately lose access to the system and all store data. This action cannot be undone.'}
                        </p>
                    </div>

                    {/* User Card */}
                    <div className="w-full">
                        <div className="w-full flex items-center justify-center gap-[12px] px-[20px] py-[12px] rounded-[12px] bg-dash-secondary-bg border border-dash-border">
                            {/* Avatar */}
                            {user.avatar ? (
                                <img src={user.avatar} alt={displayName} className="h-[40px] w-[40px] rounded-[33px] object-cover" />
                            ) : (
                                <div
                                    className="h-[40px] w-[40px] shrink-0 rounded-[33px] flex items-center justify-center text-white text-[14px] font-semibold font-['Inter']"
                                    style={{ background: 'linear-gradient(135deg, hsl(var(--info)) 0%, hsl(var(--primary)) 100%)' }}
                                >
                                    {displayName.substring(0, 2).toUpperCase()}
                                </div>
                            )}

                            {/* Details */}
                            <div className="flex flex-col justify-center">
                                <span className="text-[14px] font-medium text-dash-text leading-[1.428em] font-['Inter']">
                                    {displayName}
                                </span>
                                <span className="text-[12px] font-normal text-dash-text-muted leading-[1.333em] font-['Inter']">
                                    {user.email}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-[12px] px-[24px] py-[24px] bg-dash-surface border-t border-dash-border">
                    <Button
                        type="button"
                        onClick={onClose}
                        disabled={isPending}
                        variant="dashSecondary"
                        className="h-[46px] px-[24px] rounded-[12px] text-[16px] font-medium"
                    >
                        {t?.Staff?.removeModal?.cancel || 'Cancel'}
                    </Button>
                    {/* Shared <Button> destructive (GH-1290 Bug 1) — giữ size + glow shadow */}
                    <Button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isPending}
                        variant="destructive"
                        // token destructive + !text-white: tránh remap .dash-shell .text-white → chữ tối (GH-1192); đồng bộ đỏ với ConfirmModal ở cả 2 theme
                        className="h-[44px] px-[28px] rounded-[12px] text-[16px] font-semibold gap-[8px] hover:opacity-90 !bg-[hsl(var(--destructive))] !text-white"
                        style={{
                            boxShadow: '0px 4px 6px -4px hsl(var(--destructive)/0.3), 0px 10px 15px -3px hsl(var(--destructive)/0.3)'
                        }}
                    >
                        {isPending && <Loader2 className="animate-spin" />}
                        {t?.Staff?.removeModal?.confirm || 'Yes, Remove'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
