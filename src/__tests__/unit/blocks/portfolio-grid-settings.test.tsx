import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import PortfolioGridSettings from '@/components/editor/PortfolioGridSettings'
import type { PortfolioGridConfig, PortfolioProject } from '@/blocks/portfolio-grid/config'

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      editor: {
        settings: {
          portfolioConfiguration: 'Portfolio configuration',
          projectLabel: 'Project',
          projectTitlePlaceholder: 'Project title',
          projectCategoryPlaceholder: 'Category',
          projectDescriptionPlaceholder: 'Description',
          projectLinkPlaceholder: 'Link URL',
          addProject: 'Add project',
        },
      },
    },
  }),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

vi.mock('@/components/editor/BlockImageEditor', () => ({
  BlockImageEditor: ({ onImageChange }: { onImageChange: (id: number, url: string) => void }) => (
    <button onClick={() => onImageChange(99, 'mock-image-url.jpg')} type="button">
      Mock Upload
    </button>
  ),
}))

const makeProject = (n: number, overrides: Partial<PortfolioProject> = {}): PortfolioProject => ({
  title: `Project ${n}`,
  description: `Desc ${n}`,
  category: `Cat ${n}`,
  linkUrl: `/products?categoryId=${n}`,
  ...overrides,
})

function makeBlock(overrides: Partial<PortfolioGridConfig> = {}): PortfolioGridConfig {
  return {
    blockType: 'portfolio-grid',
    variant: 'grid',
    headline: 'Our Work',
    projects: [makeProject(1), makeProject(2), makeProject(3)],
    ...overrides,
  }
}

function renderPanel(block: PortfolioGridConfig, onBlockUpdate: ReturnType<typeof vi.fn>, idx = 0) {
  return render(
    <PortfolioGridSettings block={block} blockIndex={idx} onBlockUpdate={onBlockUpdate} />,
  )
}

describe('PortfolioGridSettings — item CRUD', () => {
  // TC-F35.M51
  it('renders one card per project with title and link fields', () => {
    const onBlockUpdate = vi.fn()
    const { container } = renderPanel(makeBlock(), onBlockUpdate)
    expect(screen.getByText('Project 1')).toBeInTheDocument()
    expect(screen.getByText('Project 3')).toBeInTheDocument()
    const linkInputs = container.querySelectorAll('input[placeholder="Link URL"]')
    expect(linkInputs).toHaveLength(3)
    expect((linkInputs[0] as HTMLInputElement).value).toBe('/products?categoryId=1')
  })

  // TC-F35.M52
  it('clicking Add project appends a default project', () => {
    const onBlockUpdate = vi.fn()
    renderPanel(makeBlock(), onBlockUpdate)
    fireEvent.click(screen.getByRole('button', { name: /Add project/i }))
    const callArgs = onBlockUpdate.mock.calls[0][1]
    expect(callArgs.projects).toHaveLength(4)
    expect(callArgs.projects[3]).toEqual(expect.objectContaining({ title: 'Project 4' }))
  })

  // TC-F35.M53
  it('clicking ✕ removes the project and preserves neighbors', () => {
    const onBlockUpdate = vi.fn()
    renderPanel(makeBlock(), onBlockUpdate)
    fireEvent.click(screen.getByRole('button', { name: 'Remove project 2' }))
    const callArgs = onBlockUpdate.mock.calls[0][1]
    expect(callArgs.projects.map((p: PortfolioProject) => p.title)).toEqual(['Project 1', 'Project 3'])
  })

  // TC-F35.M54
  it('✕ button disabled when only one project remains', () => {
    const onBlockUpdate = vi.fn()
    renderPanel(makeBlock({ projects: [makeProject(1)] }), onBlockUpdate)
    expect(screen.getByRole('button', { name: 'Remove project 1' })).toBeDisabled()
  })

  // TC-F35.M55
  it('move down swaps project order', () => {
    const onBlockUpdate = vi.fn()
    renderPanel(makeBlock(), onBlockUpdate)
    fireEvent.click(screen.getByRole('button', { name: 'Move project 1 down' }))
    const callArgs = onBlockUpdate.mock.calls[0][1]
    expect(callArgs.projects.map((p: PortfolioProject) => p.title)).toEqual(['Project 2', 'Project 1', 'Project 3'])
  })

  // TC-F35.M56
  it('move up disabled on first project and move down disabled on last', () => {
    const onBlockUpdate = vi.fn()
    renderPanel(makeBlock(), onBlockUpdate)
    expect(screen.getByRole('button', { name: 'Move project 1 up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move project 3 down' })).toBeDisabled()
  })
})

