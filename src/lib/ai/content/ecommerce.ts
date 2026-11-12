import type { CategoryContent } from './types'

export const ecommerceContent: CategoryContent = {
  category: 'ecommerce',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Nurul Modest Fashion',
      tagline: 'Modest Wear for the Modern Muslimah',
      description:
        'Nurul Modest Fashion offers baju kurung, tudung bawal, and jubah collections designed for everyday and occasion wear.',
      address: 'No. 12, Jalan Bukit Bintang, 55100 Kuala Lumpur',
      phone: '+60 12-345 6789',
      email: 'shop@nurulfashion.com.my',
      heroHeadline: 'Modest Fashion That Speaks Confidence',
      heroSubheadline:
        'Baju kurung, tudung, and jubah collections that blend tradition with modern style.',
    },
    {
      name: 'Wei Liang Electronics',
      tagline: 'Gadgets and Electronics Store',
      description:
        'Wei Liang Electronics is a shop for smartphones, laptops, and accessories.',
      address: 'Lot 3-21, Level 3, Plaza Low Yat, Jalan Bukit Bintang, 55100 Kuala Lumpur',
      phone: '+60 3-2148 8820',
      email: 'sales@weiliang.my',
      heroHeadline: 'Smartphones, Laptops, and Accessories',
      heroSubheadline:
        'Browse gadgets and everyday tech in one place.',
    },
    {
      name: 'Kampung Crafts MY',
      tagline: 'Handmade Malaysian Craft Products',
      description:
        'Kampung Crafts offers handmade products such as batik scarves, songket pouches, rattan bags, and pewter accessories.',
      address: 'No. 7, Lorong Hang Jebat, 75200 Melaka',
      phone: '+60 6-283 4521',
      email: 'hello@kampungcrafts.my',
      heroHeadline: 'Malaysian Crafts, Delivered to You',
      heroSubheadline:
        'Batik, songket, rattan, and pewter pieces for your home and wardrobe.',
    },
    {
      name: 'FreshBox Grocer',
      tagline: 'Groceries Delivered to Your Door',
      description:
        'FreshBox Grocer offers vegetables, fruits, and everyday groceries that you can order online.',
      address: 'Warehouse 5, Taman Perindustrian Puchong, Jalan Puchong, 47100 Puchong',
      phone: '+60 3-8060 2233',
      email: 'order@freshbox.my',
      heroHeadline: 'Fresh Groceries, Straight to Your Kitchen',
      heroSubheadline:
        'Order vegetables, fruits, and pantry staples online.',
    },
    {
      name: 'Aisyah Baby World',
      tagline: 'Everything Your Little One Needs',
      description:
        'Aisyah Baby World stocks baby products including strollers, car seats, baby food, and clothing sets.',
      address: 'No. 88, Jalan SS2/55, SS2, 47300 Petaling Jaya',
      phone: '+60 3-7865 1199',
      email: 'care@aisyahbaby.my',
      heroHeadline: 'Products for Little Ones and Their Parents',
      heroSubheadline:
        'From strollers to baby food and clothing.',
    },
    {
      name: 'Apex Activewear MY',
      tagline: 'Activewear for Every Move',
      description:
        'Apex Activewear MY sells running tops, training shorts, sports hijabs, and footwear for active Malaysians.',
      address: 'Lot 2-18, Pavilion Bukit Jalil, 57000 Kuala Lumpur',
      phone: '+60 3-2783 4410',
      email: 'move@apexactivewear.my',
      heroHeadline: 'Move Faster. Train Stronger.',
      heroSubheadline:
        'Shop activewear and footwear for training and everyday movement.',
    },
    {
      name: 'Arena Sports Supply',
      tagline: 'Equipment for Training, Teams, and Competition',
      description:
        'Arena Sports Supply is an online store for gym equipment, football gear, racquets, recovery tools, and team kits.',
      address: 'No. 21, Jalan SS 15/4, 47500 Subang Jaya',
      phone: '+60 3-5632 9088',
      email: 'team@arenasports.my',
      heroHeadline: 'Gear Up for Your Next Personal Best',
      heroSubheadline:
        'Training equipment, team sports essentials, and recovery gear.',
    },
  ],
  testimonials: [],
  faqItems: [],
  industryBlocks: [
    {
      blockType: 'product-showcase',
      variant: 'grid',
      title: 'Featured Products',
      columns: 4,
      showPrice: true,
      showRating: false,
      currency: 'RM',
      addToCartButton: true,
    },
    {
      blockType: 'promotion-banner',
      variant: 'full-width',
      title: 'New Arrivals',
      subtitle: 'Browse our latest collection',
      ctaText: 'Shop Now',
      countdownEnabled: false,
    },
  ],
}
