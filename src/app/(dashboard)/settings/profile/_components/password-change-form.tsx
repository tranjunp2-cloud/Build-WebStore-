'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { useI18n } from '@/i18n'
import { passwordBaseSchema } from '@/lib/profile/schemas'
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password-rules'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { CardActionBar } from './card-action-bar'

const formSchema = passwordBaseSchema.extend({
    confirmPassword: z.string().min(1),
}).refine(d => d.currentPassword !== d.newPassword, {
    message: 'newPasswordSameAsCurrent',
    path: ['newPassword'],
}).refine(d => d.newPassword === d.confirmPassword, {
    message: 'passwordsMismatch',
    path: ['confirmPassword'],
})

type FormValues = z.infer<typeof formSchema>

// Right icon slot only (eye toggle) — size/colors/border/focus from shared <Input> primitive
const inputCls = 'pr-10'

function PasswordRule({ met, label }: { met: boolean; label: string }) {
    return (
        <div className="flex items-center gap-2">
            {met ? (
                <Check className="h-4 w-4 text-[hsl(var(--primary))] flex-shrink-0" />
            ) : (
                <X className="h-4 w-4 text-[hsl(var(--muted-foreground))] flex-shrink-0" />
            )}
            <span className={cn('text-[12px]', met ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]')}>
                {label}
            </span>
        </div>
    )
}

type Props = {
    /** Called after a successful password update (post toast + reset) so the parent card can collapse. */
    onDone: () => void
    /** Called when Cancel is clicked (post reset) so the parent card can collapse. */
    onCancel: () => void
}

export function PasswordChangeForm({ onDone, onCancel }: Props) {
    const { t } = useI18n()
    const [showCurrent, setShowCurrent] = useState(false)
    const [showNew, setShowNew]         = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    const { register, handleSubmit, watch, reset, setError, formState } =
        useForm<FormValues>({
            resolver: zodResolver(formSchema),
            mode: 'onChange',
            defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
        })

    const newPassword = watch('newPassword') ?? ''
    const hasMinLength  = newPassword.length >= PASSWORD_MIN_LENGTH
    const hasUppercase  = /[A-Z]/.test(newPassword)
    const hasNumber     = /\d/.test(newPassword)

    async function onSubmit(values: FormValues) {
        try {
            const res = await fetch('/api/users/me/password', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: values.currentPassword,
                    newPassword:     values.newPassword,
                }),
            })

            if (res.status === 401) {
                setError('currentPassword', { message: t.profile.errors.currentPasswordIncorrect })
                return
            }
            if (!res.ok) {
                toast.error(t.profile.errors.saveFailed)
                return
            }

            toast.success(t.profile.security.changed)
            reset()
            onDone()
        } catch {
            toast.error(t.profile.errors.networkError)
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 w-full">
            {/* Current password — full width */}
            <div className="flex flex-col gap-1">
                <Label className="text-[14px] font-medium text-[hsl(var(--muted-foreground))] leading-5">
                    {t.profile.security.currentPassword}
                </Label>
                <div className="relative">
                    <Input
                        {...register('currentPassword')}
                        type={showCurrent ? 'text' : 'password'}
                        autoComplete="current-password"
                        className={cn(inputCls, formState.errors.currentPassword && 'border-[hsl(var(--destructive))]')}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowCurrent(p => !p)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-foreground"
                    >
                        {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                </div>
                {formState.errors.currentPassword && (
                    <p className="text-xs text-destructive">{formState.errors.currentPassword.message}</p>
                )}
            </div>

            {/* New + Confirm — side by side on desktop, stacked on tablet/mobile */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                    <Label className="text-[14px] font-medium text-[hsl(var(--muted-foreground))] leading-5">
                        {t.profile.security.newPassword}
                    </Label>
                    <div className="relative">
                        <Input
                            {...register('newPassword')}
                            type={showNew ? 'text' : 'password'}
                            autoComplete="new-password"
                            className={cn(inputCls, formState.errors.newPassword && 'border-[hsl(var(--destructive))]')}
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowNew(p => !p)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-foreground"
                        >
                            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                    </div>
                    {formState.errors.newPassword?.message === 'newPasswordSameAsCurrent' && (
                        <p className="text-xs text-destructive">{t.profile.errors.newPasswordSameAsCurrent}</p>
                    )}
                </div>
                <div className="flex flex-col gap-1">
                    <Label className="text-[14px] font-medium text-[hsl(var(--muted-foreground))] leading-5">
                        {t.profile.security.confirmPassword}
                    </Label>
                    <div className="relative">
                        <Input
                            {...register('confirmPassword')}
                            type={showConfirm ? 'text' : 'password'}
                            autoComplete="new-password"
                            className={cn(inputCls, formState.errors.confirmPassword && 'border-[hsl(var(--destructive))]')}
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowConfirm(p => !p)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-foreground"
                        >
                            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                    </div>
                    {formState.errors.confirmPassword && (
                        <p className="text-xs text-destructive">{t.profile.errors.passwordsMismatch}</p>
                    )}
                </div>
            </div>

            {/* Password rules — horizontal checklist */}
            <div className="flex gap-6 flex-wrap">
                <PasswordRule met={hasMinLength} label={t.profile.security.ruleMinLength} />
                <PasswordRule met={hasUppercase} label={t.profile.security.ruleUppercase} />
                <PasswordRule met={hasNumber}    label={t.profile.security.ruleNumber} />
            </div>

            {/* Inline action bar — always visible; Update Password stays disabled until the full form is valid. */}
            <CardActionBar
                saving={formState.isSubmitting}
                disabled={!formState.isValid}
                saveLabel={t.profile.security.updatePassword}
                savingLabel={t.profile.security.changing}
                onCancel={() => {
                    reset()
                    onCancel()
                }}
            />
        </form>
    )
}
