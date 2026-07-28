'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'
import { Lock } from 'lucide-react'
import { useI18n } from '@/i18n'
import { profilePatchSchema } from '@/lib/profile/schemas'
import type { PlatformUser } from '@/types/user'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from './phone-input'
import { CardActionBar } from './card-action-bar'

type FormValues = z.infer<typeof profilePatchSchema>

type Props = {
    user: Pick<PlatformUser, 'firstName' | 'lastName' | 'phone' | 'email'>
    onUserUpdate: (partial: Partial<PlatformUser>) => void
}

// Personal Information card (F23 GH-1614 P2) — staff-only. Owner reaches a separate
// read-only OwnerProfileView (P4) and never mounts this component.
export function GeneralInfoTab({ user, onUserUpdate }: Props) {
    const { t } = useI18n()
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
                const body = await res.json().catch(() => ({})) as { error?: string | { message?: string } }
                const errMsg = typeof body.error === 'string'
                    ? body.error
                    : typeof body.error === 'object' && body.error?.message
                        ? body.error.message
                        : t.profile.errors.saveFailed
                toast.error(errMsg)
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
        <div
            data-testid="staff-general-info-card"
            className="bg-[hsl(var(--card))] border border-solid border-[hsl(var(--border))] rounded-2xl p-6"
        >
            {/* Section heading */}
            <div className="flex flex-col gap-0.5 mb-6">
                <h2 className="text-lg font-bold text-[hsl(var(--foreground))] leading-6">
                    {t.profile.general.title}
                </h2>
                <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
                    {t.profile.general.subtitle}
                </p>
            </div>

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
                        <div className="relative" data-testid="profile-email-field">
                            <Input
                                type="email"
                                value={user.email}
                                disabled
                                className="bg-[hsl(var(--secondary))] pr-10 cursor-not-allowed disabled:opacity-100"
                            />
                            <Lock
                                data-testid="profile-email-lock"
                                aria-hidden
                                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
                            />
                        </div>
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

                {/* Inline action bar — only mounted while dirty */}
                {formState.isDirty && (
                    <CardActionBar
                        saving={formState.isSubmitting}
                        saveLabel={t.profile.general.save}
                        savingLabel={t.profile.general.saving}
                        onCancel={() => reset()}
                    />
                )}
            </form>
        </div>
    )
}
