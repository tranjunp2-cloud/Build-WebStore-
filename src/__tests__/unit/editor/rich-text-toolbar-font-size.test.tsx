// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { RichTextToolbar } from '@/components/editor/RichTextToolbar'

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: { editor: { richText: new Proxy({}, { get: (_t, k) => String(k) }) } },
    }),
}))

// TC-F05-06-17 — GH-2089: Enter trong ô cỡ chữ chỉ commit 1 lần (Enter → blur không commit lần 2).
describe('RichTextToolbar font size input (GH-2089)', () => {
    const onCommand = vi.fn()

    beforeEach(() => onCommand.mockClear())

    function setup(fontSize = 20) {
        const utils = render(<RichTextToolbar onCommand={onCommand} activeState={{ fontSize }} />)
        const input = utils.container.querySelector('input[inputmode="numeric"]') as HTMLInputElement
        input.focus()
        return { ...utils, input }
    }

    it('TC-F05-06-17a: gõ 28 + Enter (kèm blur) chỉ gọi onCommand fontSize đúng 1 lần', () => {
        const { input } = setup()
        fireEvent.change(input, { target: { value: '28' } })
        fireEvent.keyDown(input, { key: 'Enter' })
        // Enter blur() thật khiến React nhận thêm focusout → onBlur
        fireEvent.blur(input)
        const calls = onCommand.mock.calls.filter(([c]) => c === 'fontSize')
        expect(calls).toEqual([['fontSize', '28']])
    })

    it('TC-F05-06-17b: blur khi không đổi giá trị không gọi onCommand', () => {
        const { input } = setup(20)
        fireEvent.blur(input)
        expect(onCommand).not.toHaveBeenCalled()
    })

    it('TC-F05-06-17d: chọn span khác cỡ khối cha, nhập đúng cỡ khối + Enter vẫn áp lệnh', () => {
        const { input } = setup(20)
        fireEvent.change(input, { target: { value: '20' } })
        fireEvent.keyDown(input, { key: 'Enter' })
        fireEvent.blur(input)
        expect(onCommand.mock.calls).toEqual([['fontSize', '20']])
    })

    it('TC-F05-06-17e: áp 28 cho hai vùng chọn liên tiếp, cả hai lần Enter đều áp', () => {
        const { input } = setup(20)
        for (let i = 0; i < 2; i++) {
            fireEvent.change(input, { target: { value: '28' } })
            fireEvent.keyDown(input, { key: 'Enter' })
            fireEvent.blur(input)
        }
        expect(onCommand.mock.calls).toEqual([['fontSize', '28'], ['fontSize', '28']])
    })

    it('TC-F05-06-17c: nút +/− vẫn gọi 1 lần mỗi click, cộng dồn từ giá trị hiện tại', () => {
        const { getByTitle } = setup(20)
        fireEvent.click(getByTitle('Increase font size'))
        fireEvent.click(getByTitle('Decrease font size'))
        expect(onCommand.mock.calls).toEqual([['fontSize', '21'], ['fontSize', '20']])
    })
})
