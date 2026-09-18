import crypto from 'node:crypto'
import { load } from 'cheerio'

export const PRODUCT_LIMITS = Object.freeze({
  price: 100_000_000,
  inventory: 1_000_000,
  images: Number.POSITIVE_INFINITY,
  variantConfigs: 2,
  variantOptions: 30,
  variants: 900,
  attributes: 20,
})

const TEXT_FORMAT = Object.freeze({
  bold: 1,
  italic: 2,
  strikethrough: 4,
  underline: 8,
  code: 16,
  subscript: 32,
  superscript: 64,
})

const hasValue = (value) => value !== '' && value !== null && value !== undefined
const normalizeKey = (value) => String(value ?? '').trim().toLowerCase()

function safeCustomUrl(value) {
  const raw = String(value ?? '')
  // Cheerio has decoded HTML entities. Browsers strip TAB/LF/CR inside schemes,
  // so reject controls before trimming and validate the parsed protocol too.
  if ([...raw].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return undefined
  const url = raw.trim()
  if (!url) return undefined
  try {
    const parsed = new URL(url, 'https://migration.invalid/')
    return ['http:', 'https:', 'mailto:', 'sms:', 'tel:'].includes(parsed.protocol) ? url : undefined
  } catch {
    // Invalid URLs are flattened to their text label by inlineNodes.
    return undefined
  }
}

export function normalizeExternalMediaUrl(value) {
  const url = String(value ?? '').trim()
  if (!/^https?:\/\//i.test(url)) return undefined
  try {
    const parsed = new URL(url)
    if (!parsed.hostname || parsed.username || parsed.password) return undefined
    return url
  } catch {
    return undefined
  }
}

function textNode(text, format = 0) {
  return {
    type: 'text',
    detail: 0,
    format,
    mode: 'normal',
    style: '',
    text,
    version: 1,
  }
}

function paragraphNode(children) {
  return {
    type: 'paragraph',
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
    version: 1,
  }
}

function inlineNodes(nodes, inheritedFormat = 0) {
  const output = []

  for (const node of nodes ?? []) {
    if (node.type === 'text') {
      if (node.data) output.push(textNode(node.data, inheritedFormat))
      continue
    }
    if (node.type !== 'tag') continue

    const tag = node.name?.toLowerCase()
    if (tag === 'br') {
      output.push({ type: 'linebreak', version: 1 })
      continue
    }
    if (tag === 'img') {
      const alt = String(node.attribs?.alt ?? '').trim()
      const src = String(node.attribs?.src ?? '').trim()
      const label = alt ? `[Image: ${alt}]` : '[Image]'
      output.push(textNode(src ? `${label} ${src}` : label, inheritedFormat))
      continue
    }

    let format = inheritedFormat
    if (tag === 'strong' || tag === 'b') format |= TEXT_FORMAT.bold
    if (tag === 'em' || tag === 'i') format |= TEXT_FORMAT.italic
    if (tag === 's' || tag === 'del') format |= TEXT_FORMAT.strikethrough
    if (tag === 'u') format |= TEXT_FORMAT.underline
    if (tag === 'code') format |= TEXT_FORMAT.code
    if (tag === 'sub') format |= TEXT_FORMAT.subscript
    if (tag === 'sup') format |= TEXT_FORMAT.superscript

    const children = inlineNodes(node.children, format)
    if (tag === 'a' && children.length > 0) {
      const url = safeCustomUrl(node.attribs?.href)
      if (url) {
        output.push({
          type: 'link',
          children,
          direction: 'ltr',
          fields: {
            doc: null,
            linkType: 'custom',
            newTab: node.attribs?.target === '_blank',
            url,
          },
          format: '',
          id: crypto.createHash('sha256').update(`${url}\0${children.map((child) => child.text ?? '').join('')}`).digest('hex').slice(0, 24),
          indent: 0,
          version: 3,
        })
      } else {
        output.push(...children)
      }
      continue
    }

    output.push(...children)
  }

  return output
}

function listNode(node, ordered) {
  const items = (node.children ?? []).filter(
    (child) => child.type === 'tag' && child.name?.toLowerCase() === 'li',
  )
  return {
    type: 'list',
    children: items.map((item, index) => ({
      type: 'listitem',
      checked: undefined,
      children: inlineNodes(item.children),
      direction: 'ltr',
      format: '',
      indent: 0,
      value: index + 1,
      version: 1,
    })),
    direction: 'ltr',
    format: '',
    indent: 0,
    listType: ordered ? 'number' : 'bullet',
    start: 1,
    tag: ordered ? 'ol' : 'ul',
    version: 1,
  }
}

/**
 * Convert the HTML/plain-text subset observed in PW1 Product descriptions into
 * Payload 3 Lexical JSON. Raw source HTML remains addressable through the
 * companion manifest, so unsupported markup never becomes silent loss.
 */
export function htmlToLexical(value) {
  if (!hasValue(value)) return undefined
  const html = String(value)
  const $ = load(html, undefined, false)
  const children = []

  for (const node of $.root().contents().toArray()) {
    if (node.type === 'text') {
      if (node.data?.trim()) children.push(paragraphNode([textNode(node.data)]))
      continue
    }
    if (node.type !== 'tag') continue

    const tag = node.name?.toLowerCase()
    if (tag === 'ul' || tag === 'ol') {
      children.push(listNode(node, tag === 'ol'))
    } else if (tag === 'blockquote') {
      children.push({
        type: 'quote',
        children: inlineNodes(node.children),
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      })
    } else {
      children.push(paragraphNode(inlineNodes([node])))
    }
  }

  if (children.length === 0) children.push(paragraphNode([textNode($.text())]))
  return {
    root: {
      type: 'root',
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

export function deriveVariantBaseSku(productRef, sourceInstanceToken) {
  const sourceId = String(productRef ?? '').split(':').at(-1)
  if (!/^[A-Za-z0-9]+$/.test(sourceInstanceToken ?? '') || !/^[1-9][0-9]*$/.test(sourceId ?? '')) {
    throw new Error('Explicit alphanumeric sourceInstanceToken and positive Product ID are required')
  }
  const sku = `PW1${sourceInstanceToken}P${sourceId}`
  if (sku.length > 50) throw new Error('Synthetic Product SKU exceeds 50 characters')
  return sku
}

export function sanitizeProductDocument(document, sourceRow, { sourceInstanceToken } = {}) {
  const clean = structuredClone(document)
  for (const key of [
    'brand',
    'cost',
    'lowStockThreshold',
    'scheduledPrices',
    'shortDescriptionBM',
    'skuImages',
    'weightUnit',
  ]) {
    delete clean[key]
  }

  if (clean.dimensions && typeof clean.dimensions === 'object') delete clean.dimensions.unit

  if (hasValue(sourceRow?.description)) clean.description = htmlToLexical(sourceRow.description)
  else delete clean.description
  if (hasValue(sourceRow?.description_ms)) clean.descriptionBM = htmlToLexical(sourceRow.description_ms)
  else delete clean.descriptionBM

  // Publication status is mapped by the caller; sanitizing content must not reset it.
  if (clean.hasVariants) clean.sku = deriveVariantBaseSku(clean._ref, sourceInstanceToken)

  clean.images = (clean.images ?? []).map((image) => ({
    image: image.image,
    ...(hasValue(image.alt) ? { alt: image.alt } : {}),
  }))
  clean.variants = (clean.variants ?? []).map((variant) => {
    const output = structuredClone(variant)
    for (const key of ['cost', 'images', 'scheduledPrices', 'selectedOptions', 'sortOrder']) {
      delete output[key]
    }
    return output
  })

  if (clean.hasVariants && clean.variants.length && clean.variants.every((v) => Number.isFinite(v.price))) {
    clean.price = Math.min(...clean.variants.map((v) => v.price))
  }
  return clean
}

export function sanitizeExternalMediaDocument(document) {
  const clean = structuredClone(document)
  const url = normalizeExternalMediaUrl(clean.sourceUrl ?? clean.url)
  if (url) {
    clean.sourceUrl = url
    clean.url = url
  } else {
    delete clean.sourceUrl
    delete clean.url
  }
  return clean
}

function addError(errors, code, path, message) {
  errors.push({ code, path, message })
}

function validateNumber(errors, value, path, { required = false, min, max } = {}) {
  if (!hasValue(value)) {
    if (required) addError(errors, 'REQUIRED_FIELD_MISSING', path, `${path} is required`)
    return
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    addError(errors, 'INVALID_NUMBER', path, `${path} must be a finite number`)
    return
  }
  if (min !== undefined && value < min) addError(errors, 'NUMBER_BELOW_MIN', path, `${path} must be >= ${min}`)
  if (max !== undefined && value > max) addError(errors, 'NUMBER_ABOVE_MAX', path, `${path} must be <= ${max}`)
}

function duplicateKeys(values) {
  const seen = new Set()
  const duplicates = new Set()
  for (const value of values.map(normalizeKey).filter(Boolean)) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates]
}

function validateLexicalDocument(errors, value, path) {
  if (!hasValue(value)) return
  const root = value && typeof value === 'object' ? value.root : undefined
  if (!root || root.type !== 'root' || root.version !== 1 || !Array.isArray(root.children)) {
    addError(errors, 'INVALID_LEXICAL_DOCUMENT', path, `${path} must be a Payload Lexical root document`)
    return
  }

  const invalidNode = (nodes) => nodes.some((node) => (
    !node
    || typeof node !== 'object'
    || typeof node.type !== 'string'
    || !Number.isInteger(node.version)
    || ('children' in node && (!Array.isArray(node.children) || invalidNode(node.children)))
  ))
  if (invalidNode(root.children)) {
    addError(errors, 'INVALID_LEXICAL_DOCUMENT', path, `${path} contains an invalid Lexical node`)
  }
}

export function validateProductDocument(product, context = {}) {
  const errors = []
  const ref = product?._ref ?? '(unknown product)'

  if (!hasValue(product?.tenant)) addError(errors, 'REQUIRED_FIELD_MISSING', 'tenant', 'tenant is required')
  if (!hasValue(product?.site)) addError(errors, 'REQUIRED_FIELD_MISSING', 'site', 'site is required')
  if (context.tenantRef && product?.tenant !== context.tenantRef) {
    addError(errors, 'TENANT_REFERENCE_MISMATCH', 'tenant', `${ref} does not reference the Store tenant`)
  }
  if (context.siteRefs && !context.siteRefs.has(product?.site)) {
    addError(errors, 'SITE_REFERENCE_UNRESOLVED', 'site', `${ref} references an unavailable Site`)
  }

  const name = String(product?.name ?? '').trim()
  if (name.length < 3) addError(errors, 'PRODUCT_NAME_TOO_SHORT', 'name', 'name must contain at least 3 characters')
  if (name.length > 120) addError(errors, 'PRODUCT_NAME_TOO_LONG', 'name', 'name must contain at most 120 characters')
  if (!hasValue(product?.slug)) addError(errors, 'REQUIRED_FIELD_MISSING', 'slug', 'slug is required')
  if (!['MYR', 'USD', 'SGD'].includes(product?.currency)) {
    addError(errors, 'INVALID_CURRENCY', 'currency', 'currency must be MYR, USD, or SGD')
  }
  if (!['draft', 'active', 'archived'].includes(product?.status)) {
    addError(errors, 'INVALID_PRODUCT_STATUS', 'status', 'status must be draft, active, or archived')
  }

  validateNumber(errors, product?.price, 'price', { required: true, min: 0, max: PRODUCT_LIMITS.price })
  validateNumber(errors, product?.compareAtPrice, 'compareAtPrice', { min: 0, max: PRODUCT_LIMITS.price })
  if (hasValue(product?.compareAtPrice) && product.compareAtPrice !== 0 && product.compareAtPrice <= product.price) {
    addError(errors, 'COMPARE_AT_PRICE_NOT_GREATER', 'compareAtPrice', 'compareAtPrice must be greater than price')
  }
  validateNumber(errors, product?.inventory, 'inventory', { min: 0, max: PRODUCT_LIMITS.inventory })
  validateNumber(errors, product?.weight, 'weight', { min: 0 })
  validateLexicalDocument(errors, product?.description, 'description')
  validateLexicalDocument(errors, product?.descriptionBM, 'descriptionBM')

  if (hasValue(product?.sku) && String(product.sku).trim().length > 50) {
    addError(errors, 'PRODUCT_SKU_TOO_LONG', 'sku', 'Migration base sku must contain at most 50 characters')
  }

  const images = Array.isArray(product?.images) ? product.images : []
  if (images.length > PRODUCT_LIMITS.images) addError(errors, 'TOO_MANY_PRODUCT_IMAGES', 'images', `images may contain at most ${PRODUCT_LIMITS.images} rows`)
  images.forEach((image, index) => {
    if (!hasValue(image?.image)) addError(errors, 'REQUIRED_FIELD_MISSING', `images.${index}.image`, 'Product image relationship is required')
    if (context.mediaRefs && !context.mediaRefs.has(image?.image)) {
      addError(errors, 'MEDIA_REFERENCE_UNRESOLVED', `images.${index}.image`, 'Product image relationship cannot be resolved')
    }
    if (context.mediaUrlsByRef && !normalizeExternalMediaUrl(context.mediaUrlsByRef.get(image?.image))) {
      addError(errors, 'MEDIA_EXTERNAL_URL_INVALID', `images.${index}.image`, 'Product image Media must contain an HTTP(S) external URL')
    }
    if (hasValue(image?.alt) && String(image.alt).length > 500) {
      addError(errors, 'PRODUCT_IMAGE_ALT_TOO_LONG', `images.${index}.alt`, 'Product image alt must contain at most 500 characters')
    }
  })

  const categories = Array.isArray(product?.category) ? product.category : []
  if (categories.length !== 1 && !(context.allowEmptyCategory === true && Array.isArray(product?.category) && categories.length === 0)) addError(errors, 'CATEGORY_CARDINALITY_INVALID', 'category', 'Migration policy requires exactly one Product category')
  categories.forEach((category, index) => {
    if (context.categoryRefs && !context.categoryRefs.has(category)) {
      addError(errors, 'CATEGORY_REFERENCE_UNRESOLVED', `category.${index}`, 'Product category relationship cannot be resolved')
    }
  })

  const tags = Array.isArray(product?.tags) ? product.tags : []
  tags.forEach((tag, index) => {
    if (!String(tag?.tag ?? '').trim()) addError(errors, 'REQUIRED_FIELD_MISSING', `tags.${index}.tag`, 'Product tag is required')
  })

  if (hasValue(product?.halalCertImage) && context.mediaRefs && !context.mediaRefs.has(product.halalCertImage)) {
    addError(errors, 'MEDIA_REFERENCE_UNRESOLVED', 'halalCertImage', 'Halal certificate image relationship cannot be resolved')
  }

  const configs = Array.isArray(product?.variantConfigs) ? product.variantConfigs : []
  if (configs.length > PRODUCT_LIMITS.variantConfigs) addError(errors, 'TOO_MANY_VARIANT_CONFIGS', 'variantConfigs', `variantConfigs may contain at most ${PRODUCT_LIMITS.variantConfigs} rows`)
  for (const name of duplicateKeys(configs.map((config) => config?.name))) {
    addError(errors, 'DUPLICATE_VARIANT_CONFIG_NAME', 'variantConfigs', `Duplicate variant config name: ${name}`)
  }
  configs.forEach((config, configIndex) => {
    const configName = String(config?.name ?? '').trim()
    if (!configName) addError(errors, 'REQUIRED_FIELD_MISSING', `variantConfigs.${configIndex}.name`, 'Variant config name is required')
    if (configName.length > 50) addError(errors, 'VARIANT_CONFIG_NAME_TOO_LONG', `variantConfigs.${configIndex}.name`, 'Variant config name must contain at most 50 characters')
    const options = Array.isArray(config?.options) ? config.options : []
    if (options.length < 1 || options.length > PRODUCT_LIMITS.variantOptions) {
      addError(errors, 'VARIANT_OPTION_COUNT_INVALID', `variantConfigs.${configIndex}.options`, `Variant config options must contain 1..${PRODUCT_LIMITS.variantOptions} rows`)
    }
    for (const option of duplicateKeys(options.map((item) => item?.value))) {
      addError(errors, 'DUPLICATE_VARIANT_OPTION', `variantConfigs.${configIndex}.options`, `Duplicate variant option: ${option}`)
    }
    options.forEach((option, optionIndex) => {
      const optionValue = String(option?.value ?? '').trim()
      if (!optionValue) addError(errors, 'REQUIRED_FIELD_MISSING', `variantConfigs.${configIndex}.options.${optionIndex}.value`, 'Variant option value is required')
      if (optionValue.length > 50) addError(errors, 'VARIANT_OPTION_TOO_LONG', `variantConfigs.${configIndex}.options.${optionIndex}.value`, 'Variant option value must contain at most 50 characters')
    })
  })

  const variants = Array.isArray(product?.variants) ? product.variants : []
  if (variants.length > PRODUCT_LIMITS.variants) addError(errors, 'TOO_MANY_VARIANTS', 'variants', `variants may contain at most ${PRODUCT_LIMITS.variants} rows`)
  for (const name of duplicateKeys(variants.map((variant) => variant?.name))) {
    addError(errors, 'DUPLICATE_VARIANT_NAME', 'variants', `Duplicate variant name: ${name}`)
  }
  for (const sku of duplicateKeys([product?.sku, ...variants.map((variant) => variant?.sku)])) {
    addError(errors, 'DUPLICATE_PRODUCT_SKU', 'sku', `Duplicate base/variant SKU inside Product: ${sku}`)
  }
  variants.forEach((variant, variantIndex) => {
    const variantName = String(variant?.name ?? '').trim()
    const variantSku = String(variant?.sku ?? '').trim()
    if (!variantName) addError(errors, 'REQUIRED_FIELD_MISSING', `variants.${variantIndex}.name`, 'Variant name is required')
    if (variantSku.length > 100) addError(errors, 'VARIANT_SKU_TOO_LONG', `variants.${variantIndex}.sku`, 'Variant SKU must contain at most 100 characters')
    validateNumber(errors, variant?.price, `variants.${variantIndex}.price`, { required: true, min: 0, max: PRODUCT_LIMITS.price })
    validateNumber(errors, variant?.compareAtPrice, `variants.${variantIndex}.compareAtPrice`, { min: 0, max: PRODUCT_LIMITS.price })
    if (hasValue(variant?.compareAtPrice) && variant.compareAtPrice !== 0 && variant.compareAtPrice <= variant.price) {
      addError(errors, 'COMPARE_AT_PRICE_NOT_GREATER', `variants.${variantIndex}.compareAtPrice`, 'Variant compareAtPrice must be greater than price')
    }
    validateNumber(errors, variant?.stock, `variants.${variantIndex}.stock`, { required: true, min: 0, max: PRODUCT_LIMITS.inventory })
  })

  if (!product?.hasVariants && (configs.length || variants.length)) {
    addError(errors, 'NON_VARIANT_HAS_EAV', 'hasVariants', 'Non-variant Product must have no option domain or variants')
  }
  if (context.sourceCatalog) {
    for (const field of ['hasVariants', 'variantConfigs', 'variants', 'sku', 'price', 'inventory']) {
      if (JSON.stringify(product?.[field]) !== JSON.stringify(context.sourceCatalog.fields[field])) {
        addError(errors, 'SOURCE_CATALOG_MISMATCH', field, 'Product differs from source EAV reconstruction')
      }
    }
    errors.push(...context.sourceCatalog.errors)
  }
  if (product?.hasVariants && variants.length && variants.every((v) => Number.isFinite(v.price))
    && product.price !== Math.min(...variants.map((v) => v.price))) {
    addError(errors, 'VARIANT_MIN_PRICE_MISMATCH', 'price', 'Product price must equal minimum eligible variant base price')
  }
  if (product?.hasVariants && context.sourceInstanceToken) {
    try {
      if (product.sku !== deriveVariantBaseSku(product._ref, context.sourceInstanceToken)) {
        addError(errors, 'SYNTHETIC_SKU_MISMATCH', 'sku', 'Base SKU must include the source instance token')
      }
    } catch (error) {
      addError(errors, 'SYNTHETIC_SKU_INVALID', 'sku', error.message)
    }
  }
  if (product?.hasVariants && variants.length === 0) {
    addError(errors, 'VARIANTS_REQUIRED_BY_MIGRATION_POLICY', 'variants', 'hasVariants Product must contain at least one variant')
  }
  if (product?.hasVariants) {
    const stock = variants.reduce((total, variant) => total + (Number(variant?.stock) || 0), 0)
    if (product.inventory !== stock) addError(errors, 'PRODUCT_INVENTORY_MISMATCH', 'inventory', `inventory must equal variant stock sum ${stock}`)
  }

  const dimensions = product?.dimensions ?? {}
  for (const field of ['length', 'width', 'height']) {
    validateNumber(errors, dimensions[field], `dimensions.${field}`, { min: 0 })
  }

  const attributes = Array.isArray(product?.attributes) ? product.attributes : []
  if (attributes.length > PRODUCT_LIMITS.attributes) addError(errors, 'TOO_MANY_ATTRIBUTES', 'attributes', `attributes may contain at most ${PRODUCT_LIMITS.attributes} rows`)
  attributes.forEach((attribute, index) => {
    const key = String(attribute?.key ?? '').trim()
    const value = String(attribute?.value ?? '').trim()
    if (!key) addError(errors, 'REQUIRED_FIELD_MISSING', `attributes.${index}.key`, 'Attribute key is required')
    if (!value) addError(errors, 'REQUIRED_FIELD_MISSING', `attributes.${index}.value`, 'Attribute value is required')
    if (key.length > 100) addError(errors, 'ATTRIBUTE_KEY_TOO_LONG', `attributes.${index}.key`, 'Attribute key must contain at most 100 characters')
    if (value.length > 500) addError(errors, 'ATTRIBUTE_VALUE_TOO_LONG', `attributes.${index}.value`, 'Attribute value must contain at most 500 characters')
  })

  return errors
}

export function findProductSkuCollisions(products) {
  const ownersBySku = new Map()
  for (const product of products) {
    const values = [product?.sku, ...(product?.variants ?? []).map((variant) => variant?.sku)]
    for (const sku of new Set(values.map(normalizeKey).filter(Boolean))) {
      const owners = ownersBySku.get(sku) ?? new Set()
      owners.add(product._ref)
      ownersBySku.set(sku, owners)
    }
  }

  const errorsByProduct = new Map()
  for (const [sku, owners] of ownersBySku) {
    if (owners.size < 2) continue
    for (const owner of owners) {
      const errors = errorsByProduct.get(owner) ?? []
      errors.push({
        code: 'CROSS_PRODUCT_SKU_COLLISION',
        path: 'sku',
        message: `SKU ${sku} is shared by Products: ${[...owners].join(', ')}`,
      })
      errorsByProduct.set(owner, errors)
    }
  }
  return errorsByProduct
}
