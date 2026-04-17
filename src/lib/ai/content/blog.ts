import type { CategoryContent } from './types'

export const blogContent: CategoryContent = {
  category: 'blog',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Makan Sedap KL',
      tagline: 'Your Guide to the Best Eats in Kuala Lumpur',
      description:
        'Makan Sedap KL is a lifestyle and food blog covering the best restaurants, hawker stalls, and hidden gems across the Klang Valley. From authentic nasi lemak reviews to modern fusion cafes, we publish weekly taste tests, recipes, and food guides trusted by over 50,000 monthly readers.',
      address: 'No. 15, Jalan Alor, Bukit Bintang, 50200 Kuala Lumpur',
      phone: '+60 12-889 3301',
      email: 'hello@makansedapkl.my',
      heroHeadline: 'Discover the Best Food in KL',
      heroSubheadline:
        'Honest reviews, hidden gems, and authentic recipes — your trusted guide to eating well in Kuala Lumpur.',
    },
    {
      name: 'TechNode SEA',
      tagline: 'Covering Southeast Asia\'s Tech and Startup Scene',
      description:
        'TechNode SEA is an independent media company reporting on startups, venture capital, and digital innovation across Southeast Asia. We publish daily news, founder interviews, and in-depth analyses of the region\'s fastest-growing tech ecosystem. Trusted by founders, investors, and policymakers.',
      address: 'Level 10, Mercu UEM, Jalan Stesen Sentral 5, KL Sentral, 50470 Kuala Lumpur',
      phone: '+60 3-2772 6600',
      email: 'editorial@technodesea.my',
      heroHeadline: 'The Pulse of Southeast Asia\'s Tech Scene',
      heroSubheadline:
        'Breaking news, founder stories, and funding insights from the region\'s most dynamic startup ecosystem.',
    },
    {
      name: 'Jalan Jalan MY',
      tagline: 'Explore Malaysia and Beyond',
      description:
        'Jalan Jalan MY is a travel blog dedicated to exploring Malaysia and Southeast Asia. We cover budget itineraries, hidden trails, island guides, and cultural experiences. With over 300 destination guides and a community of 80,000 subscribers, we help Malaysians travel smarter.',
      address: 'Unit 5-2, Wisma Central, Jalan Ampang, 50450 Kuala Lumpur',
      phone: '+60 17-332 8850',
      email: 'travel@jalanjalanmy.my',
      heroHeadline: 'Travel Malaysia Like a Local',
      heroSubheadline:
        'Budget itineraries, hidden trails, and island guides — 300+ destinations to fuel your next adventure.',
    },
    {
      name: 'Gaya Magazine Online',
      tagline: 'Malaysian Fashion, Beauty & Lifestyle',
      description:
        'Gaya Magazine Online is a digital fashion and beauty publication celebrating Malaysian style. We feature local designers, skincare reviews, seasonal trend reports, and interviews with the creative talent shaping KL\'s fashion scene. Published daily with a curated weekly newsletter.',
      address: 'Lot 3-12, Bangsar Village II, Jalan Telawi 1, 59100 Kuala Lumpur',
      phone: '+60 3-2287 4400',
      email: 'editor@gayamagazine.my',
      heroHeadline: 'Malaysian Style, Redefined',
      heroSubheadline:
        'Trend reports, designer spotlights, and beauty reviews — celebrating the best of Malaysian fashion.',
    },
    {
      name: 'Duit Pintar MY',
      tagline: 'Personal Finance for Working Malaysians',
      description:
        'Duit Pintar MY is a trusted personal finance blog helping Malaysians make smarter money decisions. Weekly articles cover EPF optimisation, Tabung Haji, Amanah Saham, stock picks on Bursa Malaysia, income tax relief strategies, and mortgage comparison. 45,000 subscribers and 1.2M monthly pageviews.',
      address: 'Suite 8-3, Menara UOA Bangsar, Jalan Bangsar Utama 1, 59000 Kuala Lumpur',
      phone: '+60 3-2283 5588',
      email: 'hello@duitpintar.my',
      heroHeadline: 'Smart Money Moves for Malaysians',
      heroSubheadline:
        'EPF tips, tax hacks, and investment guides — practical personal finance for Malaysians who want to build wealth.',
    },
  ],
  testimonials: [
    {
      name: 'Aisyah Nabilah',
      title: 'Loyal Reader',
      rating: 5,
      quote:
        'Makan Sedap KL is my go-to before trying any new restaurant. Their reviews are honest, the photos are gorgeous, and I have never been disappointed following their recommendations.',
    },
    {
      name: 'Kevin Toh',
      title: 'Startup Founder',
      company: 'GrabKerja',
      rating: 5,
      quote:
        'TechNode SEA covered our seed round and the traffic spike was incredible. Their audience is exactly the right crowd — investors, founders, and tech enthusiasts who actually engage.',
    },
    {
      name: 'Priya Devi',
      title: 'Newsletter Subscriber',
      rating: 4,
      quote:
        'The Jalan Jalan MY weekly newsletter is the highlight of my inbox. Their Langkawi budget guide saved me at least RM 500 on my last trip. Practical, no-nonsense travel advice.',
    },
    {
      name: 'Nurul Hafizah',
      title: 'Beauty Blogger',
      rating: 5,
      quote:
        'Gaya Magazine is doing something special for Malaysian fashion. They spotlight local designers that bigger publications ignore. Their skincare reviews are thorough and genuinely helpful.',
    },
  ],
  faqItems: [
    {
      question: 'How can I submit an article or guest post?',
      answer:
        'We welcome guest contributions from writers across Malaysia. Send your pitch (150-word summary + writing samples) to our editorial email. We review all submissions within 5 working days and publish 2-3 guest posts per month.',
    },
    {
      question: 'Do you offer advertising or sponsored content?',
      answer:
        'Yes, we offer banner ads, sponsored articles, and social media partnerships. Our media kit with audience demographics and pricing is available on request. All sponsored content is clearly labelled to maintain reader trust.',
    },
    {
      question: 'How do I subscribe to your newsletter?',
      answer:
        'Enter your email in the subscription form on our homepage. Our newsletter goes out every Wednesday with the week\'s top stories, exclusive content, and curated picks. You can unsubscribe at any time with one click.',
    },
    {
      question: 'Are you open to brand collaborations and partnerships?',
      answer:
        'Absolutely. We work with brands on product reviews, event coverage, giveaways, and long-term ambassadorship programmes. Reach out via our partnerships page or email us directly with your proposal.',
    },
  ],
  industryBlocks: [
    {
      blockType: 'blog-list',
      variant: 'featured-grid',
      title: 'Latest Articles',
      categories: ['Food', 'Tech', 'Travel', 'Fashion', 'Lifestyle'],
      articles: [
        { title: '10 Best Nasi Lemak Spots in PJ', category: 'Food', readTime: '5 min' },
        { title: 'KL Startup Funding Hits Record High in Q1', category: 'Tech', readTime: '8 min' },
        { title: 'Hidden Beaches of Terengganu You Must Visit', category: 'Travel', readTime: '6 min' },
        { title: 'Malaysian Designers to Watch in 2026', category: 'Fashion', readTime: '7 min' },
      ],
      showCategory: true,
      showReadTime: true,
      postsPerPage: 9,
    },
    {
      blockType: 'newsletter',
      variant: 'inline-banner',
      title: 'Stay in the Loop',
      description:
        'Join 80,000+ readers who get our best stories delivered every Wednesday. No spam, just quality content.',
      placeholder: 'Enter your email address',
      buttonText: 'Subscribe Free',
      incentive: 'Get our exclusive KL Hidden Gems Guide when you subscribe.',
    },
  ],
}
