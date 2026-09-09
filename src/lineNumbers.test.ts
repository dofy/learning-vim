import { describe, expect, it } from 'vitest'
import { formatVimLineNumber, shouldShowLineNumbers } from './lineNumbers'

describe('Vim line numbers', () => {
  it('shows absolute line numbers for number', () => {
    const preferences = { lineNumbers: true, relativeLineNumbers: false }
    expect(formatVimLineNumber(8, 5, preferences)).toBe('8')
    expect(formatVimLineNumber(5, 5, preferences)).toBe('5')
  })

  it('shows distances and zero for relativenumber', () => {
    const preferences = { lineNumbers: false, relativeLineNumbers: true }
    expect(formatVimLineNumber(8, 5, preferences)).toBe('3')
    expect(formatVimLineNumber(5, 5, preferences)).toBe('0')
    expect(shouldShowLineNumbers(preferences)).toBe(true)
  })

  it('shows an absolute current line when both options are enabled', () => {
    const preferences = { lineNumbers: true, relativeLineNumbers: true }
    expect(formatVimLineNumber(8, 5, preferences)).toBe('3')
    expect(formatVimLineNumber(5, 5, preferences)).toBe('5')
  })

  it('hides the gutter when both options are disabled', () => {
    expect(shouldShowLineNumbers({ lineNumbers: false, relativeLineNumbers: false })).toBe(false)
  })
})
