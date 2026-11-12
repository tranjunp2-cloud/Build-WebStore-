import type { CategoryContent } from './types'

export const beautyContent: CategoryContent = {
  category: 'beauty',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Farah Glow Studio',
      tagline: 'Facial Treatments for Every Skin Type',
      description:
        'Farah Glow Studio offers facial treatments tailored to different skin types and concerns, including hydrating facials, acne care, and microdermabrasion, with bridal skincare packages for the big day.',
      address: 'No. 5, Jalan Telawi 2, Bangsar, 59100 Kuala Lumpur',
      phone: '+60 12-988 7766',
      email: 'glow@farahstudio.my',
      heroHeadline: 'Reveal Your Natural Glow',
      heroSubheadline:
        'Facials and personalised skincare treatments for every skin type.',
    },
    {
      name: 'Priya Nails & Beauty',
      tagline: 'Nails, Lashes, and Beauty Services',
      description:
        'Priya Nails & Beauty offers a range of nail and lash services, including manicures, gel extensions, eyelash extensions, and mani-pedi combinations.',
      address: 'Lot G-15, Bangsar Village II, Jalan Telawi 1, 59100 Kuala Lumpur',
      phone: '+60 3-2282 3345',
      email: 'book@priyanails.my',
      heroHeadline: 'Nails and Lashes, Beautifully Done',
      heroSubheadline:
        'From classic manicures to lash extensions, treat yourself to a fresh look.',
    },
    {
      name: 'Zen Hair Salon',
      tagline: 'Hair Care and Styling in Mont Kiara',
      description:
        'Zen Hair Salon offers haircuts, colouring, keratin treatments, and scalp therapy in a relaxed salon setting.',
      address: 'No. 2-1, Jalan Kiara, Mont Kiara, 50480 Kuala Lumpur',
      phone: '+60 3-6211 8899',
      email: 'hello@zenhair.my',
      heroHeadline: 'Where Great Hair Begins',
      heroSubheadline:
        'Cuts, colour, and treatments for every hair type.',
    },
    {
      name: 'Seri Spa & Wellness',
      tagline: 'Traditional Malay Spa Rituals',
      description:
        'Seri Spa offers spa treatments inspired by Malay traditions, including urutan Melayu with warm herbal compresses, body scrubs, post-natal massage, and couple packages.',
      address: 'No. 30, Jalan Bangkung, Bangsar, 59100 Kuala Lumpur',
      phone: '+60 3-2201 5500',
      email: 'relax@serispa.my',
      heroHeadline: 'Malay Wellness Traditions',
      heroSubheadline:
        'Urutan Melayu, herbal body scrubs, and post-natal care.',
    },
    {
      name: 'K-Beauty Lab',
      tagline: 'Korean-Style Beauty Treatments',
      description:
        'K-Beauty Lab offers Korean-inspired skincare treatments such as BB Glow and aqua peel facials that cleanse and hydrate the skin.',
      address: 'Level 3, Pavilion KL, Jalan Bukit Bintang, 55100 Kuala Lumpur',
      phone: '+60 3-2110 4488',
      email: 'info@kbeautylab.my',
      heroHeadline: 'Korean-Style Skin Treatments',
      heroSubheadline:
        'Korean-inspired facial treatments for hydrated, glowing skin.',
    },
  ],
  testimonials: [],
  faqItems: [],
  industryBlocks: [
    {
      blockType: 'booking-widget',
      variant: 'sidebar',
      title: 'Book Your Appointment',
      fields: ['service', 'therapist', 'date', 'time', 'name', 'phone'],
      services: ['Facial', 'Manicure', 'Hair Colouring', 'Traditional Massage'],
    },
    {
      blockType: 'service-list',
      variant: 'categorised',
      title: 'Our Services',
      showPrices: false,
      showDuration: false,
      currency: 'RM',
      categories: ['Facials', 'Nails', 'Hair', 'Body & Spa'],
    },
  ],
}
