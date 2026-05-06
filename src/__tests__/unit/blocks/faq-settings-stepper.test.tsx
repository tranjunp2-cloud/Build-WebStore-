import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import FaqSettings from '@/components/editor/FaqSettings'
import type { FAQConfig } from '@/blocks/faq/config'

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      editor: {
        settings: {
          faqConfiguration: 'FAQ Configuration',
          numberOfFaqs: 'Number of FAQs',
          faqsMinMax: '(Min: 3, Max: 10)',
          questionPlaceholder: 'Enter question...',
          answerPlaceholder: 'Enter answer...',
        },
      },
    },
  }),
}))

function makeBlock(overrides: Partial<FAQConfig> = {}): FAQConfig {
  return {
    blockType: 'faq',
    variant: 'accordion',
    items: [
      { question: 'Question 1', answer: 'Answer 1' },
      { question: 'Question 2', answer: 'Answer 2' },
      { question: 'Question 3', answer: 'Answer 3' },
      { question: 'Question 4', answer: 'Answer 4' },
    ],
    ...overrides,
  }
}

function renderPanel(block: FAQConfig, onBlockUpdate: ReturnType<typeof vi.fn>, idx = 0) {
  return render(
    <FaqSettings block={block} blockIndex={idx} onBlockUpdate={onBlockUpdate} />,
  )
}

describe('FaqSettings — stepper boundaries', () => {
  // TC-F05-881-01
  it('renders count at 4 items with both buttons enabled', () => {
    const onBlockUpdate = vi.fn()
    renderPanel(makeBlock({ items: Array(4).fill(null).map((_, i) => ({ question: `Q${i + 1}`, answer: `A${i + 1}` })) }), onBlockUpdate)
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByLabelText('Decrease FAQ count')).not.toBeDisabled()
    expect(screen.getByLabelText('Increase FAQ count')).not.toBeDisabled()
  })

  // TC-F05-881-02
  it('disables + button when at 10 items', () => {
    const onBlockUpdate = vi.fn()
    renderPanel(makeBlock({ items: Array(10).fill(null).map((_, i) => ({ question: `Q${i + 1}`, answer: `A${i + 1}` })) }), onBlockUpdate)
    expect(screen.getByLabelText('Increase FAQ count')).toBeDisabled()
  })

  // TC-F05-881-03
  it('disables − button when at 3 items', () => {
    const onBlockUpdate = vi.fn()
    renderPanel(makeBlock({ items: [{ question: 'Q1', answer: 'A1' }, { question: 'Q2', answer: 'A2' }, { question: 'Q3', answer: 'A3' }] }), onBlockUpdate)
    expect(screen.getByLabelText('Decrease FAQ count')).toBeDisabled()
  })
})

describe('FaqSettings — CRUD operations', () => {
  // TC-F05-881-04
  it('clicking + appends new placeholder Q/A item', () => {
    const onBlockUpdate = vi.fn()
    renderPanel(makeBlock({ items: Array(4).fill(null).map((_, i) => ({ question: `Question ${i + 1}`, answer: `Answer ${i + 1}` })) }), onBlockUpdate)
    fireEvent.click(screen.getByLabelText('Increase FAQ count'))
    expect(onBlockUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ items: expect.arrayContaining([{ question: 'Question 5', answer: 'Answer 5' }]) }))
  })

  // TC-F05-881-05
  it('clicking − removes last item', () => {
    const onBlockUpdate = vi.fn()
    renderPanel(makeBlock({ items: [{ question: 'Q1', answer: 'A1' }, { question: 'Q2', answer: 'A2' }, { question: 'Q3', answer: 'A3' }, { question: 'Q4', answer: 'A4' }] }), onBlockUpdate)
    fireEvent.click(screen.getByLabelText('Decrease FAQ count'))
    expect(onBlockUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ items: expect.arrayContaining([{ question: 'Q1', answer: 'A1' }]) }))
  })

  // TC-F05-881-06
  it('editing question input on blur updates item at that index', () => {
    const onBlockUpdate = vi.fn()
    const { container } = renderPanel(makeBlock({ items: [{ question: 'Original Q1', answer: 'A1' }, { question: 'Q2', answer: 'A2' }, { question: 'Q3', answer: 'A3' }] }), onBlockUpdate)
    const input = container.querySelector('input[placeholder="Enter question..."]') as HTMLInputElement
    fireEvent.blur(input, { target: { value: 'Updated Q1' } })
    expect(onBlockUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ items: expect.arrayContaining([{ question: 'Updated Q1', answer: 'A1' }]) }))
  })

  // TC-F05-881-07
  it('editing answer textarea on blur updates item at that index', () => {
    const onBlockUpdate = vi.fn()
    const { container } = renderPanel(makeBlock({ items: [{ question: 'Q1', answer: 'Original A1' }, { question: 'Q2', answer: 'A2' }, { question: 'Q3', answer: 'A3' }] }), onBlockUpdate)
    const textarea = container.querySelector('textarea[placeholder="Enter answer..."]') as HTMLTextAreaElement
    fireEvent.blur(textarea, { target: { value: 'Updated A1' } })
    expect(onBlockUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ items: expect.arrayContaining([{ question: 'Q1', answer: 'Updated A1' }]) }))
  })
})

