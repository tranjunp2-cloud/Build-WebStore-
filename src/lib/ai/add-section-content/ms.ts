/**
 * BM (Bahasa Melayu) default content for locale-aware block defaults.
 * Hand-authored natural Bahasa Melayu for Malaysian SME websites.
 * Keys and structure mirror en.ts exactly. {brand} token replaced at runtime.
 */
export const BLOCK_CONTENT_MS = {
    hero: {
        headline: 'Selamat Datang ke {brand}',
        subheadline:
            'Kami menyediakan produk dan perkhidmatan terbaik untuk membantu anda mencapai matlamat. Temui apa yang membezakan kami.',
        ctaButtons: [
            { label: 'Mula Sekarang', url: '#contact', style: 'primary' },
            { label: 'Ketahui Lagi', url: '#about', style: 'outline' },
        ],
    },

    features: {
        sectionLabelBase: 'Kenapa Pilih Kami',
        headline: 'Kenapa pelanggan pilih {brand}',
        subheadline: 'Tiga sebab kukuh untuk mempercayai tawaran ini.',
        items: [
            { icon: '⚡', title: 'Mudah Difahami', description: 'Terangkan tawaran dengan jelas supaya pelawat terus faham nilai yang ditawarkan.' },
            { icon: '🛡️', title: 'Dibina atas Kepercayaan', description: 'Yakinkan pelawat dengan ketekalan, bukti, dan kedudukan yang kukuh.' },
            { icon: '🎯', title: 'Direka untuk Hasil', description: 'Pimpin pelawat ke langkah seterusnya dengan mesej yang mudah dan fokus.' },
        ],
    },

    faq: {
        headline: 'Soalan Lazim tentang {brand}',
        items: [
            {
                question: 'Apakah yang membezakan {brand}?',
                answer: '{brand} mengutamakan nilai yang jelas, penyampaian yang sempurna, dan pengalaman pelanggan yang lebih baik sejak interaksi pertama.',
            },
            {
                question: 'Berapa cepat saya boleh bermula?',
                answer: 'Kebanyakan pelanggan boleh bermula dengan segera selepas konsultasi atau langkah onboarding yang ringkas.',
            },
            {
                question: 'Adakah anda menawarkan sokongan selepas pembelian?',
                answer: 'Ya. Kami terus menyokong pelanggan dengan panduan, kemas kini, dan komunikasi yang responsif.',
            },
        ],
    },

    testimonials: {
        headline: 'Apa kata pelanggan tentang {brand}',
        quoteTemplate: 'Ulasan {n} untuk {brand}. Gantikan ini dengan cerita pelanggan sebenar.',
        nameTemplate: 'Pelanggan {n}',
        title: 'Pelanggan Setia',
    },

    team: {
        headline: 'Berkenalan dengan pasukan di sebalik {brand}',
        members: [
            { name: 'Ahli Pasukan 1', role: 'Pengasas', bio: 'Tambahkan pengenalan ringkas pengasas di sini.' },
            { name: 'Ahli Pasukan 2', role: 'Ketua Operasi', bio: 'Tonjolkan kecemerlangan operasi harian.' },
            { name: 'Ahli Pasukan 3', role: 'Kejayaan Pelanggan', bio: 'Tunjukkan sisi kemanusiaan jenama anda.' },
        ],
    },

    newsletter: {
        headline: 'Kekal Dikemaskini bersama {brand}',
        subheadline: 'Dapatkan kemas kini, tawaran, dan tips berguna terus ke peti masuk anda.',
        buttonLabel: 'Langgan',
        placeholder: 'Masukkan e-mel anda',
    },

    cta: {
        headline: 'Bersedia untuk melangkah bersama {brand}?',
        subheadline: 'Gunakan bahagian ini untuk menonjolkan tawaran atau kempen terbaik anda.',
        ctaLabel: 'Mulakan',
    },

    contact: {
        headline: 'Hubungi Kami',
        subtext: 'Ada soalan atau ingin bekerjasama? Kami berbesar hati mendengar daripada anda.',
        formFields: [
            { fieldName: 'name', label: 'Nama Anda', fieldType: 'text', required: true },
            { fieldName: 'email', label: 'Alamat E-mel', fieldType: 'email', required: true },
            { fieldName: 'message', label: 'Mesej', fieldType: 'textarea', required: true },
        ],
    },

    pricing: {
        headline: 'Harga Mudah dan Telus',
        subheadline: 'Pilih pakej yang paling sesuai untuk anda.',
        plans: [
            { name: 'Asas', price: 'RM 39/bln', description: 'Sesuai untuk permulaan', features: [{ text: '5 Projek', included: true }, { text: 'Sokongan Asas', included: true }, { text: 'Ciri Lanjutan', included: false }], ctaLabel: 'Mulakan', ctaUrl: '#' },
            { name: 'Pro', price: 'RM 119/bln', description: 'Terbaik untuk perniagaan berkembang', isPopular: true, features: [{ text: 'Projek Tanpa Had', included: true }, { text: 'Sokongan Keutamaan', included: true }, { text: 'Ciri Lanjutan', included: true }], ctaLabel: 'Mulakan', ctaUrl: '#' },
            { name: 'Perusahaan', price: 'RM 399/bln', description: 'Untuk organisasi besar', features: [{ text: 'Semua dalam Pro', included: true }, { text: 'Pengurus Berdedikasi', included: true }, { text: 'Integrasi Khusus', included: true }], ctaLabel: 'Hubungi Kami', ctaUrl: '#' },
        ],
    },

    stats: {
        headline: '{brand} dalam Angka',
        items: [
            { value: '10K+', label: 'Pelanggan Berpuas Hati' },
            { value: '50+', label: 'Negara Dilayan' },
            { value: '99%', label: 'Kadar Kepuasan' },
            { value: '24/7', label: 'Sokongan Tersedia' },
        ],
    },

    accordion: {
        headline: 'Maklumat Lanjut',
        items: [
            { title: 'Apakah perkhidmatan yang anda tawarkan?', content: '{brand} menyediakan penyelesaian menyeluruh yang disesuaikan dengan keperluan anda.' },
            { title: 'Bagaimana saya boleh bermula?', content: 'Hubungi kami melalui borang di atas atau hubungi kami terus.' },
            { title: 'Apakah waktu operasi anda?', content: 'Kami beroperasi dari Isnin hingga Jumaat, 9 pagi hingga 6 petang.' },
        ],
    },

    'service-cards': {
        headline: 'Perkhidmatan Kami',
        subheadline: 'Apa yang {brand} boleh lakukan untuk anda.',
        services: [
            { title: 'Rekabentuk Web', description: 'Laman web yang cantik dan responsif untuk menukar pelawat menjadi pelanggan.', icon: '🎨', price: 'Dari RM 1,500', priceUnit: '/projek' },
            { title: 'Pengoptimuman SEO', description: 'Dijumpai di Google dengan strategi SEO berasaskan data.', icon: '🔍', price: 'Dari RM 500', priceUnit: '/bulan' },
            { title: 'Media Sosial', description: 'Kembangkan audiens anda dengan kandungan media sosial yang menarik.', icon: '📱', price: 'Dari RM 800', priceUnit: '/bulan' },
        ],
    },

    about: {
        sectionLabelBase: 'Tentang Kami',
        headline: 'Kisah Kami',
        body: '{brand} ditubuhkan dengan misi yang mudah: menyampaikan kualiti dan nilai kepada setiap pelanggan. Dengan pengalaman bertahun-tahun dan pasukan yang berdedikasi, kami terus berkembang dan berinovasi.',
    },

    gallery: {
        headline: '{brand} dalam Aksi',
    },

    products: {
        headline: 'Produk Kami',
        subheadline: 'Terokai koleksi pilihan kami.',
    },
} as const
