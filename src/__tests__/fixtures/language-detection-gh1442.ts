export const GH1442_TARGET_LOCALES = ['en', 'ms', 'vi', 'it', 'fr', 'de', 'zh', 'ja'] as const

export type Gh1442TargetLocale = (typeof GH1442_TARGET_LOCALES)[number]

type ReviewedFragments = {
    subjects: readonly string[]
    products: readonly string[]
    descriptions: readonly string[]
}

const ROBUSTNESS_FRAGMENTS: Record<Gh1442TargetLocale, ReviewedFragments> = {
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

export type Gh1442HeldOutSample = Gh1442CorpusSample

export const GH1442_HELD_OUT_FULL_FORM_CASES: Record<Gh1442TargetLocale, Gh1442HeldOutSample[]> = {
    en: [
        { expectedLocale: 'en', input: { businessName: 'Northside Workshop', industry: 'professional-services', products: 'custom furniture restoration', shortDescription: 'Independent craftspeople restoring treasured pieces for modern homes' } },
        { expectedLocale: 'en', input: { businessName: 'Harbor Legal', industry: 'professional-services', products: 'contracts and compliance advice', shortDescription: 'Practical guidance for growing companies and independent founders' } },
        { expectedLocale: 'en', input: { businessName: 'Willow Pet Care', industry: 'health-wellness', products: 'grooming boarding and walking', shortDescription: 'Compassionate neighborhood care for dogs and cats of every size' } },
        { expectedLocale: 'en', input: { businessName: 'Peak Cycle Works', industry: 'retail', products: 'bicycles helmets and maintenance', shortDescription: 'Experienced mechanics helping riders enjoy every journey' } },
        { expectedLocale: 'en', input: { businessName: 'Copper Table', industry: 'food-beverage', products: 'seasonal lunches and private dining', shortDescription: 'Thoughtful cooking made with ingredients from nearby farms' } },
    ],
    ms: [
        { expectedLocale: 'ms', input: { businessName: 'Dapur Seri Wangi', industry: 'food-beverage', products: 'hidangan kampung dan pencuci mulut', shortDescription: 'Masakan keluarga disediakan dengan bahan pilihan setiap pagi' } },
        { expectedLocale: 'ms', input: { businessName: 'Bengkel Roda Maju', industry: 'professional-services', products: 'pembaikan motosikal dan alat ganti', shortDescription: 'Mekanik berpengalaman membantu penunggang dengan pantas dan jujur' } },
        { expectedLocale: 'ms', input: { businessName: 'Taman Ilmu Ceria', industry: 'education', products: 'kelas membaca dan matematik', shortDescription: 'Pembelajaran mesra untuk membina keyakinan kanak-kanak' } },
        { expectedLocale: 'ms', input: { businessName: 'Laman Hijau', industry: 'professional-services', products: 'reka bentuk taman dan penyelenggaraan', shortDescription: 'Mewujudkan ruang luar yang indah untuk kediaman anda' } },
        { expectedLocale: 'ms', input: { businessName: 'Jahit Kasih', industry: 'retail', products: 'tempahan pakaian dan ubah suai', shortDescription: 'Hasil jahitan kemas mengikut ukuran serta gaya pilihan' } },
    ],
    vi: [
        { expectedLocale: 'vi', input: { businessName: 'Mộc An Nhiên', industry: 'retail', products: 'nội thất gỗ theo yêu cầu', shortDescription: 'Thợ lành nghề tạo nên không gian ấm cúng cho từng gia đình' } },
        { expectedLocale: 'vi', input: { businessName: 'Bếp Nhà Mình', industry: 'food-beverage', products: 'mâm cơm và món quê', shortDescription: 'Nguyên liệu theo mùa được nấu kỹ lưỡng như bữa ăn tại nhà' } },
        { expectedLocale: 'vi', input: { businessName: 'Học Viện Mầm Xanh', industry: 'education', products: 'lớp đọc sách và tư duy', shortDescription: 'Đồng hành cùng trẻ phát triển sự tự tin và óc sáng tạo' } },
        { expectedLocale: 'vi', input: { businessName: 'Gốm Mây', industry: 'retail', products: 'bình hoa và đồ dùng thủ công', shortDescription: 'Mỗi sản phẩm được hoàn thiện bằng đôi tay của nghệ nhân địa phương' } },
        { expectedLocale: 'vi', input: { businessName: 'Sống Khỏe', industry: 'health-wellness', products: 'tư vấn dinh dưỡng và vận động', shortDescription: 'Lộ trình phù hợp giúp bạn duy trì thói quen bền vững' } },
    ],
    it: [
        { expectedLocale: 'it', input: { businessName: 'Officina del Gusto', industry: 'food-beverage', products: 'pranzi stagionali e catering', shortDescription: 'Ingredienti selezionati dai produttori della regione per ricette sincere' } },
        { expectedLocale: 'it', input: { businessName: 'Studio Aurora', industry: 'professional-services', products: 'progettazione di interni', shortDescription: 'Spazi funzionali pensati intorno alle abitudini delle persone' } },
        { expectedLocale: 'it', input: { businessName: 'Ruote Libere', industry: 'retail', products: 'biciclette accessori e manutenzione', shortDescription: 'Tecnici esperti accompagnano ogni ciclista nella scelta giusta' } },
        { expectedLocale: 'it', input: { businessName: 'Piccoli Passi', industry: 'education', products: 'laboratori creativi per bambini', shortDescription: 'Attività coinvolgenti favoriscono curiosità autonomia e collaborazione' } },
        { expectedLocale: 'it', input: { businessName: 'Erbe e Benessere', industry: 'health-wellness', products: 'consulenze naturali e massaggi', shortDescription: 'Percorsi personalizzati dedicati al riposo e alla vitalità quotidiana' } },
    ],
    fr: [
        { expectedLocale: 'fr', input: { businessName: 'Atelier du Rivage', industry: 'retail', products: 'meubles restaurés sur mesure', shortDescription: 'Des artisans passionnés redonnent vie aux objets de votre famille' } },
        { expectedLocale: 'fr', input: { businessName: 'Le Jardin Partagé', industry: 'professional-services', products: 'aménagement extérieur et entretien', shortDescription: 'Nous imaginons des espaces vivants adaptés à chaque saison' } },
        { expectedLocale: 'fr', input: { businessName: 'Cabinet Horizon', industry: 'professional-services', products: 'accompagnement juridique des entreprises', shortDescription: 'Des réponses claires pour prendre des décisions avec confiance' } },
        { expectedLocale: 'fr', input: { businessName: 'Petits Explorateurs', industry: 'education', products: 'ateliers scientifiques pour enfants', shortDescription: 'Les expériences éveillent la curiosité dans une ambiance bienveillante' } },
        { expectedLocale: 'fr', input: { businessName: 'La Table des Saisons', industry: 'food-beverage', products: 'déjeuners et événements privés', shortDescription: 'Le chef travaille avec des producteurs proches de la ville' } },
    ],
    de: [
        { expectedLocale: 'de', input: { businessName: 'Werkraum Nord', industry: 'professional-services', products: 'Möbelrestaurierung nach Maß', shortDescription: 'Erfahrene Handwerker bewahren Lieblingsstücke für kommende Generationen' } },
        { expectedLocale: 'de', input: { businessName: 'Gartenzeit', industry: 'professional-services', products: 'Planung und Pflege von Außenanlagen', shortDescription: 'Wir gestalten lebendige Orte passend zu Haus und Jahreszeit' } },
        { expectedLocale: 'de', input: { businessName: 'Kleine Forscher', industry: 'education', products: 'Naturwissenschaftliche Kurse für Kinder', shortDescription: 'Spannende Versuche fördern Neugier und gemeinsames Entdecken' } },
        { expectedLocale: 'de', input: { businessName: 'Radpunkt', industry: 'retail', products: 'Fahrräder Zubehör und Reparaturen', shortDescription: 'Unsere Mechaniker finden zuverlässige Lösungen für jede Strecke' } },
        { expectedLocale: 'de', input: { businessName: 'Jahreszeiten Küche', industry: 'food-beverage', products: 'Mittagessen und Feiern', shortDescription: 'Der Küchenchef verarbeitet Zutaten von Höfen aus der Umgebung' } },
    ],
    zh: [
        { expectedLocale: 'zh', input: { businessName: '山海木作', industry: 'retail', products: '定制家具与旧物修复', shortDescription: '经验丰富的工匠为每个家庭打造耐用温暖的生活空间' } },
        { expectedLocale: 'zh', input: { businessName: '四季小馆', industry: 'food-beverage', products: '时令午餐与家庭聚会', shortDescription: '厨师选用附近农场的食材认真烹制每一道菜' } },
        { expectedLocale: 'zh', input: { businessName: '星光学堂', industry: 'education', products: '儿童阅读与科学课程', shortDescription: '有趣的实践活动帮助孩子建立好奇心和自信' } },
        { expectedLocale: 'zh', input: { businessName: '青禾花园', industry: 'professional-services', products: '庭院设计与日常维护', shortDescription: '我们根据季节和居住习惯创造自然舒适的户外环境' } },
        { expectedLocale: 'zh', input: { businessName: '安心伙伴', industry: 'professional-services', products: '企业合同与合规咨询', shortDescription: '清晰务实的建议帮助创业者稳健做出重要决定' } },
    ],
    ja: [
        { expectedLocale: 'ja', input: { businessName: '海辺の工房', industry: 'retail', products: '家具の修理と注文制作', shortDescription: '熟練の職人が家族の大切な品を丁寧に生まれ変わらせます' } },
        { expectedLocale: 'ja', input: { businessName: '四季の食卓', industry: 'food-beverage', products: '季節のランチと貸切料理', shortDescription: '近くの農家から届く食材で心を込めて調理します' } },
        { expectedLocale: 'ja', input: { businessName: 'ひらめき教室', industry: 'education', products: '子ども向け科学と読書講座', shortDescription: '楽しい体験を通して好奇心と自信を育てます' } },
        { expectedLocale: 'ja', input: { businessName: '緑の庭', industry: 'professional-services', products: '庭づくりと定期管理', shortDescription: '暮らしと季節に合う自然で落ち着いた空間を提案します' } },
        { expectedLocale: 'ja', input: { businessName: '街の自転車店', industry: 'retail', products: '自転車用品と修理', shortDescription: '経験豊かな整備士が毎日の安全な移動を支えます' } },
    ],
}

const INDUSTRIES = ['food-beverage', 'retail', 'professional-services', 'health-wellness'] as const

export const GH1442_ACCURACY_CORPUS: Record<Gh1442TargetLocale, Gh1442CorpusSample[]> =
    Object.fromEntries(GH1442_TARGET_LOCALES.map((locale) => {
        const fragments = ROBUSTNESS_FRAGMENTS[locale]
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
