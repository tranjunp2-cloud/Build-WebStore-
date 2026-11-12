/**
 * Product-type gate for product photos (#2103 A3 follow-up, TC-AIAUD-168..169).
 *
 * "Vitamin C Serum" got a photo of an orange: the keyword gate (`photoMatchesTerms`) is satisfied by any one
 * word of the product's terms, and the AI's image keyword was an ingredient ("orange"). A product photo must
 * show the KIND of product it is — serum, cream, cake, toner, shirt — so its tags have to name the product's
 * type (or a synonym of it). An ingredient / flavour / colour match is never enough ("vitamin c", "orange",
 * "rose", "honey", "chocolate" describe what is in it, not what it is).
 *
 * Type = the lexicon group the product's NAME belongs to (never the AI's image keyword, which is often an
 * ingredient); a name outside the lexicon falls back to its head noun (last word, skipping "set / box / pack …").
 * No type, or no photo tag naming it → no match → the product gets no image (the storefront placeholder beats a
 * wrong picture).
 */

type TypeGroup = { kind: 'product' | 'ingredient'; words: readonly string[] }

// kind 'ingredient' groups name what a product is made of / flavoured with as often as what it is
// ("coffee cake", "honey soap"): when the name also has a product-form word, that one decides.
const TYPE_GROUPS: readonly TypeGroup[] = [
  // skincare & beauty
  { kind: 'product', words: ['serum', 'essence', 'ampoule'] },
  { kind: 'product', words: ['cream', 'moisturizer', 'moisturiser', 'lotion', 'balm', 'emulsion', 'krim', 'pelembap'] },
  { kind: 'product', words: ['cleanser', 'facewash', 'micellar', 'pencuci'] },
  { kind: 'product', words: ['toner', 'mist', 'astringent'] },
  { kind: 'product', words: ['mask', 'masque', 'sheetmask', 'topeng'] },
  { kind: 'product', words: ['sunscreen', 'sunblock', 'spf'] },
  { kind: 'product', words: ['oil', 'minyak'] },
  { kind: 'product', words: ['shampoo', 'conditioner', 'syampu'] },
  { kind: 'product', words: ['soap', 'sabun'] },
  { kind: 'product', words: ['scrub', 'exfoliant'] },
  { kind: 'product', words: ['perfume', 'fragrance', 'cologne', 'parfum', 'attar'] },
  { kind: 'product', words: ['lipstick', 'lip', 'gloss', 'lipgloss', 'lipbalm', 'liptint'] },
  { kind: 'product', words: ['nail', 'manicure', 'nailpolish'] },
  { kind: 'product', words: ['foundation', 'concealer', 'blush', 'mascara', 'eyeliner', 'eyeshadow', 'makeup', 'cushion', 'bedak'] },
  // bakery, snacks, food & drink
  { kind: 'product', words: ['cake', 'kek', 'cupcake', 'cheesecake', 'brownie', 'gateau'] },
  { kind: 'product', words: ['pastry', 'tart', 'pie', 'croissant', 'donut', 'doughnut', 'muffin', 'scone', 'danish'] },
  { kind: 'product', words: ['cookie', 'biscuit', 'kuih', 'cracker', 'tin', 'hamper'] },
  { kind: 'product', words: ['chips', 'kerepek', 'crisps', 'snack', 'popcorn', 'nuts'] },
  { kind: 'product', words: ['bread', 'roti', 'bun', 'loaf', 'baguette', 'sourdough', 'toast'] },
  { kind: 'product', words: ['juice', 'jus', 'smoothie', 'drink', 'beverage', 'soda', 'milkshake'] },
  { kind: 'product', words: ['candy', 'sweets', 'gummy', 'lollipop', 'dodol', 'jelly'] },
  { kind: 'product', words: ['jam', 'sauce', 'sambal', 'spread', 'jar'] },
  { kind: 'ingredient', words: ['chocolate', 'coklat', 'praline', 'truffle'] },
  { kind: 'ingredient', words: ['coffee', 'kopi', 'latte', 'espresso', 'cappuccino', 'americano', 'mocha'] },
  { kind: 'ingredient', words: ['tea', 'teh', 'matcha', 'chai'] },
  { kind: 'ingredient', words: ['honey', 'madu'] },
  { kind: 'ingredient', words: ['rice', 'nasi', 'noodle', 'mee', 'pasta', 'laksa', 'curry', 'rendang', 'soup', 'burger', 'pizza', 'sandwich', 'salad', 'satay', 'sushi', 'ramen'] },
  // fashion & accessories
  { kind: 'product', words: ['shirt', 'tshirt', 'tee', 'blouse', 'kemeja', 'polo'] },
  { kind: 'product', words: ['dress', 'gown', 'kurung', 'baju', 'abaya', 'jubah', 'kaftan', 'skirt', 'kebaya'] },
  { kind: 'product', words: ['pants', 'trouser', 'jeans', 'shorts', 'legging', 'seluar'] },
  { kind: 'product', words: ['tudung', 'hijab', 'scarf', 'shawl', 'selendang', 'bawal'] },
  { kind: 'product', words: ['jacket', 'coat', 'hoodie', 'sweater', 'cardigan', 'blazer'] },
  { kind: 'product', words: ['shoe', 'sneaker', 'sandal', 'heels', 'boot', 'slipper', 'kasut'] },
  { kind: 'product', words: ['bag', 'handbag', 'backpack', 'tote', 'wallet', 'purse', 'clutch', 'beg'] },
  { kind: 'product', words: ['ring', 'necklace', 'bracelet', 'earring', 'jewelry', 'jewellery', 'pendant', 'anklet', 'brooch'] },
  { kind: 'product', words: ['watch', 'wristwatch'] },
  // home, gadgets, gifts
  { kind: 'product', words: ['candle', 'lilin', 'diffuser', 'incense'] },
  { kind: 'product', words: ['plant', 'flower', 'bouquet', 'succulent', 'pot'] },
  { kind: 'product', words: ['mug', 'cup', 'tumbler', 'bottle', 'flask'] },
  { kind: 'product', words: ['toy', 'doll', 'puzzle', 'lego'] },
  { kind: 'product', words: ['book', 'notebook', 'planner', 'journal', 'diary'] },
  { kind: 'product', words: ['chair', 'table', 'sofa', 'shelf', 'lamp'] },
  { kind: 'product', words: ['laptop', 'phone', 'tablet', 'keyboard', 'mouse', 'speaker', 'camera', 'headphone', 'earphone', 'earbud', 'charger', 'powerbank'] },
]

