import type { CategoryContent } from './types'

export const fnbContent: CategoryContent = {
  category: 'fnb',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Kopitiam Ah Huat',
      tagline: 'Traditional Kopitiam, Modern Vibes',
      description:
        'Kopitiam Ah Huat brings old-school Malaysian coffee culture to a modern setting, serving kopi O, kopi tarik, toast with kaya and butter, and half-boiled eggs.',
      address: 'No. 32, Jalan Sultan, Chinatown, 50000 Kuala Lumpur',
      phone: '+60 3-2022 1188',
      email: 'kopi@ahhuatkopitiam.my',
      heroHeadline: 'Where Every Cup Tells a Story',
      heroSubheadline:
        'Traditional kopi, toast, and good company.',
    },
    {
      name: 'Lune Artisan Bakery',
      tagline: 'French-Inspired Pastries, Malaysian Heart',
      description:
        'Lune Artisan Bakery makes French-style pastries with local Malaysian twists, such as croissants, pandan danish, salted egg yolk tarts, and custom cakes for birthdays and events.',
      address: 'No. 11, Jalan Bangkung, Bangsar, 59100 Kuala Lumpur',
      phone: '+60 12-668 3300',
      email: 'order@lunebakery.my',
      heroHeadline: 'Pastries with a Malaysian Twist',
      heroSubheadline:
        'Croissants, tarts, and custom cakes.',
    },
    {
      name: 'Bubble Lab Tea House',
      tagline: 'Bubble Tea and Fruit Teas',
      description:
        'Bubble Lab serves bubble tea including milk tea, brown sugar boba, matcha latte, and a fruit tea series.',
      address: 'Lot G-08, Pavilion KL, Jalan Bukit Bintang, 55100 Kuala Lumpur',
      phone: '+60 3-2110 3388',
      email: 'sip@bubblelab.my',
      heroHeadline: 'Bubble Tea, Made Your Way',
      heroSubheadline:
        'Milk tea, boba, matcha, and fruit tea.',
    },
    {
      name: 'Dapur Ummi Catering',
      tagline: 'Home-Style Malay Catering',
      description:
        'Dapur Ummi provides Malay catering for weddings, corporate events, and private functions, including nasi briyani sets, nasi lemak buffets, satay stations, and kenduri packages.',
      address: 'No. 48, Jalan Wangsa Delima, Wangsa Maju, 53300 Kuala Lumpur',
      phone: '+60 12-330 8800',
      email: 'order@dapurummi.my',
      heroHeadline: 'Catering That Feels Like Home',
      heroSubheadline:
        'Malay catering for weddings, corporate events, and private functions.',
    },
    {
      name: 'Greenleaf Juice Bar',
      tagline: 'Cold-Pressed Juices and Healthy Bites',
      description:
        'Greenleaf serves cold-pressed juices, acai bowls, overnight oats, and wraps, plus juice cleanse programmes.',
      address: 'No. 3, Jalan Telawi 5, Bangsar, 59100 Kuala Lumpur',
      phone: '+60 12-445 7700',
      email: 'juice@greenleaf.my',
      heroHeadline: 'Fuel Your Day with Fresh Juice',
      heroSubheadline:
        'Cold-pressed juices, acai bowls, and healthy bites.',
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
          name: 'Drinks',
          items: [
            { name: 'Kopi O', description: 'Black coffee, brewed the traditional way', price: '' },
            { name: 'Kopi Tarik', description: 'Pulled coffee with condensed milk', price: '' },
            { name: 'Teh Tarik', description: 'Pulled milk tea', price: '' },
          ],
        },
        {
          name: 'Food',
          items: [
            { name: 'Kaya Toast', description: 'Toasted bread with kaya and butter', price: '' },
            { name: 'Half-Boiled Eggs', description: 'Soft eggs with soy sauce and white pepper', price: '' },
            { name: 'Nasi Lemak', description: 'Coconut rice with sambal, ikan bilis, and egg', price: '' },
          ],
        },
      ],
    },
    {
      blockType: 'order-widget',
      variant: 'inline',
      title: 'Order Online',
      orderTypes: ['Pickup', 'Delivery'],
    },
  ],
}
