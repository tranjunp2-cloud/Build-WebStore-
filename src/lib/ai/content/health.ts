import type { CategoryContent } from './types'

export const healthContent: CategoryContent = {
  category: 'health',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Klinik Dr. Tan & Partners',
      tagline: 'Your Family Health Partner in PJ',
      description:
        'Klinik Dr. Tan offers general practice services for the whole family, including consultations, health screening packages, vaccinations, and minor procedures.',
      address: 'No. 15, Jalan SS2/64, SS2, 47300 Petaling Jaya',
      phone: '+60 3-7877 3300',
      email: 'clinic@drtan.my',
      heroHeadline: 'Healthcare for Your Whole Family',
      heroSubheadline:
        'General practice, health screenings, and vaccinations.',
    },
    {
      name: 'Dr. Aishah Dental Care',
      tagline: 'Gentle Dentistry, Beautiful Smiles',
      description:
        'Dr. Aishah Dental Care provides dental services including check-ups and cleaning, teeth whitening, braces consultation, clear aligners, and dental implants.',
      address: 'No. 8, Persiaran Gurney, Gurney Drive, 10250 George Town, Penang',
      phone: '+60 4-228 1100',
      email: 'smile@draishah.my',
      heroHeadline: 'A Brighter Smile Starts Here',
      heroSubheadline:
        'From routine check-ups to aligners and implants.',
    },
    {
      name: 'Harmony TCM Centre',
      tagline: 'Traditional Chinese Medicine for Modern Wellness',
      description:
        'Harmony TCM Centre offers traditional Chinese medicine services including acupuncture, herbal consultation, cupping therapy, and tuina massage.',
      address: 'No. 33, Jalan Imbi, 55100 Kuala Lumpur',
      phone: '+60 3-2145 6677',
      email: 'wellness@harmonytcm.my',
      heroHeadline: 'Ancient Wisdom, Modern Healing',
      heroSubheadline:
        'Acupuncture, herbal medicine, and cupping therapy.',
    },
    {
      name: 'PhysioFirst Rehabilitation',
      tagline: 'Physiotherapy and Rehabilitation',
      description:
        'PhysioFirst offers physiotherapy for sports injury rehabilitation and chronic pain management, including assessments, follow-up sessions, dry needling, and sports massage.',
      address: 'Unit 5-2, Kompleks Sukan Bukit Jalil, Jalan 1/155B, 57000 Kuala Lumpur',
      phone: '+60 3-9054 2200',
      email: 'recover@physiofirst.my',
      heroHeadline: 'Move Better, Live Better',
      heroSubheadline:
        'Physiotherapy for sports injuries, chronic pain, and recovery.',
    },
    {
      name: 'MindWell Psychology',
      tagline: 'Mental Health Support',
      description:
        'MindWell Psychology offers counselling and therapy services, including individual therapy, couples counselling, and corporate wellness workshops.',
      address: 'Level 12, Menara UOA Bangsar, Jalan Bangkung, 59100 Kuala Lumpur',
      phone: '+60 3-2201 8800',
      email: 'support@mindwell.my',
      heroHeadline: 'Your Mental Health Matters',
      heroSubheadline:
        'Therapy, couples counselling, and workplace wellness.',
    },
  ],
  testimonials: [],
  faqItems: [],
  industryBlocks: [
    {
      blockType: 'booking-widget',
      variant: 'inline',
      title: 'Book an Appointment',
      fields: ['department', 'doctor', 'date', 'time', 'name', 'phone', 'insurance'],
      departments: ['General Practice', 'Dental', 'TCM', 'Physiotherapy', 'Psychology'],
    },
    {
      blockType: 'team-showcase',
      variant: 'card-grid',
      title: 'Our Medical Team',
      showQualifications: false,
      showSpecialisations: true,
      showLanguages: false,
    },
  ],
}
