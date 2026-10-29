import type { CategoryContent } from './types'

export const travelContent: CategoryContent = {
  category: 'travel',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Wanderlust Asia Travel',
      tagline: 'Tour Packages in Southeast Asia',
      description:
        'Wanderlust Asia Travel offers domestic and ASEAN tour packages, including day trips, island getaways, regional tours, and customised corporate retreats.',
      address: 'Level 8, Menara KEN TTDI, No. 37, Jalan Burhanuddin Helmi, 60000 Kuala Lumpur',
      phone: '+60 3-7733 8800',
      email: 'hello@wanderlustasia.my',
      heroHeadline: 'Explore Malaysia & Beyond',
      heroSubheadline:
        'Domestic and Southeast Asia tour packages.',
    },
    {
      name: 'Coral Bay Resort Langkawi',
      tagline: 'Beachfront Stays on Langkawi',
      description:
        'Coral Bay Resort is a beachfront property on Langkawi island, with sea-view rooms, overwater chalets, family suites, and a private villa with pool.',
      address: 'Lot 1288, Pantai Cenang, 07000 Langkawi, Kedah',
      phone: '+60 4-9551 2200',
      email: 'stay@coralbaylangkawi.my',
      heroHeadline: 'Wake Up by the Sea',
      heroSubheadline:
        'Beachfront chalets and villas on Langkawi.',
    },
    {
      name: 'Rimba Adventure Tours',
      tagline: 'Into the Wild Heart of Malaysia',
      description:
        'Rimba Adventure Tours offers eco-adventure experiences such as highland trekking, jungle expeditions, white-water rafting, and mountain climbing packages, with guides.',
      address: 'No. 45, Jalan Sultan Ismail, Tanah Rata, 39000 Cameron Highlands, Pahang',
      phone: '+60 5-4911 6600',
      email: 'explore@rimbaadventure.my',
      heroHeadline: 'Adventures in the Malaysian Outdoors',
      heroSubheadline:
        'Jungle treks, river rafting, and mountain climbs with guides.',
    },
    {
      name: 'Straits Heritage Tours',
      tagline: 'Where History Comes Alive',
      description:
        'Straits Heritage Tours offers cultural experiences in Melaka and Penang, including heritage walking tours, street art and food trails, Peranakan culture packages, and Nyonya cooking classes.',
      address: 'No. 18, Jalan Hang Jebat, 75200 Melaka',
      phone: '+60 6-2826 4400',
      email: 'tours@straitsheritage.my',
      heroHeadline: 'Discover the Soul of the Straits',
      heroSubheadline:
        'Heritage walks, Peranakan cuisine, and living history.',
    },
    {
      name: 'Sabah Diver Escapes',
      tagline: 'Dive Centre in Semporna',
      description:
        'Sabah Diver Escapes is a dive centre in Semporna offering dive packages for Sipadan, Mabul, and Kapalai, dive courses, and equipment rental.',
      address: 'Jetty 2, Semporna Seafront, 91300 Semporna, Sabah',
      phone: '+60 89-781 1200',
      email: 'dive@sabahdiver.my',
      heroHeadline: 'Dive Sipadan, Mabul, Kapalai',
      heroSubheadline:
        'Dive packages and courses from Semporna.',
    },
  ],
  testimonials: [],
  faqItems: [],
  industryBlocks: [
    {
      blockType: 'gallery',
      variant: 'destination-grid',
      title: 'Popular Destinations',
      columns: 3,
      showLocationTag: true,
      showPriceTag: false,
      destinations: [
        'Langkawi',
        'Perhentian Islands',
        'Cameron Highlands',
        'Taman Negara',
        'Melaka',
        'Penang',
      ],
    },
    {
      blockType: 'booking-widget',
      variant: 'trip-search',
      title: 'Plan Your Trip',
      fields: ['destination', 'check-in', 'check-out', 'pax-adults', 'pax-children'],
      currency: 'RM',
      showDateRange: true,
      showPaxCount: true,
      ctaLabel: 'Search Packages',
    },
  ],
}