/**
 * GH-1611: Vietnamese product names → the English tag words a photo must carry. Without this a name outside the
 * lexicon fell back to its head noun ("bánh"), which no Pixabay tag ever names, so a bakery's "bánh" got no photo
 * (and the storefront showed the sample-industry fallback, a steak). Keys are diacritic-free; multi-word keys match
 * at the start of a longer name ("bánh kem dâu"), the bare words "bánh"/"kẹo" only when they ARE the whole name — inside
 * "bánh canh" / "bánh cuốn" they are not bakery. Longest key first, so "bánh mì" never reaches "bánh".
 */
const VI_TYPE_WORDS: ReadonlyArray<{ key: string; exactOnly?: boolean; words: readonly string[] }> = [
  { key: 'banh mi', words: ['bread', 'roti', 'bun', 'loaf', 'baguette', 'sourdough', 'toast'] },
  { key: 'banh kem', words: ['cake', 'cupcake', 'cheesecake', 'brownie', 'gateau'] },
  { key: 'banh ngot', words: ['pastry', 'tart', 'pie', 'croissant', 'donut', 'doughnut', 'muffin', 'scone', 'danish'] },
  { key: 'banh quy', words: ['cookie', 'biscuit', 'cracker'] },
  { key: 'banh', exactOnly: true, words: ['cake', 'cupcake', 'muffin', 'pastry', 'tart', 'cookie', 'dessert', 'bakery', 'donut', 'brownie'] },
  { key: 'keo', exactOnly: true, words: ['candy', 'sweets', 'gummy', 'lollipop', 'jelly'] },
]

/** Lowercase, diacritic-free ("Bánh Kem" → "banh kem"), words joined by single spaces. */
function foldVi(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join(' ')
}

/** Vietnamese tool / accessory / packaging words ("khuôn bánh kem" is a mold, not a cake): never map those to the food. */
const VI_NON_FOOD = [' khuon ', ' de ', ' dao ', ' khay ', ' hop ', ' tui ', ' dung cu ', ' phu kien ']

