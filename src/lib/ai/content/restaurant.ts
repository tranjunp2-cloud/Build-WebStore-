import type { CategoryContent } from './types'

export const restaurantContent: CategoryContent = {
  category: 'restaurant',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Warung Pak Ali',
      tagline: 'Authentic Kampung Flavours in the Heart of KL',
      description:
        'Warung Pak Ali serves traditional Malay cuisine passed down through three generations. Our signature nasi lemak (RM 12) features sambal tumis made fresh daily, while our roti canai (RM 3) is hand-stretched to perfection. Enjoy kampung-style cooking in a modern, comfortable setting.',
      address: 'No. 23, Jalan Tun Sambanthan, Brickfields, 50470 Kuala Lumpur',
      phone: '+60 3-2274 8890',
      email: 'info@warungpakali.com.my',
      heroHeadline: 'Taste the Soul of Malaysian Home Cooking',
      heroSubheadline:
        'From our kampung kitchen to your table — nasi lemak, rendang, and classics made with love since 1985.',
    },
    {
      name: 'Dragon Pearl Chinese Restaurant',
      tagline: 'Premium Dim Sum & Cantonese Dining',
      description:
        'Dragon Pearl offers an elevated Cantonese dining experience in Petaling Jaya. Our dim sum selection starts from RM 8 per basket, with signature char siu (RM 28) and Peking duck (RM 138 whole). Perfect for family gatherings and business lunches.',
      address: 'Level 2, Plaza 33, No. 1, Jalan Kemajuan, Seksyen 13, 46200 Petaling Jaya',
      phone: '+60 3-7960 1238',
      email: 'reservations@dragonpearl.my',
      heroHeadline: 'Exquisite Dim Sum, Timeless Cantonese Tradition',
      heroSubheadline:
        'Handcrafted dim sum and wok-fired specialties — where every dish tells a story of Cantonese mastery.',
    },
    {
      name: 'Siti Nasi Kandar',
      tagline: 'Penang-Style Nasi Kandar, Now in KL',
      description:
        'Bringing the legendary flavours of Penang nasi kandar to Kuala Lumpur. Our nasi kandar set starts from RM 10 with a choice of curry chicken (RM 6), fried fish (RM 8), and our famous dalca (RM 4). Open 24 hours to satisfy your cravings anytime.',
      address: 'No. 45, Jalan Masjid India, 50100 Kuala Lumpur',
      phone: '+60 3-2693 5521',
      email: 'hello@sitinasiканdar.my',
      heroHeadline: 'Penang Nasi Kandar, Straight to Your Plate',
      heroSubheadline:
        'Flood your rice with our legendary curries — open 24 hours, 7 days a week.',
    },
    {
      name: 'Raj Banana Leaf',
      tagline: 'South Indian Banana Leaf Rice Since 1992',
      description:
        'Raj Banana Leaf is a Bangsar institution serving authentic South Indian cuisine. Our banana leaf rice (RM 12) comes with unlimited refills of rice, rasam, and three vegetable sides. Try our signature fish head curry (RM 35) and tandoori chicken (RM 18).',
      address: 'No. 8, Lorong Maarof, Bangsar, 59000 Kuala Lumpur',
      phone: '+60 3-2287 1693',
      email: 'eat@rajbananaleaf.com.my',
      heroHeadline: 'The Banana Leaf Experience You Deserve',
      heroSubheadline:
        'Unlimited rice, rich curries, and the warmth of South Indian hospitality — all on a single banana leaf.',
    },
    {
      name: 'Aminah Western Grill',
      tagline: 'Halal Western Cuisine with a Malaysian Twist',
      description:
        'Aminah Western Grill combines Western favourites with local flair. Our grilled lamb chop (RM 38) comes with sambal matah, while our chicken chop (RM 22) features a black pepper sauce made from Sarawak peppercorns. All meats are halal-certified.',
      address: 'No. 15, Persiaran Surian, Mutiara Damansara, 47810 Petaling Jaya',
      phone: '+60 3-7728 4455',
      email: 'dine@aminahgrill.my',
      heroHeadline: 'Halal Western Dining, Malaysian Soul',
      heroSubheadline:
        'Juicy steaks, sizzling lamb chops, and comfort food — all halal, all delicious.',
    },
  ],
  testimonials: [
    {
      name: 'Ahmad Faizal',
      title: 'Food Blogger',
      rating: 5,
      quote:
        'The nasi lemak here is the real deal — sambal that hits just right, and the ikan bilis is perfectly crispy. Worth every sen of the RM 12!',
    },
    {
      name: 'Tan Wei Liang',
      title: 'Regular Customer',
      rating: 5,
      quote:
        'I bring my family here every Sunday for dim sum. The har gow is always fresh, and the service is warm and welcoming. Best dim sum in PJ!',
    },
    {
      name: 'Priya Nair',
      title: 'Office Manager',
      company: 'TechVentures Sdn Bhd',
      rating: 4,
      quote:
        'We order catering from here for our office events. The banana leaf rice set is always a crowd favourite — everyone goes for seconds.',
    },
    {
      name: 'Siti Nurhaliza',
      title: 'Homemaker',
      rating: 5,
      quote:
        'Finally, halal Western food that actually tastes like proper Western food! My kids love the chicken chop and I love that I can trust the halal certification.',
    },
  ],
  faqItems: [
    {
      question: 'Do you accept reservations for large groups?',
      answer:
        'Yes, we accept reservations for groups of 10 or more. Please call us at least 24 hours in advance or book through our website. A deposit of RM 50 per table may be required for weekend bookings.',
    },
    {
      question: 'Is your food halal-certified?',
      answer:
        'Yes, all our meat and ingredients are JAKIM halal-certified. We take halal compliance very seriously and source only from verified halal suppliers.',
    },
    {
      question: 'Do you offer delivery services?',
      answer:
        'We are available on GrabFood, Foodpanda, and ShopeeFood. You can also order directly through our website for a 10% discount on your first order. Minimum order is RM 30 for free delivery within 5km.',
    },
    {
      question: 'What are your operating hours?',
      answer:
        'We are open daily from 8:00 AM to 10:00 PM. Our nasi kandar outlet is open 24 hours. During Ramadan, we offer special buka puasa (iftar) sets starting from RM 25 per person.',
    },
  ],
  industryBlocks: [
    {
      blockType: 'menu-display',
      variant: 'grid',
      title: 'Our Menu',
      categories: ['Nasi & Rice', 'Roti & Bread', 'Curries', 'Beverages'],
      showPrices: true,
      currency: 'RM',
    },
    {
      blockType: 'booking-widget',
      variant: 'inline',
      title: 'Reserve a Table',
      fields: ['date', 'time', 'guests', 'name', 'phone'],
      minGuests: 1,
      maxGuests: 20,
      advanceBookingDays: 30,
    },
  ],
}
