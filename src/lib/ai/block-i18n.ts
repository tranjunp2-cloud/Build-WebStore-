/**
 * Static UI string translations for AI-generated blocks.
 *
 * Covers structural strings (headlines, form labels, nav links, footer text)
 * that appear regardless of GPT output — injected by gap-fill, post-AI swap,
 * and template-composer builders.
 *
 * Business-content strings (service descriptions, FAQ answers, team bios, etc.)
 * are NOT here — those come from the content library or are GPT-generated.
 *
 * Usage: getBlockStrings(lang).contact.headline
 */

export interface BlockStrings {
    navigation: {
        home: string
        about: string
        services: string
        contact: string
        getStarted: string
    }
    about: {
        headlinePrefix: string
    }
    faq: {
        headline: string
        headlineWithBiz: (biz: string) => string
    }
    cta: {
        headlineReady: (name: string) => string
        headlineDiscover: (name: string) => string
        subheadline: string
    }
    contact: {
        headline: string
        subheadline: string
        subheadlineWithBiz: (name: string) => string
        nameLabel: string
        emailLabel: string
        phoneLabel: string
        addressLabel: string
        messageLabel: string
        namePlaceholder: string
        messagePlaceholder: string
        submitLabel: string
    }
    footer: {
        allRightsReserved: string
        explore: string
        company: string
        support: string
        legal: string
        aboutUs: string
        careers: string
        helpCenter: string
        getInTouch: string
        privacyPolicy: string
        termsOfService: string
        cookiePolicy: string
    }
    features: {
        headlineWhyChoose: (name: string) => string
    }
    stats: {
        headline: string
    }
    team: {
        headline: string
        subheadline: string
    }
    serviceCards: {
        headline: string
        subheadline: (name: string) => string
        ctaLabel: string
    }
    clientLogos: {
        headline: string
    }
    gallery: {
        headline: string
    }
    newsletter: {
        headlineStayUpdated: (name: string) => string
        subheadlineFallback: string
        subscribeLabel: string
    }
    pricing: {
        headline: string
        subheadline: string
        getStarted: string
        learnMore: string
    }
    testimonials: {
        headline: string
        headlineWithBiz: (biz: string) => string
        subheadline: string
    }
}

