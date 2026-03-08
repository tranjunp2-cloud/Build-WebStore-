'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'

const TABS = [
  { id: 'tuyen-sinh', label: 'Tuyển sinh' },
  { id: 'dao-tao', label: 'Đào tạo' },
  { id: 'ban-le', label: 'Bán lẻ' },
  { id: 'fb', label: 'F&B' },
  { id: 'su-kien', label: 'Sự kiện' },
  { id: 'khac', label: 'Khác' },
] as const

type TabId = (typeof TABS)[number]['id']

interface SectorData {
  title: string
  points: string[]
  /** Nội dung bên trái: icon + 2 khối overlay */
  left: {
    icon: string
    block1: { title: string; items: string[] }
    block2: { title: string; items: string[] }
  }
}

const SECTOR_CONTENT: Record<TabId, SectorData> = {
  'tuyen-sinh': {
    title: 'Lĩnh vực Tuyển sinh',
    points: [
      'Thu hút và tối ưu chuyển đổi học viên đăng ký',
      'Tiếp cận đúng thời điểm, gia tăng tỷ lệ chốt đơn',
      'Dữ liệu tập trung, tối ưu chiến dịch tiếp thị',
      'Quản lý khóa học / học viên / chương trình học xuyên suốt',
    ],
    left: {
      icon: '🎓',
      block1: { title: 'Thư viện block', items: ['Form đăng ký', 'Lịch khai giảng', 'Gallery khóa học...'] },
      block2: { title: 'Form liên hệ', items: ['Tiêu đề, Nội dung', 'Gửi email tư vấn'] },
    },
  },
  'dao-tao': {
    title: 'Lĩnh vực Đào tạo',
    points: [
      'Website khóa học chuyên nghiệp, dễ cập nhật',
      'Tích hợp đăng ký, thanh toán, lịch học',
      'Tự động hóa nhắc lịch, gửi tài liệu',
      'Báo cáo theo dõi học viên và doanh thu',
    ],
    left: {
      icon: '📚',
      block1: { title: 'Block khóa học', items: ['Danh sách khóa', 'Lịch học', 'Giảng viên...'] },
      block2: { title: 'Đăng ký / Thanh toán', items: ['Form đăng ký', 'Lịch thanh toán'] },
    },
  },
  'ban-le': {
    title: 'Lĩnh vực Bán lẻ',
    points: [
      'Trang sản phẩm chuẩn SEO, tối ưu chuyển đổi',
      'Giỏ hàng, thanh toán đa kênh',
      'Quản lý đơn hàng, tồn kho đơn giản',
      'AI viết mô tả sản phẩm, gợi ý meta',
    ],
    left: {
      icon: '🛒',
      block1: { title: 'Thư viện block', items: ['Sản phẩm', 'Giỏ hàng', 'Bộ lọc...'] },
      block2: { title: 'Checkout', items: ['Thông tin giao hàng', 'Thanh toán'] },
    },
  },
  fb: {
    title: 'Lĩnh vực F&B',
    points: [
      'Menu trực tuyến, đặt bàn / giao hàng',
      'Khuyến mãi, combo, voucher dễ thiết lập',
      'Tích hợp đơn vị giao hàng',
      'Landing page sự kiện, món mới',
    ],
    left: {
      icon: '🍽️',
      block1: { title: 'Block Menu', items: ['Danh mục món', 'Combo', 'Đặt bàn...'] },
      block2: { title: 'Đặt hàng / Giao hàng', items: ['Giỏ hàng', 'Địa chỉ giao'] },
    },
  },
  'su-kien': {
    title: 'Lĩnh vực Sự kiện',
    points: [
      'Landing đăng ký sự kiện, vé, form thu thập lead',
      'Countdown, thông báo tự động',
      'Quản lý danh sách khách, check-in',
      'Báo cáo sau sự kiện',
    ],
    left: {
      icon: '🎫',
      block1: { title: 'Block sự kiện', items: ['Countdown', 'Form đăng ký vé', 'Lịch...'] },
      block2: { title: 'Xác nhận tham gia', items: ['Gửi email', 'QR check-in'] },
    },
  },
  khac: {
    title: 'Lĩnh vực Khác',
    points: [
      'Website giới thiệu, portfolio, dịch vụ',
      'Blog, tin tức, SEO nội dung',
      'Form liên hệ, đặt lịch tư vấn',
      'Tùy biến theo nhu cầu từng ngành',
    ],
    left: {
      icon: '✨',
      block1: { title: 'Thư viện block', items: ['Hero, Form', 'Gallery', 'Button...'] },
      block2: { title: 'Form liên hệ', items: ['Tiêu đề, Nội dung', 'Gửi email'] },
    },
  },
}

