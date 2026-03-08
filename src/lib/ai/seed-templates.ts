/**
 * 10 Industry-Based Template Definitions
 * Each template has industry-specific sections/blocks and theme.
 */

export interface TemplateSeed {
    name: string
    description: string
    category: string[]
    defaultTheme: {
        primaryColor: string
        secondaryColor: string
        fontHeading: string
        fontBody: string
        colorMode: 'light' | 'dark'
    }
    defaultBlocks: any[]
    tags: { tag: string }[]
    sortOrder: number
    isPremium: boolean
    isFeatured: boolean
}

// Helper to build nav block
const nav = (logo: string, links: string[], cta: string) => ({
    blockType: 'navigation', variant: 'simple',
    logoText: logo, links: links.map(l => ({ label: l, url: '#' })),
    ctaButton: { show: true, label: cta, url: '#' },
})

// Helper to build hero block
const hero = (h: string, sub: string, cta1: string, cta2?: string, variant = 'centered') => ({
    blockType: 'hero', variant, headline: h, subheadline: sub,
    badge: { show: true, text: '✨ Chào mừng' },
    ctaButtons: [
        { label: cta1, url: '#', style: 'primary' },
        ...(cta2 ? [{ label: cta2, url: '#', style: 'outline' }] : []),
    ],
})

// Helper to build features block
const features = (h: string, sub: string, items: { icon: string; title: string; desc: string }[], label?: string) => ({
    blockType: 'features', variant: 'grid-3', headline: h, subheadline: sub,
    sectionLabel: label || 'Dịch Vụ',
    features: items.map(i => ({ icon: i.icon, title: i.title, description: i.desc })),
})

// Helper for testimonials
const testimonials = (h: string, items: { name: string; quote: string; title?: string }[]) => ({
    blockType: 'testimonials', headline: h,
    testimonials: items.map(i => ({ name: i.name, quote: i.quote, rating: 5, title: i.title || '', company: '' })),
})

// Helper for contact
const contact = (h: string, email: string, phone: string, addr: string) => ({
    blockType: 'contact', headline: h, subtext: 'Liên hệ ngay để được tư vấn',
    email, phone, address: addr,
    formFields: [
        { label: 'Họ và tên', fieldType: 'text', required: true, placeholder: 'Nhập họ tên' },
        { label: 'Email', fieldType: 'email', required: true, placeholder: 'email@example.com' },
        { label: 'Số điện thoại', fieldType: 'phone', required: false, placeholder: '0901 234 567' },
        { label: 'Nội dung', fieldType: 'textarea', required: true, placeholder: 'Nội dung tin nhắn...' },
    ],
})

// Helper for footer
const footer = (logo: string, tagline: string, cols: { title: string; links: string[] }[]) => ({
    blockType: 'footer', logoText: logo, tagline,
    copyrightText: `© 2026 ${logo}. All rights reserved.`,
    columns: cols.map(c => ({ title: c.title, links: c.links.map(l => ({ label: l, url: '#' })) })),
})

// Helper for stats
const stats = (h: string, items: { value: string; label: string }[]) => ({
    blockType: 'stats', headline: h,
    stats: items.map(i => ({ value: i.value, label: i.label })),
})

// Helper for about
const about = (h: string, body: string, label?: string) => ({
    blockType: 'about', headline: h, body, sectionLabel: label || 'Về Chúng Tôi', layout: 'image-right',
})

// Helper for CTA
const cta = (h: string, sub: string, label: string) => ({
    blockType: 'cta', headline: h, subheadline: sub, ctaLabel: label, ctaUrl: '#', ctaStyle: 'primary',
})

// Helper for pricing
const pricing = (h: string, sub: string, plans: { name: string; price: string; desc: string; features: string[] }[]) => ({
    blockType: 'pricing', headline: h, subheadline: sub,
    plans: plans.map((p, i) => ({
        name: p.name, price: p.price, description: p.desc,
        features: p.features.map(f => ({ text: f, included: true })),
        isPopular: i === 1, ctaLabel: 'Chọn Gói', ctaUrl: '#',
    })),
})

// Helper for FAQ
const faq = (h: string, items: { q: string; a: string }[]) => ({
    blockType: 'faq', headline: h,
    faqs: items.map(i => ({ question: i.q, answer: i.a })),
})

// Helper for gallery
const gallery = (h: string, count: number) => ({
    blockType: 'gallery', headline: h,
    images: Array.from({ length: count }, (_, i) => ({ caption: `Hình ${i + 1}` })),
})

// Helper for team
const team = (h: string, members: { name: string; role: string }[]) => ({
    blockType: 'team', headline: h,
    members: members.map(m => ({ name: m.name, role: m.role, bio: '' })),
})

