'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'
import { useI18n, type Translations } from '@/i18n'
import { profilePatchSchema } from '@/lib/profile/schemas'
import type { PlatformUser } from '@/types/user'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from './phone-input'
import { ProfileSaveBar } from './profile-save-bar'
import { SsoGuardBox } from './sso-guard-box'

type FormValues = z.infer<typeof profilePatchSchema>

type Props = {
    user: Pick<PlatformUser, 'firstName' | 'lastName' | 'phone' | 'email'>
    role: 'owner' | 'staff'
    ssoUrl: string
    onUserUpdate: (partial: Partial<PlatformUser>) => void
}

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
                    <Input {...register('firstName')} />
                    {formState.errors.firstName && (
                        <p className="text-xs text-destructive">{formState.errors.firstName.message}</p>
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <Label className="text-[14px] font-medium text-[hsl(var(--muted-foreground))] leading-[22px]">
                        {t.profile.general.lastName}
                    </Label>
                    <Input {...register('lastName')} />
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
                        className="bg-[hsl(var(--secondary))] cursor-not-allowed"
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

            {/* Floating save bar — only visible when dirty (same template as edit-discount) */}
            {formState.isDirty && (
                <ProfileSaveBar
                    saving={formState.isSubmitting}
                    saveLabel={t.profile.general.save}
                    savingLabel={t.profile.general.saving}
                    onCancel={() => reset()}
                />
            )}
        </form>
    )
}
