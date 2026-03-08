'use client'

import Link from 'next/link'
import {
  Sparkles,
  Globe,
  LayoutTemplate,
  ShoppingBag,
  Search,
  Check,
  LayoutGrid,
  Type,
  Minus,
  Image,
  Star,
  Layers,
  AtSign,
  QrCode,
  Users,
  Settings,
  TrendingUp,
  UserPlus,
  DollarSign,
  Palette,
  Package,
} from 'lucide-react'
import { useI18n } from '@/i18n'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { SolutionTabs } from '@/components/frontend/SolutionTabs'

/** Header chung cho mọi section (LadiPage light theme) */
function SectionHeader({
  id,
  label,
  title,
  subtitle,
  titleHighlight,
}: {
  id?: string
  label?: string
  title: string
  subtitle: string
  titleHighlight?: string
}) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-14 md:mb-16">
      {label && (
        <p className="text-sm font-semibold uppercase tracking-widest text-sky-600 mb-3">
          {label}
        </p>
      )}
      <h2 id={id} className="text-3xl md:text-4xl font-heading font-bold text-zinc-900 mb-4">
        {title}
        {titleHighlight && (
          <span className="text-sky-600"> {titleHighlight}</span>
        )}
      </h2>
      <p className="text-zinc-600 text-base md:text-lg">{subtitle}</p>
    </div>
  )
}

