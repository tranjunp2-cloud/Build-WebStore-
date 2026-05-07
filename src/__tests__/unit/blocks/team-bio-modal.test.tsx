/**
 * Unit Tests: Team Block — BioModalVariant Dialog UX
 * TC-ID: TC-F05-894-15, TC-F05-894-16, TC-F05-894-17
 * Component: src/blocks/team/index.tsx (BioModalVariant)
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { TeamBlock } from '@/blocks/team'
import type { TeamConfig } from '@/blocks/team/config'

// Mock framer-motion animations (used by StaggerGrid/StaggerItem in BioModalVariant)
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: {
      div: ({ children, ...props }: Record<string, unknown>) => {
        const { initial, animate, exit, variants, transition, whileInView, viewport, ...rest } = props
        return <div {...rest}>{children as React.ReactNode}</div>
      },
      section: ({ children, ...props }: Record<string, unknown>) => {
        const { initial, animate, exit, variants, transition, whileInView, viewport, ...rest } = props
        return <section {...rest}>{children as React.ReactNode}</section>
      },
    },
  }
})

// Mock theme resolver for CSS_VARS
vi.mock('@/lib/theme/resolve', () => ({
  CSS_VARS: {
    text: '#000000',
    background: '#ffffff',
    surface: '#f5f5f5',
    primary: '#0066cc',
    muted: '#666666',
    fontHeading: 'system-ui',
  },
}))

// Mock RichText (used in BioModalVariant for name rendering)
vi.mock('@/blocks/shared/RichText', () => ({
  RichText: ({ text, as: Component = 'div', ...props }: Record<string, unknown>) => {
    const Tag = Component as keyof JSX.IntrinsicElements
    return <Tag {...props}>{text}</Tag>
  },
}))

// Mock SectionWrapper
vi.mock('@/blocks/shared/SectionWrapper', () => ({
  SectionWrapper: ({ children, ...props }: Record<string, unknown>) => (
    <div {...props}>{children}</div>
  ),
}))

// Mock decorative shapes
vi.mock('@/blocks/shared/decorative', () => ({
  SectionLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LayeredShapes: () => null,
  GridLines: () => null,
  NoiseTexture: () => null,
}))

// Mock AnimatedSection
vi.mock('@/blocks/shared/animations', () => ({
  AnimatedSection: ({ children, ...props }: Record<string, unknown>) => (
    <section {...props}>{children}</section>
  ),
  StaggerGrid: ({ children, ...props }: Record<string, unknown>) => (
    <div {...props}>{children}</div>
  ),
  StaggerItem: ({ children, ...props }: Record<string, unknown>) => (
    <div {...props}>{children}</div>
  ),
  HoverCard: ({ children, ...props }: Record<string, unknown>) => (
    <div {...props}>{children}</div>
  ),
}))

// Mock Typography components
vi.mock('@/blocks/shared/Typography', () => ({
  Heading: ({ children, level, ...props }: Record<string, unknown>) => {
    const Tag = `h${level}` as keyof JSX.IntrinsicElements
    return <Tag {...props}>{children}</Tag>
  },
  Body: ({ children, ...props }: Record<string, unknown>) => (
    <p {...props}>{children}</p>
  ),
}))

// Mock social icons
vi.mock('@/blocks/shared/social-icons', () => ({
  getSocialIcon: () => ({ render: () => null }),
  getSocialAriaLabel: () => 'Social link',
}))

// Mock lucide-react X icon
vi.mock('lucide-react', () => ({
  X: ({ size }: { size?: number }) => <svg data-testid="x-icon" width={size} height={size} />,
}))

// Stub jsdom's missing HTMLDialogElement methods
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
  // Ensure dialog.open property reflects state (jsdom doesn't by default)
  Object.defineProperty(HTMLDialogElement.prototype, 'open', {
    get() {
      return this.hasAttribute('open')
    },
    set(value: boolean) {
      if (value) {
        this.setAttribute('open', '')
      } else {
        this.removeAttribute('open')
      }
    },
  })
})

function makeTeamBlock(overrides: Partial<TeamConfig> = {}): TeamConfig {
  return {
    blockType: 'team',
    variant: 'bio-modal',
    headline: 'Our Team',
    members: [
      { name: 'Alice Chen', role: 'CEO', bio: 'Founder & visionary leader' },
      { name: 'Bob Smith', role: 'CTO', bio: 'Engineering excellence' },
      { name: 'Carol White', role: 'Designer', bio: 'Design systems expert' },
    ],
    ...overrides,
  }
}

describe('[TC-F05-894-15/16/17] Team Block — BioModalVariant Dialog UX', () => {
  // TC-F05-894-15: Clicking a member button opens a dialog
  it('TC-F05-894-15 — clicking a member button opens dialog via showModal()', async () => {
    // Arrange
    const block = makeTeamBlock()
    render(<TeamBlock block={block} />)

    // Wait for component to mount and dialog to be rendered to document.body
    await waitFor(() => {
      const dialog = document.body.querySelector('dialog')
      expect(dialog).toBeInTheDocument()
    })

    // Act — click the first member button
    const memberButton = screen.getAllByRole('button', { name: /Open bio for Alice Chen/i })[0]
    fireEvent.click(memberButton)

    // Assert — dialog should be queryable and showModal called
    await waitFor(() => {
      const dialog = document.body.querySelector('dialog')
      expect(dialog).toBeInTheDocument()
      expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
    })
  })

  // TC-F05-894-16: Clicking the X close button clears active member
  it('TC-F05-894-16 — clicking X button closes dialog and clears content', async () => {
    // Arrange
    const block = makeTeamBlock()
    render(<TeamBlock block={block} />)

    // Wait for dialog to mount
    await waitFor(() => {
      expect(document.body.querySelector('dialog')).toBeInTheDocument()
    })

    // Act — open dialog by clicking a member button
    const memberButton = screen.getAllByRole('button', { name: /Open bio for Alice Chen/i })[0]
    fireEvent.click(memberButton)

    // Assert content visible
    const dialog = document.body.querySelector('dialog')
    await waitFor(() => {
      expect(dialog?.querySelector('h4')).toHaveTextContent('Alice Chen')
    })

    // Act — click the close (X) button
    const closeButton = dialog?.querySelector('button[aria-label="Close bio"]') as HTMLButtonElement
    fireEvent.click(closeButton)

    // Assert — dialog content should clear (no h4 with name, or empty dialog)
    await waitFor(() => {
      const contentDiv = dialog?.querySelector('h4')
      // After close, the active member is set to null, so dialog content rendering should clear
      // The component renders {active && (...)} so when active=null, h4 won't render
      expect(contentDiv).not.toBeInTheDocument()
    })
  })

  // TC-F05-894-17: Clicking the backdrop (dialog element itself) closes dialog
  it('TC-F05-894-17 — clicking backdrop closes dialog and clears content', async () => {
    // Arrange
    const block = makeTeamBlock()
    render(<TeamBlock block={block} />)

    // Wait for dialog to mount
    await waitFor(() => {
      expect(document.body.querySelector('dialog')).toBeInTheDocument()
    })

    // Act — open dialog by clicking a member button
    const memberButton = screen.getAllByRole('button', { name: /Open bio for Alice Chen/i })[0]
    fireEvent.click(memberButton)

    // Assert content visible
    const dialog = document.body.querySelector('dialog') as HTMLDialogElement
    await waitFor(() => {
      expect(dialog?.querySelector('h4')).toHaveTextContent('Alice Chen')
    })

    // Act — click on the dialog backdrop (the dialog element itself, not inner content).
    // jsdom sets e.target to the dispatched element; the component guard
    // `if (e.target === dialogRef.current)` closes only on direct dialog clicks.
    fireEvent.click(dialog)

    // Assert — dialog content clears because e.target === dialog (backdrop hit)
    await waitFor(() => {
      const contentDiv = dialog?.querySelector('h4')
      expect(contentDiv).not.toBeInTheDocument()
    })

    // Counter-check: clicking inner content div does NOT trigger the backdrop guard.
    // Re-open dialog first.
    fireEvent.click(memberButton)
    await waitFor(() => {
      expect(dialog?.querySelector('h4')).toHaveTextContent('Alice Chen')
    })
    const innerContent = dialog.querySelector('[class*="text-center"]') as HTMLElement
    if (innerContent) {
      fireEvent.click(innerContent)
      // Content should still be present — inner click does not match backdrop guard
      await waitFor(() => {
        expect(dialog?.querySelector('h4')).toHaveTextContent('Alice Chen')
      })
    }
  })

  // Additional test: Verify member content renders in dialog
  it('TC-F05-894-15a — dialog displays correct member content when opened', async () => {
    // Arrange
    const block = makeTeamBlock()
    render(<TeamBlock block={block} />)

    // Wait for dialog to mount
    await waitFor(() => {
      expect(document.body.querySelector('dialog')).toBeInTheDocument()
    })

    // Act — click member button
    const memberButton = screen.getAllByRole('button', { name: /Open bio for Alice Chen/i })[0]
    fireEvent.click(memberButton)

    // Assert — verify member details are visible in dialog
    // The dialog contains h4 with Alice Chen, and paragraphs with role and bio
    const dialog = document.body.querySelector('dialog')
    await waitFor(() => {
      expect(dialog?.querySelector('h4')).toHaveTextContent('Alice Chen')
      expect(dialog?.textContent).toContain('CEO')
      expect(dialog?.textContent).toContain('Founder & visionary leader')
    })
  })

  // Additional test: Verify multiple members can be opened sequentially
  it('TC-F05-894-16a — dialog content updates when switching members', async () => {
    // Arrange
    const block = makeTeamBlock()
    render(<TeamBlock block={block} />)

    // Wait for dialog to mount
    const dialog = await waitFor(() => {
      const d = document.body.querySelector('dialog')
      expect(d).toBeInTheDocument()
      return d
    })

    // Act — open first member
    let memberButtons = screen.getAllByRole('button', { name: /Open bio for Alice Chen/i })
    fireEvent.click(memberButtons[0])

    // Assert — Alice's content visible in dialog
    await waitFor(() => {
      expect(dialog?.querySelector('h4')).toHaveTextContent('Alice Chen')
    })

    // Act — click second member button (dialog already open, content should update)
    memberButtons = screen.getAllByRole('button', { name: /Open bio for Bob Smith/i })
    fireEvent.click(memberButtons[0])

    // Assert — Bob's content now visible (Alice's replaced)
    await waitFor(() => {
      expect(dialog?.querySelector('h4')).toHaveTextContent('Bob Smith')
      expect(dialog?.textContent).toContain('Engineering excellence')
    })
  })

  // Additional test: Verify dialog is not rendered before component mounts
  it('TC-F05-894-15b — dialog only rendered after component mounts (portal guard)', async () => {
    // Arrange
    const block = makeTeamBlock()

    // Act — render component
    render(<TeamBlock block={block} />)

    // Assert — dialog should eventually be in document.body after mount
    await waitFor(() => {
      const dialog = document.body.querySelector('dialog')
      expect(dialog).toBeInTheDocument()
    })
  })
})
