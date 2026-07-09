'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { RotateCcw, Check } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { useI18n, type Translations } from '@/i18n'
import { profilePatchSchema } from '@/lib/profile/schemas'
import type { PlatformUser } from '@/types/user'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { PhoneInput } from './phone-input'
import { SsoGuardBox } from './sso-guard-box'

type FormValues = z.infer<typeof profilePatchSchema>

type Props = {
    user: Pick<PlatformUser, 'firstName' | 'lastName' | 'phone' | 'email'>
    role: 'owner' | 'staff'
    ssoUrl: string
    onUserUpdate: (partial: Partial<PlatformUser>) => void
}

// Geometry only — colors/border/focus from shared <Input> primitive
const inputCls = 'h-[48px] rounded-[8px] px-3 text-[14px] shadow-[0px_1px_1px_rgba(0,0,0,0.1)]'

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
    t: Translations
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                    <Label className="text-[14px] font-medium text-[hsl(var(--muted-foreground))] leading-[22px]">
                        {t.profile.general.firstName}
                    </Label>
                    <Input
                        {...register('firstName')}
                        className={inputCls}
                    />
                    {formState.errors.firstName && (
                        <p className="text-xs text-destructive">{formState.errors.firstName.message}</p>
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <Label className="text-[14px] font-medium text-[hsl(var(--muted-foreground))] leading-[22px]">
                        {t.profile.general.lastName}
                    </Label>
                    <Input
                        {...register('lastName')}
                        className={inputCls}
                    />
                </div>
            </div>

            {/* Email + Phone row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                    <Label className="text-[14px] font-medium text-[hsl(var(--muted-foreground))] leading-[22px]">
                        {t.profile.general.email}
                    </Label>
                    <Input
                        type="email"
                        value={user.email}
                        readOnly
                        className="h-[48px] rounded-[8px] px-3 text-[14px] bg-[hsl(var(--secondary))] cursor-not-allowed shadow-[0px_1px_1px_rgba(0,0,0,0.1)]"
                    />
                    <p className="text-[10px] italic text-[hsl(var(--muted-foreground))] tracking-[1px]">
                        {t.profile.general.emailReadonly}
                    </p>
                </div>
                <div className="flex flex-col gap-2">
                    <Label className="text-[14px] font-medium text-[hsl(var(--muted-foreground))] leading-[22px]">
                        {t.profile.general.phone}
                    </Label>
                    <PhoneInput
                        value={phoneValue}
                        onChange={val => setValue('phone', val, { shouldDirty: true })}
                    />
                    {formState.errors.phone && (
                        <p className="text-xs text-destructive">{t.profile.errors.invalidPhone}</p>
                    )}
                </div>
            </div>

            {/* Action bar — only visible when dirty */}
            {formState.isDirty && (
                <div className="flex items-center justify-end gap-3 h-[72px] bg-[hsl(var(--background)/0.5)] rounded-[12px] px-6 mt-2">
                    <Button
                        type="button"
                        onClick={() => reset()}
                        disabled={formState.isSubmitting}
                        variant="dashSecondary"
                        className="h-[48px] rounded-[10px] px-[10px] font-medium"
                    >
                        <RotateCcw className="h-4 w-4" />
                        {t.profile.general.cancel}
                    </Button>
                    <Button
                        type="submit"
                        disabled={formState.isSubmitting}
                        variant="dashPrimary"
                        className="h-[48px] min-w-[150px] rounded-[10px] px-[10px] font-medium"
                    >
                        {formState.isSubmitting ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                            <Check className="h-4 w-4" />
                        )}
                        {formState.isSubmitting ? t.profile.general.saving : t.profile.general.save}
                    </Button>
                </div>
            )}
        </form>
    )
}