const STRINGS: Record<string, BlockStrings> = {
    en: {
        navigation: {
            home: 'Home',
            about: 'About',
            services: 'Services',
            contact: 'Contact',
            getStarted: 'Get Started',
        },
        about: { headlinePrefix: 'About' },
        faq: {
            headline: 'Frequently Asked Questions',
            headlineWithBiz: (biz) => `${biz} — FAQ`,
        },
        cta: {
            headlineReady: (name) => `Ready to Get Started with ${name}?`,
            headlineDiscover: (name) => `Discover ${name}`,
            subheadline: 'Contact us today and let us help you achieve your goals.',
        },
        contact: {
            headline: 'Get in Touch',
            subheadline: 'We would love to hear from you. Send us a message.',
            subheadlineWithBiz: (name) => `We'd love to hear from you. Reach out to ${name} today.`,
            nameLabel: 'Name',
            emailLabel: 'Email',
            phoneLabel: 'Phone',
            addressLabel: 'Address',
            messageLabel: 'Message',
            namePlaceholder: 'Your full name',
            messagePlaceholder: 'How can we help you?',
            submitLabel: 'Send Message',
        },
        footer: {
            allRightsReserved: 'All rights reserved.',
            explore: 'Explore',
            company: 'Company',
            support: 'Support',
            legal: 'Legal',
            aboutUs: 'About Us',
            careers: 'Careers',
            helpCenter: 'Help Center',
            getInTouch: 'Get in Touch',
            privacyPolicy: 'Privacy Policy',
            termsOfService: 'Terms of Service',
            cookiePolicy: 'Cookie Policy',
        },
        features: { headlineWhyChoose: (name) => `Why Choose ${name}` },
        stats: { headline: 'Our Numbers Speak' },
        team: {
            headline: 'Meet Our Team',
            subheadline: 'The people behind the magic.',
        },
        serviceCards: { headline: 'Our Services', subheadline: (name) => `Discover what ${name} can do for you.`, ctaLabel: 'Learn More' },
        clientLogos: { headline: 'Trusted By' },
        gallery: { headline: 'Our Work' },
        newsletter: {
            headlineStayUpdated: (name) => `Stay Updated with ${name}`,
            subheadlineFallback: 'Subscribe for exclusive news and offers.',
            subscribeLabel: 'Subscribe',
        },
        pricing: {
            headline: 'Our Pricing',
            subheadline: 'Transparent pricing with no hidden fees.',
            getStarted: 'Get Started',
            learnMore: 'Learn More',
        },
        testimonials: {
            headline: 'What Our Customers Say',
            headlineWithBiz: (biz) => `What Our Customers Say About ${biz}`,
            subheadline: 'Genuine reviews from our customers',
        },
    },

    ms: {
        navigation: {
            home: 'Utama',
            about: 'Tentang Kami',
            services: 'Perkhidmatan',
            contact: 'Hubungi',
            getStarted: 'Mulakan',
        },
        about: { headlinePrefix: 'Tentang' },
        faq: {
            headline: 'Soalan Lazim',
            headlineWithBiz: (biz) => `${biz} — Soalan Lazim`,
        },
        cta: {
            headlineReady: (name) => `Bersedia untuk Bermula dengan ${name}?`,
            headlineDiscover: (name) => `Temui ${name}`,
            subheadline: 'Hubungi kami hari ini dan biarkan kami membantu anda mencapai matlamat anda.',
        },
        contact: {
            headline: 'Hubungi Kami',
            subheadline: 'Kami ingin mendengar daripada anda. Hantar mesej kepada kami.',
            subheadlineWithBiz: (name) => `Kami ingin mendengar daripada anda. Hubungi ${name} hari ini.`,
            nameLabel: 'Nama',
            emailLabel: 'E-mel',
            phoneLabel: 'Telefon',
            addressLabel: 'Alamat',
            messageLabel: 'Mesej',
            namePlaceholder: 'Nama penuh anda',
            messagePlaceholder: 'Bagaimana kami boleh membantu anda?',
            submitLabel: 'Hantar Mesej',
        },
        footer: {
            allRightsReserved: 'Hak cipta terpelihara.',
            explore: 'Terokai',
            company: 'Syarikat',
            support: 'Sokongan',
            legal: 'Undang-undang',
            aboutUs: 'Tentang Kami',
            careers: 'Kerjaya',
            helpCenter: 'Pusat Bantuan',
            getInTouch: 'Hubungi Kami',
            privacyPolicy: 'Dasar Privasi',
            termsOfService: 'Terma Perkhidmatan',
            cookiePolicy: 'Dasar Kuki',
        },
        features: { headlineWhyChoose: (name) => `Kenapa Pilih ${name}` },
        stats: { headline: 'Angka-angka Kami' },
        team: {
            headline: 'Pasukan Kami',
            subheadline: 'Orang-orang di sebalik kejayaan kami.',
        },
        serviceCards: { headline: 'Perkhidmatan Kami', subheadline: (name) => `Temui apa yang ${name} boleh lakukan untuk anda.`, ctaLabel: 'Ketahui Lebih Lanjut' },
        clientLogos: { headline: 'Dipercayai Oleh Pemimpin Industri' },
        gallery: { headline: 'Kerja-kerja Kami' },
        newsletter: {
            headlineStayUpdated: (name) => `Ikuti Perkembangan Terbaru ${name}`,
            subheadlineFallback: 'Langgan untuk berita dan tawaran eksklusif.',
            subscribeLabel: 'Langgan',
        },
        pricing: {
            headline: 'Harga Kami',
            subheadline: 'Harga telus tanpa yuran tersembunyi.',
            getStarted: 'Mulakan',
            learnMore: 'Ketahui Lebih Lanjut',
        },
        testimonials: {
            headline: 'Apa Kata Pelanggan Kami',
            headlineWithBiz: (biz) => `Apa Kata Pelanggan ${biz}`,
            subheadline: 'Ulasan tulen daripada pelanggan kami',
        },
    },

    vi: {
        navigation: {
            home: 'Trang Chủ',
            about: 'Giới Thiệu',
            services: 'Dịch Vụ',
            contact: 'Liên Hệ',
            getStarted: 'Bắt Đầu',
        },
        about: { headlinePrefix: 'Về' },
        faq: {
            headline: 'Câu Hỏi Thường Gặp',
            headlineWithBiz: (biz) => `${biz} — Câu Hỏi Thường Gặp`,
        },
        cta: {
            headlineReady: (name) => `Sẵn Sàng Bắt Đầu với ${name}?`,
            headlineDiscover: (name) => `Khám Phá ${name}`,
            subheadline: 'Liên hệ với chúng tôi ngay hôm nay để chúng tôi giúp bạn đạt được mục tiêu.',
        },
        contact: {
            headline: 'Liên Hệ Ngay',
            subheadline: 'Chúng tôi rất muốn nghe từ bạn. Hãy gửi tin nhắn cho chúng tôi.',
            subheadlineWithBiz: (name) => `Chúng tôi rất muốn nghe từ bạn. Liên hệ ${name} ngay hôm nay.`,
            nameLabel: 'Họ và Tên',
            emailLabel: 'Email',
            phoneLabel: 'Điện Thoại',
            addressLabel: 'Địa Chỉ',
            messageLabel: 'Tin Nhắn',
            namePlaceholder: 'Họ và tên đầy đủ của bạn',
            messagePlaceholder: 'Chúng tôi có thể giúp gì cho bạn?',
            submitLabel: 'Gửi Tin Nhắn',
        },
        footer: {
            allRightsReserved: 'Bản quyền thuộc về.',
            explore: 'Khám Phá',
            company: 'Công Ty',
            support: 'Hỗ Trợ',
            legal: 'Pháp Lý',
            aboutUs: 'Về Chúng Tôi',
            careers: 'Tuyển Dụng',
            helpCenter: 'Trung Tâm Hỗ Trợ',
            getInTouch: 'Liên Hệ',
            privacyPolicy: 'Chính Sách Bảo Mật',
            termsOfService: 'Điều Khoản Dịch Vụ',
            cookiePolicy: 'Chính Sách Cookie',
        },
        features: { headlineWhyChoose: (name) => `Tại Sao Chọn ${name}` },
        stats: { headline: 'Con Số Của Chúng Tôi' },
        team: {
            headline: 'Đội Ngũ Của Chúng Tôi',
            subheadline: 'Những con người tạo nên điều kỳ diệu.',
        },
        serviceCards: { headline: 'Dịch Vụ Của Chúng Tôi', subheadline: (name) => `Khám phá những gì ${name} có thể làm cho bạn.`, ctaLabel: 'Tìm Hiểu Thêm' },
        clientLogos: { headline: 'Được Tin Tưởng Bởi Các Lãnh Đạo Ngành' },
        gallery: { headline: 'Tác Phẩm Của Chúng Tôi' },
        newsletter: {
            headlineStayUpdated: (name) => `Cập Nhật Mới Nhất Từ ${name}`,
            subheadlineFallback: 'Đăng ký để nhận tin tức và ưu đãi độc quyền.',
            subscribeLabel: 'Đăng Ký',
        },
        pricing: {
            headline: 'Bảng Giá',
            subheadline: 'Giá minh bạch, không có phí ẩn.',
            getStarted: 'Bắt Đầu',
            learnMore: 'Tìm Hiểu Thêm',
        },
        testimonials: {
            headline: 'Khách Hàng Nói Gì',
            headlineWithBiz: (biz) => `Khách Hàng Nói Gì Về ${biz}`,
            subheadline: 'Đánh giá thực từ khách hàng của chúng tôi',
        },
    },
}