/**
 * Vietnamese puts the head noun FIRST ("bánh kem dâu" = strawberry cake, "nến bánh kem" = a candle FOR a cake), so a
 * bakery key only names the product's type when it opens the name (after filler like "set / combo / mini"). Anywhere
 * else it is the thing the product is for or made of → not mapped (no type, no photo).
 */
function vietnameseTypeWords(phrase: string): string[] | null {
  const tokens = foldVi(phrase).split(' ')
  while (tokens.length > 0 && NAME_FILLER.has(tokens[0]!)) tokens.shift()
  const folded = ` ${tokens.join(' ')} `
  if (VI_NON_FOOD.some((w) => folded.includes(w))) return null
  for (const { key, exactOnly, words: tags } of VI_TYPE_WORDS) {
    if (exactOnly ? folded === ` ${key} ` : folded.startsWith(` ${key} `)) return [...tags]
  }
  return null
}

/** Words that finish a product name without saying what it is ("gift set", "kuih raya box", "half"). */
const NAME_FILLER = new Set(['set', 'box', 'pack', 'kit', 'bundle', 'combo', 'whole', 'half', 'small', 'medium', 'large', 'mini', 'jumbo', 'ml', 'gram', 'kg', 'pcs'])

/** Lowercase NFC words of a text. */
function words(text: string | undefined): string[] {
  return (text ?? '')
    .normalize('NFC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1)
}

/** Singular-ish form, applied to both the product and the photo side so plural and singular converge. */
function norm(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.length > 4 && /(ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2)
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

/** A photo tag names the type word: same word, or a compound whose head it is ("cupcake" is a cake). */
function tagNames(typeWord: string, tag: string): boolean {
  const type = norm(typeWord)
  const tok = norm(tag)
  if (tok === type) return true
  return type.length >= 3 && tok.length - type.length >= 3 && tok.endsWith(type)
}

const GROUP_OF = new Map<string, TypeGroup>()
for (const group of TYPE_GROUPS) for (const word of group.words) GROUP_OF.set(norm(word), group)

/** The type groups a text's words belong to: product forms win over ingredient groups; the last one of a kind wins. */
function groupsIn(text: string | undefined): TypeGroup[] {
  const found: TypeGroup[] = []
  for (const word of words(text)) {
    const group = GROUP_OF.get(norm(word))
    if (group && !found.includes(group)) found.push(group)
  }
  const products = found.filter((g) => g.kind === 'product')
  const decisive = products.length > 0 ? products : found
  const last = decisive[decisive.length - 1]
  return last ? [last] : []
}

/** Accessories named after what they fit ("laptop stand", "phone case"): the accessory is the type, not the device. */
const ACCESSORY_HEADS = new Set(['stand', 'holder', 'case', 'cover', 'strap', 'sleeve', 'protector', 'mount', 'charger', 'cable', 'adapter'])

/** The part of a name before "with / for / of …": "Serum with Vitamin C" is a serum, "Bag for laptop" a bag. */
function mainPhrase(name: string): string {
  return name.split(/\b(?:with|for|of|and|untuk|dengan|dan)\b/iu)[0] ?? name
}

/**
 * What the product IS, as words a photo's tags must contain one of; [] when it cannot be told. Taken from the NAME
 * only: the AI's image keyword is often an ingredient or a mood ("orange", "glow").
 */
export function productTypeWords(product: { name: string }): string[] {
  const phrase = mainPhrase(product.name)
  const head = [...words(phrase)].reverse().find((w) => !NAME_FILLER.has(w))
  if (head && ACCESSORY_HEADS.has(head)) return [head]
  const vi = vietnameseTypeWords(phrase)
  if (vi) return vi
  const group = groupsIn(phrase)[0]
  if (group) return [...group.words]
  // not in the lexicon: the head noun of the name (last word of an English name, before "set / box / pack")
  return head ? [head] : []
}

/**
 * True when the photo's tags name the product's type (or a synonym). Ingredient-only overlaps
 * ("vitamin c", "orange" for a "Vitamin C Serum") are not enough; a product whose type cannot be told matches nothing.
 */
export function photoMatchesProductType(photoTags: string | null | undefined, product: { name: string }): boolean {
  if (!photoTags) return false
  const type = productTypeWords(product)
  if (type.length === 0) return false
  const tags = words(photoTags)
  return type.some((typeWord) => tags.some((tag) => tagNames(typeWord, tag)))
}
