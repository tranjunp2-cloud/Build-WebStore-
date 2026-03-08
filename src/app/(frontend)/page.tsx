import Link from 'next/link'
import { Sparkles, Globe, LayoutTemplate, ShoppingBag, Search, Zap, Check } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* ─── Navigation (LadiPage-style) ───────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 backdrop-blur-md bg-zinc-950/90">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-heading font-bold text-xl text-white">PrimeWeb</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#san-pham" className="text-sm text-zinc-400 hover:text-white transition-colors">Sản phẩm</a>
            <a href="#giai-phap" className="text-sm text-zinc-400 hover:text-white transition-colors">Giải pháp</a>
            <a href="#features" className="text-sm text-zinc-400 hover:text-white transition-colors">Tính năng</a>
            <a href="#tai-sao" className="text-sm text-zinc-400 hover:text-white transition-colors">Tại sao chọn</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors px-4 py-2">
              Đăng nhập
            </Link>
            <Link href="/register" className="btn-primary text-sm !px-5 !py-2.5">
              Bắt đầu miễn phí
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero (LadiPage-style: trust + headline + sub + CTA) ────────────── */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <p className="text-zinc-400 text-sm md:text-base mb-6">
            Hàng nghìn doanh nghiệp nhỏ tin dùng PrimeWeb
          </p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-heading font-bold leading-tight mb-6">
            Nền tảng toàn diện cho
            <br />
            <span className="gradient-text-brand">Website & Marketing</span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10">
            Thúc đẩy tăng trưởng khách hàng, doanh thu và tối ưu vận hành — tạo website chuyên nghiệp bằng AI trong 5 phút.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
            <Link href="/register" className="btn-primary px-10 py-4 text-lg inline-flex items-center justify-center gap-2">
              Bắt đầu miễn phí ngay
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a href="#san-pham" className="btn-secondary px-10 py-4 text-lg inline-flex items-center justify-center">
              Khám phá sản phẩm
            </a>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-500">
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> Không cần thẻ tín dụng</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> Chuẩn SEO từ đầu</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> Tên miền riêng</span>
          </div>
        </div>
      </section>

      {/* ─── Một nền tảng vận hành (3 pillars - LadiPage style) ─────────────── */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Một nền tảng vận hành website xuyên suốt
            </h2>
            <p className="text-zinc-400 text-lg">
              Từ tạo website bằng AI, chỉnh sửa đến bán hàng và SEO — PrimeWeb giúp doanh nghiệp quản lý trọn vẹn trên một hệ thống.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Sparkles, title: 'Tạo website bằng AI', desc: 'Chat với AI để tạo website chuyên nghiệp trong 5 phút. Kéo thả chỉnh sửa, mẫu đẹp sẵn.' },
              { icon: Globe, title: 'Chỉnh sửa & Xuất bản', desc: 'Editor trực quan, block-based. Xuất bản ngay, tên miền riêng, SSL miễn phí.' },
              { icon: ShoppingBag, title: 'Bán hàng & SEO', desc: 'Quản lý sản phẩm, giỏ hàng, thanh toán. AI tối ưu SEO và nội dung.' },
            ].map((item, i) => (
              <div key={i} className="p-8 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-sky-500/20 transition-all">
                <item.icon className="w-10 h-10 text-sky-400 mb-4" />
                <h3 className="text-lg font-heading font-bold text-white mb-2">{item.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Sản phẩm (Product blocks - LadiPage style) ────────────────────── */}
      <section id="san-pham" className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold uppercase tracking-widest text-sky-400 mb-4">Sản phẩm</p>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Website & Landing Page chuyển đổi cao
            </h2>
            <p className="text-zinc-400 text-lg">Thiết kế đẹp, AI tạo nhanh, tối ưu mọi thiết bị và SEO.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* AI Website Builder */}
            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden hover:border-sky-500/30 transition-all">
              <div className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-purple-600 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-heading font-bold text-white">AI Website Builder</h3>
                </div>
                <ul className="space-y-2 text-zinc-400 text-sm mb-6">
                  <li className="flex items-start gap-2">• Chat với AI, mô tả doanh nghiệp → website hoàn chỉnh trong vài phút</li>
                  <li className="flex items-start gap-2">• Hơn 900+ mẫu block: Hero, Giới thiệu, Sản phẩm, Liên hệ...</li>
                  <li className="flex items-start gap-2">• Kéo thả chỉnh sửa, tối ưu mọi thiết bị</li>
                  <li className="flex items-start gap-2">• Chuẩn SEO, tải trang nhanh</li>
                </ul>
                <Link href="/register" className="text-sky-400 font-medium text-sm hover:text-sky-300 inline-flex items-center gap-1">
                  Dùng thử miễn phí →
                </Link>
              </div>
            </div>

            {/* Templates & Editor */}
            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden hover:border-sky-500/30 transition-all">
              <div className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                    <LayoutTemplate className="w-6 h-6 text-sky-400" />
                  </div>
                  <h3 className="text-xl font-heading font-bold text-white">Template & Editor</h3>
                </div>
                <ul className="space-y-2 text-zinc-400 text-sm mb-6">
                  <li className="flex items-start gap-2">• Nhiều mẫu theo ngành: Bán lẻ, F&B, Tuyển sinh, Portfolio</li>
                  <li className="flex items-start gap-2">• Chỉnh sửa trực quan, sửa inline từng block</li>
                  <li className="flex items-start gap-2">• Xuất bản một click, subdomain hoặc tên miền riêng</li>
                </ul>
                <Link href="/templates" className="text-sky-400 font-medium text-sm hover:text-sky-300 inline-flex items-center gap-1">
                  Xem bộ sưu tập →
                </Link>
              </div>
            </div>

            {/* E-commerce & SEO */}
            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden hover:border-sky-500/30 transition-all">
              <div className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                    <ShoppingBag className="w-6 h-6 text-sky-400" />
                  </div>
                  <h3 className="text-xl font-heading font-bold text-white">Trang bán hàng & Thanh toán</h3>
                </div>
                <ul className="space-y-2 text-zinc-400 text-sm mb-6">
                  <li className="flex items-start gap-2">• Sản phẩm, giỏ hàng, thanh toán trực tuyến</li>
                  <li className="flex items-start gap-2">• Đa phương thức thanh toán, đơn vị vận chuyển</li>
                  <li className="flex items-start gap-2">• AI viết mô tả sản phẩm, tối ưu SEO</li>
                </ul>
                <Link href="/register" className="text-sky-400 font-medium text-sm hover:text-sky-300 inline-flex items-center gap-1">
                  Bắt đầu bán hàng →
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden hover:border-sky-500/30 transition-all">
              <div className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                    <Search className="w-6 h-6 text-sky-400" />
                  </div>
                  <h3 className="text-xl font-heading font-bold text-white">SEO & Phân tích</h3>
                </div>
                <ul className="space-y-2 text-zinc-400 text-sm mb-6">
                  <li className="flex items-start gap-2">• Điểm SEO từng trang, AI gợi ý sửa meta</li>
                  <li className="flex items-start gap-2">• JSON-LD, sitemap tự động</li>
                  <li className="flex items-start gap-2">• Dashboard theo dõi đơn hàng, doanh thu</li>
                </ul>
                <Link href="/register" className="text-sky-400 font-medium text-sm hover:text-sky-300 inline-flex items-center gap-1">
                  Tối ưu ngay →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Giải pháp theo ngành (LadiPage style) ─────────────────────────── */}
      <section id="giai-phap" className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Giải pháp toàn diện cho mọi lĩnh vực kinh doanh
            </h2>
            <p className="text-zinc-400 text-lg">
              Tùy biến theo đặc thù từng ngành để triển khai website và marketing hiệu quả.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {['Bán lẻ', 'F&B', 'Tuyển sinh', 'Đào tạo', 'Sự kiện', 'Dịch vụ', 'Portfolio', 'Cá nhân'].map((name, i) => (
              <a
                key={i}
                href="/register"
                className="p-6 rounded-xl border border-white/10 bg-white/5 text-center hover:bg-white/10 hover:border-sky-500/20 transition-all"
              >
                <span className="font-medium text-white">{name}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Tại sao chọn PrimeWeb (LadiPage style) ─────────────────────────── */}
      <section id="tai-sao" className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Tại sao nên chọn PrimeWeb?
            </h2>
            <p className="text-zinc-400 text-lg">
              Nền tảng Website AI hàng đầu, tạo website nhanh và vận hành marketing toàn diện.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: 'Dễ dùng — triển khai nhanh', points: ['Chỉ cần chat với AI, không cần biết code', 'Kéo thả chỉnh sửa', 'Rút ngắn thời gian lên web'] },
              { title: 'Bảo mật & ổn định', points: ['Hạ tầng bảo mật', 'Tối ưu hiệu suất', 'Giao diện mọi thiết bị'] },
              { title: 'Kết nối dữ liệu liền mạch', points: ['Dữ liệu đa kênh về một nơi', 'Tích hợp thanh toán, vận chuyển', 'ECH Centralised Distribution'] },
              { title: 'AI toàn diện', points: ['Tạo website bằng chat', 'AI viết mô tả, tối ưu SEO', 'Tự động hóa nội dung'] },
            ].map((block, i) => (
              <div key={i} className="p-6 rounded-2xl border border-white/10 bg-white/5">
                <h3 className="font-heading font-bold text-white mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-sky-400" />
                  {block.title}
                </h3>
                <ul className="space-y-2 text-zinc-400 text-sm">
                  {block.points.map((p, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features (id for nav) ─────────────────────────────────────────── */}
      <section id="features" className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold uppercase tracking-widest text-sky-400 mb-4">Tính năng</p>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Mọi thứ bạn cần để <span className="gradient-text">Xây dựng & Phát triển</span>
            </h2>
            <p className="text-zinc-400 text-lg">Từ tạo website bằng AI đến chỉnh sửa kéo thả — tất cả trên một nền tảng.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '🤖', title: 'Tạo website bằng AI', desc: 'Mô tả doanh nghiệp bằng ngôn ngữ tự nhiên, AI tạo website hoàn chỉnh trong vài giây.' },
              { icon: '🧩', title: 'Editor kéo thả', desc: 'Tùy chỉnh từng block: Hero, Giới thiệu, Sản phẩm, Liên hệ và nhiều hơn.' },
              { icon: '🔍', title: 'Chuẩn SEO', desc: 'Server-side rendering, Google index đầy đủ, dữ liệu có cấu trúc sẵn.' },
              { icon: '🎨', title: 'Mẫu đẹp sẵn', desc: 'Nhiều template theo ngành: nhà hàng, bán lẻ, portfolio, blog.' },
              { icon: '🌐', title: 'Tên miền riêng', desc: 'Kết nối tên miền của bạn trong vài phút. SSL miễn phí.' },
              { icon: '📦', title: 'Sẵn sàng bán hàng', desc: 'Sản phẩm, giỏ hàng, thanh toán — tích hợp sẵn.' },
            ].map((f, i) => (
              <div key={i} className="p-8 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-sky-500/20 transition-all">
                <span className="text-3xl mb-4 block">{f.icon}</span>
                <h3 className="text-lg font-heading font-bold text-white mb-2">{f.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA cuối (LadiPage style) ──────────────────────────────────────── */}
      <section className="py-24 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-b from-sky-500/10 to-transparent rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
            Tăng trưởng khách hàng và doanh thu bền vững cùng PrimeWeb
          </h2>
          <p className="text-zinc-400 text-lg mb-10">
            Hợp nhất tạo website, chỉnh sửa, bán hàng và SEO trên một nền tảng. Bắt đầu với tài khoản miễn phí.
          </p>
          <Link href="/register" className="btn-primary px-12 py-5 text-lg inline-flex items-center gap-2">
            Bắt đầu với tài khoản miễn phí
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────────────────── */}
      <footer className="py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-sky-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
              <span className="font-heading font-semibold text-white">PrimeWeb</span>
            </div>
            <div className="flex gap-6 text-sm text-zinc-500">
              <a href="#san-pham" className="hover:text-white transition-colors">Sản phẩm</a>
              <a href="#giai-phap" className="hover:text-white transition-colors">Giải pháp</a>
              <Link href="/login" className="hover:text-white transition-colors">Đăng nhập</Link>
              <Link href="/register" className="text-sky-400 hover:text-sky-300 transition-colors">Đăng ký</Link>
            </div>
          </div>
          <p className="mt-6 text-sm text-zinc-600 text-center md:text-left">© 2026 PrimeWeb. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
