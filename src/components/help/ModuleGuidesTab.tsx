'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { X, BookOpen } from 'lucide-react'
import { useI18n } from '@/i18n'

interface StepData {
  num: number
  title: string
  desc: string
  imgSrc?: string
  imgTitle?: string
  imgWidth?: number
  imgHeight?: number
  guide: string[]
}

interface ModuleData {
  id: string
  icon: string
  label: string
  steps: StepData[]
}

export function ModuleGuidesTab() {
  const { t } = useI18n()

  const MODULES_DATA: ModuleData[] = [
    {
      id: 'dashboard',
      icon: '📊',
      label: t.help.modules.data.dashboard.label,
      steps: [
        {
          num: 1,
          title: t.help.modules.data.dashboard.steps[0].title,
          desc: t.help.modules.data.dashboard.steps[0].desc,
          imgSrc: '/help/dashboard-1-overview.jpg',
          imgWidth: 3322,
          imgHeight: 2072,
          imgTitle: t.help.modules.data.dashboard.steps[0].imgTitle,
          guide: [
            'Navigate to the <strong>Dashboard</strong> from the sidebar — this is your home screen after logging in.',
            'The <strong>Overview tab</strong> shows key metrics: total website views (Traffic), link clicks (Leads), and user engagement.',
            'Use the <strong>Period Selector</strong> (Today / 7 days / 30 days) at the top right to change the time range for analytics.',
            'Click <strong>Customize</strong> to drag-and-drop, show/hide metrics cards to personalize your dashboard layout.',
            'The <strong>SEO Health Widget</strong> displays your site\'s SEO score out of 100 with actionable warnings — click "AI Fix All Issues" to auto-optimize.',
          ],
        }
      ]
    },
    {
      id: 'builder',
      icon: '🚀',
      label: 'AI Website Builder',
      steps: [
        {
          num: 1,
          title: 'Enter Business Information',
          desc: 'Provide basic information so AI can create the perfect website for you.',
          imgSrc: '/help/builder-1-info.jpg',
          imgWidth: 916,
          imgHeight: 827,
          imgTitle: 'Business Information Form',
          guide: [
            'Enter your <strong>Business Name</strong> (e.g., "The Cookie House", "Beauty Spa Hana").',
            'Select your <strong>Industry</strong> — choose from: Restaurant/Cafe/F&B, Shop/Fashion/Ecommerce, Tech/IT/SaaS, Health/Dental/Clinic, Real Estate/Property, Portfolio/Freelancer/Agency, Education/Training, Gym/Fitness/Yoga, or Other.',
            'Describe your <strong>Products / Services</strong> — AI will use this to suggest product images and layout.',
            'Optionally add a <strong>Description</strong> for more context about your business.',
            'Click <strong>"Continue — AI will create your website →"</strong> to start the generation process.',
          ],
        },
        {
          num: 2,
          title: 'AI Generates Your Website',
          desc: 'AI analyzes your business information and generates the perfect design automatically.',
          imgSrc: '/help/builder-2-processing.jpg',
          imgWidth: 510,
          imgHeight: 509,
          imgTitle: 'AI Processing Screen',
          guide: [
            'After clicking Continue, AI begins <strong>analyzing your business information</strong>.',
            'The system then <strong>generates content & design</strong> — including layout, colors, and images matching your industry.',
            'Finally, it <strong>prepares the preview</strong> so you can review the result.',
            'This process typically takes 30-60 seconds. You\'ll see a progress bar with each step.',
          ],
        },
        {
          num: 3,
          title: 'Preview & Responsive Check',
          desc: 'Review your AI-generated website on both Desktop and Mobile views before publishing.',
          imgSrc: '/help/builder-3-preview-desktop.jpg',
          imgWidth: 942,
          imgHeight: 741,
          imgTitle: 'Website Preview - Desktop',
          guide: [
            'Once generated, you\'ll see the <strong>Website Preview</strong> page with your AI-created site.',
            'Toggle between <strong>Desktop</strong> and <strong>Mobile</strong> views to check responsive layout.',
            'Click <strong>"View Full Preview"</strong> to open the website in a new tab for a closer look.',
            'If satisfied, proceed to publish your website. You can always edit it later in the Builder.',
          ],
        },
        {
          num: 4,
          title: 'AI Chat — Edit with Conversation',
          desc: 'Use AI Chat to make changes to your website by simply describing what you want.',
          imgSrc: '/help/builder-4-ai-chat.jpg',
          imgWidth: 371,
          imgHeight: 838,
          imgTitle: 'AI Chat Editor',
          guide: [
            'Open the <strong>AI CHAT</strong> tab in the left sidebar of the Editor.',
            'Type what you want to change — e.g., <strong>"Can you change the color to pink?"</strong> or <strong>"Add a new section"</strong>.',
            'AI will process your request and show <strong>"Preparing changes for preview..."</strong> while updating.',
            'Use the <strong>quick suggestion chips</strong> at the bottom (e.g., "Change color", "+ Add section") for common actions.',
            'Changes are applied in real-time to the preview — review and keep or ask for further adjustments.',
          ],
        },
        {
          num: 5,
          title: 'Change Template',
          desc: 'Browse and switch to a different template design at any time.',
          imgSrc: '/help/builder-5-templates.jpg',
          imgWidth: 1210,
          imgHeight: 837,
          imgTitle: 'Template Gallery',
          guide: [
            'In the Editor, click to open the <strong>Template Gallery</strong> to browse available designs.',
            'Use the <strong>search bar</strong> or <strong>category filters</strong> (Restaurant, E-Commerce, Beauty, Tech, Health, Education, etc.) to find the right template.',
            'Each template shows a preview, name, description, and color palette.',
            'Click on a template to apply it — your content will be migrated to the new design layout.',
            'Both Free and <strong>Pro</strong> templates are available depending on your plan.',
          ],
        },
        {
          num: 6,
          title: 'Edit Components on Each Page',
          desc: 'Use the Components panel to add, remove, and customize sections on your pages.',
          imgSrc: '/help/builder-6-components.jpg',
          imgWidth: 353,
          imgHeight: 816,
          imgTitle: 'Components Panel',
          guide: [
            'Open the <strong>COMPO...</strong> (Components) tab in the left sidebar.',
            'Browse component categories: <strong>Basics</strong> (Hero, CTA, About, Features, Step Process, Service Cards), <strong>Content</strong>, <strong>Media</strong>, <strong>Business</strong>, <strong>Commerce</strong>, <strong>Form & Contact</strong>, <strong>Widgets</strong>, and <strong>Layout</strong>.',
            'Use <strong>Search blocks</strong> to quickly find a specific component type.',
            'Drag a component from the panel to add it to your page at the desired position.',
            'Click on any component in the preview to select and edit its content, styling, and settings.',
            'Switch between pages using the <strong>PAGES</strong> tab to edit different sections of your website.',
          ],
        },
      ]
    },
    {
      id: 'blog',
      icon: '📝',
      label: t.help.modules.data.blog.label,
      steps: [
        {
          num: 1,
          title: 'Access Blog Management',
          desc: 'Navigate to the Blog section from the sidebar to view and manage all your blog posts.',
          guide: [
            'Click <strong>"📝 Blog"</strong> in the left sidebar to open the blog management page.',
            'You\'ll see a list of all your blog posts with their status (Draft / Published), category, and publish date.',
            'Use the <strong>search bar</strong> to find specific posts, or filter by status and category.',
            'Click <strong>[+ New Post]</strong> at the top right to start creating a new blog post.',
          ],
        },
        {
          num: 2,
          title: 'Create & Edit Blog Post',
          desc: 'Use the rich text editor to write content, add images, and configure post settings.',
          imgSrc: '/help/blog-1-create.jpg',
          imgWidth: 1626,
          imgHeight: 728,
          imgTitle: 'Blog Editor & AI Assistant',
          guide: [
            'Enter your <strong>Post Title</strong> at the top — the URL slug is auto-generated from the title (editable).',
            'Use the <strong>Rich Text Editor</strong> to write your content with formatting: headings, bold, italic, lists, links, and embedded images.',
            'On the right sidebar, configure <strong>Post Settings</strong>: Category, Author, and Publish Date.',
            'Upload a <strong>Featured Thumbnail</strong> (PNG/JPG up to 10MB) — this appears in blog listings and social shares.',
            'Fill in <strong>Search Optimization (SEO)</strong> section: Meta Title (max 60 chars) and Meta Description (max 160 chars) for better search ranking.',
          ],
        },
        {
          num: 3,
          title: 'Use AI Assistant',
          desc: 'Let AI help you generate blog ideas and content to save time.',
          guide: [
            'Click the <strong>"AI Assistant"</strong> button (purple, top right) to open the AI blog generator.',
            'Enter your <strong>topic</strong> (e.g., "E-commerce Marketing Strategies") in the text field.',
            'Choose a <strong>Tone of Voice</strong>: Professional, Friendly, or Persuasive.',
            'Click <strong>"Generate Blog Idea"</strong> — AI will create a draft title, content outline, and SEO meta for you.',
            'You can also click <strong>"Generate via AI"</strong> next to the SEO section to auto-generate meta title and description.',
          ],
        },
        {
          num: 4,
          title: 'Publish or Save Draft',
          desc: 'Save your work as a draft or publish it live to your website.',
          guide: [
            'Click <strong>"Save Draft"</strong> to save your post without publishing — you can continue editing later.',
            'Click <strong>"Publish"</strong> to make your post live on your website immediately.',
            'Published posts appear on your website\'s blog page and are indexed by search engines.',
            'You can unpublish or edit any post at any time from the blog list page.',
          ],
        },
      ]
    },
    {
      id: 'settings',
      icon: '⚙️',
      label: t.help.modules.data.settings.label,
      steps: [
        {
          num: 1,
          title: t.help.modules.data.settings.steps[0].title,
          desc: t.help.modules.data.settings.steps[0].desc,
          imgSrc: '/help/settings-1-domains.jpg',
          imgWidth: 1631,
          imgHeight: 790,
          imgTitle: t.help.modules.data.settings.steps[0].imgTitle,
          guide: [
            'Go to <strong>"⚙️ Settings → Domains"</strong> from the sidebar to open Domain Management.',
            'Your default subdomain (e.g., <code>yourstore.web-v2.dev.ecommercehub.my</code>) is automatically assigned and connected.',
            'Click <strong>"+ Add Custom Domain"</strong> to connect your own domain (e.g., <code>abccompany.com</code>).',
            'Configure DNS at your domain registrar:<ul class="mt-2 ml-5 list-disc text-[#9CA3AF] text-[13px] leading-[22px]"><li><strong>A Record</strong> — Point to the static IP shown (e.g., 162.159.140.98)</li><li><strong>CNAME Record</strong> — Point to <code>web-v2.dev.ecommercehub.my</code></li></ul>',
            'Click <strong>"Verify Connection"</strong> to check DNS propagation. Status will change from "Pending Verification" to "Connected".',
            'Use <strong>"Select primary domain"</strong> to set which domain visitors see as the main URL.',
          ],
        }
      ]
    }
  ]

  const [activeModule, setActiveModule] = useState<string>('dashboard')
  const [lightboxImg, setLightboxImg] = useState<{ src: string; title: string } | null>(null)

  // Ref container hooks for Anchor scrolling
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Xử lý deep Url Hash Anchor jump TC-F20.08 và TC-F20.13
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '')
      if (hash && MODULES_DATA.some(m => m.id === hash)) {
        setActiveModule(hash)
        setTimeout(() => {
          const el = sectionRefs.current[hash]
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        }, 150)
      }
    }

    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const handleTabClick = (id: string) => {
    setActiveModule(id)
    window.history.pushState(null, '', `#${id}`)
  }

  // Handle ESC closing Lightbox TC-F20.10
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxImg(null)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  // Lock Body Scrolling when lightbox open TC-F20.17
  useEffect(() => {
    if (lightboxImg) {
      const originalStyle = window.getComputedStyle(document.body).overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalStyle
      }
    }
  }, [lightboxImg])

  return (
    <div className="w-full flex flex-col pt-2">
      {/* Module Tabs Header */}
      <div className="flex flex-wrap gap-2 mb-6">
        {MODULES_DATA.map((module) => (
          <button
            key={module.id}
            onClick={() => handleTabClick(module.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-[20px] border transition-all duration-200 ${
              activeModule === module.id
                ? 'bg-[#3B82F6] border-[#3B82F6] text-white'
                : 'bg-[#161E2E] border-[#1F2937] text-[#9CA3AF] hover:border-[#3B82F6] hover:text-[#3B82F6]'
            }`}
          >
            {module.icon} {module.label}
          </button>
        ))}
      </div>

      {/* Module Contents Array */}
      {MODULES_DATA.map((module) => (
        <div
          key={module.id}
          id={module.id}
          ref={(el) => {
            sectionRefs.current[module.id] = el
          }}
          className={`flex-col transition-opacity duration-300 ${
            activeModule === module.id ? 'flex opacity-100' : 'hidden opacity-0'
          }`}
        >
          {module.steps.map((step) => (
            <div
              key={`${module.id}-step-${step.num}`}
              className="bg-[#161E2E] border border-[#1F2937] rounded-xl p-6 mb-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.5)]"
            >
              <h3 className="text-[16px] font-bold text-white flex items-center mb-3">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#2DD4BF] text-white text-[13px] font-bold mr-2.5 shrink-0">
                  {step.num}
                </span>
                {step.title}
              </h3>

              <div className="text-[#9CA3AF] text-[14px] leading-[22px] mb-4">
                <p dangerouslySetInnerHTML={{ __html: step.desc }} />
              </div>

              {/* Screenshot thumbnail (click to zoom) */}
              {step.imgSrc && (() => {
                const w = step.imgWidth || 800
                const h = step.imgHeight || 450
                const isPortrait = h > w
                // Cap: landscape max 480px wide, portrait max 240px wide
                const maxW = isPortrait ? 'max-w-[240px]' : 'max-w-[480px]'
                return (
                  <div
                    className="rounded-lg overflow-hidden border border-[#1F2937] mb-4 cursor-pointer hover:border-[#3B82F6]/50 hover:shadow-[0_0_12px_rgba(59,130,246,0.15)] transition-all bg-[#0F172A] inline-flex flex-col"
                    onClick={() => setLightboxImg({ src: step.imgSrc!, title: step.imgTitle || step.title })}
                  >
                    <div className={maxW}>
                      <Image
                        src={step.imgSrc!}
                        alt={step.imgTitle || step.title}
                        width={w}
                        height={h}
                        className="w-full h-auto block"
                        quality={95}
                        unoptimized
                      />
                    </div>
                    <div className="px-3 py-1.5 border-t border-[#1F2937] flex items-center justify-between gap-4 w-full">
                      <span className="text-[11px] text-[#9CA3AF] truncate">{step.imgTitle}</span>
                      <span className="text-[11px] text-[#3B82F6] whitespace-nowrap">Click to zoom</span>
                    </div>
                  </div>
                )
              })()}

              {/* Step-by-step text guide */}
              {step.guide.length > 0 && (
                <div className="rounded-lg border border-[#1F2937] bg-[#0F172A] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="h-4 w-4 text-[#3B82F6]" />
                    <span className="text-[13px] font-semibold text-[#3B82F6]">Step-by-step Guide</span>
                  </div>
                  <ol className="space-y-2.5">
                    {step.guide.map((line, idx) => (
                      <li key={idx} className="flex gap-3 text-[13px] leading-[20px]">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#1E293B] text-[#3B82F6] text-[11px] font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="text-[#CBD5E1]" dangerouslySetInnerHTML={{ __html: line }} />
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Lightbox / Modal View TC-F20.09 & TC-F20.16 */}
      {lightboxImg && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightboxImg.title}
          className="fixed inset-0 z-[1000] bg-black/85 flex items-center justify-center animate-in fade-in duration-200 cursor-zoom-out"
          onClick={() => setLightboxImg(null)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              setLightboxImg(null)
            }}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/30 text-white flex items-center justify-center transition-colors z-[1001]"
          >
            <X className="w-5 h-5" />
          </button>

          <div
            className="relative w-[90vw] max-w-6xl h-[85vh] rounded-xl overflow-hidden cursor-default touch-pan-x touch-pan-y touch-pinch-zoom bg-[#1e293b] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={lightboxImg.src}
              alt={lightboxImg.title}
              fill
              className="object-contain"
              quality={100}
              sizes="90vw"
            />
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 text-[12px]">
            {t.help.modules.tab.escToClose}
          </div>
        </div>
      )}
    </div>
  )
}
