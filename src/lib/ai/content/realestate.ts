import type { CategoryContent } from './types'

export const realestateContent: CategoryContent = {
  category: 'realestate',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Dato\' Hassan Realty',
      tagline: 'Premium Properties in Kuala Lumpur & Selangor',
      description:
        'Dato\' Hassan Realty specialises in premium residential and commercial properties across the Klang Valley. Our portfolio includes luxury condominiums in KLCC (from RM 1.2M), family semi-detached homes in Shah Alam (from RM 850K), and commercial shop lots in Bangsar (from RM 2.5M).',
      address: 'Level 8, Menara Prestige, Jalan Pinang, 50450 Kuala Lumpur',
      phone: '+60 3-2166 8800',
      email: 'enquiry@hassanrealty.my',
      heroHeadline: 'Find Your Dream Property in Malaysia',
      heroSubheadline:
        'Luxury condos, family homes, and commercial spaces — expert guidance from KL\'s trusted property consultants.',
    },
    {
      name: 'Puan Lim Property Consultants',
      tagline: 'Your Penang Property Specialist',
      description:
        'Puan Lim Property Consultants is Penang\'s leading real estate agency. We handle heritage shophouses in George Town (from RM 1.5M), sea-view condos in Gurney (from RM 750K), landed properties in Bayan Lepas (from RM 550K), and industrial lots in Batu Kawan (from RM 3M).',
      address: 'No. 18, Lebuh Pantai, George Town, 10300 Penang',
      phone: '+60 4-261 5500',
      email: 'info@puanlim.my',
      heroHeadline: 'Penang Properties, Local Expertise',
      heroSubheadline:
        'Heritage shophouses, sea-view condos, and landed homes — Penang\'s property market is our speciality.',
    },
    {
      name: 'NextHome Development',
      tagline: 'Affordable Quality Homes for Young Malaysians',
      description:
        'NextHome Development builds affordable housing for first-time buyers. Our latest project in Setia Alam offers apartments from RM 280K with 3 bedrooms and 2 bathrooms. Eligible for government incentives under the Skim Rumah Pertamaku with 100% financing.',
      address: 'Show Gallery, Jalan Setia Prima, Setia Alam, 40170 Shah Alam',
      phone: '+60 3-3362 8800',
      email: 'sales@nexthome.my',
      heroHeadline: 'Your First Home, Within Reach',
      heroSubheadline:
        'Apartments from RM 280K — eligible for 100% financing under Skim Rumah Pertamaku.',
    },
    {
      name: 'Emerald Commercial REIT',
      tagline: 'Commercial Property Investment Made Accessible',
      description:
        'Emerald Commercial REIT manages a portfolio of office towers and retail spaces across Malaysia valued at RM 2.8 billion. Our co-working spaces in KL Sentral start from RM 800/month per desk. Office suites from RM 3,500/month with flexible lease terms.',
      address: 'Level 30, Menara KL Sentral, Jalan Stesen Sentral 5, 50470 Kuala Lumpur',
      phone: '+60 3-2260 1000',
      email: 'leasing@emeraldreit.my',
      heroHeadline: 'Premium Office Spaces Across Malaysia',
      heroSubheadline:
        'Co-working desks from RM 800/month, private offices from RM 3,500/month — flexible terms in prime locations.',
    },
    {
      name: 'Borneo Land & Estate',
      tagline: 'Sabah & Sarawak Property Experts',
      description:
        'Borneo Land & Estate covers the East Malaysian property market. We offer beachfront land in Kota Kinabalu (from RM 150 per sq ft), residential lots in Kuching (from RM 200K), and plantation estates in Sandakan. Specialist in native title land advisory.',
      address: 'Lot 12, Lorong Dewan, 88000 Kota Kinabalu, Sabah',
      phone: '+60 88-232 100',
      email: 'explore@borneoland.my',
      heroHeadline: 'Discover Borneo\'s Property Opportunities',
      heroSubheadline:
        'Beachfront land, residential plots, and plantation estates in Sabah and Sarawak.',
    },
  ],
  testimonials: [
    {
      name: 'Encik Azlan & Puan Nadia',
      title: 'First-Time Buyers',
      rating: 5,
      quote:
        'NextHome helped us navigate the entire home-buying process. We got our RM 280K apartment with Skim Rumah Pertamaku — zero down payment! The team guided us through every step of the loan application.',
    },
    {
      name: 'Marcus Lee',
      title: 'Property Investor',
      rating: 5,
      quote:
        'Dato\' Hassan Realty found me a KLCC condo that has appreciated 15% in just 2 years. Their market knowledge is unmatched. I have since purchased 3 more units through them.',
    },
    {
      name: 'Sarah Chong',
      title: 'Startup Founder',
      company: 'GreenTech MY',
      rating: 4,
      quote:
        'The co-working space at Emerald REIT in KL Sentral is perfect for our growing team. RM 800/month per desk with great facilities, and we can scale up as needed without a long-term commitment.',
    },
    {
      name: 'Tan Sri Razak',
      title: 'Retired Civil Servant',
      rating: 5,
      quote:
        'Puan Lim helped us find a heritage shophouse in George Town. The process for foreign-ownership properties was complex, but her team handled everything professionally.',
    },
  ],
  faqItems: [
    {
      question: 'What government schemes are available for first-time buyers?',
      answer:
        'Malaysia offers several schemes: Skim Rumah Pertamaku (SRP) provides up to 110% financing with no down payment for properties up to RM 500K. MyDeposit gives up to RM 30K towards your deposit. Stamp duty exemption applies for properties under RM 500K until 2025.',
    },
    {
      question: 'Can foreigners buy property in Malaysia?',
      answer:
        'Yes, foreigners can purchase property above the minimum threshold (typically RM 1M in most states, RM 2M in Kuala Lumpur for certain zones). Malaysia My Second Home (MM2H) visa holders enjoy more favourable terms. State consent is required for landed properties.',
    },
    {
      question: 'What are the typical transaction costs?',
      answer:
        'Buyer costs include: stamp duty (1-4% of property price), legal fees (0.5-1%), valuation fee (0.25%), and loan processing fee. Total transaction costs are typically 4-6% of the property price. We provide a detailed cost breakdown during consultation.',
    },
    {
      question: 'How long does the property purchase process take?',
      answer:
        'From signing the Sale and Purchase Agreement (SPA) to key collection: sub-sale properties take 3-4 months, new launches take 24-36 months (under construction). Loan approval typically takes 2-4 weeks from application.',
    },
  ],
  industryBlocks: [
    {
      blockType: 'property-listing',
      variant: 'card-grid',
      title: 'Featured Properties',
      showPrice: true,
      showLocation: true,
      showBedrooms: true,
      showSqft: true,
      currency: 'RM',
      filterByType: true,
      types: ['Condo', 'Semi-D', 'Terrace', 'Bungalow', 'Commercial'],
    },
    {
      blockType: 'calculator-widget',
      variant: 'mortgage',
      title: 'Mortgage Calculator',
      defaultRate: 4.5,
      defaultTenure: 30,
      currency: 'RM',
      showStampDuty: true,
      showLegalFees: true,
    },
  ],
}
