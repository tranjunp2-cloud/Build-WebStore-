import type { CategoryContent } from './types'

export const eventsContent: CategoryContent = {
  category: 'events',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Pelamin by Aisyah',
      tagline: 'Bespoke Malay Wedding Planning in Kuala Lumpur',
      description:
        'Pelamin by Aisyah specialises in traditional and contemporary Malay weddings. Our nikah packages start from RM 5,000, while our full reception packages (RM 15,000–RM 50,000) include pelamin setup, fresh floral arrangements, door gifts, and day-of coordination for up to 500 guests.',
      address: 'Suite 12-3, Menara KL Eco City, Jalan Bangsar, 59200 Kuala Lumpur',
      phone: '+60 3-2201 8833',
      email: 'hello@pelaminaisyah.com.my',
      heroHeadline: 'Your Dream Malay Wedding, Beautifully Planned',
      heroSubheadline:
        'From nikah to resepsi — we handle every detail so you can enjoy every moment of your big day.',
    },
    {
      name: 'Apex Corporate Events',
      tagline: 'Professional Conference & Seminar Organiser',
      description:
        'Apex Corporate Events delivers seamless conferences, product launches, and corporate seminars across the Klang Valley. Half-day seminar packages from RM 8,000 include AV setup, registration management, and catering. Full-day conferences from RM 18,000 for up to 300 delegates.',
      address: 'Level 8, Wisma UOA Damansara II, No. 6, Jalan Changkat Semantan, 50490 Petaling Jaya',
      phone: '+60 3-7731 5590',
      email: 'enquiry@apexevents.my',
      heroHeadline: 'Corporate Events That Leave a Lasting Impression',
      heroSubheadline:
        'Conferences, seminars, and product launches — executed with precision from concept to completion.',
    },
    {
      name: 'Little Star Party Co.',
      tagline: 'Fun & Creative Birthday Parties for Kids',
      description:
        'Little Star Party Co. creates magical birthday celebrations for children aged 1–12. Our themed party packages start from RM 2,500 and include decorations, games, a photo booth, and a 2-hour entertainer. Add-ons like custom cakes (from RM 350) and goodie bags (RM 15 each) available.',
      address: 'No. 7, Jalan SS 21/60, Damansara Utama, 47400 Petaling Jaya',
      phone: '+60 3-7733 2210',
      email: 'party@littlestarco.my',
      heroHeadline: 'Unforgettable Birthday Parties for Your Little Stars',
      heroSubheadline:
        'Themed decorations, fun activities, and stress-free planning — because every child deserves a magical celebration.',
    },
    {
      name: 'Grand Seri Ballroom',
      tagline: 'Premium Event Venue & Banquet Hall',
      description:
        'Grand Seri Ballroom offers elegant event spaces in the heart of Kuala Lumpur. Our pillarless grand hall accommodates up to 500 guests with full AV and staging. Venue rental from RM 6,000, all-inclusive wedding dinner packages from RM 128 per pax (min 200 guests).',
      address: 'Level 3, Grand Seri Hotel, Jalan Raja Laut, 50350 Kuala Lumpur',
      phone: '+60 3-2698 7700',
      email: 'events@grandseri.com.my',
      heroHeadline: 'An Elegant Venue for Every Occasion',
      heroSubheadline:
        'Weddings, galas, and corporate dinners — our grand ballroom sets the stage for unforgettable evenings.',
    },
    {
      name: 'KL Run & Ride Events',
      tagline: 'Malaysia\'s Premier Sports Event Organiser',
      description:
        'KL Run & Ride organises certified running, cycling, and triathlon events across Malaysia. Our flagship KL Night Marathon draws 18,000 participants yearly. Event management packages from RM 45,000 cover route permit (DBKL), timing chip, medal design, water stations, and medical support. 12 years experience, 240+ events delivered.',
      address: 'Unit 7-08, Plaza Pantai, Jalan 4/83A, Pantai Dalam, 59200 Kuala Lumpur',
      phone: '+60 3-2282 1900',
      email: 'race@klrunride.my',
      heroHeadline: 'Move Malaysia, Event by Event',
      heroSubheadline:
        'Marathons, fun runs, and triathlons — certified race management that keeps 18,000+ runners coming back every year.',
    },
  ],
  testimonials: [
    {
      name: 'Nurul Iman',
      title: 'Bride',
      rating: 5,
      quote:
        'Pelamin by Aisyah made our nikah and resepsi absolutely perfect. The pelamin was stunning and everything ran on time. Worth every ringgit of our RM 25,000 package!',
    },
    {
      name: 'Daniel Lim',
      title: 'Marketing Director',
      company: 'Nexgen Solutions Sdn Bhd',
      rating: 5,
      quote:
        'Apex handled our 250-person product launch flawlessly. From registration to AV to catering — not a single hiccup. Already booked them for our annual conference.',
    },
    {
      name: 'Farah Zainal',
      title: 'Parent',
      rating: 5,
      quote:
        'My daughter is still talking about her unicorn-themed party! Little Star made everything so easy — I just showed up and enjoyed the day with the kids.',
    },
    {
      name: 'Dr. Kevin Tan',
      title: 'Groom',
      rating: 4,
      quote:
        'Grand Seri Ballroom was the perfect venue for our wedding dinner. The food was excellent, the hall looked gorgeous, and the team was very accommodating with our requests.',
    },
  ],
  faqItems: [
    {
      question: 'How far in advance should I book my event?',
      answer:
        'For weddings, we recommend booking at least 6–12 months ahead, especially for peak dates (school holidays, year-end). Corporate events and birthday parties typically need 4–8 weeks of lead time. A 30% deposit secures your date.',
    },
    {
      question: 'What is the deposit and payment structure?',
      answer:
        'We require a 30% non-refundable deposit upon booking confirmation. A second payment of 40% is due 30 days before the event, with the remaining 30% settled on the event day. We accept bank transfer, credit card, and FPX.',
    },
    {
      question: 'Can I customise the package to suit my needs?',
      answer:
        'Absolutely! All our packages are fully customisable. You can mix and match services — add extra decor, upgrade catering, include live entertainment, or adjust guest count. Our coordinator will work with you to build a package that fits your budget and vision.',
    },
    {
      question: 'What happens if I need to reschedule my event?',
      answer:
        'We allow one free reschedule up to 60 days before the event, subject to date availability. Rescheduling within 30 days incurs a 15% fee. Cancellations made less than 14 days before the event forfeit the full deposit.',
    },
  ],
  industryBlocks: [
    {
      blockType: 'booking-widget',
      variant: 'event',
      title: 'Book Your Event',
      fields: ['event-type', 'date', 'guest-count', 'name', 'phone', 'email'],
      minGuests: 20,
      maxGuests: 500,
      advanceBookingDays: 365,
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
