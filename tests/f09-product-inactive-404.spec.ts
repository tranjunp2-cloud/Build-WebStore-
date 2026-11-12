import { expect, test } from '@playwright/test'

// [TC-F09.294] GH-2100 — SP không tồn tại / draft / archived phải trả HTTP 404 thật (không soft 404).
// Product slug không active đi cùng nhánh `getProductData → null → notFound()` như draft/archived.
const SITE_PATH = process.env.E2E_CART_PRODUCT_PATH?.split('/products/')[0] || '/sites/glowbox-toys'
const ACTIVE_PRODUCT_PATH = process.env.E2E_CART_PRODUCT_PATH || `${SITE_PATH}/products/cute-plush-bear-hoodie-o18z8`

test('[TC-F09.294] PDP của sản phẩm không hiển thị trả 404, sản phẩm active trả 200', async ({ request }) => {
    const missing = await request.get(`${SITE_PATH}/products/gh-2100-not-an-active-product`)
    expect(missing.status()).toBe(404)
    expect(await missing.text()).toContain('Not Found')

    const active = await request.get(ACTIVE_PRODUCT_PATH)
    expect(active.status()).toBe(200)
})