export const SEED_TEMPLATES: TemplateSeed[] = [
    // ─── 1. NHÀ HÀNG / CAFE / F&B ──────────────────────────────────────
    {
        name: 'Nhà hàng / Cafe / F&B',
        description: 'Template cho nhà hàng, quán cafe, tiệm bánh với menu highlights và giờ mở cửa.',
        category: ['restaurant'],
        defaultTheme: { primaryColor: '#D97706', secondaryColor: '#92400E', fontHeading: 'Playfair Display', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('Nhà Hàng Mẫu', ['Trang Chủ', 'Thực Đơn', 'Về Chúng Tôi', 'Liên Hệ'], 'Đặt Bàn'),
            hero('Hương Vị Đậm Đà, Trải Nghiệm Tuyệt Vời', 'Khám phá ẩm thực tinh tế từ những nguyên liệu tươi ngon nhất, được chế biến bởi đầu bếp hàng đầu.', 'Xem Thực Đơn', 'Đặt Bàn Ngay', 'split'),
            features('Thực Đơn Nổi Bật', 'Những món ăn được yêu thích nhất', [
                { icon: '🥩', title: 'Bò Wagyu Nướng', desc: 'Thịt bò Wagyu A5 nhập khẩu, nướng than hoa truyền thống.' },
                { icon: '🍝', title: 'Pasta Truffle', desc: 'Mì Ý tươi với nấm truffle đen và phô mai Parmesan.' },
                { icon: '🍣', title: 'Sashimi Tổng Hợp', desc: 'Cá hồi, cá ngừ, tôm ngọt từ Nhật Bản.' },
            ], 'Thực Đơn'),
            about('Câu Chuyện Của Chúng Tôi', 'Với hơn 10 năm kinh nghiệm, chúng tôi mang đến không gian ẩm thực tinh tế và ấm cúng. Mỗi món ăn là một tác phẩm nghệ thuật.', 'Về Chúng Tôi'),
            testimonials('Khách Hàng Nói Gì', [
                { name: 'Nguyễn Minh Anh', quote: 'Không gian tuyệt vời, đồ ăn ngon xuất sắc. Sẽ quay lại!', title: 'Food Blogger' },
                { name: 'Trần Văn Hùng', quote: 'Phục vụ chuyên nghiệp, món ăn đúng chuẩn fine dining.', title: 'Doanh nhân' },
                { name: 'Lê Thị Hương', quote: 'Tiệc sinh nhật ở đây hoàn hảo. Cảm ơn nhà hàng rất nhiều!', title: 'Khách hàng' },
            ]),
            contact('Đặt Bàn & Liên Hệ', 'hello@nhahangmau.vn', '028 1234 5678', '123 Nguyễn Huệ, Q.1, TP.HCM'),
            footer('Nhà Hàng Mẫu', 'Hương vị đậm đà, trải nghiệm tuyệt vời.', [
                { title: 'Giờ Mở Cửa', links: ['T2-T6: 10:00 - 22:00', 'T7-CN: 08:00 - 23:00'] },
                { title: 'Liên Kết', links: ['Thực đơn', 'Đặt bàn', 'Về chúng tôi'] },
            ]),
        ],
        tags: [{ tag: 'nhà hàng' }, { tag: 'cafe' }, { tag: 'f&b' }, { tag: 'đồ ăn' }],
        sortOrder: 1, isPremium: false, isFeatured: true,
    },

    // ─── 2. CỬA HÀNG / THỜI TRANG / E-COMMERCE ────────────────────────
    {
        name: 'Cửa hàng / Thời trang / E-commerce',
        description: 'Template cho shop online, thời trang, bán lẻ với sản phẩm nổi bật và chính sách mua hàng.',
        category: ['ecommerce'],
        defaultTheme: { primaryColor: '#E11D48', secondaryColor: '#BE123C', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('Shop Mẫu', ['Trang Chủ', 'Sản Phẩm', 'Bộ Sưu Tập', 'Liên Hệ'], 'Mua Ngay'),
            hero('Thời Trang Mới Nhất, Phong Cách Của Bạn', 'Khám phá bộ sưu tập mới nhất với thiết kế độc đáo và chất liệu cao cấp.', 'Xem Sản Phẩm', 'Sale Đến 50%'),
            features('Sản Phẩm Nổi Bật', 'Bộ sưu tập được yêu thích nhất', [
                { icon: '👗', title: 'Đầm Dạ Hội', desc: 'Đầm dạ hội thanh lịch, thiết kế độc quyền.' },
                { icon: '👜', title: 'Túi Xách Cao Cấp', desc: 'Túi xách da thật, phong cách hiện đại.' },
                { icon: '👟', title: 'Giày Sneaker', desc: 'Giày thể thao thoải mái, trendy mọi mùa.' },
                { icon: '💎', title: 'Phụ Kiện', desc: 'Trang sức và phụ kiện thời trang.' },
            ], 'Bộ Sưu Tập'),
            stats('Thành Tựu', [
                { value: '10,000+', label: 'Sản Phẩm' }, { value: '50,000+', label: 'Khách Hàng' },
                { value: '98%', label: 'Hài Lòng' }, { value: '24h', label: 'Giao Hàng' },
            ]),
            features('Chính Sách Mua Hàng', 'Cam kết phục vụ tốt nhất', [
                { icon: '🚚', title: 'Miễn Phí Ship', desc: 'Miễn phí vận chuyển cho đơn từ 500K.' },
                { icon: '🔄', title: 'Đổi Trả 30 Ngày', desc: 'Đổi trả miễn phí trong 30 ngày.' },
                { icon: '✅', title: 'Hàng Chính Hãng', desc: '100% sản phẩm chính hãng, có bảo hành.' },
            ], 'Cam Kết'),
            testimonials('Đánh Giá Từ Khách Hàng', [
                { name: 'Phạm Thị Mai', quote: 'Chất lượng tuyệt vời, giao hàng nhanh. Sẽ mua tiếp!', title: 'Khách hàng VIP' },
                { name: 'Hoàng Minh Tuấn', quote: 'Thiết kế đẹp, đúng size. Rất hài lòng.', title: 'Khách hàng' },
            ]),
            cta('🔥 Flash Sale — Giảm Đến 50%', 'Chỉ trong tuần này! Nhanh tay kẻo hết.', 'Mua Ngay'),
            contact('Liên Hệ Mua Hàng', 'shop@mau.vn', '0901 234 567', '456 Lê Lợi, Q.1, TP.HCM'),
            footer('Shop Mẫu', 'Thời trang chính hãng, giao hàng toàn quốc.', [
                { title: 'Mua Sắm', links: ['Sản phẩm mới', 'Bán chạy', 'Sale'] },
                { title: 'Hỗ Trợ', links: ['Đổi trả', 'Vận chuyển', 'Thanh toán'] },
            ]),
        ],
        tags: [{ tag: 'shop' }, { tag: 'thời trang' }, { tag: 'ecommerce' }],
        sortOrder: 2, isPremium: false, isFeatured: true,
    },

    // ─── 3. BEAUTY / SPA / THẨM MỸ ─────────────────────────────────────
    {
        name: 'Beauty / Spa / Thẩm mỹ',
        description: 'Template cho spa, salon, thẩm mỹ viện với bảng giá dịch vụ và đặt lịch.',
        category: ['beauty'],
        defaultTheme: { primaryColor: '#D946EF', secondaryColor: '#A855F7', fontHeading: 'Cormorant Garamond', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('Beauty Spa', ['Trang Chủ', 'Dịch Vụ', 'Bảng Giá', 'Đặt Lịch'], 'Đặt Lịch'),
            hero('Tỏa Sáng Vẻ Đẹp Tự Nhiên', 'Trải nghiệm dịch vụ chăm sóc sắc đẹp cao cấp, giúp bạn tự tin và rạng rỡ mỗi ngày.', 'Đặt Lịch Ngay', 'Xem Dịch Vụ', 'split'),
            pricing('Bảng Giá Dịch Vụ', 'Lựa chọn gói phù hợp với bạn', [
                { name: 'Cơ Bản', price: '299K', desc: 'Chăm sóc da mặt cơ bản', features: ['Rửa mặt sâu', 'Đắp mặt nạ', 'Massage mặt 15 phút'] },
                { name: 'Cao Cấp', price: '599K', desc: 'Trọn gói chăm sóc', features: ['Rửa mặt sâu', 'Peel da', 'Đắp collagen', 'Massage 30 phút', 'Chăm sóc tay'] },
                { name: 'VIP', price: '999K', desc: 'Trải nghiệm hoàn hảo', features: ['Full combo cao cấp', 'Trị nám laser', 'Massage body 60 phút', 'Tặng sản phẩm'] },
            ]),
            gallery('Không Gian & Kết Quả', 6),
            testimonials('Khách Hàng Hài Lòng', [
                { name: 'Trần Thị Lan', quote: 'Da mình cải thiện rõ rệt sau 3 liệu trình. Nhân viên tận tâm!', title: 'Khách hàng VIP' },
                { name: 'Nguyễn Kim Chi', quote: 'Không gian thư giãn, dịch vụ chuyên nghiệp. 10/10!', title: 'Beauty Blogger' },
            ]),
            cta('✨ Ưu Đãi Lần Đầu — Giảm 30%', 'Dành cho khách hàng mới. Đặt lịch ngay hôm nay!', 'Đặt Lịch Ngay'),
            contact('Đặt Lịch & Tư Vấn', 'hello@beautyspa.vn', '028 9876 5432', '789 Hai Bà Trưng, Q.3, TP.HCM'),
            footer('Beauty Spa', 'Nơi tôn vinh vẻ đẹp tự nhiên của bạn.', [
                { title: 'Dịch Vụ', links: ['Chăm sóc da', 'Spa body', 'Nail', 'Tóc'] },
                { title: 'Giờ Làm Việc', links: ['T2-T7: 09:00 - 20:00', 'CN: 10:00 - 18:00'] },
            ]),
        ],
        tags: [{ tag: 'spa' }, { tag: 'beauty' }, { tag: 'thẩm mỹ' }],
        sortOrder: 3, isPremium: false, isFeatured: true,
    },

    // ─── 4. CÔNG NGHỆ / IT / SAAS ──────────────────────────────────────
    {
        name: 'Công nghệ / IT / SaaS',
        description: 'Template cho công ty tech, startup SaaS với features, pricing plans và FAQ.',
        category: ['tech'],
        defaultTheme: { primaryColor: '#3B82F6', secondaryColor: '#6366F1', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('TechCo', ['Trang Chủ', 'Tính Năng', 'Bảng Giá', 'Liên Hệ'], 'Dùng Thử'),
            hero('Giải Pháp Công Nghệ Thông Minh', 'Tối ưu hóa quy trình kinh doanh với nền tảng AI và tự động hóa hàng đầu.', 'Dùng Thử Miễn Phí', 'Xem Demo', 'centered'),
            features('Tính Năng Nổi Bật', 'Công nghệ tiên tiến cho doanh nghiệp hiện đại', [
                { icon: '🤖', title: 'AI Thông Minh', desc: 'Trí tuệ nhân tạo phân tích dữ liệu và đưa ra quyết định tối ưu.' },
                { icon: '⚡', title: 'Tự Động Hóa', desc: 'Tự động hóa quy trình, tiết kiệm 80% thời gian vận hành.' },
                { icon: '🔒', title: 'Bảo Mật Cao', desc: 'Mã hóa end-to-end, tuân thủ tiêu chuẩn quốc tế.' },
                { icon: '📊', title: 'Phân Tích Realtime', desc: 'Dashboard trực quan, báo cáo realtime mọi lúc.' },
            ], 'Tính Năng'),
            stats('Con Số Ấn Tượng', [
                { value: '500+', label: 'Doanh Nghiệp' }, { value: '99.9%', label: 'Uptime' },
                { value: '10M+', label: 'Giao Dịch/Ngày' }, { value: '24/7', label: 'Hỗ trợ' },
            ]),
            pricing('Bảng Giá', 'Linh hoạt cho mọi quy mô', [
                { name: 'Starter', price: '$9/tháng', desc: 'Dành cho cá nhân', features: ['1,000 requests/ngày', '5GB storage', 'Email support'] },
                { name: 'Pro', price: '$29/tháng', desc: 'Dành cho team', features: ['50,000 requests/ngày', '100GB storage', 'Priority support', 'API access'] },
                { name: 'Enterprise', price: 'Liên hệ', desc: 'Doanh nghiệp lớn', features: ['Unlimited requests', '1TB storage', 'Dedicated support', 'Custom integration', 'SLA 99.99%'] },
            ]),
            testimonials('Khách Hàng Tin Tưởng', [
                { name: 'CEO Công ty ABC', quote: 'Giải pháp tuyệt vời, giúp chúng tôi tăng hiệu suất 200%.', title: 'CEO' },
                { name: 'CTO Startup XYZ', quote: 'API dễ tích hợp, support phản hồi nhanh. Rất recommend!', title: 'CTO' },
            ]),
            faq('Câu Hỏi Thường Gặp', [
                { q: 'Có thể dùng thử miễn phí không?', a: 'Có! Gói Starter miễn phí 14 ngày, không cần thẻ tín dụng.' },
                { q: 'Dữ liệu có an toàn không?', a: 'Chúng tôi mã hóa AES-256 và tuân thủ GDPR, ISO 27001.' },
                { q: 'Hỗ trợ tích hợp với hệ thống hiện có?', a: 'Có API RESTful và webhook. Đội ngũ hỗ trợ tích hợp 24/7.' },
            ]),
            contact('Liên Hệ', 'hello@techco.vn', '028 1111 2222', 'Tầng 10, Bitexco Tower, Q.1, TP.HCM'),
            footer('TechCo', 'Giải pháp công nghệ cho doanh nghiệp hiện đại.', [
                { title: 'Sản Phẩm', links: ['Tính năng', 'Bảng giá', 'API Docs'] },
                { title: 'Công Ty', links: ['Về chúng tôi', 'Blog', 'Tuyển dụng'] },
            ]),
        ],
        tags: [{ tag: 'tech' }, { tag: 'saas' }, { tag: 'startup' }],
        sortOrder: 4, isPremium: false, isFeatured: true,
    },

    // ─── 5. Y TẾ / NHA KHOA / CLINIC ───────────────────────────────────
    {
        name: 'Y tế / Nha khoa / Clinic',
        description: 'Template cho phòng khám, nha khoa, bệnh viện với đội ngũ bác sĩ và dịch vụ khám.',
        category: ['health'],
        defaultTheme: { primaryColor: '#059669', secondaryColor: '#10B981', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('Phòng Khám', ['Trang Chủ', 'Dịch Vụ', 'Bác Sĩ', 'Liên Hệ'], 'Đặt Lịch Khám'),
            hero('Sức Khỏe Là Ưu Tiên Hàng Đầu', 'Đội ngũ y bác sĩ giàu kinh nghiệm, trang thiết bị hiện đại, phục vụ tận tâm.', 'Đặt Lịch Khám', 'Tư Vấn Miễn Phí', 'split'),
            features('Dịch Vụ Y Tế', 'Chăm sóc sức khỏe toàn diện', [
                { icon: '🦷', title: 'Nha Khoa Tổng Quát', desc: 'Khám, điều trị và chăm sóc răng miệng toàn diện.' },
                { icon: '💉', title: 'Tiêm Chủng', desc: 'Chương trình tiêm chủng đầy đủ cho mọi lứa tuổi.' },
                { icon: '🩺', title: 'Khám Tổng Quát', desc: 'Tầm soát sức khỏe định kỳ với gói khám toàn diện.' },
                { icon: '👁️', title: 'Mắt & Tai Mũi Họng', desc: 'Khám và điều trị chuyên khoa mắt, tai mũi họng.' },
            ], 'Chuyên Khoa'),
            team('Đội Ngũ Bác Sĩ', [
                { name: 'BS. Nguyễn Văn An', role: 'Giám đốc chuyên môn — 20 năm kinh nghiệm' },
                { name: 'BS. Trần Thị Bình', role: 'Chuyên khoa Nha — 15 năm kinh nghiệm' },
                { name: 'BS. Lê Minh Cường', role: 'Chuyên khoa Mắt — 12 năm kinh nghiệm' },
            ]),
            stats('Thành Tựu', [
                { value: '20+', label: 'Năm Kinh Nghiệm' }, { value: '50,000+', label: 'Bệnh Nhân' },
                { value: '15', label: 'Bác Sĩ Chuyên Khoa' }, { value: '98%', label: 'Hài Lòng' },
            ]),
            testimonials('Bệnh Nhân Chia Sẻ', [
                { name: 'Anh Minh Đức', quote: 'Bác sĩ tận tâm, giải thích kỹ. Phòng khám sạch sẽ, hiện đại.', title: 'Bệnh nhân' },
                { name: 'Chị Thu Hà', quote: 'Con tôi rất sợ nha sĩ nhưng ở đây bé rất hợp tác. Cảm ơn!', title: 'Phụ huynh' },
            ]),
            contact('Đặt Lịch Khám', 'info@phongkham.vn', '028 3333 4444', '321 CMT8, Q.10, TP.HCM'),
            footer('Phòng Khám', 'Sức khỏe là tài sản quý giá nhất.', [
                { title: 'Dịch Vụ', links: ['Nha khoa', 'Tổng quát', 'Tiêm chủng'] },
                { title: 'Giờ Khám', links: ['T2-T6: 07:30 - 17:00', 'T7: 07:30 - 12:00'] },
            ]),
        ],
        tags: [{ tag: 'y tế' }, { tag: 'nha khoa' }, { tag: 'clinic' }],
        sortOrder: 5, isPremium: false, isFeatured: false,
    },

    // ─── 6. GIÁO DỤC / ĐÀO TẠO ────────────────────────────────────────
    {
        name: 'Giáo dục / Đào tạo',
        description: 'Template cho trung tâm đào tạo, trường học với khóa học và đăng ký.',
        category: ['education'],
        defaultTheme: { primaryColor: '#7C3AED', secondaryColor: '#8B5CF6', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('Trung Tâm Đào Tạo', ['Trang Chủ', 'Khóa Học', 'Giảng Viên', 'Liên Hệ'], 'Đăng Ký'),
            hero('Học Hôm Nay, Thành Công Ngày Mai', 'Khóa học thực chiến từ chuyên gia hàng đầu. Cam kết đầu ra và hỗ trợ việc làm.', 'Xem Khóa Học', 'Tư Vấn Miễn Phí', 'split'),
            features('Khóa Học Nổi Bật', 'Chương trình đào tạo chất lượng cao', [
                { icon: '💻', title: 'Lập Trình Web', desc: 'Fullstack JavaScript từ zero đến hero trong 6 tháng.' },
                { icon: '📱', title: 'Mobile App', desc: 'React Native / Flutter — làm app thực tế.' },
                { icon: '📊', title: 'Data Science', desc: 'Python, Machine Learning, phân tích dữ liệu.' },
                { icon: '🎨', title: 'UI/UX Design', desc: 'Figma, Design System, User Research.' },
            ], 'Khóa Học'),
            stats('Con Số Ấn Tượng', [
                { value: '5,000+', label: 'Học Viên' }, { value: '95%', label: 'Có Việc Làm' },
                { value: '20+', label: 'Giảng Viên' }, { value: '50+', label: 'Khóa Học' },
            ]),
            testimonials('Học Viên Chia Sẻ', [
                { name: 'Nguyễn Văn Nam', quote: 'Sau khóa học, mình đã nhận offer tại công ty IT lớn. Cảm ơn thầy cô!', title: 'Học viên K12' },
                { name: 'Trần Thị Hoa', quote: 'Chương trình thực tế, giảng viên nhiệt tình. Recommend mọi người!', title: 'Học viên K15' },
            ]),
            faq('Câu Hỏi Tuyển Sinh', [
                { q: 'Có cần kiến thức nền tảng không?', a: 'Không cần! Chương trình dạy từ cơ bản. Chỉ cần laptop và tinh thần ham học.' },
                { q: 'Hình thức học thế nào?', a: 'Học trực tiếp tại trung tâm hoặc online qua Zoom. Có recording để xem lại.' },
                { q: 'Có hỗ trợ việc làm không?', a: 'Có! Cam kết kết nối với 100+ đối tác tuyển dụng sau khi tốt nghiệp.' },
            ]),
            cta('🎓 Khai Giảng Khóa Mới', 'Đăng ký sớm — Giảm 20% học phí. Số lượng có hạn!', 'Đăng Ký Ngay'),
            contact('Tư Vấn Tuyển Sinh', 'info@daotao.vn', '028 5555 6666', '100 Nguyễn Thị Minh Khai, Q.3, TP.HCM'),
            footer('Trung Tâm Đào Tạo', 'Nơi ươm mầm tài năng công nghệ.', [
                { title: 'Khóa Học', links: ['Lập trình', 'Data Science', 'Design'] },
                { title: 'Hỗ Trợ', links: ['Tuyển sinh', 'Học bổng', 'Việc làm'] },
            ]),
        ],
        tags: [{ tag: 'giáo dục' }, { tag: 'đào tạo' }, { tag: 'khóa học' }],
        sortOrder: 6, isPremium: false, isFeatured: false,
    },

    // ─── 7. BẤT ĐỘNG SẢN ───────────────────────────────────────────────
    {
        name: 'Bất động sản',
        description: 'Template cho công ty BĐS, môi giới với dự án nổi bật và tư vấn.',
        category: ['realestate'],
        defaultTheme: { primaryColor: '#0891B2', secondaryColor: '#06B6D4', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('BĐS Mẫu', ['Trang Chủ', 'Dự Án', 'Về Chúng Tôi', 'Liên Hệ'], 'Tư Vấn'),
            hero('Tìm Ngôi Nhà Mơ Ước Của Bạn', 'Hàng trăm dự án căn hộ, biệt thự, đất nền tại các vị trí đắc địa.', 'Xem Dự Án', 'Tư Vấn Miễn Phí'),
            features('Dự Án Nổi Bật', 'Các dự án được yêu thích nhất', [
                { icon: '🏢', title: 'Căn Hộ Sky Garden', desc: 'Căn hộ cao cấp view sông, tiện ích 5 sao, giá từ 3 tỷ.' },
                { icon: '🏡', title: 'Biệt Thự Green Valley', desc: 'Biệt thự vườn sinh thái, không gian sống xanh.' },
                { icon: '🏗️', title: 'KĐT Sunrise City', desc: 'Khu đô thị hiện đại, hạ tầng đồng bộ, vị trí trung tâm.' },
            ], 'Dự Án'),
            stats('Thành Tựu', [
                { value: '200+', label: 'Dự Án' }, { value: '10,000+', label: 'Khách Hàng' },
                { value: '15', label: 'Năm Kinh Nghiệm' }, { value: '50+', label: 'Giải Thưởng' },
            ]),
            about('Về Công Ty', 'Với hơn 15 năm kinh nghiệm trong lĩnh vực bất động sản, chúng tôi tự hào là đối tác tin cậy giúp hàng ngàn gia đình tìm được ngôi nhà mơ ước.', 'Về Chúng Tôi'),
            testimonials('Khách Hàng Chia Sẻ', [
                { name: 'Anh Quốc Bảo', quote: 'Tư vấn viên rất chuyên nghiệp, hỗ trợ mình từ A-Z. Rất hài lòng!', title: 'Chủ căn hộ' },
                { name: 'Chị Thanh Thảo', quote: 'Dự án đúng tiến độ, pháp lý rõ ràng. Recommend cho bạn bè.', title: 'Nhà đầu tư' },
            ]),
            contact('Tư Vấn Dự Án', 'info@bds.vn', '028 7777 8888', '50 Nguyễn Huệ, Q.1, TP.HCM'),
            footer('BĐS Mẫu', 'Đồng hành cùng bạn tìm ngôi nhà mơ ước.', [
                { title: 'Dự Án', links: ['Căn hộ', 'Biệt thự', 'Đất nền'] },
                { title: 'Hỗ Trợ', links: ['Tư vấn', 'Pháp lý', 'Vay ngân hàng'] },
            ]),
        ],
        tags: [{ tag: 'bất động sản' }, { tag: 'nhà đất' }, { tag: 'dự án' }],
        sortOrder: 7, isPremium: false, isFeatured: false,
    },

    // ─── 8. GYM / FITNESS / YOGA ────────────────────────────────────────
    {
        name: 'Gym / Fitness / Yoga',
        description: 'Template cho phòng gym, yoga studio, PT với gói tập và lịch dạy.',
        category: ['fitness'],
        defaultTheme: { primaryColor: '#DC2626', secondaryColor: '#EF4444', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('FitZone', ['Trang Chủ', 'Gói Tập', 'Tiện Ích', 'Liên Hệ'], 'Đăng Ký Tập'),
            hero('Khỏe Mạnh Hơn Mỗi Ngày', 'Phòng tập hiện đại, HLV chuyên nghiệp. Bắt đầu hành trình thay đổi cuộc sống.', 'Đăng Ký Trial', 'Xem Gói Tập', 'split'),
            pricing('Gói Tập Luyện', 'Lựa chọn gói phù hợp mục tiêu của bạn', [
                { name: 'Basic', price: '500K/tháng', desc: 'Tập gym tự do', features: ['Phòng tập chính', 'Tủ locker', 'Nước uống'] },
                { name: 'Premium', price: '900K/tháng', desc: 'Gym + Group class', features: ['Tất cả Basic', 'Yoga, Zumba, Boxing', 'Xông hơi, sauna', 'PT 2 buổi/tháng'] },
                { name: 'VIP', price: '1.5M/tháng', desc: 'All-inclusive', features: ['Tất cả Premium', 'PT 8 buổi/tháng', 'Meal plan', 'Body scan', 'Towel service'] },
            ]),
            features('Tiện Ích', 'Trang thiết bị đẳng cấp', [
                { icon: '🏋️', title: 'Khu Gym 500m²', desc: 'Máy tập hiện đại từ Technogym, Life Fitness.' },
                { icon: '🧘', title: 'Studio Yoga', desc: 'Phòng yoga view đẹp, sàn gỗ, âm thanh thư giãn.' },
                { icon: '🏊', title: 'Hồ Bơi', desc: 'Hồ bơi 25m nước ấm, chuẩn Olympic.' },
                { icon: '🧖', title: 'Spa & Sauna', desc: 'Khu xông hơi, massage thư giãn sau tập.' },
            ], 'Tiện Ích'),
            gallery('Không Gian Tập Luyện', 6),
            testimonials('Học Viên Chia Sẻ', [
                { name: 'Minh Tuấn', quote: 'Giảm 15kg sau 6 tháng tập ở đây. HLV rất tận tâm!', title: 'Học viên' },
                { name: 'Thu Trang', quote: 'Phòng tập sạch, máy mới, không khí tuyệt vời. Yêu lắm!', title: 'Học viên VIP' },
            ]),
            cta('💪 Tập Thử Miễn Phí 3 Ngày', 'Đăng ký ngay để trải nghiệm phòng tập đẳng cấp!', 'Đăng Ký Trial'),
            contact('Đăng Ký & Tư Vấn', 'hello@fitzone.vn', '028 9999 0000', '200 Điện Biên Phủ, Q. Bình Thạnh'),
            footer('FitZone', 'Khỏe mạnh hơn mỗi ngày.', [
                { title: 'Dịch Vụ', links: ['Gym', 'Yoga', 'Boxing', 'PT'] },
                { title: 'Giờ Mở Cửa', links: ['T2-T6: 05:30 - 22:00', 'T7-CN: 06:00 - 21:00'] },
            ]),
        ],
        tags: [{ tag: 'gym' }, { tag: 'fitness' }, { tag: 'yoga' }],
        sortOrder: 8, isPremium: false, isFeatured: true,
    },

    // ─── 9. PORTFOLIO / FREELANCER / AGENCY ─────────────────────────────
    {
        name: 'Portfolio / Freelancer / Agency',
        description: 'Template cho designer, developer, agency với portfolio gallery và case studies.',
        category: ['creative'],
        defaultTheme: { primaryColor: '#F59E0B', secondaryColor: '#D97706', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('Creative Studio', ['Trang Chủ', 'Portfolio', 'Dịch Vụ', 'Liên Hệ'], 'Hire Me'),
            hero('Thiết Kế Sáng Tạo, Giải Pháp Hiệu Quả', 'Tôi giúp doanh nghiệp xây dựng thương hiệu mạnh qua thiết kế và digital marketing.', 'Xem Portfolio', 'Liên Hệ Ngay', 'minimal'),
            gallery('Portfolio', 8),
            features('Dịch Vụ', 'Những gì tôi có thể giúp bạn', [
                { icon: '🎨', title: 'Brand Identity', desc: 'Logo, bộ nhận diện thương hiệu chuyên nghiệp.' },
                { icon: '🌐', title: 'Web Design', desc: 'Website responsive, UX tối ưu, SEO-ready.' },
                { icon: '📱', title: 'App Design', desc: 'Giao diện mobile app iOS & Android.' },
                { icon: '📢', title: 'Digital Marketing', desc: 'Social media, Google Ads, content strategy.' },
            ], 'Dịch Vụ'),
            stats('Thành Tựu', [
                { value: '150+', label: 'Dự Án' }, { value: '80+', label: 'Khách Hàng' },
                { value: '8', label: 'Năm Kinh Nghiệm' }, { value: '15', label: 'Giải Thưởng' },
            ]),
            testimonials('Khách Hàng Nói Gì', [
                { name: 'CEO TechStartup', quote: 'Thiết kế đẹp, giao đúng deadline. Highly recommend!', title: 'CEO' },
                { name: 'Founder Brand X', quote: 'Bộ nhận diện thương hiệu tuyệt vời, vượt kỳ vọng.', title: 'Founder' },
            ]),
            cta('🚀 Bắt Đầu Dự Án Mới?', 'Hãy kể cho tôi về ý tưởng của bạn. Tư vấn miễn phí!', 'Liên Hệ Ngay'),
            contact('Liên Hệ Hợp Tác', 'hello@creative.vn', '0909 123 456', 'TP.HCM, Việt Nam'),
            footer('Creative Studio', 'Thiết kế sáng tạo, giải pháp hiệu quả.', [
                { title: 'Dịch Vụ', links: ['Branding', 'Web', 'App', 'Marketing'] },
                { title: 'Social', links: ['Behance', 'Dribbble', 'Instagram'] },
            ]),
        ],
        tags: [{ tag: 'portfolio' }, { tag: 'freelancer' }, { tag: 'agency' }],
        sortOrder: 9, isPremium: false, isFeatured: true,
    },

    // ─── 10. BUSINESS / DOANH NGHIỆP CHUNG ─────────────────────────────
    {
        name: 'Business / Doanh nghiệp chung',
        description: 'Template đa năng cho mọi loại hình doanh nghiệp.',
        category: ['business'],
        defaultTheme: { primaryColor: '#2563EB', secondaryColor: '#3B82F6', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('Doanh Nghiệp', ['Trang Chủ', 'Dịch Vụ', 'Về Chúng Tôi', 'Liên Hệ'], 'Liên Hệ'),
            hero('Giải Pháp Chuyên Nghiệp Cho Doanh Nghiệp', 'Đối tác tin cậy giúp doanh nghiệp bạn phát triển bền vững và hiệu quả.', 'Tìm Hiểu Thêm', 'Liên Hệ Ngay'),
            features('Dịch Vụ Của Chúng Tôi', 'Giải pháp toàn diện cho doanh nghiệp', [
                { icon: '📋', title: 'Tư Vấn Chiến Lược', desc: 'Xây dựng chiến lược phát triển phù hợp với mục tiêu.' },
                { icon: '⚙️', title: 'Triển Khai Giải Pháp', desc: 'Đội ngũ chuyên gia triển khai nhanh, hiệu quả.' },
                { icon: '📊', title: 'Đo Lường & Tối Ưu', desc: 'Theo dõi KPI, liên tục cải thiện hiệu suất.' },
            ], 'Dịch Vụ'),
            about('Về Chúng Tôi', 'Chúng tôi là đội ngũ chuyên gia với nhiều năm kinh nghiệm, cam kết mang đến giải pháp tốt nhất cho doanh nghiệp của bạn.', 'Về Chúng Tôi'),
            stats('Thành Tựu', [
                { value: '100+', label: 'Khách Hàng' }, { value: '10+', label: 'Năm Kinh Nghiệm' },
                { value: '500+', label: 'Dự Án' }, { value: '99%', label: 'Hài Lòng' },
            ]),
            testimonials('Đối Tác Chia Sẻ', [
                { name: 'Giám Đốc Công Ty A', quote: 'Dịch vụ chuyên nghiệp, kết quả vượt mong đợi.', title: 'CEO' },
                { name: 'Trưởng Phòng Công Ty B', quote: 'Đội ngũ tận tâm, luôn hỗ trợ kịp thời.', title: 'Manager' },
            ]),
            cta('Sẵn Sàng Phát Triển?', 'Liên hệ ngay để được tư vấn giải pháp phù hợp nhất.', 'Liên Hệ Ngay'),
            contact('Liên Hệ', 'info@doanhnghiep.vn', '028 1234 5678', 'TP.HCM, Việt Nam'),
            footer('Doanh Nghiệp', 'Đồng hành cùng sự phát triển của bạn.', [
                { title: 'Dịch Vụ', links: ['Tư vấn', 'Triển khai', 'Hỗ trợ'] },
                { title: 'Liên Kết', links: ['Blog', 'Tuyển dụng', 'Đối tác'] },
            ]),
        ],
        tags: [{ tag: 'business' }, { tag: 'doanh nghiệp' }, { tag: 'công ty' }],
        sortOrder: 10, isPremium: false, isFeatured: false,
    },
]
