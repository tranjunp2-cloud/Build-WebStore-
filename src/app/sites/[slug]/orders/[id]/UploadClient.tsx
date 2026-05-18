'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    dropZoneStyle, dropZoneActiveStyle, uploadBtnStyle, uploadBtnDisabledStyle,
    countdownStyle, referenceBoxStyle, referenceCodeStyle, referenceLabelStyle,
    bankRowStyle, bankLabelStyle, bankValueStyle, cardStyle, sectionTitleStyle,
} from './order-upload-styles'

export interface UploadClientProps {
    orderId: string | number
    slug: string
    token: string
    status: 'awaiting_payment' | 'pending_verification'
    paymentReference: string
    total: number
    currency: string
    expiresAtIso: string
    bankName: string
    bankAccountNo: string
    bankAccountHolder: string
    qrUrl?: string
}

function formatPrice(amount: number, currency: string) {
    if (currency === 'MYR') return `RM ${amount.toFixed(2)}`
    if (currency === 'SGD') return `S$${amount.toFixed(2)}`
    return `$${amount.toFixed(2)}`
}

function formatCountdown(ms: number): string {
    if (ms <= 0) return '00:00:00'
    const totalSec = Math.floor(ms / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_BYTES = 5 * 1024 * 1024

export default function UploadClient({
    orderId, slug, token, status, paymentReference, total, currency,
    expiresAtIso, bankName, bankAccountNo, bankAccountHolder, qrUrl,
}: UploadClientProps) {
    const router = useRouter()
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [dragging, setDragging] = useState(false)
    const [timeLeft, setTimeLeft] = useState(() => new Date(expiresAtIso).getTime() - Date.now())
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const iv = setInterval(() => {
            setTimeLeft(new Date(expiresAtIso).getTime() - Date.now())
        }, 1000)
        return () => clearInterval(iv)
    }, [expiresAtIso])

    const validateFile = useCallback((f: File): boolean => {
        if (!ACCEPTED_MIME.includes(f.type)) {
            toast.error('Invalid file type. Please upload a JPEG, PNG, or PDF.')
            return false
        }
        if (f.size > MAX_BYTES) {
            toast.error('File too large. Maximum size is 5MB.')
            return false
        }
        return true
    }, [])

    const handleFileChange = (f: File) => {
        if (validateFile(f)) setFile(f)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragging(false)
        const dropped = e.dataTransfer.files[0]
        if (dropped) handleFileChange(dropped)
    }

    const handleUpload = async () => {
        if (!file || uploading) return
        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            const mediaRes = await fetch('/api/media', { method: 'POST', body: formData })
            if (!mediaRes.ok) {
                const err = await mediaRes.json().catch(() => ({}))
                throw new Error(err?.errors?.[0]?.message ?? 'Media upload failed')
            }
            const { doc } = await mediaRes.json()
            const proofRes = await fetch(`/api/orders/${orderId}/upload-proof`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, paymentProofImage: doc.id }),
            })
            if (!proofRes.ok) {
                const err = await proofRes.json().catch(() => ({}))
                if (err?.error === 'expired') {
                    toast.error('Your payment link has expired. Please contact the seller.')
                } else {
                    throw new Error(err?.error ?? 'Submission failed')
                }
                return
            }
            toast.success('Payment proof submitted successfully!')
            router.refresh()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Upload failed. Please try again.')
        } finally {
            setUploading(false)
        }
    }

    const isExpired = timeLeft <= 0
    const btnLabel = status === 'pending_verification' ? 'Submit New Proof' : 'Upload Payment Proof'
    const btnStyle = !file || uploading || isExpired ? uploadBtnDisabledStyle : uploadBtnStyle

    return (
        <div style={cardStyle}>
            {status === 'awaiting_payment' && (
                <>
                    <p style={sectionTitleStyle}>Bank Transfer Details</p>
                    <div style={referenceBoxStyle}>
                        <p style={referenceLabelStyle}>Payment Reference</p>
                        <p style={referenceCodeStyle}>{paymentReference}</p>
                        <p style={{ fontSize: 11, color: '#7b8390', margin: '6px 0 0' }}>
                            Include this code in your transfer description
                        </p>
                    </div>
                    <div style={{ marginBottom: 18 }}>
                        {[
                            { label: 'Bank', value: bankName },
                            { label: 'Account No.', value: bankAccountNo },
                            { label: 'Account Holder', value: bankAccountHolder },
                            { label: 'Amount', value: formatPrice(total, currency) },
                        ].map(({ label, value }) => (
                            <div key={label} style={bankRowStyle}>
                                <span style={bankLabelStyle}>{label}</span>
                                <span style={bankValueStyle}>{value}</span>
                            </div>
                        ))}
                    </div>
                    {qrUrl && (
                        <div style={{ textAlign: 'center', marginBottom: 18 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={qrUrl} alt="Merchant QR Code" style={{ maxWidth: 180, borderRadius: 8 }} />
                        </div>
                    )}
                </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ ...sectionTitleStyle, margin: 0 }}>
                    {status === 'pending_verification' ? 'Re-upload Proof' : 'Upload Proof'}
                </p>
                <span style={countdownStyle} title="Time remaining to upload">
                    {isExpired ? 'Expired' : formatCountdown(timeLeft)}
                </span>
            </div>

            {isExpired ? (
                <p style={{ fontSize: 13, color: '#8a5c0a', textAlign: 'center', margin: '8px 0' }}>
                    Payment window expired. Contact the seller for a new link.
                </p>
            ) : (
                <>
                    <div
                        style={dragging ? dropZoneActiveStyle : dropZoneStyle}
                        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => inputRef.current?.click()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
                        aria-label="Upload payment proof file"
                    >
                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/jpeg,image/png,application/pdf"
                            style={{ display: 'none' }}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f) }}
                        />
                        {file ? (
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#0c1014', margin: 0 }}>
                                {file.name} ({(file.size / 1024).toFixed(0)} KB)
                            </p>
                        ) : (
                            <>
                                <p style={{ fontSize: 14, fontWeight: 600, color: '#2a3138', margin: '0 0 4px' }}>
                                    Drag & drop or click to select
                                </p>
                                <p style={{ fontSize: 12, color: '#7b8390', margin: 0 }}>
                                    JPEG, PNG or PDF · Max 5MB
                                </p>
                            </>
                        )}
                    </div>
                    <button
                        style={btnStyle}
                        disabled={!file || uploading || isExpired}
                        onClick={handleUpload}
                        aria-busy={uploading}
                    >
                        {uploading ? 'Uploading…' : btnLabel}
                    </button>
                </>
            )}
        </div>
    )
}
