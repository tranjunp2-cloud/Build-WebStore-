import type { CategoryContent } from './types'

export const techContent: CategoryContent = {
  category: 'tech',
  locale: 'en-MY',
  businesses: [
    {
      name: 'CloudSync Solutions',
      tagline: 'Cloud Infrastructure for Malaysian Businesses',
      description:
        'CloudSync Solutions provides managed cloud services tailored for Malaysian SMEs. Our Starter plan (RM 99/mo) includes hosting, SSL, and daily backups. Business plan (RM 299/mo) adds load balancing and 24/7 support. Enterprise (RM 499/mo) includes dedicated infrastructure and SLA guarantees.',
      address: 'Level 18, Menara TM, Jalan Pantai Baharu, 59200 Kuala Lumpur',
      phone: '+60 3-2240 1100',
      email: 'sales@cloudsync.my',
      heroHeadline: 'Cloud Made Simple for Malaysian Businesses',
      heroSubheadline:
        'Managed hosting, backups, and 24/7 support — starting from just RM 99/month.',
    },
    {
      name: 'Raj Kumar Software',
      tagline: 'Custom Software That Solves Real Problems',
      description:
        'Raj Kumar Software builds custom web and mobile applications for businesses across Malaysia. Our discovery workshop (RM 2,500) helps define your product roadmap. Full-stack development starts from RM 15,000 per project, with ongoing maintenance from RM 1,500/month.',
      address: 'Unit 8-3, Menara CIMB, Jalan Stesen Sentral 2, KL Sentral, 50470 Kuala Lumpur',
      phone: '+60 3-2773 8800',
      email: 'hello@rajkumarsoft.my',
      heroHeadline: 'Custom Software Built for Your Business',
      heroSubheadline:
        'From idea to deployment — we build web apps, mobile apps, and systems that scale with your growth.',
    },
    {
      name: 'Danny Tan Digital',
      tagline: 'Digital Marketing That Delivers ROI',
      description:
        'Danny Tan Digital is a performance-driven digital marketing agency. Our SEO package starts at RM 1,500/month, Google Ads management from RM 800/month + ad spend, and social media management from RM 1,200/month. We have helped over 200 Malaysian businesses grow online.',
      address: 'No. 22, Jalan PJU 1/43, Aman Suria, 47301 Petaling Jaya',
      phone: '+60 12-366 9900',
      email: 'grow@dannytandigital.my',
      heroHeadline: 'Grow Your Business Online, the Smart Way',
      heroSubheadline:
        'SEO, Google Ads, and social media marketing — data-driven strategies that deliver real results.',
    },
    {
      name: 'PayEasy Fintech',
      tagline: 'Payment Solutions for Modern Malaysia',
      description:
        'PayEasy provides seamless payment integration for Malaysian businesses. Accept FPX, credit cards, eWallets, and DuitNow QR from a single dashboard. Setup fee: RM 0. Transaction fee: 1.5% per transaction. Same-day settlement available for Enterprise accounts.',
      address: 'Level 25, Menara Prudential, Tun Razak Exchange, 55188 Kuala Lumpur',
      phone: '+60 3-2181 5500',
      email: 'partner@payeasy.my',
      heroHeadline: 'Accept Every Payment, Everywhere',
      heroSubheadline:
        'FPX, cards, eWallets, DuitNow — one integration, zero setup fees, same-day settlement.',
    },
    {
      name: 'CyberShield MY',
      tagline: 'Cybersecurity for Malaysian Enterprises',
      description:
        'CyberShield provides comprehensive cybersecurity services including penetration testing (from RM 5,000), vulnerability assessment (RM 3,000), SOC monitoring (RM 2,500/month), and PDPA compliance consulting (RM 8,000). Trusted by over 50 Malaysian enterprises.',
      address: 'Unit 12-01, Wisma Mont Kiara, Jalan Kiara, 50480 Kuala Lumpur',
      phone: '+60 3-6206 7700',
      email: 'secure@cybershield.my',
      heroHeadline: 'Protect Your Business from Cyber Threats',
      heroSubheadline:
        'Penetration testing, SOC monitoring, and PDPA compliance — trusted by 50+ Malaysian enterprises.',
    },
  ],
  testimonials: [
    {
      name: 'Amirul Hakim',
      title: 'CTO',
      company: 'FoodTech Sdn Bhd',
      rating: 5,
      quote:
        'CloudSync migrated our entire infrastructure with zero downtime. The RM 299/month Business plan gives us peace of mind with 24/7 support. Best investment we made this year.',
    },
    {
      name: 'Jenny Lim',
      title: 'Founder',
      company: 'ShopLocal MY',
      rating: 5,
      quote:
        'Danny Tan Digital transformed our online presence. Within 3 months, our organic traffic grew 180% and our Google Ads ROAS went from 2x to 5.5x. Worth every ringgit.',
    },
    {
      name: 'Suresh Naidu',
      title: 'CFO',
      company: 'KL Trading Group',
      rating: 4,
      quote:
        'PayEasy integration was straightforward — our developer had it running in 2 days. The 1.5% transaction fee is competitive, and same-day settlement helps our cash flow tremendously.',
    },
    {
      name: 'Dr. Farah Zainal',
      title: 'CEO',
      company: 'MedTech Solutions',
      rating: 5,
      quote:
        'CyberShield helped us achieve PDPA compliance ahead of the deadline. Their team identified 23 vulnerabilities we did not know existed. Critical service for any company handling customer data.',
    },
  ],
  faqItems: [
    {
      question: 'Do you offer free consultations?',
      answer:
        'Yes, we offer a free 30-minute discovery call for all new clients. This helps us understand your requirements and recommend the best solution. Book through our website or WhatsApp us directly.',
    },
    {
      question: 'What technologies do you work with?',
      answer:
        'We specialise in modern web technologies including React, Next.js, Node.js, and Python. For mobile, we use React Native and Flutter. Our cloud infrastructure runs on AWS, Google Cloud, and DigitalOcean.',
    },
    {
      question: 'Do you provide ongoing support after project delivery?',
      answer:
        'Absolutely. All projects include 3 months of bug-fix support at no additional charge. After that, maintenance plans start from RM 1,500/month covering updates, monitoring, and priority support.',
    },
    {
      question: 'Are you MDEC-certified?',
      answer:
        'Yes, we are a MDEC-certified MSC Status company. This means our clients may be eligible for tax incentives and grants under the Malaysia Digital initiative. We can help guide you through the application process.',
    },
  ],
  industryBlocks: [
    {
      blockType: 'pricing-table',
      variant: 'three-tier',
      title: 'Choose Your Plan',
      currency: 'RM',
      billingPeriod: 'month',
      tiers: ['Starter', 'Business', 'Enterprise'],
      highlightTier: 'Business',
      showAnnualToggle: true,
    },
    {
      blockType: 'stats-counter',
      variant: 'horizontal',
      title: 'Trusted by Malaysian Businesses',
      stats: [
        { label: 'Clients Served', value: 200 },
        { label: 'Uptime', value: '99.9%' },
        { label: 'Support Response', value: '<15min' },
      ],
    },
  ],
}
