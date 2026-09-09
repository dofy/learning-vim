import { describe, expect, it } from 'vitest'
import { parseVimrc } from './vimrc'

describe('parseVimrc', () => {
  it('uses Vim defaults when the config is empty', () => {
    expect(parseVimrc('\n" no user settings\n').preferences).toEqual({
      lineNumbers: false,
      relativeLineNumbers: false,
      lineWrapping: true,
      highlightSearch: false,
      autoIndent: false,
      smartIndent: false,
      tabSize: 8,
      softTabSize: 0,
      shiftWidth: 8,
      expandTab: false,
      filetypeDetection: false,
      syntaxHighlighting: false,
    })
  })

  it('enables and disables syntax highlighting', () => {
    expect(parseVimrc('syntax off').preferences.syntaxHighlighting).toBe(false)
    expect(parseVimrc('syntax on').preferences.syntaxHighlighting).toBe(true)
    expect(parseVimrc('syntax enable').preferences.syntaxHighlighting).toBe(true)
  })

  it('warns about unsupported syntax commands', () => {
    expect(parseVimrc('syntax manual').warnings).toEqual(['Line 1: ignored in the web editor'])
  })

  it('parses the lesson four editor options', () => {
    const result = parseVimrc(`set number relativenumber hlsearch autoindent smartindent
set tabstop=8 softtabstop=2 shiftwidth=6 expandtab
filetype on
syntax on`)

    expect(result.preferences).toMatchObject({
      lineNumbers: true,
      relativeLineNumbers: true,
      highlightSearch: true,
      autoIndent: true,
      smartIndent: true,
      tabSize: 8,
      softTabSize: 2,
      shiftWidth: 6,
      expandTab: true,
      filetypeDetection: true,
      syntaxHighlighting: true,
    })
    expect(result.warnings).toEqual([])
  })

  it('parses negative boolean options and warns about unknown settings', () => {
    const result = parseVimrc('set nonumber norelativenumber nohlsearch noautoindent nosmartindent noexpandtab softtabstop=0 mystery')

    expect(result.preferences).toMatchObject({
      lineNumbers: false,
      relativeLineNumbers: false,
      highlightSearch: false,
      autoIndent: false,
      smartIndent: false,
      expandTab: false,
      softTabSize: 0,
    })
    expect(result.warnings).toEqual(['Line 1: unsupported option mystery'])
  })

  it('preserves recursive and non-recursive mapping semantics', () => {
    const result = parseVimrc('nmap j gj\nnnoremap k gk')

    expect(result.mappings).toEqual([
      { lhs: 'j', rhs: 'gj', mode: 'normal', unmap: false, noremap: false },
      { lhs: 'k', rhs: 'gk', mode: 'normal', unmap: false, noremap: true },
    ])
  })
})
