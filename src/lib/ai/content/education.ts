import type { CategoryContent } from './types'

export const educationContent: CategoryContent = {
  category: 'education',
  locale: 'en-MY',
  businesses: [
    {
      name: 'Cikgu Hafiz Tuition Centre',
      tagline: 'SPM & STPM Tuition',
      description:
        'Cikgu Hafiz Tuition Centre offers subject tuition in Add Maths, Physics, Chemistry, and Biology for SPM and STPM students, with revision courses during school holidays.',
      address: 'No. 10, Jalan USJ 9/5T, Subang Jaya, 47620 Selangor',
      phone: '+60 3-8023 4400',
      email: 'enrol@cikguhafiz.my',
      heroHeadline: 'SPM Preparation Starts Here',
      heroSubheadline:
        'Subject tuition and revision courses for SPM and STPM students.',
    },
    {
      name: 'Ms. Lee Coding Academy',
      tagline: 'Coding Classes for Kids',
      description:
        'Ms. Lee Coding Academy teaches children to code through project-based learning, with weekly classes, holiday STEM camps, and robotics workshops.',
      address: 'Unit 3-8, Taman Tun Dr Ismail, Jalan Burhanuddin Helmi, 60000 Kuala Lumpur',
      phone: '+60 12-773 5500',
      email: 'learn@msleecodingacademy.my',
      heroHeadline: 'Where Kids Learn to Build with Code',
      heroSubheadline:
        'Coding classes, holiday STEM camps, and robotics workshops.',
    },
    {
      name: 'Lingua Language Centre',
      tagline: 'Language Classes for Every Learner',
      description:
        'Lingua Language Centre offers group and private classes in Mandarin, Japanese, Korean, and English, plus corporate language training and exam preparation.',
      address: 'Level 5, Wisma MCA, Jalan Ampang, 50450 Kuala Lumpur',
      phone: '+60 3-2161 8800',
      email: 'speak@lingua.my',
      heroHeadline: 'Speak a New Language with Confidence',
      heroSubheadline:
        'Group, private, and corporate language classes.',
    },
    {
      name: 'EduStar International Preschool',
      tagline: 'Where Little Minds Grow',
      description:
        'EduStar is a preschool offering early childhood education with enrichment in STEM, art, and music.',
      address: 'No. 5, Jalan PJU 5/1, Dataran Sunway, Kota Damansara, 47810 Petaling Jaya',
      phone: '+60 3-6142 3300',
      email: 'admissions@edustar.my',
      heroHeadline: 'A Bright Start for Your Little Star',
      heroSubheadline:
        'Early learning with STEM, art, and music enrichment.',
    },
    {
      name: 'MasterClass Online MY',
      tagline: 'Professional Skills Training for Adults',
      description:
        'MasterClass Online MY offers live online workshops in digital marketing, data analytics, project management, and UI/UX design.',
      address: 'Level 10, Menara Hap Seng 2, Plaza Hap Seng, Jalan P. Ramlee, 50250 Kuala Lumpur',
      phone: '+60 3-2022 1100',
      email: 'enrol@masterclassonline.my',
      heroHeadline: 'Level Up Your Skills from Anywhere',
      heroSubheadline:
        'Live online courses in marketing, data, and design.',
    },
  ],
  testimonials: [],
  faqItems: [],
  industryBlocks: [
    {
      blockType: 'course-catalog',
      variant: 'card-grid',
      title: 'Our Programmes',
      showPrice: false,
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
