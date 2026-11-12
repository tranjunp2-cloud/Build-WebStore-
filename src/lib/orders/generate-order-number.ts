import { randomBytes } from 'crypto'

/**
 * Sinh mã đơn `ORD-<ts36>-<16 hex>` (GH-2081).
 * - `<ts36>`: timestamp base36 (đọc được thứ tự thời gian thô, đoán được).
 * - `<16 hex>`: 8 byte từ CSPRNG = 64 bit ngẫu nhiên → không dò quét/không trùng cùng mili-giây.
 * Dài ~29 ký tự, chỉ gồm [A-Z0-9-] (≤ 50 theo resend-upload-link). Server-only (dùng `crypto`).
 *
 * `now`/`rand` chỉ để test inject.
 */
export function generateOrderNumber(
    now: number = Date.now(),
    rand: (size: number) => Buffer = randomBytes,
): string {
    return `ORD-${now.toString(36).toUpperCase()}-${rand(8).toString('hex').toUpperCase()}`
}
