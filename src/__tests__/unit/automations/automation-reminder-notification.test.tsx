/**
 * TC-AICP-242 — a bell notification of the new type shows its own icon and its stored (already translated) text.
 * Real: NotificationItem, en strings. Faked: nothing.
 */
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { NotificationItem } from '@/components/notifications/NotificationItem'
import { I18nProvider } from '@/i18n'

afterEach(cleanup)

describe('bell notification of the new type [TC-AICP-242]', () => {
    it('shows the stored reminder text with its own icon, not the order icon', () => {
        const { container } = render(
            <I18nProvider defaultLocale="en">
                <NotificationItem notification={{ id: '1', type: 'AUTOMATION_REMINDER', title: '6 live products are out of stock', message: 'Active products with 0 in stock.', metadata: { automation: 'stock' }, actionUrl: '/products?todo=out_of_stock', isRead: false, createdAt: new Date().toISOString() }} />
            </I18nProvider>,
        )

        expect(screen.getByText('6 live products are out of stock')).toBeInTheDocument()
        expect(screen.getByText('Active products with 0 in stock.')).toBeInTheDocument()
        expect(container.querySelector('svg.lucide-clipboard-check')).not.toBeNull()
        expect(container.querySelector('svg.lucide-shopping-cart')).toBeNull()
    })
})
