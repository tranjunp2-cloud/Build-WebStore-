import type { CategoryContent } from './types'

export const restaurantContent: CategoryContent = {
  category: 'restaurant',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Warung Pak Ali',
      tagline: 'Kampung Flavours in the Heart of KL',
      description:
        'Warung Pak Ali serves traditional Malay cuisine, including nasi lemak with sambal tumis and roti canai, in a modern, comfortable setting.',
      address: 'No. 23, Jalan Tun Sambanthan, Brickfields, 50470 Kuala Lumpur',
      phone: '+60 3-2274 8890',
      email: 'info@warungpakali.com.my',
      heroHeadline: 'Taste Malaysian Home Cooking',
      heroSubheadline:
        'Nasi lemak, rendang, and Malay classics from our kampung kitchen.',
    },
    {
      name: 'Dragon Pearl Chinese Restaurant',
      tagline: 'Dim Sum & Cantonese Dining',
      description:
        'Dragon Pearl serves Cantonese dishes in Petaling Jaya, including dim sum, char siu, and Peking duck, for family gatherings and business lunches.',
      address: 'Level 2, Plaza 33, No. 1, Jalan Kemajuan, Seksyen 13, 46200 Petaling Jaya',
      phone: '+60 3-7960 1238',
      email: 'reservations@dragonpearl.my',
      heroHeadline: 'Dim Sum and Cantonese Classics',
      heroSubheadline:
        'Dim sum and wok-fired specialties.',
    },
    {
      name: 'Siti Nasi Kandar',
      tagline: 'Penang-Style Nasi Kandar, Now in KL',
      description:
        'Siti Nasi Kandar serves Penang-style nasi kandar in Kuala Lumpur, with a choice of curries, fried fish, and dalca.',
      address: 'No. 45, Jalan Masjid India, 50100 Kuala Lumpur',
      phone: '+60 3-2693 5521',
      email: 'hello@sitinasikandar.my',
      heroHeadline: 'Penang Nasi Kandar, Straight to Your Plate',
      heroSubheadline:
        'Rice with your choice of curries and sides.',
    },
    {
      name: 'Raj Banana Leaf',
      tagline: 'South Indian Banana Leaf Rice',
      description:
        'Raj Banana Leaf serves South Indian cuisine in Bangsar, including banana leaf rice with rasam and vegetable sides, fish head curry, and tandoori chicken.',
      address: 'No. 8, Lorong Maarof, Bangsar, 59000 Kuala Lumpur',
      phone: '+60 3-2287 1693',
      email: 'eat@rajbananaleaf.com.my',
      heroHeadline: 'The Banana Leaf Rice Experience',
      heroSubheadline:
        'Rice, rich curries, and South Indian favourites on a banana leaf.',
    },
    {
      name: 'Aminah Western Grill',
      tagline: 'Western Grill with a Malaysian Twist',
      description:
        'Aminah Western Grill combines Western favourites with local flavours, such as grilled lamb chop with sambal matah and chicken chop with black pepper sauce.',
      address: 'No. 15, Persiaran Surian, Mutiara Damansara, 47810 Petaling Jaya',
      phone: '+60 3-7728 4455',
      email: 'dine@aminahgrill.my',
      heroHeadline: 'Western Grill, Malaysian Soul',
      heroSubheadline:
        'Steaks, lamb chops, and comfort food.',
    },
  ],
  testimonials: [],
  faqItems: [],
  industryBlocks: [
    {
      blockType: 'menu-food',
      variant: 'classic',
      headline: 'Our Menu',
      categories: [
        {
          name: 'Mains',
          items: [
            { name: 'Nasi Lemak', description: 'Coconut rice with sambal tumis, ikan bilis, and egg', price: '' },
            { name: 'Roti Canai', description: 'Flatbread served with dhal and curry', price: '' },
            { name: 'Curry Chicken', description: 'Chicken in coconut curry', price: '' },
          ],
        },
        {
          name: 'Drinks',
          items: [
            { name: 'Teh Tarik', description: 'Pulled milk tea', price: '' },
            { name: 'Kopi O', description: 'Black coffee', price: '' },
            { name: 'Lime Juice', description: 'Lime juice served chilled', price: '' },
          ],
        },
      ],
    },
    {
      blockType: 'booking-widget',
      variant: 'inline',
      title: 'Reserve a Table',
      fields: ['date', 'time', 'guests', 'name', 'phone'],
    },
  ],
}
