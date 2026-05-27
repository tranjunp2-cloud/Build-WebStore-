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

    ja: {
        navigation: { home: 'ホーム', about: '会社概要', services: 'サービス', contact: 'お問い合わせ', getStarted: '今すぐ始める' },
        about: { headlinePrefix: '' },
        faq: { headline: 'よくある質問', headlineWithBiz: (biz) => `${biz} — よくある質問` },
        cta: {
            headlineReady: (name) => `${name}で始めませんか？`,
            headlineDiscover: (name) => `${name}を体験する`,
            subheadline: '今すぐお問い合わせください。',
        },
        contact: {
            headline: 'お問い合わせ',
            subheadline: 'お気軽にご連絡ください。',
            subheadlineWithBiz: (name) => `${name}へのお問い合わせ`,
            nameLabel: 'お名前', emailLabel: 'メールアドレス', phoneLabel: '電話番号',
            addressLabel: '住所', messageLabel: 'メッセージ',
            namePlaceholder: '山田 太郎', messagePlaceholder: 'メッセージをご入力ください',
            submitLabel: '送信する',
        },
        footer: {
            allRightsReserved: 'All rights reserved.',
            explore: 'サービス', company: '会社情報', support: 'サポート', legal: '法的情報',
            aboutUs: '会社概要', careers: '採用情報', helpCenter: 'ヘルプセンター', getInTouch: 'お問い合わせ',
            privacyPolicy: 'プライバシーポリシー', termsOfService: '利用規約', cookiePolicy: 'Cookieポリシー',
        },
        features: { headlineWhyChoose: (name) => `${name}が選ばれる理由` },
        stats: { headline: '実績と数字' },
        team: { headline: 'チームメンバー', subheadline: 'チームをご紹介します。' },
        serviceCards: { headline: 'サービス内容', subheadline: (name) => `${name}のサービスをご覧ください。`, ctaLabel: '詳細を見る' },
        clientLogos: { headline: 'お客様・パートナー' },
        gallery: { headline: 'ギャラリー' },
        newsletter: {
            headlineStayUpdated: (name) => `${name}の最新情報`,
            subheadlineFallback: 'ニュースレターに登録して最新情報をお届けします。',
            subscribeLabel: '登録する',
        },
        pricing: { headline: '料金プラン', subheadline: '明確な料金体系、隠れた費用なし。', getStarted: '今すぐ始める', learnMore: '詳細を見る' },
        testimonials: { headline: 'お客様の声', headlineWithBiz: (biz) => `${biz}のお客様の声`, subheadline: 'お客様からの真のレビュー' },
    },

    zh: {
        navigation: { home: '首页', about: '关于我们', services: '服务', contact: '联系我们', getStarted: '立即开始' },
        about: { headlinePrefix: '关于' },
        faq: { headline: '常见问题', headlineWithBiz: (biz) => `${biz} — 常见问题` },
        cta: {
            headlineReady: (name) => `准备好与${name}合作了吗？`,
            headlineDiscover: (name) => `探索${name}`,
            subheadline: '立即联系我们，让我们帮助您实现目标。',
        },
        contact: {
            headline: '联系我们',
            subheadline: '欢迎随时与我们联系。',
            subheadlineWithBiz: (name) => `联系${name}，我们期待您的来信。`,
            nameLabel: '姓名', emailLabel: '邮箱', phoneLabel: '电话',
            addressLabel: '地址', messageLabel: '留言',
            namePlaceholder: '您的姓名', messagePlaceholder: '请留下您的信息',
            submitLabel: '发送消息',
        },
        footer: {
            allRightsReserved: '版权所有。',
            explore: '探索', company: '公司', support: '支持', legal: '法律',
            aboutUs: '关于我们', careers: '招聘', helpCenter: '帮助中心', getInTouch: '联系我们',
            privacyPolicy: '隐私政策', termsOfService: '服务条款', cookiePolicy: 'Cookie政策',
        },
        features: { headlineWhyChoose: (name) => `为什么选择${name}` },
        stats: { headline: '我们的数字' },
        team: { headline: '团队介绍', subheadline: '认识我们背后的团队。' },
        serviceCards: { headline: '我们的服务', subheadline: (name) => `探索${name}能为您做什么。`, ctaLabel: '了解更多' },
        clientLogos: { headline: '合作客户' },
        gallery: { headline: '作品展示' },
        newsletter: {
            headlineStayUpdated: (name) => `${name}最新资讯`,
            subheadlineFallback: '订阅获取独家新闻和优惠。',
            subscribeLabel: '订阅',
        },
        pricing: { headline: '价格方案', subheadline: '透明定价，无隐藏费用。', getStarted: '立即开始', learnMore: '了解更多' },
        testimonials: { headline: '客户评价', headlineWithBiz: (biz) => `${biz}客户评价`, subheadline: '来自客户的真实评价' },
    },

    ko: {
        navigation: { home: '홈', about: '소개', services: '서비스', contact: '연락처', getStarted: '시작하기' },
        about: { headlinePrefix: '' },
        faq: { headline: '자주 묻는 질문', headlineWithBiz: (biz) => `${biz} — 자주 묻는 질문` },
        cta: {
            headlineReady: (name) => `${name}와 함께 시작할 준비가 되셨나요?`,
            headlineDiscover: (name) => `${name} 알아보기`,
            subheadline: '오늘 바로 연락하세요.',
        },
        contact: {
            headline: '문의하기',
            subheadline: '궁금한 점이 있으시면 편하게 연락해 주세요.',
            subheadlineWithBiz: (name) => `${name}에 문의해 보세요.`,
            nameLabel: '이름', emailLabel: '이메일', phoneLabel: '전화번호',
            addressLabel: '주소', messageLabel: '메시지',
            namePlaceholder: '홍길동', messagePlaceholder: '메시지를 입력해 주세요',
            submitLabel: '메시지 보내기',
        },
        footer: {
            allRightsReserved: '모든 권리 보유.',
            explore: '탐색', company: '회사', support: '지원', legal: '법적 사항',
            aboutUs: '회사 소개', careers: '채용', helpCenter: '도움말 센터', getInTouch: '연락하기',
            privacyPolicy: '개인정보 처리방침', termsOfService: '이용약관', cookiePolicy: '쿠키 정책',
        },
        features: { headlineWhyChoose: (name) => `왜 ${name}인가요?` },
        stats: { headline: '우리의 실적' },
        team: { headline: '팀 소개', subheadline: '저희 팀을 소개합니다.' },
        serviceCards: { headline: '서비스 안내', subheadline: (name) => `${name}가 할 수 있는 것을 알아보세요.`, ctaLabel: '자세히 보기' },
        clientLogos: { headline: '파트너 & 고객사' },
        gallery: { headline: '갤러리' },
        newsletter: {
            headlineStayUpdated: (name) => `${name} 최신 소식`,
            subheadlineFallback: '뉴스레터를 구독하고 소식을 받아보세요.',
            subscribeLabel: '구독하기',
        },
        pricing: { headline: '요금제', subheadline: '투명한 가격, 숨겨진 요금 없음.', getStarted: '시작하기', learnMore: '자세히 보기' },
        testimonials: { headline: '고객 후기', headlineWithBiz: (biz) => `${biz} 고객 후기`, subheadline: '실제 고객의 솔직한 후기' },
    },

    ar: {
        navigation: { home: 'الرئيسية', about: 'عن الشركة', services: 'الخدمات', contact: 'اتصل بنا', getStarted: 'ابدأ الآن' },
        about: { headlinePrefix: 'عن' },
        faq: { headline: 'الأسئلة الشائعة', headlineWithBiz: (biz) => `${biz} — الأسئلة الشائعة` },
        cta: {
            headlineReady: (name) => `هل أنت مستعد للبدء مع ${name}؟`,
            headlineDiscover: (name) => `اكتشف ${name}`,
            subheadline: 'تواصل معنا اليوم ودعنا نساعدك على تحقيق أهدافك.',
        },
        contact: {
            headline: 'اتصل بنا',
            subheadline: 'يسعدنا التواصل معك. أرسل لنا رسالة.',
            subheadlineWithBiz: (name) => `تواصل مع ${name} اليوم.`,
            nameLabel: 'الاسم', emailLabel: 'البريد الإلكتروني', phoneLabel: 'رقم الهاتف',
            addressLabel: 'العنوان', messageLabel: 'الرسالة',
            namePlaceholder: 'الاسم الكامل', messagePlaceholder: 'كيف يمكننا مساعدتك؟',
            submitLabel: 'إرسال الرسالة',
        },
        footer: {
            allRightsReserved: 'جميع الحقوق محفوظة.',
            explore: 'استكشف', company: 'الشركة', support: 'الدعم', legal: 'القانوني',
            aboutUs: 'عن الشركة', careers: 'الوظائف', helpCenter: 'مركز المساعدة', getInTouch: 'تواصل معنا',
            privacyPolicy: 'سياسة الخصوصية', termsOfService: 'شروط الخدمة', cookiePolicy: 'سياسة ملفات تعريف الارتباط',
        },
        features: { headlineWhyChoose: (name) => `لماذا تختار ${name}؟` },
        stats: { headline: 'أرقامنا تتحدث' },
        team: { headline: 'فريق العمل', subheadline: 'الأشخاص الذين يصنعون الفارق.' },
        serviceCards: { headline: 'خدماتنا', subheadline: (name) => `اكتشف ما يمكن لـ${name} تقديمه لك.`, ctaLabel: 'اعرف المزيد' },
        clientLogos: { headline: 'شركاؤنا وعملاؤنا' },
        gallery: { headline: 'معرض أعمالنا' },
        newsletter: {
            headlineStayUpdated: (name) => `ابق على اطلاع مع ${name}`,
            subheadlineFallback: 'اشترك للحصول على أخبار وعروض حصرية.',
            subscribeLabel: 'اشترك',
        },
        pricing: { headline: 'خطط الأسعار', subheadline: 'أسعار شفافة بدون رسوم مخفية.', getStarted: 'ابدأ الآن', learnMore: 'اعرف المزيد' },
        testimonials: { headline: 'آراء عملائنا', headlineWithBiz: (biz) => `آراء عملاء ${biz}`, subheadline: 'تقييمات حقيقية من عملائنا' },
    },

    th: {
        navigation: { home: 'หน้าหลัก', about: 'เกี่ยวกับเรา', services: 'บริการ', contact: 'ติดต่อ', getStarted: 'เริ่มต้น' },
        about: { headlinePrefix: 'เกี่ยวกับ' },
        faq: { headline: 'คำถามที่พบบ่อย', headlineWithBiz: (biz) => `${biz} — คำถามที่พบบ่อย` },
        cta: {
            headlineReady: (name) => `พร้อมเริ่มต้นกับ ${name} แล้วหรือยัง?`,
            headlineDiscover: (name) => `สำรวจ ${name}`,
            subheadline: 'ติดต่อเราวันนี้เพื่อให้เราช่วยคุณบรรลุเป้าหมาย',
        },
        contact: {
            headline: 'ติดต่อเรา',
            subheadline: 'ยินดีรับฟังความคิดเห็นของคุณ ส่งข้อความถึงเราได้เลย',
            subheadlineWithBiz: (name) => `ติดต่อ ${name} วันนี้`,
            nameLabel: 'ชื่อ', emailLabel: 'อีเมล', phoneLabel: 'เบอร์โทรศัพท์',
            addressLabel: 'ที่อยู่', messageLabel: 'ข้อความ',
            namePlaceholder: 'ชื่อ-นามสกุล', messagePlaceholder: 'เราจะช่วยคุณได้อย่างไร?',
            submitLabel: 'ส่งข้อความ',
        },
        footer: {
            allRightsReserved: 'สงวนลิขสิทธิ์',
            explore: 'สำรวจ', company: 'บริษัท', support: 'การสนับสนุน', legal: 'กฎหมาย',
            aboutUs: 'เกี่ยวกับเรา', careers: 'ร่วมงานกับเรา', helpCenter: 'ศูนย์ช่วยเหลือ', getInTouch: 'ติดต่อเรา',
            privacyPolicy: 'นโยบายความเป็นส่วนตัว', termsOfService: 'เงื่อนไขการให้บริการ', cookiePolicy: 'นโยบายคุกกี้',
        },
        features: { headlineWhyChoose: (name) => `ทำไมต้องเลือก ${name}?` },
        stats: { headline: 'ตัวเลขของเรา' },
        team: { headline: 'ทีมงานของเรา', subheadline: 'คนที่อยู่เบื้องหลังความสำเร็จ' },
        serviceCards: { headline: 'บริการของเรา', subheadline: (name) => `ค้นพบสิ่งที่ ${name} ทำได้เพื่อคุณ`, ctaLabel: 'เรียนรู้เพิ่มเติม' },
        clientLogos: { headline: 'ลูกค้าและพันธมิตรที่ไว้วางใจ' },
        gallery: { headline: 'ผลงานของเรา' },
        newsletter: {
            headlineStayUpdated: (name) => `ติดตามข่าวสารจาก ${name}`,
            subheadlineFallback: 'สมัครรับข่าวสารและข้อเสนอพิเศษ',
            subscribeLabel: 'สมัคร',
        },
        pricing: { headline: 'แผนราคา', subheadline: 'ราคาโปร่งใส ไม่มีค่าใช้จ่ายซ่อนเร้น', getStarted: 'เริ่มต้น', learnMore: 'เรียนรู้เพิ่มเติม' },
        testimonials: { headline: 'รีวิวจากลูกค้า', headlineWithBiz: (biz) => `รีวิวลูกค้า ${biz}`, subheadline: 'รีวิวที่แท้จริงจากลูกค้าของเรา' },
    },
}

