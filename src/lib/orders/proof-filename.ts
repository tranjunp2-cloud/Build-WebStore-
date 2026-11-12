import { randomUUID } from 'crypto'

const PROOF_EXTENSIONS: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'application/pdf': 'pdf',
}

/**
 * Stored name of a payment receipt: `payment-proof-<uuid>.<ext>`. Never the buyer's own file name, which can carry
 * their name and is guessable, while the storage bucket serves objects by name (TC-PERF-146).
 */
export function proofFilename(file: Pick<File, 'type'>): string {
    return `payment-proof-${randomUUID()}.${PROOF_EXTENSIONS[file.type] ?? 'bin'}`
}

/**
 * Alt text of the receipt media the confirm page upload (`upload-proof-direct`) creates for an order. `upload-proof`
 * only attaches a media that carries exactly this text for the same order (TC-PERF-166).
 */
export function paymentProofAlt(orderNumber: unknown): string {
    return `Payment proof — order ${String(orderNumber ?? '')}`
}

/** True when `head` (the first bytes of an upload) starts with the PDF signature `%PDF-` (TC-PERF-170). */
export function hasPdfSignature(head: Uint8Array): boolean {
    const signature = [0x25, 0x50, 0x44, 0x46, 0x2d]
    return head.length >= signature.length && signature.every((byte, i) => head[i] === byte)
}
