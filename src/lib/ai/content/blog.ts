import type { CategoryContent } from './types'

export const blogContent: CategoryContent = {
  category: 'blog',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Makan Sedap KL',
      tagline: 'Food Reviews and Guides for Kuala Lumpur',
      description:
        'Makan Sedap KL is a lifestyle and food blog covering restaurants, hawker stalls, and cafes across the Klang Valley, with taste tests, recipes, and food guides.',
      address: 'No. 15, Jalan Alor, Bukit Bintang, 50200 Kuala Lumpur',
      phone: '+60 12-889 3301',
      email: 'hello@makansedapkl.my',
      heroHeadline: 'Discover Great Food in KL',
      heroSubheadline:
        'Reviews, local finds, and recipes for eating well in Kuala Lumpur.',
    },
    {
      name: 'TechNode SEA',
      tagline: 'Southeast Asia Tech and Startup News',
      description:
        'TechNode SEA is a media site reporting on startups, venture funding, and digital innovation across Southeast Asia, with news, founder interviews, and analysis.',
      address: 'Level 10, Mercu UEM, Jalan Stesen Sentral 5, KL Sentral, 50470 Kuala Lumpur',
      phone: '+60 3-2772 6600',
      email: 'editorial@technodesea.my',
      heroHeadline: 'News from Southeast Asia\'s Tech Scene',
      heroSubheadline:
        'News, founder stories, and funding insights from the region\'s startup ecosystem.',
    },
    {
      name: 'Jalan Jalan MY',
      tagline: 'Explore Malaysia and Beyond',
      description:
        'Jalan Jalan MY is a travel blog about Malaysia and Southeast Asia, covering itineraries, trails, island guides, and cultural experiences.',
      address: 'Unit 5-2, Wisma Central, Jalan Ampang, 50450 Kuala Lumpur',
      phone: '+60 17-332 8850',
      email: 'travel@jalanjalanmy.my',
      heroHeadline: 'Explore Malaysia, One Trip at a Time',
      heroSubheadline:
        'Itineraries, trails, and island guides for your next trip.',
    },
    {
      name: 'Gaya Magazine Online',
      tagline: 'Malaysian Fashion, Beauty & Lifestyle',
      description:
        'Gaya Magazine Online is a digital fashion and beauty publication covering Malaysian style, with local designers, skincare reviews, seasonal trend reports, and interviews.',
      address: 'Lot 3-12, Bangsar Village II, Jalan Telawi 1, 59100 Kuala Lumpur',
      phone: '+60 3-2287 4400',
      email: 'editor@gayamagazine.my',
      heroHeadline: 'Malaysian Style, Redefined',
      heroSubheadline:
        'Trend reports, designer features, and beauty reviews.',
    },
    {
      name: 'Duit Pintar MY',
      tagline: 'Personal Finance for Working Malaysians',
      description:
        'Duit Pintar MY is a personal finance blog for Malaysians, with articles on EPF, Tabung Haji, Amanah Saham, income tax relief, and mortgage comparison.',
      address: 'Suite 8-3, Menara UOA Bangsar, Jalan Bangsar Utama 1, 59000 Kuala Lumpur',
      phone: '+60 3-2283 5588',
      email: 'hello@duitpintar.my',
      heroHeadline: 'Smart Money Moves for Malaysians',
      heroSubheadline:
        'Practical guides on EPF, tax, and saving for the future.',
    },
  ],
  testimonials: [],
  faqItems: [],
  industryBlocks: [
    {
      blockType: 'blog-list',
      variant: 'featured-grid',
      title: 'Latest Articles',
      categories: ['Food', 'Tech', 'Travel', 'Fashion', 'Lifestyle'],
      articles: [
        { title: 'Weekly Roundup', category: 'Lifestyle', readTime: '5 min' },
        { title: 'Featured Guide', category: 'Travel', readTime: '6 min' },
        { title: 'Behind the Story', category: 'Tech', readTime: '7 min' },
        { title: 'Reader Favourites', category: 'Food', readTime: '5 min' },
      ],
      showCategory: true,
      showReadTime: true,
      postsPerPage: 9,
    },
    {
      blockType: 'newsletter',
      variant: 'inline-banner',
      title: 'Stay in the Loop',
      description: 'Get new stories delivered to your inbox.',
      placeholder: 'Enter your email address',
      buttonText: 'Subscribe',
      incentive: 'Subscribe to get new posts by email.',
    },
  ],
}
