import type { VimMapping, VimPreferences } from './types'

export const defaultPreferences: VimPreferences = {
  lineNumbers: true,
  relativeLineNumbers: false,
  lineWrapping: false,
  highlightSearch: true,
  autoIndent: true,
  smartIndent: true,
  tabSize: 4,
  softTabSize: 4,
  shiftWidth: 4,
  expandTab: false,
  filetypeDetection: true,
  syntaxHighlighting: true,
}

const mappingModes: Record<string, VimMapping['mode']> = {
  map: 'normal',
  noremap: 'normal',
  nmap: 'normal',
  nnoremap: 'normal',
  imap: 'insert',
  inoremap: 'insert',
  vmap: 'visual',
  vnoremap: 'visual',
  unmap: 'normal',
  nunmap: 'normal',
  iunmap: 'insert',
  vunmap: 'visual',
}

export function parseVimrc(source: string): {
  preferences: VimPreferences
  mappings: VimMapping[]
  warnings: string[]
} {
  const preferences = { ...defaultPreferences }
  const mappings: VimMapping[] = []
  const warnings: string[] = []
  let leader = '\\'

  for (const [index, rawLine] of source.split('\n').entries()) {
    const line = rawLine.trim()
    if (!line || line.startsWith('"')) continue

    const leaderMatch = line.match(/^let\s+mapleader\s*=\s*["'](.+)["']$/)
    if (leaderMatch?.[1]) {
      leader = leaderMatch[1]
      continue
    }

    const setMatch = line.match(/^set\s+(.+)$/)
    if (setMatch?.[1]) {
      for (const option of setMatch[1].split(/\s+/)) {
        if (option === 'number') preferences.lineNumbers = true
        else if (option === 'nonumber') preferences.lineNumbers = false
        else if (option === 'relativenumber') preferences.relativeLineNumbers = true
        else if (option === 'norelativenumber') preferences.relativeLineNumbers = false
        else if (option === 'wrap') preferences.lineWrapping = true
        else if (option === 'nowrap') preferences.lineWrapping = false
        else if (option === 'hlsearch') preferences.highlightSearch = true
        else if (option === 'nohlsearch') preferences.highlightSearch = false
        else if (option === 'autoindent') preferences.autoIndent = true
        else if (option === 'noautoindent') preferences.autoIndent = false
        else if (option === 'smartindent') preferences.smartIndent = true
        else if (option === 'nosmartindent') preferences.smartIndent = false
        else if (option === 'expandtab') preferences.expandTab = true
        else if (option === 'noexpandtab') preferences.expandTab = false
        else if (/^tabstop=[1-9]\d*$/.test(option)) preferences.tabSize = Number(option.split('=')[1])
        else if (/^softtabstop=[1-9]\d*$/.test(option)) preferences.softTabSize = Number(option.split('=')[1])
        else if (/^shiftwidth=[1-9]\d*$/.test(option)) preferences.shiftWidth = Number(option.split('=')[1])
        else warnings.push(`Line ${index + 1}: unsupported option ${option}`)
      }
      continue
    }

    const filetypeMatch = line.match(/^filetype\s+(on|off)$/)
    if (filetypeMatch?.[1]) {
      preferences.filetypeDetection = filetypeMatch[1] === 'on'
      continue
    }

    const syntaxMatch = line.match(/^syntax\s+(on|enable|off)$/)
    if (syntaxMatch?.[1]) {
      preferences.syntaxHighlighting = syntaxMatch[1] !== 'off'
      continue
    }

    const mappingMatch = line.match(/^(\w*map|\w*unmap)\s+(\S+)(?:\s+(.+))?$/)
    if (mappingMatch?.[1] && mappingMatch[2]) {
      const command = mappingMatch[1]
      if (!(command in mappingModes)) {
        warnings.push(`Line ${index + 1}: unsupported mapping command ${command}`)
        continue
      }
      const replaceLeader = (value: string) =>
        value.replace(/<leader>/gi, leader).replace(/<space>/gi, ' ')
      mappings.push({
        lhs: replaceLeader(mappingMatch[2]),
        rhs: replaceLeader(mappingMatch[3] || ''),
        mode: mappingModes[command],
        unmap: command.endsWith('unmap'),
        noremap: command.includes('noremap'),
      })
      continue
    }

    warnings.push(`Line ${index + 1}: ignored in the web editor`)
  }

  return { preferences, mappings, warnings }
}
