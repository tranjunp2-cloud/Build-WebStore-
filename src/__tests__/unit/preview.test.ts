import { describe, it, expect } from 'vitest'
import { detectCategory } from '@/lib/preview'

describe('detectCategory (lib/preview)', () => {
    it('should return restaurant for F&B / menu / cafe keywords', () => {
        expect(detectCategory([{ heading: 'Our restaurant menu' }], '')).toBe('restaurant')
        expect(detectCategory([], 'Cafe Bella')).toBe('restaurant')
        expect(detectCategory([{ content: 'thực đơn hôm nay' }], '')).toBe('restaurant')
    })

    it('should return ecommerce for shop / fashion / sản phẩm', () => {
        expect(detectCategory([{ blockType: 'hero', heading: 'Fashion shop' }], '')).toBe('ecommerce')
        expect(detectCategory([], 'Cửa hàng thời trang')).toBe('ecommerce')
    })

    it('should return beauty for spa / salon / làm đẹp', () => {
        expect(detectCategory([{ content: 'spa and beauty' }], '')).toBe('beauty')
        expect(detectCategory([], 'Salon làm đẹp')).toBe('beauty')
    })

    it('should return tech for saas / startup / AI', () => {
        expect(detectCategory([{ heading: 'SaaS platform' }], '')).toBe('tech')
        expect(detectCategory([], 'Công nghệ phần mềm')).toBe('tech')
    })

    it('should return health for clinic / bác sĩ / y tế', () => {
        expect(detectCategory([{ content: 'dental clinic' }], '')).toBe('health')
        expect(detectCategory([], 'Phòng khám nha khoa')).toBe('health')
    })

    it('should return education for education / khóa học / trường', () => {
        expect(detectCategory([{ heading: 'Education and courses' }], '')).toBe('education')
        expect(detectCategory([], 'Trường đào tạo')).toBe('education')
    })

    it('should return realestate for real estate / bất động sản', () => {
        expect(detectCategory([{ content: 'real estate projects' }], '')).toBe('realestate')
        expect(detectCategory([], 'Bất động sản nhà đất')).toBe('realestate')
    })

    it('should return fitness for gym / yoga / workout', () => {
        expect(detectCategory([{ heading: 'Gym and fitness' }], '')).toBe('fitness')
        expect(detectCategory([], 'Yoga tập thể dục')).toBe('fitness')
    })

    it('should return creative for portfolio / agency / design', () => {
        expect(detectCategory([{ content: 'creative portfolio' }], '')).toBe('creative')
        expect(detectCategory([], 'Agency thiết kế')).toBe('creative')
    })

    it('should return business when no category matches', () => {
        expect(detectCategory([], '')).toBe('business')
        expect(detectCategory([{ heading: 'Welcome to our company' }], 'Acme Corp')).toBe('business')
    })

    it('should combine blocks and siteName for detection', () => {
        expect(detectCategory([], 'Bella Cafe')).toBe('restaurant')
        expect(detectCategory([{ heading: 'Welcome' }], 'Tech Startup Inc')).toBe('tech')
    })
})
