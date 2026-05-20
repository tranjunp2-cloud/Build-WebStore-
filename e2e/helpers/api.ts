import { type APIRequestContext } from '@playwright/test'

/**
 * Make an authenticated API request using the test session.
 */
export async function apiRequest(
    request: APIRequestContext,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    endpoint: string,
    data?: Record<string, unknown>,
) {
    const options: Record<string, unknown> = {}
    if (data) options.data = data

    switch (method) {
        case 'GET':
            return request.get(endpoint)
        case 'POST':
            return request.post(endpoint, options)
        case 'PATCH':
            return request.patch(endpoint, options)
        case 'DELETE':
            return request.delete(endpoint)
    }
}

/**
 * Delete a product by ID (for test cleanup).
 */
export async function deleteProduct(request: APIRequestContext, productId: string) {
    return request.delete(`/api/products/${productId}`)
}
