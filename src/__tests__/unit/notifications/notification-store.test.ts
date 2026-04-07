// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { useNotificationStore } from '@/store/notificationStore'

// ── TC-F16.01, TC-F16.06, TC-F16.07: Notification Store ─────────────────

function getState() {
    return useNotificationStore.getState()
}

describe('[TC-F16.01] notificationStore — unreadCount management', () => {
    beforeEach(() => {
        // Reset store
        useNotificationStore.setState({ unreadCount: 0, isDropdownOpen: false })
    })

    it('starts with unreadCount = 0', () => {
        expect(getState().unreadCount).toBe(0)
    })

    it('setUnreadCount sets exact value', () => {
        // Act
        getState().setUnreadCount(5)

        // Assert
        expect(getState().unreadCount).toBe(5)
    })

    it('setUnreadCount clamps negative to 0', () => {
        // Act
        getState().setUnreadCount(-3)

        // Assert
        expect(getState().unreadCount).toBe(0)
    })

    it('incrementUnreadCount adds 1', () => {
        // Arrange
        getState().setUnreadCount(3)

        // Act
        getState().incrementUnreadCount()

        // Assert
        expect(getState().unreadCount).toBe(4)
    })

    it('decrementUnreadCount subtracts given amount', () => {
        // Arrange
        getState().setUnreadCount(5)

        // Act
        getState().decrementUnreadCount(2)

        // Assert
        expect(getState().unreadCount).toBe(3)
    })

    it('decrementUnreadCount defaults to 1', () => {
        // Arrange
        getState().setUnreadCount(3)

        // Act
        getState().decrementUnreadCount()

        // Assert
        expect(getState().unreadCount).toBe(2)
    })

    it('decrementUnreadCount clamps to 0 (never negative)', () => {
        // Arrange
        getState().setUnreadCount(1)

        // Act
        getState().decrementUnreadCount(5)

        // Assert
        expect(getState().unreadCount).toBe(0)
    })

    it('resetUnread sets count to 0', () => {
        // Arrange
        getState().setUnreadCount(10)

        // Act
        getState().resetUnread()

        // Assert
        expect(getState().unreadCount).toBe(0)
    })
})

describe('[TC-F16.04] notificationStore — dropdown state', () => {
    beforeEach(() => {
        useNotificationStore.setState({ unreadCount: 0, isDropdownOpen: false })
    })

    it('starts with dropdown closed', () => {
        expect(getState().isDropdownOpen).toBe(false)
    })

    it('setDropdownOpen(true) opens dropdown', () => {
        // Act
        getState().setDropdownOpen(true)

        // Assert
        expect(getState().isDropdownOpen).toBe(true)
    })

    it('setDropdownOpen(false) closes dropdown', () => {
        // Arrange
        getState().setDropdownOpen(true)

        // Act
        getState().setDropdownOpen(false)

        // Assert
        expect(getState().isDropdownOpen).toBe(false)
    })
})
