import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'
import '@testing-library/jest-dom'

// ── Mock next/image & windows functions ────────────────────────────────────────
vi.mock('next/image', () => ({
    default: (props: any) => {
        const { fill, sizes, quality, onLoadingComplete, onError, ...rest } = props
        return (
            <img 
                {...rest} 
                data-testid="next-image" 
                data-sizes={sizes}
                data-quality={quality}
                onError={onError}
                onLoad={onLoadingComplete}
            />
        )
    }
}))

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn()

// ── Imports ───────────────────────────────────────────────────────────────────
import { LazyScreenshot } from '@/components/help/LazyScreenshot'
import { ModuleGuidesTab } from '@/components/help/ModuleGuidesTab'

// ═══════════════════════════════════════════════════════════════════════════════
// US-F20-03: View Module-Specific Instructions with Screenshots
// Khối xử lý Hình Ảnh (LazyScreenshot)
// ═══════════════════════════════════════════════════════════════════════════════
describe('LazyScreenshot Component (US-F20-03)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('[TC-F20.11] Hiển thị Skeleton Loading và giữ Form Aspect-Ratio (Prevent CLS)', () => {
        // Arrange
        const title = 'Loading Skeleton Image'
        render(<LazyScreenshot src="/test-loading.webp" alt="Alt" title={title} />)

        // Assert: Skeleton must be visible before image loads
        const skeletonText = screen.getByText(title)
        expect(skeletonText).toBeInTheDocument()
        
        // Cấu trúc container ban đầu phải có style aspectRatio (mặc định 16/9)
        const outerContainer = skeletonText.closest('.group')
        expect(outerContainer).toHaveStyle({ aspectRatio: '16/9' })
    })

    it('[TC-F20.11b] Truyền đúng các Params Tối ưu WebP (Sizes, Quality) cho Next/Image', () => {
        // Arrange
        const src = '/help/mock-image.webp'
        
        // Act
        render(<LazyScreenshot src={src} alt="Alt text" title="Mock Title" />)

        // Assert
        const img = screen.getByTestId('next-image')
        expect(img).toHaveAttribute('src', src)
        // Sizes prop is passed to help Next.js serve optimal webp sizing
        expect(img).toHaveAttribute('data-sizes', '(max-width: 768px) 100vw, 800px')
        expect(img).toHaveAttribute('data-quality', '80')
    })

    it('[TC-F20.12] Tự sửa chữa hiển thị Fallback SVG khi mất Kết nối CDN (Broken SRC)', async () => {
        // Arrange
        const title = 'Form tạo sản phẩm'
        render(<LazyScreenshot src="/broken/link.webp" alt="Alt text" title={title} />)

        const img = screen.getByTestId('next-image')

        // Act: Trigger Fallback Error
        fireEvent.error(img)

        // Assert: 
        // 1. Image component should be unmounted or hidden
        // 2. The Fallback text/icon must be visible replacing it
        // 3. Fallback container is locked to h-[200px] to match visual UI demo
        await waitFor(() => {
             expect(screen.queryByTestId('next-image')).not.toBeInTheDocument()
             
             // Tìm thấy dòng text Screenshot thay thế cùng icon 📷
             const fallbackText = screen.getByText(`Screenshot: ${title}`)
             expect(fallbackText).toBeVisible()
             
             // Kiểm tra cha wrapper đã xoá bỏ Aspect-Ratio flex shrink và áp dụng h-[200px]
             const box = fallbackText.closest('.group')
             expect(box).toHaveClass('h-[200px]')
        })
    })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Trình diễn Module và chức năng Chuyển Tab / Hashing Neo Anchor / Lightbox
// ═══════════════════════════════════════════════════════════════════════════════
describe('ModuleGuidesTab Component (US-F20-03)', () => {
    let originalHash: string;

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        originalHash = window.location.hash
    })

    afterEach(() => {
        vi.useRealTimers()
        window.location.hash = originalHash
    })

    it('[TC-F20.08] Phân nhóm Link định vị nội bộ (Anchor Hash URL jump)', () => {
        // Arrange: Giả lập user đang truy cập có sẵn Hash ở URL (ví dụ link từ email gửi tới)
        window.location.hash = '#orders'
        
        // Act
        render(<ModuleGuidesTab />)

        // Phát trigger timeout 150ms như trong source code để đảm bảo Scroll Into View
        act(() => {
            vi.advanceTimersByTime(200)
        })

        // Assert
        // 1. Tab Orders (🛒 Orders) phải ở trạng thái active color (bg-[#3B82F6])
        const ordersTab = screen.getByRole('button', { name: /Orders/i })
        expect(ordersTab).toHaveClass('bg-[#3B82F6]')

        // 2. Element orders phải được scrollIntoView
        expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    })

    it('[TC-F20.09] Trình xem Ảnh lớn bằng Pop-up Overlay (Lightbox Modals)', async () => {
        // Arrange
        render(<ModuleGuidesTab />)
        
        // Giả sử lấy Screenshot đầu tiên thuộc về Products để click (Do Products là default tab)
        const firstScreenshotOverlay = screen.getAllByText(/Click to zoom/i)[0]
        
        // Act: Click vô Overlay để Zoom mở Lightbox
        fireEvent.click(firstScreenshotOverlay.closest('div.cursor-pointer')!)

        // Assert: Modal Lightbox hiện hình
        expect(screen.getByText('Full resolution screenshot')).toBeInTheDocument()
        const titles = screen.getAllByText('Danh sách Products — Product List View')
        expect(titles.length).toBeGreaterThanOrEqual(2) // At least one in thumbnail, one in modal
    })

    it('[TC-F20.10] Sử dụng Phím ESC để tắt Trình xem Modal', async () => {
        // Arrange
        render(<ModuleGuidesTab />)
        
        // Mở Lightbox
        const screenshotContainer = screen.getAllByText(/Click to zoom/i)[0].closest('div.cursor-pointer')!
        fireEvent.click(screenshotContainer)
        
        expect(screen.getByText('Full resolution screenshot')).toBeInTheDocument()

        // Act: Nhấn phím Mũi tên (Sai)
        fireEvent.keyDown(window, { key: 'ArrowRight' })
        expect(screen.getByText('Full resolution screenshot')).toBeInTheDocument()

        // Act: Nhấn phím 'Escape' (Đúng)
        fireEvent.keyDown(window, { key: 'Escape' })

        // Assert: Modal đã bị tắt (unmount/hide)
        expect(screen.queryByText('Full resolution screenshot')).not.toBeInTheDocument()
    })
})
