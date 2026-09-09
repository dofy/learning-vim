import { describe, expect, it } from 'vitest'
import { shouldLoadMarkdownLanguage, shouldReconfigureLanguage } from './editorLanguage'

describe('editor language configuration', () => {
  it('loads Markdown syntax for syntax on without requiring filetype on', () => {
    expect(shouldLoadMarkdownLanguage({ filetypeDetection: false, syntaxHighlighting: true })).toBe(true)
  })

  it('keeps the parser available for filetype detection when highlighting is off', () => {
    expect(shouldLoadMarkdownLanguage({ filetypeDetection: true, syntaxHighlighting: false })).toBe(true)
  })

  it('restores the plain-text Vim default when both options are off', () => {
    expect(shouldLoadMarkdownLanguage({ filetypeDetection: false, syntaxHighlighting: false })).toBe(false)
  })

  it('reconfigures the language when syntax changes at runtime', () => {
    expect(shouldReconfigureLanguage(new Set(['syntaxHighlighting']))).toBe(true)
    expect(shouldReconfigureLanguage(new Set(['lineNumbers']))).toBe(false)
  })
})
