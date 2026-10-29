import type { CategoryContent } from './types'

export const creativeContent: CategoryContent = {
  category: 'creative',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Studio Kreatif',
      tagline: 'Design That Tells Your Brand Story',
      description:
        'Studio Kreatif is a creative agency offering logo design, brand identity packages, packaging design, and corporate stationery. Every project begins with a brand discovery session.',
      address: 'No. 9, Lorong Maarof, Bangsar, 59000 Kuala Lumpur',
      phone: '+60 12-889 4400',
      email: 'create@studiokreatif.my',
      heroHeadline: 'Brands Built with Purpose',
      heroSubheadline:
        'Logo design, brand identity, and packaging that connect with your audience.',
    },
    {
      name: 'Alia Photography',
      tagline: 'Photography for Moments That Matter',
      description:
        'Alia Photography covers wedding photography, corporate portraits, product photography, and event coverage.',
      address: 'Unit 5-1, Jalan Bangkung, Bangsar, 59100 Kuala Lumpur',
      phone: '+60 17-223 6600',
      email: 'shoot@aliaphotography.my',
      heroHeadline: 'Every Picture Tells a Story',
      heroSubheadline:
        'Wedding, corporate, and product photography.',
    },
    {
      name: 'PixelForge Web Studio',
      tagline: 'Websites Built for Your Business',
      description:
        'PixelForge builds websites for businesses, from landing pages and corporate websites to e-commerce sites and custom web applications.',
      address: 'Level 3, Menara MBMR, Jalan Syed Putra, 58000 Kuala Lumpur',
      phone: '+60 3-2282 7700',
      email: 'build@pixelforge.my',
      heroHeadline: 'Websites That Work for Your Business',
      heroSubheadline:
        'Landing pages, corporate sites, and online stores.',
    },
    {
      name: 'Reel Motion Video Production',
      tagline: 'Video Content for Brands',
      description:
        'Reel Motion produces video content for brands, events, and social media, including corporate videos, social media content, event highlight reels, and animation.',
      address: 'No. 28, Jalan Bukit Ceylon, 50200 Kuala Lumpur',
      phone: '+60 3-2031 5500',
      email: 'film@reelmotion.my',
      heroHeadline: 'Bring Your Brand to Life on Screen',
      heroSubheadline:
        'Corporate videos, social content, and animation.',
    },
    {
      name: 'Suara Music Studio',
      tagline: 'Audio Production in Kuala Lumpur',
      description:
        'Suara Music Studio offers recording, mixing and mastering, jingle production, podcast recording, and voiceover recording.',
      address: 'No. 14, Jalan Damai, Taman Desa, 58100 Kuala Lumpur',
      phone: '+60 3-7981 4400',
      email: 'record@suarastudio.my',
      heroHeadline: 'Where Sound Becomes Art',
      heroSubheadline:
        'Recording, mixing, mastering, and podcast production.',
    },
  ],
  testimonials: [],
  faqItems: [],
  industryBlocks: [
    {
      blockType: 'portfolio-gallery',
      variant: 'masonry',
      title: 'Our Work',
      showCategory: true,
      showClient: false,
      lightboxEnabled: true,
      categories: ['Branding', 'Web Design', 'Photography', 'Video'],
    },
    {
      blockType: 'process-timeline',
      variant: 'horizontal',
      title: 'Our Process',
      steps: [
        { title: 'Discovery', description: 'Understand your goals and audience' },
        { title: 'Concept', description: 'Present creative directions' },
        { title: 'Refine', description: 'Iterate based on your feedback' },
        { title: 'Deliver', description: 'Final files and handover' },
      ],
    },
  ],
}
