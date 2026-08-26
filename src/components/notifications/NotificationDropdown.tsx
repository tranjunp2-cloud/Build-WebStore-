'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useNotificationStore } from '@/store/notificationStore'
import { useI18n } from '@/i18n'
import { NotificationItem } from './NotificationItem'
import { NotificationEmptyState } from './NotificationEmptyState'
import type { NotificationsResponse, NotificationItem as NotificationItemType } from '@/types/notification'
import { Loader2 } from 'lucide-react'

export function NotificationDropdown() {
  const { isDropdownOpen, setDropdownOpen, setUnreadCount, decrementUnreadCount, incrementUnreadCount, resetUnread } = useNotificationStore()
  const { t } = useI18n()
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const markingReadRef = useRef<Set<string>>(new Set())

  const [data, setData] = useState<NotificationsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const fetchNotifications = async () => {
    setIsLoading(true)
    setIsError(false)
    try {
      const res = await fetch('/api/notifications?limit=20')
      if (!res.ok) throw new Error('Network response failure')
      const json = await res.json() as NotificationsResponse
      if (json.unreadCount !== undefined) {
         setUnreadCount(json.unreadCount)
      }
      setData(json)
    } catch (error) {
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isDropdownOpen && !data) {
      fetchNotifications()
    }
    if (!isDropdownOpen) {
      setIsExpanded(false)
      setData(null)
      markingReadRef.current.clear()
    }
  }, [isDropdownOpen, data])

  const refetch = () => {
    fetchNotifications()
  }

  const handleItemClick = useCallback((notification: NotificationItemType) => {
    const wasUnread = !notification.isRead && !markingReadRef.current.has(notification.id)

    // Skip if nothing to do, or if actionUrl is an unsafe external URL
    if (notification.actionUrl && !notification.actionUrl.startsWith('/')) return
    if (!wasUnread && !notification.actionUrl) return

    // Optimistic UI: mark item as read in local state
    if (wasUnread) {
      markingReadRef.current.add(notification.id)
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          unreadCount: Math.max(0, prev.unreadCount - 1),
          items: prev.items.map((item) =>
            item.id === notification.id ? { ...item, isRead: true } : item
          ),
        }
      })
      decrementUnreadCount(1)
    }

    // Navigate to actionUrl or just close dropdown
    if (notification.actionUrl) {
      setDropdownOpen(false)
      router.push(notification.actionUrl)
    } else {
      setDropdownOpen(false)
    }

    // Mark-read API call with rollback on failure
    if (wasUnread) {
      fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [notification.id] }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('mark-read failed')
        })
        .catch(() => {
          // Rollback optimistic UI
          markingReadRef.current.delete(notification.id)
          setData((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              unreadCount: prev.unreadCount + 1,
              items: prev.items.map((item) =>
                item.id === notification.id ? { ...item, isRead: false } : item
              ),
            }
          })
          incrementUnreadCount()
        })
    }
  }, [decrementUnreadCount, incrementUnreadCount, router, setDropdownOpen])

  const handleMarkAll = useCallback(() => {
    if (!data || data.unreadCount === 0) return

    // Save snapshot for rollback
    const snapshot = {
      unreadCount: data.unreadCount,
      items: data.items.map((item) => ({ ...item })),
    }

    // Optimistic: mark all as read
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        unreadCount: 0,
        items: prev.items.map((item) => ({ ...item, isRead: true })),
      }
    })
    resetUnread()
    markingReadRef.current.clear()

    // API call with rollback on failure
    fetch('/api/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all: true }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('mark-all failed')
      })
      .catch(() => {
        // Rollback to snapshot
        setData((prev) => {
          if (!prev) return prev
          return { ...prev, unreadCount: snapshot.unreadCount, items: snapshot.items }
        })
        setUnreadCount(snapshot.unreadCount)
      })
  }, [data, resetUnread, setUnreadCount])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        !(event.target as Element).closest('#notification-bell-btn')
      ) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [setDropdownOpen])

  // Collapsed preview shows whole items only — never a half-clipped sliver.
  // Render at most PREVIEW_LIMIT complete items; if more exist, show "View all"
  // (expands to a scrollable full list). Otherwise everything fits → "Close".
  // PREVIEW_LIMIT = 4 matches the F16 design mockup (4 rows + "View all ▼").
  const PREVIEW_LIMIT = 4
  const allItems = data?.items ?? []
  const visibleItems = isExpanded ? allItems : allItems.slice(0, PREVIEW_LIMIT)
  const hasMoreItems = allItems.length > PREVIEW_LIMIT

  if (!isDropdownOpen) return null

  return (
    <div 
      ref={dropdownRef}
      className="fixed sm:absolute top-[60px] sm:top-14 left-1/2 sm:left-auto -translate-x-1/2 sm:translate-x-0 sm:right-0 w-[calc(100vw-32px)] sm:w-[380px] max-w-[340px] sm:max-w-none max-h-[calc(100dvh-76px)] sm:max-h-none rounded-[16px] bg-[#1E293B] border border-white/10 shadow-2xl flex flex-col z-[100] overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 sm:px-5 pt-3 pb-3 sm:pt-4">
        <h3 className="text-[16px] sm:text-[18px] font-bold text-white leading-relaxed">{t.notifications.title}</h3>
        <button
          onClick={handleMarkAll}
          disabled={!data || data.unreadCount === 0}
          className="text-[12px] sm:text-[14px] font-medium text-blue-500 hover:text-blue-400 transition-colors disabled:text-white/20 disabled:cursor-not-allowed disabled:pointer-events-none"
        >
          {t.notifications.markAllRead}
        </button>
      </div>

      <div className={`flex-1 min-h-0 ${isExpanded ? 'max-h-[460px] overflow-y-auto custom-scrollbar' : ''} bg-[#1E293B] transition-all duration-300`}>
        {isLoading && (
            <div className="flex items-center justify-center py-10 bg-[#1E293B]">
                <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
            </div>
        )}
        
        {isError && (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <p className="text-[14px] text-red-400 mb-3">{t.notifications.loadError}</p>
                <button 
                  onClick={() => refetch()}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-[14px] font-medium transition-colors border border-white/10"
                >
                  {t.notifications.retry}
                </button>
            </div>
        )}

        {!isLoading && !isError && data?.items?.length === 0 && (
            <NotificationEmptyState />
        )}

        {!isLoading && !isError && visibleItems.length > 0 && (
            <div className="flex flex-col">
              {visibleItems.map((item) => (
                <NotificationItem key={item.id} notification={item} onClick={handleItemClick} />
              ))}
            </div>
        )}
      </div>

      <div className="border-t border-white/10 p-[12px] sm:p-[13px] px-4 sm:px-5">
        {!isExpanded && hasMoreItems ? (
          <button 
            onClick={() => setIsExpanded(true)}
            className="w-full h-[40px] sm:h-[42px] rounded-xl border border-solid border-white/10 text-white text-[13px] sm:text-[14px] font-medium flex items-center justify-center hover:bg-white/5 transition-colors"
          >
            {t.notifications.viewAll}
          </button>
        ) : (
          <button 
            onClick={() => setDropdownOpen(false)}
            className="w-full h-[40px] sm:h-[42px] rounded-xl border border-solid border-white/10 text-white text-[13px] sm:text-[14px] font-medium flex items-center justify-center hover:bg-white/5 transition-colors"
          >
            {t.notifications.close}
          </button>
        )}
      </div>
    </div>
  )
}