export default function HomePage() {
  const { t } = useI18n()
  const featureItems = [
    { icon: '🤖', ...t.features.items.aiGeneration },
    { icon: '🧩', ...t.features.items.dragDrop },
    { icon: '🔍', ...t.features.items.seo },
    { icon: '🎨', ...t.features.items.templates },
    { icon: '🌐', ...t.features.items.domains },
    { icon: '📦', ...t.features.items.ecommerce },
    { icon: '📊', ...t.features.items.analytics },
    { icon: '🔗', ...t.features.items.integration },
    { icon: '⚡', ...t.features.items.performance },
  ]

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Navigation: main structure (i18n + LanguageSwitcher) + LadiPage light style + PrimeWeb */}
      <nav
        className="fixed top-0 w-full z-50 border-b border-zinc-200 bg-white/95 backdrop-blur-md"
        aria-label="Menu chính"
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-heading font-bold text-xl text-zinc-900">
              PrimeWeb
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#nen-tang" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">Nền tảng</a>
            <a href="#san-pham" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">Sản phẩm</a>
            <a href="#giai-phap" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">Giải pháp</a>
            <a href="#tai-sao" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">Tại sao chọn</a>
            <a href="#tinh-nang" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">Tính năng</a>
            <a href="#features" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">{t.nav.features}</a>
            <a href="#pricing" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">{t.nav.pricing}</a>
            <a href="#templates" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">{t.nav.templates}</a>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher variant="pill" />
            <Link href="/login" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors px-4 py-2">
              {t.common.signIn}
            </Link>
            <Link href="/signup" className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm px-5 py-2.5 transition-colors">
              {t.common.getStartedFree}
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: HERO (split — left content + right app showcase)
      ═══════════════════════════════════════════════════════════════════ */}
      <section
        className="pt-28 pb-24 lg:pt-32 lg:pb-32 relative overflow-hidden bg-white"
        aria-labelledby="hero-heading"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="text-center lg:text-left order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-sky-500/20 bg-sky-500/5 text-sky-600 text-sm font-medium mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                </span>
                {t.hero.badge}
              </div>
              <h1
                id="hero-heading"
                className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold leading-tight mb-5 text-zinc-900"
              >
                {t.hero.title1}
                <br />
                <span className="text-sky-600">{t.hero.title2}</span> {t.hero.title3}
              </h1>
              <p className="text-base md:text-lg text-zinc-600 mb-8 max-w-xl mx-auto lg:mx-0">
                {t.hero.subtitle}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold px-8 py-4 text-lg shadow-lg shadow-sky-500/20 transition-all"
                >
                  {t.common.startBuilding}
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <a href="#demo" className="inline-flex items-center justify-center rounded-xl border-2 border-zinc-300 text-zinc-700 font-semibold px-8 py-4 text-lg hover:bg-zinc-50 transition-colors">
                  {t.common.watchDemo}
                </a>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-sm text-zinc-600">
                {[t.hero.noCreditCard, t.hero.seoOptimized, t.hero.customDomain].map((text, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    {text}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative order-1 lg:order-2 flex justify-center lg:justify-end">
              <div className="relative w-full max-w-[520px]">
                <div className="relative rounded-3xl bg-gradient-to-br from-sky-100 via-blue-50 to-sky-100 p-6 lg:p-8 border border-sky-200/60 shadow-xl shadow-sky-500/5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-lg bg-sky-500 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-zinc-500 text-sm">Bộ ứng dụng</span>
                    <span className="text-zinc-800 font-semibold text-sm">
                      Website & Marketing
                    </span>
                  </div>

                  <div className="relative hero-laptop-shadow rounded-xl overflow-hidden bg-zinc-800/90 border border-white/10">
                    <div className="absolute left-0 top-0 bottom-0 z-10 w-10 flex flex-col items-center py-3 gap-1 bg-zinc-900/95 border-r border-white/10">
                      {[
                        LayoutGrid,
                        Type,
                        Minus,
                        Image,
                        Star,
                        Layers,
                        AtSign,
                      ].map((Icon, i) => (
                        <button
                          key={i}
                          type="button"
                          className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                          aria-hidden
                        >
                          <Icon className="w-4 h-4" />
                        </button>
                      ))}
                    </div>

                    <div className="ml-10 min-h-[280px] bg-white">
                      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 bg-zinc-50">
                        <span className="text-sm font-medium text-zinc-700">
                          PrimeWeb · Trang chủ
                        </span>
                        <div className="flex gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-400" />
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          <span className="w-2 h-2 rounded-full bg-green-400" />
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex flex-col sm:flex-row gap-4 items-start">
                          <div className="flex-1">
                            <h3 className="text-zinc-800 font-bold text-lg mb-1">
                              Trải nghiệm website chuyên nghiệp
                            </h3>
                            <p className="text-zinc-500 text-sm mb-3">
                              Tạo bằng AI trong 5 phút. Chỉnh sửa kéo thả, xuất
                              bản ngay.
                            </p>
                            <div className="flex gap-2">
                              <span className="inline-block px-3 py-1.5 rounded-lg bg-sky-500 text-white text-xs font-medium">
                                Xem chi tiết
                              </span>
                              <span className="inline-block px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-600 text-xs font-medium">
                                Dùng thử
                              </span>
                            </div>
                          </div>
                          <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-sky-100 to-purple-100 flex items-center justify-center shrink-0">
                            <Globe className="w-8 h-8 text-sky-500" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="h-2 bg-zinc-700 rounded-b-lg" />
                  </div>

                  <div className="absolute animate-float right-2 top-1/2 -translate-y-1/2 z-20 w-52 rounded-xl bg-white shadow-xl border border-zinc-200 p-4 hidden sm:block">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-zinc-800">
                        Đã xác nhận
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs text-zinc-600">
                      <p>
                        <span className="text-zinc-400">Tên khách hàng:</span>{' '}
                        Nguyễn Văn A
                      </p>
                      <p>
                        <span className="text-zinc-400">SĐT:</span> 0901 234 567
                      </p>
                      <p>
                        <span className="text-zinc-400">Email:</span>{' '}
                        email@example.com
                      </p>
                      <p>
                        <span className="text-zinc-400">Tổng tiền:</span>{' '}
                        <span className="font-semibold text-zinc-800">
                          1.250.000đ
                        </span>
                      </p>
                    </div>
                    <div className="mt-3 flex justify-center">
                      <div className="w-12 h-12 rounded bg-zinc-100 flex items-center justify-center">
                        <QrCode className="w-6 h-6 text-zinc-500" />
                      </div>
                    </div>
                  </div>

                  <div className="absolute animate-float-delay left-0 bottom-8 z-20 w-44 rounded-xl bg-white backdrop-blur border border-zinc-200 shadow-xl p-3 hidden sm:block">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-sky-500" />
                      </div>
                      <span className="text-xs font-semibold text-zinc-800">
                        AI đã tạo xong
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Website của bạn đã sẵn sàng. Xuất bản ngay?
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: NỀN TẢNG (3 pillars + đường sóng nối icon + CTA)
      ═══════════════════════════════════════════════════════════════════ */}
      <section
        id="nen-tang"
        className="py-24 border-t border-zinc-200 bg-zinc-50/50"
        aria-labelledby="nen-tang-title"
      >
        <div className="max-w-7xl mx-auto px-6">
          <SectionHeader
            id="nen-tang-title"
            label="Nền tảng"
            title="Một nền tảng vận hành kinh doanh"
            subtitle="Từ thu hút khách hàng, bán hàng đến vận hành nội bộ — PrimeWeb giúp doanh nghiệp quản lý trọn vẹn trên một hệ thống duy nhất."
            titleHighlight="xuyên suốt"
          />
          {/* Đường sóng nối 3 icon (LadiPage style) */}
          <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-8 md:gap-4 max-w-4xl mx-auto mb-12">
            <svg className="absolute left-1/2 top-12 md:top-16 -translate-x-1/2 w-full max-w-xl h-2 pointer-events-none hidden md:block" aria-hidden>
              <path
                d="M 0 8 Q 80 0 160 8 T 320 8 T 480 8 T 640 8"
                fill="none"
                stroke="rgb(14 165 233 / 0.35)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            {[
              { icon: ShoppingBag, title: 'Website & Bán hàng', desc: 'Landing Page tối ưu chuyển đổi, trang bán hàng tích hợp thanh toán trực tuyến và AI tối ưu SEO.' },
              { icon: Users, title: 'Quản lý khách hàng', desc: 'Quản lý khách hàng tập trung, chăm sóc qua đa kênh và theo dõi doanh thu theo thời gian thực.' },
              { icon: Settings, title: 'Vận hành tinh gọn', desc: 'Quản lý công việc theo phòng ban, chuẩn hóa quy trình và theo dõi hiệu suất vận hành.' },
            ].map((item, i) => (
              <div key={i} className="relative flex flex-col items-center text-center md:flex-1">
                <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center mb-4 border-2 border-sky-200">
                  <item.icon className="w-8 h-8 text-sky-600" />
                </div>
                <h3 className="text-lg font-heading font-bold text-zinc-900 mb-2">{item.title}</h3>
                <p className="text-zinc-600 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link
              href="#san-pham"
              className="inline-flex items-center justify-center rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold px-8 py-4 transition-colors"
            >
              Khám phá hệ sinh thái PrimeWeb
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3: SẢN PHẨM (card lớn 2 cột + 4 block nhỏ)
      ═══════════════════════════════════════════════════════════════════ */}
      <section
        id="san-pham"
        className="py-24 border-t border-zinc-200 bg-white"
        aria-labelledby="san-pham-title"
      >
        <div className="max-w-7xl mx-auto px-6">
          <SectionHeader
            id="san-pham-title"
            label="Sản phẩm"
            title="Giải pháp toàn diện cho hành trình tăng trưởng"
            subtitle="Thiết kế đẹp, AI tạo nhanh, tối ưu mọi thiết bị và SEO."
          />
          {/* Card lớn 2 cột: trái list + phải builder mockup (LadiPage style) */}
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-xl overflow-hidden mb-16">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="p-8 lg:p-10 flex flex-col justify-center">
                <h3 className="text-2xl font-heading font-bold text-zinc-900 mb-6">
                  Landing Page & Website chuyển đổi cao
                </h3>
                <ul className="space-y-3 mb-6">
                  {[
                    'Thiết kế đẹp, kéo thả nhanh, tối ưu mọi thiết bị',
                    'Tải trang nhanh, chuẩn SEO',
                    'Hơn 900+ mẫu Landing Page sẵn sàng sử dụng',
                    'Đồng bộ dữ liệu đa kênh từ form về hệ thống lưu trữ',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-zinc-600 text-sm">
                      <span className="text-sky-500 shrink-0 mt-0.5">■</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 text-sky-700 px-3 py-1 text-xs font-medium">
                    <LayoutTemplate className="w-3.5 h-3.5" /> Landing Page
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 text-sky-700 px-3 py-1 text-xs font-medium">
                    <Globe className="w-3.5 h-3.5" /> Website Builder
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/signup" className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold px-6 py-3 text-sm transition-colors">
                    Xem chi tiết
                  </Link>
                  <Link href="/signup" className="text-sky-600 font-medium text-sm hover:text-sky-700 inline-flex items-center gap-1">
                    Dùng thử miễn phí →
                  </Link>
                </div>
              </div>
              <div className="relative min-h-[320px] bg-zinc-100 border-l border-zinc-200">
                <div className="absolute top-3 left-3 right-3 h-8 rounded-lg bg-sky-100 flex items-center px-3 gap-2">
                  <LayoutTemplate className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-medium text-sky-700">Thư viện mẫu</span>
                </div>
                <div className="absolute left-0 top-12 bottom-0 w-10 bg-zinc-800 flex flex-col items-center py-2 gap-1">
                  {[LayoutGrid, Type, Image, Star, Layers].map((Icon, i) => (
                    <span key={i} className="p-1.5 rounded text-zinc-400"><Icon className="w-4 h-4" /></span>
                  ))}
                </div>
                <div className="absolute left-10 top-12 right-0 bottom-0 p-4 bg-white">
                  <div className="rounded-lg border border-zinc-200 p-3 space-y-2">
                    <div className="h-2 w-3/4 rounded bg-zinc-200" />
                    <div className="h-2 w-1/2 rounded bg-zinc-100" />
                    <div className="flex gap-2 mt-3">
                      <div className="w-16 h-16 rounded-lg bg-zinc-200" />
                      <div className="flex-1">
                        <div className="h-3 w-full rounded bg-zinc-200 mb-2" />
                        <div className="h-3 w-2/3 rounded bg-zinc-100" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {[
              {
                icon: Sparkles,
                title: 'AI Website Builder',
                items: [
                  'Chat với AI, mô tả doanh nghiệp → website hoàn chỉnh trong vài phút',
                  'Hơn 900+ mẫu block: Hero, Giới thiệu, Sản phẩm, Liên hệ...',
                  'Kéo thả chỉnh sửa, tối ưu mọi thiết bị',
                  'Chuẩn SEO, tải trang nhanh',
                ],
                cta: 'Dùng thử miễn phí',
                href: '/register',
              },
              {
                icon: LayoutTemplate,
                title: 'Template & Editor',
                items: [
                  'Nhiều mẫu theo ngành: Bán lẻ, F&B, Tuyển sinh, Portfolio',
                  'Chỉnh sửa trực quan, sửa inline từng block',
                  'Xuất bản một click, subdomain hoặc tên miền riêng',
                ],
                cta: 'Xem bộ sưu tập',
                href: '/templates',
              },
              {
                icon: ShoppingBag,
                title: 'Trang bán hàng & Thanh toán',
                items: [
                  'Sản phẩm, giỏ hàng, thanh toán trực tuyến',
                  'Đa phương thức thanh toán, đơn vị vận chuyển',
                  'AI viết mô tả sản phẩm, tối ưu SEO',
                ],
                cta: 'Bắt đầu bán hàng',
                href: '/register',
              },
              {
                icon: Search,
                title: 'SEO & Phân tích',
                items: [
                  'Điểm SEO từng trang, AI gợi ý sửa meta',
                  'JSON-LD, sitemap tự động',
                  'Dashboard theo dõi đơn hàng, doanh thu',
                ],
                cta: 'Tối ưu ngay',
                href: '/register',
              },
            ].map((block, i) => (
              <div
                key={i}
                className="rounded-2xl border border-zinc-200 bg-zinc-50/50 overflow-hidden hover:border-sky-300 hover:shadow-lg hover:shadow-sky-500/5 transition-all"
              >
                <div className="p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center">
                      <block.icon className="w-6 h-6 text-sky-600" />
                    </div>
                    <h3 className="text-xl font-heading font-bold text-zinc-900">
                      {block.title}
                    </h3>
                  </div>
                  <ul className="space-y-2 text-zinc-600 text-sm mb-6">
                    {block.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2">
                        • {item}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={block.href}
                    className="text-sky-600 font-medium text-sm hover:text-sky-700 inline-flex items-center gap-1"
                  >
                    {block.cta} →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4: GIẢI PHÁP THEO NGÀNH (tab + card lớn LadiPage)
      ═══════════════════════════════════════════════════════════════════ */}
      <section
        id="giai-phap"
        className="py-24 border-t border-zinc-200 bg-zinc-50/50"
        aria-labelledby="giai-phap-title"
      >
        <div className="max-w-7xl mx-auto px-6">
          <SectionHeader
            id="giai-phap-title"
            title="Nền tảng toàn diện đáp ứng mọi lĩnh vực kinh doanh"
            subtitle="Tùy biến theo đặc thù từng ngành để triển khai chiến lược vận hành hiệu quả."
          />
          <SolutionTabs />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 5: TẠI SAO CHỌN (4 số liệu + 6 thẻ 2x3, diamond bullet)
      ═══════════════════════════════════════════════════════════════════ */}
      <section
        id="tai-sao"
        className="py-24 border-t border-zinc-200 bg-white"
        aria-labelledby="tai-sao-title"
      >
        <div className="max-w-7xl mx-auto px-6">
          <SectionHeader
            id="tai-sao-title"
            title="Tại sao nên chọn PrimeWeb?"
            subtitle="Nền tảng Website AI hàng đầu Việt Nam, tiên phong tạo website bằng AI và vận hành Marketing & Sales toàn diện."
          />
          {/* 4 số liệu (LadiPage style) */}
          <div className="flex flex-wrap justify-center gap-8 md:gap-12 mb-16 py-8 border-y border-zinc-200">
            {[
              { value: '10,000+', label: 'Khách hàng sử dụng' },
              { value: '50,000+', label: 'Website được xuất bản' },
              { value: '900+', label: 'Mẫu block sẵn sàng' },
              { value: '5 phút', label: 'Tạo website bằng AI' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl md:text-3xl font-heading font-bold text-sky-600">{stat.value}</p>
                <p className="text-sm text-zinc-600 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
          {/* 6 thẻ 2x3, bullet hình thoi xanh */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Dễ dùng — triển khai nhanh', points: ['Thiết kế chỉ cần kéo thả', 'Không cần biết code', 'Rút ngắn thời gian triển khai'] },
              { title: 'Kết nối dữ liệu liền mạch', points: ['Thu dữ liệu từ đa kênh về 1 nơi', 'Kết nối form, email và nhiều kênh khác'] },
              { title: 'Bảo mật cao, vận hành ổn định', points: ['Hạ tầng bảo mật, tối ưu hiệu suất', 'Giao diện thân thiện, mọi thiết bị'] },
              { title: 'Nội dung của bạn', points: ['Editor trực quan, chỉnh sửa nhanh', 'AI gợi ý mô tả, SEO'] },
              { title: 'Tương tác và tự động hóa', points: ['Tương tác khách hàng đa kênh', 'Nuôi dưỡng xuyên suốt hành trình', 'Tự động hóa tác vụ'] },
              { title: 'AI toàn diện', points: ['Tạo website bằng chat', 'AI viết mô tả, tối ưu SEO', 'Tự động hóa nội dung'] },
            ].map((block, i) => (
              <div key={i} className="p-6 rounded-2xl border border-zinc-200 bg-white shadow-sm hover:shadow-md hover:border-sky-200 transition-all">
                <h3 className="font-heading font-bold text-zinc-900 mb-4">{block.title}</h3>
                <ul className="space-y-2 text-zinc-600 text-sm">
                  {block.points.map((p, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <span className="text-sky-500 shrink-0 mt-0.5">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="rotate-45">
                          <path d="M8 0L16 8L8 16L0 8L8 0Z" />
                        </svg>
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section (main i18n: t.features + featureItems) — light theme */}
      <section id="features" className="py-24 border-t border-zinc-200 bg-zinc-50/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold uppercase tracking-widest text-sky-600 mb-4">{t.features.label}</p>
            <h2 className="text-4xl md:text-5xl font-heading font-bold text-zinc-900 mb-6">
              {t.features.title} <span className="text-sky-600">{t.features.titleHighlight}</span>
            </h2>
            <p className="text-zinc-600 text-lg">{t.features.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featureItems.map((feature, i) => (
              <div key={i} className="group p-8 rounded-2xl border border-zinc-200 bg-white shadow-sm hover:shadow-md hover:border-sky-200 transition-all">
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className="text-lg font-heading font-bold text-zinc-900 mb-2 group-hover:text-sky-600 transition-colors">{feature.title}</h3>
                <p className="text-zinc-600 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 6: TÍNH NĂNG (6 cards — icon màu, hover nổi, stagger)
      ═══════════════════════════════════════════════════════════════════ */}
      <section
        id="tinh-nang"
        className="py-24 border-t border-zinc-200 bg-white"
        aria-labelledby="tinh-nang-title"
      >
        <div className="max-w-7xl mx-auto px-6">
          <SectionHeader
            id="tinh-nang-title"
            label="Tính năng"
            title="Mọi thứ bạn cần để"
            subtitle="Từ tạo website bằng AI đến chỉnh sửa kéo thả — tất cả trên một nền tảng."
            titleHighlight="Xây dựng & Phát triển"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { Icon: Sparkles, title: 'Tạo website bằng AI', desc: 'Mô tả doanh nghiệp bằng ngôn ngữ tự nhiên, AI tạo website hoàn chỉnh trong vài giây.', accent: 'sky' },
              { Icon: LayoutTemplate, title: 'Editor kéo thả', desc: 'Tùy chỉnh từng block: Hero, Giới thiệu, Sản phẩm, Liên hệ và nhiều hơn.', accent: 'emerald' },
              { Icon: Search, title: 'Chuẩn SEO', desc: 'Server-side rendering, Google index đầy đủ, dữ liệu có cấu trúc sẵn.', accent: 'violet' },
              { Icon: Palette, title: 'Mẫu đẹp sẵn', desc: 'Nhiều template theo ngành: nhà hàng, bán lẻ, portfolio, blog.', accent: 'amber' },
              { Icon: Globe, title: 'Tên miền riêng', desc: 'Kết nối tên miền của bạn trong vài phút. SSL miễn phí.', accent: 'blue' },
              { Icon: Package, title: 'Sẵn sàng bán hàng', desc: 'Sản phẩm, giỏ hàng, thanh toán — tích hợp sẵn.', accent: 'rose' },
            ].map((f, i) => (
              <div
                key={i}
                className={`group relative p-8 rounded-2xl border-2 border-zinc-100 bg-gradient-to-b from-white to-zinc-50/80 hover:border-sky-200 hover:shadow-xl hover:shadow-sky-500/10 hover:-translate-y-1 transition-all duration-300 animate-fade-in-up ${['animate-fade-in-up-1', 'animate-fade-in-up-2', 'animate-fade-in-up-3', 'animate-fade-in-up-4', 'animate-fade-in-up-5', 'animate-fade-in-up-6'][i]}`}
              >
                <div
                  className={`inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 ${
                    f.accent === 'sky' ? 'bg-sky-100 text-sky-600' :
                    f.accent === 'emerald' ? 'bg-emerald-100 text-emerald-600' :
                    f.accent === 'violet' ? 'bg-violet-100 text-violet-600' :
                    f.accent === 'amber' ? 'bg-amber-100 text-amber-600' :
                    f.accent === 'blue' ? 'bg-blue-100 text-blue-600' :
                    'bg-rose-100 text-rose-600'
                  }`}
                >
                  <f.Icon className="w-7 h-7" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-heading font-bold text-zinc-900 mb-2 group-hover:text-sky-700 transition-colors">
                  {f.title}
                </h3>
                <p className="text-zinc-600 text-sm leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 7: CTA CUỐI (nền xanh full, chữ trắng, laptop + thẻ nổi)
      ═══════════════════════════════════════════════════════════════════ */}
      <section
        id="cta"
        className="py-24 lg:py-32 border-t border-sky-600 bg-sky-500 relative overflow-hidden"
        aria-labelledby="cta-heading"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h2
                id="cta-heading"
                className="text-3xl md:text-4xl font-heading font-bold text-white mb-6"
              >
                {t.cta.title} <span className="text-sky-100">{t.cta.titleHighlight}</span>?
              </h2>
              <p className="text-sky-100 text-lg mb-10">
                {t.cta.subtitle}
              </p>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-white text-sky-600 font-semibold px-8 py-4 border-2 border-white hover:bg-sky-50 hover:border-sky-50 transition-colors"
              >
                {t.cta.button}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
            {/* Right: laptop dashboard + floating components */}
            <div className="relative hidden lg:block">
              <div className="relative rounded-xl bg-white/10 backdrop-blur p-4 border border-white/20">
                <div className="rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700">
                  <div className="h-6 bg-zinc-700 flex items-center px-3 gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  </div>
                  <div className="p-4 flex gap-4">
                    <div className="w-24 h-24 rounded-full border-4 border-sky-400 border-t-green-400 border-r-amber-400 border-b-purple-400 flex items-center justify-center text-white font-bold text-lg">150</div>
                    <div className="flex-1 space-y-2">
                      <div className="h-2 w-full rounded bg-zinc-600" />
                      <div className="h-2 w-4/5 rounded bg-zinc-600" />
                      <div className="h-2 w-3/5 rounded bg-zinc-600" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute animate-float -top-2 right-4 w-44 rounded-xl bg-white shadow-xl p-4 text-zinc-800">
                <p className="text-xs font-semibold text-zinc-500 mb-1">Tối ưu chi phí vận hành</p>
                <p className="text-2xl font-bold">8,476</p>
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> 103,45%
                </p>
              </div>
              <div className="absolute animate-float-delay left-0 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-sky-500" />
              </div>
              <div className="absolute animate-float right-0 bottom-8 w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════════════════ */}
      <footer className="py-12 border-t border-zinc-200 bg-zinc-100" role="contentinfo">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
              <span className="font-heading font-semibold text-zinc-900">
                PrimeWeb
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-600">
              <a href="#nen-tang" className="hover:text-zinc-900 transition-colors">
                Nền tảng
              </a>
              <a href="#san-pham" className="hover:text-zinc-900 transition-colors">
                Sản phẩm
              </a>
              <a href="#giai-phap" className="hover:text-zinc-900 transition-colors">
                Giải pháp
              </a>
              <a href="#tai-sao" className="hover:text-zinc-900 transition-colors">
                Tại sao chọn
              </a>
              <a href="#tinh-nang" className="hover:text-zinc-900 transition-colors">
                Tính năng
              </a>
              <Link href="/login" className="hover:text-zinc-900 transition-colors">
                Đăng nhập
              </Link>
              <Link
                href="/signup"
                className="text-sky-600 hover:text-sky-700 font-medium transition-colors"
              >
                Đăng ký
              </Link>
            </div>
          </div>
          <p className="mt-6 text-sm text-zinc-500 text-center md:text-left">
            {t.common.copyright}
          </p>
        </div>
      </footer>
    </div>
  )
}
