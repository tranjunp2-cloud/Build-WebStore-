'use client'

import { useState } from 'react'
import { Mail, Send, CheckCircle, AlertCircle } from 'lucide-react'
import { useI18n } from '@/i18n'

interface Props {
    orderNumber: string
}

export default function ResendUploadLinkForm({ orderNumber }: Props) {
    const [email, setEmail] = useState('')
    const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
    const { t } = useI18n()
    const ru = t.storefront.resendUpload

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim() || status === 'loading') return
        setStatus('loading')
        try {
            await fetch('/api/orders/resend-upload-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderNumber, email: email.trim() }),
            })
            setStatus('sent')
        } catch {
            setStatus('error')
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'grid', placeItems: 'center', padding: '24px' }}>
            <div style={{ background: '#ffffff', borderRadius: '16px', padding: '32px', maxWidth: '440px', width: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>

                {status === 'sent' ? (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#10b981', marginBottom: '16px' }}><CheckCircle size={40} strokeWidth={1.5} style={{ margin: '0 auto' }} /></div>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>{ru.checkEmailTitle}</h2>
                        <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6, margin: 0 }}>
                            {ru.checkEmailDesc.replace('#{orderNumber}', orderNumber)}
                        </p>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <div style={{ background: '#fef3c7', borderRadius: '10px', padding: '10px', color: '#d97706' }}>
                                <AlertCircle size={20} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>{ru.receiptRequired}</h2>
                                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Order <strong>#{orderNumber}</strong></p>
                            </div>
                        </div>

                        <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, margin: '0 0 24px' }}>
                            {ru.awaitingVerification}
                        </p>

                        <form onSubmit={handleSubmit}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                                <Mail size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                                {ru.emailLabel}
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder={ru.emailPlaceholder}
                                required
                                style={{ display: 'block', width: '100%', padding: '10px 14px', fontSize: '14px', border: '1px solid #e2e8f0', borderRadius: '8px', outline: 'none', marginBottom: '14px', boxSizing: 'border-box', color: '#0f172a' }}
                            />
                            <button
                                type="submit"
                                disabled={status === 'loading' || !email.trim()}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '12px', fontSize: '14px', fontWeight: 600, color: '#ffffff', background: status === 'loading' ? '#94a3b8' : '#0ea5e9', border: 'none', borderRadius: '8px', cursor: status === 'loading' ? 'wait' : 'pointer' }}
                            >
                                <Send size={14} />
                                {status === 'loading' ? ru.sending : ru.sendLink}
                            </button>
                            {status === 'error' && (
                                <p style={{ fontSize: '12px', color: '#ef4444', textAlign: 'center', margin: '10px 0 0' }}>{ru.errorMessage}</p>
                            )}
                        </form>
                    </>
                )}
            </div>
        </div>
    )
}
