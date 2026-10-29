import type { CategoryContent } from './types'

export const businessContent: CategoryContent = {
  category: 'business',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Dato\' Rahman Consulting Group',
      tagline: 'Strategic Advisory for Malaysian Enterprises',
      description:
        'Dato\' Rahman Consulting Group provides advisory services to mid-market and enterprise clients, including strategy consulting, market entry advisory, M&A due diligence, and board advisory.',
      address: 'Level 35, Menara Maxis, Kuala Lumpur City Centre, 50088 Kuala Lumpur',
      phone: '+60 3-2382 8800',
      email: 'advisory@datrahman.my',
      heroHeadline: 'Strategic Counsel for Business Leaders',
      heroSubheadline:
        'M&A advisory, market entry strategy, and board consulting.',
    },
    {
      name: 'Marcus & Co Accountants',
      tagline: 'Accounting, Tax & Compliance Made Easy',
      description:
        'Marcus & Co is an accounting firm serving SMEs, with audit, tax filing, company secretary services, and SST registration and filing, so you can focus on running your business.',
      address: 'No. 6, Jalan SS15/4, SS15, 47500 Subang Jaya',
      phone: '+60 3-5633 2200',
      email: 'accounts@marcusco.my',
      heroHeadline: 'Your Business, Our Books',
      heroSubheadline:
        'Audit, tax, and company secretary services for SMEs.',
    },
    {
      name: 'Lex & Partners Legal',
      tagline: 'Business Law for the Modern Enterprise',
      description:
        'Lex & Partners provides corporate legal services including company incorporation, commercial contracts, employment law, intellectual property registration, and dispute resolution.',
      address: 'Level 12, Wisma Hamzah Kwong Hing, Jalan Kampar, 50400 Kuala Lumpur',
      phone: '+60 3-2694 5500',
      email: 'legal@lexpartners.my',
      heroHeadline: 'Legal Support for Growing Businesses',
      heroSubheadline:
        'Corporate law, contracts, IP, and compliance support for businesses.',
    },
    {
      name: 'Pinnacle HR Solutions',
      tagline: 'People Strategy for Growing Companies',
      description:
        'Pinnacle HR Solutions helps companies build strong teams with HR outsourcing, recruitment, payroll management, and training programme development.',
      address: 'Unit 8-2, Jalan PJU 8/5A, Bandar Damansara Perdana, 47820 Petaling Jaya',
      phone: '+60 3-7726 8800',
      email: 'people@pinnaclerhr.my',
      heroHeadline: 'Build the Team That Builds Your Business',
      heroSubheadline:
        'Recruitment, payroll, and HR outsourcing for growing companies.',
    },
    {
      name: 'GreenVentures ESG Advisory',
      tagline: 'Sustainability Strategy for Businesses',
      description:
        'GreenVentures helps companies implement ESG (Environmental, Social, Governance) frameworks, with readiness assessments, sustainability reporting, carbon footprint analysis, and compliance advisory.',
      address: 'Level 20, Menara Standard Chartered, Jalan Sultan Ismail, 50250 Kuala Lumpur',
      phone: '+60 3-2117 6600',
      email: 'sustain@greenventures.my',
      heroHeadline: 'Sustainability Is Good Business',
      heroSubheadline:
        'ESG strategy, carbon analysis, and sustainability reporting.',
    },
  ],
  testimonials: [],
  faqItems: [],
  industryBlocks: [
    {
      blockType: 'service-list',
      variant: 'icon-grid',
      title: 'Our Services',
      showDescription: true,
      showPricing: false,
      currency: 'RM',
      columns: 3,
    },
    {
      blockType: 'case-study',
      variant: 'featured',
      title: 'Our Work',
      showIndustry: true,
      showResults: false,
      showTestimonial: false,
      ctaText: 'Learn More',
    },
  ],
}