/**
 * Get block UI strings for any language code (ISO 639-1 or BCP 47).
 * Falls back by stripping region tag (e.g. "zh-TW" → "zh"), then to English.
 */
export function getBlockStrings(lang?: string): BlockStrings {
    if (!lang) return STRINGS.en
    if (STRINGS[lang]) return STRINGS[lang]
    const prefix = lang.split('-')[0]
    return STRINGS[prefix] ?? STRINGS.en
}

/**
 * Returns true only when there are dedicated i18n strings for this language
 * (i.e. not the English fallback). Used by the normalization chain in
 * post-ai-swap to decide whether to trust GPT's output vs. override it.
 */
export function hasDedicatedStrings(lang?: string): boolean {
    if (!lang) return false
    if (STRINGS[lang]) return true
    const prefix = lang.split('-')[0]
    return !!STRINGS[prefix]
}

// ── Minimal nav label lookup ──────────────────────────────────────────────────
//
// GPT has an insurmountable training bias toward English nav labels ("Home",
// "About", "Services", "Contact") — prompt instructions alone cannot reliably
// override this. These 5 structural UI labels are NOT website content; they're
// chrome identical on every site, so a lookup table is the correct mechanism.
//
// Coverage: non-Latin script languages detected by lang-detect fast paths +
// the en/ms/vi trio already in STRINGS (duplicated here for a single lookup).
// European Latin-script languages are omitted — GPT generally gets them right.

