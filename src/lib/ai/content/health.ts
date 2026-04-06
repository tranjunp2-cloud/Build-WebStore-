import type { CategoryContent } from './types'

export const healthContent: CategoryContent = {
  category: 'health',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Klinik Dr. Tan & Partners',
      tagline: 'Your Family Health Partner in PJ',
      description:
        'Klinik Dr. Tan offers comprehensive general practice services for the whole family. General consultation (RM 80), health screening packages (from RM 250), vaccinations, and minor procedures. We accept all major insurance panels including Great Eastern, AIA, and Prudential.',
      address: 'No. 15, Jalan SS2/64, SS2, 47300 Petaling Jaya',
      phone: '+60 3-7877 3300',
      email: 'clinic@drtan.my',
      heroHeadline: 'Quality Healthcare for Your Whole Family',
      heroSubheadline:
        'General practice, health screenings, and vaccinations — accepted by all major insurance panels.',
    },
    {
      name: 'Dr. Aishah Dental Care',
      tagline: 'Gentle Dentistry, Beautiful Smiles',
      description:
        'Dr. Aishah Dental Care provides a full range of dental services. Dental check-up and cleaning (RM 150), teeth whitening (RM 800), braces consultation (free), Invisalign (from RM 12,000), and dental implants (from RM 5,000). Painless treatment guaranteed.',
      address: 'No. 8, Persiaran Gurney, Gurney Drive, 10250 George Town, Penang',
      phone: '+60 4-228 1100',
      email: 'smile@draishah.my',
      heroHeadline: 'A Brighter Smile Starts Here',
      heroSubheadline:
        'From routine check-ups to Invisalign and implants — gentle dentistry for confident smiles.',
    },
    {
      name: 'Harmony TCM Centre',
      tagline: 'Traditional Chinese Medicine for Modern Wellness',
      description:
        'Harmony TCM Centre combines ancient Chinese medicine with modern diagnostic methods. Acupuncture sessions (RM 80), herbal consultation (RM 60), cupping therapy (RM 70), and tuina massage (RM 90). All practitioners are registered with the Traditional and Complementary Medicine Division.',
      address: 'No. 33, Jalan Imbi, 55100 Kuala Lumpur',
      phone: '+60 3-2145 6677',
      email: 'wellness@harmonytcm.my',
      heroHeadline: 'Ancient Wisdom, Modern Healing',
      heroSubheadline:
        'Acupuncture, herbal medicine, and cupping therapy — holistic wellness rooted in TCM tradition.',
    },
    {
      name: 'PhysioFirst Rehabilitation',
      tagline: 'Get Back to Living Pain-Free',
      description:
        'PhysioFirst specialises in sports injury rehabilitation and chronic pain management. Initial assessment (RM 120), follow-up sessions (RM 90), dry needling (RM 100), and sports massage (RM 80). We work with athletes from national sports teams and everyday Malaysians alike.',
      address: 'Unit 5-2, Kompleks Sukan Bukit Jalil, Jalan 1/155B, 57000 Kuala Lumpur',
      phone: '+60 3-9054 2200',
      email: 'recover@physiofirst.my',
      heroHeadline: 'Move Better, Live Better',
      heroSubheadline:
        'Expert physiotherapy for sports injuries, chronic pain, and post-surgery recovery.',
    },
    {
      name: 'MindWell Psychology',
      tagline: 'Professional Mental Health Support',
      description:
        'MindWell Psychology offers confidential counselling and therapy services. Individual therapy (RM 200/session), couples counselling (RM 280/session), and corporate wellness workshops (from RM 1,500). Our clinical psychologists are registered with the Malaysian Board of Psychologists.',
      address: 'Level 12, Menara UOA Bangsar, Jalan Bangkung, 59100 Kuala Lumpur',
      phone: '+60 3-2201 8800',
      email: 'support@mindwell.my',
      heroHeadline: 'Your Mental Health Matters',
      heroSubheadline:
        'Confidential therapy, couples counselling, and corporate wellness — by registered psychologists.',
    },
  ],
  testimonials: [
    {
      name: 'Puan Rohani',
      title: 'Mother of Three',
      rating: 5,
      quote:
        'Dr. Tan has been our family doctor for 8 years. He always takes the time to explain things clearly, and the clinic accepts our AIA insurance so we only pay the RM 30 co-pay.',
    },
    {
      name: 'Kevin Chong',
      title: 'Marathon Runner',
      company: 'KL Running Club',
      rating: 5,
      quote:
        'PhysioFirst got me back on my feet after a knee injury. Four sessions and I was running again. The dry needling treatment was a game-changer for my recovery.',
    },
    {
      name: 'Aini Zahari',
      title: 'HR Director',
      company: 'Sapura Energy',
      rating: 4,
      quote:
        'We engaged MindWell for our employee wellness programme. The workshops on stress management were well-received and our team reported feeling more supported. Great investment in our people.',
    },
    {
      name: 'Lim Ah Kow',
      title: 'Retiree',
      rating: 5,
      quote:
        'I have been going to Harmony TCM for my joint pain. After 6 weeks of acupuncture, I can walk to the pasar without any discomfort. The herbal tea they prescribed also helps me sleep better.',
    },
  ],
  faqItems: [
    {
      question: 'Do you accept insurance panels?',
      answer:
        'Yes, we are panelled with major Malaysian insurers including Great Eastern, AIA, Prudential, Allianz, and AXA. We also accept government employee benefits (SOCSO/PERKESO). Please bring your insurance card for cashless claims.',
    },
    {
      question: 'How do I book an appointment?',
      answer:
        'You can book online through our website, call our clinic directly, or send us a WhatsApp message. We aim to respond within 1 hour during business hours. Walk-ins are welcome but appointment holders get priority.',
    },
    {
      question: 'Are your practitioners registered?',
      answer:
        'All our medical doctors are registered with the Malaysian Medical Council (MMC). Dentists are registered with the Malaysian Dental Council (MDC). TCM practitioners hold valid licenses from the T&CM Division under the Ministry of Health Malaysia.',
    },
    {
      question: 'What are your consultation fees?',
      answer:
        'General consultation starts from RM 80. Specialist consultations range from RM 120 to RM 250 depending on the discipline. We believe in transparent pricing — all fees are displayed at our reception and on our website.',
    },
  ],
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
      showQualifications: true,
      showSpecialisations: true,
      showLanguages: true,
    },
  ],
}
