export const GH1442_TARGET_LOCALES = ['en', 'ms', 'vi', 'it', 'fr', 'de', 'zh', 'ja'] as const

export type Gh1442TargetLocale = (typeof GH1442_TARGET_LOCALES)[number]

type ReviewedFragments = {
    subjects: readonly string[]
    products: readonly string[]
    descriptions: readonly string[]
}

const REVIEWED_FRAGMENTS: Record<Gh1442TargetLocale, ReviewedFragments> = {
    en: {
        subjects: ['Golden Hair', 'Blue Door', 'Morning Bloom', 'Urban Thread', 'Happy Hands', 'Little Corner', 'Silver Spoon', 'Bright Future', 'Green Garden', 'Sunrise Flowers'],
        products: ['hair cuts and styling', 'fresh bread and cakes', 'flowers and bouquets', 'dental family care', 'learning classes for kids', 'garden landscaping', 'coffee and breakfast', 'clothing and accessories', 'business consulting', 'toys and games'],
        descriptions: ['custom cuts styling', 'colorful blooms bouquets', 'play and learn toys', 'beautiful yards landscaping', 'friendly local team', 'quality work daily', 'modern family care', 'creative ideas delivered', 'simple honest value', 'trusted neighborhood choice'],
    },
    ms: {
        subjects: ['Kedai Murni', 'Warung Keluarga', 'Restoran Harmoni', 'Klinik Sentosa', 'Butik Anggun', 'Syarikat Maju', 'Perniagaan Jaya', 'Jenama Tempatan', 'Kedai Runcit', 'Warung Seri'],
        products: ['makanan dan minuman segar', 'pakaian moden tempatan', 'perkhidmatan pergigian', 'barangan runcit harian', 'perabot rumah berkualiti', 'khidmat perniagaan', 'jualan produk tempatan', 'kecantikan dan penjagaan', 'keperluan keluarga', 'makanan tradisional'],
        descriptions: ['makanan segar setiap hari', 'produk berkualiti untuk pelanggan', 'perkhidmatan terbaik tempatan', 'jualan murah dan berkualiti', 'menyediakan keperluan keluarga', 'pakaian cantik harga berpatutan', 'perabot rumah berkualiti', 'khidmat profesional untuk anda', 'barangan runcit pilihan ramai', 'pergigian moden dan selesa'],
    },
    vi: {
        subjects: ['Tiệm Bánh Hoa Mai', 'Quán Phở Hà Nội', 'Cửa Hàng Việt', 'Nhà Thuốc An Tâm', 'Bún Bò Huế', 'Tiệm Hoa Tươi', 'Dịch Vụ Minh Tâm', 'Sản Phẩm Việt Nam', 'Quán Cơm Gia Đình', 'Tiệm Làm Đẹp'],
        products: ['bánh ngọt và cà phê', 'phở bò truyền thống', 'thuốc và chăm sóc sức khỏe', 'hoa tươi mỗi ngày', 'dịch vụ làm đẹp', 'cơm gia đình', 'sản phẩm thủ công', 'giao hàng thành phố', 'chăm sóc khách hàng', 'đồ uống tươi ngon'],
        descriptions: ['bánh ngọt thơm ngon mỗi ngày', 'phục vụ khách hàng tận tâm', 'sản phẩm mới và tốt nhất', 'món ăn tươi ngon truyền thống', 'dịch vụ chuyên nghiệp uy tín', 'không gian đẹp và thoải mái', 'hương vị đậm đà khó quên', 'chăm sóc tận tình chu đáo', 'lựa chọn chất lượng cho nhà bạn', 'giao hàng nhanh trong thành phố'],
    },
    it: {
        subjects: ['Ristorante Italiano', 'Gelateria Roma', 'Cucina Tradizionale', 'Dolci Firenze', 'Pane Fresco', 'Negozio Italiano', 'Azienda Artigianale', 'Prodotti Milano', 'Specialita Toscana', 'Benvenuti Italia'],
        products: ['gelato artigianale', 'pane fresco e dolci', 'cucina italiana', 'prodotti locali', 'birra e specialita', 'servizi per famiglie', 'scarpe artigianali', 'pasta tradizionale', 'caffe italiano', 'prodotti di qualita'],
        descriptions: ['ottimi dolci e birra', 'cucina italiana autentica', 'prodotti artigianali di qualita', 'pane fresco ogni giorno', 'servizi migliori per clienti', 'tradizione e autenticita italiana', 'gelateria con specialita fresche', 'negozio di prodotti italiani', 'ristorante con cucina tradizionale', 'azienda italiana di qualita'],
    },
    fr: {
        subjects: ['Boulangerie Paris', 'Cuisine Française', 'Patisserie Lyon', 'Croissant Maison', 'Produits Artisanaux', 'Bonjour Provence', 'Entreprise Locale', 'Terroir Français', 'Bienvenue Nice', 'Plats Traditionnels'],
        products: ['chaussures pour femmes', 'pain frais et croissants', 'cuisine du terroir', 'produits artisanaux', 'services professionnels', 'patisserie maison', 'cafe et petit déjeuner', 'plats pour familles', 'conseils aux entreprises', 'produits locaux'],
        descriptions: ['café croissant délicieux', 'cuisine traditionnelle française', 'produits artisanaux de qualité', 'boulangerie fraîche quotidienne', 'meilleurs plats du terroir', 'patisserie délicieuse pour tous', 'services professionnels locaux', 'bienvenue dans notre entreprise', 'croissant artisanal chaque matin', 'tradition française authentique'],
    },
    de: {
        subjects: ['Frisches Brot', 'Bäckerei Berlin', 'Deutsches Geschäft', 'Traditionelle Küche', 'Beste Produkte', 'Unternehmen Hamburg', 'Frische Bäckerei', 'Qualität München', 'Dienstleistungen Köln', 'Traditionell Dresden'],
        products: ['Schuhe für Familien', 'frisches Brot und Gebäck', 'deutsche Küche', 'hochwertige Produkte', 'Beratung für Unternehmen', 'Kaffee und Kuchen', 'lokale Dienstleistungen', 'traditionelle Speisen', 'moderne Kleidung', 'Produkte für Zuhause'],
        descriptions: ['frisches Brot täglich', 'beste Qualität und Produkte', 'traditionelle deutsche Bäckerei', 'Dienstleistungen für Unternehmen', 'frische Produkte jeden Tag', 'Geschäft mit bester Qualität', 'Brot und Gebäck traditionell', 'deutsches Unternehmen mit Service', 'Produkte frisch und hochwertig', 'Bäckerei mit langer Tradition'],
    },
    zh: {
        subjects: ['北京传统餐厅', '上海精品咖啡', '广州新鲜面包', '深圳现代设计', '杭州特色茶馆', '成都美味火锅', '南京健康诊所', '武汉优质服务', '西安文化书店', '苏州手工甜品'],
        products: ['传统美食和饮料', '新鲜面包和蛋糕', '专业健康服务', '本地特色产品', '家庭餐饮服务', '现代设计方案', '精品咖啡和茶', '手工甜品礼盒', '文化书籍用品', '优质客户服务'],
        descriptions: ['每天提供新鲜美味食品', '传统工艺优质产品', '专业团队贴心服务', '本地客户信赖品牌', '健康生活美好选择', '精选材料用心制作', '现代空间舒适体验', '家庭经营诚信可靠', '欢迎品尝特色美食', '高品质服务每一天'],
    },
    ja: {
        subjects: ['さくらラーメン東京', 'おいしい寿司大阪', '京都の和菓子店', 'ひかり美容室', 'なごみ歯科医院', 'みどり花屋', 'しあわせパン工房', 'まごころ食堂', 'つばさ学習教室', 'こもれびカフェ'],
        products: ['新鮮なラーメンと餃子', '寿司と日本料理', '手作り和菓子', '美容とヘアケア', '家族の歯科診療', '季節の花とギフト', '焼きたてパン', '家庭料理と飲み物', '子どもの学習教室', 'コーヒーとケーキ'],
        descriptions: ['毎日おいしい料理を提供します', '新鮮な材料で丁寧に作ります', '地域のお客様に愛される店です', '伝統と品質を大切にします', '家族で楽しめるサービスです', '専門スタッフが対応します', '心を込めた商品を届けます', '明るく快適な空間です', '東京で人気のお店です', '安心できる地域サービスです'],
    },
}

export type Gh1442CorpusSample = {
    expectedLocale: Gh1442TargetLocale
    input: {
        businessName: string
        industry: string
        products: string
        shortDescription: string
    }
}

const INDUSTRIES = ['food-beverage', 'retail', 'professional-services', 'health-wellness'] as const

export const GH1442_ACCURACY_CORPUS: Record<Gh1442TargetLocale, Gh1442CorpusSample[]> =
    Object.fromEntries(GH1442_TARGET_LOCALES.map((locale) => {
        const fragments = REVIEWED_FRAGMENTS[locale]
        const samples = fragments.subjects.flatMap((businessName, subjectIndex) =>
            fragments.descriptions.map((shortDescription, descriptionIndex) => ({
                expectedLocale: locale,
                input: {
                    businessName,
                    industry: INDUSTRIES[(subjectIndex + descriptionIndex) % INDUSTRIES.length],
                    products: fragments.products[(subjectIndex * 3 + descriptionIndex) % fragments.products.length],
                    shortDescription,
                },
            })),
        )
        return [locale, samples]
    })) as Record<Gh1442TargetLocale, Gh1442CorpusSample[]>