export interface NavLabels {
    home: string
    about: string
    services: string
    contact: string
    getStarted: string
}

// Static seed — covers non-Latin script languages where GPT nav-label bias is worst.
// At runtime this is loaded into runtimeNavCache so additional languages can be
// injected by nav-label-translator without modifying this file.
const NAV_LABELS_SEED: Record<string, NavLabels> = {
    en: { home: 'Home', about: 'About', services: 'Services', contact: 'Contact', getStarted: 'Get Started' },
    ms: { home: 'Utama', about: 'Tentang Kami', services: 'Perkhidmatan', contact: 'Hubungi', getStarted: 'Mulakan' },
    vi: { home: 'Trang Chủ', about: 'Giới Thiệu', services: 'Dịch Vụ', contact: 'Liên Hệ', getStarted: 'Bắt Đầu' },
    ja: { home: 'ホーム', about: '会社概要', services: 'サービス', contact: 'お問い合わせ', getStarted: '今すぐ始める' },
    zh: { home: '首页', about: '关于我们', services: '服务', contact: '联系我们', getStarted: '开始' },
    ko: { home: '홈', about: '소개', services: '서비스', contact: '연락처', getStarted: '시작하기' },
    ar: { home: 'الرئيسية', about: 'عن الشركة', services: 'الخدمات', contact: 'اتصل بنا', getStarted: 'ابدأ الآن' },
    th: { home: 'หน้าหลัก', about: 'เกี่ยวกับเรา', services: 'บริการ', contact: 'ติดต่อ', getStarted: 'เริ่มต้น' },
}

// Runtime cache — module-level Map persists across requests within a warm server
// instance. Pre-seeded from NAV_LABELS_SEED; extended at runtime for new languages
// via injectNavLabels() (called by nav-label-translator after a GPT micro-call).
const runtimeNavCache = new Map<string, NavLabels>(Object.entries(NAV_LABELS_SEED))

/** Inject GPT-translated nav labels for a language not in the static seed. */
export function injectNavLabels(lang: string, labels: NavLabels): void {
    runtimeNavCache.set(lang, labels)
}

/**
 * Get nav labels for the given language code.
 * Checks runtime cache (includes GPT-translated entries) then falls back by
 * stripping region tag (e.g. "zh-TW" → "zh"). Returns null when unknown —
 * caller keeps GPT output and nav-label-translator fires a prefetch for next request.
 */
