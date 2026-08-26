"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { useI18n } from '@/i18n';
import { X, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { inviteStaffAction, updateStaff } from './actions';
import type { StaffMember } from './StaffDirectoryClient';
import { ALLOWED_PERMISSIONS } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const CUSTOM_FEATURE_IDS = [...ALLOWED_PERMISSIONS] as const;
const CUSTOM_FEATURE_FALLBACKS: Record<string, string> = {
    builder: 'Store Editor',
    blog: 'Blog',
    products: 'Product',
    orders: 'Order',
    settings: 'Setting',
};

export function StaffDrawer({
    isOpen,
    onClose,
    editData = null,
    currentUserId,
    currentUserEmail,
    tenantId
}: {
    isOpen: boolean;
    onClose: () => void;
    editData?: StaffMember | null;
    currentUserId?: string;
    currentUserEmail?: string;
    tenantId?: string;
}) {
    const { t } = useI18n();
    const isEditMode = !!editData;
    const isSelf = currentUserId && editData?.id === currentUserId;
    const isRoleDisabled = editData?.role === 'owner' || isSelf;

    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [role, setRole] = useState<'admin' | 'custom'>('admin');
    const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (isOpen) {
            if (editData) {
                setEmail(editData.email);
                setRole(editData.role === 'admin' || editData.role === 'owner' ? 'admin' : 'custom');
                setSelectedFeatures(editData.permissions || []);
            } else {
                setEmail('');
                setEmailError('');
                setRole('admin');
                setSelectedFeatures([]);
            }
        }
    }, [isOpen, editData]);

    if (!isOpen) return null;

    const handleToggleFeature = (featureId: string) => {
        setSelectedFeatures(prev =>
            prev.includes(featureId)
                ? prev.filter(f => f !== featureId)
                : [...prev, featureId]
        );
    };

    const handleSave = () => {
        if (!isEditMode) {
            // BUG-F19.15 + F19.08: Inline email validation
            if (!email.trim()) {
                setEmailError(t?.Staff?.drawer?.errorEmailRequired || 'Please enter an email address');
                return;
            }
            if (!email.includes('@')) {
                setEmailError(t?.Staff?.drawer?.errorEmailInvalid || 'Invalid email address');
                return;
            }
            if (email.length > 254) {
                setEmailError(t?.Staff?.drawer?.errorEmailTooLong || 'Email must not exceed 254 characters');
                return;
            }
            // BUG-F19.10: Block self-invite
            if (currentUserEmail && email.toLowerCase() === currentUserEmail.toLowerCase()) {
                setEmailError(t?.Staff?.drawer?.errorSelfInvite || 'You cannot invite yourself');
                return;
            }
        }

        if (role === 'custom' && selectedFeatures.length === 0) {
            toast.error(t?.Staff?.toast?.permissionRequired || 'Please select at least one custom permission');
            return;
        }

        startTransition(async () => {
            try {
                if (isEditMode) {
                    if (!editData) return;
                    const displayName = [editData.firstName, editData.lastName].filter(Boolean).join(' ') || '';
                    const res = await updateStaff(editData.id, displayName, role, role === 'custom' ? selectedFeatures : undefined);
                    if (res.success) {
                        toast.success(t?.Staff?.toast?.staffUpdated || 'Staff updated successfully!');
                        onClose();
                    } else {
                        toast.error(res.error || t?.Staff?.toast?.staffUpdateFailed || 'Failed to update staff');
                    }
                } else {
                    const res = await inviteStaffAction({
                        email: email,
                        name: email.split('@')[0],
                        role: role,
                        permissions: role === 'custom' ? selectedFeatures : undefined
                    });
                    if (res.success) {
                        toast.success(t?.Staff?.toast?.inviteSent || 'Invitation sent successfully!');
                        onClose();
                    } else {
                        // BUG-F19.09 + F19.16: Show error toast for duplicate/invalid email
                        toast.error(res.error || t?.Staff?.toast?.inviteFailed || 'Failed to send invitation');
                    }
                }
            } catch (err: unknown) {
                // BUG-F19.16: Catch any uncaught errors — never expose internal error to client
                console.error('[StaffDrawer] invite failed');
                toast.error(t?.Staff?.drawer?.errorGeneric || 'Something went wrong. Please try again.');
            }
        });
    };

    // Backdrop inset-0 z-[100]: phủ mờ + khoá tương tác TOÀN màn hình — cao hơn
    // TopHeader (z-50) và sidebar (z-40) để che kín cả header theo GH-1593.
    // !mt-0: root của StaffDirectoryClient dùng space-y-[28px] → leak margin-top vào
    // backdrop fixed này, đẩy mép overlay tụt 28px (nguyên nhân "che nửa header" GH-1593).
    return (
        <div className="fixed inset-0 !mt-0 z-[100] flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-200" onClick={onClose}>
            <div className="flex flex-col w-full max-w-[448px] max-h-[calc(100vh-32px)] bg-[var(--dash-surface)] border border-dash-border rounded-[16px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-[24px] pt-[24px] pb-[16px]">
                    <h2 className="text-[24px] font-bold text-dash-text leading-[1.333em] font-['Inter']">
                        {isEditMode ? (t?.Staff?.drawer?.editTitle || 'Edit Staff Permissions') : (t?.Staff?.drawer?.inviteTitle || 'Invite New Staff')}
                    </h2>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-[32px] w-[32px] rounded-[8px] text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] hover:bg-[var(--dash-surface-hover)]"
                    >
                        <X className="w-5 h-5" strokeWidth={1.6} />
                    </Button>
                </div>


                {/* Body Content */}
                <div className="flex flex-col overflow-y-auto max-h-[70vh]">

                    {/* Email Input */}
                    <div className="flex flex-col gap-[8px] px-[24px] pt-[24px]">
                        <Label className="text-[14px] font-medium text-dash-text font-['Inter']">
                            {isEditMode ? (t?.Staff?.drawer?.email || 'Login Email') : (t?.Staff?.drawer?.email || 'Email Address')}
                        </Label>
                        <Input
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                            disabled={isEditMode}
                            maxLength={254}
                            placeholder="staff@domain.com"
                            className={cn("text-[13px]", emailError && "border-[hsl(var(--destructive))] focus-visible:border-[hsl(var(--destructive))] focus-visible:ring-[hsl(var(--destructive)/0.5)]")}
                        />
                        {emailError && (
                            <p className="text-[12px] font-normal text-destructive font-['Inter'] mt-[4px]">
                                {emailError}
                            </p>
                        )}
                        {!isEditMode && !emailError && (
                            <p className="text-[12px] font-normal text-dash-text-muted font-['Inter'] mt-[4px]">
                                {t?.Staff?.drawer?.emailNeeded || 'Send an invitation to join your store.'}
                            </p>
                        )}
                    </div>

                    {/* Role Selection */}
                    <div className="flex flex-col gap-[16px] px-[24px] pt-[24px] pb-[24px]">
                        <Label className="text-[14px] font-semibold text-dash-text font-['Inter']">
                            {t?.Staff?.drawer?.roles?.label || 'Select Role'}
                        </Label>
                        <div className="flex flex-col gap-[12px]">

                            {/* Manager Option */}
                            <div
                                onClick={() => { if (!isRoleDisabled) setRole('admin'); }}
                                style={role !== 'admin' ? { borderColor: 'var(--dash-border)' } : {}}
                                className={`flex items-start px-[14px] py-[11px] rounded-lg border border-solid transition-all ${isRoleDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-dash-surface-hover'
                                    } ${role === 'admin'
                                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]'
                                        : 'bg-dash-surface'
                                    }`}
                            >
                                <div
                                    style={role !== 'admin' ? { borderColor: 'var(--dash-border)' } : {}}
                                    className={`flex shrink-0 items-center justify-center w-[18px] h-[18px] rounded-full border-2 border-solid transition-all mr-[12px] mt-[1px] ${role === 'admin' ? 'border-[hsl(var(--primary))]' : 'bg-transparent'}`}>
                                    {role === 'admin' && <div className="w-[8px] h-[8px] rounded-full bg-[hsl(var(--primary))]" />}
                                </div>
                                <div className="flex flex-col">
                                    <span className={`text-[14px] font-medium leading-tight mb-[2px] ${role === 'admin' ? 'text-dash-text' : 'text-dash-text-muted'}`}>{t?.Staff?.drawer?.roles?.admin || 'Manager'}</span>
                                    <span className="text-[13px] text-dash-text-muted">{t?.Staff?.drawer?.roles?.adminDesc || 'Can manage everything except delete the store.'}</span>
                                </div>
                            </div>

                            {/* Custom Features Option */}
                            <div
                                onClick={() => {
                                    if (!isRoleDisabled && role !== 'custom') {
                                        setRole('custom');
                                    }
                                }}
                                style={role !== 'custom' ? { borderColor: 'var(--dash-border)' } : {}}
                                className={`flex flex-col w-full rounded-lg border border-solid transition-all ${isRoleDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-dash-surface-hover'
                                    } ${role === 'custom'
                                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]'
                                        : 'bg-dash-surface'
                                    }`}
                            >
                                <div className={`flex items-center px-[14px] ${role === 'custom' ? 'pt-[12px] pb-[10px]' : 'py-[11px]'}`}>
                                    <div
                                        style={role !== 'custom' ? { borderColor: 'var(--dash-border)' } : {}}
                                        className={`flex shrink-0 items-center justify-center w-[18px] h-[18px] rounded-full border-2 border-solid transition-all mr-[12px] ${role === 'custom' ? 'border-[hsl(var(--primary))]' : 'bg-transparent'}`}>
                                        {role === 'custom' && <div className="w-[8px] h-[8px] rounded-full bg-[hsl(var(--primary))]" />}
                                    </div>
                                    <span className={`text-[14px] font-medium leading-tight ${role === 'custom' ? 'text-dash-text' : 'text-dash-text-muted'}`}>
                                        {t?.Staff?.drawer?.roles?.custom || 'Custom Features'}
                                    </span>
                                </div>

                                {role === 'custom' && (
                                    <div className="flex flex-col gap-[10px] pb-[14px] pr-[14px] pl-[44px] animate-in fade-in duration-200">
                                        {CUSTOM_FEATURE_IDS.map(featureId => {
                                            const isChecked = selectedFeatures.includes(featureId);
                                            const isFeatureDisabled = editData?.role === 'owner';
                                            const label = (t?.Staff?.drawer?.features as Record<string, string> | undefined)?.[featureId] || CUSTOM_FEATURE_FALLBACKS[featureId];
                                            return (
                                                <div
                                                    key={featureId}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!isFeatureDisabled) handleToggleFeature(featureId);
                                                    }}
                                                    className={`flex items-center gap-[12px] cursor-pointer transition-all ${isFeatureDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    <div
                                                        style={!isChecked ? { borderColor: 'var(--dash-border)' } : {}}
                                                        className={`flex shrink-0 items-center justify-center w-[18px] h-[18px] rounded-[4px] border border-solid transition-colors ${isChecked ? 'bg-[hsl(var(--primary))] border-[hsl(var(--primary))]' : 'bg-transparent'}`}
                                                    >
                                                        {isChecked && <Check className="h-3 w-3" style={{ color: '#fff' }} strokeWidth={3} />}
                                                    </div>
                                                    <span className={`text-[14px] leading-tight select-none ${isChecked ? 'text-dash-text font-medium' : 'text-dash-text-muted font-normal'}`}>
                                                        {label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>


                {/* Footer buttons */}
                <div className="flex items-center justify-end gap-[12px] px-[24px] py-[24px]">
                    <Button
                        type="button"
                        onClick={onClose}
                        variant="dashSecondary"
                        size="dash"
                    >
                        {t?.Staff?.drawer?.cancelBtn || 'Cancel'}
                    </Button>
                    <Button
                        type="button"
                        disabled={isPending || editData?.role === 'owner' || (role === 'custom' && selectedFeatures.length === 0)}
                        onClick={handleSave}
                        variant="dashPrimary"
                        size="dash"
                    >
                        {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        {isEditMode ? (t?.Staff?.drawer?.saveBtn || 'Save Changes') : (t?.Staff?.drawer?.sendInviteBtn || 'Send Invite')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
