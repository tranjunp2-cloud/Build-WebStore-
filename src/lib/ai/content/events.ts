import type { CategoryContent } from './types'

export const eventsContent: CategoryContent = {
  category: 'events',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Pelamin by Aisyah',
      tagline: 'Malay Wedding Planning in Kuala Lumpur',
      description:
        'Pelamin by Aisyah plans traditional and contemporary Malay weddings, with packages covering nikah and receptions, pelamin setup, floral arrangements, door gifts, and day-of coordination.',
      address: 'Suite 12-3, Menara KL Eco City, Jalan Bangsar, 59200 Kuala Lumpur',
      phone: '+60 3-2201 8833',
      email: 'hello@pelaminaisyah.com.my',
      heroHeadline: 'Your Malay Wedding, Beautifully Planned',
      heroSubheadline:
        'From nikah to resepsi, we help plan every detail of your day.',
    },
    {
      name: 'Apex Corporate Events',
      tagline: 'Conference and Seminar Organiser',
      description:
        'Apex Corporate Events organises conferences, product launches, and corporate seminars, including AV setup, registration management, and catering.',
      address: 'Level 8, Wisma UOA Damansara II, No. 6, Jalan Changkat Semantan, 50490 Petaling Jaya',
      phone: '+60 3-7731 5590',
      email: 'enquiry@apexevents.my',
      heroHeadline: 'Corporate Events, Planned with Care',
      heroSubheadline:
        'Conferences, seminars, and product launches from concept to completion.',
    },
    {
      name: 'Little Star Party Co.',
      tagline: 'Creative Birthday Parties for Kids',
      description:
        'Little Star Party Co. plans themed birthday parties for children, with decorations, games, a photo booth, and entertainers, plus optional custom cakes and goodie bags.',
      address: 'No. 7, Jalan SS 21/60, Damansara Utama, 47400 Petaling Jaya',
      phone: '+60 3-7733 2210',
      email: 'party@littlestarco.my',
      heroHeadline: 'Birthday Parties for Your Little Stars',
      heroSubheadline:
        'Themed decorations, activities, and stress-free planning.',
    },
    {
      name: 'Grand Seri Ballroom',
      tagline: 'Event Venue & Banquet Hall',
      description:
        'Grand Seri Ballroom is an event venue for weddings, galas, and corporate dinners, with a grand hall, AV, and staging.',
      address: 'Level 3, Grand Seri Hotel, Jalan Raja Laut, 50350 Kuala Lumpur',
      phone: '+60 3-2698 7700',
      email: 'events@grandseri.com.my',
      heroHeadline: 'An Elegant Venue for Every Occasion',
      heroSubheadline:
        'Weddings, galas, and corporate dinners in a grand ballroom.',
    },
    {
      name: 'KL Run & Ride Events',
      tagline: 'Sports Event Organiser',
      description:
        'KL Run & Ride organises running, cycling, and triathlon events, with event management covering route planning, timing, medals, water stations, and medical support.',
      address: 'Unit 7-08, Plaza Pantai, Jalan 4/83A, Pantai Dalam, 59200 Kuala Lumpur',
      phone: '+60 3-2282 1900',
      email: 'race@klrunride.my',
      heroHeadline: 'Move Malaysia, Event by Event',
      heroSubheadline:
        'Marathons, fun runs, and triathlons, with race management from planning to finish line.',
    },
  ],
  testimonials: [],
  faqItems: [],
  industryBlocks: [
    {
      blockType: 'booking-widget',
      variant: 'event',
      title: 'Book Your Event',
      fields: ['event-type', 'date', 'guest-count', 'name', 'phone', 'email'],
      eventTypes: ['Wedding', 'Corporate', 'Birthday', 'Seminar', 'Gala Dinner'],
    },
    {
      blockType: 'countdown-timer',
      variant: 'elegant',
      title: 'Counting Down to the Big Day',
      fields: ['event-name', 'event-date'],
      showDays: true,
      showHours: true,
      showMinutes: true,
      showSeconds: true,
    },
  ],
}
