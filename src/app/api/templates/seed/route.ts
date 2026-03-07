import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * POST /api/templates/seed
 * Seeds preset templates into the database.
 * Only works if no templates exist yet (idempotent).
 */
export async function POST(req: NextRequest) {
    try {
        const payload = await getPayload({ config })

        // Check if templates already exist
        const existing = await payload.find({ collection: 'templates', limit: 1 })
        if (existing.totalDocs > 0) {
            return NextResponse.json({
                message: `Already seeded (${existing.totalDocs} templates exist)`,
                count: existing.totalDocs,
            })
        }

        const presetTemplates = [
            {
                name: 'Starter Business',
                description: 'Website cơ bản cho doanh nghiệp với Hero, About, Features, và Contact. Thiết kế sạch sẽ, chuyên nghiệp.',
                category: ['business'],
                isPremium: false,
                isFeatured: true,
                sortOrder: 1,
                defaultTheme: {
                    primaryColor: '#2563eb',
                    secondaryColor: '#7c3aed',
                    fontHeading: 'Outfit',
                    fontBody: 'Inter',
                    colorMode: 'dark',
                },
                defaultBlocks: [
                    {
                        blockType: 'navigation',
                        logoText: 'YourBrand',
                        links: [
                            { label: 'Trang chủ', url: '#' },
                            { label: 'Giới thiệu', url: '#about' },
                            { label: 'Dịch vụ', url: '#features' },
                            { label: 'Liên hệ', url: '#contact' },
                        ],
                        ctaButton: { show: true, label: 'Liên Hệ Ngay', url: '#contact' },
                    },
                    {
                        blockType: 'hero',
                        variant: 'centered',
                        headline: 'Giải Pháp Tốt Nhất Cho Doanh Nghiệp Bạn',
                        subheadline: 'Chúng tôi cung cấp dịch vụ chuyên nghiệp, tận tâm và hiệu quả cho sự phát triển bền vững.',
                        badge: { show: true, text: '✨ Trusted Partner' },
                        ctaButtons: [
                            { label: 'Bắt Đầu Ngay', url: '#contact', style: 'primary' },
                            { label: 'Tìm Hiểu Thêm', url: '#about', style: 'outline' },
                        ],
                    },
                    {
                        blockType: 'about',
                        sectionLabel: 'VỀ CHÚNG TÔI',
                        headline: 'Đội Ngũ Chuyên Gia Giàu Kinh Nghiệm',
                        body: { root: { children: [{ children: [{ text: 'Với hơn 10 năm kinh nghiệm, chúng tôi tự tin mang đến những giải pháp tốt nhất cho khách hàng.' }], type: 'paragraph' }], type: 'root' } },
                    },
                    {
                        blockType: 'features',
                        sectionLabel: 'DỊCH VỤ',
                        headline: 'Tại Sao Chọn Chúng Tôi?',
                        subheadline: 'Cam kết chất lượng và sự hài lòng',
                        features: [
                            { icon: '🚀', title: 'Nhanh Chóng', description: 'Triển khai nhanh, hiệu quả cao.' },
                            { icon: '🛡️', title: 'An Toàn', description: 'Bảo mật dữ liệu theo chuẩn quốc tế.' },
                            { icon: '💡', title: 'Sáng Tạo', description: 'Giải pháp đột phá, liên tục đổi mới.' },
                        ],
                    },
                    {
                        blockType: 'contact',
                        headline: 'Liên Hệ',
                        subtext: 'Chúng tôi sẵn sàng hỗ trợ bạn',
                        email: 'hello@yourbrand.com',
                        phone: '(+84) 0123 456 789',
                        formFields: [
                            { fieldName: 'name', fieldType: 'text', label: 'Họ và tên', required: true },
                            { fieldName: 'email', fieldType: 'email', label: 'Email', required: true },
                            { fieldName: 'message', fieldType: 'textarea', label: 'Nội dung', required: true },
                        ],
                    },
                    {
                        blockType: 'footer',
                        logoText: 'YourBrand',
                        tagline: 'Giải pháp cho doanh nghiệp hiện đại',
                        copyrightText: `© ${new Date().getFullYear()} YourBrand. All rights reserved.`,
                        columns: [
                            {
                                title: 'Liên kết',
                                links: [
                                    { label: 'Trang chủ', url: '#' },
                                    { label: 'Giới thiệu', url: '#about' },
                                    { label: 'Dịch vụ', url: '#features' },
                                ],
                            },
                        ],
                    },
                ],
            },
            {
                name: 'Coffee & Restaurant',
                description: 'Template ấm áp cho quán cafe, nhà hàng. Font Playfair Display sang trọng, tone màu amber.',
                category: ['restaurant'],
                isPremium: false,
                isFeatured: true,
                sortOrder: 2,
                defaultTheme: {
                    primaryColor: '#D97706',
                    secondaryColor: '#92400E',
                    fontHeading: 'Playfair Display',
                    fontBody: 'DM Sans',
                    colorMode: 'light',
                },
                defaultBlocks: [
                    {
                        blockType: 'navigation',
                        logoText: 'Café Sài Gòn',
                        links: [
                            { label: 'Menu', url: '#menu' },
                            { label: 'Không gian', url: '#gallery' },
                            { label: 'Liên hệ', url: '#contact' },
                        ],
                        ctaButton: { show: true, label: 'Đặt Bàn', url: '#contact' },
                    },
                    {
                        blockType: 'hero',
                        variant: 'centered',
                        headline: 'Hương Vị Đích Thực, Không Gian Thư Giãn',
                        subheadline: 'Thưởng thức cà phê nguyên chất và bánh ngọt tươi mỗi ngày tại quán chúng tôi.',
                        badge: { show: true, text: '☕ Since 2020' },
                        ctaButtons: [
                            { label: 'Xem Menu', url: '#menu', style: 'primary' },
                            { label: 'Đặt Bàn', url: '#contact', style: 'outline' },
                        ],
                    },
                    {
                        blockType: 'features',
                        sectionLabel: 'MENU NỔI BẬT',
                        headline: 'Món Ăn Đặc Sắc',
                        features: [
                            { icon: '☕', title: 'Cà Phê Đặc Biệt', description: 'Hạt cà phê Arabica rang mộc từ vùng cao' },
                            { icon: '🍰', title: 'Bánh Ngọt Tươi', description: 'Tiramisu, Cheesecake, Croissant nướng mỗi sáng' },
                            { icon: '🍵', title: 'Trà Thượng Hạng', description: 'Trà oolong, matcha Nhật Bản, trà hoa cúc' },
                        ],
                    },
                    {
                        blockType: 'testimonials',
                        headline: 'Khách Hàng Nói Gì?',
                        testimonials: [
                            { name: 'Minh Tú', quote: 'Không gian tuyệt vời, cà phê ngon nhất khu vực!', rating: 5, title: 'Food Blogger' },
                            { name: 'Hoàng Anh', quote: 'Bánh ngọt tươi, vị authentic. Sẽ quay lại mỗi tuần.', rating: 5, title: 'Regular Customer' },
                        ],
                    },
                    {
                        blockType: 'contact',
                        headline: 'Đặt Bàn',
                        subtext: 'Liên hệ ngay để đặt bàn hoặc tham quan',
                        email: 'hello@cafesaigon.com',
                        phone: '(+84) 028 1234 5678',
                        formFields: [
                            { fieldName: 'name', fieldType: 'text', label: 'Họ và tên', required: true },
                            { fieldName: 'phone', fieldType: 'text', label: 'Số điện thoại', required: true },
                            { fieldName: 'message', fieldType: 'textarea', label: 'Ghi chú', required: false },
                        ],
                    },
                    {
                        blockType: 'footer',
                        logoText: 'Café Sài Gòn',
                        tagline: 'Nơi quy tụ những hương vị tuyệt vời',
                        copyrightText: `© ${new Date().getFullYear()} Café Sài Gòn`,
                    },
                ],
            },
            {
                name: 'E-commerce Modern',
                description: 'Template bán hàng online hiện đại. Tông xanh sky-blue, DM Sans font, tối ưu cho chuyển đổi.',
                category: ['ecommerce'],
                isPremium: false,
                isFeatured: false,
                sortOrder: 3,
                defaultTheme: {
                    primaryColor: '#0ea5e9',
                    secondaryColor: '#06b6d4',
                    fontHeading: 'DM Sans',
                    fontBody: 'Inter',
                    colorMode: 'dark',
                },
                defaultBlocks: [
                    {
                        blockType: 'navigation',
                        logoText: 'ShopHub',
                        links: [
                            { label: 'Sản phẩm', url: '#products' },
                            { label: 'Đánh giá', url: '#reviews' },
                            { label: 'Liên hệ', url: '#contact' },
                        ],
                        ctaButton: { show: true, label: 'Mua Ngay', url: '#products' },
                    },
                    {
                        blockType: 'hero',
                        variant: 'centered',
                        headline: 'Mua Sắm Thông Minh, Giá Cả Hợp Lý',
                        subheadline: 'Khám phá bộ sưu tập mới nhất với ưu đãi đặc biệt hôm nay.',
                        badge: { show: true, text: '🔥 Flash Sale -50%' },
                        ctaButtons: [
                            { label: 'Xem Sản Phẩm', url: '#products', style: 'primary' },
                        ],
                    },
                    {
                        blockType: 'features',
                        sectionLabel: 'TẠI SAO CHỌN CHÚNG TÔI',
                        headline: 'Cam Kết Chất Lượng',
                        features: [
                            { icon: '🚚', title: 'Miễn Phí Giao Hàng', description: 'Giao hàng miễn phí cho đơn từ 500K' },
                            { icon: '↩️', title: 'Đổi Trả Dễ Dàng', description: '30 ngày đổi trả không điều kiện' },
                            { icon: '🔒', title: 'Thanh Toán An Toàn', description: 'Bảo mật SSL 256-bit cho mọi giao dịch' },
                        ],
                    },
                    {
                        blockType: 'contact',
                        headline: 'Hỗ Trợ Khách Hàng',
                        subtext: 'Đội ngũ CSKH sẵn sàng 24/7',
                        email: 'support@shophub.com',
                        phone: '1800 1234',
                        formFields: [
                            { fieldName: 'name', fieldType: 'text', label: 'Họ tên', required: true },
                            { fieldName: 'email', fieldType: 'email', label: 'Email', required: true },
                            { fieldName: 'message', fieldType: 'textarea', label: 'Nội dung', required: true },
                        ],
                    },
                    {
                        blockType: 'footer',
                        logoText: 'ShopHub',
                        tagline: 'Mua sắm thông minh mỗi ngày',
                        copyrightText: `© ${new Date().getFullYear()} ShopHub. All rights reserved.`,
                    },
                ],
            },
            {
                name: 'Creative Portfolio',
                description: 'Portfolio tối giản cho designer, photographer. Tone rose-gold, dark mode, hiệu ứng tinh tế.',
                category: ['portfolio'],
                isPremium: true,
                isFeatured: true,
                sortOrder: 4,
                defaultTheme: {
                    primaryColor: '#f43f5e',
                    secondaryColor: '#ec4899',
                    fontHeading: 'Outfit',
                    fontBody: 'Inter',
                    colorMode: 'dark',
                },
                defaultBlocks: [
                    {
                        blockType: 'navigation',
                        logoText: 'Studio.vn',
                        links: [
                            { label: 'Work', url: '#work' },
                            { label: 'About', url: '#about' },
                            { label: 'Contact', url: '#contact' },
                        ],
                    },
                    {
                        blockType: 'hero',
                        variant: 'centered',
                        headline: 'Design That Speaks',
                        subheadline: 'Creative studio specializing in brand identity, web design, and visual storytelling.',
                        ctaButtons: [
                            { label: 'View Work', url: '#work', style: 'primary' },
                            { label: 'Get In Touch', url: '#contact', style: 'outline' },
                        ],
                    },
                    {
                        blockType: 'about',
                        sectionLabel: 'ABOUT',
                        headline: 'Passion Meets Precision',
                        body: { root: { children: [{ children: [{ text: 'We craft visual experiences that connect brands with their audiences. Every pixel matters.' }], type: 'paragraph' }], type: 'root' } },
                    },
                    {
                        blockType: 'contact',
                        headline: 'Let\'s Create Together',
                        subtext: 'Have a project in mind? Let\'s talk.',
                        email: 'hello@studio.vn',
                        formFields: [
                            { fieldName: 'name', fieldType: 'text', label: 'Your Name', required: true },
                            { fieldName: 'email', fieldType: 'email', label: 'Email', required: true },
                            { fieldName: 'message', fieldType: 'textarea', label: 'Tell us about your project', required: true },
                        ],
                    },
                    {
                        blockType: 'footer',
                        logoText: 'Studio.vn',
                        tagline: 'Design that speaks volumes',
                        copyrightText: `© ${new Date().getFullYear()} Studio.vn`,
                    },
                ],
            },
            {
                name: 'Tech Blog',
                description: 'Blog template cho content creator. Emerald green, clean layout, tối ưu cho nội dung dài.',
                category: ['blog'],
                isPremium: false,
                isFeatured: false,
                sortOrder: 5,
                defaultTheme: {
                    primaryColor: '#10b981',
                    secondaryColor: '#059669',
                    fontHeading: 'Outfit',
                    fontBody: 'Inter',
                    colorMode: 'dark',
                },
                defaultBlocks: [
                    {
                        blockType: 'navigation',
                        logoText: 'TechBlog',
                        links: [
                            { label: 'Blog', url: '#blog' },
                            { label: 'Categories', url: '#categories' },
                            { label: 'About', url: '#about' },
                        ],
                        ctaButton: { show: true, label: 'Subscribe', url: '#contact' },
                    },
                    {
                        blockType: 'hero',
                        variant: 'centered',
                        headline: 'Insights & Stories',
                        subheadline: 'Khám phá xu hướng công nghệ, tips và bài viết chuyên sâu từ đội ngũ chuyên gia.',
                        ctaButtons: [
                            { label: 'Đọc Bài Mới', url: '#blog', style: 'primary' },
                        ],
                    },
                    {
                        blockType: 'features',
                        sectionLabel: 'CHỦ ĐỀ',
                        headline: 'Chuyên Mục Nổi Bật',
                        features: [
                            { icon: '💻', title: 'Technology', description: 'Xu hướng tech mới nhất' },
                            { icon: '🎨', title: 'Design', description: 'UI/UX tips và inspiration' },
                            { icon: '📈', title: 'Growth', description: 'Chiến lược scaling business' },
                        ],
                    },
                    {
                        blockType: 'contact',
                        headline: 'Subscribe',
                        subtext: 'Nhận bài viết mới qua email',
                        email: 'hello@techblog.vn',
                        formFields: [
                            { fieldName: 'email', fieldType: 'email', label: 'Email của bạn', required: true },
                        ],
                    },
                    {
                        blockType: 'footer',
                        logoText: 'TechBlog',
                        tagline: 'Knowledge shared is knowledge multiplied',
                        copyrightText: `© ${new Date().getFullYear()} TechBlog`,
                    },
                ],
            },
            {
                name: 'Agency Pro',
                description: 'Template cao cấp cho agency, consultant. Gradient xanh-tím, hiệu ứng glassmorphism.',
                category: ['service', 'business'],
                isPremium: true,
                isFeatured: false,
                sortOrder: 6,
                defaultTheme: {
                    primaryColor: '#6366f1',
                    secondaryColor: '#8b5cf6',
                    fontHeading: 'Outfit',
                    fontBody: 'Inter',
                    colorMode: 'dark',
                },
                defaultBlocks: [
                    {
                        blockType: 'navigation',
                        logoText: 'AgencyX',
                        links: [
                            { label: 'Services', url: '#services' },
                            { label: 'Work', url: '#work' },
                            { label: 'Team', url: '#team' },
                            { label: 'Contact', url: '#contact' },
                        ],
                        ctaButton: { show: true, label: 'Get a Quote', url: '#contact' },
                    },
                    {
                        blockType: 'hero',
                        variant: 'centered',
                        headline: 'We Build Digital Experiences',
                        subheadline: 'Full-service digital agency specializing in web, mobile, and AI solutions.',
                        badge: { show: true, text: '🏆 Top Agency 2026' },
                        ctaButtons: [
                            { label: 'Our Work', url: '#work', style: 'primary' },
                            { label: 'Contact Us', url: '#contact', style: 'outline' },
                        ],
                    },
                    {
                        blockType: 'features',
                        sectionLabel: 'SERVICES',
                        headline: 'What We Do',
                        features: [
                            { icon: '🎨', title: 'UI/UX Design', description: 'User-centered design that converts' },
                            { icon: '⚡', title: 'Web Development', description: 'Fast, scalable web applications' },
                            { icon: '🤖', title: 'AI Solutions', description: 'Intelligent automation for your business' },
                        ],
                    },
                    {
                        blockType: 'testimonials',
                        headline: 'Client Testimonials',
                        testimonials: [
                            { name: 'CEO, TechCorp', quote: 'AgencyX transformed our digital presence completely. Revenue up 300%.', rating: 5 },
                            { name: 'Founder, StartupAI', quote: 'Best agency we\'ve worked with. They truly understand business goals.', rating: 5 },
                        ],
                    },
                    {
                        blockType: 'contact',
                        headline: 'Start a Project',
                        subtext: 'Tell us about your vision',
                        email: 'hello@agencyx.com',
                        formFields: [
                            { fieldName: 'name', fieldType: 'text', label: 'Name', required: true },
                            { fieldName: 'email', fieldType: 'email', label: 'Email', required: true },
                            { fieldName: 'budget', fieldType: 'text', label: 'Budget Range', required: false },
                            { fieldName: 'message', fieldType: 'textarea', label: 'Project Details', required: true },
                        ],
                    },
                    {
                        blockType: 'footer',
                        logoText: 'AgencyX',
                        tagline: 'Digital experiences that matter',
                        copyrightText: `© ${new Date().getFullYear()} AgencyX`,
                    },
                ],
            },
        ]

        // Seed all templates
        const created = []
        for (const tmpl of presetTemplates) {
            const doc = await payload.create({
                collection: 'templates',
                data: tmpl as any,
            })
            created.push({ id: doc.id, name: (doc as any).name })
        }

        return NextResponse.json({
            success: true,
            count: created.length,
            templates: created,
        })

    } catch (error: any) {
        console.error('[Seed Templates Error]', error)
        return NextResponse.json(
            { error: error?.message || 'Seed failed' },
            { status: 500 },
        )
    }
}
