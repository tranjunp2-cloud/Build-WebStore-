import type { CategoryContent } from './types'

export const realestateContent: CategoryContent = {
  category: 'realestate',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Dato\' Hassan Realty',
      tagline: 'Properties in Kuala Lumpur & Selangor',
      description:
        'Dato\' Hassan Realty handles residential and commercial properties across the Klang Valley, including condominiums, semi-detached homes, and commercial shop lots.',
      address: 'Level 8, Menara Prestige, Jalan Pinang, 50450 Kuala Lumpur',
      phone: '+60 3-2166 8800',
      email: 'enquiry@hassanrealty.my',
      heroHeadline: 'Find Your Next Property in Malaysia',
      heroSubheadline:
        'Condos, family homes, and commercial spaces, with guidance from property consultants.',
    },
    {
      name: 'Puan Lim Property Consultants',
      tagline: 'Property Consultants in Penang',
      description:
        'Puan Lim Property Consultants handles Penang properties, including heritage shophouses, condos, landed properties, and industrial lots.',
      address: 'No. 18, Lebuh Pantai, George Town, 10300 Penang',
      phone: '+60 4-261 5500',
      email: 'info@puanlim.my',
      heroHeadline: 'Penang Properties, Local Knowledge',
      heroSubheadline:
        'Shophouses, condos, and landed homes in Penang.',
    },
    {
      name: 'NextHome Development',
      tagline: 'Homes for First-Time Buyers',
      description:
        'NextHome Development builds apartments aimed at first-time buyers, with a show gallery in Setia Alam.',
      address: 'Show Gallery, Jalan Setia Prima, Setia Alam, 40170 Shah Alam',
      phone: '+60 3-3362 8800',
      email: 'sales@nexthome.my',
      heroHeadline: 'Your First Home Starts Here',
      heroSubheadline:
        'Apartments for first-time buyers. Visit our show gallery.',
    },
    {
      name: 'Emerald Commercial REIT',
      tagline: 'Commercial Property Investment',
      description:
        'Emerald Commercial REIT manages office and retail spaces, including co-working spaces and office suites available to lease.',
      address: 'Level 30, Menara KL Sentral, Jalan Stesen Sentral 5, 50470 Kuala Lumpur',
      phone: '+60 3-2260 1000',
      email: 'leasing@emeraldreit.my',
      heroHeadline: 'Office and Co-Working Spaces to Lease',
      heroSubheadline:
        'Co-working desks and private offices in city locations.',
    },
    {
      name: 'Borneo Land & Estate',
      tagline: 'Sabah & Sarawak Property',
      description:
        'Borneo Land & Estate covers the East Malaysian property market, including land in Kota Kinabalu, residential lots in Kuching, and plantation estates, with land advisory services.',
      address: 'Lot 12, Lorong Dewan, 88000 Kota Kinabalu, Sabah',
      phone: '+60 88-232 100',
      email: 'explore@borneoland.my',
      heroHeadline: 'Discover Property in Borneo',
      heroSubheadline:
        'Land, residential plots, and estates in Sabah and Sarawak.',
    },
  ],
  testimonials: [],
  faqItems: [],
  industryBlocks: [
    {
      blockType: 'property-listing',
      variant: 'card-grid',
      title: 'Featured Properties',
      showPrice: false,
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
      currency: 'RM',
      showStampDuty: true,
      showLegalFees: true,
    },
  ],
}
