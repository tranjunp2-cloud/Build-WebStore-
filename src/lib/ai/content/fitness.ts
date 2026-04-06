import type { CategoryContent } from './types'

export const fitnessContent: CategoryContent = {
  category: 'fitness',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Coach Amir Fitness Studio',
      tagline: 'Transform Your Body, Transform Your Life',
      description:
        'Coach Amir Fitness Studio offers personalised training programmes for all fitness levels. Gym membership (RM 120/month), personal training (RM 80/session), group HIIT classes (RM 35/class), and body transformation packages (RM 1,500 for 12 weeks). Open 6 AM to 11 PM daily.',
      address: 'No. 22, Jalan Damansara, Bukit Damansara, 50490 Kuala Lumpur',
      phone: '+60 12-455 8800',
      email: 'train@coachamir.my',
      heroHeadline: 'Your Fitness Journey Starts Today',
      heroSubheadline:
        'Personal training, group classes, and 12-week transformations — join 2,000+ members who have changed their lives.',
    },
    {
      name: 'Sarah Yoga & Pilates',
      tagline: 'Find Your Balance, Find Your Strength',
      description:
        'Sarah Yoga & Pilates offers classes for beginners to advanced practitioners. Drop-in yoga class (RM 35), Pilates reformer (RM 55), monthly unlimited pass (RM 350), and prenatal yoga (RM 45). Our studio in Desa ParkCity features a serene garden view setting.',
      address: 'Lot G-12, The Waterfront, Desa ParkCity, Jalan Residen, 52200 Kuala Lumpur',
      phone: '+60 3-6280 5500',
      email: 'namaste@sarahyoga.my',
      heroHeadline: 'Breathe, Stretch, Transform',
      heroSubheadline:
        'Yoga and Pilates in a serene garden setting — from gentle flows to challenging reformer sessions.',
    },
    {
      name: 'Iron Republic Gym',
      tagline: 'Serious Lifting, Serious Results',
      description:
        'Iron Republic is the Klang Valley\'s premier strength training gym. Monthly membership (RM 150), powerlifting coaching (RM 100/session), competition prep (RM 2,000/12 weeks), and strongman training (RM 60/class). Equipped with Eleiko, Rogue, and Hammer Strength equipment.',
      address: 'Lot 3, Jalan PJS 11/20, Bandar Sunway, 46150 Petaling Jaya',
      phone: '+60 3-5612 8800',
      email: 'lift@ironrepublic.my',
      heroHeadline: 'Built for Strength, Designed for Champions',
      heroSubheadline:
        'Premium equipment, expert coaching, and a community that pushes you to your best.',
    },
    {
      name: 'SwimFit Aquatic Centre',
      tagline: 'Learn to Swim, Learn to Excel',
      description:
        'SwimFit offers swimming lessons for all ages. Kids learn-to-swim (RM 200/month for 8 lessons), adult classes (RM 250/month), competitive training (RM 350/month), and aqua aerobics (RM 30/class). Olympic-size heated pool with certified AUSTSWIM instructors.',
      address: 'No. 5, Persiaran Tropicana, Tropicana Golf & Country Resort, 47410 Petaling Jaya',
      phone: '+60 3-7804 3300',
      email: 'swim@swimfit.my',
      heroHeadline: 'Making Waves, Building Confidence',
      heroSubheadline:
        'Swimming lessons for kids and adults — from first splash to competitive excellence.',
    },
    {
      name: 'Muay Thai Academy KL',
      tagline: 'The Art of Eight Limbs in Kuala Lumpur',
      description:
        'Muay Thai Academy KL teaches authentic Muay Thai for fitness and competition. Beginner classes (RM 180/month), intermediate (RM 220/month), sparring sessions (RM 40/class), and private coaching (RM 120/session). Our head coach is a former Lumpinee champion.',
      address: 'No. 15, Jalan Yap Kwan Seng, 50450 Kuala Lumpur',
      phone: '+60 3-2164 7700',
      email: 'fight@muaythai-kl.my',
      heroHeadline: 'Train Like a Fighter, Feel Like a Champion',
      heroSubheadline:
        'Authentic Muay Thai training for fitness, self-defence, and competition — all levels welcome.',
    },
  ],
  testimonials: [
    {
      name: 'Faizal Rahman',
      title: 'Software Engineer',
      rating: 5,
      quote:
        'Coach Amir\'s 12-week transformation programme changed my life. I lost 15kg and gained confidence I never had. The RM 1,500 was the best investment in myself. The community keeps me motivated.',
    },
    {
      name: 'Dr. Chew Mei Yen',
      title: 'Obstetrician',
      rating: 5,
      quote:
        'I recommend Sarah\'s prenatal yoga to all my patients. The classes are safe, well-structured, and the instructors understand pregnancy-related modifications. The RM 45 per class is very reasonable.',
    },
    {
      name: 'Arjun Singh',
      title: 'National Powerlifter',
      rating: 5,
      quote:
        'Iron Republic is the real deal. The Eleiko equipment is world-class, and the coaching staff helped me add 30kg to my total in 6 months. Best strength gym in Malaysia, no contest.',
    },
    {
      name: 'Puan Azizah',
      title: 'Mother of Two',
      rating: 4,
      quote:
        'Both my kids learned to swim at SwimFit. The instructors are patient and encouraging. My 6-year-old went from being terrified of water to swimming a full lap in just 3 months.',
    },
  ],
  faqItems: [
    {
      question: 'Do I need to be fit to start?',
      answer:
        'Not at all! All our programmes cater to beginners. Our trainers will assess your current fitness level and create a plan tailored to your abilities. Everyone starts somewhere — the important thing is to start.',
    },
    {
      question: 'What should I bring for my first class?',
      answer:
        'Bring comfortable workout clothing, a water bottle, and a small towel. For yoga, we provide mats but you may bring your own. For swimming, bring your swimwear and goggles. Lockers and shower facilities are available at all locations.',
    },
    {
      question: 'Can I freeze my membership?',
      answer:
        'Yes, you can freeze your membership for up to 2 months per year at no additional charge. This is useful for holidays, Ramadan, or medical reasons. Simply notify our front desk at least 3 days before your billing date.',
    },
    {
      question: 'Do you offer corporate rates?',
      answer:
        'Yes, we offer corporate membership packages with discounts of 15-25% depending on the number of employees enrolled. This includes group class access, fitness assessments, and quarterly wellness reports for your HR team.',
    },
  ],
  industryBlocks: [
    {
      blockType: 'class-schedule',
      variant: 'weekly-grid',
      title: 'Class Timetable',
      showInstructor: true,
      showCapacity: true,
      showDifficulty: true,
      bookingEnabled: true,
    },
    {
      blockType: 'pricing-table',
      variant: 'three-tier',
      title: 'Membership Plans',
      currency: 'RM',
      billingPeriod: 'month',
      tiers: ['Basic', 'Unlimited', 'Premium'],
      highlightTier: 'Unlimited',
      showAnnualToggle: true,
    },
  ],
}