export function SolutionTabs() {
  const [active, setActive] = useState<TabId>('tuyen-sinh')
  const [direction, setDirection] = useState<'right' | 'left'>('right')
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 })
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const activeIndex = TABS.findIndex((t) => t.id === active)
  const content = SECTOR_CONTENT[active]

  // Sliding pill indicator — cập nhật khi đổi tab hoặc resize
  const updatePill = useCallback(() => {
    const el = tabRefs.current[activeIndex]
    if (!el) return
    setPillStyle({ left: el.offsetLeft, width: el.offsetWidth })
  }, [activeIndex])
  useEffect(() => {
    updatePill()
    const t = setTimeout(updatePill, 100)
    return () => clearTimeout(t)
  }, [updatePill])
  useEffect(() => {
    window.addEventListener('resize', updatePill)
    return () => window.removeEventListener('resize', updatePill)
  }, [updatePill])

  const handleTabClick = (id: TabId, index: number) => {
    if (id === active) return
    setDirection(index > activeIndex ? 'right' : 'left')
    setActive(id)
  }

  return (
    <div className="space-y-8">
      {/* Tab bar với pill trượt */}
      <div className="relative flex flex-wrap justify-center gap-1 p-1.5 rounded-2xl bg-zinc-100 border border-zinc-200">
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[index] = el }}
            type="button"
            onClick={() => handleTabClick(tab.id, index)}
            className={`relative z-10 rounded-xl px-5 py-3 text-sm font-semibold transition-colors duration-200 ${
              active === tab.id
                ? 'text-white'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <span
          className="absolute bottom-1.5 top-1.5 z-0 rounded-xl bg-sky-500 shadow-lg shadow-sky-500/30 transition-all duration-300 ease-out"
          style={{ left: pillStyle.left + 6, width: pillStyle.width - 12 }}
        />
      </div>

      {/* Card lớn: trái minh họa theo lĩnh vực, phải nội dung slide */}
      <div className="rounded-3xl border-2 border-zinc-200 bg-white shadow-2xl shadow-zinc-200/50 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[360px]">
          {/* Left: thay đổi theo tab */}
          <div className="relative min-h-[260px] lg:min-h-[360px] bg-gradient-to-br from-sky-50 via-blue-50 to-sky-100 flex items-center justify-center p-8 transition-colors duration-300">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-36 h-36 rounded-full bg-white/90 border-2 border-sky-200 shadow-xl flex items-center justify-center text-6xl transition-transform duration-300 hover:scale-105">
                {content.left.icon}
              </div>
            </div>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-40 rounded-xl bg-white/95 border-2 border-dashed border-sky-200 shadow-lg p-3 text-xs text-zinc-600 space-y-1.5 hidden sm:block animate-float">
              <p className="font-bold text-zinc-800">{content.left.block1.title}</p>
              {content.left.block1.items.map((item, i) => (
                <p key={i}>{item}</p>
              ))}
            </div>
            <div className="absolute right-4 bottom-10 w-44 rounded-xl bg-white/95 border-2 border-dashed border-sky-200 shadow-lg p-3 text-xs text-zinc-600 space-y-1.5 hidden sm:block animate-float-delay">
              <p className="font-bold text-zinc-800">{content.left.block2.title}</p>
              {content.left.block2.items.map((item, i) => (
                <p key={i}>{item}</p>
              ))}
              <p className="text-sky-600 font-medium pt-1">Gửi email</p>
            </div>
          </div>

          {/* Right: nội dung slide theo tab */}
          <div className="relative overflow-hidden p-8 lg:p-10 flex flex-col justify-center bg-gradient-to-b from-white to-zinc-50/50">
            <div
              key={active}
              className={`${direction === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}
            >
              <h3 className="text-2xl font-heading font-bold text-zinc-900 mb-6">
                {content.title}
              </h3>
              <ul className="space-y-3 mb-8">
                {content.points.map((point, i) => (
                  <li key={i} className="flex items-start gap-3 text-zinc-600 text-sm">
                    <span className="text-sky-500 mt-0.5 shrink-0">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="rotate-45">
                        <path d="M8 0L16 8L8 16L0 8L8 0Z" />
                      </svg>
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-zinc-500 mb-3">Thương hiệu tin dùng:</p>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-9 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                  Logo 1
                </div>
                <div className="w-14 h-9 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                  Logo 2
                </div>
                <div className="w-14 h-9 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                  Logo 3
                </div>
              </div>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold px-8 py-3.5 text-sm w-fit transition-all hover:shadow-lg hover:shadow-sky-500/25"
              >
                Tìm hiểu thêm
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
