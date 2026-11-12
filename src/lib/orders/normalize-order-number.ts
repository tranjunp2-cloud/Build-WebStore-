/**
 * Chuẩn hoá mã đơn do khách nhập/dán (GH-2277).
 * Mã đơn hệ thống sinh luôn chữ HOA (`ORD-...`) nên so khớp theo dạng hoa, bỏ khoảng trắng đầu/cuối.
 */
export function normalizeOrderNumber(raw: string): string {
    return raw.trim().toUpperCase()
}
