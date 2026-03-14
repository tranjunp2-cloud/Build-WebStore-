/**
 * Preview helpers — category detection from blocks/site name.
 * Used by API preview route; unit-tested here.
 */

export function detectCategory(blocks: unknown[], siteName: string): string {
  const text = JSON.stringify(blocks).toLowerCase() + siteName.toLowerCase()
  if (/nhà hàng|cafe|restaurant|f&b|thực đơn|đặt bàn|menu/i.test(text)) return 'restaurant'
  if (/shop|thời trang|ecommerce|sản phẩm|mua|fashion|cửa hàng/i.test(text)) return 'ecommerce'
  if (/beauty|spa|thẩm mỹ|salon|làm đẹp|chăm sóc da/i.test(text)) return 'beauty'
  if (/tech|saas|startup|công nghệ|phần mềm|ai|api/i.test(text)) return 'tech'
  if (/y tế|nha khoa|clinic|bệnh viện|bác sĩ|sức khỏe|phòng khám/i.test(text)) return 'health'
  if (/giáo dục|đào tạo|khóa học|trường|education|training/i.test(text)) return 'education'
  if (/bất động sản|bds|nhà đất|căn hộ|dự án|real estate/i.test(text)) return 'realestate'
  if (/gym|fitness|yoga|tập|thể dục|workout/i.test(text)) return 'fitness'
  if (/portfolio|freelancer|agency|creative|thiết kế|design/i.test(text)) return 'creative'
  return 'business'
}
