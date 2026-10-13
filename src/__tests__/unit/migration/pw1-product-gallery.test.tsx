// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProductImageGallery } from '@/components/storefront/ProductImageGallery'

describe('[TC-F42-076] Full migrated storefront gallery', () => {
  it('navigates beyond fifth image and wraps between first and eighth', () => {
    // Arrange
    const images = Array.from({ length: 8 }, (_, index) => ({ image: { url: `https://example.com/${index + 1}.jpg` }, alt: `Image ${index + 1}` }))
    const { container } = render(<ProductImageGallery images={images} productName="Product" primaryColor="#000" />)
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'View image 5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next image' }))
    // Assert
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.com/6.jpg')
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'View image 8' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next image' }))
    // Assert
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.com/1.jpg')
    fireEvent.click(screen.getByRole('button', { name: 'Previous image' }))
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.com/8.jpg')
  })
})
