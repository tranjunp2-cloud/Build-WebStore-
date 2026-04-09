import type { CategoryContent } from './types'

export const travelContent: CategoryContent = {
  category: 'travel',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Wanderlust Asia Travel',
      tagline: 'Your Gateway to Southeast Asia',
      description:
        'Wanderlust Asia Travel is a full-service travel agency offering domestic and ASEAN tour packages. Domestic day trips (from RM 199), 3D2N island getaways (from RM 899), ASEAN tours covering Thailand, Vietnam, and Indonesia (from RM 1,599), and customised corporate retreats. Licensed by MOTAC with 12 years of experience.',
      address: 'Level 8, Menara KEN TTDI, No. 37, Jalan Burhanuddin Helmi, 60000 Kuala Lumpur',
      phone: '+60 3-7733 8800',
      email: 'hello@wanderlustasia.my',
      heroHeadline: 'Explore Malaysia & Beyond',
      heroSubheadline:
        'Curated domestic and ASEAN tours from RM 199 — trusted by 15,000+ happy travellers since 2014.',
    },
    {
      name: 'Coral Bay Resort Langkawi',
      tagline: 'Island Living, Redefined',
      description:
        'Coral Bay Resort is a boutique beachfront property on Langkawi island. Deluxe sea-view rooms (RM 380/night), overwater chalets (RM 650/night), family suites (RM 520/night), and private villa with pool (RM 1,200/night). Includes complimentary kayaks, snorkelling gear, and island breakfast.',
      address: 'Lot 1288, Pantai Cenang, 07000 Langkawi, Kedah',
      phone: '+60 4-9551 2200',
      email: 'stay@coralbaylangkawi.my',
      heroHeadline: 'Wake Up to Turquoise Waters',
      heroSubheadline:
        'Beachfront chalets and overwater villas on Langkawi — your private island escape from RM 380/night.',
    },
    {
      name: 'Rimba Adventure Tours',
      tagline: 'Into the Wild Heart of Malaysia',
      description:
        'Rimba Adventure Tours specialises in eco-adventure experiences across Peninsular Malaysia. Cameron Highlands trekking (RM 249/pax), Taman Negara 3D2N jungle expedition (RM 899/pax), white-water rafting in Gopeng (RM 189/pax), and Mount Kinabalu climb packages (from RM 2,200/pax). All guides are certified wilderness first responders.',
      address: 'No. 45, Jalan Sultan Ismail, Tanah Rata, 39000 Cameron Highlands, Pahang',
      phone: '+60 5-4911 6600',
      email: 'explore@rimbaadventure.my',
      heroHeadline: 'Adventures That Take Your Breath Away',
      heroSubheadline:
        'Jungle treks, river rafting, and mountain climbs — guided by certified experts who know every trail.',
    },
    {
      name: 'Straits Heritage Tours',
      tagline: 'Where History Comes Alive',
      description:
        'Straits Heritage Tours offers immersive cultural experiences in Melaka and Penang. Melaka heritage walking tour (RM 89/pax), Penang street art and food trail (RM 129/pax), 2D1N Peranakan culture package (RM 499/pax), and private Nyonya cooking class with market visit (RM 159/pax). All tours led by licensed heritage guides.',
      address: 'No. 18, Jalan Hang Jebat, 75200 Melaka',
      phone: '+60 6-2826 4400',
      email: 'tours@straitsheritage.my',
      heroHeadline: 'Discover the Soul of the Straits',
      heroSubheadline:
        'Heritage walks, Peranakan cuisine, and living history — experience Melaka and Penang like a local.',
    },
  ],
  testimonials: [
    {
      name: 'Ahmad Hafiz',
      title: 'Marketing Manager',
      rating: 5,
      quote:
        'Wanderlust Asia planned our team retreat to Redang Island flawlessly. The 3D2N package at RM 899 per person was excellent value — snorkelling, BBQ dinner, and a beachfront chalet all included. Already booking our next trip.',
    },
    {
      name: 'Emily Tan',
      title: 'Freelance Photographer',
      rating: 5,
      quote:
        'Coral Bay Resort is a dream for photographers. The overwater chalet gave me golden-hour shots I could never get elsewhere. Staff arranged a private mangrove boat tour on the spot. Worth every sen of RM 650 a night.',
    },
    {
      name: 'Raj Krishnan',
      title: 'University Lecturer',
      rating: 5,
      quote:
        'The Taman Negara expedition with Rimba was the highlight of our year. Our guide spotted wildlife we would have walked right past. The night jungle walk was thrilling — my students still talk about it months later.',
    },
    {
      name: 'Lim Siew Peng',
      title: 'Retired Teacher',
      rating: 4,
      quote:
        'Straits Heritage gave us a Melaka walking tour that was more like a time machine. Our guide shared stories about every shophouse and temple. The Nyonya cooking class afterward was the cherry on top — I finally nailed my laksa recipe.',
    },
  ],
  faqItems: [
    {
      question: 'How far in advance should I book?',
      answer:
        'We recommend booking at least 2 weeks ahead for domestic trips and 4 weeks for ASEAN tours. Peak seasons (school holidays, Hari Raya, Chinese New Year) fill up fast — book 6-8 weeks early for the best availability and pricing.',
    },
    {
      question: 'What is your cancellation policy?',
      answer:
        'Free cancellation up to 14 days before departure for a full refund. Cancellations 7-13 days before departure receive a 50% refund or full credit for future trips. Within 7 days, no refund is available but you may transfer your booking to another person at no charge.',
    },
    {
      question: 'Is travel insurance included?',
      answer:
        'Basic travel insurance covering medical emergencies and trip cancellation is included in all ASEAN tour packages. For domestic trips, we offer optional coverage from RM 25 per person. We strongly recommend comprehensive insurance for adventure activities like rafting and mountain climbing.',
    },
    {
      question: 'Do you offer group discounts?',
      answer:
        'Yes! Groups of 6-10 pax receive 10% off, and groups of 11 or more get 15% off. Corporate groups and school excursions qualify for custom pricing — contact us with your group size and preferred dates for a tailored quotation.',
    },
  ],
  industryBlocks: [
    {
      blockType: 'gallery',
      variant: 'destination-grid',
      title: 'Popular Destinations',
      columns: 3,
      showLocationTag: true,
      showPriceTag: true,
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
