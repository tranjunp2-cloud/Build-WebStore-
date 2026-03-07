/**
 * Rule-based AI Block Generator (Phase 1)
 * Parses user prompt → generates blocks JSON matching Pages collection schema.
 * Phase 2 will replace this with real LLM calls.
 */

// ─── Types ──────────────────────────────────────────────────────────────

type BusinessIntent = {
    name: string
    type: 'business' | 'ecommerce' | 'restaurant' | 'portfolio' | 'blog'
    description: string
    style: 'modern' | 'classic' | 'minimal' | 'bold'
}

type GeneratedBlock = {
    blockType: string
    [key: string]: unknown
}

type GenerationResult = {
    siteName: string
    siteType: BusinessIntent['type']
    blocks: GeneratedBlock[]
    seo: { title: string; description: string }
    theme: {
        primaryColor: string
        secondaryColor: string
        fontHeading: string
        fontBody: string
        colorMode: 'light' | 'dark'
    }
}

// ─── Intent Parser ──────────────────────────────────────────────────────

const TYPE_KEYWORDS: Record<BusinessIntent['type'], string[]> = {
    restaurant: ['restaurant', 'quán', 'cafe', 'coffee', 'bakery', 'bánh', 'food', 'ăn', 'nhà hàng', 'trà sữa', 'boba', 'pizza', 'sushi', 'bar'],
    ecommerce: ['shop', 'store', 'cửa hàng', 'bán', 'thời trang', 'fashion', 'mỹ phẩm', 'beauty', 'cosmetic', 'giày', 'túi', 'đồ', 'sản phẩm', 'ecommerce'],
    portfolio: ['portfolio', 'freelance', 'photographer', 'designer', 'artist', 'nhiếp ảnh', 'thiết kế', 'personal', 'cv', 'resume'],
    blog: ['blog', 'tin tức', 'news', 'magazine', 'bài viết', 'content'],
    business: ['company', 'công ty', 'agency', 'dịch vụ', 'service', 'startup', 'tech', 'consulting', 'marketing', 'spa', 'gym', 'fitness', 'clinic', 'dental', 'bất động sản', 'real estate'],
}

const THEME_PALETTES: Record<BusinessIntent['type'], GenerationResult['theme']> = {
    restaurant: { primaryColor: '#D97706', secondaryColor: '#92400E', fontHeading: 'Playfair Display', fontBody: 'Inter', colorMode: 'light' },
    ecommerce: { primaryColor: '#0EA5E9', secondaryColor: '#6366F1', fontHeading: 'DM Sans', fontBody: 'Inter', colorMode: 'light' },
    portfolio: { primaryColor: '#F43F5E', secondaryColor: '#8B5CF6', fontHeading: 'Outfit', fontBody: 'DM Sans', colorMode: 'dark' },
    blog: { primaryColor: '#10B981', secondaryColor: '#3B82F6', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'light' },
    business: { primaryColor: '#3B82F6', secondaryColor: '#8B5CF6', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'light' },
}

