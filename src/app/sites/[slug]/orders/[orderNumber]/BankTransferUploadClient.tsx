'use client'

import { useRef, useState } from 'react'
import { CheckCircle, Upload, AlertTriangle } from 'lucide-react'

interface Props {
    orderId: number | string
    orderNumber: string
    total: number
    currency: string
    paymentExpiresAt: string | null
    bankName: string
    bankAccountNo: string
    bankAccountHolder: string
    merchantQrUrl: string
    uploadToken: string
    shopName: string
}

type UploadStatus = 'idle' | 'staged' | 'uploading' | 'success' | 'error'

const ACCEPTED = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_BYTES = 5 * 1024 * 1024

function formatMoney(amount: number, currency: string) {
    return `${currency} ${amount.toFixed(2)}`
}

function formatDeadline(iso: string) {
    try {
        return new Date(iso).toLocaleString('en-MY', {
            weekday: 'short', year: 'numeric', month: 'short',
            day: 'numeric', hour: '2-digit', minute: '2-digit',
        })
    } catch {
        return iso
    }
}

export default function BankTransferUploadClient({
    orderId, orderNumber, total, currency, paymentExpiresAt,
    bankName, bankAccountNo, bankAccountHolder, merchantQrUrl,
    uploadToken, shopName,
}: Props) {
    const [status, setStatus] = useState<UploadStatus>('idle')
    const [file, setFile] = useState<File | null>(null)
    const [error, setError] = useState('')
    const [dragging, setDragging] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const validate = (f: File): boolean => {
        if (!ACCEPTED.includes(f.type)) {
            setError('Please upload a JPEG, PNG, or PDF file.')
            return false
        }
        if (f.size > MAX_BYTES) {
            setError('File is too large. Maximum size is 5 MB.')
            return false
        }
        setError('')
        return true
    }

    const pick = (f: File | null | undefined) => {
        if (!f || !validate(f)) return
        setFile(f)
        setStatus('staged')
    }

    const handleSubmit = async () => {
        if (!file || status === 'uploading') return
        setStatus('uploading')
        setError('')
        try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('token', uploadToken)
            const res = await fetch(`/api/orders/${orderId}/upload-proof-direct`, {
                method: 'POST',
                body: fd,
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data?.error === 'expired'
                    ? 'Payment window has expired. Please contact the seller.'
                    : (data?.error ?? 'Upload failed. Please try again.'))
            }
            setStatus('success')
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Upload failed. Please try again.')
            setStatus('staged')
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' }}>
            <div style={{ width: '100%', maxWidth: '500px' }}>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{shopName}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Order {orderNumber}</div>
                </div>

                {/* Success */}
                {status === 'success' ? (
                    <div style={{ background: '#fff', borderRadius: '16px', padding: '40px 32px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
                        <CheckCircle size={48} color="#10b981" strokeWidth={1.5} style={{ margin: '0 auto 16px' }} />
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Receipt Submitted!</div>
                        <div style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6 }}>
                            Thank you for uploading your payment receipt. We will verify your payment shortly.
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Payment reference */}
                        <div style={{ background: '#fefce8', border: '2px solid #eab308', borderRadius: '12px', padding: '16px 20px', textAlign: 'center', marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#92400e', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '8px' }}>Payment Reference</div>
                            <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'monospace', letterSpacing: '3px', color: '#78350f' }}>{orderNumber}</div>
                            <div style={{ fontSize: '12px', color: '#92400e', marginTop: '6px' }}>Use this reference when making your transfer</div>
                        </div>

                        {/* Deadline */}
                        {paymentExpiresAt && (
                            <div style={{ background: '#fff7ed', borderLeft: '4px solid #f97316', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
                                <div style={{ fontSize: '13px', color: '#9a3412', fontWeight: 600 }}>
                                    Pay before: {formatDeadline(paymentExpiresAt)}
                                </div>
                            </div>
                        )}

                        {/* Bank details */}
                        {(bankName || bankAccountNo || bankAccountHolder) && (
                            <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Bank Transfer Details</div>
                                {[
                                    bankName && { label: 'Bank', value: bankName },
                                    bankAccountNo && { label: 'Account No', value: bankAccountNo },
                                    bankAccountHolder && { label: 'Account Name', value: bankAccountHolder },
                                ].filter(Boolean).map((row: any) => (
                                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #f1f5f9', fontSize: '13px' }}>
                                        <span style={{ color: '#64748b' }}>{row.label}</span>
                                        <span style={{ color: '#0f172a', fontWeight: 600, fontFamily: row.label === 'Account No' ? 'monospace' : 'inherit' }}>{row.value}</span>
                                    </div>
                                ))}
                                {merchantQrUrl && (
                                    <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Scan to pay</div>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={merchantQrUrl} alt="Payment QR Code" style={{ maxWidth: '160px', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Amount */}
                        <div style={{ background: '#fff', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                            <span style={{ fontSize: '14px', color: '#64748b' }}>Total Amount</span>
                            <span style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{formatMoney(total, currency)}</span>
                        </div>

                        {/* Upload area */}
                        <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Upload Payment Receipt</div>

                            <div
                                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={e => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]) }}
                                onClick={() => inputRef.current?.click()}
                                style={{
                                    border: `2px dashed ${dragging ? '#14c2bb' : (file ? '#10b981' : '#cbd5e1')}`,
                                    borderRadius: '10px',
                                    padding: '24px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    background: dragging ? '#f0fdfa' : (file ? '#f0fdf4' : '#f8fafc'),
                                    transition: 'all 150ms',
                                    marginBottom: '12px',
                                }}
                            >
                                <input
                                    ref={inputRef}
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.pdf"
                                    style={{ display: 'none' }}
                                    onChange={e => pick(e.target.files?.[0])}
                                />
                                <Upload size={24} color={file ? '#10b981' : '#94a3b8'} style={{ margin: '0 auto 8px' }} />
                                {file ? (
                                    <>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{file.name}</div>
                                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{(file.size / 1024).toFixed(0)} KB · Click to change</div>
                                    </>
                                ) : (
                                    <>
                                        <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>Click or drag to upload receipt</div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>JPEG, PNG or PDF · Max 5 MB</div>
                                    </>
                                )}
                            </div>

                            {error && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
                                    <AlertTriangle size={14} color="#dc2626" />
                                    <span style={{ fontSize: '13px', color: '#dc2626' }}>{error}</span>
                                </div>
                            )}

                            <button
                                onClick={handleSubmit}
                                disabled={!file || status === 'uploading'}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: !file || status === 'uploading' ? '#cbd5e1' : '#14c2bb',
                                    color: '#fff',
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    cursor: !file || status === 'uploading' ? 'not-allowed' : 'pointer',
                                    transition: 'background 150ms',
                                }}
                            >
                                {status === 'uploading' ? 'Uploading…' : 'Submit Receipt'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
