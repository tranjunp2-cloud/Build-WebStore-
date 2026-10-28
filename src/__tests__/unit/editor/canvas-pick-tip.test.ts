// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { CANVAS_PICK_TIP_KEY, useCanvasPickTip } from '@/components/editor/agent/canvas-pick-tip'

function chatBoxWithChip() {
  const root = document.createElement('div')
  const chips = document.createElement('div')
  chips.className = 'ech-ag-els'
  root.appendChild(chips)
  document.body.appendChild(root)
  return { current: root }
}

describe('canvas pick tip (Shift + click hint)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(performance.now())
      return 0
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  // TC-AICP-339
  it('shows on every single pick until the merchant has used Shift + click', () => {
    // Arrange
    const { result } = renderHook(() => useCanvasPickTip(chatBoxWithChip()))

    // Act + Assert: first single pick shows, auto-hides after 6 s
    act(() => result.current.onPicked(false))
    expect(result.current.place).not.toBeNull()
    act(() => vi.advanceTimersByTime(6000))
    expect(result.current.place).toBeNull()

    // a second single pick shows it again (not once per browser any more)
    act(() => result.current.onPicked(false))
    expect(result.current.place).not.toBeNull()

    // Shift + click hides it and marks it learned: no more tips
    act(() => result.current.onPicked(true))
    expect(result.current.place).toBeNull()
    expect(window.localStorage.getItem(CANVAS_PICK_TIP_KEY)).toBe('1')
    act(() => result.current.onPicked(false))
    expect(result.current.place).toBeNull()
  })

  // TC-AICP-340
  it('closing the tip stops it from showing again', () => {
    // Arrange
    const { result } = renderHook(() => useCanvasPickTip(chatBoxWithChip()))
    act(() => result.current.onPicked(false))
    expect(result.current.place).not.toBeNull()

    // Act
    act(() => result.current.close())

    // Assert
    expect(result.current.place).toBeNull()
    act(() => result.current.onPicked(false))
    expect(result.current.place).toBeNull()
  })
})
