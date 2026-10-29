import type { CategoryContent } from './types'

export const techContent: CategoryContent = {
  category: 'tech',
  locale: 'en-MY',
  businesses: [
    {
      name: 'CloudSync Solutions',
      tagline: 'Cloud Infrastructure for Businesses',
      description:
        'CloudSync Solutions provides managed cloud services for SMEs, including hosting, SSL, backups, load balancing, and dedicated infrastructure plans.',
      address: 'Level 18, Menara TM, Jalan Pantai Baharu, 59200 Kuala Lumpur',
      phone: '+60 3-2240 1100',
      email: 'sales@cloudsync.my',
      heroHeadline: 'Cloud Made Simple for Your Business',
      heroSubheadline:
        'Managed hosting, backups, and support plans.',
    },
    {
      name: 'Raj Kumar Software',
      tagline: 'Custom Software for Your Business',
      description:
        'Raj Kumar Software builds custom web and mobile applications, starting with a discovery workshop to define your product roadmap, plus ongoing maintenance.',
      address: 'Unit 8-3, Menara CIMB, Jalan Stesen Sentral 2, KL Sentral, 50470 Kuala Lumpur',
      phone: '+60 3-2773 8800',
      email: 'hello@rajkumarsoft.my',
      heroHeadline: 'Custom Software Built for Your Business',
      heroSubheadline:
        'Web apps, mobile apps, and systems, from idea to deployment.',
    },
    {
      name: 'Danny Tan Digital',
      tagline: 'Digital Marketing Agency',
      description:
        'Danny Tan Digital is a digital marketing agency offering SEO, search advertising management, and social media management.',
      address: 'No. 22, Jalan PJU 1/43, Aman Suria, 47301 Petaling Jaya',
      phone: '+60 12-366 9900',
      email: 'grow@dannytandigital.my',
      heroHeadline: 'Grow Your Business Online',
      heroSubheadline:
        'SEO, search advertising, and social media marketing.',
    },
    {
      name: 'PayEasy Fintech',
      tagline: 'Payment Solutions for Businesses',
      description:
        'PayEasy provides payment integration for businesses, supporting online banking, cards, eWallets, and QR payments from a single dashboard.',
      address: 'Level 25, Menara Prudential, Tun Razak Exchange, 55188 Kuala Lumpur',
      phone: '+60 3-2181 5500',
      email: 'partner@payeasy.my',
      heroHeadline: 'Accept Payments Online',
      heroSubheadline:
        'Online banking, cards, eWallets, and QR payments in one integration.',
    },
    {
      name: 'CyberShield MY',
      tagline: 'Cybersecurity for Enterprises',
      description:
        'CyberShield provides cybersecurity services including penetration testing, vulnerability assessment, security monitoring, and data protection compliance consulting.',
      address: 'Unit 12-01, Wisma Mont Kiara, Jalan Kiara, 50480 Kuala Lumpur',
      phone: '+60 3-6206 7700',
      email: 'secure@cybershield.my',
      heroHeadline: 'Protect Your Business from Cyber Threats',
      heroSubheadline:
        'Penetration testing, security monitoring, and compliance consulting.',
    },
  ],
  testimonials: [],
  faqItems: [],
  industryBlocks: [
    {
      blockType: 'pricing-table',
      variant: 'three-tier',
      title: 'Choose Your Plan',
      currency: 'RM',
      billingPeriod: 'month',
      tiers: ['Starter', 'Business', 'Enterprise'],
      showAnnualToggle: false,
    },
    {
      blockType: 'stats-counter',
      variant: 'horizontal',
      title: 'Our Approach',
      stats: [],
    },
  ],
}
