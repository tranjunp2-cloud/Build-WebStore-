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

const inputCls = 'bg-[#0b1120] border border-[rgba(255,255,255,0.1)] rounded-[8px] h-[48px] w-full pl-10 pr-10 text-[14px] text-[#9f9fa9] placeholder-[#9f9fa9] outline-none focus:border-blue-500/50 transition-colors shadow-[0px_1px_1px_rgba(0,0,0,0.1)]'

function PasswordRule({ met, label }: { met: boolean; label: string }) {
    return (
        <div className="flex items-center gap-2">
            {met ? (
                <Check className="h-4 w-4 text-[#44ddc1] flex-shrink-0" />
            ) : (
                <X className="h-4 w-4 text-[#94a3b8] flex-shrink-0" />
            )}
            <span className={cn('text-[12px]', met ? 'text-[#44ddc1]' : 'text-[#94a3b8]')}>
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
    const hasLowercase  = /[a-z]/.test(newPassword)
    const hasNumber     = /\d/.test(newPassword)
    const hasSpecial    = /[^A-Za-z0-9]/.test(newPassword)

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
                <label className="text-[14px] font-medium text-[#94a3b8] leading-5">
                    {t.profile.security.currentPassword}
                </label>
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                    <input
                        {...register('currentPassword')}
                        type={showCurrent ? 'text' : 'password'}
                        autoComplete="current-password"
                        className={cn(inputCls, formState.errors.currentPassword && 'border-red-500/50')}
                    />
                    <button
                        type="button"
                        onClick={() => setShowCurrent(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white transition-colors"
                    >
                        {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
                {formState.errors.currentPassword && (
                    <p className="text-xs text-red-400">{formState.errors.currentPassword.message}</p>
                )}
            </div>

            {/* New + Confirm — side by side */}
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                    <label className="text-[14px] font-medium text-[#94a3b8] leading-5">
                        {t.profile.security.newPassword}
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                        <input
                            {...register('newPassword')}
                            type={showNew ? 'text' : 'password'}
                            autoComplete="new-password"
                            className={cn(inputCls, formState.errors.newPassword && 'border-red-500/50')}
                        />
                        <button
                            type="button"
                            onClick={() => setShowNew(p => !p)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white transition-colors"
                        >
                            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {formState.errors.newPassword?.message === 'newPasswordSameAsCurrent' && (
                        <p className="text-xs text-red-400">{t.profile.errors.newPasswordSameAsCurrent}</p>
                    )}
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[14px] font-medium text-[#94a3b8] leading-5">
                        {t.profile.security.confirmPassword}
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                        <input
                            {...register('confirmPassword')}
                            type={showConfirm ? 'text' : 'password'}
                            autoComplete="new-password"
                            className={cn(inputCls, formState.errors.confirmPassword && 'border-red-500/50')}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirm(p => !p)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white transition-colors"
                        >
                            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {formState.errors.confirmPassword && (
                        <p className="text-xs text-red-400">{t.profile.errors.passwordsMismatch}</p>
                    )}
                </div>
            </div>

            {/* Password rules — horizontal checklist */}
            <div className="flex gap-6 flex-wrap">
                <PasswordRule met={hasMinLength}  label={t.profile.security.ruleMinLength} />
                <PasswordRule met={hasUppercase}  label={t.profile.security.ruleUppercase} />
                <PasswordRule met={hasLowercase}  label={t.profile.security.ruleLowercase} />
                <PasswordRule met={hasNumber}     label={t.profile.security.ruleNumber} />
                <PasswordRule met={hasSpecial}    label={t.profile.security.ruleSpecial} />
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
                        className="flex items-center gap-1.5 rounded-[10px] h-[48px] min-w-[187px] px-[10px] justify-center text-[14px] font-medium text-white shadow-[0px_1px_1px_rgba(0,0,0,0.1)] border border-[rgba(255,255,255,0.08)] disabled:opacity-40 transition-opacity"
                        style={{ backgroundImage: 'linear-gradient(90deg, #3B82F6 0%, #2DD4BF 100%)' }}
                    >
                        {formState.isSubmitting ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                            <Check className="h-4 w-4" />
                        )}
                        {formState.isSubmitting ? t.profile.security.changing : t.profile.security.updatePassword}
                    </button>
                </div>
            )}
        </form>
    )
}
