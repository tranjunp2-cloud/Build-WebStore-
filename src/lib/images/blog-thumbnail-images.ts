/**
 * Per-category blog thumbnail fallback images — landscape 1200×630.
 * Used by seedBlogPosts when Unsplash search returns no results.
 * All IDs sourced from the curated IMAGE_LIBRARY (images.ts) — same stable Unsplash photos.
 * 3 images per category so each of the 3 seeded posts gets a distinct thumbnail.
 */

const u = (id: string) =>
    `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&h=630&q=80`

export const BLOG_THUMBNAILS_BY_CATEGORY: Record<string, [string, string, string]> = {
    restaurant: [
        u('photo-1504674900247-0877df9cc836'), // food close-up
        u('photo-1414235077428-338989a2e8c0'), // restaurant interior
        u('photo-1476224203421-9ac39bcb3327'), // plated dish
    ],
    ecommerce: [
        u('photo-1441986300917-64674bd600d8'), // retail shop
        u('photo-1523381210434-271e8be1f52b'), // fashion/clothing
        u('photo-1556905055-8f358a7a47b2'),    // product display
    ],
    beauty: [
        u('photo-1522335789203-aabd1fc54bc9'), // beauty session
        u('photo-1570172619644-dfd03ed5d881'), // skincare products
        u('photo-1487412912498-0447578fcca8'), // cosmetics flat lay
    ],
    tech: [
        u('photo-1451187580459-43490279c0fa'), // tech/space
        u('photo-1518770660439-4636190af475'), // circuit board
        u('photo-1460925895917-afdab827c52f'), // data dashboard
    ],
    health: [
        u('photo-1519494026892-80bbd2d6fd0d'), // hospital corridor
        u('photo-1576091160399-112ba8d25d1d'), // healthcare team
        u('photo-1584820927498-cfe5211fd8bf'), // medical tools
    ],
    education: [
        u('photo-1546410531-bb4caa6b424d'), // classroom
        u('photo-1503676260728-1c00da094a0b'), // students studying
        u('photo-1509062522246-3755977927d7'), // lecture hall
    ],
    realestate: [
        u('photo-1600596542815-ffad4c1539a9'), // house exterior
        u('photo-1600585154340-be6161a56a0c'), // modern home
        u('photo-1512917774080-9991f1c4c750'), // property aerial
    ],
    fitness: [
        u('photo-1534438327276-14e5300c3a48'), // gym equipment
        u('photo-1571019613454-1cb2f99b2d8b'), // workout session
        u('photo-1517836357463-d25dfeac3438'), // training
    ],
    creative: [
        u('photo-1558655146-9f40138edfeb'), // design workspace
        u('photo-1561070791-2526d30994b5'), // creative tools
        u('photo-1452587925148-ce544e77e70d'), // photography
    ],
    business: [
        u('photo-1497366216548-37526070297c'), // office space
        u('photo-1553877522-43269d4ea984'), // business meeting
        u('photo-1521737711867-e3b97375f902'), // team collaboration
    ],
    fnb: [
        u('photo-1495474472287-4d71bcdd2085'), // coffee
        u('photo-1509440159596-0249088772ff'), // artisan bread
        u('photo-1559925393-8be0ec4767c8'), // café interior
    ],
    events: [
        u('photo-1519167758481-83f550bb49b3'), // wedding venue
        u('photo-1475721027785-f74eccf877e2'), // corporate event
        u('photo-1511795409834-ef04bbd61622'), // floral arrangement
    ],
    blog: [
        u('photo-1455390582262-044cdead277a'), // writing desk
        u('photo-1499750310107-5fef28a66643'), // laptop + coffee
        u('photo-1471107340929-a87cd0f5b5f3'), // notebook + pen
    ],
    travel: [
        u('photo-1476514525535-07fb3b4ae5f1'), // tropical beach
        u('photo-1464822759023-fed622ff2c3b'), // mountain landscape
        u('photo-1528181304800-259b08848526'), // asian temple
    ],
}

/**
 * Returns 3 landscape blog thumbnail URLs for a category.
 * Falls back to `business` thumbnails for unknown categories.
 */
export function getBlogThumbnails(category: string): [string, string, string] {
    const key = category.toLowerCase().replace(/[\s_-]+/g, '')
    return (
        BLOG_THUMBNAILS_BY_CATEGORY[key] ??
        BLOG_THUMBNAILS_BY_CATEGORY['business']!
    )
}
