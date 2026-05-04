/**
 * Per-category CTA label suggestions for AI generator.
 *
 * Used to inject context-appropriate CTA hints into the AI system prompt
 * so GPT generates action-oriented, industry-specific CTAs instead of
 * generic fallbacks like "Xem thêm" or "Learn More".
 *
 * Labels: Vietnamese first (primary market), then English alternatives.
 * Must NOT overlap with BLOCKED_CTA_BY_LANG lists in content-rules.ts.
 *
 * Plan 260429-1032 Phase 5 — per-category CTA suggestion.
 */

export const SUGGESTED_CTA_BY_CATEGORY: Record<string, string[]> = {
  restaurant: [
    'Đặt bàn ngay',
    'Xem thực đơn',
    'Gọi món online',
    'Reserve a Table',
    'Order Online',
    'View Menu',
  ],
  fnb: [
    'Đặt món ngay',
    'Xem menu',
    'Đặt hàng ngay',
    'Order Now',
    'View Menu',
    'Order Delivery',
  ],
  ecommerce: [
    'Mua ngay',
    'Khám phá sản phẩm',
    'Xem bộ sưu tập',
    'Shop Now',
    'Browse Collection',
    'See All Products',
  ],
  beauty: [
    'Đặt lịch tư vấn',
    'Khám phá dịch vụ',
    'Đặt lịch ngay',
    'Book Appointment',
    'View Treatments',
    'Explore Services',
  ],
  health: [
    'Đặt lịch khám',
    'Tư vấn miễn phí',
    'Đặt lịch ngay',
    'Book Consultation',
    'See a Doctor',
    'Schedule an Appointment',
  ],
  education: [
    'Đăng ký tư vấn ngay',
    'Khám phá lộ trình học',
    'Bắt đầu học miễn phí',
    'Book a Trial Class',
    'View Curriculum',
    'Enroll Now',
  ],
  realestate: [
    'Xem dự án',
    'Liên hệ tư vấn',
    'Đặt lịch tham quan',
    'Schedule a Viewing',
    'Browse Properties',
    'Get a Quote',
  ],
  fitness: [
    'Đăng ký tập thử',
    'Xem gói tập',
    'Bắt đầu ngay',
    'Start Free Trial',
    'View Membership Plans',
    'Join Now',
  ],
  tech: [
    'Dùng thử miễn phí',
    'Xem demo',
    'Bắt đầu ngay',
    'Get Started',
    'Book a Demo',
    'Start Free Trial',
  ],
  creative: [
    'Xem portfolio',
    'Liên hệ hợp tác',
    'Nhận báo giá',
    'View Portfolio',
    'Get a Quote',
    'Let\'s Work Together',
  ],
  business: [
    'Liên hệ ngay',
    'Nhận báo giá',
    'Đặt lịch tư vấn',
    'Get Started',
    'Contact Us',
    'Book a Call',
  ],
  events: [
    'Đặt vé ngay',
    'Xem lịch sự kiện',
    'Đăng ký tham dự',
    'Get Tickets',
    'Register Now',
    'View Schedule',
  ],
  blog: [
    'Đọc ngay',
    'Khám phá bài viết',
    'Đăng ký nhận tin',
    'Read More',
    'Explore Blog',
    'Subscribe Now',
  ],
  travel: [
    'Đặt tour ngay',
    'Khám phá điểm đến',
    'Lên kế hoạch chuyến đi',
    'Book Now',
    'Explore Destinations',
    'Plan Your Trip',
  ],
}