describe('PortfolioGridSettings — field editing', () => {
  // TC-F35.M57
  it('editing title on blur updates the project', () => {
    const onBlockUpdate = vi.fn()
    const { container } = renderPanel(makeBlock({ projects: [makeProject(1)] }), onBlockUpdate)
    const titleInput = container.querySelector('input[placeholder="Project title"]') as HTMLInputElement
    fireEvent.change(titleInput, { target: { value: 'NORA' } })
    fireEvent.blur(titleInput)
    expect(onBlockUpdate).toHaveBeenCalledWith(0, expect.objectContaining({
      projects: expect.arrayContaining([expect.objectContaining({ title: 'NORA' })]),
    }))
  })

  // TC-F35.M58
  it('empty title reverts input and does not update (Payload requires title)', () => {
    const onBlockUpdate = vi.fn()
    const { container } = renderPanel(makeBlock({ projects: [makeProject(1)] }), onBlockUpdate)
    const titleInput = container.querySelector('input[placeholder="Project title"]') as HTMLInputElement
    fireEvent.change(titleInput, { target: { value: '   ' } })
    fireEvent.blur(titleInput)
    expect(onBlockUpdate).not.toHaveBeenCalled()
    expect(titleInput.value).toBe('Project 1')
  })

  // TC-F35.M59
  it('editing linkUrl accepts site-relative category links', () => {
    const onBlockUpdate = vi.fn()
    const { container } = renderPanel(makeBlock({ projects: [makeProject(1, { linkUrl: '' })] }), onBlockUpdate)
    const linkInput = container.querySelector('input[placeholder="Link URL"]') as HTMLInputElement
    fireEvent.change(linkInput, { target: { value: '/products?categoryId=5' } })
    fireEvent.blur(linkInput)
    expect(onBlockUpdate).toHaveBeenCalledWith(0, expect.objectContaining({
      projects: expect.arrayContaining([expect.objectContaining({ linkUrl: '/products?categoryId=5' })]),
    }))
  })

  // TC-F35.M60
  it('invalid linkUrl is rejected and input reverts', () => {
    const onBlockUpdate = vi.fn()
    const { container } = renderPanel(makeBlock({ projects: [makeProject(1, { linkUrl: '/products' })] }), onBlockUpdate)
    const linkInput = container.querySelector('input[placeholder="Link URL"]') as HTMLInputElement
    fireEvent.change(linkInput, { target: { value: 'javascript:alert(1)' } })
    fireEvent.blur(linkInput)
    expect(onBlockUpdate).not.toHaveBeenCalled()
    expect(linkInput.value).toBe('/products')
  })

  // TC-F35.M61
  it('image upload via BlockImageEditor updates project image', () => {
    const onBlockUpdate = vi.fn()
    renderPanel(makeBlock({ projects: [makeProject(1)] }), onBlockUpdate)
    fireEvent.click(screen.getByRole('button', { name: /Mock Upload/i }))
    expect(onBlockUpdate).toHaveBeenCalledWith(0, expect.objectContaining({
      projects: expect.arrayContaining([
        expect.objectContaining({ image: expect.objectContaining({ id: 99, url: 'mock-image-url.jpg' }) }),
      ]),
    }))
  })
})