// ── Runtime block-strings cache ────────────────────────────────────────────────
//
// Populated by block-strings-translator fire-and-forget GPT micro-call for
// languages not in STRINGS seed (long-tail: Tagalog, Tamil, Swahili, etc.).
// Cache miss → current request keeps GPT output; next warm request gets correct strings.

const runtimeBlockStringsCache = new Map<string, BlockStrings>()

/** Inject GPT-translated block strings for a language not in the static seed. */
export function injectBlockStrings(lang: string, strings: BlockStrings): void {
    runtimeBlockStringsCache.set(lang, strings)
}

/**
 * Get block UI strings for any language code (ISO 639-1 or BCP 47).
 * Order: static STRINGS seed → runtime cache → prefix fallback → English.
 */
export function getBlockStrings(lang?: string): BlockStrings {
    if (!lang) return STRINGS.en
    if (STRINGS[lang]) return STRINGS[lang]
    if (runtimeBlockStringsCache.has(lang)) return runtimeBlockStringsCache.get(lang)!
    const prefix = lang.split('-')[0]
    return STRINGS[prefix] ?? runtimeBlockStringsCache.get(prefix) ?? STRINGS.en
}

/**
 * Returns true when there are dedicated i18n strings for this language
 * (static seed or runtime cache — i.e. not the English fallback).
 */
