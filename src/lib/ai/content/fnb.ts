import type { CategoryContent } from './types'

export const fnbContent: CategoryContent = {
  category: 'fnb',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Kopitiam Ah Huat',
      tagline: 'Traditional Kopitiam, Modern Vibes',
      description:
        'Kopitiam Ah Huat brings the charm of old-school Malaysian coffee culture to a modern setting. Our signature kopi O (RM 3.50), kopi tarik (RM 4), toast with kaya and butter (RM 3), and half-boiled eggs (RM 2.50) are made the traditional way. Free Wi-Fi and cosy seating for remote workers.',
      address: 'No. 32, Jalan Sultan, Chinatown, 50000 Kuala Lumpur',
      phone: '+60 3-2022 1188',
      email: 'kopi@ahhuatkopitiam.my',
      heroHeadline: 'Where Every Cup Tells a Story',
      heroSubheadline:
        'Traditional kopi, fresh toast, and good company — the kopitiam experience, reimagined.',
    },
    {
      name: 'Lune Artisan Bakery',
      tagline: 'French-Inspired Pastries, Malaysian Heart',
      description:
        'Lune Artisan Bakery crafts French pastries with local Malaysian twists. Our butter croissant (RM 8), pandan danish (RM 10), salted egg yolk tart (RM 7), and durian mille-feuille (RM 15) are baked fresh every morning. Custom cakes from RM 120 for birthdays and events.',
      address: 'No. 11, Jalan Bangkung, Bangsar, 59100 Kuala Lumpur',
      phone: '+60 12-668 3300',
      email: 'order@lunebakery.my',
      heroHeadline: 'Baked with Love, Every Single Morning',
      heroSubheadline:
        'French pastries with a Malaysian soul — croissants, tarts, and custom cakes baked fresh daily.',
    },
    {
      name: 'Bubble Lab Tea House',
      tagline: 'Handcrafted Bubble Tea, Premium Ingredients',
      description:
        'Bubble Lab uses only premium loose-leaf tea and fresh milk in every drink. Original milk tea (RM 9.90), brown sugar boba (RM 11.90), matcha latte (RM 12.90), and fruit tea series (from RM 8.90). We make our tapioca pearls in-house daily for the freshest chew.',
      address: 'Lot G-08, Pavilion KL, Jalan Bukit Bintang, 55100 Kuala Lumpur',
      phone: '+60 3-2110 3388',
      email: 'sip@bubblelab.my',
      heroHeadline: 'Premium Bubble Tea, Made Fresh Daily',
      heroSubheadline:
        'Loose-leaf tea, fresh milk, and handmade boba — taste the difference quality makes.',
    },
    {
      name: 'Dapur Ummi Catering',
      tagline: 'Home-Cooked Malay Catering for Every Occasion',
      description:
        'Dapur Ummi provides halal catering for weddings, corporate events, and private functions. Nasi briyani set (RM 15/pax), nasi lemak buffet (RM 12/pax), satay station (RM 3/stick, minimum 100 sticks), and full kenduri package (from RM 25/pax for 200 guests minimum).',
      address: 'No. 48, Jalan Wangsa Delima, Wangsa Maju, 53300 Kuala Lumpur',
      phone: '+60 12-330 8800',
      email: 'order@dapurummi.my',
      heroHeadline: 'Catering That Feels Like Home',
      heroSubheadline:
        'Halal wedding, corporate, and event catering — authentic Malay flavours served with love.',
    },
    {
      name: 'Greenleaf Juice Bar',
      tagline: 'Cold-Pressed Juices and Healthy Bites',
      description:
        'Greenleaf serves cold-pressed juices (RM 12), acai bowls (RM 18), overnight oats (RM 10), and healthy wraps (RM 15). Our juice cleanse programme (RM 99 for 3-day, RM 180 for 5-day) has helped hundreds of Malaysians kickstart healthier habits. All ingredients are locally sourced.',
      address: 'No. 3, Jalan Telawi 5, Bangsar, 59100 Kuala Lumpur',
      phone: '+60 12-445 7700',
      email: 'juice@greenleaf.my',
      heroHeadline: 'Fuel Your Body with Nature\'s Best',
      heroSubheadline:
        'Cold-pressed juices, acai bowls, and juice cleanses — healthy living starts with what you drink.',
    },
  ],
  testimonials: [
    {
      name: 'Uncle Chong',
      title: 'Regular Customer',
      rating: 5,
      quote:
        'Ah Huat\'s kopi O reminds me of my father\'s kopitiam in Ipoh. The RM 3.50 price is honest, and the taste is authentic. I come here every morning before work — the kaya toast is perfect.',
    },
    {
      name: 'Aisyah Razali',
      title: 'Food Blogger',
      company: '@aisyah.eats',
      rating: 5,
      quote:
        'Lune Bakery\'s pandan danish is absolute genius — French technique with Malaysian flavours. The salted egg yolk tart at RM 7 is a steal compared to similar cafes. My followers always ask about this place.',
    },
    {
      name: 'Puan Zainab',
      title: 'Mother of the Bride',
      rating: 5,
      quote:
        'Dapur Ummi catered my daughter\'s wedding for 500 guests. The nasi briyani was fragrant and flavourful, the satay station was a huge hit, and not a single guest left hungry. RM 25/pax for that quality is amazing.',
    },
    {
      name: 'Joanne Yap',
      title: 'Yoga Instructor',
      rating: 4,
      quote:
        'Greenleaf\'s 5-day juice cleanse helped me reset after a holiday. The juices taste fresh (not that watered-down kind), and the RM 180 price point is fair for 30 bottles of cold-pressed goodness.',
    },
  ],
  faqItems: [
    {
      question: 'Do you offer bulk ordering or catering?',
      answer:
        'Yes, most of our F&B outlets offer bulk ordering. Bakeries accept custom cake orders with 3-day advance notice. Catering services require 2-week booking for events under 100 pax and 1-month booking for larger events. Corporate standing orders are available with monthly billing.',
    },
    {
      question: 'Are your products halal?',
      answer:
        'All our Malay-owned outlets are JAKIM halal-certified. Chinese kopitiam and bakeries may not have halal certification but do not serve pork or alcohol. Please check individual outlet certifications on our website or ask our staff directly.',
    },
    {
      question: 'Do you have options for dietary restrictions?',
      answer:
        'Yes, we cater to various dietary needs. Vegan and vegetarian options are available at most outlets. Gluten-free alternatives can be arranged with advance notice. Our juice bar is fully plant-based. Please inform our staff of any allergies when ordering.',
    },
    {
      question: 'Can I order online for pickup or delivery?',
      answer:
        'Yes, we are available on GrabFood and Foodpanda for delivery. You can also order through our website for pickup — online orders get 5% off. For custom cakes and catering, please WhatsApp us or fill in the order form on our website.',
    },
  ],
  industryBlocks: [
    {
      blockType: 'menu-display',
      variant: 'categorised',
      title: 'Our Menu',
      showImages: true,
      showPrices: true,
      showDescription: true,
      currency: 'RM',
      categories: ['Hot Drinks', 'Cold Drinks', 'Pastries', 'Snacks'],
    },
    {
      blockType: 'order-widget',
      variant: 'inline',
      title: 'Order Online',
      orderTypes: ['Pickup', 'Delivery'],
      minimumOrder: 'RM 20',
      deliveryRadius: '10km',
      estimatedTime: '30-45 min',
    },
  ],
}
