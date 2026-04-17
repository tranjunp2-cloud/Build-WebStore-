import type { CategoryContent } from './types'

export const beautyContent: CategoryContent = {
  category: 'beauty',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Farah Glow Studio',
      tagline: 'Your Skin Deserves the Best Care',
      description:
        'Farah Glow Studio specialises in facial treatments tailored for Malaysian skin. Our signature hydrating facial (RM 120) uses halal-certified Korean skincare products. We also offer acne treatment (RM 150), microdermabrasion (RM 200), and bridal packages (from RM 800).',
      address: 'No. 5, Jalan Telawi 2, Bangsar, 59100 Kuala Lumpur',
      phone: '+60 12-988 7766',
      email: 'glow@farahstudio.my',
      heroHeadline: 'Reveal Your Natural Glow',
      heroSubheadline:
        'Expert facials, halal-certified products, and personalised treatments for every skin type.',
    },
    {
      name: 'Priya Nails & Beauty',
      tagline: 'Nails, Lashes, and Everything Fabulous',
      description:
        'Priya Nails & Beauty offers a full range of nail and lash services. Classic manicure (RM 45), gel extensions (RM 85), eyelash extensions (RM 120), and our popular mani-pedi combo (RM 75). Walk-ins welcome, but booking recommended on weekends.',
      address: 'Lot G-15, Bangsar Village II, Jalan Telawi 1, 59100 Kuala Lumpur',
      phone: '+60 3-2282 3345',
      email: 'book@priyanails.my',
      heroHeadline: 'Gorgeous Nails, Stunning Lashes',
      heroSubheadline:
        'From classic manicures to dramatic lash extensions — treat yourself to a beauty transformation.',
    },
    {
      name: 'Zen Hair Salon',
      tagline: 'Premium Hair Care in Mont Kiara',
      description:
        'Zen Hair Salon is Mont Kiara\'s go-to for haircuts (RM 65), colouring (from RM 180), keratin treatments (RM 350), and scalp therapy (RM 120). Our stylists are trained in Japan and Korea, using only sulphate-free and cruelty-free products.',
      address: 'No. 2-1, Jalan Kiara, Mont Kiara, 50480 Kuala Lumpur',
      phone: '+60 3-6211 8899',
      email: 'hello@zenhair.my',
      heroHeadline: 'Where Great Hair Begins',
      heroSubheadline:
        'Japanese-trained stylists, premium products, and a relaxing ambience — your hair transformation awaits.',
    },
    {
      name: 'Seri Spa & Wellness',
      tagline: 'Traditional Malay Spa Rituals',
      description:
        'Seri Spa offers authentic Malay spa treatments using traditional ingredients. Our signature urutan Melayu (RM 180) features warm herbal compresses. Also available: body scrub with kunyit (RM 100), post-natal massage (RM 200), and couple packages (RM 350).',
      address: 'No. 30, Jalan Bangkung, Bangsar, 59100 Kuala Lumpur',
      phone: '+60 3-2201 5500',
      email: 'relax@serispa.my',
      heroHeadline: 'Timeless Malay Wellness Traditions',
      heroSubheadline:
        'Urutan Melayu, herbal body scrubs, and post-natal care — ancient healing for modern living.',
    },
    {
      name: 'K-Beauty Lab',
      tagline: 'Korean Beauty Treatments in Malaysia',
      description:
        'K-Beauty Lab brings the latest Korean skincare innovations to Malaysia. Our BB Glow treatment (RM 250) gives you that K-drama skin, while our aqua peel facial (RM 160) deep-cleanses and hydrates. All products imported directly from Seoul.',
      address: 'Level 3, Pavilion KL, Jalan Bukit Bintang, 55100 Kuala Lumpur',
      phone: '+60 3-2110 4488',
      email: 'info@kbeautylab.my',
      heroHeadline: 'Get That K-Drama Glow',
      heroSubheadline:
        'Authentic Korean beauty treatments and products — because your skin deserves Seoul-level care.',
    },
  ],
  testimonials: [
    {
      name: 'Siti Aminah',
      title: 'Bride-to-Be',
      rating: 5,
      quote:
        'Farah Glow did my bridal skincare package and my skin has never looked better. The RM 800 package was worth every sen — 6 sessions that completely transformed my complexion before the big day.',
    },
    {
      name: 'Michelle Tan',
      title: 'Marketing Manager',
      company: 'L&T Advertising',
      rating: 5,
      quote:
        'I get my nails done at Priya every two weeks. The gel extensions last perfectly and the team always remembers my preferences. Best nail salon in Bangsar, hands down.',
    },
    {
      name: 'Raj Kumari',
      title: 'New Mother',
      rating: 4,
      quote:
        'The post-natal massage at Seri Spa was exactly what I needed. The therapist was gentle yet effective, and the herbal compress was so soothing. Highly recommend for all new mums.',
    },
    {
      name: 'Lim Siew Ting',
      title: 'Beauty Enthusiast',
      rating: 5,
      quote:
        'The BB Glow treatment at K-Beauty Lab gave me the glass skin I always wanted. My foundation routine went from 15 minutes to zero. Absolutely love it!',
    },
  ],
  faqItems: [
    {
      question: 'Do I need to book an appointment?',
      answer:
        'We recommend booking in advance, especially for weekends and public holidays. You can book online through our website, WhatsApp us, or call directly. Walk-ins are welcome on weekdays subject to availability.',
    },
    {
      question: 'Are your products halal-certified?',
      answer:
        'Yes, all facial and body products used at our studios are halal-certified by JAKIM or internationally recognised halal bodies. We also use cruelty-free and vegan-friendly options where available.',
    },
    {
      question: 'What is your cancellation policy?',
      answer:
        'You may reschedule or cancel up to 4 hours before your appointment at no charge. Late cancellations or no-shows will incur a 50% charge of the service booked. This helps us manage our schedule for all clients.',
    },
    {
      question: 'Do you offer packages or memberships?',
      answer:
        'Yes! We offer monthly memberships starting from RM 199 which include one facial per month plus 15% off all other services. Bridal and event packages are also available — contact us for a customised quote.',
    },
  ],
  industryBlocks: [
    {
      blockType: 'booking-widget',
      variant: 'sidebar',
      title: 'Book Your Appointment',
      fields: ['service', 'therapist', 'date', 'time', 'name', 'phone'],
      services: [
        'Hydrating Facial — RM 120',
        'Gel Manicure — RM 65',
        'Hair Colouring — from RM 180',
        'Urutan Melayu — RM 180',
      ],
    },
    {
      blockType: 'service-list',
      variant: 'categorised',
      title: 'Our Services',
      showPrices: true,
      showDuration: true,
      currency: 'RM',
      categories: ['Facials', 'Nails', 'Hair', 'Body & Spa'],
    },
  ],
}
