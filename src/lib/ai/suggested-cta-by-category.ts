/**
 * Per-category CTA label suggestions for AI generator.
 *
 * Used to inject context-appropriate CTA hints into the AI user prompt
 * so GPT generates action-oriented, industry-specific CTAs instead of
 * generic fallbacks like "Xem thêm" or "Learn More".
 *
 * Structure: per-category, per-language arrays.
 * Must NOT overlap with BLOCKED_CTA_BY_LANG lists in content-rules.ts.
 *
 * Plan 260429-1032 Phase 5 — per-category CTA suggestion.
 */

export type CTALang = 'vi' | 'en' | 'ms'

export const SUGGESTED_CTA_BY_CATEGORY: Record<string, Record<CTALang, string[]>> = {
  restaurant: {
    vi: ['Đặt bàn ngay', 'Xem thực đơn', 'Gọi món online'],
    en: ['Reserve a Table', 'Order Online', 'View Menu'],
    ms: ['Tempah Meja', 'Lihat Menu', 'Pesan Sekarang'],
  },
  fnb: {
    vi: ['Đặt món ngay', 'Xem menu', 'Đặt hàng ngay'],
    en: ['Order Now', 'View Menu', 'Order Delivery'],
    ms: ['Pesan Sekarang', 'Lihat Menu', 'Hantar Ke Rumah'],
  },
  ecommerce: {
    vi: ['Mua ngay', 'Khám phá sản phẩm', 'Xem bộ sưu tập'],
    en: ['Shop Now', 'Browse Collection', 'See All Products'],
    ms: ['Beli Sekarang', 'Terokai Produk', 'Lihat Koleksi'],
  },
  beauty: {
    vi: ['Đặt lịch tư vấn', 'Khám phá dịch vụ', 'Đặt lịch ngay'],
    en: ['Book Appointment', 'View Treatments', 'Explore Services'],
    ms: ['Buat Temujanji', 'Terokai Perkhidmatan', 'Tempah Sekarang'],
  },
  health: {
    vi: ['Đặt lịch khám', 'Tư vấn miễn phí', 'Đặt lịch ngay'],
    en: ['Book Consultation', 'See a Doctor', 'Schedule an Appointment'],
    ms: ['Buat Temujanji', 'Rujuk Doktor', 'Jadualkan Pemeriksaan'],
  },
  education: {
    vi: ['Đăng ký tư vấn ngay', 'Khám phá lộ trình học', 'Bắt đầu học miễn phí'],
    en: ['Book a Trial Class', 'View Curriculum', 'Enroll Now'],
    ms: ['Daftar Sekarang', 'Terokai Kursus', 'Cuba Percuma'],
  },
  realestate: {
    vi: ['Xem dự án', 'Liên hệ tư vấn', 'Đặt lịch tham quan'],
    en: ['Schedule a Viewing', 'Browse Properties', 'Get a Quote'],
    ms: ['Lihat Hartanah', 'Hubungi Ejen', 'Jadualkan Lawatan'],
  },
  fitness: {
    vi: ['Đăng ký tập thử', 'Xem gói tập', 'Bắt đầu ngay'],
    en: ['Start Free Trial', 'View Membership Plans', 'Join Now'],
    ms: ['Cuba Percuma', 'Lihat Pakej', 'Daftar Sekarang'],
  },
  tech: {
    vi: ['Dùng thử miễn phí', 'Xem demo', 'Bắt đầu ngay'],
    en: ['Get Started', 'Book a Demo', 'Start Free Trial'],
    ms: ['Cuba Percuma', 'Lihat Demo', 'Mulakan Sekarang'],
  },
  creative: {
    vi: ['Xem portfolio', 'Liên hệ hợp tác', 'Nhận báo giá'],
    en: ['View Portfolio', 'Get a Quote', "Let's Work Together"],
    ms: ['Lihat Portfolio', 'Hubungi Kami', 'Dapatkan Sebut Harga'],
  },
  business: {
    vi: ['Liên hệ ngay', 'Nhận báo giá', 'Đặt lịch tư vấn'],
    en: ['Get Started', 'Contact Us', 'Book a Call'],
    ms: ['Hubungi Kami', 'Dapatkan Sebut Harga', 'Buat Temujanji'],
  },
  events: {
    vi: ['Đặt vé ngay', 'Xem lịch sự kiện', 'Đăng ký tham dự'],
    en: ['Get Tickets', 'Register Now', 'View Schedule'],
    ms: ['Beli Tiket', 'Lihat Jadual', 'Daftar Sekarang'],
  },
  blog: {
    vi: ['Đọc ngay', 'Khám phá bài viết', 'Đăng ký nhận tin'],
    en: ['Read More', 'Explore Blog', 'Subscribe Now'],
    ms: ['Baca Sekarang', 'Terokai Artikel', 'Langgan Sekarang'],
  },
  travel: {
    vi: ['Đặt tour ngay', 'Khám phá điểm đến', 'Lên kế hoạch chuyến đi'],
    en: ['Book Now', 'Explore Destinations', 'Plan Your Trip'],
    ms: ['Tempah Sekarang', 'Terokai Destinasi', 'Rancang Perjalanan'],
  },
}

export function getCTAsByLang(category: string, lang: CTALang): string[] {
  const set = SUGGESTED_CTA_BY_CATEGORY[category]
  if (!set) return []
  return set[lang] ?? set.en ?? []
}
