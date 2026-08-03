import type { LocalBusinessData } from './types'

/** F37 analytics count: address parts + category + a has-open-hours flag. */
export function countCompletedLocalBusinessFields(data: LocalBusinessData): number {
    let count = 0
    if (data.streetAddress?.trim()) count++
    if (data.city?.trim()) count++
    if (data.state?.trim()) count++
    if (data.postcode?.trim()) count++
    if (data.businessCategory?.trim()) count++
    if (data.openingHours?.some(row => !row.isClosed && row.opens?.trim() && row.closes?.trim())) {
        count++
    }
    return count
}
