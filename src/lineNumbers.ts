import type { VimPreferences } from './types'

type LineNumberPreferences = Pick<VimPreferences, 'lineNumbers' | 'relativeLineNumbers'>

export function shouldShowLineNumbers(preferences: LineNumberPreferences) {
  return preferences.lineNumbers || preferences.relativeLineNumbers
}

export function formatVimLineNumber(
  lineNumber: number,
  cursorLine: number,
  preferences: LineNumberPreferences,
) {
  if (!preferences.relativeLineNumbers) return String(lineNumber)
  if (lineNumber !== cursorLine) return String(Math.abs(lineNumber - cursorLine))
  return preferences.lineNumbers ? String(lineNumber) : '0'
}