describe('FaqSettings — pad-to-3 mount behavior', () => {
  // TC-F05-881-08
  it('mounts with empty items and pads to 3 via useEffect', async () => {
    const onBlockUpdate = vi.fn()
    renderPanel(makeBlock({ items: [] }), onBlockUpdate)
    await waitFor(() => {
      expect(onBlockUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ items: expect.arrayContaining([{ question: 'Question 1', answer: 'Answer 1' }]) }))
    })
  })

  // TC-F05-881-09
  it('mounts with 1 item, pads to 3, and retains original at index 0', async () => {
    const onBlockUpdate = vi.fn()
    renderPanel(makeBlock({ items: [{ question: 'Original Q1', answer: 'Original A1' }] }), onBlockUpdate)
    await waitFor(() => {
      expect(onBlockUpdate).toHaveBeenCalledWith(0, expect.objectContaining({ items: expect.arrayContaining([{ question: 'Original Q1', answer: 'Original A1' }]) }))
    })
  })
})

describe('FaqSettings — faqs-field resolution (Payload path)', () => {
  // TC-F05-881-12
  it('reads items from block.faqs when items field is absent', async () => {
    const onBlockUpdate = vi.fn()
    const blockWithFaqsOnly = {
      blockType: 'faq',
      variant: 'accordion',
      faqs: [
        { question: 'Q1', answer: 'A1' },
        { question: 'Q2', answer: 'A2' },
        { question: 'Q3', answer: 'A3' },
        { question: 'Q4', answer: 'A4' },
      ],
    } as unknown as FAQConfig
    renderPanel(blockWithFaqsOnly, onBlockUpdate)
    expect(screen.getByText('4')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Increase FAQ count'))
    expect(onBlockUpdate).toHaveBeenCalledWith(0, expect.objectContaining({
      faqs: expect.arrayContaining([{ question: 'Q1', answer: 'A1' }, { question: 'Question 5', answer: 'Answer 5' }]),
    }))
  })
})

describe('FaqSettings — data integrity', () => {
  // TC-F05-881-10
  it('preserves rich-text answer when dropping a different item', () => {
    const onBlockUpdate = vi.fn()
    const richText = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rich text' }] }] }
    renderPanel(makeBlock({ items: [{ question: 'Q1', answer: 'A1' }, { question: 'Q2', answer: richText as unknown as string }, { question: 'Q3', answer: 'A3' }, { question: 'Q4', answer: 'A4' }] }), onBlockUpdate)
    fireEvent.click(screen.getByLabelText('Decrease FAQ count'))
    expect(onBlockUpdate.mock.calls[0][1].items[1].answer).toEqual(richText)
  })

  // TC-F05-881-11
  it('does not mutate items array when variant prop changes', () => {
    const onBlockUpdate = vi.fn()
    const items = [{ question: 'Q1', answer: 'A1' }, { question: 'Q2', answer: 'A2' }, { question: 'Q3', answer: 'A3' }]
    const { rerender } = renderPanel(makeBlock({ variant: 'accordion', items }), onBlockUpdate)
    rerender(<FaqSettings block={makeBlock({ variant: 'grid', items })} blockIndex={0} onBlockUpdate={onBlockUpdate} />)
    fireEvent.click(screen.getByLabelText('Increase FAQ count'))
    const callArgs = onBlockUpdate.mock.calls[onBlockUpdate.mock.calls.length - 1][1]
    expect(callArgs.items).toContainEqual({ question: 'Q1', answer: 'A1' })
  })
})