export function hasDedicatedStrings(lang?: string): boolean {
    if (!lang) return false
    if (STRINGS[lang] || runtimeBlockStringsCache.has(lang)) return true
    const prefix = lang.split('-')[0]
    return !!(STRINGS[prefix] || runtimeBlockStringsCache.has(prefix))
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
    contactSubmitLabel: string
    /** Localized prefix for "About [Business]" headlines — replaces English "About " */
    aboutHeadlinePrefix: string
}

const SECTION_LABELS_SEED: Record<string, SectionLabels> = {
    ms: {
        about: 'Tentang Kami',
        gallery: 'Galeri',
        contact: 'Hubungi Kami',
        features: 'Ciri-ciri Perkhidmatan',
        testimonials: 'Ulasan Pelanggan',
        faq: 'Soalan Lazim',
        team: 'Pasukan Kami',
        serviceCards: 'Perkhidmatan Kami',
        stats: 'Pencapaian Kami',
        pricing: 'Harga',
        newsletter: 'Surat Berita',
        clientLogos: 'Dipercayai Oleh',
        blogList: 'Blog',
        contactSubmitLabel: 'Hantar Mesej',
        aboutHeadlinePrefix: 'Tentang',
    },
    vi: {
        about: 'Về Chúng Tôi',
        gallery: 'Thư Viện Ảnh',
        contact: 'Liên Hệ',
        features: 'Dịch Vụ Nổi Bật',
        testimonials: 'Đánh Giá Khách Hàng',
        faq: 'Câu Hỏi Thường Gặp',
        team: 'Đội Ngũ',
        serviceCards: 'Dịch Vụ',
        stats: 'Thành Tích',
        pricing: 'Bảng Giá',
        newsletter: 'Bản Tin',
        clientLogos: 'Đối Tác',
        blogList: 'Blog',
        contactSubmitLabel: 'Gửi Tin Nhắn',
        aboutHeadlinePrefix: 'Về',
    },
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
        contactSubmitLabel: '送信する',
        aboutHeadlinePrefix: '',
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
        contactSubmitLabel: '发送消息',
        aboutHeadlinePrefix: '关于',
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
        contactSubmitLabel: '메시지 보내기',
        aboutHeadlinePrefix: '',
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
        contactSubmitLabel: 'إرسال الرسالة',
        aboutHeadlinePrefix: 'عن',
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
        contactSubmitLabel: 'ส่งข้อความ',
        aboutHeadlinePrefix: 'เกี่ยวกับ',
    },
}

/** Get section labels for the given language code. Returns null for unsupported languages. */
export function getSectionLabels(lang?: string): SectionLabels | null {
    if (!lang) return null
    if (SECTION_LABELS_SEED[lang]) return SECTION_LABELS_SEED[lang]!
    const prefix = lang.split('-')[0]
    return SECTION_LABELS_SEED[prefix] ?? null
}
