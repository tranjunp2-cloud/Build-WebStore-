import type { CategoryContent } from './types'

export const educationContent: CategoryContent = {
  category: 'education',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Cikgu Hafiz Tuition Centre',
      tagline: 'SPM & STPM Excellence, One Student at a Time',
      description:
        'Cikgu Hafiz Tuition Centre has helped over 3,000 students achieve A grades in SPM and STPM. Monthly tuition (RM 200/subject) covers Add Maths, Physics, Chemistry, and Biology. Intensive SPM crash courses (RM 500 per subject) available during school holidays.',
      address: 'No. 10, Jalan USJ 9/5T, Subang Jaya, 47620 Selangor',
      phone: '+60 3-8023 4400',
      email: 'enrol@cikguhafiz.my',
      heroHeadline: 'SPM As Start Here',
      heroSubheadline:
        'Over 3,000 A-grade students and counting. Monthly tuition from RM 200 — enrol today for the next intake.',
    },
    {
      name: 'Ms. Lee Coding Academy',
      tagline: 'Teaching Kids to Code, Creating Future Innovators',
      description:
        'Ms. Lee Coding Academy teaches children aged 7-17 to code through fun, project-based learning. Weekly classes (RM 280/month), STEM holiday camps (RM 500/week), and robotics workshops (RM 350/session). Our students have won national-level coding competitions.',
      address: 'Unit 3-8, Taman Tun Dr Ismail, Jalan Burhanuddin Helmi, 60000 Kuala Lumpur',
      phone: '+60 12-773 5500',
      email: 'learn@msleecodingacademy.my',
      heroHeadline: 'Where Kids Build the Future with Code',
      heroSubheadline:
        'Fun coding classes for ages 7-17. From Scratch to Python — weekly lessons and holiday STEM camps.',
    },
    {
      name: 'Lingua Language Centre',
      tagline: 'Master a New Language in 3 Months',
      description:
        'Lingua Language Centre offers group and private classes in Mandarin, Japanese, Korean, and English. Group classes (RM 600 per 12-week term), private tutoring (RM 120/hour), and corporate language training (from RM 3,000). JLPT and TOPIK exam preparation available.',
      address: 'Level 5, Wisma MCA, Jalan Ampang, 50450 Kuala Lumpur',
      phone: '+60 3-2161 8800',
      email: 'speak@lingua.my',
      heroHeadline: 'Speak a New Language with Confidence',
      heroSubheadline:
        'Mandarin, Japanese, Korean, and English classes — group, private, and corporate training available.',
    },
    {
      name: 'EduStar International Preschool',
      tagline: 'Where Little Minds Shine Bright',
      description:
        'EduStar provides bilingual (English-Mandarin) preschool education for children aged 3-6. Our programme follows the Malaysian National Preschool Standard Curriculum with enrichment in STEM, art, and music. Monthly fees from RM 1,200 including meals and learning materials.',
      address: 'No. 5, Jalan PJU 5/1, Dataran Sunway, Kota Damansara, 47810 Petaling Jaya',
      phone: '+60 3-6142 3300',
      email: 'admissions@edustar.my',
      heroHeadline: 'A Bright Start for Your Little Star',
      heroSubheadline:
        'Bilingual preschool with STEM enrichment. Nurturing curious minds aged 3-6 in a safe, joyful environment.',
    },
    {
      name: 'MasterClass Online MY',
      tagline: 'Professional Skills Training for Malaysian Adults',
      description:
        'MasterClass Online MY offers live virtual workshops in digital marketing (RM 299), data analytics (RM 399), project management (RM 350), and UI/UX design (RM 450). Each course is 8 weeks with live sessions, assignments, and a completion certificate recognised by HRDC.',
      address: 'Level 10, Menara Hap Seng 2, Plaza Hap Seng, Jalan P. Ramlee, 50250 Kuala Lumpur',
      phone: '+60 3-2022 1100',
      email: 'enrol@masterclassonline.my',
      heroHeadline: 'Level Up Your Career from Anywhere',
      heroSubheadline:
        'HRDC-claimable online courses in digital marketing, data analytics, and design. Learn from industry experts.',
    },
  ],
  testimonials: [
    {
      name: 'Nur Syafiqah',
      title: 'SPM Student',
      rating: 5,
      quote:
        'I scored A+ in Add Maths thanks to Cikgu Hafiz! His teaching method makes even the hardest topics easy to understand. The RM 200/month is the best investment my parents made for my education.',
    },
    {
      name: 'Vincent Tan',
      title: 'Parent',
      rating: 5,
      quote:
        'My 10-year-old son joined Ms. Lee Coding Academy and now he is building his own games in Scratch. The STEM camp during school holidays kept him learning while having fun. Highly recommended!',
    },
    {
      name: 'Anita Kaur',
      title: 'HR Manager',
      company: 'Petronas',
      rating: 4,
      quote:
        'We sent our team for the digital marketing course at MasterClass Online. The HRDC claimable feature made it easy to get management approval. Practical content and great instructors.',
    },
    {
      name: 'Dr. Wong Mei Ling',
      title: 'Parent',
      rating: 5,
      quote:
        'EduStar has been wonderful for our daughter. She is now fluent in both English and Mandarin at age 5. The teachers are nurturing and the monthly reports keep us informed about her progress.',
    },
  ],
  faqItems: [
    {
      question: 'Is the course HRDC claimable?',
      answer:
        'Yes, our professional development courses are HRDC (Human Resources Development Corporation) approved. Malaysian employers registered with HRDC can claim training fees through the HRDC e-LATiH portal. We provide all necessary documentation for claims.',
    },
    {
      question: 'What is the class size?',
      answer:
        'Group classes are limited to 12-15 students for tuition centres and 8-10 for language and coding classes. This ensures personalised attention for every student. Private one-on-one sessions are also available at premium rates.',
    },
    {
      question: 'Do you offer trial classes?',
      answer:
        'Yes, we offer one free trial class for new students. This allows you or your child to experience our teaching methodology before committing. Book a trial through our website or WhatsApp us.',
    },
    {
      question: 'What qualifications do your teachers have?',
      answer:
        'All our tutors hold minimum Bachelor degrees in their teaching subjects. SPM tutors have at least 5 years of teaching experience. Language instructors are native or near-native speakers with TESOL, JLPT N1, or HSK 6 certifications.',
    },
  ],
  industryBlocks: [
    {
      blockType: 'course-catalog',
      variant: 'card-grid',
      title: 'Our Programmes',
      showPrice: true,
      showDuration: true,
      showLevel: true,
      currency: 'RM',
      filterByCategory: true,
    },
    {
      blockType: 'booking-widget',
      variant: 'inline',
      title: 'Register for a Trial Class',
      fields: ['programme', 'studentAge', 'preferredDay', 'parentName', 'phone', 'email'],
    },
  ],
}