export function getNavLabels(lang?: string): NavLabels | null {
    if (!lang) return null
    if (runtimeNavCache.has(lang)) return runtimeNavCache.get(lang)!
    const prefix = lang.split('-')[0]
    return runtimeNavCache.get(prefix) ?? null
}

// ── Section label lookup ──────────────────────────────────────────────────────
//
// GPT has the same training bias for sectionLabel fields ("ABOUT US", "GALLERY",
// "CONTACT", "OUR SERVICES", etc.) as it does for nav labels — structural chrome
// that appears identically on millions of English training-data sites.
// Only covers non-Latin-script languages where the bias is most severe.
// en/ms/vi are handled by the full STRINGS chain (hasDedicatedStrings).

export interface SectionLabels {
    about: string
    gallery: string
    contact: string
    features: string
    testimonials: string
    faq: string
    team: string
    serviceCards: string
    stats: string
    pricing: string
    newsletter: string
    clientLogos: string
    blogList: string
}

const SECTION_LABELS_SEED: Record<string, SectionLabels> = {
    ja: {
        about: '会社概要',
        gallery: 'ギャラリー',
        contact: 'お問い合わせ',
        features: 'サービスの特徴',
        testimonials: 'お客様の声',
        faq: 'よくある質問',
        team: 'チーム紹介',
        serviceCards: 'サービス内容',
        stats: '実績・数字',
        pricing: '料金プラン',
        newsletter: 'ニュースレター',
        clientLogos: 'お客様・パートナー',
        blogList: 'ブログ・最新情報',
    },
    zh: {
        about: '关于我们',
        gallery: '图片展示',
        contact: '联系我们',
        features: '服务特色',
        testimonials: '客户评价',
        faq: '常见问题',
        team: '团队介绍',
        serviceCards: '服务项目',
        stats: '核心数据',
        pricing: '价格方案',
        newsletter: '订阅通讯',
        clientLogos: '合作客户',
        blogList: '博客资讯',
    },
    ko: {
        about: '회사 소개',
        gallery: '갤러리',
        contact: '문의하기',
        features: '서비스 특징',
        testimonials: '고객 후기',
        faq: '자주 묻는 질문',
        team: '팀 소개',
        serviceCards: '서비스 안내',
        stats: '주요 실적',
        pricing: '요금제',
        newsletter: '뉴스레터',
        clientLogos: '파트너 & 고객사',
        blogList: '블로그',
    },
    ar: {
        about: 'من نحن',
        gallery: 'معرض الصور',
        contact: 'تواصل معنا',
        features: 'مميزات الخدمة',
        testimonials: 'آراء العملاء',
        faq: 'الأسئلة الشائعة',
        team: 'فريق العمل',
        serviceCards: 'خدماتنا',
        stats: 'أرقام وإنجازات',
        pricing: 'خطط الأسعار',
        newsletter: 'النشرة البريدية',
        clientLogos: 'شركاؤنا وعملاؤنا',
        blogList: 'المدونة',
    },
    th: {
        about: 'เกี่ยวกับเรา',
        gallery: 'แกลเลอรี่',
        contact: 'ติดต่อเรา',
        features: 'จุดเด่นของบริการ',
        testimonials: 'รีวิวจากลูกค้า',
        faq: 'คำถามที่พบบ่อย',
        team: 'ทีมงานของเรา',
        serviceCards: 'บริการของเรา',
        stats: 'ตัวเลขที่โดดเด่น',
        pricing: 'แผนราคา',
        newsletter: 'จดหมายข่าว',
        clientLogos: 'ลูกค้าและพันธมิตร',
        blogList: 'บทความและข่าวสาร',
    },
}

/** Get section labels for the given language code. Returns null for unsupported languages. */
export function getSectionLabels(lang?: string): SectionLabels | null {
    if (!lang) return null
    if (SECTION_LABELS_SEED[lang]) return SECTION_LABELS_SEED[lang]!
    const prefix = lang.split('-')[0]
    return SECTION_LABELS_SEED[prefix] ?? null
}
