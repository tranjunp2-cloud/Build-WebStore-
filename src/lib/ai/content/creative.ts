import type { CategoryContent } from './types'

export const creativeContent: CategoryContent = {
  category: 'creative',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Studio Kreatif',
      tagline: 'Design That Tells Your Brand Story',
      description:
        'Studio Kreatif is a full-service creative agency in Bangsar. We offer logo design (from RM 800), brand identity packages (RM 3,500), packaging design (from RM 1,200), and corporate stationery (RM 600). Every project begins with a deep-dive brand discovery session.',
      address: 'No. 9, Lorong Maarof, Bangsar, 59000 Kuala Lumpur',
      phone: '+60 12-889 4400',
      email: 'create@studiokreatif.my',
      heroHeadline: 'Brands Built with Purpose and Passion',
      heroSubheadline:
        'Logo design, brand identity, and packaging — we craft visual stories that connect with your audience.',
    },
    {
      name: 'Alia Photography',
      tagline: 'Capturing Moments That Matter',
      description:
        'Alia Photography specialises in wedding photography (from RM 3,500), corporate portraits (RM 500/person), product photography (RM 150/product), and event coverage (from RM 2,000). Based in KL with travel available across Malaysia and Singapore.',
      address: 'Unit 5-1, Jalan Bangkung, Bangsar, 59100 Kuala Lumpur',
      phone: '+60 17-223 6600',
      email: 'shoot@aliaphotography.my',
      heroHeadline: 'Every Picture Tells a Beautiful Story',
      heroSubheadline:
        'Wedding, corporate, and product photography — timeless images crafted with heart and artistry.',
    },
    {
      name: 'PixelForge Web Studio',
      tagline: 'Websites That Work as Hard as You Do',
      description:
        'PixelForge builds high-performance websites for Malaysian businesses. Landing page (RM 1,500), corporate website (RM 3,500), e-commerce site (from RM 8,000), and custom web applications (from RM 15,000). All sites are mobile-responsive and SEO-optimised.',
      address: 'Level 3, Menara MBMR, Jalan Syed Putra, 58000 Kuala Lumpur',
      phone: '+60 3-2282 7700',
      email: 'build@pixelforge.my',
      heroHeadline: 'Websites That Convert Visitors into Customers',
      heroSubheadline:
        'From landing pages to full e-commerce — mobile-first design, SEO-optimised, built to grow your business.',
    },
    {
      name: 'Reel Motion Video Production',
      tagline: 'Video Content That Captivates',
      description:
        'Reel Motion produces video content for brands, events, and social media. Corporate video (from RM 5,000), social media content packages (RM 2,500/month for 8 videos), event highlight reels (from RM 3,000), and animation (from RM 4,000). Full 4K production capability.',
      address: 'No. 28, Jalan Bukit Ceylon, 50200 Kuala Lumpur',
      phone: '+60 3-2031 5500',
      email: 'film@reelmotion.my',
      heroHeadline: 'Bring Your Brand to Life on Screen',
      heroSubheadline:
        'Corporate videos, social content, and animations — professional video production that tells your story.',
    },
    {
      name: 'Suara Music Studio',
      tagline: 'Professional Audio Production in KL',
      description:
        'Suara Music Studio offers recording (RM 150/hour), mixing and mastering (RM 500/song), jingle production (from RM 2,000), podcast recording (RM 100/hour), and voiceover recording (RM 200/session). Our studio features Neve console and Neumann microphones.',
      address: 'No. 14, Jalan Damai, Taman Desa, 58100 Kuala Lumpur',
      phone: '+60 3-7981 4400',
      email: 'record@suarastudio.my',
      heroHeadline: 'Where Sound Becomes Art',
      heroSubheadline:
        'Recording, mixing, mastering, and podcast production — world-class audio from the heart of KL.',
    },
  ],
  testimonials: [
    {
      name: 'Hafiz Azman',
      title: 'Founder',
      company: 'Warung Modern',
      rating: 5,
      quote:
        'Studio Kreatif designed our entire brand identity — logo, packaging, and menu design. The RM 3,500 brand package was incredible value. Our customers constantly compliment how professional everything looks.',
    },
    {
      name: 'Chen Wei & Siti',
      title: 'Newlyweds',
      rating: 5,
      quote:
        'Alia captured our wedding beautifully. Every photo tells a story and the emotion is so real. Our families cried looking through the album. Worth every ringgit of the RM 5,000 premium package.',
    },
    {
      name: 'Darren Goh',
      title: 'E-commerce Manager',
      company: 'NatureMY Skincare',
      rating: 4,
      quote:
        'PixelForge rebuilt our e-commerce site and conversions jumped 40% in the first month. The site loads fast, looks great on mobile, and the checkout flow is seamless. Great team to work with.',
    },
    {
      name: 'Rina Othman',
      title: 'Content Creator',
      rating: 5,
      quote:
        'Suara Studio is where I record all my podcast episodes. The sound quality is amazing, and the engineer always makes me sound my best. RM 100/hour for this quality is a steal!',
    },
  ],
  faqItems: [
    {
      question: 'How long does a typical project take?',
      answer:
        'Logo design: 2-3 weeks. Brand identity package: 4-6 weeks. Website: 4-8 weeks depending on complexity. Video production: 2-4 weeks from concept to final delivery. We provide a detailed timeline during the kickoff meeting.',
    },
    {
      question: 'Do you offer revisions?',
      answer:
        'Yes, all packages include 2-3 rounds of revisions. Logo projects include up to 3 initial concepts. Additional revisions beyond the included rounds are charged at RM 200/hour. We find that clear briefing upfront minimises revision rounds.',
    },
    {
      question: 'Can you work within a tight budget?',
      answer:
        'We offer packages at different price points to suit various budgets. For startups, we have lite packages starting from RM 800 for logo-only. We can also phase larger projects across multiple months to spread the cost.',
    },
    {
      question: 'Do you retain the rights to my content?',
      answer:
        'No. Upon full payment, all intellectual property rights are transferred to you. We may request permission to feature the work in our portfolio, but this is always optional and requires your written consent.',
    },
  ],
  industryBlocks: [
    {
      blockType: 'portfolio-gallery',
      variant: 'masonry',
      title: 'Our Work',
      showCategory: true,
      showClient: true,
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
