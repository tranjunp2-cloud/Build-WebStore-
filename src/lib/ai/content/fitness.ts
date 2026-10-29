import type { CategoryContent } from './types'

export const fitnessContent: CategoryContent = {
  category: 'fitness',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Coach Amir Fitness Studio',
      tagline: 'Training for Every Fitness Level',
      description:
        'Coach Amir Fitness Studio offers personalised training programmes for all fitness levels, including gym membership, personal training, group HIIT classes, and body transformation packages.',
      address: 'No. 22, Jalan Damansara, Bukit Damansara, 50490 Kuala Lumpur',
      phone: '+60 12-455 8800',
      email: 'train@coachamir.my',
      heroHeadline: 'Your Fitness Journey Starts Today',
      heroSubheadline:
        'Personal training, group classes, and structured transformation programmes.',
    },
    {
      name: 'Sarah Yoga & Pilates',
      tagline: 'Find Your Balance, Find Your Strength',
      description:
        'Sarah Yoga & Pilates offers yoga and Pilates classes for beginners through advanced practitioners, including drop-in classes, reformer Pilates, and prenatal yoga.',
      address: 'Lot G-12, The Waterfront, Desa ParkCity, Jalan Residen, 52200 Kuala Lumpur',
      phone: '+60 3-6280 5500',
      email: 'namaste@sarahyoga.my',
      heroHeadline: 'Breathe, Stretch, Transform',
      heroSubheadline:
        'Yoga and Pilates classes, from gentle flows to reformer sessions.',
    },
    {
      name: 'Iron Republic Gym',
      tagline: 'Strength Training Gym',
      description:
        'Iron Republic is a strength training gym offering memberships, powerlifting coaching, competition prep, and strongman training.',
      address: 'Lot 3, Jalan PJS 11/20, Bandar Sunway, 46150 Petaling Jaya',
      phone: '+60 3-5612 8800',
      email: 'lift@ironrepublic.my',
      heroHeadline: 'Built for Strength',
      heroSubheadline:
        'Strength equipment, coaching, and a training community.',
    },
    {
      name: 'SwimFit Aquatic Centre',
      tagline: 'Swimming Lessons for All Ages',
      description:
        'SwimFit offers swimming lessons for children and adults, competitive training, and aqua aerobics.',
      address: 'No. 5, Persiaran Tropicana, Tropicana Golf & Country Resort, 47410 Petaling Jaya',
      phone: '+60 3-7804 3300',
      email: 'swim@swimfit.my',
      heroHeadline: 'Making Waves, Building Confidence',
      heroSubheadline:
        'Swimming lessons for kids and adults, from first splash to competitive training.',
    },
    {
      name: 'Muay Thai Academy KL',
      tagline: 'The Art of Eight Limbs in Kuala Lumpur',
      description:
        'Muay Thai Academy KL teaches Muay Thai for fitness and competition, with beginner and intermediate classes, sparring sessions, and private coaching.',
      address: 'No. 15, Jalan Yap Kwan Seng, 50450 Kuala Lumpur',
      phone: '+60 3-2164 7700',
      email: 'fight@muaythai-kl.my',
      heroHeadline: 'Train Like a Fighter',
      heroSubheadline:
        'Muay Thai for fitness, self-defence, and competition.',
    },
  ],
  testimonials: [],
  faqItems: [],
  industryBlocks: [
    {
      blockType: 'class-schedule',
      variant: 'grid',
      headline: 'Class Timetable',
      showCapacity: false,
      highlightToday: true,
    },
    {
      blockType: 'pricing-table',
      variant: 'three-tier',
      title: 'Membership Plans',
      currency: 'RM',
      billingPeriod: 'month',
      tiers: ['Basic', 'Standard', 'Plus'],
      showAnnualToggle: false,
    },
  ],
}
