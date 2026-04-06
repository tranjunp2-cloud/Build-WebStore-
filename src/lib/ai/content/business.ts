import type { CategoryContent } from './types'

export const businessContent: CategoryContent = {
  category: 'business',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Dato\' Rahman Consulting Group',
      tagline: 'Strategic Advisory for Malaysian Enterprises',
      description:
        'Dato\' Rahman Consulting Group provides C-suite advisory services to mid-market and enterprise clients. Strategy consulting (RM 500/hour), market entry advisory (from RM 25,000/project), M&A due diligence (from RM 50,000), and board advisory retainers (RM 10,000/month).',
      address: 'Level 35, Menara Maxis, Kuala Lumpur City Centre, 50088 Kuala Lumpur',
      phone: '+60 3-2382 8800',
      email: 'advisory@datrahman.my',
      heroHeadline: 'Strategic Counsel for Business Leaders',
      heroSubheadline:
        'M&A advisory, market entry strategy, and board consulting — trusted by Malaysia\'s top enterprises.',
    },
    {
      name: 'Marcus & Co Accountants',
      tagline: 'Accounting, Tax & Compliance Made Easy',
      description:
        'Marcus & Co is a chartered accounting firm serving SMEs across Malaysia. Annual audit (from RM 3,000), tax filing (from RM 800), company secretary services (RM 1,200/year), and SST registration & filing (RM 500/quarter). We handle the numbers so you can focus on growth.',
      address: 'No. 6, Jalan SS15/4, SS15, 47500 Subang Jaya',
      phone: '+60 3-5633 2200',
      email: 'accounts@marcusco.my',
      heroHeadline: 'Your Business, Our Books',
      heroSubheadline:
        'Audit, tax, and company secretary services — trusted by 500+ Malaysian SMEs.',
    },
    {
      name: 'Lex & Partners Legal',
      tagline: 'Business Law for the Modern Enterprise',
      description:
        'Lex & Partners provides corporate legal services including company incorporation (RM 2,500), commercial contracts (from RM 1,500), employment law (RM 400/hour), intellectual property registration (from RM 3,000), and dispute resolution. We serve clients in English, Malay, and Mandarin.',
      address: 'Level 12, Wisma Hamzah Kwong Hing, Jalan Kampar, 50400 Kuala Lumpur',
      phone: '+60 3-2694 5500',
      email: 'legal@lexpartners.my',
      heroHeadline: 'Legal Solutions That Protect and Empower',
      heroSubheadline:
        'Corporate law, contracts, IP, and compliance — multilingual legal services for Malaysian businesses.',
    },
    {
      name: 'Pinnacle HR Solutions',
      tagline: 'People Strategy for Growing Companies',
      description:
        'Pinnacle HR Solutions helps Malaysian companies build strong teams. HR outsourcing (from RM 2,000/month), recruitment (20% of annual salary), payroll management (RM 15/employee/month), and HRDC training programme development (from RM 5,000). Serving 100+ companies.',
      address: 'Unit 8-2, Jalan PJU 8/5A, Bandar Damansara Perdana, 47820 Petaling Jaya',
      phone: '+60 3-7726 8800',
      email: 'people@pinnaclerhr.my',
      heroHeadline: 'Build the Team That Builds Your Business',
      heroSubheadline:
        'Recruitment, payroll, and HR outsourcing — trusted people solutions for 100+ Malaysian companies.',
    },
    {
      name: 'GreenVentures ESG Advisory',
      tagline: 'Sustainability Strategy for Forward-Thinking Businesses',
      description:
        'GreenVentures helps companies implement ESG (Environmental, Social, Governance) frameworks. ESG readiness assessment (RM 8,000), sustainability reporting (from RM 15,000), carbon footprint analysis (RM 10,000), and Bursa Malaysia sustainability compliance advisory (from RM 20,000).',
      address: 'Level 20, Menara Standard Chartered, Jalan Sultan Ismail, 50250 Kuala Lumpur',
      phone: '+60 3-2117 6600',
      email: 'sustain@greenventures.my',
      heroHeadline: 'Sustainability Is Good Business',
      heroSubheadline:
        'ESG strategy, carbon analysis, and Bursa compliance — helping Malaysian companies lead the green transition.',
    },
  ],
  testimonials: [
    {
      name: 'Tan Sri Ahmad Zulkifli',
      title: 'Chairman',
      company: 'Sapura Industrial Bhd',
      rating: 5,
      quote:
        'Dato\' Rahman\'s team guided us through a complex cross-border acquisition. Their RM 500/hour rate delivered value far exceeding the cost. Exceptional strategic thinking and execution.',
    },
    {
      name: 'Lim Bee Hwa',
      title: 'Founder',
      company: 'FreshBake Sdn Bhd',
      rating: 5,
      quote:
        'Marcus & Co has been handling our accounts for 5 years. They saved us over RM 40,000 in tax through proper planning last year alone. Reliable, responsive, and reasonably priced.',
    },
    {
      name: 'Harith Iskandar',
      title: 'Managing Director',
      company: 'Digital Nomad MY',
      rating: 4,
      quote:
        'Lex & Partners helped us draft employment contracts for our remote team across ASEAN. They understood the cross-border nuances perfectly. The bilingual service was a huge plus for our diverse team.',
    },
    {
      name: 'Puan Sharifah',
      title: 'CEO',
      company: 'EcoPlast Manufacturing',
      rating: 5,
      quote:
        'GreenVentures transformed our approach to sustainability. Their ESG assessment identified quick wins that actually saved us money while improving our Bursa sustainability score. A worthwhile investment.',
    },
  ],
  faqItems: [
    {
      question: 'How do your consulting fees work?',
      answer:
        'We offer both hourly rates and project-based pricing depending on the engagement. Initial consultations (30 minutes) are free. Retainer arrangements are available for ongoing advisory needs with 10-15% discount on hourly rates.',
    },
    {
      question: 'Do you work with startups or only established companies?',
      answer:
        'We serve businesses at all stages. For startups, we offer reduced-rate packages covering essentials like incorporation, basic legal, and initial accounting setup. Our Startup Launchpad package starts from RM 5,000.',
    },
    {
      question: 'Can you help with government grants and incentives?',
      answer:
        'Yes, we help clients identify and apply for relevant grants including MDEC Digital Content Fund, SME Corp grants, MIDA incentives, and HRDC training levies. Our success rate for grant applications is over 70%.',
    },
    {
      question: 'What industries do you specialise in?',
      answer:
        'We have deep expertise in technology, manufacturing, F&B, retail, and professional services. Our team includes former industry practitioners who understand sector-specific challenges and regulations in the Malaysian market.',
    },
  ],
  industryBlocks: [
    {
      blockType: 'service-list',
      variant: 'icon-grid',
      title: 'Our Services',
      showDescription: true,
      showPricing: true,
      currency: 'RM',
      columns: 3,
    },
    {
      blockType: 'case-study',
      variant: 'featured',
      title: 'Client Success Stories',
      showIndustry: true,
      showResults: true,
      showTestimonial: true,
      ctaText: 'Read Full Case Study',
    },
  ],
}
