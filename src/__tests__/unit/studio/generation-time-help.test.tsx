import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GenerationTimeHelp } from '@/app/studio/generations/_components/generations-live-feed'

describe('GenerationTimeHelp', () => {
    it('TC-F41-18: opens and closes the time explanation by click, not only hover', () => {
        // Arrange
        render(<GenerationTimeHelp />)
        const trigger = screen.getByRole('button', { name: 'Giải thích thời gian generation' })

        // Act / Assert
        fireEvent.click(trigger)
        expect(screen.getAllByText(/Thời gian tính từ lúc user gửi form/i)).not.toHaveLength(0)
        expect(trigger).toHaveAttribute('aria-expanded', 'true')
        fireEvent.click(trigger)
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })
})