function parseIntent(prompt: string): BusinessIntent {
    const lower = prompt.toLowerCase()

    // Extract business name (look for quoted text, "tên", "called", or capitalize words)
    let name = 'My Website'
    const namePatterns = [
        /(?:tên|gọi là|called|named)\s+["']?([^"'\n,]+)/i,
        /["']([^"']+)["']/,
        /^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/,
    ]
    for (const pattern of namePatterns) {
        const match = prompt.match(pattern)
        if (match?.[1]) {
            name = match[1].trim()
            break
        }
    }

    // Detect business type
    let type: BusinessIntent['type'] = 'business'
    let maxScore = 0
    for (const [bizType, keywords] of Object.entries(TYPE_KEYWORDS)) {
        const score = keywords.filter(kw => lower.includes(kw)).length
        if (score > maxScore) {
            maxScore = score
            type = bizType as BusinessIntent['type']
        }
    }

    // Detect style
    let style: BusinessIntent['style'] = 'modern'
    if (lower.includes('minimal') || lower.includes('tối giản')) style = 'minimal'
    else if (lower.includes('cổ điển') || lower.includes('classic') || lower.includes('elegant')) style = 'classic'
    else if (lower.includes('bold') || lower.includes('nổi bật') || lower.includes('mạnh mẽ')) style = 'bold'

    return { name, type, description: prompt, style }
}

// ─── Content Templates ──────────────────────────────────────────────────

const CONTENT: Record<BusinessIntent['type'], {
    heroHeadline: string
    heroSub: string
    aboutHeadline: string
    aboutBody: string
    features: Array<{ icon: string; title: string; description: string }>
    testimonials: Array<{ quote: string; name: string; title: string; rating: number }>
    contactSubtext: string
}> = {
    restaurant: {
        heroHeadline: 'Hương Vị Đích Thực, Trải Nghiệm Khó Quên',
        heroSub: 'Thưởng thức những món ăn được chế biến từ nguyên liệu tươi ngon nhất, trong không gian ấm cúng và đẳng cấp.',
        aboutHeadline: 'Câu Chuyện Của Chúng Tôi',
        aboutBody: 'Với niềm đam mê ẩm thực và hơn 10 năm kinh nghiệm, chúng tôi mang đến cho bạn những trải nghiệm ẩm thực đáng nhớ. Mỗi món ăn đều được chế biến tỉ mỉ với nguyên liệu tuyển chọn.',
        features: [
            { icon: '🍳', title: 'Đầu Bếp Chuyên Nghiệp', description: 'Đội ngũ đầu bếp với hơn 10 năm kinh nghiệm tại các nhà hàng 5 sao.' },
            { icon: '🥬', title: 'Nguyên Liệu Tươi Sạch', description: 'Nguồn nguyên liệu được tuyển chọn kỹ lưỡng từ những nhà cung cấp uy tín.' },
            { icon: '🎵', title: 'Không Gian Sang Trọng', description: 'Thiết kế hiện đại, âm nhạc nhẹ nhàng, không gian lý tưởng cho mọi dịp.' },
        ],
        testimonials: [
            { quote: 'Đồ ăn ngon tuyệt vời! Không gian rất đẹp và nhân viên phục vụ rất chu đáo.', name: 'Minh Anh', title: 'Food Blogger', rating: 5 },
            { quote: 'Lần nào đến cũng rất hài lòng. Chất lượng ổn định, giá cả hợp lý.', name: 'Thanh Hùng', title: 'Doanh nhân', rating: 5 },
        ],
        contactSubtext: 'Đặt bàn ngay hoặc liên hệ với chúng tôi để tổ chức sự kiện đặc biệt.',
    },
    ecommerce: {
        heroHeadline: 'Sản Phẩm Chất Lượng, Giá Tốt Nhất',
        heroSub: 'Khám phá bộ sưu tập đa dạng với hàng ngàn sản phẩm chính hãng. Giao hàng nhanh, đổi trả dễ dàng.',
        aboutHeadline: 'Về Chúng Tôi',
        aboutBody: 'Chúng tôi cam kết mang đến cho khách hàng trải nghiệm mua sắm tuyệt vời nhất. Với phương châm "Chất lượng là hàng đầu", mỗi sản phẩm đều được kiểm tra kỹ lưỡng trước khi đến tay bạn.',
        features: [
            { icon: '🚚', title: 'Giao Hàng Nhanh', description: 'Miễn phí giao hàng cho đơn từ 500K. Nhận hàng trong 1-3 ngày.' },
            { icon: '🔄', title: 'Đổi Trả Dễ Dàng', description: 'Đổi trả miễn phí trong 30 ngày nếu sản phẩm không vừa ý.' },
            { icon: '💎', title: '100% Chính Hãng', description: 'Cam kết sản phẩm chính hãng, xuất xứ rõ ràng.' },
        ],
        testimonials: [
            { quote: 'Mua hàng ở đây rất yên tâm. Sản phẩm giống y hình, giao hàng nhanh.', name: 'Thu Trang', title: 'Khách hàng VIP', rating: 5 },
            { quote: 'Dịch vụ CSKH rất tốt, tư vấn nhiệt tình. Sẽ quay lại mua tiếp!', name: 'Đức Anh', title: 'Khách hàng', rating: 5 },
        ],
        contactSubtext: 'Cần hỗ trợ? Liên hệ ngay với đội ngũ tư vấn của chúng tôi.',
    },
    portfolio: {
        heroHeadline: 'Creative Work That Inspires',
        heroSub: 'I create meaningful digital experiences through thoughtful design and clean code.',
        aboutHeadline: 'About Me',
        aboutBody: 'I am a passionate creative professional with years of experience in crafting beautiful, functional digital products. I believe in the power of design to transform ideas into impactful experiences.',
        features: [
            { icon: '🎨', title: 'UI/UX Design', description: 'Creating intuitive user interfaces with a focus on user experience and visual appeal.' },
            { icon: '💻', title: 'Web Development', description: 'Building responsive, performant websites using modern frameworks and best practices.' },
            { icon: '📱', title: 'Mobile Apps', description: 'Designing and developing cross-platform mobile applications.' },
        ],
        testimonials: [
            { quote: 'Absolutely outstanding work. Delivered beyond expectations and was great to collaborate with.', name: 'Sarah Chen', title: 'CEO, TechStart', rating: 5 },
            { quote: 'Professional, creative, and incredibly talented. Highly recommended!', name: 'James Wilson', title: 'Marketing Director', rating: 5 },
        ],
        contactSubtext: 'Got a project in mind? Let\'s chat and bring your vision to life.',
    },
    blog: {
        heroHeadline: 'Khám Phá Tri Thức Mỗi Ngày',
        heroSub: 'Nơi chia sẻ những câu chuyện, kiến thức và cảm hứng cho cuộc sống tốt đẹp hơn.',
        aboutHeadline: 'Về Blog',
        aboutBody: 'Chào mừng bạn đến với blog của chúng tôi — nơi tổng hợp những bài viết chất lượng về công nghệ, lifestyle và phát triển bản thân.',
        features: [
            { icon: '📝', title: 'Bài Viết Chất Lượng', description: 'Nội dung được nghiên cứu kỹ lưỡng, cập nhật xu hướng mới nhất.' },
            { icon: '🎯', title: 'Đa Dạng Chủ Đề', description: 'Từ công nghệ, marketing đến phát triển bản thân.' },
            { icon: '💡', title: 'Kiến Thức Thực Tiễn', description: 'Chia sẻ kinh nghiệm thực tế, áp dụng ngay vào công việc.' },
        ],
        testimonials: [
            { quote: 'Bài viết rất hay và bổ ích. Đọc xong là áp dụng được ngay!', name: 'Hoàng Nam', title: 'Developer', rating: 5 },
            { quote: 'Một trong những blog hay nhất mà tôi theo dõi.', name: 'Lan Chi', title: 'Content Creator', rating: 5 },
        ],
        contactSubtext: 'Muốn hợp tác hoặc đóng góp bài viết? Liên hệ ngay!',
    },
    business: {
        heroHeadline: 'Giải Pháp Chuyên Nghiệp Cho Doanh Nghiệp',
        heroSub: 'Chúng tôi giúp doanh nghiệp của bạn phát triển vượt bậc với các giải pháp sáng tạo và hiệu quả.',
        aboutHeadline: 'Tại Sao Chọn Chúng Tôi',
        aboutBody: 'Với đội ngũ chuyên gia giàu kinh nghiệm, chúng tôi cam kết mang đến những giải pháp tốt nhất, giúp doanh nghiệp bạn tiết kiệm chi phí và tăng trưởng bền vững.',
        features: [
            { icon: '🚀', title: 'Tăng Trưởng Nhanh', description: 'Chiến lược phát triển hiệu quả, kết quả đo lường được sau 30 ngày.' },
            { icon: '🛡️', title: 'An Toàn & Tin Cậy', description: 'Bảo mật dữ liệu tuyệt đối, tuân thủ tiêu chuẩn quốc tế.' },
            { icon: '🤝', title: 'Hỗ Trợ 24/7', description: 'Đội ngũ support luôn sẵn sàng hỗ trợ bạn mọi lúc, mọi nơi.' },
        ],
        testimonials: [
            { quote: 'Doanh thu tăng 40% sau 3 tháng sử dụng dịch vụ. Rất chuyên nghiệp!', name: 'Việt Hoàng', title: 'CEO, TechVN', rating: 5 },
            { quote: 'Đội ngũ tư vấn rất am hiểu, giải pháp phù hợp với nhu cầu thực tế.', name: 'Mai Linh', title: 'Giám đốc Marketing', rating: 5 },
        ],
        contactSubtext: 'Hãy liên hệ để nhận tư vấn miễn phí và báo giá chi tiết.',
    },
}

// ─── Block Generator ────────────────────────────────────────────────────

export function generateBlocks(prompt: string): GenerationResult {
    const intent = parseIntent(prompt)
    const content = CONTENT[intent.type]
    const theme = THEME_PALETTES[intent.type]

    const blocks: GeneratedBlock[] = [
        // 1. Navigation
        {
            blockType: 'navigation',
            style: 'fixed',
            logoText: intent.name,
            links: [
                { label: 'Trang chủ', url: '#' },
                { label: 'Giới thiệu', url: '#about' },
                { label: 'Dịch vụ', url: '#features' },
                { label: 'Liên hệ', url: '#contact' },
            ],
            ctaButton: { show: true, label: 'Liên Hệ Ngay', url: '#contact' },
        },

        // 2. Hero
        {
            blockType: 'hero',
            variant: 'centered',
            headline: content.heroHeadline,
            subheadline: content.heroSub,
            ctaButtons: [
                { label: 'Bắt Đầu Ngay', url: '#contact', style: 'primary' },
                { label: 'Tìm Hiểu Thêm', url: '#about', style: 'outline' },
            ],
            badge: { show: true, text: '✨ ' + intent.name },
        },

        // 3. About
        {
            blockType: 'about',
            layout: 'image-right',
            sectionLabel: 'Giới thiệu',
            headline: content.aboutHeadline,
            body: { root: { children: [{ type: 'paragraph', children: [{ text: content.aboutBody }] }] } },
        },

        // 4. Features
        {
            blockType: 'features',
            sectionLabel: 'Dịch vụ',
            headline: 'Chúng Tôi Cung Cấp',
            subheadline: 'Những giá trị cốt lõi mà chúng tôi mang đến',
            layout: 'grid-3',
            features: content.features,
        },

        // 5. Testimonials
        {
            blockType: 'testimonials',
            headline: 'Khách Hàng Nói Gì',
            variant: 'grid',
            testimonials: content.testimonials,
        },

        // 6. Contact
        {
            blockType: 'contact',
            headline: 'Liên Hệ Với Chúng Tôi',
            subtext: content.contactSubtext,
            email: 'hello@' + intent.name.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove diacritics
                .replace(/đ/g, 'd').replace(/Đ/g, 'D')
                .replace(/[^a-z0-9]/g, '') + '.com',
            phone: '(+84) 0123 456 789',
            formFields: [
                { fieldName: 'name', fieldType: 'text', label: 'Họ và tên', required: true },
                { fieldName: 'email', fieldType: 'email', label: 'Email', required: true },
                { fieldName: 'message', fieldType: 'textarea', label: 'Nội dung', required: true },
            ],
        },

        // 7. Footer
        {
            blockType: 'footer',
            logoText: intent.name,
            tagline: content.heroSub.substring(0, 60) + '...',
            columns: [
                {
                    title: 'Liên kết',
                    links: [
                        { label: 'Trang chủ', url: '#' },
                        { label: 'Giới thiệu', url: '#about' },
                        { label: 'Dịch vụ', url: '#features' },
                    ],
                },
                {
                    title: 'Hỗ trợ',
                    links: [
                        { label: 'Liên hệ', url: '#contact' },
                        { label: 'FAQ', url: '#' },
                        { label: 'Chính sách', url: '#' },
                    ],
                },
            ],
            copyrightText: `© ${new Date().getFullYear()} ${intent.name}. All rights reserved.`,
            showSocialLinks: true,
        },
    ]

    return {
        siteName: intent.name,
        siteType: intent.type,
        blocks,
        seo: {
            title: `${intent.name} — ${content.heroHeadline}`,
            description: content.heroSub,
        },
        theme,
    }
}

export type { GenerationResult, BusinessIntent }
