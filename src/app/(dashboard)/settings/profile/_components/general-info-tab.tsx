'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { RotateCcw, Check } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { useI18n } from '@/i18n'
import { profilePatchSchema } from '@/lib/profile/schemas'
import type { PlatformUser } from '@/types/user'
import { PhoneInput } from './phone-input'
import { SsoGuardBox } from './sso-guard-box'

type FormValues = z.infer<typeof profilePatchSchema>

type Props = {
    user: Pick<PlatformUser, 'firstName' | 'lastName' | 'phone' | 'email'>
    role: 'owner' | 'staff'
    ssoUrl: string
    onUserUpdate: (partial: Partial<PlatformUser>) => void
}

const inputCls = 'bg-[#0b1120] border border-[rgba(255,255,255,0.1)] rounded-[8px] h-[48px] w-full px-3 text-[14px] text-white placeholder-[#9f9fa9] outline-none focus:border-blue-500/50 transition-colors shadow-[0px_1px_1px_rgba(0,0,0,0.1)]'

export function GeneralInfoTab({ user, role, ssoUrl, onUserUpdate }: Props) {
    const { t } = useI18n()

    if (role === 'owner') {
        return <SsoGuardBox ssoUrl={ssoUrl} variant="general" />
    }

    return (
        <StaffGeneralInfoForm
            user={user}
            onUserUpdate={onUserUpdate}
            t={t}
        />
    )
}

type StaffFormProps = {
    user: Pick<PlatformUser, 'firstName' | 'lastName' | 'phone' | 'email'>
    onUserUpdate: (partial: Partial<PlatformUser>) => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any
}

function StaffGeneralInfoForm({ user, onUserUpdate, t }: StaffFormProps) {
    const { register, handleSubmit, watch, setValue, reset, formState } =
        useForm<FormValues>({
            resolver: zodResolver(profilePatchSchema),
            defaultValues: {
                firstName: user.firstName ?? '',
                lastName:  user.lastName  ?? '',
                phone:     user.phone     ?? '',
            },
        })

    const phoneValue = watch('phone') ?? ''

    async function onSubmit(values: FormValues) {
        try {
            const res = await fetch('/api/users/me', {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => ({})) as { error?: string }
                toast.error(body.error ?? t.profile.errors.saveFailed)
                return
            }

            toast.success(t.profile.general.saved)
            reset(values)
            onUserUpdate(values)
        } catch {
            toast.error(t.profile.errors.networkError)
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 w-full">
            {/* Name row — 2 columns */}
            <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-[#c1c6d7] leading-[22px]">
                        {t.profile.general.firstName}
                    </label>
                    <input
                        {...register('firstName')}
                        className={inputCls}
                    />
                    {formState.errors.firstName && (
                        <p className="text-xs text-red-400">{formState.errors.firstName.message}</p>
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-[#c1c6d7] leading-[22px]">
                        {t.profile.general.lastName}
                    </label>
                    <input
                        {...register('lastName')}
                        className={inputCls}
                    />
                </div>
            </div>

            {/* Email + Phone row */}
            <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-[#c1c6d7] leading-[22px]">
                        {t.profile.general.email}
                    </label>
                    <input
                        type="email"
                        value={user.email}
                        readOnly
                        className="bg-[#1e293b] border border-[rgba(255,255,255,0.1)] rounded-[8px] h-[48px] w-full px-3 text-[14px] text-white cursor-not-allowed shadow-[0px_1px_1px_rgba(0,0,0,0.1)]"
                    />
                    <p className="text-[10px] italic text-[#c1c6d7] tracking-[1px]">
                        {t.profile.general.emailReadonly}
                    </p>
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-[#c1c6d7] leading-[22px]">
                        {t.profile.general.phone}
                    </label>
                    <PhoneInput
                        value={phoneValue}
                        onChange={val => setValue('phone', val, { shouldDirty: true })}
                    />
                    {formState.errors.phone && (
                        <p className="text-xs text-red-400">{t.profile.errors.invalidPhone}</p>
                    )}
                </div>
            </div>

            {/* Action bar — only visible when dirty */}
            {formState.isDirty && (
                <div className="flex items-center justify-end gap-3 h-[72px] bg-[rgba(11,17,32,0.5)] rounded-[12px] px-6 mt-2">
                    <button
                        type="button"
                        onClick={() => reset()}
                        disabled={formState.isSubmitting}
                        className="flex items-center gap-1.5 bg-[#0b1120] border border-[rgba(255,255,255,0.08)] rounded-[10px] h-[48px] px-[10px] text-[14px] font-medium text-white shadow-[0px_1px_1px_rgba(0,0,0,0.1)] disabled:opacity-40 hover:bg-white/5 transition-colors"
                    >
                        <RotateCcw className="h-4 w-4" />
                        {t.profile.general.cancel}
                    </button>
                    <button
                        type="submit"
                        disabled={formState.isSubmitting}
                        className="flex items-center gap-1.5 rounded-[10px] h-[48px] min-w-[150px] px-[10px] justify-center text-[14px] font-medium text-white shadow-[0px_1px_1px_rgba(0,0,0,0.1)] border border-[rgba(255,255,255,0.08)] disabled:opacity-40 transition-opacity"
                        style={{ backgroundImage: 'linear-gradient(90deg, #3B82F6 0%, #2DD4BF 100%)' }}
                    >
                        {formState.isSubmitting ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                            <Check className="h-4 w-4" />
                        )}
                        {formState.isSubmitting ? t.profile.general.saving : t.profile.general.save}
                    </button>
                </div>
            )}
        </form>
    )
}
