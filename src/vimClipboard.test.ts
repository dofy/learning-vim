import { describe, expect, it, vi } from 'vitest'
import { Vim } from '@replit/codemirror-vim'
import { attachSystemClipboard } from './vimClipboard'

describe('attachSystemClipboard', () => {
  it('copies the unnamed register after yank and delete operations', async () => {
    const controller = Vim.getRegisterController()
    const writeText = vi.fn(() => Promise.resolve())
    const report = vi.fn()
    const detach = attachSystemClipboard(controller, writeText, report)

    controller.pushText(undefined, 'yank', 'one\n', true)
    controller.pushText(undefined, 'delete', 'two')
    await Promise.resolve()

    expect(writeText).toHaveBeenNthCalledWith(1, 'one\n')
    expect(writeText).toHaveBeenNthCalledWith(2, 'two')
    expect(report).toHaveBeenCalledTimes(2)
    detach()
  })

  it('does not copy the black hole register', () => {
    const controller = Vim.getRegisterController()
    const writeText = vi.fn(() => Promise.resolve())
    const detach = attachSystemClipboard(controller, writeText, vi.fn())

    controller.pushText('_', 'delete', 'discarded')

    expect(writeText).not.toHaveBeenCalled()
    detach()
  })
})
