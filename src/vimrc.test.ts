import { describe, expect, it } from 'vitest'
import { parseVimrc } from './vimrc'

describe('parseVimrc', () => {
  it('enables and disables syntax highlighting', () => {
    expect(parseVimrc('syntax off').preferences.syntaxHighlighting).toBe(false)
    expect(parseVimrc('syntax on').preferences.syntaxHighlighting).toBe(true)
    expect(parseVimrc('syntax enable').preferences.syntaxHighlighting).toBe(true)
  })

  it('warns about unsupported syntax commands', () => {
    expect(parseVimrc('syntax manual').warnings).toEqual(['Line 1: ignored in the web MVP'])
  })

  it('preserves recursive and non-recursive mapping semantics', () => {
    const result = parseVimrc('nmap j gj\nnnoremap k gk')

    expect(result.mappings).toEqual([
      { lhs: 'j', rhs: 'gj', mode: 'normal', unmap: false, noremap: false },
      { lhs: 'k', rhs: 'gk', mode: 'normal', unmap: false, noremap: true },
    ])
  })
})
