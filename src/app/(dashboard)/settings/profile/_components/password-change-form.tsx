'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Lock, X, Check, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { useI18n } from '@/i18n'
import { passwordBaseSchema } from '@/lib/profile/schemas'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

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

// Geometry only — colors/border/focus from shared <Input> primitive
const inputCls = 'h-[48px] pl-10 pr-10 text-[14px] rounded-[8px] shadow-[0px_1px_1px_rgba(0,0,0,0.1)]'

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

export function PasswordChangeForm() {
    const { t } = useI18n()
    const [showCurrent, setShowCurrent] = useState(false)
    const [showNew, setShowNew]         = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    const { register, handleSubmit, watch, reset, setError, formState } =
        useForm<FormValues>({
            resolver: zodResolver(formSchema),
            defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
        })

    const newPassword = watch('newPassword') ?? ''
    const hasMinLength  = newPassword.length >= 8
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
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
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
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
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
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
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
                        className="h-[48px] min-w-[187px] rounded-[10px] px-[10px] font-medium"
                    >
                        {formState.isSubmitting ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                            <Check className="h-4 w-4" />
                        )}
                        {formState.isSubmitting ? t.profile.security.changing : t.profile.security.updatePassword}
                    </Button>
                </div>
            )}
        </form>
    )
}
